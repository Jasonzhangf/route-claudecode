/**
 * RCC v4.0 流水线模块类型定义
 * 
 * 定义流水线模块的所有核心数据结构和接口
 * 支持零接口暴露设计和配置驱动架构
 * 
 * @author RCC v4.0 Architecture Team
 */

import { RoutingTable } from '../../router/src/routing-table-types';
import { PipelineConfig } from '../../router/src/router-preprocessor';

/**
 * 完整流水线接口
 */
export interface CompletePipeline {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  endpoint: string;
  health: HealthStatus;
  layers: PipelineLayer[];
  metadata: PipelineMetadata;
}

/**
 * 流水线层配置
 */
export interface PipelineLayer {
  name: string;
  type: 'client' | 'router' | 'transformer' | 'protocol' | 'server-compatibility' | 'server';
  order: number;
  config: Record<string, any>;
  handler?: any;
}

/**
 * 流水线元数据
 */
export interface PipelineMetadata {
  createdAt: string;
  lastHealthCheck: string;
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  version: string;
}

/**
 * 健康状态枚举
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * 负载均衡策略
 */
export type LoadBalanceStrategy = 'round_robin' | 'weighted' | 'least_connections' | 'random';

/**
 * 流水线组装结果
 */
export interface AssemblyResult {
  success: boolean;
  pipelines?: Map<string, CompletePipeline>;
  errors: string[];
  warnings: string[];
  stats: AssemblyStats;
}

/**
 * 组装统计信息
 */
export interface AssemblyStats {
  totalPipelines: number;
  assemblyTime: number;
  memoryUsage: number;
  layerCount: number;
  validationTime: number;
}

/**
 * 调度结果
 */
export interface ScheduleResult {
  success: boolean;
  selectedPipeline?: CompletePipeline;
  reason: string;
  latency: number;
  alternatives: string[];
  metadata: ScheduleMetadata;
}

/**
 * 调度元数据
 */
export interface ScheduleMetadata {
  strategy: LoadBalanceStrategy;
  candidateCount: number;
  healthyCount: number;
  decisionTime: number;
  timestamp: string;
}

/**
 * 管理结果
 */
export interface ManagementResult {
  success: boolean;
  activeCount: number;
  errors: string[];
  events: PipelineEvent[];
  stats: ManagementStats;
}

/**
 * 管理统计信息
 */
export interface ManagementStats {
  registeredCount: number;
  unregisteredCount: number;
  healthCheckCount: number;
  eventCount: number;
  lastUpdate: string;
}

/**
 * 流水线事件
 */
export interface PipelineEvent {
  type: 'register' | 'unregister' | 'health_change' | 'error';
  pipelineId: string;
  timestamp: string;
  data: any;
  severity: 'info' | 'warning' | 'error';
}

/**
 * 组装器配置
 */
export interface AssemblerConfig {
  maxConcurrentAssembly: number;
  layerTimeout: number;
  validationLevel: 'strict' | 'normal' | 'loose';
  enableOptimization: boolean;
  cacheStrategy: 'memory' | 'disk' | 'none';
  retryAttempts: number;
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  strategy: LoadBalanceStrategy;
  healthCheckInterval: number;
  blacklistThreshold: number;
  weightCalculation: 'latency' | 'success_rate' | 'combined';
  timeoutMs: number;
  maxRetries: number;
}

/**
 * 管理器配置
 */
export interface ManagerConfig {
  maxPipelines: number;
  monitoringInterval: number;
  eventBufferSize: number;
  autoCleanup: boolean;
  healthCheckEnabled: boolean;
  lifecycleHooks: LifecycleHooks;
}

/**
 * 生命周期钩子
 */
export interface LifecycleHooks {
  onRegister?: (pipeline: CompletePipeline) => void;
  onUnregister?: (pipelineId: string) => void;
  onHealthChange?: (pipelineId: string, health: HealthStatus) => void;
  onError?: (pipelineId: string, error: Error) => void;
}

/**
 * 权重计算结果
 */
export interface WeightCalculation {
  pipelineId: string;
  weight: number;
  factors: {
    latency: number;
    successRate: number;
    health: number;
    load: number;
  };
}

/**
 * 流水线状态快照
 */
export interface PipelineSnapshot {
  pipelineId: string;
  status: 'active' | 'inactive' | 'error';
  health: HealthStatus;
  metrics: {
    requestCount: number;
    errorRate: number;
    averageLatency: number;
    lastAccess: string;
  };
  config: PipelineConfig;
}

/**
 * 模块性能指标
 */
export interface PipelineMetrics {
  assemblyTime: number;
  scheduleLatency: number;
  memoryUsage: number;
  activeConnections: number;
  errorRate: number;
  throughput: number;
}

/**
 * 调试信息
 */
export interface PipelineDebugInfo {
  assemblyTrace: string[];
  scheduleDecisionTree: any;
  healthCheckResults: Map<string, HealthStatus>;
  configSnapshot: any;
  performanceMetrics: PipelineMetrics;
}

/**
 * 模块默认配置
 */
export const DEFAULT_CONFIGS = {
  ASSEMBLER: {
    maxConcurrentAssembly: 10,
    layerTimeout: 5000,
    validationLevel: 'normal' as const,
    enableOptimization: true,
    cacheStrategy: 'memory' as const,
    retryAttempts: 3
  },
  
  SCHEDULER: {
    strategy: 'weighted' as LoadBalanceStrategy,
    healthCheckInterval: 30000,
    blacklistThreshold: 5,
    weightCalculation: 'combined' as const,
    timeoutMs: 10000,
    maxRetries: 2
  },
  
  MANAGER: {
    maxPipelines: 100,
    monitoringInterval: 60000,
    eventBufferSize: 1000,
    autoCleanup: true,
    healthCheckEnabled: true,
    lifecycleHooks: {}
  }
} as const;

/**
 * 错误代码常量
 */
export const PIPELINE_ERROR_CODES = {
  // 组装器错误
  ASSEMBLY_INVALID_INPUT: 'PA001',
  ASSEMBLY_LAYER_FAILED: 'PA002', 
  ASSEMBLY_VALIDATION_FAILED: 'PA003',
  ASSEMBLY_TIMEOUT: 'PA004',
  ASSEMBLY_MEMORY_LIMIT: 'PA005',
  
  // 调度器错误
  SCHEDULE_NO_PIPELINE: 'PS001',
  SCHEDULE_ALL_UNHEALTHY: 'PS002',
  SCHEDULE_STRATEGY_FAILED: 'PS003',
  SCHEDULE_TIMEOUT: 'PS004',
  SCHEDULE_WEIGHT_CALCULATION_FAILED: 'PS005',
  
  // 管理器错误
  MANAGER_REGISTRATION_FAILED: 'PM001',
  MANAGER_HEALTH_CHECK_FAILED: 'PM002',
  MANAGER_LIFECYCLE_ERROR: 'PM003',
  MANAGER_CAPACITY_EXCEEDED: 'PM004',
  MANAGER_EVENT_BUFFER_FULL: 'PM005'
} as const;

/**
 * 模块版本信息
 */
export const MODULE_VERSION = {
  MAJOR: 4,
  MINOR: 1,
  PATCH: 0,
  BUILD: 'pipeline-isolation',
  FULL: '4.1.0-pipeline-isolation'
} as const;