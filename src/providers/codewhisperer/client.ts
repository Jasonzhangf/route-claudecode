/**
 * CodeWhisperer HTTP Client
 * Handles requests to AWS CodeWhisperer API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { CodeWhispererAuth } from './auth';
import { SafeTokenManager } from './safe-token-manager';
import { CodeWhispererTokenRotationManager, TokenRotationConfig } from './token-rotation-manager';
import { CodeWhispererConverter, CodeWhispererRequest } from './converter';
import { parseEvents, convertEventsToAnthropic, parseNonStreamingResponse } from './parser';
import { logger } from '@/utils/logger';
import { fixResponse } from '@/utils/response-fixer';
import { captureHttpEvent, captureParsingEvent } from './data-capture';

export class CodeWhispererClient implements Provider {
  public readonly name = 'codewhisperer';
  public readonly type = 'codewhisperer';
  
  private auth: CodeWhispererAuth;
  private tokenRotationManager?: CodeWhispererTokenRotationManager;
  // private safeTokenManager: SafeTokenManager;
  private converter!: CodeWhispererConverter;
  private httpClient: AxiosInstance;
  private endpoint: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  // Removed non-streaming strategy - using streaming only

  constructor(public config: ProviderConfig) {
    if (!config.endpoint) {
      throw new Error('CodeWhisperer endpoint is required but not provided in configuration');
    }
    this.endpoint = config.endpoint;
    
    // Handle token configuration - support both single and multiple tokens
    const credentials = config.authentication?.credentials;
    const tokenPath = credentials?.tokenPath;
    const profileArn = config.settings?.profileArn;
    
    if (Array.isArray(tokenPath) && tokenPath.length > 1) {
      // Multiple tokens - initialize rotation manager
      const tokenConfigs = tokenPath.map((path, index) => ({
        path,
        profileArn,
        description: `CodeWhisperer Token ${index + 1}`
      }));
      
      this.tokenRotationManager = new CodeWhispererTokenRotationManager(
        tokenConfigs,
        'codewhisperer-primary',
        config.tokenRotation || {
          strategy: 'health_based',
          cooldownMs: 5000,
          maxRetriesPerToken: 2,
          tempDisableCooldownMs: 300000,
          maxRefreshFailures: 3,
          refreshRetryIntervalMs: 60000
        }
      );
      
      // Use first token for auth fallback
      this.auth = new CodeWhispererAuth(tokenPath[0], profileArn);
      
      logger.info('Initialized CodeWhisperer token rotation', {
        tokenCount: tokenPath.length,
        strategy: config.tokenRotation?.strategy || 'health_based'
      });
    } else {
      // Single token - traditional approach
      const finalTokenPath = Array.isArray(tokenPath) ? tokenPath[0] : tokenPath;
      this.auth = new CodeWhispererAuth(finalTokenPath, profileArn);
    }
    
    // Demo2 style: Perform startup token validation and refresh
    this.performStartupTokenValidation();
    
    // Initialize converter with profileArn from config or token
    this.initializeConverter();
    
    // Removed performance testing tools - using streaming only
    
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 30000, // 30 second timeout - emergency fix for hanging requests
      headers: {
        'Content-Type': 'application/json'
        // 完全模仿demo2，不设置User-Agent
      }
    });

    // Add request interceptor for authentication with token rotation support
    this.httpClient.interceptors.request.use(
      async (config) => {
        try {
          const requestId = config.headers['X-Request-ID'] || 'http-interceptor';
          let token: string;
          let tokenPath: string;
          
          if (this.tokenRotationManager) {
            // Use token rotation manager
            const tokenData = await this.tokenRotationManager.getNextToken(requestId);
            token = tokenData.token;
            tokenPath = tokenData.tokenPath;
            
            logger.debug('Authentication token obtained from rotation manager', {
              tokenPath: tokenPath.substring(tokenPath.lastIndexOf('/') + 1),
              requestId
            });
          } else {
            // Use single token auth
            token = await this.auth.getToken(requestId);
            tokenPath = 'single-token';
            
            if (!token) {
              logger.error('No valid token available from direct auth');
              throw new ProviderError('No valid token available', this.name, 401);
            }
          }
          
          config.headers['Authorization'] = `Bearer ${token}`;
          config.headers['X-Token-Path'] = tokenPath; // For error tracking
          logger.debug('Authentication token added successfully');
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

    // Add response interceptor for monitoring-based error handling with rotation support
    this.httpClient.interceptors.response.use(
      (response) => {
        // Report success to rotation manager or auth
        const tokenPath = response.config.headers['X-Token-Path'];
        const requestId = response.config.headers['X-Request-ID'] || 'unknown';
        
        if (this.tokenRotationManager && tokenPath && tokenPath !== 'single-token') {
          this.tokenRotationManager.reportTokenSuccess(tokenPath, requestId);
        } else {
          this.auth.resetFailureCount();
        }
        
        return response;
      },
      async (error) => {
        const tokenPath = error.config?.headers?.['X-Token-Path'];
        const requestId = error.config?.headers?.['X-Request-ID'] || 'auth-retry';
        const isAuthError = error.response?.status === 403 || error.response?.status === 401;
        
        if (isAuthError) {
          logger.warn('CodeWhisperer authentication error detected', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            tokenPath,
            hasRotationManager: !!this.tokenRotationManager
          });
          
          // Report failure to rotation manager or auth
          if (this.tokenRotationManager && tokenPath && tokenPath !== 'single-token') {
            this.tokenRotationManager.reportTokenFailure(tokenPath, error, error.response?.status);
          }
          
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
          
          try {
            let newToken: string;
            let newTokenPath: string;
            
            if (this.tokenRotationManager) {
              // Try to get a different token from rotation manager
              const tokenData = await this.tokenRotationManager.getNextToken(requestId);
              newToken = tokenData.token;
              newTokenPath = tokenData.tokenPath;
              
              logger.info('Retrying with different token from rotation manager', {
                newTokenPath: newTokenPath.substring(newTokenPath.lastIndexOf('/') + 1)
              });
            } else {
              // Fallback to single token refresh
              newToken = await this.auth.handleAuthError(requestId);
              newTokenPath = 'single-token';
              
              logger.info('Retrying with refreshed single token');
            }
            
            // Mark this request as retried to prevent infinite loops
            error.config._retryCount = retryCount + 1;
            // Use new token for retry
            error.config.headers['Authorization'] = `Bearer ${newToken}`;
            error.config.headers['X-Token-Path'] = newTokenPath;
            
            return this.httpClient.request(error.config);
          } catch (refreshError) {
            logger.error('Token refresh/rotation failed', refreshError);
            
            if (refreshError instanceof ProviderError) {
              throw refreshError;
            }
            throw new ProviderError('Token refresh/rotation failed', this.name, 500, refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Perform startup token validation (Demo2 style)
   */
  private performStartupTokenValidation(): void {
    // Run validation asynchronously but don't block constructor
    setImmediate(async () => {
      try {
        await this.auth.validateAndRefreshOnStartup();
        logger.info('CodeWhisperer startup token validation completed successfully');
      } catch (error) {
        logger.error('CodeWhisperer startup token validation failed', error);
        // Don't throw here as it would crash the application
        // The auth system will handle token refresh when requests are made
      }
    });
  }

  /**
   * Initialize converter with profileArn from config or token
   */
  private initializeConverter(): void {
    try {
      // First try to get profileArn from auth (which may have been set from config)
      const configProfileArn = this.auth.getProfileArn();
      if (configProfileArn) {
        this.converter = new CodeWhispererConverter(configProfileArn);
        logger.debug('Initialized CodeWhisperer converter with profileArn from config', {
          profileArn: configProfileArn
        });
        return;
      }
      
      // Fallback: try to get profileArn from token file via auth method
      const profileArnFromToken = this.auth.getProfileArn();
      if (!profileArnFromToken) {
        throw new Error('CodeWhisperer profileArn not found in config or token file');
      }
      this.converter = new CodeWhispererConverter(profileArnFromToken);
      logger.debug('Initialized CodeWhisperer converter with profileArn from token', {
        profileArn: profileArnFromToken
      });
    } catch (error) {
      logger.error('Failed to initialize CodeWhisperer converter', error);
      throw new Error(`Failed to initialize CodeWhisperer converter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (this.tokenRotationManager) {
        // Check if any tokens are available from rotation manager
        const tokenData = await this.tokenRotationManager.getNextToken('health-check');
        if (!tokenData.token) {
          logger.warn('CodeWhisperer health check failed - no valid tokens in rotation');
          return false;
        }
        
        logger.debug('CodeWhisperer health check passed (token rotation)', {
          tokenPath: tokenData.tokenPath.substring(tokenData.tokenPath.lastIndexOf('/') + 1)
        });
        return true;
      } else {
        // Single token check
        const token = await this.auth.getToken('health-check');
        if (!token) {
          logger.warn('CodeWhisperer health check failed - no valid token');
          return false;
        }

        logger.debug('CodeWhisperer health check passed (single token)');
        return true;
      }
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
    
    // Check if tokens are available before sending request
    if (this.tokenRotationManager) {
      // Check if any tokens are available
      try {
        await this.tokenRotationManager.getNextToken(requestId);
      } catch (error) {
        logger.error('Request blocked - no valid tokens available in rotation', {}, requestId, 'provider');
        throw new ProviderError(
          'No valid tokens available. All tokens may be disabled or invalid.',
          this.name,
          500
        );
      }
    } else {
      // Single token check
      if (this.auth.isTokenBlocked()) {
        logger.error('Request blocked - token is invalid due to consecutive failures', {}, requestId, 'provider');
        throw new ProviderError(
          'Token blocked due to consecutive authentication failures. Please refresh your token manually.',
          this.name,
          500
        );
      }
    }
    
    try {
      logger.trace(requestId, 'provider', 'Sending request to CodeWhisperer', {
        model: request.model,
        stream: request.stream
      });

      // Convert request to CodeWhisperer format
      const cwRequest = this.converter.convertRequest(request, requestId);
      
      // Using streaming only - no non-streaming conversion
      logger.info('🎯 CodeWhisperer using streaming strategy', {
        url: this.endpoint + '/generateAssistantResponse',
        requestBodyLength: JSON.stringify(cwRequest).length,
        strategy: 'universal-streaming'
      }, requestId, 'provider');

      let response;
      let anthropicEvents;
      const strategyStartTime = Date.now();
      
      // 🔄 Use traditional streaming approach with universal optimization
      const httpStartTime = Date.now();
      
      // Capture HTTP request
      captureHttpEvent(requestId, 'request_sent', {
        url: this.endpoint + '/generateAssistantResponse',
        method: 'POST',
        requestBody: cwRequest,
        timeTaken: 0
      });
      
      response = await this.httpClient.post('/generateAssistantResponse', cwRequest, {
        responseType: 'arraybuffer',
        headers: {
          'X-Request-ID': requestId
        }
      });
      
      // Capture HTTP response
      captureHttpEvent(requestId, 'response_received', {
        url: this.endpoint + '/generateAssistantResponse',
        method: 'POST',
        responseStatus: response.status,
        responseHeaders: response.headers as Record<string, string>,
        responseSize: response.data ? Buffer.from(response.data).length : 0,
        timeTaken: Date.now() - httpStartTime
      });
      
      if (response.status !== 200) {
        let errorMessage = `CodeWhisperer API returned status ${response.status}`;
        if (response.status === 400) {
          const modelName = cwRequest?.conversationState?.currentMessage?.userInputMessage?.modelId || request.model || 'unknown';
          errorMessage += ` | Sent model: "${modelName}"`;
        }
        
        // Capture HTTP error
        captureHttpEvent(requestId, 'http_error', {
          url: this.endpoint + '/generateAssistantResponse',
          method: 'POST',
          responseStatus: response.status,
          timeTaken: Date.now() - httpStartTime
        }, { errorMessage });
        
        throw new ProviderError(errorMessage, this.name, response.status, response.data);
      }

      const responseBuffer = Buffer.from(response.data);
      const streamingStartTime = Date.now();
      
      // 🔄 Switch back to direct streaming processing with tool call accumulation
      // Parse raw events from CodeWhisperer
      const sseEvents = parseEvents(responseBuffer);
      logger.info('Parsed SSE events from raw response', {
        eventCount: sseEvents.length,
        eventTypes: sseEvents.map(e => e.Event)
      }, requestId);
      
      // Capture parsing event start
      captureParsingEvent(requestId, 'sse_parsing', {
        parsingMethod: 'streaming',
        responseSize: responseBuffer.length,
        sseEventCount: sseEvents.length,
        processingTime: 0,
        timeTaken: 0
      });
      
      // Convert to Anthropic format with tool call processing
      anthropicEvents = convertEventsToAnthropic(sseEvents, requestId);
      
      const streamingTime = Date.now() - streamingStartTime;
      
      // Capture parsing completion
      captureParsingEvent(requestId, 'stream_reconstruction', {
        parsingMethod: 'streaming',
        sseEventCount: sseEvents.length,
        streamEvents: anthropicEvents,
        processingTime: streamingTime,
        timeTaken: streamingTime
      });
      
      logger.info('✅ Universal streaming completed', {
        processingTime: streamingTime,
        eventCount: anthropicEvents.length,
        responseSize: responseBuffer.length
      }, requestId, 'provider');
      
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
    
    // Check if tokens are available before sending streaming request
    if (this.tokenRotationManager) {
      // Check if any tokens are available
      try {
        await this.tokenRotationManager.getNextToken(requestId);
      } catch (error) {
        logger.error('Streaming request blocked - no valid tokens available in rotation', {}, requestId, 'provider');
        throw new ProviderError(
          'No valid tokens available for streaming. All tokens may be disabled or invalid.',
          this.name,
          500
        );
      }
    } else {
      // Single token check
      if (this.auth.isTokenBlocked()) {
        logger.error('Streaming request blocked - token is invalid due to consecutive failures', {}, requestId, 'provider');
        throw new ProviderError(
          'Token blocked due to consecutive authentication failures. Please refresh your token manually.',
          this.name,
          500
        );
      }
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
      logger.debug('Using streaming processing strategy', {
        responseLength: fullResponse.length
      }, requestId, 'provider');
      
      // Parse events and convert to Anthropic format
      const sseEvents = parseEvents(fullResponse);
      const anthropicEvents = convertEventsToAnthropic(sseEvents, requestId);
      logger.debug('Completed streaming processing', {
        sseEventCount: sseEvents.length,
        anthropicEventCount: anthropicEvents.length,
        events: anthropicEvents.map((e: any) => ({ event: e.event, hasData: !!e.data }))
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