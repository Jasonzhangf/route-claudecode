/**
 * 统一日志系统 - 项目唯一日志入口
 * 整合所有现有日志功能，提供统一接口
 * Project Owner: Jason Zhang
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogCategory = 'request' | 'response' | 'pipeline' | 'error' | 'performance' | 'system' | 'tool_call' | 'streaming';

interface LogEntry {
  timestamp: string;
  beijingTime: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  port: number;
  requestId?: string;
  stage?: string;
  duration?: number;
}

interface LoggerConfig {
  port: number;
  logLevel?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  baseDir?: string;
  rotationMinutes?: number;
  maxRetentionDays?: number;
}

export class UnifiedLogger {
  private config: Required<LoggerConfig>;
  private logDir: string;
  private currentRotationDir: string = '';
  private lastRotationTime: number = 0;
  private initialized: boolean = false;

  constructor(config: LoggerConfig) {
    this.config = {
      port: config.port,
      logLevel: config.logLevel || 'info',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? true,
      baseDir: config.baseDir || path.join(os.homedir(), '.route-claude-code', 'logs'),
      rotationMinutes: config.rotationMinutes || 5,
      maxRetentionDays: config.maxRetentionDays || 7
    };

    this.logDir = path.join(this.config.baseDir, `port-${this.config.port}`);
    // 异步初始化，但不等待完成
    this.initialize().catch(error => {
      console.error('Failed to initialize unified logger:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.logDir, { recursive: true });
      this.updateRotationDir();
      await fs.mkdir(this.currentRotationDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize unified logger:', error);
    }
  }

  private updateRotationDir(): void {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timeStr = beijingTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.currentRotationDir = path.join(this.logDir, timeStr);
    this.lastRotationTime = Date.now();
  }

  private async ensureRotation(): Promise<void> {
    const rotationInterval = this.config.rotationMinutes * 60 * 1000;
    if (Date.now() - this.lastRotationTime > rotationInterval) {
      this.updateRotationDir();
      await fs.mkdir(this.currentRotationDir, { recursive: true });
    }
  }

  private getBeijingTime(): string {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return beijingTime.toISOString().replace('T', ' ').slice(0, 19);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.config.logLevel];
  }

  private formatEntry(
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: any,
    requestId?: string,
    stage?: string,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      beijingTime: this.getBeijingTime(),
      level,
      category,
      message,
      data,
      port: this.config.port,
      requestId,
      stage,
      duration
    };
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.config.enableFile) return;

    try {
      // 确保初始化完成
      if (!this.initialized) {
        await this.initialize();
      }
      
      await this.ensureRotation();
      const filename = `${entry.category}.log`;
      const filepath = path.join(this.currentRotationDir, filename);
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(filepath, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const { beijingTime, level, category, message, stage, duration, requestId } = entry;
    const timeShort = beijingTime.split(' ')[1];
    
    let output = `[${timeShort}] [${level.toUpperCase()}] [${category}]`;
    if (requestId) output += ` [${requestId}]`;
    if (stage) output += ` [${stage}]`;
    output += ` ${message}`;
    if (duration) output += ` (${duration}ms)`;

    switch (level) {
      case 'error': console.error(output); break;
      case 'warn': console.warn(output); break;
      default: console.log(output); break;
    }
  }

  // 核心日志方法
  log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: any,
    requestId?: string,
    stage?: string,
    duration?: number
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(category, level, message, data, requestId, stage, duration);
    this.outputToConsole(entry);
    // Fix: Properly handle async writeToFile operation
    this.writeToFile(entry).catch(error => {
      console.error('Failed to write log entry:', error);
    });
  }

  // 便捷方法
  error(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('error', 'error', message, data, requestId, stage);
  }

  warn(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('system', 'warn', message, data, requestId, stage);
  }

  info(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('system', 'info', message, data, requestId, stage);
  }

  debug(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('system', 'debug', message, data, requestId, stage);
  }

  // 专用日志方法
  logRequest(requestId: string, method: string, path: string, data?: any): void {
    this.log('request', 'info', `${method} ${path}`, data, requestId, 'request');
  }

  logResponse(requestId: string, status: number, data?: any, duration?: number): void {
    this.log('response', 'info', `Status ${status}`, data, requestId, 'response', duration);
  }

  logPipeline(stage: string, message: string, data?: any, requestId?: string): void {
    this.log('pipeline', 'info', message, data, requestId, stage);
  }

  logPerformance(operation: string, duration: number, data?: any, requestId?: string): void {
    this.log('performance', 'info', `${operation} completed`, data, requestId, operation, duration);
  }

  logToolCall(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('tool_call', 'info', message, data, requestId, stage);
  }

  logStreaming(message: string, data?: any, requestId?: string, stage?: string): void {
    this.log('streaming', 'info', message, data, requestId, stage);
  }

  // 专门记录finish reason
  logFinishReason(finishReason: string, data?: any, requestId?: string, stage?: string): void {
    this.log('streaming', 'info', `Finish reason: ${finishReason}`, {
      finishReason,
      ...data
    }, requestId, stage);
  }

  // 专门记录stop reason
  logStopReason(stopReason: string, data?: any, requestId?: string, stage?: string): void {
    this.log('streaming', 'info', `Stop reason: ${stopReason}`, {
      stopReason,
      ...data
    }, requestId, stage);
  }

  // 清理方法
  async cleanup(): Promise<number> {
    try {
      const dirs = await fs.readdir(this.logDir);
      const cutoffTime = Date.now() - (this.config.maxRetentionDays * 24 * 60 * 60 * 1000);
      let cleaned = 0;

      for (const dir of dirs) {
        if (dir.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)) {
          const dirPath = path.join(this.logDir, dir);
          const stats = await fs.stat(dirPath);
          if (stats.birthtimeMs < cutoffTime) {
            await fs.rm(dirPath, { recursive: true });
            cleaned++;
          }
        }
      }
      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      return 0;
    }
  }

  async shutdown(): Promise<void> {
    this.info('Logger shutting down');
  }
}