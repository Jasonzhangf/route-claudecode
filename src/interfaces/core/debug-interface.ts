/**
 * Debug系统接口定义
 * 
 * 定义Debug系统的标准接口，包括调试记录、回放系统、性能分析等功能
 * 严格遵循模块边界，不依赖其他模块的具体实现
 * 
 * @author Jason Zhang
 */

import { IModule, ModuleConfig } from './module-interface';
import { RouteRequest, RouteResponse } from './router-interface';

/**
 * Debug级别枚举
 */
export enum DebugLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 记录类型枚举
 */
export enum RecordType {
  REQUEST = 'request',
  RESPONSE = 'response',
  PIPELINE = 'pipeline',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  SYSTEM = 'system'
}

/**
 * Debug记录
 */
export interface DebugRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly level: DebugLevel;
  readonly type: RecordType;
  readonly sessionId: string;
  readonly moduleId: string;
  readonly data: any;
  readonly metadata?: Record<string, any>;
}

/**
 * 请求追踪信息
 */
export interface RequestTrace {
  readonly requestId: string;
  readonly sessionId: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly request: RouteRequest;
  readonly response?: RouteResponse;
  readonly pipelineId?: string;
  readonly steps: TraceStep[];
  readonly error?: Error;
  readonly performance: PerformanceTrace;
}

/**
 * 追踪步骤
 */
export interface TraceStep {
  readonly id: string;
  readonly name: string;
  readonly moduleId: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly input: any;
  readonly output?: any;
  readonly error?: Error;
  readonly metadata?: Record<string, any>;
}

/**
 * 性能追踪信息
 */
export interface PerformanceTrace {
  readonly totalTime: number;
  readonly routingTime: number;
  readonly pipelineTime: number;
  readonly networkTime: number;
  readonly transformTime: number;
  readonly memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  readonly cpuUsage: {
    user: number;
    system: number;
  };
}

/**
 * 回放配置
 */
export interface ReplayConfig {
  readonly sessionId: string;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly requestIds?: string[];
  readonly modules?: string[];
  readonly speedMultiplier: number;
  readonly skipErrors: boolean;
  readonly validateOutputs: boolean;
}

/**
 * 回放结果
 */
export interface ReplayResult {
  readonly success: boolean;
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly executionTime: number;
  readonly differences: ReplayDifference[];
  readonly error?: Error;
}

/**
 * 回放差异
 */
export interface ReplayDifference {
  readonly requestId: string;
  readonly field: string;
  readonly originalValue: any;
  readonly replayValue: any;
  readonly type: 'value' | 'timing' | 'error' | 'missing';
}

/**
 * Debug配置
 */
export interface DebugConfig extends ModuleConfig {
  readonly enabled: boolean;
  readonly level: DebugLevel;
  readonly recordTypes: RecordType[];
  readonly maxRecords: number;
  readonly storageDir: string;
  readonly autoCleanup: boolean;
  readonly cleanupDays: number;
  readonly enableReplay: boolean;
  readonly enablePerformanceTracking: boolean;
}

/**
 * 会话信息
 */
export interface DebugSession {
  readonly id: string;
  readonly port: number;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly recordCount: number;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly storageDir: string;
  readonly isActive: boolean;
}

/**
 * Debug记录器接口
 */
export interface IDebugRecorder {
  /**
   * 记录Debug信息
   * @param record Debug记录
   * @returns Promise<void>
   */
  record(record: DebugRecord): Promise<void>;
  
  /**
   * 批量记录Debug信息
   * @param records Debug记录数组
   * @returns Promise<void>
   */
  recordBatch(records: DebugRecord[]): Promise<void>;
  
  /**
   * 开始请求追踪
   * @param request 路由请求
   * @returns string 追踪ID
   */
  startRequestTrace(request: RouteRequest): string;
  
  /**
   * 添加追踪步骤
   * @param traceId 追踪ID
   * @param step 追踪步骤
   * @returns Promise<void>
   */
  addTraceStep(traceId: string, step: TraceStep): Promise<void>;
  
  /**
   * 结束请求追踪
   * @param traceId 追踪ID
   * @param response 路由响应
   * @param error 错误信息
   * @returns Promise<RequestTrace> 完整追踪信息
   */
  endRequestTrace(traceId: string, response?: RouteResponse, error?: Error): Promise<RequestTrace>;
  
