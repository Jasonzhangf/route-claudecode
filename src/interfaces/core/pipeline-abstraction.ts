/**
 * Pipeline抽象接口层
 * 定义各模块之间的接口边界，避免跨模块直接依赖
 */

import { ExecutionContext, PipelineConfig } from '../pipeline/pipeline-framework';

// 重新导出ExecutionContext以供外部模块使用
export { ExecutionContext } from '../pipeline/pipeline-framework';

/**
 * Pipeline管理器接口
 */
export interface IPipelineManager {
  createPipeline(config: PipelineConfig): Promise<string>;
  getPipeline(pipelineId: string): IPipeline | null;
  getAllPipelines(): Map<string, IPipeline>;
  getAllPipelineStatus(): Record<string, PipelineStatus>;
  getPipelineStatus(pipelineId: string): PipelineStatus | null;
  executePipeline(pipelineId: string, input: any, context: ExecutionContext): Promise<ExecutionResult>;
  destroyPipeline(pipelineId: string): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Pipeline接口
 */
export interface IPipeline {
  getId(): string;
  getName(): string;
  getConfig(): PipelineConfig;
  getStatus(): PipelineStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(input: any, context: ExecutionContext): Promise<ExecutionResult>;
  provider: string;
  model: string;
}

/**
 * Pipeline工厂接口
 */
export interface IPipelineFactory {
  createPipeline(config: PipelineConfig): Promise<IPipeline>;
  getSupportedTypes(): string[];
  validateConfig(config: PipelineConfig): boolean;
}

/**
 * Pipeline状态
 */
export interface PipelineStatus {
  id: string;
  name: string;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  created: Date;
  lastActivity?: Date;
  error?: string;
  metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecutionTime?: number;
  };
  health: {
    healthy: boolean;
    lastHealthCheck: Date;
    uptime: number;
  };
}

/**
 * Pipeline执行结果
 */
export interface ExecutionResult {
  executionId: string;
  pipelineId: string;
  result: any;
  error?: Error;
  performance: {
    startTime: number;
    endTime: number;
    totalTime: number;
    moduleTimings: Record<string, number>;
  };
  metadata: {
    provider?: string;
    model?: string;
    processingSteps: string[];
    [key: string]: any;
  };
}

/**
 * 模块注册表接口
 */
export interface IModuleRegistry {
  registerModule(name: string, moduleFactory: any): void;
  getModule(name: string): any;
  hasModule(name: string): boolean;
  getRegisteredModules(): string[];
  unregisterModule(name: string): void;
}

/**
 * Pipeline协议匹配器接口
 */
export interface IPipelineProtocolMatcher {
  findPipelineByProtocol(protocol: string, model?: string): IPipeline | null;
  registerProtocolHandler(protocol: string, handler: ProtocolHandler): void;
  getSupportedProtocols(): string[];
}

/**
 * 协议处理器接口
 */
export interface ProtocolHandler {
  canHandle(protocol: string, model?: string): boolean;
  getPriority(): number;
  transformRequest?(input: any): any;
  transformResponse?(output: any): any;
}

/**
 * 服务器组件接口
 */
export interface IServerComponent {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): any;
  isHealthy(): boolean;
}

/**
 * Pipeline服务接口
 */
export interface IPipelineService extends IServerComponent {
  initializePipelines(configs: PipelineConfig[]): Promise<void>;
  cleanupPipelines(): Promise<void>;
  handleRequest(protocol: string, input: any, context: ExecutionContext): Promise<ExecutionResult>;
  getPipelineManager(): IPipelineManager;
  getProtocolMatcher(): IPipelineProtocolMatcher;
}

/**
 * 配置验证器接口
 */
export interface IConfigValidator {
  validatePipelineConfig(config: PipelineConfig): ValidationResult;
  validateServerConfig(config: any): ValidationResult;
  validateModuleConfig(config: any): ValidationResult;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 事件发射器接口
 */
export interface IEventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): void;
}
