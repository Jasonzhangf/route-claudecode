/**
 * 统一的 Finish Reason 日志系统
 * 项目所有者: Jason Zhang
 * 
 * 消除重复日志记录，提供端到端的finish_reason跟踪
 */

import { logger } from '@/utils/logger';

export interface FinishReasonLogEntry {
  requestId: string;
  stage: 'input' | 'routing' | 'transformation' | 'output' | 'streaming';
  sourceFormat: string;
  targetFormat?: string;
  originalReason?: string;
  mappedReason?: string;
  provider: string;
  model: string;
  timestamp: string;
  context: string;
  metadata?: Record<string, any>;
  errorInfo?: {
    type: 'mapping_failed' | 'unknown_reason' | 'conversion_error';
    message: string;
    shouldRetry?: boolean;
  };
}

class UnifiedFinishReasonLogger {
  private logEntries: Map<string, FinishReasonLogEntry[]> = new Map();

  /**
   * 记录finish reason转换的完整过程
   */
  logFinishReasonTransformation(entry: FinishReasonLogEntry): void {
    const requestEntries = this.logEntries.get(entry.requestId) || [];
    requestEntries.push(entry);
    this.logEntries.set(entry.requestId, requestEntries);

    // 根据情况决定日志级别
    if (entry.errorInfo) {
      logger.error(`🚨 [FINISH-REASON-ERROR] ${entry.errorInfo.type}: ${entry.errorInfo.message}`, {
        stage: entry.stage,
        originalReason: entry.originalReason,
        mappedReason: entry.mappedReason,
        provider: entry.provider,
        model: entry.model,
        context: entry.context,
        shouldRetry: entry.errorInfo.shouldRetry,
        metadata: entry.metadata
      }, entry.requestId, 'finish-reason-stage');
    } else if (!entry.mappedReason && entry.originalReason) {
      logger.warn(`⚠️  [FINISH-REASON-UNMAPPED] Original reason preserved without mapping`, {
        stage: entry.stage,
        originalReason: entry.originalReason,
        provider: entry.provider,
        model: entry.model,
        context: entry.context,
        metadata: entry.metadata
      }, entry.requestId, 'finish-reason-stage');
    } else {
      logger.info(`✅ [FINISH-REASON-SUCCESS] ${entry.originalReason} → ${entry.mappedReason}`, {
        stage: entry.stage,
        sourceFormat: entry.sourceFormat,
        targetFormat: entry.targetFormat,
        provider: entry.provider,
        model: entry.model,
        context: entry.context,
        metadata: entry.metadata
      }, entry.requestId, 'finish-reason-stage');
    }
  }

  /**
   * 生成请求的完整finish reason跟踪报告
   */
  generateEndToEndReport(requestId: string): string {
    const entries = this.logEntries.get(requestId) || [];
    if (entries.length === 0) {
      return `No finish reason tracking data found for request ${requestId}`;
    }

    const report = [`🔍 [FINISH-REASON-TRACE] End-to-End tracking for ${requestId}:`];
    
    entries.forEach((entry, index) => {
      const errorMark = entry.errorInfo ? '❌' : '✅';
      const mapping = entry.mappedReason 
        ? `${entry.originalReason} → ${entry.mappedReason}`
        : entry.originalReason || 'undefined';
        
      report.push(
        `  ${index + 1}. ${errorMark} [${entry.stage}] ${mapping} (${entry.context})`
      );
      
      if (entry.errorInfo) {
        report.push(`     Error: ${entry.errorInfo.message}`);
      }
    });

    // 清理已完成请求的记录，防止内存泄漏
    setTimeout(() => {
      this.logEntries.delete(requestId);
    }, 60000); // 1分钟后清理

    return report.join('\n');
  }

