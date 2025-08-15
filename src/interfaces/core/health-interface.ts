/**
 * 健康监控系统接口定义
 * 
 * 定义健康检查、自动恢复、服务依赖监控的标准接口
 * 
 * @author Jason Zhang
 */

import { IModule, ModuleConfig } from './module-interface';

/**
 * 健康状态枚举
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * 服务类型枚举
 */
export enum ServiceType {
  HTTP_SERVER = 'http_server',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  MESSAGE_QUEUE = 'message_queue',
  CACHE = 'cache',
  FILE_SYSTEM = 'file_system',
  PIPELINE = 'pipeline',
  MODULE = 'module'
}

/**
 * 检查类型枚举
 */
export enum CheckType {
  CONNECTIVITY = 'connectivity',
  RESPONSE_TIME = 'response_time',
  ERROR_RATE = 'error_rate',
  RESOURCE_USAGE = 'resource_usage',
  DEPENDENCY = 'dependency',
  CUSTOM = 'custom'
}

/**
 * 恢复策略枚举
 */
export enum RecoveryStrategy {
  RESTART = 'restart',
  RECONNECT = 'reconnect',
  FAILOVER = 'failover',
  CIRCUIT_BREAK = 'circuit_break',
  RATE_LIMIT = 'rate_limit',
  CUSTOM = 'custom'
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  readonly id: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly checkType: CheckType;
  readonly enabled: boolean;
  readonly interval: number; // 检查间隔（毫秒）
  readonly timeout: number; // 超时时间（毫秒）
  readonly retries: number; // 重试次数
  readonly thresholds: {
    healthy: HealthThreshold;
    degraded: HealthThreshold;
    unhealthy: HealthThreshold;
  };
  readonly metadata?: Record<string, any>;
}

/**
 * 健康阈值配置
 */
export interface HealthThreshold {
  responseTime?: number; // 响应时间阈值（毫秒）
  errorRate?: number; // 错误率阈值（百分比）
  successRate?: number; // 成功率阈值（百分比）
  consecutiveFailures?: number; // 连续失败次数
  availabilityPercentage?: number; // 可用性百分比
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  readonly checkId: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceType: ServiceType;
  readonly status: HealthStatus;
  readonly checkTime: Date;
  readonly responseTime: number;
  readonly errorRate: number;
  readonly successRate: number;
  readonly consecutiveFailures: number;
  readonly details: {
    message: string;
    error?: Error;
    metadata?: Record<string, any>;
    metrics?: Record<string, number>;
  };
  readonly recommendations?: string[];
}

/**
 * 服务依赖信息
 */
export interface ServiceDependency {
  readonly id: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly endpoint?: string;
  readonly critical: boolean; // 是否为关键依赖
  readonly healthChecks: HealthCheckConfig[];
  readonly recoveryStrategies: RecoveryStrategyConfig[];
  readonly metadata?: Record<string, any>;
}

/**
 * 恢复策略配置
 */
export interface RecoveryStrategyConfig {
  readonly id: string;
  readonly name: string;
  readonly strategy: RecoveryStrategy;
  readonly enabled: boolean;
  readonly triggers: {
    healthStatus: HealthStatus[];
    consecutiveFailures?: number;
    errorRate?: number;
  };
  readonly actions: RecoveryAction[];
  readonly cooldownPeriod: number; // 冷却期（毫秒）
  readonly maxAttempts: number; // 最大尝试次数
  readonly metadata?: Record<string, any>;
}

/**
 * 恢复操作
 */
export interface RecoveryAction {
  readonly type: string;
  readonly description: string;
  readonly timeout: number;
  readonly parameters?: Record<string, any>;
  readonly onSuccess?: string; // 成功后的操作
  readonly onFailure?: string; // 失败后的操作
}

/**
 * 恢复执行结果
 */
