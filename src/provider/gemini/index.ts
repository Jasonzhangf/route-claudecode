/**
 * Gemini Provider
 * Integration with Google's Gemini API via OpenAI-compatible interface
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, Provider, ProviderConfig } from '../../types';
import { logger } from '../../utils/logger';
import { GeminiClient } from './client';

export class GeminiProvider implements Provider {
  public readonly name: string;
  public readonly type = 'gemini';
  private client: GeminiClient;

  constructor(public readonly config: ProviderConfig, providerId?: string) {
    this.name = providerId || 'gemini';
    if (config.type !== 'gemini') {
      throw new Error(`Invalid provider type: ${config.type}, expected 'gemini'`);
    }
    
    this.client = new GeminiClient(config, this.name);
    logger.info(`Initialized Gemini provider: ${config.endpoint}`, {
      provider: this.name,
      endpoint: config.endpoint
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      logger.error('Gemini provider health check failed', {
        provider: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    try {
      logger.trace(request.metadata?.requestId || 'unknown', 'provider', 'Sending request to Gemini', {
        provider: this.name,
        model: request.model,
        endpoint: this.config.endpoint
      });

      const response = await this.client.createCompletion(request);
      
      logger.debug('Received response from Gemini', {
        provider: this.name,
        model: response.model,
        requestId: request.metadata?.requestId,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      });

      return response;
    } catch (error) {
      const isRateLimited = (error as any)?.status === 429 || 
                           (error as any)?.message?.includes('429') ||
                           (error as any)?.message?.includes('RESOURCE_EXHAUSTED') ||
                           (error as any)?.message?.includes('quota');
      
      // 获取当前使用的key信息（如果可用）
      const currentKeyInfo = this.client?.getRotationStats?.() || {};
      
      // 强制控制台输出429错误，包含详细的key信息
      if (isRateLimited) {
        console.error(`🚨 [429 RATE LIMIT] Gemini API quota exhausted:`);
        console.error(`   Provider: ${this.name}`);
        console.error(`   Model: ${request.model}`);
        console.error(`   Request ID: ${request.metadata?.requestId}`);
        console.error(`   Current Key: ${currentKeyInfo.keyIndex !== undefined ? `key-${currentKeyInfo.keyIndex + 1}` : 'unknown'}`);
        console.error(`   Key Suffix: ${currentKeyInfo.keySuffix || 'unknown'}`);
        console.error(`   Total Keys: ${currentKeyInfo.totalKeys || 'unknown'}`);
        console.error(`   Error Details: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`   Next Key Available: ${currentKeyInfo.nextKeyIndex !== undefined ? `key-${currentKeyInfo.nextKeyIndex + 1}` : 'checking...'}`);
      }
      
      logger.error('Gemini API request failed', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId,
        error: error instanceof Error ? error.message : String(error),
        isRateLimited,
        keyInfo: currentKeyInfo,
        httpStatus: (error as any)?.status,
        errorCode: (error as any)?.code
      });
      throw error;
    }
  }

  async* sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    try {
      logger.debug('Starting streaming request to Gemini', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId
      });

      const stream = this.client.streamCompletion(request);
      
      for await (const chunk of stream) {
        yield chunk;
      }

      logger.debug('Completed streaming request to Gemini', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId
      });
    } catch (error) {
      logger.error('Gemini streaming request failed', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}