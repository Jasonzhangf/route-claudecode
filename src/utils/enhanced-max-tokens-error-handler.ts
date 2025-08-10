/**
 * 增强版Max Tokens错误处理器
 * 集成智能处理模块，提供滚动截断和压缩等高级功能
 * Project Owner: Jason Zhang
 */

import { logger } from './logger';
import { BaseRequest } from '@/types';
import { MaxTokensErrorHandlingModule, TruncationResult } from './max-tokens-error-handling-module';

export interface EnhancedMaxTokensError extends Error {
  status: number;
  code: string;
  details: {
    finishReason: string;
    provider: string;
    model: string;
    requestId: string;
    usage?: any;
    truncationResult?: TruncationResult;
    autoRetryAvailable?: boolean;
  };
}

export interface MaxTokensHandlingOptions {
  enableAutoRetry: boolean; // 是否启用自动重试机制
  maxRetryAttempts: number; // 最大重试次数
  handlingModulePath?: string; // 处理模块配置路径
}

export class EnhancedMaxTokensErrorHandler {
  private handlingModule: MaxTokensErrorHandlingModule;
  private options: MaxTokensHandlingOptions;

  constructor(options: Partial<MaxTokensHandlingOptions> = {}) {
    this.options = {
      enableAutoRetry: true,
      maxRetryAttempts: 2,
      ...options
    };

    this.handlingModule = new MaxTokensErrorHandlingModule(options.handlingModulePath);
  }

  /**
   * 检查finish_reason是否表示达到了token限制
   */
  static isMaxTokensReached(finishReason: string): boolean {
    const maxTokensReasons = [
      'max_tokens',    // OpenAI格式
      'length',        // OpenAI length limit
      'max_tokens',    // Anthropic格式
    ];
    
    return maxTokensReasons.includes(finishReason?.toLowerCase());
  }

  /**
   * 检查Anthropic格式的stop_reason是否表示达到了token限制
   */
  static isMaxTokensStopReason(stopReason: string): boolean {
    const maxTokensStopReasons = [
      'max_tokens',    // Anthropic max tokens
    ];
    
    return maxTokensStopReasons.includes(stopReason?.toLowerCase());
  }

  /**
   * 智能处理max tokens错误 - 主入口
   * @param response API响应对象
   * @param provider 提供商名称
   * @param model 模型名称
   * @param requestId 请求ID
   * @param originalRequest 原始请求（用于智能处理）
   * @returns 处理后的请求或抛出错误
   */
  async handleMaxTokensResponse(
    response: any,
    provider: string,
    model: string,
    requestId: string,
    originalRequest?: BaseRequest
  ): Promise<{ shouldRetry: boolean; truncatedRequest?: BaseRequest; error?: EnhancedMaxTokensError }> {
    
    // 检查是否达到token限制
    const isMaxTokensReached = this.detectMaxTokensCondition(response);
    
    if (!isMaxTokensReached) {
      return { shouldRetry: false };
    }

    logger.warn('🚨 [MAX-TOKENS] Token limit reached', {
      provider,
      model,
      requestId,
      finishReason: this.extractFinishReason(response),
      autoRetryEnabled: this.options.enableAutoRetry
    });

    // 如果启用自动处理且有原始请求
    if (this.options.enableAutoRetry && originalRequest) {
      try {
        const truncationResult = await this.handlingModule.handleMaxTokensError(
          originalRequest,
          { response, provider, model },
          requestId
        );

        if (truncationResult.success) {
          logger.info('🔧 [MAX-TOKENS] Auto-truncation successful', {
            originalTokens: truncationResult.originalTokens,
            reducedTokens: truncationResult.reducedTokens,
            reductionPercent: Math.round((1 - truncationResult.reducedTokens / truncationResult.originalTokens) * 100),
            strategy: truncationResult.strategy,
            requestId
          });

          return {
            shouldRetry: true,
            truncatedRequest: truncationResult.truncatedRequest
          };
        }
      } catch (error) {
        logger.error('🚨 [MAX-TOKENS] Auto-handling failed', error, requestId);
      }
    }

    // 创建增强的错误对象
    const enhancedError = this.createEnhancedMaxTokensError(
      this.extractFinishReason(response),
      provider,
      model,
      requestId,
      response.usage,
      originalRequest ? true : false
    );

    return {
      shouldRetry: false,
      error: enhancedError
    };
  }

