/**
 * Max Tokens中间件 - 集成到请求处理流程
 * Project Owner: Jason Zhang
 * 
 * 职责：
 * 1. 预处理检查：发送前验证token使用
 * 2. 错误拦截：捕获max_tokens错误并智能处理
 * 3. 用户反馈：提供清晰的处理状态和选择
 * 4. 安全控制：防止无限重试和上下文丢失
 */

import { logger } from './logger';
import { BaseRequest, BaseResponse } from '@/types';
import { SafeMaxTokensHandler, SafeHandlingResult } from './safe-max-tokens-handler';

export interface MaxTokensMiddlewareOptions {
  enablePreflightCheck: boolean;
  enableAutoRetry: boolean;
  maxRetryAttempts: number;
  userInteractionMode: 'auto' | 'prompt' | 'disabled';
  tokenSafetyMargin: number;
}

export interface MiddlewareResult {
  action: 'proceed' | 'modified' | 'error' | 'user_required';
  request?: BaseRequest;
  error?: any;
  userPrompt?: {
    message: string;
    options: string[];
    defaultAction: string;
  };
  metadata?: {
    tokensEstimated: number;
    tokensReduced?: number;
    truncationApplied: boolean;
    retryAttempt: number;
  };
}

export class MaxTokensMiddleware {
  private safeHandler: SafeMaxTokensHandler;
  private options: MaxTokensMiddlewareOptions;
  private processingRequests: Set<string> = new Set();

  constructor(options: Partial<MaxTokensMiddlewareOptions> = {}) {
    this.options = {
      enablePreflightCheck: true,
      enableAutoRetry: true,
      maxRetryAttempts: 1,
      userInteractionMode: 'auto', // 默认自动处理
      tokenSafetyMargin: 500,
      ...options
    };

    this.safeHandler = new SafeMaxTokensHandler({
      enablePreemptiveCheck: this.options.enablePreflightCheck,
      maxRetryAttempts: this.options.maxRetryAttempts,
      tokenSafetyMargin: this.options.tokenSafetyMargin,
      enableProgressiveReduction: true
    });

    logger.info('Max Tokens Middleware initialized', {
      preflightCheck: this.options.enablePreflightCheck,
      autoRetry: this.options.enableAutoRetry,
      userInteractionMode: this.options.userInteractionMode
    });
  }

  /**
   * 预处理请求 - 在发送到Provider前检查
   */
  async preprocessRequest(
    request: BaseRequest,
    maxTokens: number,
    requestId: string
  ): Promise<MiddlewareResult> {
    
    if (this.processingRequests.has(requestId)) {
      logger.warn('🔄 [MIDDLEWARE] Request already being processed', { requestId });
      return {
        action: 'error',
        error: new Error('Request is already being processed to prevent infinite loops')
      };
    }

    this.processingRequests.add(requestId);

    try {
      const handlingResult = await this.safeHandler.preflightCheck(
        request,
        maxTokens,
        requestId
      );

      return this.processHandlingResult(handlingResult, request, requestId, 'preflight');
    } catch (error) {
      logger.error('🚨 [MIDDLEWARE] Preflight check failed', error, requestId);
      return {
        action: 'error',
        error: error
      };
    } finally {
      this.processingRequests.delete(requestId);
    }
  }

  /**
   * 后处理响应 - 处理max_tokens错误
   */
  async postprocessResponse(
    originalRequest: BaseRequest,
    response: any,
    error: any,
    requestId: string
  ): Promise<MiddlewareResult> {
    
    // 只处理max_tokens相关错误
    if (!this.isMaxTokensError(response, error)) {
      return { action: 'proceed' };
    }

    if (!this.options.enableAutoRetry) {
      logger.info('🚨 [MIDDLEWARE] Max tokens error detected, auto-retry disabled', { requestId });
      return {
        action: 'error',
        error: this.createUserFriendlyError(response, error, originalRequest),
        metadata: {
          tokensEstimated: this.estimateTokens(originalRequest),
          truncationApplied: false,
          retryAttempt: 0
        }
      };
    }

    if (this.processingRequests.has(requestId)) {
      logger.warn('🔄 [MIDDLEWARE] Max tokens retry already in progress', { requestId });
      return {
        action: 'error',
        error: new Error('Max tokens retry already in progress to prevent infinite loops')
      };
    }

    this.processingRequests.add(requestId);

    try {
      const handlingResult = await this.safeHandler.handleMaxTokensError(
        originalRequest,
        response || error,
        requestId
      );

      return this.processHandlingResult(handlingResult, originalRequest, requestId, 'postprocess');
    } catch (handlingError) {
      logger.error('🚨 [MIDDLEWARE] Max tokens handling failed', handlingError, requestId);
      return {
        action: 'error',
        error: handlingError
      };
    } finally {
      this.processingRequests.delete(requestId);
    }
  }

