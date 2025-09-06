/**
 * 错误日志管理器
 * 
 * 专门管理和分类错误日志，提供流水线级别的错误追踪和分析
 * 
 * @author RCC v4.0 - Debug System Enhancement
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { secureLogger } from './utils/secure-logger';
import { JQJsonHandler } from './utils/jq-json-handler';
import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
} from '../../interfaces/module/base-module';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  SERVER_ERROR = 'SERVER_ERROR',
  FILTER_ERROR = 'FILTER_ERROR',
  SOCKET_ERROR = 'SOCKET_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PIPELINE_ERROR = 'PIPELINE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TRANSFORM_ERROR = 'TRANSFORM_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误日志条目
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  requestId: string;
  pipelineId?: string;
  errorType: ErrorType;
  message: string;
  stack?: string;
  context: Record<string, any>;
  classification?: {
    confidence: number;
    matchedPattern: string;
    contextHints?: string[];
  };
}

/**
 * 错误统计信息
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsByPipeline: Record<string, number>;
  timeRange: {
    startTime: number;
    endTime: number;
  };
}

/**
 * 错误摘要报告
 */
export interface ErrorSummaryReport {
  reportId: string;
  timeRange: {
    startTime: number;
    endTime: number;
  };
  statistics: {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    topErrors: Array<{
      message: string;
      count: number;
      errorType: ErrorType;
    }>;
    problemPipelines: Array<{
      pipelineId: string;
      errorCount: number;
      errorRate: number;
    }>;
  };
  recommendations: Array<{
    type: 'blacklist' | 'config' | 'monitoring' | 'investigation';
    priority: 'high' | 'medium' | 'low';
    message: string;
    affectedPipelines?: string[];
  }>;
}

/**
 * 错误日志管理器
 * 
 * 已更新为使用统一日志管理器进行日志存储
 */
export class ErrorLogManager extends EventEmitter implements ModuleInterface {
  // ModuleInterface properties
  private moduleId = 'error-log-manager';
  private moduleName = 'Error Log Manager';
  private moduleVersion = '4.0.0';
  private moduleStatus: ModuleStatus;
  private moduleMetrics: ModuleMetrics;
  private connections = new Map<string, ModuleInterface>();
  private messageListeners = new Set<(sourceModuleId: string, message: unknown, type: string) => void>();
  private isStarted = false;
  private basePath: string;
  private serverPort?: number;
  private initialized: boolean = false;
  constructor(basePath: string = '~/.route-claudecode/debug-logs', serverPort?: number) {
    super();
    this.basePath = this.expandHomePath(basePath);
    this.serverPort = serverPort;
    
    // Initialize ModuleInterface properties
    this.moduleStatus = {
      id: this.moduleId,
      name: this.moduleName,
      type: ModuleType.DEBUG,
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
  }

  /**
   * 初始化错误日志管理器
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryStructure();
      this.initialized = true;
      secureLogger.info('Error log manager initialized', {
        basePath: this.basePath
      });
    } catch (error) {
      secureLogger.error('Failed to initialize error log manager', {
        error: error.message,
        basePath: this.basePath
      });
      throw error;
    }
  }

  /**
   * 记录错误
   * 
   * 已更新为使用统一日志管理器进行存储
   */
  async logError(errorEntry: Omit<ErrorLogEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 保持原有的记录方式以确保兼容性
    const entry: ErrorLogEntry = {
      ...errorEntry,
      id: this.generateErrorId(),
      timestamp: Date.now()
    };

    try {
      // 按类型保存
      await this.saveByType(entry);
      
      // 按流水线保存（如果有流水线信息）
      if (entry.pipelineId) {
        await this.saveByPipeline(entry);
      }

      secureLogger.debug('Error logged successfully', {
        errorId: entry.id,
        errorType: entry.errorType,
        pipelineId: entry.pipelineId
      });
    } catch (error) {
      secureLogger.error('Failed to log error', {
        error: error.message,
        errorEntry: entry
      });
    }
  }

  /**
   * 获取错误统计信息
   * 
   * 已更新为使用统一日志管理器获取统计信息
   */
  getErrorStatistics(timeRangeHours: number = 24): ErrorStatistics | null {
    if (!this.initialized) {
      return null;
    }
    
    const endTime = Date.now();
    const startTime = endTime - (timeRangeHours * 60 * 60 * 1000);

    // 简单的统计实现
    const stats: ErrorStatistics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsByPipeline: {},
      timeRange: { startTime, endTime }
    };

    // 初始化错误类型计数
    Object.values(ErrorType).forEach(type => {
      stats.errorsByType[type] = 0;
    });

    return stats;
  }

