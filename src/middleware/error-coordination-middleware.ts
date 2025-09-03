/**
 * 错误处理协调中心中间件
 * 
 * 将错误处理协调中心集成到HTTP服务器中
 * 
 * @author RCC v4.0
 */

import { ErrorCoordinationCenterImpl } from '../core/error-coordination-center';
import { ErrorContext } from '../interfaces/core/error-coordination-center';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 错误处理协调中心中间件配置
 */
export interface ErrorCoordinationMiddlewareConfig {
  enableDetailedErrors?: boolean;
  defaultMaxRetries?: number;
  enableClientErrorReporting?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ErrorCoordinationMiddlewareConfig = {
  enableDetailedErrors: false,
  defaultMaxRetries: 3,
  enableClientErrorReporting: true
};

/**
 * 错误处理协调中心中间件类
 */
export class ErrorCoordinationMiddleware {
  private errorCoordinationCenter: ErrorCoordinationCenterImpl;
  private config: ErrorCoordinationMiddlewareConfig;

  constructor(
    errorCoordinationCenter: ErrorCoordinationCenterImpl,
    config?: ErrorCoordinationMiddlewareConfig
  ) {
    this.errorCoordinationCenter = errorCoordinationCenter;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 创建错误处理中间件函数
   * 
   * @returns 中间件函数
   */
  createMiddleware() {
    return async (req: any, res: any, next: Function) => {
      // 保存原始的res.json方法
      const originalJson = res.json;
      
      // 重写res.json方法以捕获错误
      res.json = (data: any) => {
        try {
          // 检查响应数据中是否包含错误信息
          if (data && data.error) {
            this.handleErrorResponse(data.error, req, res);
          } else {
            originalJson.call(res, data);
          }
        } catch (error) {
          this.handleInternalError(error, req, res);
        }
      };

      // 调用下一个中间件
      try {
        await next();
      } catch (error) {
        await this.handleError(error, req, res);
      }
    };
  }

  /**
   * 处理错误
   */
  private async handleError(error: any, req: any, res: any) {
    try {
      // 创建错误上下文
      const errorContext: ErrorContext = {
        requestId: req.id || this.generateRequestId(),
        pipelineId: req.pipelineId,
        layerName: req.layerName,
        provider: req.provider,
        model: req.model,
        endpoint: req.url,
        statusCode: res.statusCode,
        attemptNumber: req.attemptNumber || 0,
        maxAttempts: this.config.defaultMaxRetries || 3,
        isLastAttempt: (req.attemptNumber || 0) >= (this.config.defaultMaxRetries || 3),
        errorChain: req.errorChain || [],
        metadata: {
          method: req.method,
          url: req.url,
          userAgent: req.headers ? req.headers['user-agent'] : undefined,
          clientIp: req.clientIp,
          ...req.metadata
        }
      };

      // 记录错误链
      if (req.errorChain) {
        errorContext.errorChain.push({
          error: error.message || String(error),
          timestamp: new Date().toISOString(),
          context: errorContext
        });
      } else {
        errorContext.errorChain = [{
          error: error.message || String(error),
          timestamp: new Date().toISOString(),
          context: errorContext
        }];
      }

      // 使用错误处理协调中心处理错误
      const result = await this.errorCoordinationCenter.handleError(error, errorContext);

      // 根据处理结果执行相应操作
      switch (result.actionTaken) {
        case 'retry':
          // 设置重试信息并返回给客户端
          this.sendRetryResponse(res, result.retryAfter || 1000, errorContext);
          break;

        case 'switched':
          // 设置流水线切换信息
          this.sendPipelineSwitchResponse(res, result.switchedToPipeline!, errorContext);
          break;

        case 'destroyed':
          // 设置流水线销毁信息
          this.sendPipelineDestroyResponse(res, result.destroyedPipeline!, errorContext);
          break;

        case 'returned':
          // 发送格式化的错误响应
          const formattedError = this.errorCoordinationCenter.formatErrorResponse(
            error, 
            errorContext, 
            result.returnedError?.httpStatusCode
          );
          this.sendErrorResponse(res, formattedError, errorContext);
          break;

        default:
          // 默认发送内部错误响应
          this.sendInternalErrorResponse(res, errorContext);
      }
    } catch (handlingError) {
      // 如果错误处理过程中出现错误，发送基本的错误响应
      this.handleInternalError(handlingError, req, res);
    }
  }

  /**
   * 处理错误响应
   */
  private handleErrorResponse(errorData: any, req: any, res: any) {
    // 如果已经是格式化的错误响应，直接发送
    if (errorData && errorData.timestamp && errorData.requestId) {
      res.status(errorData.httpStatusCode || 500).json(errorData);
      return;
    }

    // 否则创建新的错误上下文并处理
    const errorContext: ErrorContext = {
      requestId: req.id || this.generateRequestId(),
      pipelineId: req.pipelineId,
      layerName: req.layerName,
      provider: req.provider,
      model: req.model,
      endpoint: req.url,
      statusCode: res.statusCode,
      attemptNumber: req.attemptNumber || 0,
      maxAttempts: this.config.defaultMaxRetries || 3,
      isLastAttempt: (req.attemptNumber || 0) >= (this.config.defaultMaxRetries || 3),
      errorChain: req.errorChain || [],
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers ? req.headers['user-agent'] : undefined,
        clientIp: req.clientIp,
        ...req.metadata
      }
    };

    const error = new Error(errorData.message || 'Unknown error');
    const formattedError = this.errorCoordinationCenter.formatErrorResponse(error, errorContext);
    this.sendErrorResponse(res, formattedError, errorContext);
  }

