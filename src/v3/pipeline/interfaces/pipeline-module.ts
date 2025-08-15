/**
 * Pipeline Module Standard Interface
 * 流水线模块标准接口 - v3.1.0
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

/**
 * 模块状态枚举
 */
export enum ModuleStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing', 
  INITIALIZED = 'initialized',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  PROCESSING = 'processing',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  DESTROYED = 'destroyed',
  ERROR = 'error'
}

/**
 * 模块类型枚举
 */
export enum ModuleType {
  TRANSFORMER = 'transformer',
  PROVIDER_PROTOCOL = 'provider-protocol', 
  SERVER_PROCESSOR = 'server-processor'
}

/**
 * Debug信息接口
 */
export interface ModuleDebugInfo {
  moduleId: string;
  moduleType: ModuleType;
  timestamp: string;
  status: ModuleStatus;
  metrics: {
    processingTime: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
  };
  logs: DebugLogEntry[];
}

/**
 * Debug日志条目
 */
export interface DebugLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  requestId?: string;
}

/**
 * 模块配置接口
 */
export interface ModuleConfig {
  moduleId: string;
  moduleType: ModuleType;
  providerId: string;
  model: string;
  config: any;
  debugEnabled: boolean;
}

/**
 * 模块初始化结果
 */
export interface ModuleInitResult {
  success: boolean;
  error?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

/**
 * 流水线模块标准接口
 */
export interface PipelineModule {
  // 基本属性
  readonly moduleId: string;
  readonly moduleType: ModuleType;
  readonly version: string;

  // 生命周期方法
  init(config: ModuleConfig): Promise<ModuleInitResult>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  end(): Promise<void>;

  // 核心处理方法
  process(input: any, context?: ProcessingContext): Promise<any>;

  // 校验方法
  validateInput(input: any): ValidationResult;
  validateOutput(output: any): ValidationResult;

  // 状态管理
  getStatus(): ModuleStatus;
  isHealthy(): boolean;
  getMetrics(): ModuleMetrics;

  // Debug支持
  enableDebug(): void;
  disableDebug(): void;
  getDebugInfo(): ModuleDebugInfo;
  onDebugData(callback: (data: ModuleDebugInfo) => void): void;
}

/**
 * 处理上下文
 */
export interface ProcessingContext {
  requestId: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  debugEnabled?: boolean;
}

/**
 * 校验结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 模块性能指标
 */
export interface ModuleMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgProcessingTime: number;
  lastProcessedAt?: string;
  uptime: number;
}

/**
 * 标准化请求格式
 */
export interface StandardRequest {
  id: string;
  type: 'anthropic' | 'provider-protocol' | 'provider-specific';
  model: string;
  messages?: any[];
  tools?: any[];
  data: any;
  metadata?: Record<string, any>;
}

/**
 * 标准化响应格式
 */
export interface StandardResponse {
  id: string;
  type: 'anthropic' | 'provider-protocol' | 'provider-specific';
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: Record<string, any>;
  metrics?: {
    processingTime: number;
    timestamp: string;
  };
}

/**
 * 热插拔接口
 */
export interface HotSwappable {
  prepareForSwap(): Promise<boolean>;
  canSwapNow(): boolean;
  getActiveRequests(): string[];
  waitForCompletion(timeout?: number): Promise<boolean>;
}