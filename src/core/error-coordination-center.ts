/**
 * 错误处理协调中心实现
 * 
 * 统一的错误处理协调器，负责：
 * 1. 错误分类和处理策略决策
 * 2. 流水线切换和销毁管理
 * 3. 统一错误响应格式化
 * 4. 与负载均衡中心集成
 * 
 * @author RCC v4.0
 */

import { 
  ErrorCoordinationCenter, 
  ErrorCoordinationConfig, 
  ErrorContext, 
  ErrorHandlingStrategy, 
  ErrorClassification, 
  ErrorHandlingResult,
  PipelineManagerInterface,
  LoadBalancerInterface
} from '../interfaces/core/error-coordination-center';
import { ErrorType } from '../debug/error-log-manager';
import { RCCError, ERROR_CODES, NetworkError, TimeoutError, RateLimitError } from '../types/error';
import { ErrorLogger } from '../debug/error-logger';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ErrorCoordinationConfig = {
  enableRetryHandling: true,
  maxRetryAttempts: 3,
  retryDelayStrategy: 'exponential',
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  enablePipelineSwitching: true,
  enablePipelineDestruction: true,
  enableErrorClassification: true,
  enableLoadBalancerIntegration: true
};

/**
 * 错误处理协调中心实现类
 */
export class ErrorCoordinationCenterImpl implements ErrorCoordinationCenter {
  private config: ErrorCoordinationConfig;
  private pipelineManager: PipelineManagerInterface | null = null;
  private loadBalancer: LoadBalancerInterface | null = null;
  private errorLogger: ErrorLogger;
  private errorStats: Map<ErrorType, number> = new Map();
  private totalErrors: number = 0;

  constructor(
    config?: Partial<ErrorCoordinationConfig>,
    pipelineManager?: PipelineManagerInterface,
    loadBalancer?: LoadBalancerInterface
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pipelineManager = pipelineManager || null;
    this.loadBalancer = loadBalancer || null;
    this.errorLogger = new ErrorLogger();
    
    // 初始化错误统计
    Object.values(ErrorType).forEach(type => {
      this.errorStats.set(type, 0);
    });
  }

