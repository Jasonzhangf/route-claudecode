/**
 * Router模块默认配置常量
 * 
 * 集中管理所有Router相关的硬编码值，遵循零硬编码原则
 * 所有Router模块配置都应该引用这些常量
 * 
 * @module RouterDefaults
 * @version 4.0.0-beta.1
 * @lastUpdated 2025-08-21
 * @author RCC v4.0 Team
 */

// =============================================================================
// 基础配置常量
// =============================================================================

/**
 * 路由器核心默认配置
 */
export const ROUTER_DEFAULTS = {
  /** 默认请求超时时间 (毫秒) - 增加到60秒支持更长处理 */
  TIMEOUT: 60000,
  
  /** 默认重试次数 */
  RETRY_ATTEMPTS: 3,
  
  /** 流水线批处理大小 */
  PIPELINE_BATCH_SIZE: 10,
  
  /** 默认负载均衡策略 */
  LOAD_BALANCE_STRATEGY: 'round-robin',
  
  /** 路由缓存TTL (毫秒) */
  ROUTE_CACHE_TTL: 300000,
  
  /** 最大并发请求数 */
  MAX_CONCURRENT_REQUESTS: 100,
  
  /** 健康检查间隔 (毫秒) */
  HEALTH_CHECK_INTERVAL: 60000,
  
  /** 连接超时时间 (毫秒) */
  CONNECTION_TIMEOUT: 5000,
  
  /** 最大连接数 */
  MAX_CONNECTIONS: 50
} as const;

// =============================================================================
// 路由表配置常量
// =============================================================================

/**
 * 路由表默认配置
 */
export const ROUTING_TABLE_DEFAULTS = {
  /** 路由表更新间隔 (毫秒) */
  UPDATE_INTERVAL: 60000,
  
  /** 路由缓存TTL (毫秒) */
  CACHE_TTL: 300000,
  
  /** 最大路由条目数 */
  MAX_ENTRIES: 1000,
  
  /** 路由匹配超时 (毫秒) */
  MATCH_TIMEOUT: 5000,
  
  /** 默认路由优先级 */
  DEFAULT_PRIORITY: 100,
  
  /** 路由验证超时 (毫秒) */
  VALIDATION_TIMEOUT: 10000
} as const;

// =============================================================================
// 负载均衡配置常量
// =============================================================================

/**
 * 负载均衡器默认配置
 */
export const LOAD_BALANCER_DEFAULTS = {
  /** 默认负载均衡策略 */
  STRATEGY: 'round-robin' as const,
  
  /** 健康检查间隔 (毫秒) */
  HEALTH_CHECK_INTERVAL: 30000,
  
  /** 最大连接数 */
  MAX_CONNECTIONS: 100,
  
  /** 连接超时时间 (毫秒) */
  CONNECTION_TIMEOUT: 5000,
  
  /** 权重调整间隔 (毫秒) */
  WEIGHT_ADJUSTMENT_INTERVAL: 60000,
  
  /** 最小权重值 */
  MIN_WEIGHT: 0.1,
  
  /** 最大权重值 */
  MAX_WEIGHT: 10.0,
  
  /** 默认权重值 */
  DEFAULT_WEIGHT: 1.0,
  
  /** 错误阈值 (百分比) */
  ERROR_THRESHOLD: 0.1,
  
  /** 熔断器超时 (毫秒) */
  CIRCUIT_BREAKER_TIMEOUT: 60000
} as const;

// =============================================================================
// 会话控制配置常量
// =============================================================================

/**
 * 会话控制默认配置
 */
export const SESSION_CONTROL_DEFAULTS = {
  /** 最大会话数 */
  MAX_SESSIONS: 1000,
  
  /** 会话超时时间 (毫秒) */
  SESSION_TIMEOUT: 1800000, // 30分钟
  
  /** 每个会话最大请求数 */
  MAX_REQUESTS_PER_SESSION: 100,
  
  /** 会话清理间隔 (毫秒) */
  SESSION_CLEANUP_INTERVAL: 300000, // 5分钟
  
  /** 流控队列大小 */
  FLOW_CONTROL_QUEUE_SIZE: 100,
  
  /** 流控超时时间 (毫秒) */
  FLOW_CONTROL_TIMEOUT: 30000,
  
  /** 会话心跳间隔 (毫秒) */
  SESSION_HEARTBEAT_INTERVAL: 60000
} as const;