export interface RecoveryResult {
  readonly recoveryId: string;
  readonly serviceId: string;
  readonly strategy: RecoveryStrategy;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly success: boolean;
  readonly actions: Array<{
    type: string;
    success: boolean;
    duration: number;
    error?: Error;
    details?: Record<string, any>;
  }>;
  readonly details?: {
    message: string;
    error?: Error;
    metadata?: Record<string, any>;
  };
}

/**
 * 系统健康概览
 */
export interface SystemHealthOverview {
  readonly overallStatus: HealthStatus;
  readonly timestamp: Date;
  readonly totalServices: number;
  readonly healthyServices: number;
  readonly degradedServices: number;
  readonly unhealthyServices: number;
  readonly criticalIssues: number;
  readonly activeRecoveries: number;
  readonly uptime: number; // 运行时间（毫秒）
  readonly services: Record<string, HealthCheckResult>;
}

/**
 * 健康监控统计
 */
export interface HealthMonitoringStats {
  readonly period: {
    start: Date;
    end: Date;
    duration: number;
  };
  readonly totalChecks: number;
  readonly successfulChecks: number;
  readonly failedChecks: number;
  readonly averageResponseTime: number;
  readonly availabilityPercentage: number;
  readonly recoveryAttempts: number;
  readonly successfulRecoveries: number;
  readonly trends: Array<{
    timestamp: Date;
    status: HealthStatus;
    responseTime: number;
    errorRate: number;
  }>;
}

/**
 * 健康检查器接口
 */
export interface IHealthChecker {
  /**
   * 执行单个健康检查
   * @param checkConfig 检查配置
   * @returns Promise<HealthCheckResult> 检查结果
   */
  performCheck(checkConfig: HealthCheckConfig): Promise<HealthCheckResult>;

  /**
   * 批量执行健康检查
   * @param checkConfigs 检查配置数组
   * @returns Promise<HealthCheckResult[]> 检查结果数组
   */
  performBatchChecks(checkConfigs: HealthCheckConfig[]): Promise<HealthCheckResult[]>;

  /**
   * 注册自定义健康检查函数
   * @param checkType 检查类型
   * @param checkFunction 检查函数
   * @returns void
   */
  registerCustomCheck(
    checkType: string,
    checkFunction: (config: HealthCheckConfig) => Promise<HealthCheckResult>
  ): void;

  /**
   * 获取检查历史
   * @param serviceId 服务ID
   * @param limit 数量限制
   * @returns Promise<HealthCheckResult[]> 历史记录
   */
  getCheckHistory(serviceId: string, limit?: number): Promise<HealthCheckResult[]>;
}

/**
 * 自动恢复系统接口
 */
export interface IAutoRecoverySystem {
  /**
   * 执行恢复策略
   * @param serviceId 服务ID
   * @param strategy 恢复策略配置
   * @returns Promise<RecoveryResult> 恢复结果
   */
  executeRecovery(serviceId: string, strategy: RecoveryStrategyConfig): Promise<RecoveryResult>;

  /**
   * 注册自定义恢复操作
   * @param actionType 操作类型
   * @param actionFunction 操作函数
   * @returns void
   */
  registerCustomAction(
    actionType: string,
    actionFunction: (action: RecoveryAction, serviceId: string) => Promise<boolean>
  ): void;

  /**
   * 获取恢复历史
   * @param serviceId 服务ID
   * @param limit 数量限制
   * @returns Promise<RecoveryResult[]> 恢复历史
   */
  getRecoveryHistory(serviceId: string, limit?: number): Promise<RecoveryResult[]>;

  /**
   * 获取活跃的恢复操作
   * @returns Promise<RecoveryResult[]> 活跃恢复操作
   */
  getActiveRecoveries(): Promise<RecoveryResult[]>;
}

/**
 * 服务依赖监控接口
 */
export interface IDependencyMonitor {
  /**
   * 注册服务依赖
   * @param dependency 依赖信息
   * @returns Promise<void>
   */
  registerDependency(dependency: ServiceDependency): Promise<void>;