  /**
   * 检查是否存在静默失败
   */
  detectSilentFailures(requestId: string): {
    hasSilentFailure: boolean;
    issues: string[];
  } {
    const entries = this.logEntries.get(requestId) || [];
    const issues: string[] = [];

    // 检查是否有映射失败但没有错误报告
    entries.forEach(entry => {
      if (entry.originalReason && !entry.mappedReason && !entry.errorInfo) {
        issues.push(`Stage ${entry.stage}: ${entry.originalReason} was not mapped and no error was reported`);
      }
    });

    // 检查是否有不完整的转换链
    const stages = entries.map(e => e.stage);
    const expectedStages: Array<'input' | 'transformation' | 'output'> = ['input', 'transformation', 'output'];
    const missingStages = expectedStages.filter(stage => !stages.includes(stage));
    
    if (missingStages.length > 0) {
      issues.push(`Missing stages in finish reason chain: ${missingStages.join(', ')}`);
    }

    return {
      hasSilentFailure: issues.length > 0,
      issues
    };
  }

  /**
   * 在请求完成时生成最终报告并检查问题
   */
  finalizeRequest(requestId: string): void {
    const report = this.generateEndToEndReport(requestId);
    const silentFailureCheck = this.detectSilentFailures(requestId);

    logger.info(report, {}, requestId, 'finish-reason-final');

    if (silentFailureCheck.hasSilentFailure) {
      logger.error(`🚨 [SILENT-FAILURE-DETECTED] Request ${requestId} has potential silent failures:`, {
        issues: silentFailureCheck.issues
      }, requestId, 'finish-reason-silent-failure');
    }
  }
}

// 单例实例
export const unifiedFinishReasonLogger = new UnifiedFinishReasonLogger();

/**
 * 便捷方法：记录输入阶段的finish reason
 */
export function logInputFinishReason(
  requestId: string,
  originalReason: string | undefined,
  provider: string,
  model: string,
  context: string,
  metadata?: Record<string, any>
) {
  unifiedFinishReasonLogger.logFinishReasonTransformation({
    requestId,
    stage: 'input',
    sourceFormat: provider,
    originalReason,
    provider,
    model,
    timestamp: new Date().toISOString(),
    context,
    metadata
  });
}

/**
 * 便捷方法：记录转换阶段的finish reason
 */
export function logTransformationFinishReason(
  requestId: string,
  originalReason: string | undefined,
  mappedReason: string | undefined,
  sourceFormat: string,
  targetFormat: string,
  provider: string,
  model: string,
  context: string,
  metadata?: Record<string, any>,
  errorInfo?: FinishReasonLogEntry['errorInfo']
) {
  unifiedFinishReasonLogger.logFinishReasonTransformation({
    requestId,
    stage: 'transformation',
    sourceFormat,
    targetFormat,
    originalReason,
    mappedReason,
    provider,
    model,
    timestamp: new Date().toISOString(),
    context,
    metadata,
    errorInfo
  });
}

/**
 * 便捷方法：记录输出阶段的finish reason
 */
export function logOutputFinishReason(
  requestId: string,
  finalReason: string | undefined,
  provider: string,
  model: string,
  context: string,
  metadata?: Record<string, any>
) {
  unifiedFinishReasonLogger.logFinishReasonTransformation({
    requestId,
    stage: 'output',
    sourceFormat: provider,
    originalReason: finalReason,
    provider,
    model,
    timestamp: new Date().toISOString(),
    context,
    metadata
  });
}

/**
 * 便捷方法：记录流式处理阶段的finish reason
 */
export function logStreamingFinishReason(
  requestId: string,
  originalReason: string | undefined,
  mappedReason: string | undefined,
  sourceFormat: string,
  targetFormat: string,
  provider: string,
  model: string,
  context: string,
  metadata?: Record<string, any>,
  errorInfo?: FinishReasonLogEntry['errorInfo']
) {
  unifiedFinishReasonLogger.logFinishReasonTransformation({
    requestId,
    stage: 'streaming',
    sourceFormat,
    targetFormat,
    originalReason,
    mappedReason,
    provider,
    model,
    timestamp: new Date().toISOString(),
    context,
    metadata,
    errorInfo
  });
}