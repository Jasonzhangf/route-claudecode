/**
 * 简化的OpenAI-Compatible Client
 * 移除多余的日志和复杂的判断逻辑
 */

import axios, { AxiosInstance } from 'axios';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { mapFinishReason } from '@/utils/finish-reason-handler';
import { logger } from '@/utils/logger';

export class OpenAICompatibleClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai';
  
  protected httpClient: AxiosInstance;
  private endpoint: string;
  private apiKey: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(public config: ProviderConfig, providerId: string) {
    this.name = providerId;
    this.endpoint = config.endpoint;
    
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';
    this.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    
    if (!this.endpoint) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires endpoint configuration`);
    }

    if (config.authentication.type !== 'none' && !this.apiKey) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires API key configuration`);
    }

    // 使用endpoint作为完整URL包括路径
    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 300000, // 5 minute timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router/2.0.0',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Check if provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    return !!(this.endpoint && this.apiKey);
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

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        const isRateLimited = (error as any)?.response?.status === 429;

        if (!this.isRetryableError(error)) {
          break;
        }
        
        if (attempt < this.maxRetries - 1) {
          await this.waitForRetry(attempt, isRateLimited);
        }
      }
    }
    throw lastError;
  }

  /**
   * Wait for retry delay
   */
  private async waitForRetry(attempt: number, isRateLimited: boolean = false): Promise<void> {
    let delay: number;
    
    if (isRateLimited) {
      if (attempt === 0) delay = 1000;
      else if (attempt === 1) delay = 5000;
      else delay = 60000;
    } else {
      delay = this.retryDelay * Math.pow(2, attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || status === 502 || status === 503 || status === 504;
    }
    return false;
  }

  /**
   * Send request to OpenAI-compatible API
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      const openaiRequest = this.convertToOpenAI(request);

      const response = await this.executeWithRetry(
        () => this.httpClient.post(this.endpoint, openaiRequest),
        `${this.name} sendRequest`,
        requestId
      );

      return this.convertFromOpenAI(response.data, request);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
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
   * Send streaming request
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    let lastFinishReason = 'end_turn';

    try {
      const openaiRequest = { ...this.convertToOpenAI(request), stream: true };

      const response = await this.executeWithRetry(
        () => this.httpClient.post('', openaiRequest, {
          responseType: 'stream',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }),
        `${this.name} sendStreamRequest`,
        requestId
      );

      if (response.status < 200 || response.status >= 300) {
        throw new ProviderError(
          `${this.name} API returned status ${response.status}`,
          this.name,
          response.status
        );
      }

      const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
      let buffer = '';
      let messageId = `msg_${Date.now()}`;
      let hasStarted = false;
      let hasContentBlock = false;

      // Send initial events
      if (!hasStarted) {
        yield {
          event: 'message_start',
          data: {
            type: 'message_start',
            message: {
              id: messageId,
              type: 'message',
              role: 'assistant',
              content: [],
              model: request.model,
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 }
            }
          }
        };

        yield {
          event: 'ping',
          data: { type: 'ping' }
        };
        hasStarted = true;
      }

      let streamEnded = false;
      for await (const chunk of response.data) {
        if (streamEnded) break;
        
        try {
          const decodedChunk = decoder.decode(chunk, { stream: true });
          buffer += decodedChunk;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                streamEnded = true;
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                if (!choice?.delta) continue;

                // Capture finish reason for final event
                const finishReason = choice.finish_reason;
                if (finishReason) {
                  lastFinishReason = mapFinishReason(finishReason);
                }
                
                const anthropicEvent = this.convertStreamChunkToAnthropic(parsed);
                if (anthropicEvent) {
                  yield anthropicEvent;
                }

              } catch (error) {
                // Ignore parsing errors
              }
            }
          }
        } catch (decodeError) {
          // Ignore decode errors
        }
      }

      // Send completion events
      if (hasContentBlock) {
        yield {
          event: 'content_block_stop',
          data: { type: 'content_block_stop', index: 0 }
        };
      }

      yield {
        event: 'stream_complete',
        data: {
          type: 'stream_complete',
          finish_reason: lastFinishReason
        }
      };

    } catch (error) {
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
   * Convert BaseRequest to OpenAI format
   */
  private convertToOpenAI(request: BaseRequest): any {
    const anthropicRequest = {
      model: request.model,
      messages: this.convertMessages(request.messages),
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: false
    };

    // Add system message if present
    if (request.metadata?.system) {
      const systemContent = Array.isArray(request.metadata.system) 
        ? request.metadata.system.map((s: any) => s.text || s).join('\n')
        : request.metadata.system;
      anthropicRequest.messages.unshift({
        role: 'system',
        content: systemContent
      });
    }

    // Add tools if present
    if (request.metadata?.tools) {
      const tools = Array.isArray(request.metadata.tools) ? request.metadata.tools : [request.metadata.tools];
      (anthropicRequest as any).tools = tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));
    }

    return anthropicRequest;
  }

  /**
   * Convert messages to OpenAI format
   */
  private convertMessages(messages: Array<{ role: string; content: any }>): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: this.convertContent(msg.content)
    }));
  }

  /**
   * Convert content to OpenAI format
   */
  private convertContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text') {
          return block.text;
        } else if (block.type === 'tool_result') {
          return typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        }
        return JSON.stringify(block);
      }).join('\n');
    }

    return JSON.stringify(content);
  }

  /**
   * Convert OpenAI response to BaseResponse
   */
  private convertFromOpenAI(response: any, originalRequest: BaseRequest): BaseResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    return {
      id: response.id,
      model: originalRequest.model,
      role: 'assistant',
      content: [{ type: 'text', text: choice.message.content }],
      stop_reason: mapFinishReason(choice.finish_reason),
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Convert OpenAI streaming chunk to Anthropic format
   */
  private convertStreamChunkToAnthropic(chunk: any): any {
    const choice = chunk.choices?.[0];
    if (!choice) return null;

    // Handle content deltas
    if (choice.delta?.content) {
      return {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: choice.delta.content
          }
        }
      };
    }

    return null;
  }
}