  /**
   * 处理内部错误
   */
  private handleInternalError(error: any, req: any, res: any) {
    const errorContext: ErrorContext = {
      requestId: req.id || this.generateRequestId(),
      pipelineId: req.pipelineId,
      layerName: req.layerName,
      provider: req.provider,
      model: req.model,
      endpoint: req.url,
      statusCode: 500,
      attemptNumber: req.attemptNumber || 0,
      maxAttempts: this.config.defaultMaxRetries || 3,
      isLastAttempt: false,
      errorChain: req.errorChain || [],
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers ? req.headers['user-agent'] : undefined,
        clientIp: req.clientIp,
        ...req.metadata
      }
    };

    const formattedError = {
      error: {
        message: 'Internal server error occurred during error handling',
        requestId: errorContext.requestId,
        timestamp: new Date().toISOString(),
        httpStatusCode: 500,
        ...(this.config.enableDetailedErrors ? {
          details: error.message || String(error),
          stack: error.stack
        } : {})
      }
    };

    this.sendErrorResponse(res, formattedError, errorContext);
  }

  /**
   * 发送重试响应
   */
  private sendRetryResponse(res: any, retryAfter: number, context: ErrorContext) {
    const response = {
      error: {
        message: 'Request should be retried',
        retryAfter,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        httpStatusCode: 429
      }
    };

    res.status(429).setHeader('Retry-After', retryAfter.toString()).json(response);
  }

  /**
   * 发送流水线切换响应
   */
  private sendPipelineSwitchResponse(res: any, newPipelineId: string, context: ErrorContext) {
    const response = {
      error: {
        message: 'Pipeline switched due to errors',
        switchedToPipeline: newPipelineId,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        httpStatusCode: 503
      }
    };

    res.status(503).json(response);
  }

  /**
   * 发送流水线销毁响应
   */
  private sendPipelineDestroyResponse(res: any, destroyedPipelineId: string, context: ErrorContext) {
    const response = {
      error: {
        message: 'Pipeline destroyed due to repeated failures',
        destroyedPipeline: destroyedPipelineId,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        httpStatusCode: 503
      }
    };

    res.status(503).json(response);
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(res: any, errorResponse: any, context: ErrorContext) {
    const httpStatusCode = errorResponse.error.httpStatusCode || 500;
    
    // 添加客户端友好的错误信息
    if (this.config.enableClientErrorReporting) {
      errorResponse.client = {
        message: this.getClientFriendlyMessage(errorResponse.error),
        suggestions: this.getErrorSuggestions(errorResponse.error),
        retry_info: {
          can_retry: this.isErrorRetryable(errorResponse.error),
          retry_after_seconds: this.getRetryDelay(errorResponse.error)
        }
      };
    }

    res.status(httpStatusCode).json(errorResponse);
  }

  /**
   * 发送内部错误响应
   */
  private sendInternalErrorResponse(res: any, context: ErrorContext) {
    const response = {
      error: {
        message: 'Internal server error',
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        httpStatusCode: 500,
        ...(this.config.enableDetailedErrors ? {
          details: 'An unexpected error occurred during request processing'
        } : {})
      }
    };

    res.status(500).json(response);
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取客户端友好的错误消息
   */
  private getClientFriendlyMessage(error: any): string {
    const httpStatusCode = error.httpStatusCode || 500;
    
    switch (httpStatusCode) {
      case 400:
        return 'Invalid request data provided';
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Resource not found';
      case 408:
        return 'Request timeout';
      case 429:
        return 'Too many requests, please try again later';
      case 500:
        return 'Service temporarily unavailable';
      case 502:
        return 'Bad gateway';
      case 503:
        return 'Service unavailable';
      case 504:
        return 'Gateway timeout';
      default:
        return 'An error occurred while processing your request';
    }
  }

  /**
   * 获取错误建议
   */
  private getErrorSuggestions(error: any): string[] {
    const httpStatusCode = error.httpStatusCode || 500;
    
    switch (httpStatusCode) {
      case 400:
        return [
          'Check your request data format',
          'Verify all required fields are provided',
          'Ensure data types are correct'
        ];
      case 401:
        return [
          'Check your authentication credentials',
          'Verify your API key or token',
          'Ensure your credentials have not expired'
        ];
      case 429:
        return [
          'Wait before making another request',
          'Implement exponential backoff in your client',
          'Consider batching multiple operations together'
        ];
      case 500:
      case 503:
        return [
          'Please try again in a few moments',
          'If the problem persists, contact technical support',
          'Check service status page for any ongoing issues'
        ];
      case 504:
        return [
          'This is a temporary connectivity issue, please retry',
          'Check your network connection',
          'Service may be under maintenance'
        ];
      default:
        return [
          'Please try again in a few moments',
          'If the problem persists, contact technical support'
        ];
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isErrorRetryable(error: any): boolean {
    const httpStatusCode = error.httpStatusCode || 500;
    
    return [408, 429, 500, 502, 503, 504].includes(httpStatusCode);
  }

  /**
   * 获取重试延迟时间
   */
  private getRetryDelay(error: any): number {
    const httpStatusCode = error.httpStatusCode || 500;
    
    switch (httpStatusCode) {
      case 429:
        return 60; // 限流错误等待60秒
      case 500:
      case 502:
      case 503:
      case 504:
        return 30; // 服务器错误等待30秒
      case 408:
        return 10; // 超时错误等待10秒
      default:
        return 30;
    }
  }
}