  /**
   * 检测max tokens条件
   */
  private detectMaxTokensCondition(response: any): boolean {
    // 检查OpenAI格式的finish_reason
    if (response.choices?.[0]?.finish_reason) {
      return EnhancedMaxTokensErrorHandler.isMaxTokensReached(response.choices[0].finish_reason);
    }

    // 检查Anthropic格式的stop_reason
    if (response.stop_reason) {
      return EnhancedMaxTokensErrorHandler.isMaxTokensStopReason(response.stop_reason);
    }

    // 检查unified格式
    if (response.finishReason) {
      return EnhancedMaxTokensErrorHandler.isMaxTokensReached(response.finishReason);
    }

    return false;
  }

  /**
   * 提取finish reason
   */
  private extractFinishReason(response: any): string {
    if (response.choices?.[0]?.finish_reason) {
      return response.choices[0].finish_reason;
    }
    if (response.stop_reason) {
      return response.stop_reason;
    }
    if (response.finishReason) {
      return response.finishReason;
    }
    return 'unknown';
  }

  /**
   * 创建增强版max tokens错误
   */
  private createEnhancedMaxTokensError(
    finishReason: string,
    provider: string,
    model: string,
    requestId: string,
    usage?: any,
    autoRetryAvailable?: boolean
  ): EnhancedMaxTokensError {
    const message = autoRetryAvailable
      ? `Request exceeded maximum token limit. Auto-retry with intelligent truncation is available.`
      : `Request exceeded maximum token limit. Please reduce input length or increase max_tokens parameter.`;

    const error = new Error(message) as EnhancedMaxTokensError;
    
    error.status = 429; // 使用429表示可以重试
    error.code = 'MAX_TOKENS_EXCEEDED';
    error.details = {
      finishReason,
      provider,
      model,
      requestId,
      usage,
      autoRetryAvailable
    };
    
    return error;
  }

  /**
   * 兼容性方法 - 检查响应并抛出错误（向后兼容）
   */
  static checkAndThrowMaxTokensError(
    response: any,
    provider: string,
    model: string,
    requestId: string
  ): void {
    const handler = new EnhancedMaxTokensErrorHandler({ enableAutoRetry: false });
    
    if (handler.detectMaxTokensCondition(response)) {
      throw handler.createEnhancedMaxTokensError(
        handler.extractFinishReason(response),
        provider,
        model,
        requestId,
        response.usage,
        false
      );
    }
  }

  /**
   * 格式化错误响应
   */
  static formatErrorResponse(error: EnhancedMaxTokensError): any {
    return {
      error: {
        type: 'max_tokens_exceeded',
        message: error.message,
        code: error.code,
        details: {
          finish_reason: error.details.finishReason,
          provider: error.details.provider,
          model: error.details.model,
          request_id: error.details.requestId,
          usage: error.details.usage,
          auto_retry_available: error.details.autoRetryAvailable,
          suggestion: error.details.autoRetryAvailable 
            ? 'Request can be automatically retried with intelligent truncation'
            : 'Reduce input length or increase max_tokens parameter'
        }
      }
    };
  }

  /**
   * 获取处理模块配置
   */
  getHandlingConfig() {
    return this.handlingModule.getConfig();
  }

  /**
   * 更新处理模块配置
   */
  updateHandlingConfig(updates: any) {
    this.handlingModule.updateConfig(updates);
  }
}

export default EnhancedMaxTokensErrorHandler;