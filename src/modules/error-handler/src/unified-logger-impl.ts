/**
 * 统一日志记录器实现
 * 
 * 实现UnifiedLoggerInterface和LogManagerInterface接口
 * 集成现有的日志功能
 * 
 * @author Claude Code Router v4.0
 */

import { UnifiedLoggerInterface, LogManagerInterface, LogLevel, LogEntry } from './unified-logger-interface';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';
import { ErrorStatistics, ErrorSummaryReport } from '../../interfaces/core/error-coordination-center';
import * as fs from 'fs';
import * as path from 'path';
import { JQJsonHandler } from './utils/jq-json-handler';
import { secureLogger } from './utils/secure-logger';

/**
 * 统一日志记录器实现类
 */
export class UnifiedLogger implements UnifiedLoggerInterface {
  // ModuleInterface properties
  private moduleId = 'unified-logger';
  private moduleName = 'Unified Logger';
  private moduleVersion = '4.0.0';
  private moduleStatus: ModuleStatus;
  private moduleMetrics: ModuleMetrics;
  private connections = new Map<string, ModuleInterface>();
  private messageListeners = new Set<(sourceModuleId: string, message: unknown, type: string) => void>();
  private isStarted = false;

  private logLevel: LogLevel = 'info';
  private redactedFields: Set<string> = new Set([
    'apiKey', 'api_key', 'secret', 'password', 'token', 'auth', 'authorization',
    'access_token', 'refresh_token', 'client_secret', 'private_key'
  ]);

  constructor() {
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
   * 记录日志
   */
  log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 扩展元数据包含错误信息
    const extendedMetadata = { ...metadata };
    if (error) {
      extendedMetadata.error = error.message;
      extendedMetadata.stack = error.stack;
    }

    // 脱敏敏感信息
    const sanitizedMetadata = extendedMetadata ? this.sanitizeMetadata(extendedMetadata) : undefined;

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata: sanitizedMetadata,
    };

    // 输出到控制台
    this.outputToConsole(logEntry);

    // 更新指标
    this.moduleMetrics.requestsProcessed++;
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 添加需要脱敏的字段
   */
  addRedactedField(field: string): void {
    this.redactedFields.add(field.toLowerCase());
  }

  // === ModuleInterface implementation ===
  getId() { return this.moduleId; }
  getName() { return this.moduleName; }
  getType() { return ModuleType.DEBUG; }
  getVersion() { return this.moduleVersion; }
  getStatus() { return { ...this.moduleStatus }; }
  getMetrics() { return { ...this.moduleMetrics }; }

  async configure(config: Record<string, unknown>) { 
    this.moduleStatus.status = 'stopped'; 
  }

  async start() { 
    this.isStarted = true; 
    this.moduleStatus.status = 'running'; 
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
      healthy: true, 
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
   * 判断是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'audit'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 脱敏元数据中的敏感信息
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (this.redactedFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 输出日志到控制台
   */
  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const level = logEntry.level.toUpperCase().padEnd(7);
    const message = logEntry.message;
    
    let output = `[${timestamp}] ${level} ${message}`;
    
    if (logEntry.metadata) {
      output += ` ${JQJsonHandler.stringifyJson(logEntry.metadata)}`;
    }
    
    switch (logEntry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      case 'audit':
        // 审计日志使用info级别输出
        console.info(`[AUDIT] ${output}`);
        break;
      default:
        console.log(output);
    }
  }
}

/**
 * 日志管理器实现类
 */
export class LogManager implements LogManagerInterface {
  // ModuleInterface properties
  private moduleId = 'log-manager';
  private moduleName = 'Log Manager';
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

    this.basePath = this.expandHomePath(basePath);
    this.serverPort = serverPort;
  }

  /**
   * 记录错误日志
   */
  async logError(errorEntry: any): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 按类型保存
      await this.saveByType(errorEntry);
      
