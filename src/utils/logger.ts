/**
 * Logger utility for Claude Code Router
 * Provides structured logging with different levels and request tracing
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfigPaths } from './config-paths';

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
  private sessionLogFile: string | null = null;

  constructor(logDir?: string, serverType?: string) {
    if (logDir) {
      this.logDir = logDir;
    } else {
      const configPaths = getConfigPaths();
      this.logDir = configPaths.logsDir;
    }
    this.ensureLogDir();
    this.initSessionLogFile(serverType);
  }

  setConfig(options: {
    logLevel?: LogLevel;
    debugMode?: boolean;
    logDir?: string;
    traceRequests?: boolean;
    quietMode?: boolean;
  }) {
    const logDirChanged = options.logDir && options.logDir !== this.logDir;
    
    if (options.logLevel) this.logLevel = options.logLevel;
    if (options.debugMode !== undefined) this.debugMode = options.debugMode;
    if (options.logDir) this.logDir = options.logDir;
    if (options.traceRequests !== undefined) this.traceRequests = options.traceRequests;
    if (options.quietMode !== undefined) this.quietMode = options.quietMode;
    
    this.ensureLogDir();
    
    // Re-initialize session log file if log directory changed
    if (logDirChanged) {
      this.initSessionLogFile();
    }
  }

  private ensureLogDir() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initSessionLogFile(serverType?: string) {
    // Create one log file per server session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
    const suffix = serverType ? `-${serverType}` : '';
    this.sessionLogFile = join(this.logDir, `ccr-session${suffix}-${timestamp}.log`);
    
    // Write session start marker
    if (this.sessionLogFile) {
      const sessionStartEntry = {
        timestamp: new Date().toISOString(),
        level: 'info' as LogLevel,
        message: '🚀 Claude Code Router session started',
        data: {
          sessionId: timestamp,
          serverType: serverType || 'single',
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform
        }
      };
      
      try {
        writeFileSync(this.sessionLogFile, JSON.stringify(sessionStartEntry) + '\n', { flag: 'w' });
      } catch (error) {
        console.error('Failed to initialize session log file:', error);
        this.sessionLogFile = null;
      }
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
    if (!this.sessionLogFile) return;

    try {
      const logLine = JSON.stringify(entry) + '\n';
      writeFileSync(this.sessionLogFile, logLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private outputToConsole(entry: LogEntry) {
    // In quiet mode, only show critical errors and important info
    if (this.quietMode && !['error', 'warn'].includes(entry.level)) {
      return;
    }
    
    const { timestamp, level, message, data, requestId, stage } = entry;
    
    // Only show essential info in console, detailed logs go to file
    let output: string;
    if (requestId && stage) {
      // Compact format for traced requests - only show in debug mode
      if (!this.debugMode) return;
      output = `[${level.toUpperCase()}] ${message}`;
    } else {
      // Standard format for important logs
      const timeShort = timestamp.slice(11, 19); // Just HH:MM:SS
      output = `[${timeShort}] ${level.toUpperCase()}: ${message}`;
    }
    
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
        console.log(output);
        break;
      case 'debug':
        if (this.debugMode) {
          console.log(output);
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

// Factory function to create independent logger instances
export function createLogger(logDir: string, serverType: string): Logger {
  return new Logger(logDir, serverType);
}