/**
 * Generic OpenAI-Compatible Client
 * Works with any OpenAI-compatible API (Shuaihong, etc.)
 */

import axios, { AxiosInstance } from 'axios';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';

export class OpenAICompatibleClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai';
  
  private httpClient: AxiosInstance;
  private endpoint: string;
  private apiKey: string;

  constructor(public config: ProviderConfig, providerId: string) {
    this.name = providerId;
    this.endpoint = config.endpoint;
    const credentials = config.authentication.credentials;
    const apiKey = credentials.apiKey || credentials.api_key;
    this.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    
    if (!this.endpoint) {
      throw new Error(`OpenAI-compatible provider ${providerId} requires endpoint configuration`);
    }

    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: 0, // No timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router/2.0.0'
      }
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
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try to make a simple request to test connectivity
      const response = await this.httpClient.get('/models', { timeout: 0 });
      return response.status === 200;
    } catch (error) {
      logger.debug(`Health check failed for ${this.name}`, error);
      return false;
    }
  }

  /**
   * Send request to OpenAI-compatible API
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    try {
      logger.trace(requestId, 'provider', `Sending request to ${this.name}`, {
        model: request.model,
        stream: request.stream
      });

      // Convert to OpenAI format
      const openaiRequest = this.convertToOpenAI(request);
      
      // Send request
      const response = await this.httpClient.post('/v1/chat/completions', openaiRequest);
      
      if (response.status < 200 || response.status >= 300) {
        throw new ProviderError(
          `${this.name} API returned status ${response.status}`,
          this.name,
          response.status,
          response.data
        );
      }

      // Convert response back to BaseResponse format
      const baseResponse = this.convertFromOpenAI(response.data, request);

      logger.trace(requestId, 'provider', `Request completed successfully for ${this.name}`, {
        usage: baseResponse.usage
      });

      return baseResponse;
    } catch (error) {
      logger.error(`${this.name} request failed`, error, requestId, 'provider');
      
      if (error instanceof ProviderError) {
        throw error;
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
    
    try {
      logger.trace(requestId, 'provider', `Sending streaming request to ${this.name}`, {
        model: request.model
      });

      // Convert to OpenAI format with streaming
      const openaiRequest = { ...this.convertToOpenAI(request), stream: true };
      
      logger.debug('OpenAI streaming request model', {
        requestModel: openaiRequest.model,
        originalModel: request.model,
        targetModel: request.metadata?.targetModel
      }, requestId, 'provider');
      
      // Send streaming request
      const response = await this.httpClient.post('/v1/chat/completions', openaiRequest, {
        responseType: 'stream'
      });

      if (response.status < 200 || response.status >= 300) {
        throw new ProviderError(
          `${this.name} API returned status ${response.status}`,
          this.name,
          response.status
        );
      }

      // Parse streaming response
      let buffer = '';
      let lastFinishReason = 'end_turn'; // default
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              // Send completion event with stop reason before returning
              yield {
                event: 'stream_complete',
                data: {
                  stop_reason: lastFinishReason
                }
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              logger.trace(requestId, 'provider', `Raw streaming chunk`, { chunk: parsed });
              
              // Capture finish reason for final event
              const choice = parsed.choices?.[0];
              if (choice?.finish_reason) {
                lastFinishReason = this.mapFinishReason(choice.finish_reason);
              }
              
              const anthropicEvent = this.convertStreamChunkToAnthropic(parsed);
              if (anthropicEvent) {
                logger.trace(requestId, 'provider', `Yielding anthropic event`, { event: anthropicEvent });
                yield anthropicEvent;
              } else {
                logger.trace(requestId, 'provider', `No anthropic event generated for chunk`, { parsed });
              }
            } catch (parseError) {
              logger.debug('Failed to parse streaming chunk', parseError, requestId);
            }
          }
        }
      }
      
      // Send completion event if we didn't see [DONE]
      yield {
        event: 'stream_complete',
        data: {
          stop_reason: lastFinishReason
        }
      };

      logger.trace(requestId, 'provider', `Streaming request completed for ${this.name}`);
      
    } catch (error) {
      logger.error(`${this.name} streaming request failed`, error, requestId, 'provider');
      
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
   * Uses targetModel from routing if available for the actual API call
   */
  private convertToOpenAI(request: BaseRequest): any {
    // CRITICAL: Use targetModel from routing for the actual API call
    const modelToUse = request.metadata?.targetModel || request.model;
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('OpenAI request model determination', {
      originalModel: request.model,
      targetModel: request.metadata?.targetModel,
      finalModelForAPI: modelToUse,
      hasTargetModel: !!request.metadata?.targetModel,
      routingApplied: !!request.metadata?.targetModel
    }, requestId, 'provider');
    
    const openaiRequest: any = {
      model: modelToUse, // Use the target model from routing
      messages: this.convertMessages(request.messages),
      max_tokens: request.max_tokens || 131072, // 128K tokens default
      temperature: request.temperature,
      stream: false
    };

    // Add system message if present
    if (request.metadata?.system && Array.isArray(request.metadata.system)) {
      const systemContent = request.metadata.system.map((s: any) => s.text || s).join('\n');
      openaiRequest.messages.unshift({
        role: 'system',
        content: systemContent
      });
    }

    // Add tools if present
    if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
      openaiRequest.tools = request.metadata.tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));
    }

    return openaiRequest;
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
   * Returns the targetModel from routing to maintain consistency
   */
  private convertFromOpenAI(response: any, originalRequest: BaseRequest): BaseResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    // CRITICAL: Always return the targetModel from routing if available
    // This ensures the client sees the model that was intended by routing config
    const modelToReturn = originalRequest.metadata?.targetModel || originalRequest.model;
    const requestId = originalRequest.metadata?.requestId || 'unknown';
    
    logger.debug('OpenAI response model determination', {
      originalModel: originalRequest.model,
      targetModel: originalRequest.metadata?.targetModel,
      finalModelInResponse: modelToReturn,
      apiResponseModel: response.model,
      hasTargetModel: !!originalRequest.metadata?.targetModel,
      routingApplied: !!originalRequest.metadata?.targetModel
    }, requestId, 'provider');

    return {
      id: response.id,
      model: modelToReturn, // Use the target model from routing
      role: 'assistant',
      content: [{ type: 'text', text: choice.message.content }],
      stop_reason: this.mapFinishReason(choice.finish_reason),
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

    // Handle tool calls if present
    if (choice.delta?.tool_calls) {
      // Handle tool call streaming if needed
      // For now, we'll skip this and let the server handle it
    }

    return null;
  }

  /**
   * Map OpenAI finish reason to Anthropic stop reason
   */
  private mapFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'function_call': 'tool_use',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence'
    };

    const result = mapping[finishReason];
    if (!result) {
      throw new Error(`Unknown finish reason '${finishReason}' - no mapping found and fallback disabled. Available reasons: ${Object.keys(mapping).join(', ')}`);
    }
    return result;
  }
}