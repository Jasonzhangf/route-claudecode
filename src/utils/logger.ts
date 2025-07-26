/**
 * Logger utility for Claude Code Router
 * Provides structured logging with different levels and request tracing
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  requestId?: string;
  stage?: string;
}

class Logger {
  private logLevel: LogLevel = 'info';
  private debugMode: boolean = false;
  private logDir: string;
  private traceRequests: boolean = false;
  private quietMode: boolean = false;

  constructor() {
    this.logDir = join(homedir(), '.claude-code-router', 'logs');
    this.ensureLogDir();
  }

  setConfig(options: {
    logLevel?: LogLevel;
    debugMode?: boolean;
    logDir?: string;
    traceRequests?: boolean;
    quietMode?: boolean;
  }) {
    if (options.logLevel) this.logLevel = options.logLevel;
    if (options.debugMode !== undefined) this.debugMode = options.debugMode;
    if (options.logDir) this.logDir = options.logDir;
    if (options.traceRequests !== undefined) this.traceRequests = options.traceRequests;
    if (options.quietMode !== undefined) this.quietMode = options.quietMode;
    
    this.ensureLogDir();
  }

  private ensureLogDir() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return levels[level] <= levels[this.logLevel];
  }

  private formatLog(level: LogLevel, message: string, data?: any, requestId?: string, stage?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      requestId,
      stage
    };
  }

  private writeToFile(entry: LogEntry) {
    if (!this.debugMode && !this.traceRequests) return;

    try {
      const logFile = join(this.logDir, `ccr-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(entry) + '\n';
      writeFileSync(logFile, logLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private outputToConsole(entry: LogEntry) {
    // In quiet mode, only show critical errors
    if (this.quietMode && entry.level !== 'error') {
      return;
    }
    
    const { timestamp, level, message, data, requestId, stage } = entry;
    
    let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    if (requestId) output += ` [${requestId}]`;
    if (stage) output += ` [${stage}]`;
    
    switch (level) {
      case 'error':
        console.error(output);
        if (data && this.debugMode) console.error('Data:', JSON.stringify(data, null, 2));
        break;
      case 'warn':
        console.warn(output);
        if (data && this.debugMode) console.warn('Data:', JSON.stringify(data, null, 2));
        break;
      case 'info':
        console.log(output);
        if (data && this.debugMode) console.log('Data:', JSON.stringify(data, null, 2));
        break;
      case 'debug':
        if (this.debugMode) {
          console.log(output);
          if (data) console.log('Data:', JSON.stringify(data, null, 2));
        }
        break;
    }
  }

  error(message: string, data?: any, requestId?: string, stage?: string) {
    if (!this.shouldLog('error')) return;
    
    const entry = this.formatLog('error', message, data, requestId, stage);
    this.outputToConsole(entry);
    this.writeToFile(entry);
  }

  warn(message: string, data?: any, requestId?: string, stage?: string) {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.formatLog('warn', message, data, requestId, stage);
    this.outputToConsole(entry);
    this.writeToFile(entry);
  }

  info(message: string, data?: any, requestId?: string, stage?: string) {
    if (!this.shouldLog('info')) return;
    
    const entry = this.formatLog('info', message, data, requestId, stage);
    this.outputToConsole(entry);
    this.writeToFile(entry);
  }

  debug(message: string, data?: any, requestId?: string, stage?: string) {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.formatLog('debug', message, data, requestId, stage);
    this.outputToConsole(entry);
    this.writeToFile(entry);
  }

  // Special method for request tracing
  trace(requestId: string, stage: string, message: string, data?: any) {
    if (!this.traceRequests) return;
    
    const entry = this.formatLog('debug', `[TRACE] ${message}`, data, requestId, stage);
    this.writeToFile(entry);
    
    if (this.debugMode) {
      this.outputToConsole(entry);
    }
  }

  // Enable quiet mode to reduce console output interference
  setQuietMode(enabled: boolean) {
    this.quietMode = enabled;
  }
}

export const logger = new Logger();