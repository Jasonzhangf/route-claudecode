/**
 * CodeWhisperer HTTP Client
 * Handles requests to AWS CodeWhisperer API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { CodeWhispererAuth } from './auth';
import { CodeWhispererConverter, CodeWhispererRequest } from './converter';
import { parseEvents, convertEventsToAnthropic, parseNonStreamingResponse } from './parser';
import { logger } from '@/utils/logger';

export class CodeWhispererClient implements Provider {
  public readonly name = 'codewhisperer';
  public readonly type = 'codewhisperer';
  
  private auth: CodeWhispererAuth;
  private converter: CodeWhispererConverter;
  private httpClient: AxiosInstance;
  private endpoint: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(public config: ProviderConfig) {
    this.endpoint = config.endpoint || 'https://codewhisperer.us-east-1.amazonaws.com';
    this.auth = new CodeWhispererAuth();
    this.converter = new CodeWhispererConverter(config.settings?.profileArn);
    
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router/2.0.0'
      }
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(
      async (config) => {
        try {
          const token = await this.auth.getToken();
          config.headers['Authorization'] = `Bearer ${token}`;
          return config;
        } catch (error) {
          logger.error('Failed to add authentication token', error);
          throw new ProviderError('Authentication failed', this.name, 401, error);
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 403) {
          logger.warn('CodeWhisperer token expired, attempting refresh');
          try {
            // Clear cached token and retry once
            this.auth.clearCache();
            const newToken = await this.auth.getToken();
            error.config.headers['Authorization'] = `Bearer ${newToken}`;
            return this.httpClient.request(error.config);
          } catch (refreshError) {
            logger.error('Token refresh failed', refreshError);
            throw new ProviderError('Token refresh failed', this.name, 403, refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try to get token and validate it
      const token = await this.auth.getToken();
      const isValid = await this.auth.validateToken(token);
      
      if (!isValid) {
        logger.warn('CodeWhisperer token validation failed');
        return false;
      }

      // Optional: Make a simple request to test connectivity
      // For now, just return true if token is valid
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
    
    try {
      logger.trace(requestId, 'provider', 'Sending request to CodeWhisperer', {
        model: request.model,
        stream: request.stream
      });

      // Convert request to CodeWhisperer format
      const cwRequest = this.converter.convertRequest(request, requestId);
      
      // Send request
      const response = await this.httpClient.post('/generateAssistantResponse', cwRequest);
      
      if (response.status !== 200) {
        throw new ProviderError(
          `CodeWhisperer API returned status ${response.status}`,
          this.name,
          response.status,
          response.data
        );
      }

      // Parse response
      const contexts = parseNonStreamingResponse(Buffer.from(JSON.stringify(response.data)), requestId);
      
      // Convert to BaseResponse format
      const baseResponse: BaseResponse = {
        id: `cw_${Date.now()}`,
        model: request.model,
        role: 'assistant',
        content: contexts,
        stop_reason: 'end_turn',
        usage: {
          input_tokens: this.estimateInputTokens(cwRequest),
          output_tokens: this.estimateOutputTokens(contexts)
        }
      };

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
        throw new ProviderError(
          `CodeWhisperer API returned status ${response.status}`,
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
      
      // Parse events
      const events = parseEvents(fullResponse);
      logger.debug('Parsed events from CodeWhisperer', {
        eventCount: events.length,
        events: events.map(e => ({ event: e.Event, dataType: typeof e.Data }))
      }, requestId, 'provider');
      
      const anthropicEvents = convertEventsToAnthropic(events, requestId);
      logger.debug('Converted to Anthropic events', {
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
    
    if (config.settings?.profileArn) {
      this.converter.updateProfileArn(config.settings.profileArn);
    }
    
    logger.info('CodeWhisperer client configuration updated', { 
      endpoint: config.endpoint,
      profileArn: config.settings?.profileArn 
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
}