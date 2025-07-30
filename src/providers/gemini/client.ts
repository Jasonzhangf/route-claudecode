/**
 * Gemini API Client
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, ProviderConfig, ProviderError } from '../../types';
import { logger } from '../../utils/logger';
import { processGeminiResponse } from './universal-gemini-parser';
import { ApiKeyRotationManager } from '../openai/api-key-rotation';

export class GeminiClient {
  public readonly name: string;
  public readonly type = 'gemini';
  
  private apiKey: string;
  private baseUrl: string;
  private apiKeyRotationManager?: ApiKeyRotationManager;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private config: ProviderConfig, providerId?: string) {
    this.name = providerId || 'gemini-client';
    
    // Handle API key configuration - support both single and multiple keys
    const credentials = config.authentication.credentials;
    const apiKey = credentials.apiKey || credentials.api_key;
    
    if (Array.isArray(apiKey) && apiKey.length > 1) {
      // Multiple API keys - initialize rotation manager
      this.apiKeyRotationManager = new ApiKeyRotationManager(
        apiKey,
        this.name,
        config.keyRotation || { strategy: 'round_robin' }
      );
      this.apiKey = ''; // Will be set dynamically per request
      
      logger.info('Initialized Gemini API key rotation', {
        providerId: this.name,
        keyCount: apiKey.length,
        strategy: config.keyRotation?.strategy || 'round_robin'
      });
    } else {
      // Single API key - traditional approach
      this.apiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
      
      if (!this.apiKey) {
        throw new Error('Gemini API key is required');
      }
    }

    this.baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com';
    logger.info('Gemini client initialized', {
      endpoint: this.baseUrl,
      hasApiKey: !!this.apiKey || !!this.apiKeyRotationManager,
      keyRotationEnabled: !!this.apiKeyRotationManager
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Get current API key for health check
      const apiKey = this.getCurrentApiKey('health-check');
      
      // Check if we can list models (lightweight health check)
      const response = await fetch(`${this.baseUrl}/v1/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const success = response.ok;
      
      if (success) {
        this.reportApiKeySuccess(apiKey, 'health-check');
      } else {
        const isRateLimit = response.status === 429;
        this.reportApiKeyError(apiKey, isRateLimit, 'health-check');
      }
      
      return success;
    } catch (error) {
      logger.error('Gemini health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async createCompletion(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';
    const geminiRequest = this.convertToGeminiFormat(request);
    const modelName = this.extractModelName(request.model);
    
    logger.debug('Sending request to Gemini API', {
      model: modelName,
      messageCount: geminiRequest.contents?.length || 0,
      hasTools: !!geminiRequest.tools,
      maxTokens: geminiRequest.generationConfig?.maxOutputTokens
    });

    // Execute with retry logic and API key rotation
    const response = await this.executeWithRetry(
      async (apiKey: string) => {
        const url = `${this.baseUrl}/v1/models/${modelName}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiRequest)
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          const error = new Error(`Gemini API error (${resp.status}): ${errorText}`) as any;
          error.status = resp.status;
          throw error;
        }

        return resp;
      },
      `${this.name} createCompletion`,
      requestId
    );

    const geminiResponse = await response.json();
    return this.convertFromGeminiFormat(geminiResponse, request);
  }

  async* streamCompletion(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    let currentApiKey: string;
    
    try {
      const geminiRequest = {
        ...this.convertToGeminiFormat(request)
      };
      const modelName = this.extractModelName(request.model);

      logger.info('Starting optimized Gemini streaming request', {
        model: modelName,
        messageCount: geminiRequest.contents?.length || 0,
        strategy: 'universal-auto-detect'
      });

      // Get current API key
      currentApiKey = this.getCurrentApiKey(requestId);
      
      const url = `${this.baseUrl}/v1/models/${modelName}:streamGenerateContent?key=${currentApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Report error to rotation manager
        const isRateLimit = response.status === 429;
        this.reportApiKeyError(currentApiKey, isRateLimit, requestId);
        
        const error = new Error(`Gemini streaming API error (${response.status}): ${errorText}`) as any;
        error.status = response.status;
        throw error;
      }

    if (!response.body) {
      throw new Error('No response body for streaming request');
    }

    // 🚀 使用完全缓冲策略 + 优化解析器
    logger.info('Collecting full Gemini response for optimization', {
      responseStatus: response.status
    }, requestId, 'gemini-provider');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponseContent = '';

    try {
      // 收集完整响应，同时发送心跳保持连接
      let lastHeartbeat = Date.now();
      const heartbeatInterval = 30000; // 30秒发送一次心跳
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponseContent += decoder.decode(value, { stream: true });
        
        // 发送心跳以保持连接活跃
        const now = Date.now();
        if (now - lastHeartbeat > heartbeatInterval) {
          logger.debug('Sending heartbeat to keep connection alive', {
            requestId,
            elapsed: now - lastHeartbeat
          }, requestId, 'gemini-provider');
          
          // 发送心跳事件
          yield {
            type: 'ping',
            timestamp: now
          };
          
          lastHeartbeat = now;
        }
      }

      logger.info('Gemini response collection completed', {
        responseLength: fullResponseContent.length,
        responsePreview: fullResponseContent.slice(0, 200)
      }, requestId, 'gemini-provider');

      // 🚀 使用通用优化解析器处理
      const optimizedEvents = await processGeminiResponse(
        fullResponseContent, 
        requestId, 
        { modelName, originalRequest: request }
      );

      logger.info('Gemini optimization completed', {
        eventCount: optimizedEvents.length,
        processingStrategy: 'universal-optimized'
      }, requestId, 'gemini-provider');

      // 转换并输出优化后的事件
      for (const event of optimizedEvents) {
        yield this.convertStreamEvent(event);
      }
      
      // Report success to rotation manager
      this.reportApiKeySuccess(currentApiKey!, requestId);

    } finally {
      reader.releaseLock();
    }
    
    } catch (error) {
      logger.error(`${this.name} streaming request failed`, error, requestId, 'gemini-provider');
      
      // Report error to rotation manager if we have a current API key
      if (currentApiKey!) {
        const isRateLimit = (error as any)?.status === 429;
        this.reportApiKeyError(currentApiKey!, isRateLimit, requestId);
      }
      
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

  private extractModelName(model: string): string {
    // Convert common model names to Gemini format
    const modelMappings: Record<string, string> = {
      'gemini-pro': 'gemini-1.5-pro',
      'gemini-flash': 'gemini-1.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash': 'gemini-2.5-flash'
    };

    return modelMappings[model] || model;
  }

  private convertToGeminiFormat(request: BaseRequest): any {
    const geminiRequest: any = {
      contents: this.convertMessages(request.messages),
      generationConfig: {
        maxOutputTokens: request.max_tokens || 4096
      }
    };

    // Add temperature if specified
    if (request.temperature !== undefined) {
      geminiRequest.generationConfig.temperature = request.temperature;
    }

    // Handle tools if present
    const typedRequest = request as any;
    if (typedRequest.tools) {
      geminiRequest.tools = this.convertTools(typedRequest.tools);
    }

    return geminiRequest;
  }

  private convertMessages(messages: Array<{ role: string; content: any }>): any[] {
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are treated as user messages in Gemini
        contents.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: message.content }]
        });
      }
    }

    return contents;
  }

  private convertTools(tools: any[]): any[] {
    // Convert Anthropic/OpenAI tools to Gemini function declarations
    return tools.map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || tool.function?.parameters
      }]
    }));
  }

  private convertFromGeminiFormat(geminiResponse: any, originalRequest: BaseRequest): BaseResponse {
    const candidate = geminiResponse.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    // Extract usage information
    const usageMetadata = geminiResponse.usageMetadata || {};
    
    return {
      id: `gemini_${Date.now()}`,
      type: 'message',
      model: originalRequest.model,
      role: 'assistant',
      content: [{ type: 'text', text: content }],
      stop_reason: this.mapFinishReason(candidate?.finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: usageMetadata.promptTokenCount || 0,
        output_tokens: usageMetadata.candidatesTokenCount || 0
      }
    };
  }

  private mapFinishReason(finishReason?: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn'
    };

    return reasonMap[finishReason || 'OTHER'] || 'end_turn';
  }

  /**
   * Get current API key for request
   */
  private getCurrentApiKey(requestId?: string): string {
    if (this.apiKeyRotationManager) {
      return this.apiKeyRotationManager.getNextApiKey(requestId);
    }
    return this.apiKey;
  }

  /**
   * Report success to rotation manager
   */
  private reportApiKeySuccess(apiKey: string, requestId?: string): void {
    if (this.apiKeyRotationManager) {
      this.apiKeyRotationManager.reportSuccess(apiKey, requestId);
    }
  }

  /**
   * Report error to rotation manager
   */
  private reportApiKeyError(apiKey: string, isRateLimit: boolean, requestId?: string): void {
    if (this.apiKeyRotationManager) {
      this.apiKeyRotationManager.reportError(apiKey, isRateLimit, requestId);
    }
  }

  /**
   * Check if error is retryable (429, 502, 503, 504)
   */
  private isRetryableError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    if (status) {
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
    let currentApiKey: string;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Get current API key for this attempt
        currentApiKey = this.getCurrentApiKey(requestId);
        
        const result = await requestFn(currentApiKey);
        
        // Report success to rotation manager
        this.reportApiKeySuccess(currentApiKey, requestId);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Report error to rotation manager
        const isRateLimited = (error as any)?.status === 429 || 
                             (error as any)?.response?.status === 429;
        this.reportApiKeyError(currentApiKey!, isRateLimited, requestId);
        
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          break;
        }
        
        const delayInfo = isRateLimited ? 
          (attempt === 0 ? '1s' : attempt === 1 ? '5s' : '60s') : 
          `${this.retryDelay * Math.pow(2, attempt)}ms`;
        
        logger.warn(`${operation} failed, will retry`, {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error instanceof Error ? error.message : String(error),
          status: (error as any)?.status || (error as any)?.response?.status,
          nextRetryDelay: delayInfo,
          isRateLimited,
          currentApiKey: currentApiKey! ? `***${currentApiKey!.slice(-4)}` : 'none'
        }, requestId, 'gemini-provider');
        
        await this.waitForRetry(attempt, isRateLimited);
      }
    }
    
    // Ensure proper error handling after retry exhaustion
    if ((lastError as any)?.status === 429 || (lastError as any)?.response?.status === 429) {
      throw new ProviderError(
        `${this.name} rate limit exceeded after ${this.maxRetries} retries`,
        this.name,
        429,
        lastError
      );
    }
    
    throw lastError;
  }

  private convertStreamEvent(event: any): any {
    // Convert Gemini streaming events to our standard format
    const candidate = event.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    return {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: part?.text || ''
      },
      content_block: candidate?.content,
      usage: event.usageMetadata ? {
        input_tokens: event.usageMetadata.promptTokenCount || 0,
        output_tokens: event.usageMetadata.candidatesTokenCount || 0
      } : undefined
    };
  }
  
  /**
   * Get API key rotation statistics
   */
  getRotationStats(): any {
    if (this.apiKeyRotationManager) {
      return this.apiKeyRotationManager.getStats();
    }
    return {
      providerId: this.name,
      totalKeys: 1,
      activeKeys: 1,
      rotationEnabled: false
    };
  }
}