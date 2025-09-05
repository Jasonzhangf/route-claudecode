/**
 * 流水线框架接口定义
 *
 * 定义11模块流水线的标准框架接口
 *
 * @author Jason Zhang
 */

/**
 * 导入base-module中的类型定义
 */
import { ModuleType, ModuleStatus, ModuleInterface } from '../module/base-module';

/**
 * 重新导出供外部使用
 */
export { ModuleType, ModuleStatus, ModuleInterface };

// ========================================
// 🔧 新增：固定管道架构接口
// ========================================

/**
 * 固定流水线执行器接口
 * 运行时执行预构建的固定管道
 */
export interface FixedPipelineExecutor {
  readonly pipelineId: string;
  readonly definition: any; // 临时使用any，避免循环依赖
  readonly components: PrebuiltComponents;
  execute(request: any, context: RequestContext): Promise<any>;
}

/**
 * 预构建组件集合
 * 在初始化时创建，运行时直接使用
 */
export interface PrebuiltComponents {
  readonly transformer: ComponentInstance;
  readonly protocol: ComponentInstance;
  readonly serverCompatibility: ComponentInstance;
  readonly server: ComponentInstance;
}

/**
 * 组件实例接口
 * 预配置的组件实例，运行时不再查询配置
 */
export interface ComponentInstance {
  readonly id: string;
  readonly type: string;
  readonly config: any; // 预定义配置，从Pipeline定义中提取
  process(data: any, context?: any): Promise<any>;
}

/**
 * 组件定义接口
 * 用于从PipelineDefinition.architecture创建组件实例
 */
export interface ComponentDefinition {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: any; // 从架构定义中提取的配置
}

/**
 * 请求上下文接口
 * 贯穿整个固定管道执行过程
 */
export interface RequestContext {
  requestId: string;
  startTime: Date;
  layerTimings: {
    transformer?: number;
    protocol?: number;
    serverCompatibility?: number;
    server?: number;
    total?: number;
  };
  metadata: any;
}

// ========================================
// 🔧 现有接口保持不变，继续定义...
// ========================================

/**
 * 流水线规范接口
 */
export interface PipelineSpec {
  id: string;
  name: string;
  description: string;
  version: string;
  provider?: string;
  model?: string;
  timeout?: number;
  modules: {
    id: string;
    config?: Record<string, any>;
  }[];
  configuration: PipelineConfiguration;
  metadata: PipelineMetadata;
}

/**
 * 流水线配置
 */
export interface PipelineConfiguration {
  parallel: boolean;
  failFast: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

/**
 * 流水线元数据
 */
export interface PipelineMetadata {
  author: string;
  created: number;
  tags: string[];
}

/**
 * Pipeline接口
 */
export interface Pipeline {
  getId(): string;
  getName(): string;
  getProvider(): string;
  getModel(): string;
  getStatus(): PipelineStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(input: any, context?: any): Promise<any>;
}

/**
 * Pipeline状态
 */
export interface PipelineStatus {
  id: string;
  name: string;
  status: 'idle' | 'starting' | 'running' | 'busy' | 'stopping' | 'error' | 'stopped';
  provider?: string;
  model?: string;
  activeConnections?: number;
  totalRequests?: number;
  successRequests?: number;
  errorRequests?: number;
  averageResponseTime?: number;
  lastActivity?: Date;
  lastExecution?: ExecutionRecord;
  modules?: Record<string, ModuleStatus>;
  uptime?: number;
  performance?: {
    requestsProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
    throughput: number;
  };
  health?: {
    healthy: boolean;
    lastHealthCheck: Date;
    issues: string[];
  };
}

/**
 * 流水线框架接口
 */
export interface PipelineFramework extends Pipeline {
  readonly id: string;