  /**
   * 处理错误并返回处理结果
   */
  async handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    try {
      // 1. 分类错误
      const classification = this.classifyError(error, context);
      
      // 2. 记录错误日志
      await this.errorLogger.logError(error, context, classification);
      
      // 3. 确定处理策略
      const strategy = this.determineStrategy(error, classification, context);
      
      // 4. 执行策略
      const result = await this.executeStrategy(strategy, context);
      
      // 5. 记录处理结果
      this.errorLogger.logHandlingResult(result, context);
      
      return result;
    } catch (handlingError) {
      // 如果错误处理过程中出现错误，返回基础错误处理结果
      const result: ErrorHandlingResult = {
        success: false,
        actionTaken: 'returned',
        returnedError: {
          message: 'Error occurred during error handling',
          originalError: error.message,
          handlingError: handlingError instanceof Error ? handlingError.message : String(handlingError)
        },
        error: handlingError instanceof Error ? handlingError : new Error(String(handlingError)),
        context
      };
      
      // 记录处理错误
      this.errorLogger.logHandlingResult(result, context);
      
      return result;
    }
  }

  /**
   * 分类错误类型
   */
  classifyError(error: Error, context: ErrorContext): ErrorClassification {
    if (!this.config.enableErrorClassification) {
      return {
        type: ErrorType.UNKNOWN_ERROR,
        confidence: 0,
        matchedPattern: 'classification_disabled',
        isRetryable: false,
        isFatal: false,
        requiresPipelineSwitch: false,
        requiresPipelineDestruction: false
      };
    }

    // 基于错误类型和消息内容进行分类
    const errorType = this.determineErrorType(error, context);
    const isRetryable = this.isErrorRetryable(error, errorType);
    const isFatal = this.isErrorFatal(error, errorType);
    const requiresPipelineSwitch = this.requiresPipelineSwitch(error, errorType);
    const requiresPipelineDestruction = this.requiresPipelineDestruction(error, errorType);
    
    // 增加统计计数
    this.totalErrors++;
    const currentCount = this.errorStats.get(errorType) || 0;
    this.errorStats.set(errorType, currentCount + 1);

    return {
      type: errorType,
      confidence: this.calculateClassificationConfidence(error, errorType),
      matchedPattern: this.getMatchedPattern(error, errorType),
      contextHints: this.getContextHints(error, errorType),
      isRetryable,
      isFatal,
      requiresPipelineSwitch,
      requiresPipelineDestruction
    };
  }

  /**
   * 确定错误处理策略
   */
  determineStrategy(error: Error, classification: ErrorClassification, context: ErrorContext): ErrorHandlingStrategy {
    // 如果是致命错误，直接返回错误
    if (classification.isFatal) {
      return {
        type: 'return_error',
        returnHttpCode: 500,
        returnErrorDetails: {
          message: error.message,
          type: classification.type,
          fatal: true
        }
      };
    }

    // 检查是否达到最大重试次数
    if (context.attemptNumber >= context.maxAttempts) {
      // 如果启用了流水线切换且需要切换，则切换流水线
      if (this.config.enablePipelineSwitching && classification.requiresPipelineSwitch && this.loadBalancer) {
        const allPipelines = this.pipelineManager ? Array.from(this.pipelineManager.getAllPipelines().keys()) : [];
        const healthyPipelines = this.loadBalancer.getHealthyPipelines(allPipelines);
        const availablePipelines = healthyPipelines.filter(p => p !== context.pipelineId);
        
        if (availablePipelines.length > 0) {
          const selectedPipeline = this.loadBalancer.selectPipeline(availablePipelines);
          return {
            type: 'switch_pipeline',
            switchToPipeline: selectedPipeline
          };
        }
      }
      
      // 如果启用了流水线销毁且需要销毁，则销毁流水线
      if (this.config.enablePipelineDestruction && classification.requiresPipelineDestruction && context.pipelineId) {
        return {
          type: 'destroy_pipeline',
          destroyReason: `Too many failures for pipeline ${context.pipelineId}`,
          returnHttpCode: 503
        };
      }
      
      // 默认返回错误
      return {
        type: 'return_error',
        returnHttpCode: this.getHttpStatusCodeForError(classification.type),
        returnErrorDetails: {
          message: error.message,
          type: classification.type,
          maxRetriesExceeded: true
        }
      };
    }

    // 如果是可重试错误且启用了重试，则重试
    if (this.config.enableRetryHandling && classification.isRetryable) {
      const delay = this.calculateRetryDelay(context.attemptNumber);
      return {
        type: 'retry',
        retryAfter: delay
      };
    }

    // 如果需要流水线切换且启用了切换，则切换流水线
    if (this.config.enablePipelineSwitching && classification.requiresPipelineSwitch && this.loadBalancer) {
      const allPipelines = this.pipelineManager ? Array.from(this.pipelineManager.getAllPipelines().keys()) : [];
      const healthyPipelines = this.loadBalancer.getHealthyPipelines(allPipelines);
      const availablePipelines = healthyPipelines.filter(p => p !== context.pipelineId);
      
      if (availablePipelines.length > 0) {
        const selectedPipeline = this.loadBalancer.selectPipeline(availablePipelines);
        return {
          type: 'switch_pipeline',
          switchToPipeline: selectedPipeline
        };
      }
    }

    // 默认返回错误
    return {
      type: 'return_error',
      returnHttpCode: this.getHttpStatusCodeForError(classification.type),
      returnErrorDetails: {
        message: error.message,
        type: classification.type
      }
    };
  }

  /**
   * 执行错误处理策略
   */
  async executeStrategy(strategy: ErrorHandlingStrategy, context: ErrorContext): Promise<ErrorHandlingResult> {
    switch (strategy.type) {
      case 'retry':
        return {
          success: true,
          actionTaken: 'retry',
          retryAfter: strategy.retryAfter,
          context
        };

      case 'switch_pipeline':
        // 在实际实现中，这里会通知路由管理器切换到新的流水线
        return {
          success: true,
          actionTaken: 'switched',
          switchedToPipeline: strategy.switchToPipeline,
          context
        };

      case 'destroy_pipeline':
        if (context.pipelineId && this.pipelineManager) {
          try {
            await this.pipelineManager.destroyPipeline(context.pipelineId);
            return {
              success: true,
              actionTaken: 'destroyed',
              destroyedPipeline: context.pipelineId,
              context
            };
          } catch (destroyError) {
            return {
              success: false,
              actionTaken: 'returned',
              returnedError: {
                message: 'Failed to destroy pipeline',
                pipelineId: context.pipelineId,
                error: destroyError instanceof Error ? destroyError.message : String(destroyError)
              },
              error: destroyError instanceof Error ? destroyError : new Error(String(destroyError)),
              context
            };
          }
        }
        return {
          success: false,
          actionTaken: 'returned',
          returnedError: {
            message: 'Pipeline destruction requested but no pipeline ID provided or pipeline manager unavailable'
          },
          context
        };

      case 'return_error':
        return {
          success: true,
          actionTaken: 'returned',
          returnedError: strategy.returnErrorDetails,
          context
        };

      default:
        return {
          success: false,
          actionTaken: 'ignored',
          returnedError: {
            message: 'Unknown error handling strategy',
            strategy: strategy.type
          },
          context
        };
    }
  }

  /**
   * 格式化错误响应
   */
  formatErrorResponse(error: Error, context: ErrorContext, httpStatusCode?: number): any {
    return {
      error: {
        message: error.message,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        pipelineId: context.pipelineId,
        layerName: context.layerName,
        provider: context.provider,
        model: context.model,
        httpStatusCode: httpStatusCode || 500,
        ...(error instanceof RCCError ? {
          code: error.code,
          module: error.module,
          context: error.context
        } : {})
      }
    };
  }

  /**
   * 记录错误日志
   */
  async logError(error: Error, context: ErrorContext, classification: ErrorClassification): Promise<void> {
    // 使用错误日志记录器记录错误
    await this.errorLogger.logError(error, context, classification);
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): any {
    return {
      totalErrors: this.totalErrors,
      errorDistribution: Object.fromEntries(this.errorStats),
      config: this.config
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.errorStats.forEach((_, key) => {
      this.errorStats.set(key, 0);
    });
    this.totalErrors = 0;
  }

  // --- 私有辅助方法 ---

  /**
   * 确定错误类型
   */
  private determineErrorType(error: Error, context: ErrorContext): ErrorType {
    // 如果是RCCError，根据code确定类型
    if (error instanceof RCCError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
        case ERROR_CODES.CONNECTION_FAILED:
        case ERROR_CODES.CONNECTION_TIMEOUT:
        case ERROR_CODES.CONNECTION_REFUSED:
          return ErrorType.CONNECTION_ERROR;
        case 'TIMEOUT_ERROR':
        case ERROR_CODES.REQUEST_TIMEOUT:
        case ERROR_CODES.OPERATION_TIMEOUT:
          return ErrorType.TIMEOUT_ERROR;
        case 'RATE_LIMIT_ERROR':
        case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        case ERROR_CODES.QUOTA_EXCEEDED:
          return ErrorType.RATE_LIMIT_ERROR;
        case 'AUTH_ERROR':
        case ERROR_CODES.AUTH_FAILED:
        case ERROR_CODES.TOKEN_EXPIRED:
        case ERROR_CODES.PERMISSION_DENIED:
          return ErrorType.AUTH_ERROR;
        case 'VALIDATION_ERROR':
        case ERROR_CODES.INVALID_INPUT:
        case ERROR_CODES.INVALID_FORMAT:
        case ERROR_CODES.VALIDATION_FAILED:
          return ErrorType.VALIDATION_ERROR;
        case 'PIPELINE_ERROR':
        case ERROR_CODES.PIPELINE_INIT_FAILED:
        case ERROR_CODES.PIPELINE_EXECUTION_FAILED:
        case ERROR_CODES.MODULE_NOT_FOUND:
          return ErrorType.PIPELINE_ERROR;
        case 'TRANSFORM_ERROR':
        case ERROR_CODES.TRANSFORM_FAILED:
        case ERROR_CODES.UNSUPPORTED_FORMAT:
          return ErrorType.TRANSFORM_ERROR;
        case 'CONFIG_ERROR':
        case ERROR_CODES.CONFIG_MISSING:
        case ERROR_CODES.CONFIG_INVALID:
        case ERROR_CODES.CONFIG_LOAD_FAILED:
          return ErrorType.VALIDATION_ERROR;
        default:
          return ErrorType.UNKNOWN_ERROR;
      }
    }

    // 基于错误消息内容判断
    const message = error.message.toLowerCase();
    
    if (error instanceof NetworkError || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('connect') ||
        message.includes('econn') ||
        message.includes('socket')) {
      return ErrorType.CONNECTION_ERROR;
    }
    
    if (error instanceof TimeoutError || 
        message.includes('timeout') || 
        message.includes('etimedout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    
    if (error instanceof RateLimitError || 
        message.includes('rate limit') || 
        message.includes('quota exceeded')) {
      return ErrorType.RATE_LIMIT_ERROR;
    }
    
    if (message.includes('unauthorized') || 
        message.includes('forbidden') || 
        message.includes('auth')) {
      return ErrorType.AUTH_ERROR;
    }
    
    if (message.includes('validation') || 
        message.includes('invalid') || 
        message.includes('required')) {
      return ErrorType.VALIDATION_ERROR;
    }
    
    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * 判断错误是否可重试
   */
  private isErrorRetryable(error: Error, errorType: ErrorType): boolean {
    // 网络错误、超时错误和限流错误通常可重试
    const retryableTypes = [
      ErrorType.CONNECTION_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.RATE_LIMIT_ERROR
    ];
    
    return retryableTypes.includes(errorType);
  }

  /**
   * 判断错误是否致命
   */
  private isErrorFatal(error: Error, errorType: ErrorType): boolean {
    // 配置错误和验证错误通常致命
    const fatalTypes = [
      ErrorType.VALIDATION_ERROR
    ];
    
    return fatalTypes.includes(errorType);
  }

  /**
   * 判断是否需要流水线切换
   */
  private requiresPipelineSwitch(error: Error, errorType: ErrorType): boolean {
    // 网络错误、超时错误和限流错误可能需要切换流水线
    const switchTypes = [
      ErrorType.CONNECTION_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.RATE_LIMIT_ERROR
    ];
    
    return switchTypes.includes(errorType);
  }

  /**
   * 判断是否需要销毁流水线
   */
  private requiresPipelineDestruction(error: Error, errorType: ErrorType): boolean {
    // 严重的网络错误或持续的超时错误可能需要销毁流水线
    const destroyTypes = [
      ErrorType.CONNECTION_ERROR
    ];
    
    return destroyTypes.includes(errorType);
  }

  /**
   * 计算分类置信度
   */
  private calculateClassificationConfidence(error: Error, errorType: ErrorType): number {
    // 简单实现，基于错误类型确定置信度
    if (error instanceof RCCError) {
      return 0.9; // RCCError有明确的错误码，置信度高
    }
    
    switch (errorType) {
      case ErrorType.CONNECTION_ERROR:
      case ErrorType.TIMEOUT_ERROR:
      case ErrorType.RATE_LIMIT_ERROR:
        return 0.8;
      case ErrorType.AUTH_ERROR:
      case ErrorType.VALIDATION_ERROR:
        return 0.7;
      default:
        return 0.5;
    }
  }

  /**
   * 获取匹配的模式
   */
  private getMatchedPattern(error: Error, errorType: ErrorType): string {
    if (error instanceof RCCError) {
      return `RCCError:${error.code}`;
    }
    
    switch (errorType) {
      case ErrorType.CONNECTION_ERROR:
        return 'network_error_pattern';
      case ErrorType.TIMEOUT_ERROR:
        return 'timeout_error_pattern';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'rate_limit_error_pattern';
      case ErrorType.AUTH_ERROR:
        return 'auth_error_pattern';
      case ErrorType.VALIDATION_ERROR:
        return 'validation_error_pattern';
      default:
        return 'unknown_pattern';
    }
  }

  /**
   * 获取上下文提示
   */
  private getContextHints(error: Error, errorType: ErrorType): string[] {
    const hints: string[] = [];
    
    switch (errorType) {
      case ErrorType.CONNECTION_ERROR:
        hints.push('Check network connectivity', 'Verify endpoint availability');
        break;
      case ErrorType.TIMEOUT_ERROR:
        hints.push('Increase timeout values', 'Check server response time');
        break;
      case ErrorType.RATE_LIMIT_ERROR:
        hints.push('Implement exponential backoff', 'Check rate limiting configuration');
        break;
      case ErrorType.AUTH_ERROR:
        hints.push('Verify authentication credentials', 'Check token expiration');
        break;
      case ErrorType.VALIDATION_ERROR:
        hints.push('Check input data format', 'Validate required fields');
        break;
    }
    
    return hints;
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    switch (this.config.retryDelayStrategy) {
      case 'fixed':
        return this.config.baseRetryDelay;
      case 'exponential':
        return Math.min(
          this.config.baseRetryDelay * Math.pow(2, attempt - 1),
          this.config.maxRetryDelay
        );
      case 'adaptive':
        // 简单的自适应策略，可以根据错误类型调整
        return Math.min(
          this.config.baseRetryDelay * attempt,
          this.config.maxRetryDelay
        );
      default:
        return this.config.baseRetryDelay;
    }
  }

  /**
   * 获取错误对应的HTTP状态码
   */
  private getHttpStatusCodeForError(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.AUTH_ERROR:
        return 401; // Unauthorized
      case ErrorType.VALIDATION_ERROR:
        return 400; // Bad Request
      case ErrorType.RATE_LIMIT_ERROR:
        return 429; // Too Many Requests
      case ErrorType.TIMEOUT_ERROR:
        return 408; // Request Timeout
      case ErrorType.CONNECTION_ERROR:
        return 503; // Service Unavailable
      default:
        return 500; // Internal Server Error
    }
  }
}