/**
 * 错误跟踪器 - 专门处理错误日志和分析
 * 整合原有的PipelineDebugger错误处理功能
 */

import { UnifiedLogger } from './unified-logger';

export interface ToolCallError {
  requestId: string;
  errorMessage: string;
  transformationStage: string;
  provider: string;
  model: string;
  context: any;
  port: number;
}

export interface StandardizedError {
  port: number;
  provider: string;
  model: string;
  key: string;
  errorCode: number;
  reason: string;
  requestId: string;
}

export class ErrorTracker {
  private logger: UnifiedLogger;
  private recentErrors: Array<{ timestamp: number; error: any }> = [];
  private maxRecentErrors: number = 100;

  constructor(logger: UnifiedLogger) {
    this.logger = logger;
  }

  logToolCallError(error: ToolCallError): void {
    const errorData = {
      type: 'tool_call_error',
      ...error,
      timestamp: Date.now()
    };

    this.addToRecentErrors(errorData);
    
    this.logger.logToolCall(
      `Tool call error: ${error.errorMessage}`,
      {
        transformationStage: error.transformationStage,
        provider: error.provider,
        model: error.model,
        context: error.context,
        port: error.port
      },
      error.requestId,
      'error'
    );
  }

  logStandardizedError(error: StandardizedError): void {
    const errorData = {
      type: 'standardized_error',
      ...error,
      key: this.redactKey(error.key),
      timestamp: Date.now()
    };

    this.addToRecentErrors(errorData);

    this.logger.error(
      `Provider error: ${error.reason}`,
      {
        provider: error.provider,
        model: error.model,
        errorCode: error.errorCode,
        key: this.redactKey(error.key),
        port: error.port
      },
      error.requestId,
      'provider_error'
    );
  }

  logGeneralError(
    message: string,
    error: Error | any,
    requestId?: string,
    stage?: string,
    context?: any
  ): void {
    const errorData = {
      type: 'general_error',
      message,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      requestId,
      stage,
      context,
      timestamp: Date.now()
    };

    this.addToRecentErrors(errorData);

    this.logger.error(message, {
      error: errorData.error,
      stage,
      context
    }, requestId, stage);
  }

  detectToolCallInText(
    text: string,
    requestId: string,
    transformationStage: string,
    provider: string,
    model: string
  ): boolean {
    // 严格检测完整的工具调用结构
    const toolCallPatterns = [
      /\{\s*"type"\s*:\s*"tool_use"\s*,\s*"id"\s*:\s*"[^"]+"\s*,\s*"name"\s*:\s*"[^"]+"/i,
      /\{\s*"id"\s*:\s*"call_[a-zA-Z0-9_-]+"\s*,\s*"type"\s*:\s*"function"/i,
      /"tool_calls"\s*:\s*\[\s*\{\s*"id"\s*:\s*"call_/i
    ];

    for (const pattern of toolCallPatterns) {
      if (pattern.test(text)) {
        this.logToolCallError({
          requestId,
          errorMessage: `Tool call structure detected in text context`,
          transformationStage,
          provider,
          model,
          context: { textSnippet: text.substring(0, 200) },
          port: this.logger['config'].port
        });
        return true;
      }
    }

    return false;
  }

  private redactKey(key: string): string {
    if (!key || key.length <= 8) return '****';
    return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
  }

  private addToRecentErrors(error: any): void {
    this.recentErrors.push({ timestamp: Date.now(), error });
    
    // 保持最近错误数量限制
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(-this.maxRecentErrors);
    }
  }

  getRecentErrors(count: number = 10): any[] {
    return this.recentErrors
      .slice(-count)
      .reverse()
      .map(item => item.error);
  }

  getErrorStats(): any {
    const stats = {
      totalErrors: this.recentErrors.length,
      errorTypes: {} as Record<string, number>,
      recentErrorsCount: 0
    };

    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const item of this.recentErrors) {
      const errorType = item.error.type || 'unknown';
      stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
      
      if (item.timestamp > oneHourAgo) {
        stats.recentErrorsCount++;
      }
    }

    return stats;
  }

  clearOldErrors(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs;
    const originalLength = this.recentErrors.length;
    
    this.recentErrors = this.recentErrors.filter(item => item.timestamp > cutoffTime);
    
    return originalLength - this.recentErrors.length;
  }
}