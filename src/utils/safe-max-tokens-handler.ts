/**
 * 安全的Max Tokens处理器 - 避免无限重试风险
 * Project Owner: Jason Zhang
 * 
 * 改进方案：
 * 1. 预处理检查：发送前估算token，超限时主动截断
 * 2. 渐进式截断：多级截断策略，确保成功
 * 3. 用户控制：返回选项让用户决定是否重试
 * 4. 透明化：清晰告知用户发生了什么
 */

import { logger } from './logger';
import { BaseRequest } from '@/types';
import { MaxTokensErrorHandlingModule, TruncationResult } from './max-tokens-error-handling-module';

export interface SafeHandlingResult {
  action: 'proceed' | 'truncate' | 'user_choice' | 'abort';
  truncatedRequest?: BaseRequest;
  warning?: {
    type: 'token_limit_approaching' | 'truncation_required' | 'context_loss_risk';
    message: string;
    estimatedTokens: number;
    maxTokens: number;
    truncationDetails?: TruncationResult;
  };
  userChoices?: {
    autoTruncate: boolean;
    manualEdit: boolean;
    useSimplified: boolean;
  };
}

export interface SafeHandlingOptions {
  enablePreemptiveCheck: boolean; // 预检查token使用
  maxRetryAttempts: number; // 最大重试次数（默认1）
  tokenSafetyMargin: number; // 安全边界（预留token数，默认500）
  userChoiceTimeout: number; // 用户选择超时时间（毫秒）
  enableProgressiveReduction: boolean; // 渐进式减少
}

export class SafeMaxTokensHandler {
  private handlingModule: MaxTokensErrorHandlingModule;
  private options: SafeHandlingOptions;
  private retryCounters: Map<string, number> = new Map();

  constructor(options: Partial<SafeHandlingOptions> = {}) {
    this.options = {
      enablePreemptiveCheck: true,
      maxRetryAttempts: 1, // 只允许1次重试，避免无限循环
      tokenSafetyMargin: 500,
      userChoiceTimeout: 30000, // 30秒超时
      enableProgressiveReduction: true,
      ...options
    };

    this.handlingModule = new MaxTokensErrorHandlingModule();
    
    logger.info('Safe Max Tokens Handler initialized', {
      maxRetryAttempts: this.options.maxRetryAttempts,
      tokenSafetyMargin: this.options.tokenSafetyMargin,
      preemptiveCheck: this.options.enablePreemptiveCheck
    });
  }

  /**
   * 预发送检查 - 在发送请求前检查token使用
   */
  async preflightCheck(
    request: BaseRequest,
    maxTokens: number,
    requestId: string
  ): Promise<SafeHandlingResult> {
    
    if (!this.options.enablePreemptiveCheck) {
      return { action: 'proceed' };
    }

    const estimatedTokens = this.estimateTokens(request);
    const effectiveLimit = maxTokens - this.options.tokenSafetyMargin;

    logger.debug('🔍 [PREFLIGHT] Token estimation', {
      estimatedTokens,
      maxTokens,
      effectiveLimit,
      safetyMargin: this.options.tokenSafetyMargin,
      requestId
    });

    // 安全范围内，直接发送
    if (estimatedTokens <= effectiveLimit) {
      return { action: 'proceed' };
    }

    // 接近限制，给出警告但允许发送
    if (estimatedTokens <= maxTokens) {
      return {
        action: 'proceed',
        warning: {
          type: 'token_limit_approaching',
          message: `Request is approaching token limit (${estimatedTokens}/${maxTokens}). Consider simplifying if response is truncated.`,
          estimatedTokens,
          maxTokens
        }
      };
    }

    // 明确超限，需要处理
    logger.warn('🚨 [PREFLIGHT] Token limit exceeded', {
      estimatedTokens,
      maxTokens,
      overage: estimatedTokens - maxTokens,
      requestId
    });

    // 尝试渐进式截断
    const truncationResult = await this.performProgressiveTruncation(
      request,
      maxTokens,
      requestId
    );

    if (truncationResult.success) {
      return {
        action: 'truncate',
        truncatedRequest: truncationResult.truncatedRequest,
        warning: {
          type: 'truncation_required',
          message: `Request exceeded token limit and was automatically truncated (${truncationResult.originalTokens} → ${truncationResult.reducedTokens} tokens).`,
          estimatedTokens: truncationResult.reducedTokens,
          maxTokens,
          truncationDetails: truncationResult
        }
      };
    }

    // 无法自动处理，需要用户选择
    return {
      action: 'user_choice',
      warning: {
        type: 'context_loss_risk',
        message: `Request significantly exceeds token limit (${estimatedTokens}/${maxTokens}). Automatic truncation may affect response quality.`,
        estimatedTokens,
        maxTokens
      },
      userChoices: {
        autoTruncate: true,
        manualEdit: true,
        useSimplified: true
      }
    };
  }

