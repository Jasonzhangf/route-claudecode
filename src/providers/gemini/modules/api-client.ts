/**
 * Gemini API客户端模块
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 管理与Gemini API的连接
 * - 处理API密钥轮换
 * - 执行重试逻辑
 * - 超时管理
 * - 只支持非流式请求
 */

import { GoogleGenAI } from '@google/genai';
import { ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { GeminiApiRequest, GeminiApiResponse } from './response-converter';

export interface ApiClientConfig {
  apiKeys: string[];
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export class GeminiApiClient {
  private genAIClients: GoogleGenAI[] = [];
  private currentKeyIndex = 0;
  private config: ApiClientConfig;

  constructor(providerConfig: ProviderConfig, providerId: string) {
    this.config = this.extractConfig(providerConfig);
    
    // 初始化GoogleGenAI客户端
    this.genAIClients = this.config.apiKeys.map(apiKey => 
      new GoogleGenAI({ apiKey })
    );

    logger.info('Gemini API client initialized', {
      providerId,
      keyCount: this.config.apiKeys.length,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
  }

  /**
   * 执行非流式API调用
   */
  async executeRequest(request: GeminiApiRequest, requestId: string): Promise<GeminiApiResponse> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const keyIndex = this.getNextKeyIndex();
      const client = this.genAIClients[keyIndex];
      
      try {
        logger.debug('Executing Gemini API request', {
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          keyIndex,
          model: request.model,
          hasTools: !!request.tools
        }, requestId, 'gemini-api-client');

        // 执行请求，带超时控制
        const response = await Promise.race([
          client.models.generateContent(request),
          this.createTimeoutPromise()
        ]) as any;

        // 验证响应
        this.validateResponse(response, requestId);

        // 检测是否意外返回了流式响应
        if (this.isStreamingResponse(response)) {
          throw new Error('CRITICAL: Gemini API returned streaming response when non-streaming was requested');
        }

        logger.debug('Gemini API request successful', {
          attempt: attempt + 1,
          keyIndex,
          candidateCount: response.candidates?.length || 0,
          hasUsage: !!response.usageMetadata
        }, requestId, 'gemini-api-client');

        return response;

      } catch (error) {
        lastError = error;
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Gemini API request failed', {
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          keyIndex,
          error: errorMessage
        }, requestId, 'gemini-api-client');

        // 检查是否需要重试
        if (attempt < this.config.maxRetries - 1) {
          const isRetryable = this.isRetryableError(error);
          if (isRetryable) {
            logger.debug('Retrying Gemini API request', {
              nextAttempt: attempt + 2,
              retryDelay: this.config.retryDelay
            }, requestId, 'gemini-api-client');
            
            await this.sleep(this.config.retryDelay);
            continue;
          } else {
            logger.error('Non-retryable error, stopping attempts', {
              error: errorMessage,
              attempt: attempt + 1
            }, requestId, 'gemini-api-client');
            break;
          }
        }
      }
    }

    // 所有重试都失败了
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    logger.error('All Gemini API request attempts failed', {
      totalAttempts: this.config.maxRetries,
      finalError: errorMessage
    }, requestId, 'gemini-api-client');

    throw new Error(`Gemini API requests failed after ${this.config.maxRetries} attempts: ${errorMessage}`);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = this.genAIClients[0];
      if (!client) {
        return false;
      }

      const testResponse = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [{ text: 'Hi' }]
          }]
        }),
        this.createTimeoutPromise()
      ]);

      return !!(testResponse && testResponse.candidates && testResponse.candidates.length > 0);

    } catch (error) {
      logger.debug('Gemini health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 提取配置 - 使用配置驱动，消除硬编码
   */
  private extractConfig(providerConfig: ProviderConfig): ApiClientConfig {
    const credentials = providerConfig.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : undefined;
    
    let apiKeys: string[];
    
    if (Array.isArray(apiKey)) {
      apiKeys = apiKey;
    } else if (typeof apiKey === 'string') {
      apiKeys = [apiKey];
    } else {
      throw new Error('GeminiApiClient: API key is required but not provided in authentication.credentials');
    }

    if (apiKeys.length === 0 || apiKeys.some(key => !key)) {
      throw new Error('GeminiApiClient: All API keys must be non-empty strings');
    }

    // 使用配置值或合理默认值
    const config: any = (providerConfig as any).config || {};
    return {
      apiKeys,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000
    };
  }

  /**
   * 获取下一个可用的密钥索引
   */
  private getNextKeyIndex(): number {
    const index = this.currentKeyIndex;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.genAIClients.length;
    return index;
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Gemini API timeout after ${this.config.timeout}ms`)), this.config.timeout)
    );
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 可重试的错误类型
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /rate limit/i,
      /quota/i,
      /429/,
      /500/,
      /502/,
      /503/,
      /504/
    ];

    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * 检测是否为流式响应
   */
  private isStreamingResponse(response: any): boolean {
    if (response && typeof response === 'object') {
      return response.stream === true || 
             response.streaming === true ||
             typeof response.read === 'function' ||
             typeof response.pipe === 'function' ||
             response.constructor?.name === 'ReadableStream';
    }
    return false;
  }

  /**
   * 验证API响应
   */
  private validateResponse(response: any, requestId: string): void {
    if (!response) {
      throw new Error('GeminiApiClient: API returned null or undefined response');
    }

    if (typeof response !== 'object') {
      throw new Error('GeminiApiClient: API returned non-object response');
    }

    // 检查错误响应
    if (response.error) {
      throw new Error(`GeminiApiClient: API returned error: ${JSON.stringify(response.error)}`);
    }

    logger.debug('Gemini API response validated', {
      hasResponse: !!response,
      hasCandidates: !!response.candidates,
      candidateCount: response.candidates?.length || 0
    }, requestId, 'gemini-api-client');
  }

  /**
   * 睡眠工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}