  /**
   * 移除服务依赖
   * @param dependencyId 依赖ID
   * @returns Promise<void>
   */
  removeDependency(dependencyId: string): Promise<void>;

  /**
   * 获取所有依赖状态
   * @returns Promise<Record<string, HealthCheckResult>> 依赖状态映射
   */
  getAllDependencyStatus(): Promise<Record<string, HealthCheckResult>>;

  /**
   * 获取关键依赖状态
   * @returns Promise<Record<string, HealthCheckResult>> 关键依赖状态
   */
  getCriticalDependencyStatus(): Promise<Record<string, HealthCheckResult>>;

  /**
   * 检查依赖链健康状态
   * @param serviceId 服务ID
   * @returns Promise<HealthCheckResult[]> 依赖链状态
   */
  checkDependencyChain(serviceId: string): Promise<HealthCheckResult[]>;
}

/**
 * 健康监控配置
 */
export interface HealthMonitorConfig extends ModuleConfig {
  readonly enabled: boolean;
  readonly globalCheckInterval: number; // 全局检查间隔
  readonly enableAutoRecovery: boolean; // 启用自动恢复
  readonly maxConcurrentChecks: number; // 最大并发检查数
  readonly healthCheckTimeout: number; // 健康检查超时
  readonly retryAttempts: number; // 重试尝试次数
  readonly enableNotifications: boolean; // 启用通知
  readonly persistHealthHistory: boolean; // 持久化健康历史
  readonly historyRetentionDays: number; // 历史保留天数
  readonly dashboardPort?: number; // 仪表板端口
}

/**
 * 健康监控主模块接口
 */
export interface IHealthMonitor extends IModule {
  readonly config: HealthMonitorConfig;
  readonly checker: IHealthChecker;
  readonly autoRecovery: IAutoRecoverySystem;
  readonly dependencyMonitor: IDependencyMonitor;

  /**
   * 开始监控
   * @param services 服务依赖数组
   * @returns Promise<void>
   */
  startMonitoring(services: ServiceDependency[]): Promise<void>;

  /**
   * 停止监控
   * @returns Promise<void>
   */
  stopMonitoring(): Promise<void>;

  /**
   * 获取系统健康概览
   * @returns Promise<SystemHealthOverview> 系统健康概览
   */
  getSystemOverview(): Promise<SystemHealthOverview>;

  /**
   * 获取监控统计信息
   * @param period 时间段
   * @returns Promise<HealthMonitoringStats> 监控统计
   */
  getMonitoringStats(period: { start: Date; end: Date }): Promise<HealthMonitoringStats>;

  /**
   * 触发手动健康检查
   * @param serviceId 服务ID（可选，不传则检查所有服务）
   * @returns Promise<HealthCheckResult[]> 检查结果
   */
  triggerHealthCheck(serviceId?: string): Promise<HealthCheckResult[]>;

  /**
   * 触发手动恢复
   * @param serviceId 服务ID
   * @param strategyId 恢复策略ID（可选）
   * @returns Promise<RecoveryResult> 恢复结果
   */
  triggerRecovery(serviceId: string, strategyId?: string): Promise<RecoveryResult>;

  /**
   * 获取健康状态API端点
   * @returns string API端点URL
   */
  getHealthApiEndpoint(): string;
}

/**
 * 健康监控事件类型
 */
export interface HealthMonitorEvents {
  'health-check-completed': (result: HealthCheckResult) => void;
  'health-status-changed': (serviceId: string, oldStatus: HealthStatus, newStatus: HealthStatus) => void;
  'recovery-started': (serviceId: string, strategy: RecoveryStrategy) => void;
  'recovery-completed': (result: RecoveryResult) => void;
  'dependency-failure': (dependency: ServiceDependency, result: HealthCheckResult) => void;
  'system-degraded': (overview: SystemHealthOverview) => void;
  'system-unhealthy': (overview: SystemHealthOverview) => void;
  'monitoring-started': (services: ServiceDependency[]) => void;
  'monitoring-stopped': () => void;
}