  /**
   * 事件监听器方法
   */
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeListener(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
  /**
   * 添加模块到流水线
   */
  addModule(module: ModuleInterface): void;

  /**
   * 移除模块
   */
  removeModule(moduleId: string): void;

  /**
   * 获取模块
   */
  getModule(moduleId: string): ModuleInterface | null;

  /**
   * 获取所有模块
   */
  getAllModules(): ModuleInterface[];

  /**
   * 设置模块顺序
   */
  setModuleOrder(moduleIds: string[]): void;

  /**
   * 执行单个模块
   */
  executeModule(moduleId: string, input: any): Promise<any>;

  /**
   * 获取执行历史
   */
  getExecutionHistory(): ExecutionRecord[];

  /**
   * 重置流水线状态
   */
  reset(): Promise<void>;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * 执行记录
 */
export interface ExecutionRecord {
  id: string;
  pipelineId: string;
  requestId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  moduleExecutions: ModuleExecutionRecord[];
  totalTime?: number;
  error?: Error;
}

/**
 * 模块执行记录
 */
export interface ModuleExecutionRecord {
  moduleId: string;
  moduleName: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: any;
  output?: any;
  error?: Error;
  processingTime?: number;
  metadata?: Record<string, any>;
}

/**
 * 流水线配置接口
 */
export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  modules: ModuleConfig[];
  settings: PipelineSettings;
  spec?: PipelineSpec;
  metadata?: Record<string, any>;
}

/**
 * 模块配置
 */
export interface ModuleConfig {
  id: string;
  moduleId: string;
  order: number;
  enabled: boolean;
  config: Record<string, any>;
  dependencies?: string[];
  optional?: boolean;
}

/**
 * 流水线设置
 */
export interface PipelineSettings {
  parallel: boolean;
  failFast: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
  errorHandling: ErrorHandlingStrategy;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

/**
 * 错误处理策略
 */
export interface ErrorHandlingStrategy {
  stopOnFirstError: boolean;
  allowPartialSuccess: boolean;
  errorRecovery: boolean;
  fallbackStrategies: FallbackStrategy[];
}

/**
 * 降级策略
 */
export interface FallbackStrategy {
  condition: string;
  action: 'retry' | 'skip' | 'alternative' | 'abort';
  parameters?: Record<string, any>;
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  includeInput: boolean;
  includeOutput: boolean;
  maskSensitiveData: boolean;
  maxLogSize: number;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  enabled: boolean;
  collectMetrics: boolean;
  performanceTracking: boolean;
  alerting: AlertingConfig;
}

/**
 * 告警配置
 */
export interface AlertingConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    throughput: number;
  };
  channels: string[];
}

/**
 * 流水线执行器接口
 */
export interface PipelineExecutor {
  /**
   * 执行流水线
   */
  execute(input: any, context?: ExecutionContext): Promise<ExecutionResult>;

  /**
   * 取消执行
   */
  cancel(executionId: string): Promise<boolean>;

  /**
   * 暂停执行
   */
  pause(executionId: string): Promise<boolean>;

  /**
   * 恢复执行
   */
  resume(executionId: string): Promise<boolean>;

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ExecutionStatus;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  debug?: boolean;
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  executionId: string;
  status: 'success' | 'failure' | 'partial' | 'cancelled';
  result?: any;
  error?: Error;
  executionRecord: ExecutionRecord;
  performance: PerformanceMetrics;
}

/**
 * 执行状态
 */
export interface ExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number; // 0-100
  currentModule?: string;
  startTime: Date;
  estimatedRemainingTime?: number;
  error?: Error;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalTime: number;
  modulesTiming: Record<string, number>;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  throughput: number;
  errorCount: number;
}

/**
 * 流水线验证器接口
 */
export interface PipelineValidator {
  /**
   * 验证流水线配置
   */
  validateConfig(config: PipelineConfig): ValidationResult;

  /**
   * 验证模块依赖
   */
  validateDependencies(modules: ModuleConfig[]): ValidationResult;

  /**
   * 验证模块兼容性
   */
  validateCompatibility(modules: ModuleInterface[]): ValidationResult;

  /**
   * 验证流水线完整性
   */
  validateIntegrity(pipeline: Pipeline): ValidationResult;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
  details?: Record<string, any>;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

/**
 * 流水线工厂接口
 */
export interface StandardPipelineFactory {
  /**
   * 创建标准流水线
   */
  createStandardPipeline(config: PipelineConfig): Promise<PipelineFramework>;

  /**
   * 创建LM Studio流水线
   */
  createLMStudioPipeline(model: string): Promise<PipelineFramework>;

  /**
   * 创建OpenAI流水线
   */
  createOpenAIPipeline(model: string): Promise<PipelineFramework>;

  /**
   * 创建Anthropic流水线
   */
  createAnthropicPipeline(model: string): Promise<PipelineFramework>;

  /**
   * 从规范创建流水线
   */
  createFromSpec(spec: PipelineSpec): Promise<PipelineFramework>;

  /**
   * 克隆流水线
   */
  clonePipeline(sourceId: string, newId: string): Promise<PipelineFramework>;
}

// ModuleInterface implementation for architecture compliance
import { SimpleModuleAdapter } from '../module/base-module';
export const pipelineFrameworkModuleAdapter = new SimpleModuleAdapter(
  'pipeline-framework-module',
  'Pipeline Framework Interfaces',
  ModuleType.PIPELINE,
  '4.0.0-alpha.1'
);