// =============================================================================
// 流水线配置常量
// =============================================================================

/**
 * 流水线默认配置
 */
export const PIPELINE_DEFAULTS = {
  /** 流水线初始化超时 (毫秒) */
  INITIALIZATION_TIMEOUT: 30000,
  
  /** 流水线处理超时 (毫秒) - longcontext任务需要200秒 */
  PROCESSING_TIMEOUT: 200000,
  
  /** 流水线空闲超时 (毫秒) */
  IDLE_TIMEOUT: 300000,
  
  /** 最大重试次数 */
  MAX_RETRIES: 3,
  
  /** 重试延迟 (毫秒) */
  RETRY_DELAY: 1000,
  
  /** 流水线预热请求数 */
  WARMUP_REQUESTS: 5,
  
  /** 健康检查超时 (毫秒) */
  HEALTH_CHECK_TIMEOUT: 10000,
  
  /** 指标收集间隔 (毫秒) */
  METRICS_COLLECTION_INTERVAL: 30000
} as const;

// =============================================================================
// 性能和监控配置常量
// =============================================================================

/**
 * 性能监控默认配置
 */
export const PERFORMANCE_DEFAULTS = {
  /** 响应时间警告阈值 (毫秒) */
  RESPONSE_TIME_WARNING_THRESHOLD: 5000,
  
  /** 响应时间错误阈值 (毫秒) */
  RESPONSE_TIME_ERROR_THRESHOLD: 10000,
  
  /** 错误率警告阈值 (百分比) */
  ERROR_RATE_WARNING_THRESHOLD: 0.05,
  
  /** 错误率错误阈值 (百分比) */
  ERROR_RATE_ERROR_THRESHOLD: 0.1,
  
  /** 内存使用警告阈值 (MB) */
  MEMORY_WARNING_THRESHOLD: 200,
  
  /** 内存使用错误阈值 (MB) */
  MEMORY_ERROR_THRESHOLD: 500,
  
  /** CPU使用率警告阈值 (百分比) */
  CPU_WARNING_THRESHOLD: 0.8,
  
  /** CPU使用率错误阈值 (百分比) */
  CPU_ERROR_THRESHOLD: 0.95,
  
  /** 指标保留期 (毫秒) */
  METRICS_RETENTION_PERIOD: 86400000 // 24小时
} as const;

// =============================================================================
// 预定义配置组合
// =============================================================================

/**
 * SimpleRouter配置
 * 简化的路由器配置，用于基本用例
 */
export const SIMPLE_ROUTER_CONFIG = {
  timeout: ROUTER_DEFAULTS.TIMEOUT,
  retryAttempts: 1,
  loadBalancer: {
    strategy: 'simple' as const,
    healthCheckInterval: LOAD_BALANCER_DEFAULTS.HEALTH_CHECK_INTERVAL,
    maxConnections: 10,
    connectionTimeout: LOAD_BALANCER_DEFAULTS.CONNECTION_TIMEOUT
  },
  routingTable: {
    updateInterval: ROUTING_TABLE_DEFAULTS.UPDATE_INTERVAL,
    cacheTTL: ROUTING_TABLE_DEFAULTS.CACHE_TTL,
    maxEntries: 100,
    validationEnabled: false
  },
  sessionControl: {
    maxSessions: 100,
    sessionTimeout: SESSION_CONTROL_DEFAULTS.SESSION_TIMEOUT,
    maxRequestsPerSession: 50,
    flowControlEnabled: false
  }
} as const;

/**
 * PipelineRouter配置
 * 完整功能的路由器配置，用于生产环境
 */