  /**
   * 查询Debug记录
   * @param filters 查询过滤条件
   * @returns Promise<DebugRecord[]> Debug记录数组
   */
  queryRecords(filters: {
    sessionId?: string;
    level?: DebugLevel;
    type?: RecordType;
    moduleId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<DebugRecord[]>;
  
  /**
   * 获取请求追踪
   * @param requestId 请求ID
   * @returns Promise<RequestTrace | null> 请求追踪信息
   */
  getRequestTrace(requestId: string): Promise<RequestTrace | null>;
}

/**
 * 回放系统接口
 */
export interface IReplaySystem {
  /**
   * 开始回放
   * @param config 回放配置
   * @returns Promise<ReplayResult> 回放结果
   */
  startReplay(config: ReplayConfig): Promise<ReplayResult>;
  
  /**
   * 停止回放
   * @returns Promise<void>
   */
  stopReplay(): Promise<void>;
  
  /**
   * 获取回放状态
   * @returns any | null 回放状态
   */
  getReplayStatus(): any | null;
  
  /**
   * 验证回放结果
   * @param originalTrace 原始追踪
   * @param replayTrace 回放追踪
   * @returns ReplayDifference[] 差异列表
   */
  validateReplayResult(originalTrace: RequestTrace, replayTrace: RequestTrace): ReplayDifference[];
  
  /**
   * 导出回放报告
   * @param result 回放结果
   * @param format 导出格式
   * @returns Promise<string> 报告内容或文件路径
   */
  exportReplayReport(result: ReplayResult, format: 'json' | 'html' | 'csv'): Promise<string>;
}

/**
 * 性能分析器接口
 */
export interface IPerformanceAnalyzer {
  /**
   * 开始性能分析
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  startProfiling(sessionId: string): Promise<void>;
  
  /**
   * 停止性能分析
   * @param sessionId 会话ID
   * @returns Promise<PerformanceTrace[]> 性能数据
   */
  stopProfiling(sessionId: string): Promise<PerformanceTrace[]>;
  
  /**
   * 分析性能数据
   * @param traces 性能追踪数据
   * @returns Promise<any> 分析结果
   */
  analyzePerformance(traces: PerformanceTrace[]): Promise<any>;
  
  /**
   * 生成性能报告
   * @param analysis 性能分析结果
   * @param format 报告格式
   * @returns Promise<string> 报告内容或文件路径
   */
  generatePerformanceReport(analysis: any, format: 'json' | 'html' | 'csv'): Promise<string>;
}

/**
 * Debug管理器接口
 */
export interface IDebugManager {
  /**
   * 创建Debug会话
   * @param port 端口号
   * @returns Promise<DebugSession> 会话信息
   */
  createSession(port: number): Promise<DebugSession>;
  
  /**
   * 关闭Debug会话
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  closeSession(sessionId: string): Promise<void>;
  
  /**
   * 获取Debug会话
   * @param sessionId 会话ID
   * @returns DebugSession | null 会话信息
   */
  getSession(sessionId: string): DebugSession | null;
  
  /**
   * 获取所有活跃会话
   * @returns DebugSession[] 会话信息数组
   */
  getActiveSessions(): DebugSession[];
  
  /**
   * 清理过期数据
   * @param olderThanDays 清理多少天前的数据
   * @returns Promise<number> 清理的记录数量
   */
  cleanup(olderThanDays: number): Promise<number>;
  
  /**
   * 导出会话数据
   * @param sessionId 会话ID
   * @param format 导出格式
   * @returns Promise<string> 导出文件路径
   */
  exportSession(sessionId: string, format: 'json' | 'zip'): Promise<string>;
  
  /**
   * 导入会话数据
   * @param filePath 导入文件路径
   * @returns Promise<DebugSession> 导入的会话信息
   */
  importSession(filePath: string): Promise<DebugSession>;
}

/**
 * Debug模块接口
 * 继承标准模块接口，提供Debug系统特有的功能
 */
export interface IDebugModule extends IModule {
  readonly config: DebugConfig;
  readonly recorder: IDebugRecorder;
  readonly replaySystem: IReplaySystem;
  readonly performanceAnalyzer: IPerformanceAnalyzer;
  readonly debugManager: IDebugManager;
  
  /**
   * 启用调试模式
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  enableDebugging(sessionId: string): Promise<void>;
  
  /**
   * 禁用调试模式
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  disableDebugging(sessionId: string): Promise<void>;
  
  /**
   * 设置调试级别
   * @param level Debug级别
   * @returns Promise<void>
   */
  setDebugLevel(level: DebugLevel): Promise<void>;
  
  /**
   * 获取调试统计信息
   * @param sessionId 会话ID
   * @returns Promise<any> 统计信息
   */
  getDebugStats(sessionId: string): Promise<any>;
}

/**
 * Debug事件类型
 */
export interface DebugEvents {
  'session-created': (session: DebugSession) => void;
  'session-closed': (sessionId: string) => void;
  'record-created': (record: DebugRecord) => void;
  'trace-started': (traceId: string, request: RouteRequest) => void;
  'trace-completed': (trace: RequestTrace) => void;
  'replay-started': (config: ReplayConfig) => void;
  'replay-completed': (result: ReplayResult) => void;
  'performance-analysis-completed': (sessionId: string, analysis: any) => void;
  'cleanup-completed': (recordsRemoved: number) => void;
}