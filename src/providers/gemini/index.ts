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
      logger.error('Gemini API request failed', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId,
        error: error instanceof Error ? error.message : String(error)
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