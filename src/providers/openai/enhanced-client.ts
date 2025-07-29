/**
 * Enhanced OpenAI-Compatible Client
 * Uses the new transformation system for better format handling
 */

import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { fixResponse } from '@/utils/response-fixer';
import { 
  transformationManager, 
  transformAnthropicToOpenAI, 
  transformOpenAIResponseToAnthropic,
  StreamTransformOptions
} from '@/transformers';

export class EnhancedOpenAIClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai';
  
  private httpClient: AxiosInstance;
  private endpoint: string;
  private apiKey: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(public config: ProviderConfig, providerId: string) {
    this.name = providerId;
    this.endpoint = config.endpoint;
    this.apiKey = config.authentication.credentials.apiKey || config.authentication.credentials.api_key;
    
    if (!this.endpoint) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires endpoint configuration`);
    }

    // Use endpoint as full URL including path
    // Enable keep-alive for both HTTP and HTTPS
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true });

    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 300000, // 5 minute timeout for production
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router/2.0.0'
      },
      httpAgent,
      httpsAgent
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  /**
   * Check if provider is healthy
   * For chat completion endpoints, we'll assume healthy if configured properly
   */
  async isHealthy(): Promise<boolean> {
    // For chat completion endpoints, we can't easily check health without making a real request
    // Return true if we have proper configuration
    return !!(this.endpoint && this.apiKey);
  }

  /**
   * Check if error is retryable (429, 502, 503, 504)
   */
  private isRetryableError(error: any): boolean {
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || status === 502 || status === 503 || status === 504;
    }
    return false;
  }

  /**
   * Wait for retry delay - 429 specific: 3 retries with 60s wait on 3rd retry
   */
  private async waitForRetry(attempt: number, isRateLimited: boolean = false): Promise<void> {
    let delay: number;
    
    if (isRateLimited) {
      // For 429 errors: 1s, 5s, 60s delays
      if (attempt === 0) delay = 1000;      // 1st retry: 1s
      else if (attempt === 1) delay = 5000;  // 2nd retry: 5s  
      else delay = 60000;                    // 3rd retry: 60s
    } else {
      // For other retryable errors: exponential backoff
      delay = this.retryDelay * Math.pow(2, attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    operation: string,
    requestId: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          break;
        }
        
        const isRateLimited = (error as any)?.response?.status === 429;
        const delayInfo = isRateLimited ? 
          (attempt === 0 ? '1s' : attempt === 1 ? '5s' : '60s') : 
          `${this.retryDelay * Math.pow(2, attempt)}ms`;
        
        logger.warn(`${operation} failed, will retry`, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
          status: (error as any)?.response?.status,
          nextRetryDelay: delayInfo,
          isRateLimited
        }, requestId, 'provider');
        
        await this.waitForRetry(attempt, isRateLimited);
      }
    }
    
    // Ensure proper error handling after retry exhaustion
    if ((lastError as any)?.response?.status === 429) {
      throw new ProviderError(
        `${this.name} rate limit exceeded after ${this.maxRetries} retries`,
        this.name,
        429,
        (lastError as any)?.response?.data
      );
    }
    
    throw lastError;
  }

  /**
   * Send request to OpenAI-compatible API
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.trace(requestId, 'provider', `Sending request to ${this.name}`, {
      model: request.model,
      stream: request.stream
    });

    try {
      // Transform Anthropic format to OpenAI format using new transformer
      const openaiRequest = this.convertToOpenAI(request);
      
      // Execute with retry logic
      const response = await this.executeWithRetry(
        async () => {
          const resp = await this.httpClient.post(this.endpoint, openaiRequest);
          
          if (resp.status < 200 || resp.status >= 300) {
            throw new ProviderError(
              `${this.name} API returned status ${resp.status}`,
              this.name,
              resp.status,
              resp.data
            );
          }
          
          return resp;
        },
        `${this.name} sendRequest`,
        requestId
      );

      // Transform OpenAI response back to Anthropic format using new transformer
      const baseResponse = this.convertFromOpenAI(response.data, request);

      logger.trace(requestId, 'provider', `Request completed successfully for ${this.name}`, {
        usage: baseResponse.usage
      });

      return baseResponse;
    } catch (error) {
      logger.error(`${this.name} request failed after retries`, error, requestId, 'provider');
      
      if (error instanceof ProviderError) {
        throw error;
      }
      
      // For 429 errors, preserve the status code
      if ((error as any)?.response?.status === 429) {
        throw new ProviderError(
          `${this.name} rate limit exceeded`,
          this.name,
          429,
          (error as any)?.response?.data
        );
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `${this.name} request failed: ${errorMessage}`,
        this.name,
        500,
        error
      );
    }
  }

  /**
   * Send streaming request - Full buffering approach to handle tool calls correctly
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    try {
      logger.trace(requestId, 'provider', `Sending streaming request to ${this.name}`, {
        model: request.model
      });

      // Transform to OpenAI format  
      const openaiRequest = { ...this.convertToOpenAI(request), stream: true };
      
      // Send streaming request - use empty path since baseURL includes full endpoint
      const response = await this.httpClient.post('', openaiRequest, {
        responseType: 'stream'
      });

      if (response.status < 200 || response.status >= 300) {
        throw new ProviderError(
          `${this.name} API returned status ${response.status}`,
          this.name,
          response.status
        );
      }

      // CRITICAL FIX: Full buffering approach for tool calls
      // Step 1: Collect ALL chunks first (like CodeWhisperer buffered approach)
      let fullResponseBuffer = '';
      
      logger.debug('Starting full response buffering for tool call safety', {
        provider: this.name
      }, requestId, 'provider');
      
      for await (const chunk of response.data) {
        fullResponseBuffer += chunk.toString();
      }
      
      logger.debug('Completed response buffering', {
        bufferLength: fullResponseBuffer.length,
        bufferPreview: fullResponseBuffer.slice(0, 200)
      }, requestId, 'provider');
      
      // Step 2: Parse complete response to extract all OpenAI streaming events
      const allOpenAIEvents: any[] = [];
      const lines = fullResponseBuffer.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            allOpenAIEvents.push(parsed);
          } catch (error) {
            logger.debug('Failed to parse OpenAI event', { line, error }, requestId, 'provider');
          }
        }
      }
      
      logger.debug('Parsed complete OpenAI events', {
        eventCount: allOpenAIEvents.length,
        hasToolCalls: allOpenAIEvents.some(e => e.choices?.[0]?.delta?.tool_calls)
      }, requestId, 'provider');
      
      // Step 3: Process all events through streaming transformer 
      const webStream = new ReadableStream({
        start(controller) {
          (async () => {
            try {
              for (const event of allOpenAIEvents) {
                const sseData = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(new TextEncoder().encode(sseData));
              }
              // Send [DONE] signal
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          })();
        }
      });

      // Use proper streaming transformer on the buffered and processed events
      const streamOptions: StreamTransformOptions = {
        sourceFormat: 'openai',
        targetFormat: 'anthropic', 
        model: request.model,
        requestId
      };

      // Use the transformation manager's streaming transformer
      const transformedStream = transformationManager.transformStream(webStream, streamOptions);
      
      let outputTokens = 0;
      for await (const transformedChunk of transformedStream) {
        // Defensive programming - comprehensive filtering like demo1
        if (
          transformedChunk === undefined ||
          transformedChunk === null ||
          transformedChunk === '' ||
          typeof transformedChunk !== 'string' ||
          transformedChunk.length === 0
        ) {
          // Skip invalid chunks silently (this is expected for some metadata chunks)
          continue;
        }
        
        // Additional validation for SSE format
        if (!transformedChunk.startsWith('event:') && !transformedChunk.startsWith('data:')) {
          // Not a valid SSE chunk format, skip it
          continue;
        }
        
        logger.debug(`[BUFFERED] Streaming chunk after full buffering`, { 
          chunk: transformedChunk.slice(0, 200),
          length: transformedChunk.length
        }, requestId, 'provider');
        
        // Parse SSE format and convert to {event, data} object format expected by server.ts
        const eventMatch = transformedChunk.match(/^event:\s*(.+)$/m);
        const dataMatch = transformedChunk.match(/^data:\s*(.+)$/m);
        
        if (eventMatch && dataMatch) {
          const event = eventMatch[1].trim();
          let data;
          
          try {
            data = JSON.parse(dataMatch[1].trim());
          } catch (error) {
            logger.debug('Failed to parse buffered SSE data as JSON', error, requestId, 'provider');
            continue;
          }
          
          // Yield in {event, data} format expected by server.ts
          yield { event, data };
          
          // Count output tokens for all content types
          if (event === 'content_block_delta') {
            if (data?.delta?.text) {
              outputTokens += Math.ceil(data.delta.text.length / 4);
            } else if (data?.delta?.partial_json) {
              outputTokens += Math.ceil(data.delta.partial_json.length / 4);
            }
          } else if (event === 'content_block_start' && data?.content_block?.name) {
            outputTokens += Math.ceil(data.content_block.name.length / 4);
          }
        }
      }

      logger.info('Buffered streaming request completed', {
        totalEvents: allOpenAIEvents.length,
        outputTokens
      }, requestId, 'provider');
      
    } catch (error) {
      logger.error(`${this.name} buffered streaming request failed`, error, requestId, 'provider');
      
      if (error instanceof ProviderError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `${this.name} streaming request failed: ${errorMessage}`,
        this.name,
        500,
        error
      );
    }
  }

  /**
   * Convert BaseRequest to OpenAI format using new transformer
   */
  private convertToOpenAI(request: BaseRequest): any {
    // Prepare Anthropic-style request
    const anthropicRequest = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: false,
      system: request.metadata?.system,
      tools: request.metadata?.tools
    };

    // Use the new transformer
    return transformAnthropicToOpenAI(anthropicRequest, request.metadata?.requestId);
  }

  /**
   * Convert OpenAI response to BaseResponse using new transformer
   */
  private convertFromOpenAI(response: any, originalRequest: BaseRequest): BaseResponse {
    // Transform using new transformer - ADD DEBUG HOOK
    logger.debug(`[HOOK] Raw OpenAI response before transform`, { 
      rawResponse: response,
      hasContent: !!(response.choices?.[0]?.message?.content),
      contentLength: response.choices?.[0]?.message?.content?.length || 0
    }, originalRequest.metadata?.requestId, 'provider');
    
    const anthropicResponse = transformOpenAIResponseToAnthropic(
      response, 
      originalRequest.metadata?.requestId
    );
    
    logger.debug(`[HOOK] Transformed to Anthropic response`, { 
      anthropicResponse,
      hasContent: !!(anthropicResponse?.content),
      contentArray: anthropicResponse?.content,
      contentLength: anthropicResponse?.content?.[0]?.text?.length || 0
    }, originalRequest.metadata?.requestId, 'provider');

    // 应用全面修复机制
    const fixedResponse = fixResponse({ 
      content: anthropicResponse.content || [{ type: 'text', text: '' }],
      usage: anthropicResponse.usage
    }, originalRequest.metadata?.requestId || 'unknown');
    
    if (fixedResponse.fixes_applied.length > 0) {
      logger.info('Applied response fixes to OpenAI response', {
        fixesApplied: fixedResponse.fixes_applied,
        originalBlocks: anthropicResponse.content?.length || 0,
        fixedBlocks: fixedResponse.content.length
      }, originalRequest.metadata?.requestId, 'provider');
    }

    // Convert to BaseResponse format
    return {
      id: anthropicResponse.id,
      model: originalRequest.model,
      role: 'assistant',
      content: fixedResponse.content,
      stop_reason: anthropicResponse.stop_reason, // 移除默认停止原因
      usage: {
        input_tokens: fixedResponse.usage?.input_tokens || anthropicResponse.usage?.input_tokens || 0,
        output_tokens: fixedResponse.usage?.output_tokens || anthropicResponse.usage?.output_tokens || 0
      }
    };
  }

  /**
   * Determine Anthropic event type from response
   */
  private determineEventType(response: any): string | null {
    if (!response.type) return null;
    
    switch (response.type) {
      case 'message_start':
        return 'message_start';
      case 'content_block_start':
        return 'content_block_start';
      case 'content_block_delta':
        return 'content_block_delta';
      case 'content_block_stop':
        return 'content_block_stop';
      case 'message_delta':
        return 'message_delta';
      case 'message_stop':
        return 'message_stop';
      case 'ping':
        return 'ping';
      default:
        return null;
    }
  }
}

/**
 * Factory function to create enhanced OpenAI client
 */
export function createEnhancedOpenAIClient(config: ProviderConfig, providerId: string): EnhancedOpenAIClient {
  return new EnhancedOpenAIClient(config, providerId);
}