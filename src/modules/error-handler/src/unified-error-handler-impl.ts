/**
 * 统一错误处理器实现
 * 
 * 实现UnifiedErrorHandlerInterface接口
 * 集成现有的错误处理功能
 * 
 * @author Claude Code Router v4.0
 */

import { UnifiedErrorHandlerInterface } from './unified-error-handler-interface';
import { RCCError, RCCErrorCode, ErrorContext } from '../../types/src';
import { ErrorClassification, UnifiedErrorResponse, ErrorStatistics, ErrorSummaryReport } from '../../interfaces/core/error-coordination-center';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';
import { ErrorLogManager, getErrorLogManager, ErrorType } from './error-log-manager';
import { errorClassifier } from './error-classifier';
import { secureLogger } from './utils/secure-logger';
import { JQJsonHandler } from './utils/jq-json-handler';

/**
 * 统一错误处理器实现类
 */
export class UnifiedErrorHandler implements UnifiedErrorHandlerInterface {
  // ModuleInterface properties
  private moduleId = 'unified-error-handler';
  private moduleName = 'Unified Error Handler';
  private moduleVersion = '4.0.0';
  private moduleStatus: ModuleStatus;
  private moduleMetrics: ModuleMetrics;
  private connections = new Map<string, ModuleInterface>();
  private messageListeners = new Set<(sourceModuleId: string, message: unknown, type: string) => void>();
  private isStarted = false;

  private errorLogManager: ErrorLogManager;
  private initialized: boolean = false;

  constructor(serverPort?: number) {
    // Initialize ModuleInterface properties
    this.moduleStatus = {
      id: this.moduleId,
      name: this.moduleName,
      type: ModuleType.ERROR_HANDLER,
      status: 'stopped',
      health: 'healthy'
    };
    this.moduleMetrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    this.errorLogManager = getErrorLogManager(serverPort);
  }

  /**
   * 处理错误并记录
   */
  async handleError(error: Error | RCCError, context?: ErrorContext): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 使用错误分类器分类错误
      const classification = this.classifyError(error, context);
      
      // 创建错误日志条目
      const errorEntry = {
        requestId: context?.requestId || 'unknown',
        pipelineId: context?.pipelineId,
        errorType: this.mapErrorType(classification.type),
        message: error.message,
        stack: error.stack,
        context: {
          ...context,
          moduleId: (error as RCCError).module,
          errorCode: (error as RCCError).code || RCCErrorCode.UNKNOWN_ERROR,
          errorContext: (error as RCCError).context,
          errorType: error.constructor.name
        },
        classification: {
          confidence: classification.confidence || 0.5,
          matchedPattern: classification.matchedPattern || 'generic',
          contextHints: classification.contextHints || []
        }
      };

      // 记录错误日志
      await this.errorLogManager.logError(errorEntry);

      // 使用安全日志记录器记录调试信息
      secureLogger.debug('Error handled and logged', {
        requestId: context?.requestId,
        errorType: classification.type,
        errorCode: (error as RCCError).code || RCCErrorCode.UNKNOWN_ERROR,
        moduleId: (error as RCCError).module,
        errorClassName: error.constructor.name,
        confidence: classification.confidence,
        pipelineId: context?.pipelineId
      });