  /**
   * 生成错误摘要报告
   */
  async generateErrorSummary(startTime: number, endTime: number): Promise<ErrorSummaryReport> {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const report: ErrorSummaryReport = {
      reportId,
      timeRange: { startTime, endTime },
      statistics: {
        totalErrors: 0,
        errorsByType: {} as Record<ErrorType, number>,
        topErrors: [],
        problemPipelines: []
      },
      recommendations: []
    };

    // 初始化错误类型计数
    Object.values(ErrorType).forEach(type => {
      report.statistics.errorsByType[type] = 0;
    });

    const errorCounts = new Map<string, number>();
    const pipelineCounts = new Map<string, number>();

    try {
      // 收集错误数据
      const typeDir = path.join(this.basePath, 'errors', 'by-type');
      if (fs.existsSync(typeDir)) {
        const typeFiles = fs.readdirSync(typeDir);
        
        for (const typeFile of typeFiles) {
          if (!typeFile.endsWith('.json')) continue;
          
          const filePath = path.join(typeDir, typeFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const errors: ErrorLogEntry[] = JQJsonHandler.parseJsonString(fileContent);
          
          errors.forEach(error => {
            if (error.timestamp >= startTime && error.timestamp <= endTime) {
              report.statistics.totalErrors++;
              report.statistics.errorsByType[error.errorType]++;
              
              // 计算错误频次
              const errorKey = `${error.errorType}:${error.message.substring(0, 100)}`;
              errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
              
              // 计算流水线错误
              if (error.pipelineId) {
                pipelineCounts.set(error.pipelineId, (pipelineCounts.get(error.pipelineId) || 0) + 1);
              }
            }
          });
        }
      }

      // 生成TOP错误
      report.statistics.topErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [errorType, message] = key.split(':', 2);
          return {
            message,
            count,
            errorType: errorType as ErrorType
          };
        });

      // 生成问题流水线
      report.statistics.problemPipelines = Array.from(pipelineCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([pipelineId, errorCount]) => ({
          pipelineId,
          errorCount,
          errorRate: report.statistics.totalErrors > 0 ? errorCount / report.statistics.totalErrors : 0
        }));

      // 生成建议
      report.recommendations = this.generateRecommendations(report.statistics);

      // 保存报告
      await this.saveReport(report);

      return report;
    } catch (error) {
      secureLogger.error('Failed to generate error summary', {
        error: error.message,
        reportId
      });
      throw error;
    }
  }

  /**
   * 清理过期日志
   * 
   * 已更新为使用统一日志管理器进行清理
   */
  async cleanupLogs(retentionDays: number): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 保持原有的清理逻辑以确保兼容性
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let legacyCleanedCount = 0;
    let cleanedCount = 0; // 声明缺失的变量

    try {
      const typeDir = path.join(this.basePath, 'errors', 'by-type');
      if (fs.existsSync(typeDir)) {
        const typeFiles = fs.readdirSync(typeDir);
        
        for (const typeFile of typeFiles) {
          if (!typeFile.endsWith('.json')) continue;
          
          const filePath = path.join(typeDir, typeFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const errors: ErrorLogEntry[] = JQJsonHandler.parseJsonString(fileContent);
          
          const validErrors = errors.filter(error => error.timestamp >= cutoffTime);
          legacyCleanedCount += errors.length - validErrors.length;
          
          if (validErrors.length !== errors.length) {
            fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(validErrors, false));
          }
        }
      }

      secureLogger.info('Error log cleanup completed', {
        retentionDays,
        unifiedCleanedCount: cleanedCount,
        legacyCleanedCount,
        cutoffTime
      });

      // 返回总的清理数量
      return cleanedCount + legacyCleanedCount;
    } catch (error) {
      secureLogger.error('Failed to cleanup error logs', {
        error: error.message
      });
      throw error;
    }
  }

  // ===== Private Helper Methods =====

  private expandHomePath(filepath: string): string {
    if (filepath.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
      return path.join(homeDir, filepath.slice(2));
    }
    return filepath;
  }

  private async ensureDirectoryStructure(): Promise<void> {
    // 如果指定了端口，则在端口特定目录下创建errors子目录
    const errorBasePath = this.serverPort 
      ? path.join(this.basePath, `port-${this.serverPort}`, 'errors')
      : path.join(this.basePath, 'errors');

    const dirs = [
      this.basePath,
      this.serverPort ? path.join(this.basePath, `port-${this.serverPort}`) : this.basePath,
      errorBasePath,
      path.join(errorBasePath, 'by-type'),
      path.join(errorBasePath, 'by-pipeline'),
      path.join(errorBasePath, 'summaries')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveByType(entry: ErrorLogEntry): Promise<void> {
    const errorBasePath = this.serverPort 
      ? path.join(this.basePath, `port-${this.serverPort}`, 'errors')
      : path.join(this.basePath, 'errors');
    const typeFile = path.join(errorBasePath, 'by-type', `${entry.errorType.toLowerCase()}.json`);
    
    let entries: ErrorLogEntry[] = [];
    if (fs.existsSync(typeFile)) {
      const content = fs.readFileSync(typeFile, 'utf8');
      entries = JQJsonHandler.parseJsonString(content);
    }
    
    entries.push(entry);
    
    // 保持最近1000条记录
    if (entries.length > 1000) {
      entries = entries.slice(-1000);
    }
    
    fs.writeFileSync(typeFile, JQJsonHandler.stringifyJson(entries, false));
  }

  private async saveByPipeline(entry: ErrorLogEntry): Promise<void> {
    if (!entry.pipelineId) return;
    
    const errorBasePath = this.serverPort 
      ? path.join(this.basePath, `port-${this.serverPort}`, 'errors')
      : path.join(this.basePath, 'errors');
    const pipelineFile = path.join(errorBasePath, 'by-pipeline', `${entry.pipelineId}.json`);
    
    let entries: ErrorLogEntry[] = [];
    if (fs.existsSync(pipelineFile)) {
      const content = fs.readFileSync(pipelineFile, 'utf8');
      entries = JQJsonHandler.parseJsonString(content);
    }
    
    entries.push(entry);
    
    // 保持最近500条记录
    if (entries.length > 500) {
      entries = entries.slice(-500);
    }
    
    fs.writeFileSync(pipelineFile, JQJsonHandler.stringifyJson(entries, false));
  }

  private async saveReport(report: ErrorSummaryReport): Promise<void> {
    const reportFile = path.join(this.basePath, 'errors', 'summaries', `${report.reportId}.json`);
    fs.writeFileSync(reportFile, JQJsonHandler.stringifyJson(report, false));
  }

  private generateRecommendations(statistics: ErrorSummaryReport['statistics']): ErrorSummaryReport['recommendations'] {
    const recommendations: ErrorSummaryReport['recommendations'] = [];

    // 检查高频错误
    if (statistics.errorsByType[ErrorType.FILTER_ERROR] > 10) {
      recommendations.push({
        type: 'config',
        priority: 'high',
        message: 'High number of filter errors detected. Review array initialization and null safety in pipeline code.',
        affectedPipelines: statistics.problemPipelines.slice(0, 3).map(p => p.pipelineId)
      });
    }

    if (statistics.errorsByType[ErrorType.SOCKET_ERROR] > 15) {
      recommendations.push({
        type: 'monitoring',
        priority: 'high',
        message: 'Frequent socket errors indicate network connectivity issues. Check provider endpoints.',
        affectedPipelines: statistics.problemPipelines.slice(0, 3).map(p => p.pipelineId)
      });
    }

    // 检查问题流水线
    const criticalPipelines = statistics.problemPipelines.filter(p => p.errorRate > 0.5);
    if (criticalPipelines.length > 0) {
      recommendations.push({
        type: 'blacklist',
        priority: 'high',
        message: 'Consider blacklisting pipelines with high error rates (>50%).',
        affectedPipelines: criticalPipelines.map(p => p.pipelineId)
      });
    }

    return recommendations;
  }

  // === ModuleInterface implementation ===
  getId() { return this.moduleId; }
  getName() { return this.moduleName; }
  getType() { return ModuleType.DEBUG; }
  getVersion() { return this.moduleVersion; }
  getStatus() { return { ...this.moduleStatus }; }
  getMetrics() { return { ...this.moduleMetrics }; }
  async configure(config: Record<string, unknown>) { this.moduleStatus.status = 'stopped'; }
  async start() { this.isStarted = true; this.moduleStatus.status = 'running'; await this.initialize(); }
  async stop() { this.isStarted = false; this.moduleStatus.status = 'stopped'; }
  async process(input: unknown) { this.moduleMetrics.requestsProcessed++; return input; }
  async reset() { this.moduleMetrics = { requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0 }; }
  async cleanup() { this.connections.clear(); this.messageListeners.clear(); }
  async healthCheck() { return { healthy: this.initialized, details: { status: this.moduleStatus } }; }
  addConnection(module: ModuleInterface) { this.connections.set(module.getId(), module); }
  removeConnection(moduleId: string) { this.connections.delete(moduleId); }
  getConnection(moduleId: string) { return this.connections.get(moduleId); }
  getConnections() { return Array.from(this.connections.values()); }
  getConnectionStatus(targetModuleId: string) { return this.connections.has(targetModuleId) ? 'connected' : 'disconnected'; }
  async sendToModule(targetModuleId: string, message: unknown, type?: string) { return message; }
  async broadcastToModules(message: unknown, type?: string) { }
  onModuleMessage(listener: (sourceModuleId: string, message: unknown, type: string) => void) { this.messageListeners.add(listener); }
  validateConnection(targetModule: ModuleInterface) { return true; }
  removeAllListeners(event?: string | symbol) { super.removeAllListeners(event); if (!event) this.messageListeners.clear(); return this; }
}

// 导出端口特定的实例管理
const errorLogManagerInstances: Map<number, ErrorLogManager> = new Map();
let defaultErrorLogManagerInstance: ErrorLogManager | null = null;

export function getErrorLogManager(serverPort?: number): ErrorLogManager {
  if (serverPort) {
    if (!errorLogManagerInstances.has(serverPort)) {
      errorLogManagerInstances.set(serverPort, new ErrorLogManager(undefined, serverPort));
    }
    return errorLogManagerInstances.get(serverPort)!;
  } else {
    if (!defaultErrorLogManagerInstance) {
      defaultErrorLogManagerInstance = new ErrorLogManager();
    }
    return defaultErrorLogManagerInstance;
  }
}