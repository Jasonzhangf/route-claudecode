/**
 * Finish Reason Debug Logger
 * 专门记录finish reason和stop reason的调试信息
 * 按端口号分组管理日志文件
 */

import { writeFileSync, existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';

/**
 * 获取调试日志目录路径 - 按端口号分组
 * @param port 端口号，默认为 3456
 */
export function getDebugLogDir(port: number): string {
  return join(homedir(), '.route-claude-code', 'logs', `port-${port}`);
}

/**
 * 确保调试日志目录存在 - 按端口号创建
 * @param port 端口号，默认为 3456
 */
function ensureDebugLogDir(port: number) {
  const debugLogDir = getDebugLogDir(port);
  if (!existsSync(debugLogDir)) {
    mkdirSync(debugLogDir, { recursive: true });
  }
}

/**
 * 记录finish reason调试信息
 * @param requestId 请求ID
 * @param finishReason 完成原因
 * @param provider 提供商名称
 * @param model 模型名称
 * @param port 端口号，默认为 3456
 * @param additionalData 额外数据
 */
export function logFinishReasonDebug(
  requestId: string,
  finishReason: string,
  provider: string,
  model: string,
  port: number,
  additionalData?: any
) {
  try {
    ensureDebugLogDir(port);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      finishReason,
      provider,
      model,
      port,
      ...(additionalData || {})
    };
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, 'finish-reason-debug.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write finish reason debug log:', error);
  }
}

/**
 * 记录stop reason调试信息
 * @param requestId 请求ID
 * @param stopReason 停止原因
 * @param provider 提供商名称
 * @param model 模型名称
 * @param port 端口号，默认为 3456
 * @param additionalData 额外数据
 */
export function logStopReasonDebug(
  requestId: string,
  stopReason: string,
  provider: string,
  model: string,
  port: number,
  additionalData?: any
) {
  try {
    ensureDebugLogDir(port);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      stopReason,
      provider,
      model,
      port,
      ...(additionalData || {})
    };
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, 'stop-reason-debug.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write stop reason debug log:', error);
  }
}

/**
 * 获取调试日志目录路径 (已废弃，请使用带端口参数的版本)
 * @deprecated 请使用 getDebugLogDir(port)
 */
export function getDebugLogDirLegacy(): string {
  // 🔧 修复硬编码：需要明确指定端口
  throw new Error('Port must be explicitly specified for getDefaultFinishReasonDir() - no hardcoded defaults allowed');
}

/**
 * 记录工具调用完成状态
 * @param requestId 请求ID
 * @param toolCallId 工具调用ID
 * @param status 状态
 * @param port 端口号，默认为 3456
 * @param result 结果
 */
export function logToolCallCompletion(
  requestId: string,
  toolCallId: string,
  status: 'success' | 'error' | 'pending',
  port: number,
  result?: any
) {
  try {
    ensureDebugLogDir(port);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      toolCallId,
      status,
      port,
      result
    };
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, 'tool-call-completion.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write tool call completion log:', error);
  }
}

/**
 * 记录API错误信息
 * @param requestId 请求ID
 * @param provider 提供商名称
 * @param error 错误信息
 * @param port 端口号，默认为 3456
 * @param retryCount 重试次数
 */
export function logApiError(
  requestId: string,
  provider: string,
  error: any,
  port: number,
  retryCount: number = 0
) {
  try {
    ensureDebugLogDir(port);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      provider,
      port,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      retryCount
    };
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, 'api-errors.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write API error log:', error);
  }
}

/**
 * 记录轮询重试信息
 * @param requestId 请求ID
 * @param provider 提供商名称
 * @param attempt 重试次数
 * @param reason 重试原因
 * @param port 端口号，默认为 3456
 */
export function logPollingRetry(
  requestId: string,
  provider: string,
  attempt: number,
  reason: string,
  port: number
) {
  try {
    ensureDebugLogDir(port);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      provider,
      port,
      attempt,
      reason
    };
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, 'polling-retries.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write polling retry log:', error);
  }
}

/**
 * 清理旧的调试日志文件
 * @param port 端口号，默认为 3456
 * @param maxAge 最大保留时间，默认为7天
 */
export function cleanupDebugLogs(port: number, maxAge: number = 7 * 24 * 60 * 60 * 1000) {
  try {
    const debugLogDir = getDebugLogDir(port);
    if (!existsSync(debugLogDir)) {
      return;
    }
    
    const now = Date.now();
    const files = readdirSync(debugLogDir);
    
    for (const file of files) {
      const filePath = join(debugLogDir, file);
      const stats = statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup debug logs:', error);
  }
}

/**
 * 读取调试日志文件
 * @param logType 日志类型
 * @param port 端口号，默认为 3456
 * @param limit 读取条数限制
 */
export function readDebugLogs(logType: 'finish-reason' | 'stop-reason' = 'finish-reason', port: number, limit?: number): any[] {
  try {
    ensureDebugLogDir(port);
    
    const debugLogDir = getDebugLogDir(port);
    const logFilePath = join(debugLogDir, `${logType}-debug.log`);
    
    if (!existsSync(logFilePath)) {
      return [];
    }
    
    const content = readFileSync(logFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    const logs = lines.map((line: string) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter((log: any) => log !== null);
    
    if (limit && limit > 0) {
      return logs.slice(-limit);
    }
    
    return logs;
  } catch (error) {
    console.error('Failed to read debug logs:', error);
    return [];
  }
}