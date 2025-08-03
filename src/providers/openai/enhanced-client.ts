/**
 * Enhanced OpenAI-Compatible Client
 * Uses the new transformation system for better format handling
 */

import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { fixResponse } from '@/utils/response-fixer';
import { 
  transformationManager, 
  transformAnthropicToOpenAI, 
  transformOpenAIResponseToAnthropic,
  StreamTransformOptions
} from '@/transformers';
import { EnhancedOpenAIKeyManager } from './enhanced-api-key-manager';
import { captureRequest, captureResponse, captureError } from './data-capture';
import { fixLmStudioResponse } from '@/transformers/lmstudio-fixer';

export class EnhancedOpenAIClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai';
  
  protected httpClient: AxiosInstance;
  private endpoint: string;
  private apiKey: string;
  private keyManager?: EnhancedOpenAIKeyManager;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private readonly isLmStudio: boolean;
  constructor(public config: ProviderConfig, providerId: string) {
    this.name = providerId;
    this.endpoint = config.endpoint;
    
    // Handle API key configuration - support both single and multiple keys
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : undefined;
    
    if (Array.isArray(apiKey) && apiKey.length > 1) {
      // Multiple API keys - initialize the enhanced key manager
      this.keyManager = new EnhancedOpenAIKeyManager(apiKey, providerId);
      this.apiKey = ''; // Will be set dynamically per request
    } else {
      // Single API key - traditional approach (or no auth for local services)
      this.apiKey = Array.isArray(apiKey) ? apiKey[0] : (apiKey || '');
    }
    
    if (!this.endpoint) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires endpoint configuration`);
    }

    this.isLmStudio = this.endpoint.includes('localhost:1234') || this.endpoint.includes('lmstudio');
    
    // Check if authentication is required (type !== "none")
    if (config.authentication.type !== 'none' && !this.apiKey && !this.keyManager) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires API key configuration`);
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

    // Add request interceptor for authentication (fallback for single key)
    this.httpClient.interceptors.request.use((config) => {
      if (this.apiKey && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  /**
   * Get current API key for request
   */
  private getCurrentApiKey(requestId?: string): string {
    if (this.keyManager) {
      return this.keyManager.getNextAvailableKey(requestId);
    }
    return this.apiKey;
  }

  /**
   * Report success to rotation manager
   */
  private reportApiKeySuccess(apiKey: string, requestId?: string): void {
    if (this.keyManager) {
      this.keyManager.reportSuccess(apiKey, requestId);
    }
  }

  /**
   * Report error to rotation manager
   */
  private reportApiKeyError(apiKey: string, isRateLimit: boolean, requestId?: string): void {
    if (this.keyManager) {
      if (isRateLimit) {
        this.keyManager.report429Error(apiKey, requestId);
      } else {
        this.keyManager.reportGenericError(apiKey, requestId);
      }
    }
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
   * Execute request with retry logic and API key rotation
   */
  private async executeWithRetry<T>(
    requestFn: (apiKey: string) => Promise<T>,
    operation: string,
    requestId: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let currentApiKey: string;
      
      try {
        // Get a fresh available key for each attempt (critical for 429 rotation)
        currentApiKey = this.getCurrentApiKey(requestId);
      } catch (keyError) {
        // All keys are rate-limited or blacklisted
        logger.error(`No available keys for ${operation}`, keyError, requestId, 'provider');
        throw keyError;
      }

      try {
        const result = await requestFn(currentApiKey);
        this.reportApiKeySuccess(currentApiKey, requestId);
        return result;
      } catch (error) {
        lastError = error;
        const isRateLimited = (error as any)?.response?.status === 429;

        logger.warn(`${operation} failed on key`, {
            key: `***${currentApiKey.slice(-4)}`,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            isRateLimited,
            error: error instanceof Error ? error.message : String(error)
        }, requestId, 'provider');

        // Report error and trigger cooldown/blacklisting for this key
        this.reportApiKeyError(currentApiKey, isRateLimited, requestId);

        if (!this.isRetryableError(error)) {
          break; // Non-retryable error, break immediately
        }
        
        // For retryable errors, continue to next iteration which will get a fresh available key
        if (attempt < this.maxRetries - 1) {
          await this.waitForRetry(attempt, isRateLimited);
        }
      }
    }
    throw lastError; // Throw last error if all retries fail
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
      const openaiRequest = this.convertToOpenAI(request);
      captureRequest(this.name, request.model, openaiRequest, requestId);

      let response = await this.executeWithRetry(
        (apiKey) => {
          const headers: Record<string, string> = {};
          if (this.config.authentication.type !== 'none' && apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          return this.httpClient.post(this.endpoint, openaiRequest, { headers });
        },
        `${this.name} sendRequest`,
        requestId
      );

      if (this.isLmStudio) {
        response.data = fixLmStudioResponse(response.data, requestId);
      }

      const baseResponse = this.convertFromOpenAI(response.data, request);
      captureResponse(this.name, request.model, openaiRequest, response.data, requestId);

      logger.trace(requestId, 'provider', `Request completed successfully for ${this.name}`, {
        usage: baseResponse.usage
      });

      return baseResponse;
    } catch (error) {
      // Capture error data
      try {
        const openaiRequest = this.convertToOpenAI(request);
        captureError(this.name, request.model, openaiRequest, error, requestId);
      } catch (captureError) {
        logger.error('Failed to capture error data', captureError, requestId, 'provider');
      }
      
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
   * Send streaming request - Smart caching strategy: only cache tool parts, stream text transparently
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    let lastError: any;

    // Retry streaming requests with key rotation for initial connection failures
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let currentApiKey: string;
      
      try {
        // Get a fresh available key for each attempt
        currentApiKey = this.getCurrentApiKey(requestId);
      } catch (keyError) {
        // All keys are rate-limited or blacklisted
        logger.error(`No available keys for streaming request to ${this.name}`, keyError, requestId, 'provider');
        throw keyError;
      }

      try {
        logger.trace(requestId, 'provider', `Sending streaming request to ${this.name}`, {
          model: request.model,
          apiKey: `***${currentApiKey.slice(-4)}`,
          attempt: attempt + 1
        });

        const openaiRequest = { ...this.convertToOpenAI(request), stream: true };
        captureRequest(this.name, request.model, openaiRequest, requestId);

        const headers: Record<string, string> = {};
        if (this.config.authentication.type !== 'none' && currentApiKey) {
          headers['Authorization'] = `Bearer ${currentApiKey}`;
        }

        const response = await this.httpClient.post('', openaiRequest, {
          responseType: 'stream',
          headers
        });

        if (response.status < 200 || response.status >= 300) {
          // Report error to rotation manager
          const isRateLimit = response.status === 429;
          this.reportApiKeyError(currentApiKey, isRateLimit, requestId);
          
          const error = new ProviderError(
            `${this.name} API returned status ${response.status}`,
            this.name,
            response.status
          );
          
          if (!this.isRetryableError(error)) {
            throw error; // Non-retryable error
          }
          
          lastError = error;
          if (attempt < this.maxRetries - 1) {
            await this.waitForRetry(attempt, isRateLimit);
            continue; // Retry with next available key
          }
          throw error; // Last attempt failed
        }

        if (this.isLmStudio) {
            // LM Studio has a unique, non-standard streaming format
            // It sends tool calls as plain text, so we need a different processor
            yield* this.processLmStudioStream(response.data, request, requestId);
        } else {
            // Standard OpenAI-compatible streaming
            logger.debug('Starting smart caching strategy for OpenAI streaming', {
              provider: this.name,
              strategy: 'smart_cache_tools_only'
            }, requestId, 'provider');
            yield* this.processSmartCachedStream(response.data, request, requestId);
        }

        // Report success to rotation manager
        this.reportApiKeySuccess(currentApiKey, requestId);
        return; // Success - exit retry loop
        
      } catch (error) {
        lastError = error;
        const isRateLimited = (error as any)?.response?.status === 429;

        logger.warn(`${this.name} streaming request failed on key`, {
            key: `***${currentApiKey.slice(-4)}`,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            isRateLimited,
            error: error instanceof Error ? error.message : String(error)
        }, requestId, 'provider');

        // Report error to rotation manager
        this.reportApiKeyError(currentApiKey, isRateLimited, requestId);
        
        // Capture error data
        try {
          const openaiRequest = { ...this.convertToOpenAI(request), stream: true };
          captureError(this.name, request.model, openaiRequest, error, requestId);
        } catch (captureError) {
          logger.error('Failed to capture streaming error data', captureError, requestId, 'provider');
        }
        
        if (!this.isRetryableError(error)) {
          break; // Non-retryable error, break immediately
        }
        
        // For retryable errors, continue to next iteration which will get a fresh available key
        if (attempt < this.maxRetries - 1) {
          await this.waitForRetry(attempt, isRateLimited);
        }
      }
    }
    
    // All retries failed
    logger.error(`${this.name} streaming request failed after all retries`, lastError, requestId, 'provider');
    
    if (lastError instanceof ProviderError) {
      throw lastError;
    }
    
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ProviderError(
      `${this.name} streaming request failed: ${errorMessage}`,
      this.name,
      500,
      lastError
    );
  }

  /**
   * Smart caching strategy: Only cache tool calls, stream text transparently
   * This provides the best of both worlds - real-time text streaming and reliable tool parsing
   */
  private async *processSmartCachedStream(stream: any, request: BaseRequest, requestId: string): AsyncIterable<any> {
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
    let buffer = '';
    let messageId = `msg_${Date.now()}`;
    let hasStarted = false;
    let hasContentBlock = false;
    let toolCallBuffer: Map<number, { id?: string; name?: string; arguments: string }> = new Map();
    let isInToolCall = false;
    let outputTokens = 0;
    
    logger.debug('Starting smart cached stream processing', {
      strategy: 'cache_tools_stream_text'
    }, requestId, 'provider');

    try {
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

      // Process stream chunks
      let streamEnded = false;
      for await (const chunk of stream) {
        if (streamEnded) break;
        
        try {
          const decodedChunk = decoder.decode(chunk, { stream: true });
          buffer += decodedChunk;
          
          // 调试：记录接收到的数据块
          if (decodedChunk.length > 0) {
            logger.debug('Received chunk', {
              chunkLength: decodedChunk.length,
              bufferLength: buffer.length,
              chunkPreview: decodedChunk.slice(0, 100)
            }, requestId, 'provider');
          }
        } catch (decodeError) {
          logger.warn('Failed to decode chunk, skipping', {
            error: decodeError instanceof Error ? decodeError.message : String(decodeError),
            chunkLength: chunk.length
          }, requestId, 'provider');
          continue;
        }
        
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

              // Handle text content - STREAM TRANSPARENTLY
              if (choice.delta.content !== undefined) {
                if (!hasContentBlock && !isInToolCall) {
                  yield {
                    event: 'content_block_start',
                    data: {
                      type: 'content_block_start',
                      index: 0,
                      content_block: { type: 'text', text: '' }
                    }
                  };
                  hasContentBlock = true;
                }

                // Stream text content immediately - NO CACHING
                if (choice.delta.content && choice.delta.content.length > 0 && !isInToolCall) {
                  yield {
                    event: 'content_block_delta',
                    data: {
                      type: 'content_block_delta',
                      index: 0,
                      delta: { type: 'text_delta', text: choice.delta.content }
                    }
                  };
                  outputTokens += Math.ceil(choice.delta.content.length / 4);
                }
              }

              if (choice.delta.tool_calls) {
                // Close text content block if open
                if (hasContentBlock && !isInToolCall) {
                  yield {
                    event: 'content_block_stop',
                    data: { type: 'content_block_stop', index: 0 }
                  };
                }
                isInToolCall = true;

                for (const toolCall of choice.delta.tool_calls) {
                  const index = toolCall.index ?? 0;
                  
                  if (!toolCallBuffer.has(index)) {
                    toolCallBuffer.set(index, {
                      id: toolCall.id || `call_${Date.now()}_${index}`,
                      name: toolCall.function?.name || `tool_${index}`,
                      arguments: ''
                    });

                    // Start tool block immediately
                    const blockIndex = hasContentBlock ? index + 1 : index;
                    yield {
                      event: 'content_block_start',
                      data: {
                        type: 'content_block_start',
                        index: blockIndex,
                        content_block: {
                          type: 'tool_use',
                          id: toolCallBuffer.get(index)!.id,
                          name: toolCallBuffer.get(index)!.name,
                          input: {}
                        }
                      }
                    };
                  }

                  // Cache tool arguments for parsing
                  const toolData = toolCallBuffer.get(index)!;
                  if (toolCall.function?.arguments) {
                    toolData.arguments += toolCall.function.arguments;
                    
                    // Stream tool arguments as they come (partial JSON)
                    const blockIndex = hasContentBlock ? index + 1 : index;
                    yield {
                      event: 'content_block_delta',
                      data: {
                        type: 'content_block_delta',
                        index: blockIndex,
                        delta: {
                          type: 'input_json_delta',
                          partial_json: toolCall.function.arguments
                        }
                      }
                    };
                  }
                }
              }

              if (choice.finish_reason) {
                // Close text content block if open
                if (hasContentBlock && !isInToolCall) {
                  yield {
                    event: 'content_block_stop',
                    data: { type: 'content_block_stop', index: 0 }
                  };
                }

                // Close any open tool blocks
                const toolEntries = Array.from(toolCallBuffer.entries());
                for (const [index, toolData] of toolEntries) {
                  const blockIndex = hasContentBlock ? index + 1 : index;
                  yield {
                    event: 'content_block_stop',
                    data: { type: 'content_block_stop', index: blockIndex }
                  };
                }

                // 智能stop_reason处理：工具调用需要正确的stop_reason来触发继续
                const mappedStopReason = this.mapFinishReason(choice.finish_reason);
                const shouldIncludeStopReason = choice.finish_reason === 'tool_calls' || choice.finish_reason === 'function_call';
                
                if (shouldIncludeStopReason) {
                  // 工具调用完成 - 需要发送stop_reason以触发下一轮
                  yield {
                    event: 'message_delta',
                    data: {
                      type: 'message_delta',
                      delta: { 
                        stop_reason: mappedStopReason,
                        stop_sequence: null
                      },
                      usage: { output_tokens: outputTokens }
                    }
                  };
                  logger.info('Smart cached streaming completed with tool_use stop_reason for continuation', {
                    outputTokens,
                    toolCalls: toolCallBuffer.size,
                    strategy: 'cache_tools_stream_text',
                    finishReason: choice.finish_reason,
                    stopReason: mappedStopReason
                  }, requestId, 'provider');
                } else {
                  // 非工具调用 - 移除stop signals保持对话开放
                  yield {
                    event: 'message_delta',
                    data: {
                      type: 'message_delta',
                      delta: { 
                        // Empty delta - no stop signals to keep conversation alive
                      },
                      usage: { output_tokens: outputTokens }
                    }
                  };
                  logger.info('Smart cached streaming completed (no stop signals to keep conversation alive)', {
                    outputTokens,
                    toolCalls: toolCallBuffer.size,
                    strategy: 'cache_tools_stream_text',
                    finishReason: choice.finish_reason
                  }, requestId, 'provider');
                }

                // ALWAYS send message_stop to properly close the streaming session on the client side
                yield {
                  event: 'message_stop',
                  data: { type: 'message_stop' }
                };

                return;
              }

            } catch (error) {
              logger.debug('Failed to parse streaming chunk', error, requestId, 'provider');
            }
          }
        }
      }

      // 如果流正常结束但没有收到finish_reason，发送默认完成事件
      // 但移除所有stop reason给anthropic，保证停止的权力在模型这边
      if (!streamEnded) {
        // Close text content block if open
        if (hasContentBlock && !isInToolCall) {
          yield {
            event: 'content_block_stop',
            data: { type: 'content_block_stop', index: 0 }
          };
        }

        // Close any open tool blocks
        const toolEntries = Array.from(toolCallBuffer.entries());
        for (const [index, toolData] of toolEntries) {
          const blockIndex = hasContentBlock ? index + 1 : index;
          yield {
            event: 'content_block_stop',
            data: { type: 'content_block_stop', index: blockIndex }
          };
        }

        // 如果有工具调用但没有明确的finish_reason，推断为tool_use完成
        const hasToolCalls = toolCallBuffer.size > 0;
        
        if (hasToolCalls) {
          // 推断为工具调用完成 - 发送tool_use stop_reason
          yield {
            event: 'message_delta',
            data: {
              type: 'message_delta',
              delta: { 
                stop_reason: 'tool_use',
                stop_sequence: null
              },
              usage: { output_tokens: outputTokens }
            }
          };

          // 注意：不发送message_stop，让多轮对话可以继续
          // message_stop会终止整个对话会话，而tool_use应该暂停等待工具结果

          logger.info('Smart cached streaming completed with inferred tool_use stop_reason', {
            outputTokens,
            toolCalls: toolCallBuffer.size,
            strategy: 'cache_tools_stream_text',
            stopReason: 'tool_use'
          }, requestId, 'provider');
        } else {
          // 没有工具调用 - 移除stop signals保持对话开放  
          yield {
            event: 'message_delta',
            data: {
              type: 'message_delta',
              delta: { 
                // Empty delta - no stop signals to keep conversation alive
              },
              usage: { output_tokens: outputTokens }
            }
          };

          logger.info('Smart cached streaming completed without explicit finish_reason (no stop signals)', {
            outputTokens,
            toolCalls: toolCallBuffer.size,
            strategy: 'cache_tools_stream_text'
          }, requestId, 'provider');
        }
      }

    } catch (error) {
      logger.error('Smart cached stream processing failed', error, requestId, 'provider');
      throw error;
    }
  }

  /**
   * Map OpenAI finish reason to Anthropic stop reason
   */
  private mapFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'function_call': 'tool_use'
    };
    return mapping[finishReason] || 'end_turn';
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

    // Convert to BaseResponse format with proper stop_reason
    return {
      id: anthropicResponse.id,
      model: originalRequest.model,
      role: 'assistant',
      content: fixedResponse.content,
      stop_reason: anthropicResponse.stop_reason || 'end_turn',
      stop_sequence: anthropicResponse.stop_sequence || null,
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

  /**
   * Special real-time stream processor for LM Studio.
   * This handles the non-standard format where tool calls are embedded in the text stream.
   */
  private async *processLmStudioStream(stream: any, request: BaseRequest, requestId: string): AsyncIterable<any> {
    const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
    let buffer = '';
    let toolCallBuffer = '';
    let state: 'text' | 'tool' = 'text';
    let contentIndex = 0;
    let textBlockStarted = false;

    // Initial stream events
    yield { event: 'message_start', data: { type: 'message_start', message: { id: `msg_${Date.now()}`, type: 'message', role: 'assistant', content: [], model: request.model, stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } } } };
    yield { event: 'ping', data: { type: 'ping' } };

    let streamDone = false;
    for await (const chunk of stream) {
        if (streamDone) break;
        buffer += decoder.decode(chunk, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
             if (streamDone) break;
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
                streamDone = true;
                break;
            }

            try {
                const parsed = JSON.parse(data);
                let content = parsed.choices?.[0]?.delta?.content || '';

                while (content) {
                    if (state === 'text') {
                        const toolCallStart = content.indexOf('<tool_call>');
                        if (toolCallStart !== -1) {
                            const textPart = content.substring(0, toolCallStart);
                            if (textPart) {
                                if (!textBlockStarted) {
                                    yield { event: 'content_block_start', data: { type: 'content_block_start', index: contentIndex, content_block: { type: 'text', text: '' } } };
                                    textBlockStarted = true;
                                }
                                yield { event: 'content_block_delta', data: { type: 'content_block_delta', index: contentIndex, delta: { type: 'text_delta', text: textPart } } };
                            }
                            if (textBlockStarted) {
                                yield { event: 'content_block_stop', data: { type: 'content_block_stop', index: contentIndex } };
                                contentIndex++;
                                textBlockStarted = false;
                            }
                            state = 'tool';
                            content = content.substring(toolCallStart + '<tool_call>'.length);
                        } else {
                            if (!textBlockStarted) {
                                yield { event: 'content_block_start', data: { type: 'content_block_start', index: contentIndex, content_block: { type: 'text', text: '' } } };
                                textBlockStarted = true;
                            }
                            yield { event: 'content_block_delta', data: { type: 'content_block_delta', index: contentIndex, delta: { type: 'text_delta', text: content } } };
                            content = '';
                        }
                    } else if (state === 'tool') {
                        const toolCallEnd = content.indexOf('</tool_call>');
                        if (toolCallEnd !== -1) {
                            toolCallBuffer += content.substring(0, toolCallEnd);
                            try {
                                const toolCallJson = JSON.parse(toolCallBuffer.trim());
                                const toolCallId = `call_${Date.now()}`;
                                yield { event: 'content_block_start', data: { type: 'content_block_start', index: contentIndex, content_block: { type: 'tool_use', id: toolCallId, name: toolCallJson.name, input: toolCallJson.arguments } } };
                                yield { event: 'content_block_stop', data: { type: 'content_block_stop', index: contentIndex } };
                                contentIndex++;
                            } catch (error) {
                                logger.error('Failed to parse tool call JSON from LM Studio stream', { toolCallBuffer, error }, requestId, 'provider');
                            }
                            toolCallBuffer = '';
                            state = 'text';
                            content = content.substring(toolCallEnd + '</tool_call>'.length);
                        } else {
                            toolCallBuffer += content;
                            content = '';
                        }
                    }
                }
            } catch (error) {
                // Ignore JSON parsing errors for individual chunks
            }
        }
    }

    if (textBlockStarted) {
        yield { event: 'content_block_stop', data: { type: 'content_block_stop', index: contentIndex } };
    }

    const hasToolCalls = state === 'text' && contentIndex > 0 && !textBlockStarted;
    yield { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: hasToolCalls ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 1 } } }; // Token count is an approximation
    yield { event: 'message_stop', data: { type: 'message_stop' } };
  }
}

/**
 * Factory function to create enhanced OpenAI client
 */
export function createEnhancedOpenAIClient(config: ProviderConfig, providerId: string): EnhancedOpenAIClient {
  return new EnhancedOpenAIClient(config, providerId);
}