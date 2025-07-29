/**
 * CodeWhisperer HTTP Client
 * Handles requests to AWS CodeWhisperer API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { CodeWhispererAuth } from './auth';
import { SafeTokenManager } from './safe-token-manager';
import { CodeWhispererConverter, CodeWhispererRequest } from './converter';
import { parseEvents, convertEventsToAnthropic, parseNonStreamingResponse } from './parser';
import { processBufferedResponse } from './parser-buffered';
// Removed smart-stream-parser import due to performance issues
import { logger } from '@/utils/logger';
import { fixResponse } from '@/utils/response-fixer';

export class CodeWhispererClient implements Provider {
  public readonly name = 'codewhisperer';
  public readonly type = 'codewhisperer';
  
  private auth: CodeWhispererAuth;
  // private safeTokenManager: SafeTokenManager;
  private converter!: CodeWhispererConverter;
  private httpClient: AxiosInstance;
  private endpoint: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(public config: ProviderConfig) {
    if (!config.endpoint) {
      throw new Error('CodeWhisperer endpoint is required but not provided in configuration');
    }
    this.endpoint = config.endpoint;
    // Use custom token path if provided in config
    const tokenPath = config.authentication?.credentials?.tokenPath;
    this.auth = new CodeWhispererAuth(tokenPath);
    // 临时禁用SafeTokenManager for debugging
    // this.safeTokenManager = SafeTokenManager.getInstance();
    
    // Initialize converter with profileArn from token
    this.initializeConverter();
    
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 300000, // 5 minute timeout for production
      headers: {
        'Content-Type': 'application/json'
        // 完全模仿demo2，不设置User-Agent
      }
    });

    // Add request interceptor for authentication - temporary bypass SafeTokenManager for testing
    this.httpClient.interceptors.request.use(
      async (config) => {
        try {
          // 临时绕过SafeTokenManager直接使用auth获取token
          const token = await this.auth.getToken();
          
          if (!token) {
            logger.error('No valid token available from direct auth');
            throw new ProviderError('No valid token available', this.name, 401);
          }
          
          config.headers['Authorization'] = `Bearer ${token}`;
          logger.debug('Authentication token added successfully (direct auth)');
          return config;
        } catch (error) {
          if (error instanceof ProviderError) {
            throw error;
          }
          logger.error('Failed to add authentication token', error);
          throw new ProviderError('Authentication failed', this.name, 401, error);
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for monitoring-based error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        // Reset failure count on successful response
        this.auth.resetFailureCount();
        return response;
      },
      async (error) => {
        if (error.response?.status === 403 || error.response?.status === 401) {
          logger.warn('CodeWhisperer authentication error - reporting failure to auth monitoring', {
            status: error.response?.status,
            statusText: error.response?.statusText
          });
          
          // Check if this request has already been retried (prevent infinite loops)
          const retryCount = error.config._retryCount || 0;
          if (retryCount >= 1) {
            logger.error('Request already retried once - no further retries');
            throw new ProviderError(
              'Authentication failed after retry. Token may be invalid.',
              this.name,
              403,
              error
            );
          }
          
          // Report authentication failure to monitoring system with detailed error info
          this.auth.reportAuthFailure(error, error.response?.status);
          
          // Check if token is now blocked due to consecutive failures
          if (this.auth.isTokenBlocked()) {
            logger.error('Token blocked due to consecutive failures - no retry attempt');
            throw new ProviderError(
              'Token blocked due to consecutive authentication failures. Please refresh your token manually.',
              this.name,
              500,
              error
            );
          }
          
          try {
            // Clear cache and attempt one refresh if token is not blocked
            this.auth.clearCache();
            const newToken = await this.auth.getToken();
            
            if (newToken) {
              // Mark this request as retried to prevent infinite loops
              error.config._retryCount = retryCount + 1;
              // Use new token for retry
              error.config.headers['Authorization'] = `Bearer ${newToken}`;
              logger.info('Retrying request with refreshed token');
              return this.httpClient.request(error.config);
            } else {
              throw new ProviderError('No valid token for retry', this.name, 500, error);
            }
          } catch (refreshError) {
            logger.error('Token refresh failed', refreshError);
            // Report this failure as well with detailed error info
            this.auth.reportAuthFailure(refreshError, refreshError instanceof ProviderError ? refreshError.statusCode : undefined);
            
            if (refreshError instanceof ProviderError) {
              throw refreshError;
            }
            throw new ProviderError('Token refresh failed', this.name, 500, refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize converter with profileArn from token
   */
  private initializeConverter(): void {
    try {
      const tokenData = this.auth.readTokenFromFile();
      if (!tokenData.profileArn) {
        throw new Error('CodeWhisperer profileArn not found in token file');
      }
      this.converter = new CodeWhispererConverter(tokenData.profileArn);
      logger.debug('Initialized CodeWhisperer converter with profileArn from token', {
        profileArn: tokenData.profileArn
      });
    } catch (error) {
      logger.error('Failed to initialize CodeWhisperer converter', error);
      throw new Error(`Failed to initialize CodeWhisperer converter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if provider is healthy using SafeTokenManager
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 临时禁用SafeTokenManager检查，直接检查auth
      const token = await this.auth.getToken();
      if (!token) {
        logger.warn('CodeWhisperer health check failed - no valid token');
        return false;
      }

      logger.debug('CodeWhisperer health check passed (direct auth)');
      return true;
    } catch (error) {
      logger.error('CodeWhisperer health check failed', error);
      return false;
    }
  }

  /**
   * Send request to CodeWhisperer
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    // Check if token is blocked before sending request
    if (this.auth.isTokenBlocked()) {
      logger.error('Request blocked - token is invalid due to consecutive failures', {}, requestId, 'provider');
      throw new ProviderError(
        'Token blocked due to consecutive authentication failures. Please refresh your token manually.',
        this.name,
        500
      );
    }
    
    try {
      logger.trace(requestId, 'provider', 'Sending request to CodeWhisperer', {
        model: request.model,
        stream: request.stream
      });

      // Convert request to CodeWhisperer format
      const cwRequest = this.converter.convertRequest(request, requestId);
      
      // 添加详细调试日志
      logger.debug('CodeWhisperer HTTP request details', {
        url: this.endpoint + '/generateAssistantResponse',
        requestBody: JSON.stringify(cwRequest),
        requestBodyLength: JSON.stringify(cwRequest).length
      }, requestId, 'provider');
      
      // Send request with binary response type for CodeWhisperer
      const response = await this.httpClient.post('/generateAssistantResponse', cwRequest, {
        responseType: 'arraybuffer'
      });
      
      // 添加响应调试日志
      const responseBuffer = Buffer.from(response.data);
      logger.debug('CodeWhisperer HTTP response details', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataLength: responseBuffer.length,
        dataPreview: responseBuffer.toString('hex').substring(0, 100)
      }, requestId, 'provider');
      
      if (response.status !== 200) {
        // 🔍 ENHANCED 400 ERROR REPORTING - show model name for debugging
        let errorMessage = `CodeWhisperer API returned status ${response.status}`;
        
        if (response.status === 400) {
          const modelName = cwRequest?.conversationState?.currentMessage?.userInputMessage?.modelId || request.model || 'unknown';
          errorMessage += ` | Sent model: "${modelName}"`;
          
          logger.error(`🚨 CodeWhisperer 400 Error - Model Configuration Issue`, {
            httpStatus: 400,
            requestedModel: request.model,
            sentModelId: cwRequest?.conversationState?.currentMessage?.userInputMessage?.modelId,
            endpoint: this.endpoint,
            possibleCause: 'Model name may not be supported by CodeWhisperer',
            troubleshooting: 'Check if model name matches CodeWhisperer supported models'
          }, requestId, 'provider');
        }
        
        throw new ProviderError(
          errorMessage,
          this.name,
          response.status,
          response.data
        );
      }

      // 🚀 使用完全缓冲处理 - 避免智能流式解析器的性能问题
      logger.info('Starting full buffered response processing', {
        responseLength: responseBuffer.length,
        rawPreview: responseBuffer.toString('hex').substring(0, 100)
      }, requestId);
      
      const anthropicEvents = processBufferedResponse(responseBuffer, requestId, request.model);
      
      // 从事件中提取内容 - 支持完整的工具调用处理
      const contexts: any[] = [];
      const toolInputs: { [key: string]: string } = {}; // 累积工具输入
      
      for (const event of anthropicEvents) {
        logger.debug('Processing event for context extraction', {
          eventType: event.event,
          hasData: !!event.data,
          dataKeys: event.data ? Object.keys(event.data) : []
        }, requestId, 'provider');
        
        if (event.event === 'content_block_start' && event.data?.content_block) {
          const block = event.data.content_block;
          if (block.type === 'text') {
            contexts.push({ type: 'text', text: block.text || '' });
          } else if (block.type === 'tool_use') {
            contexts.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input || {} // 先使用初始输入
            });
          }
        } else if (event.event === 'content_block_delta' && event.data?.delta) {
          const delta = event.data.delta;
          const blockIndex = event.data.index;
          
          if (delta.type === 'input_json_delta' && contexts[blockIndex] && contexts[blockIndex].type === 'tool_use') {
            // 累积工具输入JSON
            const toolId = contexts[blockIndex].id;
            if (!toolInputs[toolId]) {
              toolInputs[toolId] = '';
            }
            toolInputs[toolId] += delta.partial_json;
            
            logger.debug('Accumulated tool input JSON', {
              toolId,
              addedJson: delta.partial_json,
              totalJson: toolInputs[toolId]
            }, requestId, 'provider');
          } else if (delta.type === 'text_delta' && contexts[blockIndex] && contexts[blockIndex].type === 'text') {
            // 累积文本内容
            contexts[blockIndex].text += delta.text || '';
          }
        }
      }
      
      // 解析累积的工具输入JSON
      for (const context of contexts) {
        if (context.type === 'tool_use' && toolInputs[context.id]) {
          try {
            context.input = JSON.parse(toolInputs[context.id]);
            logger.info('Successfully parsed final tool input', {
              toolId: context.id,
              toolName: context.name,
              inputJson: toolInputs[context.id],
              parsedInput: JSON.stringify(context.input)
            }, requestId, 'provider');
          } catch (error) {
            logger.error('Failed to parse final tool input JSON', {
              toolId: context.id,
              inputJson: toolInputs[context.id],
              error: error instanceof Error ? error.message : String(error)
            }, requestId, 'provider');
            context.input = {};
          }
        }
      }
      
      logger.debug('Final extracted contexts from buffered events', {
        contextCount: contexts.length,
        contextTypes: contexts.map(c => c.type),
        toolContexts: contexts.filter(c => c.type === 'tool_use').map(c => ({
          name: c.name,
          hasInput: Object.keys(c.input).length > 0,
          inputKeys: Object.keys(c.input)
        }))
      }, requestId, 'provider');
      
      // 应用全面修复机制
      const fixedResponse = fixResponse({ content: contexts }, requestId);
      const finalContexts = fixedResponse.content;
      
      if (fixedResponse.fixes_applied.length > 0) {
        logger.info('Applied response fixes', {
          fixesApplied: fixedResponse.fixes_applied,
          originalBlocks: contexts.length,
          fixedBlocks: finalContexts.length
        }, requestId, 'provider');
      }
      
      // Convert to BaseResponse format
      // Model name has already been replaced by routing engine
      const baseResponse: BaseResponse = {
        id: `cw_${Date.now()}`,
        model: request.model, // Already mapped by routing engine
        role: 'assistant',
        content: finalContexts,
        // No stop_reason to allow conversation continuation
        usage: {
          input_tokens: this.estimateInputTokens(cwRequest),
          output_tokens: this.estimateOutputTokens(finalContexts)
        }
      };

      logger.debug('CodeWhisperer BaseResponse created', {
        hasStopReason: 'stop_reason' in baseResponse,
        stopReasonValue: baseResponse.stop_reason,
        responseKeys: Object.keys(baseResponse)
      }, requestId, 'provider');

      logger.trace(requestId, 'provider', 'Request completed successfully', {
        responseLength: contexts.length,
        usage: baseResponse.usage
      });

      return baseResponse;
    } catch (error) {
      logger.error('CodeWhisperer request failed', error, requestId, 'provider');
      
      if (error instanceof ProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `CodeWhisperer request failed: ${errorMessage}`,
        this.name,
        500,
        error
      );
    }
  }

  /**
   * Send streaming request to CodeWhisperer
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    // Check if token is blocked before sending streaming request
    if (this.auth.isTokenBlocked()) {
      logger.error('Streaming request blocked - token is invalid due to consecutive failures', {}, requestId, 'provider');
      throw new ProviderError(
        'Token blocked due to consecutive authentication failures. Please refresh your token manually.',
        this.name,
        500
      );
    }
    
    try {
      logger.trace(requestId, 'provider', 'Sending streaming request to CodeWhisperer', {
        model: request.model
      });

      // Convert request to CodeWhisperer format
      const cwRequest = this.converter.convertRequest(request, requestId);
      
      // Send streaming request
      const response = await this.httpClient.post('/generateAssistantResponse', cwRequest, {
        headers: {
          'Accept': 'text/event-stream'
        },
        responseType: 'stream'
      });

      if (response.status !== 200) {
        // 🔍 ENHANCED STREAMING ERROR REPORTING - show model name for debugging
        let errorMessage = `CodeWhisperer streaming API returned status ${response.status}`;
        
        if (response.status === 400) {
          const modelName = cwRequest?.conversationState?.currentMessage?.userInputMessage?.modelId || request.model || 'unknown';
          errorMessage += ` | Sent model: "${modelName}"`;
          
          logger.error(`🚨 CodeWhisperer Streaming 400 Error - Model Configuration Issue`, {
            httpStatus: 400,
            requestedModel: request.model,
            sentModelId: cwRequest?.conversationState?.currentMessage?.userInputMessage?.modelId,
            endpoint: this.endpoint,
            streamingMode: true,
            possibleCause: 'Model name may not be supported by CodeWhisperer streaming API',
            troubleshooting: 'Check if model name matches CodeWhisperer supported models'
          }, requestId, 'provider');
        }
        
        throw new ProviderError(
          errorMessage,
          this.name,
          response.status
        );
      }

      // Collect all chunks first (like demo2 implementation)
      const chunks: Buffer[] = [];
      
      for await (const chunk of response.data) {
        chunks.push(Buffer.from(chunk));
      }
      
      const fullResponse = Buffer.concat(chunks);
      
      logger.debug('Raw response received from CodeWhisperer', {
        responseLength: fullResponse.length,
        responseStart: fullResponse.toString('utf-8', 0, Math.min(500, fullResponse.length))
      }, requestId, 'provider');
      
      // 使用完全缓冲式处理：非流式 -> 流式转换
      logger.debug('Using full buffered processing strategy', {
        responseLength: fullResponse.length
      }, requestId, 'provider');
      
      const anthropicEvents = processBufferedResponse(fullResponse, requestId, request.model);
      logger.debug('Completed buffered processing', {
        anthropicEventCount: anthropicEvents.length,
        events: anthropicEvents.map(e => ({ event: e.event, hasData: !!e.data }))
      }, requestId, 'provider');
      
      // Yield events
      for (const event of anthropicEvents) {
        logger.debug('Yielding event', { event: event.event, data: event.data }, requestId, 'provider');
        yield {
          event: event.event,
          data: event.data
        };
      }

      logger.trace(requestId, 'provider', 'Streaming request completed', {
        eventCount: anthropicEvents.length,
        totalYielded: anthropicEvents.length
      });
      
    } catch (error) {
      // Log detailed error information
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        code: (error as any)?.code,
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        url: this.endpoint + '/generateAssistantResponse',
        requestSummary: {
          model: request.model,
          messageCount: request.messages?.length || 0,
          hasTools: !!(request.metadata?.tools?.length),
          sessionId: request.metadata?.sessionId
        }
      };
      
      logger.error('CodeWhisperer streaming request failed', errorDetails, requestId, 'provider');
      
      if (error instanceof ProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `CodeWhisperer streaming request failed: ${errorMessage}`,
        this.name,
        500,
        error
      );
    }
  }

  /**
   * Estimate input tokens (rough approximation)
   */
  private estimateInputTokens(cwRequest: CodeWhispererRequest): number {
    const content = cwRequest.conversationState.currentMessage.userInputMessage.content;
    const historyLength = cwRequest.conversationState.history.length;
    
    // Rough estimation: 4 characters per token
    return Math.ceil((content.length + historyLength * 100) / 4);
  }

  /**
   * Estimate output tokens (rough approximation)
   */
  private estimateOutputTokens(contexts: any[]): number {
    let totalChars = 0;
    
    contexts.forEach(context => {
      if (context.text) {
        totalChars += context.text.length;
      } else if (context.type === 'tool_use') {
        totalChars += JSON.stringify(context.input || {}).length;
      }
    });
    
    // Rough estimation: 4 characters per token
    return Math.ceil(totalChars / 4);
  }

  /**
   * Update configuration
   */
  updateConfig(config: ProviderConfig): void {
    this.config = config;
    
    // Re-initialize converter with current token profileArn
    this.initializeConverter();
    
    logger.info('CodeWhisperer client configuration updated', { 
      endpoint: config.endpoint
    });
  }

  /**
   * Get request summary for error logging
   */
  private getRequestSummary(request: any): any {
    return {
      url: request?.url,
      method: request?.method,
      hasHeaders: !!request?.headers,
      hasAuth: !!(request?.headers?.Authorization || request?.headers?.authorization),
      bodySize: request?.data ? JSON.stringify(request.data).length : 0,
      conversationId: request?.data?.conversationState?.conversationId,
      modelId: request?.data?.conversationState?.currentMessage?.userInputMessage?.modelId
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || status === 502 || status === 503 || status === 504;
    }
    
    return false;
  }

  /**
   * Wait for retry delay
   */
  private async waitForRetry(attempt: number): Promise<void> {
    const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    requestId: string,
    operation: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retrying ${operation} (attempt ${attempt}/${this.maxRetries})`, {}, requestId, 'provider');
          await this.waitForRetry(attempt - 1);
        }
        
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          break;
        }
        
        logger.warn(`${operation} failed, will retry`, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error)
        }, requestId, 'provider');
      }
    }
    
    throw lastError;
  }

  // Removed processWithSmartStreaming method due to severe performance issues
  // It was generating 77,643 events causing 65-second delays
}