      // 按流水线保存（如果有流水线信息）
      if (errorEntry.pipelineId) {
        await this.saveByPipeline(errorEntry);
      }
      
      secureLogger.debug('Error logged successfully', {
        errorId: errorEntry.id,
        errorType: errorEntry.errorType,
        pipelineId: errorEntry.pipelineId
      });
    } catch (error) {
      secureLogger.error('Failed to log error', {
        error: error.message,
        errorEntry: errorEntry
      });
    }
  }

  /**
   * 获取错误统计信息
   */
  getErrorStatistics(timeRangeHours: number = 24): ErrorStatistics | null {
    if (!this.initialized) {
      return null;
    }
    
    const endTime = Date.now();
    const startTime = endTime - (timeRangeHours * 60 * 60 * 1000);

    // 统计实现
    const stats: ErrorStatistics = {
      totalErrors: 0,
      errorsByType: {} as Record<string, number>,
      timeRange: { startTime, endTime }
    };

    // 初始化错误类型计数
    const errorTypes = ['SERVER_ERROR', 'FILTER_ERROR', 'SOCKET_ERROR', 'TIMEOUT_ERROR', 
                       'PIPELINE_ERROR', 'CONNECTION_ERROR', 'TRANSFORM_ERROR', 'AUTH_ERROR',
                       'VALIDATION_ERROR', 'RATE_LIMIT_ERROR', 'UNKNOWN_ERROR'];
    errorTypes.forEach(type => {
      stats.errorsByType[type] = 0;
    });

    try {
      const typeDir = path.join(this.basePath, 'errors', 'by-type');
      if (fs.existsSync(typeDir)) {
        const typeFiles = fs.readdirSync(typeDir);
        
        for (const typeFile of typeFiles) {
          if (!typeFile.endsWith('.json')) continue;
          
          const filePath = path.join(typeDir, typeFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const errors: any[] = JQJsonHandler.parseJsonString(fileContent);
          
          errors.forEach(error => {
            if (error.timestamp >= startTime && error.timestamp <= endTime) {
              stats.totalErrors++;
              if (stats.errorsByType[error.errorType] !== undefined) {
                stats.errorsByType[error.errorType]++;
              } else {
                stats.errorsByType[error.errorType] = 1;
              }
            }
          });
        }
      }
      
      return stats;
    } catch (error) {
      secureLogger.error('Failed to get error statistics', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * 生成错误摘要报告
   */
  async generateErrorSummary(startTime: number, endTime: number): Promise<ErrorSummaryReport> {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const report: ErrorSummaryReport = {
      timeframe: 'custom',
      timeRange: { startTime, endTime },
      statistics: {
        totalErrors: 0,
        errorsByType: {} as Record<string, number>
      },
      topErrors: [],
      problemPipelines: [],
      recommendations: []
    };

    // 初始化错误类型计数
    const errorTypes = ['SERVER_ERROR', 'FILTER_ERROR', 'SOCKET_ERROR', 'TIMEOUT_ERROR', 
                       'PIPELINE_ERROR', 'CONNECTION_ERROR', 'TRANSFORM_ERROR', 'AUTH_ERROR',
                       'VALIDATION_ERROR', 'RATE_LIMIT_ERROR', 'UNKNOWN_ERROR'];
    errorTypes.forEach(type => {
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
          const errors: any[] = JQJsonHandler.parseJsonString(fileContent);
          
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
      report.topErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [errorType, message] = key.split(':', 2);
          return {
            type: errorType,
            count,
            percentage: report.statistics.totalErrors > 0 ? (count / report.statistics.totalErrors) * 100 : 0,
            message: message
          };
        });

      // 生成问题流水线
      report.problemPipelines = Array.from(pipelineCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([pipelineId, errorCount]) => ({
          pipelineId,
          errorCount,
          errorRate: report.statistics.totalErrors > 0 ? errorCount / report.statistics.totalErrors : 0
        }));

      // 生成建议
      report.recommendations = this.generateRecommendations(report.statistics);

      // 保存报告
      await this.saveReport({
        reportId,
        timeframe: report.timeframe,
        timeRange: report.timeRange,
        statistics: report.statistics,
        topErrors: report.topErrors,
        problemPipelines: report.problemPipelines,
        recommendations: report.recommendations
      });

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
   */
  async cleanupLogs(retentionDays: number): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    try {
      const typeDir = path.join(this.basePath, 'errors', 'by-type');
      if (fs.existsSync(typeDir)) {
        const typeFiles = fs.readdirSync(typeDir);
        
        for (const typeFile of typeFiles) {
          if (!typeFile.endsWith('.json')) continue;
          
          const filePath = path.join(typeDir, typeFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const errors: any[] = JQJsonHandler.parseJsonString(fileContent);
          
          const validErrors = errors.filter(error => error.timestamp >= cutoffTime);
          cleanedCount += errors.length - validErrors.length;
          
          if (validErrors.length !== errors.length) {
            fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(validErrors, false));
          }
        }
      }

      secureLogger.info('Error log cleanup completed', {
        retentionDays,
        cleanedCount,
        cutoffTime
      });

      return cleanedCount;
    } catch (error) {
      secureLogger.error('Failed to cleanup error logs', {
        error: error.message
      });
      throw error;
    }
  }

  // === ModuleInterface implementation ===
  getId() { return this.moduleId; }
  getName() { return this.moduleName; }
  getType() { return ModuleType.DEBUG; }
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
   * 初始化日志管理器
   */
  private async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryStructure();
      this.initialized = true;
      secureLogger.info('Log manager initialized', {
        basePath: this.basePath
      });
    } catch (error) {
      secureLogger.error('Failed to initialize log manager', {
        error: error.message,
        basePath: this.basePath
      });
      throw error;
    }
  }

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

  private async saveByType(entry: any): Promise<void> {
    const errorBasePath = this.serverPort 
      ? path.join(this.basePath, `port-${this.serverPort}`, 'errors')
      : path.join(this.basePath, 'errors');
    const typeFile = path.join(errorBasePath, 'by-type', `${entry.errorType.toLowerCase()}.json`);
    
    let entries: any[] = [];
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

  private async saveByPipeline(entry: any): Promise<void> {
    if (!entry.pipelineId) return;
    
    const errorBasePath = this.serverPort 
      ? path.join(this.basePath, `port-${this.serverPort}`, 'errors')
      : path.join(this.basePath, 'errors');
    const pipelineFile = path.join(errorBasePath, 'by-pipeline', `${entry.pipelineId}.json`);
    
    let entries: any[] = [];
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

  private async saveReport(report: any): Promise<void> {
    const reportFile = path.join(this.basePath, 'errors', 'summaries', `${report.reportId}.json`);
    fs.writeFileSync(reportFile, JQJsonHandler.stringifyJson(report, false));
  }

  private generateRecommendations(statistics: any): any[] {
    const recommendations: any[] = [];

    // 检查高频错误
    if (statistics.errorsByType['FILTER_ERROR'] > 10) {
      recommendations.push({
        type: 'config',
        priority: 'high',
        message: 'High number of filter errors detected. Review array initialization and null safety in pipeline code.'
      });
    }

    if (statistics.errorsByType['SOCKET_ERROR'] > 15) {
      recommendations.push({
        type: 'monitoring',
        priority: 'high',
        message: 'Frequent socket errors indicate network connectivity issues. Check provider endpoints.'
      });
    }

    return recommendations;
  }
}

/**
 * 统一日志工厂类
 */
export class UnifiedLoggerFactory {
  /**
   * 创建统一日志记录器实例
   */
  static createLogger(): UnifiedLogger {
    return new UnifiedLogger();
  }

  /**
   * 创建日志管理器实例
   */
  static createLogManager(basePath?: string, serverPort?: number): LogManager {
    return new LogManager(basePath, serverPort);
  }
}