/**
 * Gemini API Client Module
 * 纯API调用客户端，遵循零硬编码、零fallback原则
 * Project owner: Jason Zhang
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '@/utils/logger';
import { GeminiApiRequest, GeminiApiResponse } from '@/types';
export interface GeminiApiClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Gemini API客户端
 * 职责：纯API调用，无转换逻辑
 */
export class GeminiApiClient {
  private genAI: GoogleGenAI;
  private readonly timeout: number;

  constructor(private config: GeminiApiClientConfig) {
    if (!config.apiKey) {
      throw new Error('GeminiApiClient: apiKey is required - no fallback allowed');
    }

    this.genAI = new GoogleGenAI({ 
      apiKey: config.apiKey
      // Note: GoogleGenAI doesn't support custom baseUrl in constructor
      // Custom endpoint handling would need to be implemented differently
    });
    if (config.timeout === undefined) {
      throw new Error('GeminiApiClient: timeout must be specified - no default fallback allowed');
    }
    this.timeout = config.timeout;
    
    logger.debug('Gemini API client initialized', {
      hasApiKey: !!config.apiKey,
      timeout: this.timeout,
      baseUrl: config.baseUrl
    });
  }

  /**
   * 执行非流式API调用
   * 🔧 Critical: Zero-fallback, strict error handling
   */
  async generateContent(request: GeminiApiRequest, requestId?: string): Promise<GeminiApiResponse> {
    if (!request) {
      throw new Error('GeminiApiClient: request is required');
    }

    if (!request.model) {
      throw new Error('GeminiApiClient: model is required in request');
    }

    logger.debug('Executing Gemini API call', {
      model: request.model,
      hasContents: !!request.contents,
      contentCount: request.contents?.length ?? 0,
      hasTools: !!request.tools,
      timeout: this.timeout
    }, requestId, 'gemini-api-client');

    try {
      // 使用Promise.race实现超时控制
      const result = await Promise.race([
        this.genAI.models.generateContent({
          ...request,
          model: request.model || 'gemini-1.5-pro'
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Gemini API timeout after ${this.timeout}ms`)), this.timeout)
        )
      ]);

      if (!result) {
        throw new Error('GeminiApiClient: API returned null response');
      }

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('GeminiApiClient: API response has no candidates');
      }

      logger.debug('Gemini API call succeeded', {
        candidatesCount: result.candidates.length,
        hasUsageMetadata: !!result.usageMetadata,
        finishReason: result.candidates[0]?.finishReason
      }, requestId, 'gemini-api-client');

      return result as GeminiApiResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Gemini API call failed', {
        model: request.model,
        error: errorMessage,
        timeout: this.timeout
      }, requestId, 'gemini-api-client');
      
      // 重新抛出错误，不做任何fallback处理
      throw error;
    }
  }

  /**
   * 健康检查 - 零硬编码原则：使用配置的默认模型而非硬编码模型
   */
  async healthCheck(requestId?: string, healthCheckModel?: string): Promise<boolean> {
    try {
      // 🚫 零硬编码原则：健康检查应该使用配置的默认模型
      if (!healthCheckModel) {
        throw new Error('GeminiApiClient: healthCheckModel must be provided - no hardcoded defaults allowed');
      }
      
      const testRequest: GeminiApiRequest = {
        model: healthCheckModel,
        contents: [{
          role: 'user',
          parts: [{ text: 'Hi' }]
        }]
      };

      const result = await this.generateContent(testRequest, requestId);
      const isHealthy = !!(result && result.candidates && result.candidates.length > 0);
      
      logger.debug('Gemini API health check completed', {
        isHealthy,
        candidatesCount: result?.candidates?.length ?? 0
      }, requestId, 'gemini-api-client');
      
      return isHealthy;
    } catch (error) {
      logger.warn('Gemini API health check failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-api-client');
      
      return false;
    }
  }
}