  /**
   * 响应时错误处理 - 收到max_tokens错误后的处理
   */
  async handleMaxTokensError(
    originalRequest: BaseRequest,
    errorResponse: any,
    requestId: string
  ): Promise<SafeHandlingResult> {
    
    // 检查重试次数
    const currentRetries = this.retryCounters.get(requestId) || 0;
    if (currentRetries >= this.options.maxRetryAttempts) {
      logger.warn('🚨 [MAX-TOKENS] Maximum retry attempts reached', {
        currentRetries,
        maxRetries: this.options.maxRetryAttempts,
        requestId
      });

      return {
        action: 'abort',
        warning: {
          type: 'context_loss_risk',
          message: `Maximum retry attempts (${this.options.maxRetryAttempts}) reached. Please manually reduce request size.`,
          estimatedTokens: this.estimateTokens(originalRequest),
          maxTokens: 0 // Unknown from error response
        }
      };
    }

    // 增加重试计数
    this.retryCounters.set(requestId, currentRetries + 1);

    logger.info('🔧 [MAX-TOKENS] Attempting intelligent recovery', {
      attempt: currentRetries + 1,
      maxAttempts: this.options.maxRetryAttempts,
      requestId
    });

    // 尝试渐进式截断
    try {
      const truncationResult = await this.performProgressiveTruncation(
        originalRequest,
        this.estimateMaxTokensFromError(errorResponse),
        requestId
      );

      if (truncationResult.success) {
        // 确保截断后的请求足够小
        const truncatedEstimate = this.estimateTokens(truncationResult.truncatedRequest);
        const maxTokens = this.estimateMaxTokensFromError(errorResponse);
        
        if (truncatedEstimate <= maxTokens * 0.8) { // 80% 安全边界
          return {
            action: 'truncate',
            truncatedRequest: truncationResult.truncatedRequest,
            warning: {
              type: 'truncation_required',
              message: `Request was automatically truncated due to token limits (${truncationResult.originalTokens} → ${truncationResult.reducedTokens} tokens).`,
              estimatedTokens: truncationResult.reducedTokens,
              maxTokens,
              truncationDetails: truncationResult
            }
          };
        }
      }
    } catch (error) {
      logger.error('🚨 [MAX-TOKENS] Truncation failed', error, requestId);
    }

    // 无法安全处理，终止重试
    return {
      action: 'abort',
      warning: {
        type: 'context_loss_risk',
        message: 'Unable to safely truncate request. Please manually reduce the input size.',
        estimatedTokens: this.estimateTokens(originalRequest),
        maxTokens: this.estimateMaxTokensFromError(errorResponse)
      }
    };
  }

  /**
   * 渐进式截断 - 多级截断策略
   */
  private async performProgressiveTruncation(
    request: BaseRequest,
    maxTokens: number,
    requestId: string
  ): Promise<TruncationResult> {
    
    const reductionStrategies = [
      { historyRetention: 80, useSimplified: true },  // 轻度截断
      { historyRetention: 60, useSimplified: true },  // 中度截断
      { historyRetention: 40, useSimplified: true },  // 重度截断
      { historyRetention: 20, useSimplified: true }   // 极度截断
    ];

    logger.debug('🔧 [PROGRESSIVE] Starting progressive truncation', {
      strategies: reductionStrategies.length,
      targetTokens: maxTokens * 0.8, // 目标80%使用率
      requestId
    });

    for (let i = 0; i < reductionStrategies.length; i++) {
      const strategy = reductionStrategies[i];
      
      // 临时更新配置
      this.handlingModule.updateConfig({
        strategy: 'rolling_truncation',
        rollingTruncation: {
          historyRetentionPercent: strategy.historyRetention,
          useSimplifiedPrompt: strategy.useSimplified,
          simplifiedPromptPath: 'config/simplified-system-prompt.json'
        }
      });

      try {
        const result = await this.handlingModule.handleMaxTokensError(
          request,
          { maxTokens, provider: 'progressive-truncation' },
          requestId
        );

        logger.debug(`🔧 [PROGRESSIVE] Strategy ${i + 1} result`, {
          historyRetention: strategy.historyRetention,
          originalTokens: result.originalTokens,
          reducedTokens: result.reducedTokens,
          targetTokens: maxTokens * 0.8,
          success: result.reducedTokens <= maxTokens * 0.8,
          requestId
        });

        // 检查是否达到目标（80%安全边界）
        if (result.success && result.reducedTokens <= maxTokens * 0.8) {
          logger.info('🎯 [PROGRESSIVE] Truncation successful', {
            strategy: i + 1,
            reduction: Math.round((1 - result.reducedTokens / result.originalTokens) * 100),
            finalTokens: result.reducedTokens,
            requestId
          });
          return result;
        }
      } catch (error) {
        logger.debug(`🔧 [PROGRESSIVE] Strategy ${i + 1} failed`, error, requestId);
      }
    }

    throw new Error('Progressive truncation failed to achieve safe token count');
  }

  /**
   * 估算token数量
   */
  private estimateTokens(request: BaseRequest): number {
    let totalChars = 0;

    // 消息内容
    if (request.messages) {
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((block: any) => {
            if (block.text) totalChars += block.text.length;
            if (block.content) totalChars += JSON.stringify(block.content).length;
          });
        }
      });
    }

    // 系统提示词
    if (request.metadata?.system) {
      totalChars += JSON.stringify(request.metadata.system).length;
    }

    // 工具定义
    if (request.metadata?.tools) {
      totalChars += JSON.stringify(request.metadata.tools).length;
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * 从错误响应估算最大token数
   */
  private estimateMaxTokensFromError(errorResponse: any): number {
    // 尝试从usage信息推断
    if (errorResponse.usage?.total_tokens) {
      return errorResponse.usage.total_tokens + 1000; // 增加缓冲
    }
    
    // 默认估算
    return 4096;
  }

  /**
   * 清理请求的重试计数器
   */
  clearRetryCounter(requestId: string): void {
    this.retryCounters.delete(requestId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeRetries: number;
    totalRequestsHandled: number;
    averageRetryRate: number;
  } {
    return {
      activeRetries: this.retryCounters.size,
      totalRequestsHandled: this.retryCounters.size, // 简化统计
      averageRetryRate: this.retryCounters.size > 0 ? 
        Array.from(this.retryCounters.values()).reduce((sum, count) => sum + count, 0) / this.retryCounters.size : 0
    };
  }
}

export default SafeMaxTokensHandler;