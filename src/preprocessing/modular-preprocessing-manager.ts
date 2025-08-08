/**
 * Modular Preprocessing Manager
 * 模块化预处理管理器
 * Owner: Jason Zhang
 * 
 * 集成max token处理策略和其他预处理功能
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { 
  MaxTokenPreprocessor, 
  MaxTokenPreprocessorConfig,
  PreprocessedRequest 
} from './max-token-preprocessor';

export interface PreprocessingManagerConfig {
  maxTokenPreprocessor?: MaxTokenPreprocessorConfig;
}

export class ModularPreprocessingManager {
  private maxTokenPreprocessor?: MaxTokenPreprocessor;

  constructor(
    private port?: number,
    private config?: PreprocessingManagerConfig
  ) {
    // 初始化max token预处理器
    if (config?.maxTokenPreprocessor?.enabled) {
      this.maxTokenPreprocessor = new MaxTokenPreprocessor(config.maxTokenPreprocessor);
    }
  }

  /**
   * 预处理请求
   */
  async preprocessRequest(
    request: BaseRequest, 
    routingInfo?: {
      category?: string;
      maxTokenLimit?: number;
    }
  ): Promise<BaseRequest & { preprocessingResult?: PreprocessedRequest }> {
    try {
      // 基础预处理逻辑
      let processedRequest = { ...request };
      
      // 确保metadata存在
      if (!processedRequest.metadata) {
        processedRequest.metadata = {
          requestId: 'unknown'
        };
      }

      // 应用max token预处理
      let preprocessingResult: PreprocessedRequest | undefined;
      
      if (this.maxTokenPreprocessor && routingInfo?.maxTokenLimit) {
        try {
          preprocessingResult = await this.maxTokenPreprocessor.preprocessRequest(
            processedRequest,
            routingInfo.maxTokenLimit,
            routingInfo.category
          );

          // 如果有路由重定向，更新请求
          if (preprocessingResult.redirectedCategory) {
            processedRequest.metadata.redirectedCategory = preprocessingResult.redirectedCategory;
            logger.info('Request redirected due to token limit', {
              originalCategory: routingInfo.category,
              redirectedCategory: preprocessingResult.redirectedCategory,
              originalTokens: preprocessingResult.originalTokenCount,
              processedTokens: preprocessingResult.processedTokenCount,
              appliedStrategies: preprocessingResult.appliedStrategies
            });
          }

          // 更新请求内容
          if (preprocessingResult.messages) {
            processedRequest.messages = preprocessingResult.messages;
          }
          if (preprocessingResult.tools) {
            processedRequest.tools = preprocessingResult.tools;
          }

          // 记录预处理结果
          if (preprocessingResult.appliedStrategies.length > 0) {
            logger.info('Max token preprocessing applied', {
              requestId: processedRequest.metadata.requestId,
              appliedStrategies: preprocessingResult.appliedStrategies,
              originalTokens: preprocessingResult.originalTokenCount,
              processedTokens: preprocessingResult.processedTokenCount,
              reduction: preprocessingResult.originalTokenCount - preprocessingResult.processedTokenCount
            });
          }

        } catch (preprocessingError) {
          logger.warn('Max token preprocessing failed, continuing with original request', {
            error: preprocessingError instanceof Error ? preprocessingError.message : String(preprocessingError)
          });
        }
      }

      return {
        ...processedRequest,
        preprocessingResult
      };

    } catch (error) {
      logger.error('Request preprocessing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 预处理响应
   */
  async preprocessResponse(response: BaseResponse): Promise<BaseResponse> {
    try {
      // 基础响应预处理
      return response;
    } catch (error) {
      logger.error('Response preprocessing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export function getModularPreprocessingManager(
  port?: number, 
  config?: PreprocessingManagerConfig
): ModularPreprocessingManager {
  // 如果没有提供配置，使用默认配置
  const defaultConfig: PreprocessingManagerConfig = {
    maxTokenPreprocessor: MaxTokenPreprocessor.getDefaultConfig()
  };
  
  return new ModularPreprocessingManager(port, config || defaultConfig);
}