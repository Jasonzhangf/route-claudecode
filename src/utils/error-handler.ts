/**
 * 统一错误处理系统
 * 确保所有错误都正确返回HTTP状态码，不允许静默失败
 */

import { FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';
import { ProviderError } from '@/types';
import { ErrorSystemDiagnostics } from './error-system-diagnostics';

export interface ErrorContext {
  requestId: string;
  providerId?: string;
  model?: string;
  stage: string;
  isStreaming?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ErrorResponse {
  error: {
    type: string;
    message: string;
    code?: string;
    details?: any;
  };
}

export class UnifiedErrorHandler {
  /**
   * 处理所有类型的错误，确保返回适当的HTTP状态码
   */
  static handleError(
    error: any,
    reply: FastifyReply,
    context: ErrorContext
  ): void {
    // 🔍 Step 1: 诊断错误处理是否正确
    const diagnostics = ErrorSystemDiagnostics.diagnoseError(error, reply, {
      requestId: context.requestId,
      port: process.env.RCC_PORT ? parseInt(process.env.RCC_PORT) : 0, // 🔧 修复硬编码：0表示端口未知
      stage: context.stage,
      providerId: context.providerId,
      isStreaming: context.isStreaming
    });

    const errorInfo = this.analyzeError(error, context);
    
    // 强制控制台输出错误信息
    console.error(`🚨 [ERROR] ${context.stage.toUpperCase()} FAILURE:`);
    console.error(`   Request ID: ${context.requestId}`);
    console.error(`   Provider: ${context.providerId || 'unknown'}`);
    console.error(`   Model: ${context.model || 'unknown'}`);
    console.error(`   Status: ${errorInfo.statusCode}`);
    console.error(`   Error: ${errorInfo.message}`);
    console.error(`   Type: ${errorInfo.type}`);
    console.error(`   Streaming: ${context.isStreaming ? 'Yes' : 'No'}`);
    console.error(`   Silent Failure: ${diagnostics.isSilentFailure ? 'YES' : 'NO'}`);
    if (context.retryCount !== undefined) {
      console.error(`   Retries: ${context.retryCount}/${context.maxRetries || 0}`);
    }

    // 记录详细错误日志
    logger.error(`${context.stage} failed`, {
      requestId: context.requestId,
      providerId: context.providerId,
      model: context.model,
      statusCode: errorInfo.statusCode,
      errorType: errorInfo.type,
      errorMessage: errorInfo.message,
      isStreaming: context.isStreaming,
      retryCount: context.retryCount,
      maxRetries: context.maxRetries,
      stack: error instanceof Error ? error.stack : undefined
    }, context.requestId, 'error-handler');

    // 对于streaming请求的特殊处理
    if (context.isStreaming) {
      this.handleStreamingError(error, reply, context, errorInfo);
    } else {
      this.handleRegularError(error, reply, context, errorInfo);
    }
  }

  /**
   * 处理streaming错误
   */
  private static handleStreamingError(
    error: any,
    reply: FastifyReply,
    context: ErrorContext,
    errorInfo: { statusCode: number; type: string; message: string; details?: any }
  ): void {
    try {
      // 🔧 关键修复：检查HTTP响应是否已经结束，避免"write after end"错误
      if (reply.raw.writableEnded || reply.raw.destroyed) {
        console.error(`⚠️ [STREAMING] HTTP response already ended, cannot write error response`);
        console.error(`🔚 [STREAMING] Connection was already closed for request ${context.requestId}`);
        return;
      }

      // 设置HTTP状态码
      reply.code(errorInfo.statusCode);

      // 发送简化的错误事件，只包含必要信息
      const errorEvent = {
        type: 'error',
        error: {
          type: errorInfo.type,
          message: errorInfo.message,
          code: errorInfo.statusCode.toString(),
          // 只包含基本的provider和model信息
          details: {
            provider: context.providerId || 'unknown',
            model: context.model || 'unknown'
          }
        }
      };

      // 🔧 安全写入：检查每个写入步骤
      if (!reply.raw.writableEnded) {
        reply.raw.write(`event: error\n`);
        reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        
        // 确保连接关闭
        reply.raw.end();
        
        console.error(`🔚 [STREAMING] Connection closed with status ${errorInfo.statusCode}`);
      }

    } catch (writeError) {
      console.error(`❌ [STREAMING] Failed to write error response: ${writeError}`);
      // 如果无法写入响应，至少确保连接关闭
      try {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) {
          reply.raw.end();
        }
      } catch (endError) {
        console.error(`❌ [STREAMING] Failed to end connection: ${endError}`);
      }
    }
  }

  /**
   * 处理常规错误
   */
  private static handleRegularError(
    error: any,
    reply: FastifyReply,
    context: ErrorContext,
    errorInfo: { statusCode: number; type: string; message: string; details?: any }
  ): void {
    // 根据用户要求，简化错误响应，只包含必要信息
    const errorResponse: ErrorResponse = {
      error: {
        type: errorInfo.type,
        message: errorInfo.message,
        code: errorInfo.statusCode.toString(),
        // 只包含基本的provider和model信息，移除详细的调试信息
        details: {
          provider: context.providerId || 'unknown',
          model: context.model || 'unknown'
        }
      }
    };

    reply.code(errorInfo.statusCode).send(errorResponse);
    
    console.error(`🔚 [REGULAR] Response sent with status ${errorInfo.statusCode} - Provider: ${context.providerId}, Model: ${context.model}`);
  }

  /**
   * 分析错误并确定适当的状态码和类型
   */
  private static analyzeError(
    error: any,
    context: ErrorContext
  ): { statusCode: number; type: string; message: string; details?: any } {
    // ProviderError - 保持原始状态码，包含完整的上下文信息
    if (error instanceof ProviderError) {
      return {
        statusCode: error.statusCode,
        type: this.mapStatusCodeToType(error.statusCode),
        message: error.message,
        details: {
          provider: error.provider || context.providerId,
          model: context.model,
          stage: context.stage,
          requestId: context.requestId,
          originalError: error.details,
          errorCode: error.code,
          isStreaming: context.isStreaming,
          retryCount: context.retryCount,
          maxRetries: context.maxRetries,
          timestamp: new Date().toISOString()
        }
      };
    }

    // HTTP错误
    if (error?.response?.status) {
      const status = error.response.status;
      return {
        statusCode: status,
        type: this.mapStatusCodeToType(status),
        message: error.message || `HTTP ${status} error`,
        details: {
          httpStatus: status,
          responseData: error.response.data
        }
      };
    }

    // 网络错误
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      return {
        statusCode: 503,
        type: 'service_unavailable',
        message: `Network error: ${error.message}`,
        details: {
          networkError: error.code,
          provider: context.providerId
        }
      };
    }

    // 超时错误
    if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
      return {
        statusCode: 504,
        type: 'gateway_timeout',
        message: `Request timeout: ${error.message}`,
        details: {
          timeoutError: true,
          provider: context.providerId
        }
      };
    }

    // 认证错误
    if (error?.message?.includes('401') || error?.message?.includes('unauthorized')) {
      return {
        statusCode: 401,
        type: 'authentication_error',
        message: 'Authentication failed',
        details: {
          provider: context.providerId,
          authError: true
        }
      };
    }

    // 权限错误
    if (error?.message?.includes('403') || error?.message?.includes('forbidden')) {
      return {
        statusCode: 403,
        type: 'permission_error',
        message: 'Permission denied',
        details: {
          provider: context.providerId,
          permissionError: true
        }
      };
    }

    // 模型不存在错误
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      return {
        statusCode: 404,
        type: 'model_not_found',
        message: `Model or endpoint not found: ${error.message}`,
        details: {
          provider: context.providerId,
          model: context.model,
          stage: context.stage,
          requestId: context.requestId,
          notFoundError: true,
          originalError: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }

    // 速率限制错误
    if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
      return {
        statusCode: 429,
        type: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
        details: {
          provider: context.providerId,
          rateLimitError: true,
          retryCount: context.retryCount
        }
      };
    }

    // 多次重试失败
    if (context.retryCount !== undefined && context.retryCount >= (context.maxRetries || 0)) {
      return {
        statusCode: 500,
        type: 'max_retries_exceeded',
        message: `Request failed after ${context.retryCount} retries: ${error.message}`,
        details: {
          provider: context.providerId,
          model: context.model,
          stage: context.stage,
          requestId: context.requestId,
          retryCount: context.retryCount,
          maxRetries: context.maxRetries,
          finalError: error.message,
          originalError: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      };
    }

    // 默认内部服务器错误 - 包含完整的调试信息
    return {
      statusCode: 500,
      type: 'internal_server_error',
      message: error instanceof Error ? error.message : 'Internal server error',
      details: {
        provider: context.providerId,
        model: context.model,
        stage: context.stage,
        requestId: context.requestId,
        originalError: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        isStreaming: context.isStreaming,
        retryCount: context.retryCount,
        maxRetries: context.maxRetries,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }

  /**
   * 将HTTP状态码映射到错误类型
   */
  private static mapStatusCodeToType(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'bad_request';
      case 401: return 'authentication_error';
      case 403: return 'permission_error';
      case 404: return 'not_found';
      case 429: return 'rate_limit_exceeded';
      case 500: return 'internal_server_error';
      case 502: return 'bad_gateway';
      case 503: return 'service_unavailable';
      case 504: return 'gateway_timeout';
      default: return statusCode >= 500 ? 'server_error' : 'client_error';
    }
  }

  /**
   * 检查错误是否应该重试
   */
  static shouldRetry(error: any, currentRetry: number, maxRetries: number): boolean {
    if (currentRetry >= maxRetries) {
      return false;
    }

    // 不重试的错误类型
    const nonRetryableErrors = [400, 401, 403, 404];
    const statusCode = error?.response?.status || error?.status;
    
    if (nonRetryableErrors.includes(statusCode)) {
      return false;
    }

    // 可重试的错误类型
    const retryableErrors = [429, 500, 502, 503, 504];
    if (retryableErrors.includes(statusCode)) {
      return true;
    }

    // 网络错误可重试
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * 验证错误处理是否正确执行
   */
  static validateErrorHandling(
    error: any,
    reply: FastifyReply,
    context: ErrorContext
  ): void {
    // 确保reply已经设置了状态码
    if (!reply.statusCode || reply.statusCode === 200) {
      console.error(`⚠️  [VALIDATION] Error handler did not set proper status code!`);
      console.error(`   Context: ${JSON.stringify(context)}`);
      console.error(`   Error: ${error}`);
      
      // 强制设置500状态码
      reply.code(500);
    }

    // 记录验证信息
    logger.debug('Error handling validation completed', {
      requestId: context.requestId,
      statusCode: reply.statusCode,
      stage: context.stage,
      isStreaming: context.isStreaming
    }, context.requestId, 'error-handler');
  }
}

/**
 * 便捷函数：处理Provider错误
 */
export function handleProviderError(
  error: any,
  reply: FastifyReply,
  context: Omit<ErrorContext, 'stage'>
): void {
  UnifiedErrorHandler.handleError(error, reply, {
    ...context,
    stage: 'provider'
  });
}

/**
 * 便捷函数：处理Streaming错误
 */
export function handleStreamingError(
  error: any,
  reply: FastifyReply,
  context: Omit<ErrorContext, 'stage' | 'isStreaming'>
): void {
  UnifiedErrorHandler.handleError(error, reply, {
    ...context,
    stage: 'streaming',
    isStreaming: true
  });
}

/**
 * 便捷函数：处理路由错误
 */
export function handleRoutingError(
  error: any,
  reply: FastifyReply,
  context: Omit<ErrorContext, 'stage'>
): void {
  UnifiedErrorHandler.handleError(error, reply, {
    ...context,
    stage: 'routing'
  });
}

/**
 * 便捷函数：处理输入处理错误
 */
export function handleInputError(
  error: any,
  reply: FastifyReply,
  context: Omit<ErrorContext, 'stage'>
): void {
  UnifiedErrorHandler.handleError(error, reply, {
    ...context,
    stage: 'input-processing'
  });
}

/**
 * 便捷函数：处理输出处理错误
 */
export function handleOutputError(
  error: any,
  reply: FastifyReply,
  context: Omit<ErrorContext, 'stage'>
): void {
  UnifiedErrorHandler.handleError(error, reply, {
    ...context,
    stage: 'output-processing'
  });
}