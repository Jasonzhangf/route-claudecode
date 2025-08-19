/**
 * Debug系统核心类型定义
 *
 * 为Debug管理器、记录器和回放系统提供类型支持
 *
 * @author Jason Zhang
 */

import { RCCError } from '../../types/error';
import { Pipeline } from '../../pipeline/types';

/**
 * Debug记录类型
 */
export interface DebugRecord {
  requestId: string;
  timestamp: number;
  readableTime: string; // 可读的当前时区时间: "2024-08-15 14:30:22 CST"
  port: number;
  sessionId: string;

  // 请求信息
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  };

  // 流水线执行记录
  pipeline: {
    id: string;
    provider: string;
    model: string;
    modules: ModuleRecord[];
  };

  // 响应信息
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  };

  // 错误信息（如果有）
  error?: {
    type: string;
    message: string;
    module: string;
    stack: string;
  };
}

/**
 * 模块执行记录
 */
export interface ModuleRecord {
  moduleName: string;
  startTime: number;
  startTimeReadable: string; // 可读的开始时间
  endTime: number;
  endTimeReadable: string; // 可读的结束时间
  duration: number; // 处理时长(毫秒)
  input: any;
  output: any;
  error?: RCCError;
  metadata: {
    version: string;
    config: any;
  };
}

/**
 * Debug会话记录
 */
export interface DebugSession {
  sessionId: string;
  port: number;
  startTime: number;
  startTimeReadable: string; // 可读的开始时间: "2024-08-15 14:30:22 CST"
  endTime?: number;
  endTimeReadable?: string; // 可读的结束时间
  duration?: number; // 会话持续时间(毫秒)
  requestCount: number;
  errorCount: number;
  activePipelines: string[];
  metadata: {
    version: string;
    config: any;
    timezone: string; // 时区信息
  };
}

/**
 * 模块Debug信息
 */
export interface ModuleDebugInfo {
  name: string;
  port: number;
  registeredAt: number;
}

/**
 * Debug配置
 */
export interface DebugConfig {
  enabled: boolean;
  maxRecordSize: number;
  maxSessionDuration: number;
  retentionDays: number;
  compressionEnabled: boolean;
  storageBasePath: string;
  modules: {
    [moduleName: string]: {
      enabled: boolean;
      logLevel: 'debug' | 'info' | 'warn' | 'error';
    };
  };
}

/**
 * 回放结果
 */
export interface ReplayResult {
  original: any;
  replayed: any;
  isValid: boolean;
  differences: ReplayDifference[];
  performance: {
    originalDuration: number;
    replayDuration: number;
    performanceRatio: number;
  };
}

/**
 * 回放差异
 */
export interface ReplayDifference {
  path: string;
  originalValue: any;
  replayedValue: any;
  type: 'added' | 'removed' | 'modified';
}

/**
 * Debug统计信息
 */
export interface DebugStatistics {
  totalSessions: number;
  activeSessions: number;
  totalRecords: number;
  totalErrors: number;
  averageResponseTime: number;
  diskUsage: number;
  moduleStatistics: Map<
    string,
    {
      recordCount: number;
      errorCount: number;
      averageDuration: number;
    }
  >;
}
