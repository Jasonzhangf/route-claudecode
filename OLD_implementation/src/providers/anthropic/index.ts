/**
 * Anthropic Provider
 * Direct integration with Anthropic's official API
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, Provider, ProviderConfig } from '../../types';
import { logger } from '../../utils/logger';
import { AnthropicClient } from './client';

export class AnthropicProvider implements Provider {
  public readonly name = 'anthropic';
  public readonly type = 'anthropic';
  private client: AnthropicClient;

  constructor(public readonly config: ProviderConfig) {
    if (config.type !== 'anthropic') {
      throw new Error(`Invalid provider type: ${config.type}, expected 'anthropic'`);
    }
    
    this.client = new AnthropicClient(config);
    logger.info(`Initialized Anthropic provider: ${config.endpoint}`, {
      provider: this.name,
      endpoint: config.endpoint
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      logger.error('Anthropic provider health check failed', {
        provider: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    try {
      logger.trace(request.metadata?.requestId || 'unknown', 'provider', 'Sending request to Anthropic', {
        provider: this.name,
        model: request.model,
        endpoint: this.config.endpoint
      });

      const response = await this.client.createMessage(request);
      
      logger.debug('Received response from Anthropic', {
        provider: this.name,
        model: response.model,
        requestId: request.metadata?.requestId,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      });

      return response;
    } catch (error) {
      logger.error('Anthropic API request failed', {
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
      logger.debug('Starting streaming request to Anthropic', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId
      });

      const stream = this.client.streamMessage(request);
      
      for await (const chunk of stream) {
        yield chunk;
      }

      logger.debug('Completed streaming request to Anthropic', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId
      });
    } catch (error) {
      logger.error('Anthropic streaming request failed', {
        provider: this.name,
        model: request.model,
        requestId: request.metadata?.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}