/**
 * Gemini API Client - Minimal Working Version
 * Google Gemini API integration via Generative Language API
 * Project owner: Jason Zhang
 * 
 * Architecture: Follows four-layer design pattern with modular components
 * - Zero hardcoding, zero fallback principles
 * - Focus on basic text functionality first
 */

import { BaseRequest, BaseResponse, ProviderConfig, ProviderError } from '../../types';
import { logger } from '../../utils/logger';
import { EnhancedRateLimitManager } from './enhanced-rate-limit-manager';
import { GoogleGenAI } from '@google/genai';
import { GeminiRequestConverter } from './modules/request-converter';
import { GeminiResponseConverter } from './modules/response-converter';
import { createPatchManager } from '../../patches/registry';

export class GeminiClient {
  public readonly name: string;
  public readonly type = 'gemini';
  
  private apiKey: string;
  private baseUrl: string;
  private enhancedRateLimitManager?: EnhancedRateLimitManager;
  private apiKeys: string[] = [];
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private readonly requestTimeout = 60000;
  private genAIClients: GoogleGenAI[] = [];
  private patchManager = createPatchManager();

  constructor(private config: ProviderConfig, providerId?: string) {
    this.name = providerId || 'gemini-client';
    
    // Handle API key configuration - support both single and multiple keys
    const credentials = config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : undefined;
    
    if (Array.isArray(apiKey) && apiKey.length > 1) {
      this.apiKeys = apiKey;
      this.enhancedRateLimitManager = new EnhancedRateLimitManager(apiKey, this.name);
      this.apiKey = '';
      this.genAIClients = apiKey.map(key => new GoogleGenAI({ apiKey: key }));
      
      logger.info('Initialized Enhanced Gemini Rate Limit Manager', {
        providerId: this.name,
        keyCount: apiKey.length
      });
    } else {
      this.apiKey = Array.isArray(apiKey) ? apiKey[0] : (apiKey || '');
      this.apiKeys = [this.apiKey];
      
      if (!this.apiKey) {
        throw new Error('Gemini API key is required');
      }
      
      this.genAIClients = [new GoogleGenAI({ apiKey: this.apiKey })];
    }

    this.baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com';
    
    logger.info('Gemini client initialized with minimal architecture', {
      endpoint: this.baseUrl,
      hasApiKey: !!this.apiKey || !!this.enhancedRateLimitManager,
      keyRotationEnabled: !!this.enhancedRateLimitManager
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const genAI = this.genAIClients[0];
      
      if (!genAI) {
        logger.error('No GenAI client available for health check');
        return false;
      }
      
      const testResponse = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'Hi' }]
        }]
      });
      
      const success = !!(testResponse && testResponse.candidates && testResponse.candidates.length > 0);
      
      if (success) {
        logger.debug('Gemini health check succeeded');
      } else {
        logger.warn('Gemini health check returned no response');
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
    
    logger.info('Processing non-streaming Gemini request', {
      model: request.model,
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    }, requestId, 'gemini-provider');

    let modelName = request.model;
    
    // Execute with retry logic
    const geminiResponse = await this.executeWithRetry(
      async (genAI: GoogleGenAI, model: string) => {
        // Convert request using modular converter
        const geminiRequest = GeminiRequestConverter.convertToGeminiFormat(request);
        
        // Use timeout wrapper
        // Create properly structured API request
        const apiRequest = {
          ...geminiRequest,
          model: model
        };
        
        return Promise.race([
          genAI.models.generateContent(apiRequest),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Gemini SDK timeout after ${this.requestTimeout}ms`)), this.requestTimeout)
          )
        ]) as Promise<any>;
      },
      modelName,
      'createCompletion',
      requestId
    );
    
    // Convert response using modular converter
    const finalResponse = GeminiResponseConverter.convertToAnthropicFormat(
      geminiResponse, 
      request.model, 
      requestId
    );
    
    logger.info('Non-streaming Gemini request completed successfully', {
      originalModel: request.model,
      finalModel: finalResponse.model,
      contentBlocks: finalResponse.content?.length || 0,
      stopReason: finalResponse.stop_reason
    }, requestId, 'gemini-provider');
    
    return finalResponse;
  }

  async* streamCompletion(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.info('Starting Gemini streaming', {
      model: request.model,
      messageCount: request.messages?.length || 0
    }, requestId, 'gemini-provider');

    // For now, use non-streaming and simulate streaming
    // This ensures basic functionality works first
    const response = await this.createCompletion(request);
    
    // Convert to streaming format
    const messageId = response.id || `msg_${Date.now()}`;
    
    // Send message_start
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

    // Send ping
    yield {
      event: 'ping',
      data: { type: 'ping' }
    };

    // Process each content block
    for (let i = 0; i < response.content.length; i++) {
      const block = response.content[i];
      
      // Send content_block_start
      yield {
        event: 'content_block_start',
        data: {
          type: 'content_block_start',
          index: i,
          content_block: block
        }
      };

      if (block.type === 'text' && block.text) {
        // Simulate streaming text with chunks
        const chunkSize = 10;
        for (let j = 0; j < block.text.length; j += chunkSize) {
          const chunk = block.text.slice(j, j + chunkSize);
          yield {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: i,
              delta: {
                type: 'text_delta',
                text: chunk
              }
            }
          };
          
          // Small delay for realistic streaming
          if (j > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }

      // Send content_block_stop
      yield {
        event: 'content_block_stop',
        data: {
          type: 'content_block_stop',
          index: i
        }
      };
    }

    // Send message_delta with usage
    yield {
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: {},
        usage: {
          output_tokens: response.usage?.output_tokens || 0
        }
      }
    };

    // Send message_stop
    yield {
      event: 'message_stop',
      data: {
        type: 'message_stop',
        stop_reason: response.stop_reason,
        stop_sequence: null
      }
    };
    
    logger.info('Gemini streaming completed', {
      contentBlocks: response.content.length
    }, requestId, 'gemini-provider');
  }

  /**
   * Execute request with retry logic and API key rotation
   */
  private async executeWithRetry<T>(
    requestFn: (genAI: GoogleGenAI, model: string) => Promise<T>,
    modelName: string,
    operation: string,
    requestId: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let genAIClient: GoogleGenAI;
      let keyIndex = 0;
      let currentModel = modelName;
      
      try {
        if (this.enhancedRateLimitManager) {
          const keyAndModel = this.enhancedRateLimitManager.getAvailableKeyAndModel(modelName, requestId);
          genAIClient = this.genAIClients[keyAndModel.keyIndex];
          keyIndex = keyAndModel.keyIndex;
          currentModel = keyAndModel.model;
        } else {
          keyIndex = attempt % this.genAIClients.length;
          genAIClient = this.genAIClients[keyIndex];
        }
      } catch (keyError) {
        logger.error(`No available keys for ${operation}`, keyError, requestId, 'gemini-provider');
        throw keyError;
      }

      try {
        const result = await requestFn(genAIClient, currentModel);
        
        logger.debug(`${operation} succeeded`, {
          keyIndex,
          model: currentModel,
          attempt: attempt + 1
        }, requestId, 'gemini-provider');
        
        return result;
      } catch (error) {
        lastError = error;
        const isRateLimited = (error as any)?.message?.includes('quota') || 
                             (error as any)?.message?.includes('rate') ||
                             (error as any)?.status === 429;

        logger.warn(`${operation} failed`, {
            keyIndex,
            model: currentModel,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            isRateLimited,
            error: error instanceof Error ? error.message : String(error)
        }, requestId, 'gemini-provider');

        // Report error to rate limit manager
        if (this.enhancedRateLimitManager && isRateLimited) {
          this.enhancedRateLimitManager.report429Error(keyIndex, currentModel, requestId);
        }

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
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    const message = error?.message || '';
    
    // HTTP status code based retries
    if (status) {
      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(status)) {
        return true;
      }
    }
    
    // Gemini specific error patterns
    const retryablePatterns = [
      'quota',
      'rate',
      'RESOURCE_EXHAUSTED',
      'Too Many Requests',
      'temporarily unavailable',
      'service unavailable'
    ];
    
    return retryablePatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Wait for retry delay
   */
  private async waitForRetry(attempt: number, isRateLimited: boolean = false): Promise<void> {
    let delay: number;
    
    if (isRateLimited) {
      if (attempt === 0) delay = 1000;      // 1st retry: 1s
      else if (attempt === 1) delay = 5000;  // 2nd retry: 5s  
      else delay = 60000;                    // 3rd retry: 60s
    } else {
      delay = this.retryDelay * Math.pow(2, attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get API key rotation statistics
   */
  getRotationStats(): any {
    if (this.enhancedRateLimitManager) {
      return this.enhancedRateLimitManager.getStatus();
    }
    return {
      providerId: this.name,
      totalKeys: 1,
      activeKeys: 1,
      rotationEnabled: false
    };
  }
}