      // 更新指标
      this.moduleMetrics.requestsProcessed++;
    } catch (handleError) {
      secureLogger.error('Failed to handle error', {
        error: handleError instanceof Error ? handleError.message : String(handleError),
        originalError: error.message
      });
    }
  }

  /**
   * 分类错误
   */
  classifyError(error: Error | RCCError, context?: ErrorContext): ErrorClassification {
    // 提取额外的上下文信息用于分类
    const classificationContext: Record<string, any> = {
      ...context,
    };

    // 添加从上下文中推断的信息
    if (context?.layerName) {
      classificationContext.layerName = context.layerName;
    }

    if (context?.provider) {
      classificationContext.provider = context.provider;
    }

    // 使用现有的错误分类器进行分类
    const classifierResult = errorClassifier.classify(error.message, error.stack, classificationContext);
    
    // 转换为统一的ErrorClassification接口
    return {
      category: 'INTERNAL',
      severity: 'medium',
      type: classifierResult.type,
      recoverable: true,
      confidence: classifierResult.confidence,
      matchedPattern: classifierResult.matchedPattern,
      contextHints: classifierResult.contextHints
    };
  }

  /**
   * 生成统一错误响应
   */
  generateResponse(error: Error | RCCError, provider: string): UnifiedErrorResponse {
    return {
      error: true,
      code: (error as RCCError).code || 'UNKNOWN_ERROR',
      message: error.message || String(error),
      details: {
        type: error.constructor?.name || 'unknown',
        provider: provider
      },
      timestamp: new Date().toISOString()
    };
  }

  // === ModuleInterface implementation ===
  getId() { return this.moduleId; }
  getName() { return this.moduleName; }
  getType() { return ModuleType.ERROR_HANDLER; }
  getVersion() { return this.moduleVersion; }
  getStatus() { return { ...this.moduleStatus }; }
  getMetrics() { return { ...this.moduleMetrics }; }

  async configure(config: Record<string, unknown>) { 
    this.moduleStatus.status = 'stopped'; 
  }

  async start() { 
    this.isStarted = true; 
    this.moduleStatus.status = 'running'; 
    await this.initialize(); 
  }

  async stop() { 
    this.isStarted = false; 
    this.moduleStatus.status = 'stopped'; 
  }

  async process(input: unknown) { 
    this.moduleMetrics.requestsProcessed++; 
    return input; 
  }

  async reset() { 
    this.moduleMetrics = { 
      requestsProcessed: 0, 
      averageProcessingTime: 0, 
      errorRate: 0, 
      memoryUsage: 0, 
      cpuUsage: 0 
    }; 
  }

  async cleanup() { 
    this.connections.clear(); 
    this.messageListeners.clear(); 
  }

  async healthCheck() { 
    return { 
      healthy: this.initialized, 
      details: { status: this.moduleStatus } 
    }; 
  }

  addConnection(module: ModuleInterface) { 
    this.connections.set(module.getId(), module); 
  }

  removeConnection(moduleId: string) { 
    this.connections.delete(moduleId); 
  }

  getConnection(moduleId: string) { 
    return this.connections.get(moduleId); 
  }

  getConnections() { 
    return Array.from(this.connections.values()); 
  }

  getConnectionStatus(targetModuleId: string) { 
    return this.connections.has(targetModuleId) ? 'connected' : 'disconnected'; 
  }

  async sendToModule(targetModuleId: string, message: unknown, type?: string) { 
    return message; 
  }

  async broadcastToModules(message: unknown, type?: string) { }

  onModuleMessage(listener: (sourceModuleId: string, message: unknown, type: string) => void) { 
    this.messageListeners.add(listener); 
  }

  validateConnection(targetModule: ModuleInterface) { 
    return true; 
  }

  removeAllListeners(event?: string | symbol) { 
    if (!event) this.messageListeners.clear(); 
    return this; 
  }

  /**
   * 映射错误类型
   */
  private mapErrorType(type: string): ErrorType {
    switch (type) {
      case 'SERVER_ERROR':
        return ErrorType.SERVER_ERROR;
      case 'FILTER_ERROR':
        return ErrorType.FILTER_ERROR;
      case 'SOCKET_ERROR':
        return ErrorType.SOCKET_ERROR;
      case 'TIMEOUT_ERROR':
        return ErrorType.TIMEOUT_ERROR;
      case 'PIPELINE_ERROR':
        return ErrorType.PIPELINE_ERROR;
      case 'CONNECTION_ERROR':
        return ErrorType.CONNECTION_ERROR;
      case 'TRANSFORM_ERROR':
        return ErrorType.TRANSFORM_ERROR;
      case 'AUTH_ERROR':
        return ErrorType.AUTH_ERROR;
      case 'VALIDATION_ERROR':
        return ErrorType.VALIDATION_ERROR;
      case 'RATE_LIMIT_ERROR':
        return ErrorType.RATE_LIMIT_ERROR;
      default:
        return ErrorType.UNKNOWN_ERROR;
    }
  }

  /**
   * 初始化错误处理器
   */
  private async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.errorLogManager.initialize();
      this.initialized = true;
      secureLogger.info('Unified error handler initialized');
    }
  }
}

/**
 * 统一错误处理器工厂类
 */
export class UnifiedErrorHandlerFactory {
  /**
   * 创建统一错误处理器实例
   */
  static createErrorHandler(serverPort?: number): UnifiedErrorHandler {
    return new UnifiedErrorHandler(serverPort);
  }
}