  /**
   * 处理SafeHandler的结果
   */
  private processHandlingResult(
    handlingResult: SafeHandlingResult,
    originalRequest: BaseRequest,
    requestId: string,
    stage: 'preflight' | 'postprocess'
  ): MiddlewareResult {
    
    switch (handlingResult.action) {
      case 'proceed':
        if (handlingResult.warning) {
          logger.info(`⚠️ [MIDDLEWARE-${stage.toUpperCase()}] Warning issued`, {
            type: handlingResult.warning.type,
            message: handlingResult.warning.message,
            requestId
          });
        }
        
        return {
          action: 'proceed',
          request: originalRequest,
          metadata: {
            tokensEstimated: handlingResult.warning?.estimatedTokens || this.estimateTokens(originalRequest),
            truncationApplied: false,
            retryAttempt: 0
          }
        };

      case 'truncate':
        if (handlingResult.truncatedRequest) {
          logger.info(`🔧 [MIDDLEWARE-${stage.toUpperCase()}] Request truncated`, {
            originalTokens: handlingResult.warning?.truncationDetails?.originalTokens,
            reducedTokens: handlingResult.warning?.estimatedTokens,
            requestId
          });

          return {
            action: 'modified',
            request: handlingResult.truncatedRequest,
            metadata: {
              tokensEstimated: handlingResult.warning?.truncationDetails?.originalTokens || 0,
              tokensReduced: handlingResult.warning?.estimatedTokens || 0,
              truncationApplied: true,
              retryAttempt: stage === 'postprocess' ? 1 : 0
            }
          };
        }
        break;

      case 'user_choice':
        if (this.options.userInteractionMode === 'auto') {
          // 自动模式：选择最安全的选项（简化）
          logger.info(`🤖 [MIDDLEWARE-${stage.toUpperCase()}] Auto-choosing safest option`, { requestId });
          
          // 这里可以调用简化处理逻辑
          return {
            action: 'error',
            error: this.createUserFriendlyError(null, null, originalRequest, handlingResult.warning?.message)
          };
        } else if (this.options.userInteractionMode === 'prompt') {
          return {
            action: 'user_required',
            userPrompt: {
              message: handlingResult.warning?.message || 'Request exceeds token limit. How would you like to proceed?',
              options: [
                'Auto-truncate (may lose context)',
                'Use simplified prompt only', 
                'Cancel request'
              ],
              defaultAction: 'Auto-truncate (may lose context)'
            },
            metadata: {
              tokensEstimated: handlingResult.warning?.estimatedTokens || 0,
              truncationApplied: false,
              retryAttempt: 0
            }
          };
        }
        break;

      case 'abort':
        logger.warn(`🛑 [MIDDLEWARE-${stage.toUpperCase()}] Processing aborted`, {
          reason: handlingResult.warning?.message,
          requestId
        });
        
        return {
          action: 'error',
          error: this.createUserFriendlyError(
            null, 
            null, 
            originalRequest, 
            handlingResult.warning?.message
          )
        };
    }

    return {
      action: 'error',
      error: new Error('Unknown handling result action')
    };
  }

  /**
   * 检查是否是max_tokens错误
   */
  private isMaxTokensError(response: any, error: any): boolean {
    // 检查响应中的finish_reason
    if (response?.choices?.[0]?.finish_reason) {
      const finishReason = response.choices[0].finish_reason.toLowerCase();
      if (finishReason === 'length' || finishReason === 'max_tokens') {
        return true;
      }
    }

    // 检查Anthropic格式
    if (response?.stop_reason) {
      const stopReason = response.stop_reason.toLowerCase();
      if (stopReason === 'max_tokens') {
        return true;
      }
    }

    // 检查错误信息
    if (error) {
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('max_tokens') || 
          errorMessage.includes('token limit') ||
          errorMessage.includes('context length')) {
        return true;
      }
      
      // 检查错误码
      if (error.code === 'MAX_TOKENS_EXCEEDED' || 
          error.status === 400 && errorMessage.includes('tokens')) {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建用户友好的错误
   */
  private createUserFriendlyError(
    response: any,
    error: any,
    originalRequest: BaseRequest,
    customMessage?: string
  ): Error {
    const estimatedTokens = this.estimateTokens(originalRequest);
    
    const message = customMessage || 
      `Request exceeded token limit (~${estimatedTokens} tokens). ` +
      `To resolve this: 1) Reduce input length, 2) Use fewer examples, or 3) Simplify your request. ` +
      `Consider breaking complex tasks into smaller parts.`;

    const enhancedError = new Error(message) as any;
    enhancedError.code = 'MAX_TOKENS_EXCEEDED';
    enhancedError.status = 400;
    enhancedError.details = {
      estimatedTokens,
      suggestion: 'Break your request into smaller parts or reduce the input length',
      autoTruncationAvailable: true
    };

    return enhancedError;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(request: BaseRequest): number {
    let totalChars = 0;

    if (request.messages) {
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        }
      });
    }

    if (request.metadata?.system) {
      totalChars += JSON.stringify(request.metadata.system).length;
    }

    if (request.metadata?.tools) {
      totalChars += JSON.stringify(request.metadata.tools).length;
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * 清理处理状态
   */
  cleanup(): void {
    this.processingRequests.clear();
    logger.info('Max Tokens Middleware cleaned up');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      activeRequests: this.processingRequests.size,
      safeHandlerStats: this.safeHandler.getStats()
    };
  }
}

export default MaxTokensMiddleware;