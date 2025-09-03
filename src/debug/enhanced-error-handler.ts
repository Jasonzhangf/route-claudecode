/**
 * 增强错误处理器
 * 
 * 统一的错误处理接口，集成错误日志管理和分类功能
 * 
 * @author RCC v4.0 - Debug System Enhancement
 */

import { ErrorLogManager, ErrorLogEntry, ErrorType, getErrorLogManager } from './error-log-manager';
import { errorClassifier, ErrorClassification } from './error-classifier';
import { secureLogger } from '../utils/secure-logger';
import { RCCError } from '../types/error';

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  requestId: string;
  pipelineId?: string;
  layerName?: string;
  provider?: string;
  endpoint?: string;
  statusCode?: number;
  timeout?: number;
  responseTime?: number;
  attempt?: number;
  maxRetries?: number;
  isBufferError?: boolean;
  isLastAttempt?: boolean;
  protocol?: string;
  originalResponseId?: string;
  hasOriginalResponse?: boolean;
  totalTime?: number;
  layerTimings?: Record<string, number>;
  errorCount?: number;
  availablePipelines?: string[];
}

/**
 * 增强错误处理器
 */
export class EnhancedErrorHandler {
  private errorLogManager: ErrorLogManager;
  private initialized: boolean = false;

  constructor(serverPort?: number) {
    this.errorLogManager = getErrorLogManager(serverPort);
  }

  /**
   * 初始化增强错误处理器
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.errorLogManager.initialize();
      this.initialized = true;
      secureLogger.info('Enhanced error handler initialized');
    }
  }

  /**
   * 处理RCC错误
   */
  async handleRCCError(error: RCCError, context: ErrorContext): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const classification = this.classifyError(error.message, error.stack, context);
    
    const errorEntry: Omit<ErrorLogEntry, 'id' | 'timestamp'> = {
      requestId: context.requestId,
      pipelineId: context.pipelineId,
      errorType: classification.type,
      message: error.message,
      stack: error.stack,
      context,
      classification: {
        confidence: classification.confidence,
        matchedPattern: classification.matchedPattern,
        contextHints: classification.contextHints
      }
    };

    await this.errorLogManager.logError(errorEntry);

    secureLogger.debug('RCC error handled and logged', {
      requestId: context.requestId,
      errorType: classification.type,
      confidence: classification.confidence,
      pipelineId: context.pipelineId
    });
  }

  /**
   * 处理通用错误
   */
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const classification = this.classifyError(error.message, error.stack, context);
    
    const errorEntry: Omit<ErrorLogEntry, 'id' | 'timestamp'> = {
      requestId: context.requestId,
      pipelineId: context.pipelineId,
      errorType: classification.type,
      message: error.message,
      stack: error.stack,
      context,
      classification: {
        confidence: classification.confidence,
        matchedPattern: classification.matchedPattern,
        contextHints: classification.contextHints
      }
    };

    await this.errorLogManager.logError(errorEntry);

    secureLogger.debug('Error handled and logged', {
      requestId: context.requestId,
      errorType: classification.type,
      confidence: classification.confidence,
      pipelineId: context.pipelineId
    });
  }

  /**
   * 获取错误统计信息
   */
  getErrorStatistics() {
    if (!this.initialized) {
      return null;
    }
    return this.errorLogManager.getErrorStatistics();
  }

  /**
   * 生成错误摘要报告
   */
  async generateErrorSummary(startTime: number, endTime: number) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.errorLogManager.generateErrorSummary(startTime, endTime);
  }

  /**
   * 清理过期日志
   */
  async cleanupLogs(retentionDays: number): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.errorLogManager.cleanupLogs(retentionDays);
  }

  // ===== Private Helper Methods =====

  /**
   * 分类错误
   */
  private classifyError(message: string, stack?: string, context?: ErrorContext): ErrorClassification {
    // 提取额外的上下文信息用于分类
    const classificationContext: Record<string, any> = {
      ...context,
    };

    // 添加从上下文中推断的信息
    if (context?.layerName) {
      classificationContext.layerName = context.layerName;
    }

    if (context?.statusCode) {
      classificationContext.statusCode = context.statusCode;
    }

    if (context?.provider) {
      classificationContext.provider = context.provider;
    }

    return errorClassifier.classify(message, stack, classificationContext);
  }

  /**
   * 提取错误上下文信息
   */
  private extractContextFromError(error: Error): Record<string, any> {
    const context: Record<string, any> = {};

    // 从错误堆栈中提取模块信息
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      
      for (const line of stackLines) {
        if (line.includes('pipeline-request-processor')) {
          context.layerName = 'pipeline-request-processor';
          break;
        } else if (line.includes('pipeline-layers')) {
          context.layerName = 'pipeline-layers';
          break;
        } else if (line.includes('transformer')) {
          context.layerName = 'transformer';
          break;
        }
      }
    }

    // 从错误消息中提取信息
    if (error.message.includes('pipeline')) {
      context.category = 'pipeline';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      context.category = 'network';
    } else if (error.message.includes('timeout')) {
      context.category = 'timeout';
    }

    return context;
  }
}

// 导出端口特定的实例管理
const enhancedErrorHandlerInstances: Map<number, EnhancedErrorHandler> = new Map();
let defaultEnhancedErrorHandlerInstance: EnhancedErrorHandler | null = null;

export function getEnhancedErrorHandler(serverPort?: number): EnhancedErrorHandler {
  if (serverPort) {
    if (!enhancedErrorHandlerInstances.has(serverPort)) {
      enhancedErrorHandlerInstances.set(serverPort, new EnhancedErrorHandler(serverPort));
    }
    return enhancedErrorHandlerInstances.get(serverPort)!;
  } else {
    if (!defaultEnhancedErrorHandlerInstance) {
      defaultEnhancedErrorHandlerInstance = new EnhancedErrorHandler();
    }
    return defaultEnhancedErrorHandlerInstance;
  }
}