export const PIPELINE_ROUTER_CONFIG = {
  timeout: ROUTER_DEFAULTS.TIMEOUT,
  retryAttempts: ROUTER_DEFAULTS.RETRY_ATTEMPTS,
  loadBalancer: {
    strategy: LOAD_BALANCER_DEFAULTS.STRATEGY,
    healthCheckInterval: LOAD_BALANCER_DEFAULTS.HEALTH_CHECK_INTERVAL,
    maxConnections: LOAD_BALANCER_DEFAULTS.MAX_CONNECTIONS,
    connectionTimeout: LOAD_BALANCER_DEFAULTS.CONNECTION_TIMEOUT
  },
  routingTable: {
    updateInterval: ROUTING_TABLE_DEFAULTS.UPDATE_INTERVAL,
    cacheTTL: ROUTING_TABLE_DEFAULTS.CACHE_TTL,
    maxEntries: ROUTING_TABLE_DEFAULTS.MAX_ENTRIES,
    validationEnabled: true
  },
  sessionControl: {
    maxSessions: SESSION_CONTROL_DEFAULTS.MAX_SESSIONS,
    sessionTimeout: SESSION_CONTROL_DEFAULTS.SESSION_TIMEOUT,
    maxRequestsPerSession: SESSION_CONTROL_DEFAULTS.MAX_REQUESTS_PER_SESSION,
    flowControlEnabled: true
  }
} as const;

/**
 * 开发环境配置
 * 适用于开发和测试环境的配置
 */
export const DEVELOPMENT_ROUTER_CONFIG = {
  timeout: 10000, // 较短的超时时间便于调试
  retryAttempts: 1,
  loadBalancer: {
    strategy: 'round-robin' as const,
    healthCheckInterval: 10000, // 更频繁的健康检查
    maxConnections: 5,
    connectionTimeout: 3000
  },
  routingTable: {
    updateInterval: 10000, // 更频繁的更新
    cacheTTL: 60000, // 较短的缓存时间
    maxEntries: 50,
    validationEnabled: true
  },
  sessionControl: {
    maxSessions: 10,
    sessionTimeout: 300000, // 5分钟
    maxRequestsPerSession: 20,
    flowControlEnabled: true
  }
} as const;

// =============================================================================
// 路由器类型常量
// =============================================================================

/**
 * 支持的负载均衡策略
 */
export const LOAD_BALANCE_STRATEGIES = {
  ROUND_ROBIN: 'round_robin',
  LEAST_CONNECTIONS: 'least_connections',
  RANDOM: 'random',
  PRIORITY_BASED: 'priority_based'
} as const;

/**
 * 路由器状态常量
 */
export const ROUTER_STATUS = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  RUNNING: 'running',
  ERROR: 'error',
  SHUTDOWN: 'shutdown'
} as const;

/**
 * 流水线状态常量
 */
export const PIPELINE_STATUS = {
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline',
  WARMING_UP: 'warming-up'
} as const;

/**
 * 健康检查状态常量
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
} as const;

/**
 * 健康检查结果常量
 */
export const HEALTH_CHECK_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  WARN: 'warn'
} as const;

// =============================================================================
// 版本和兼容性常量
// =============================================================================

/**
 * 路由器模块版本信息
 */
export const ROUTER_MODULE_VERSION = '4.0.0-beta.1';

/**
 * 兼容的接口版本
 */
export const COMPATIBLE_INTERFACE_VERSIONS = [
  '4.0.0',
  '4.0.0-beta.1',
  '4.0.0-alpha.1'
] as const;

/**
 * 最小支持的配置版本
 */
export const MIN_CONFIG_VERSION = '4.0.0';

// =============================================================================
// 导出类型定义
// =============================================================================

export type LoadBalanceStrategy = typeof LOAD_BALANCE_STRATEGIES[keyof typeof LOAD_BALANCE_STRATEGIES];
export type RouterStatus = typeof ROUTER_STATUS[keyof typeof ROUTER_STATUS];
export type PipelineStatus = typeof PIPELINE_STATUS[keyof typeof PIPELINE_STATUS];
export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];
export type HealthCheckResult = typeof HEALTH_CHECK_RESULT[keyof typeof HEALTH_CHECK_RESULT];