/**
 * 超时相关默认常量
 *
 * 集中管理所有超时配置的默认值，支持环境变量覆盖
 *
 * @author Jason Zhang
 */

/**
 * 超时默认配置常量
 */
export const TIMEOUT_DEFAULTS = {
  // HTTP请求超时
  HTTP: {
    REQUEST_TIMEOUT: 30000, // 30秒 - HTTP请求超时
    CONNECTION_TIMEOUT: 5000, // 5秒 - 连接超时
    SOCKET_TIMEOUT: 30000, // 30秒 - Socket超时
    KEEP_ALIVE_TIMEOUT: 30000, // 30秒 - Keep-Alive超时
  },

  // 健康检查超时
  HEALTH_CHECK: {
    INTERVAL: 30000, // 30秒 - 健康检查间隔
    TIMEOUT: 5000, // 5秒 - 健康检查超时
    RETRY_INTERVAL: 10000, // 10秒 - 重试间隔
  },

  // Provider相关超时
  PROVIDER: {
    REQUEST_TIMEOUT: 30000, // 30秒 - Provider请求超时
    RECONNECT_TIMEOUT: 5000, // 5秒 - 重连超时
    COOLDOWN_TIMEOUT: 300000, // 5分钟 - 冷却超时
    CIRCUIT_BREAKER_TIMEOUT: 60000, // 1分钟 - 断路器超时
  },

  // 缓存超时
  CACHE: {
    DEFAULT_TTL: 300000, // 5分钟 - 默认缓存TTL
    CONFIG_TTL: 600000, // 10分钟 - 配置缓存TTL
    METRICS_TTL: 60000, // 1分钟 - 指标缓存TTL
  },

  // 监控和指标收集超时
  MONITORING: {
    METRICS_INTERVAL: 30000, // 30秒 - 指标收集间隔
    ALERT_CHECK_INTERVAL: 30000, // 30秒 - 告警检查间隔
    SILENCE_WINDOW: 300000, // 5分钟 - 告警静默窗口
    PERFORMANCE_WINDOW: 30000, // 30秒 - 性能监控窗口
  },

  // 重试和退避策略
  RETRY: {
    MAX_RETRY_DELAY: 30000, // 30秒 - 最大重试延迟
    INITIAL_RETRY_DELAY: 1000, // 1秒 - 初始重试延迟
    BACKOFF_MULTIPLIER: 2, // 退避倍数
    MAX_RETRIES: 3, // 最大重试次数
  },

  // Debug和调试超时
  DEBUG: {
    REPLAY_TIMEOUT: 30000, // 30秒 - 回放超时
    TRACE_TIMEOUT: 10000, // 10秒 - 跟踪超时
    SNAPSHOT_INTERVAL: 60000, // 1分钟 - 快照间隔
  },
} as const;

/**
 * 获取HTTP请求超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getHttpRequestTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_HTTP_REQUEST_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.HTTP.REQUEST_TIMEOUT;
}

/**
 * 获取连接超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getConnectionTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_CONNECTION_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.HTTP.CONNECTION_TIMEOUT;
}

/**
 * 获取健康检查间隔
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getHealthCheckInterval(configInterval?: number): number {
  const envInterval = process.env.RCC_HEALTH_CHECK_INTERVAL;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configInterval ?? TIMEOUT_DEFAULTS.HEALTH_CHECK.INTERVAL;
}

/**
 * 获取健康检查超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getHealthCheckTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_HEALTH_CHECK_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.HEALTH_CHECK.TIMEOUT;
}

/**
 * 获取Provider请求超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getProviderRequestTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_PROVIDER_REQUEST_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.PROVIDER.REQUEST_TIMEOUT;
}

/**
 * 获取重连超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getReconnectTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_RECONNECT_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.PROVIDER.RECONNECT_TIMEOUT;
}

/**
 * 获取冷却超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getCooldownTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_COOLDOWN_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.PROVIDER.COOLDOWN_TIMEOUT;
}

/**
 * 获取缓存TTL
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getCacheTTL(configTTL?: number): number {
  const envTTL = process.env.RCC_CACHE_TTL;
  if (envTTL) {
    const parsed = parseInt(envTTL, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTTL ?? TIMEOUT_DEFAULTS.CACHE.DEFAULT_TTL;
}

/**
 * 获取指标收集间隔
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getMetricsInterval(configInterval?: number): number {
  const envInterval = process.env.RCC_METRICS_INTERVAL;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configInterval ?? TIMEOUT_DEFAULTS.MONITORING.METRICS_INTERVAL;
}

/**
 * 获取回放超时
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getReplayTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_REPLAY_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.DEBUG.REPLAY_TIMEOUT;
}

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(retryCount: number, baseDelay?: number, maxDelay?: number): number {
  const base = baseDelay ?? TIMEOUT_DEFAULTS.RETRY.INITIAL_RETRY_DELAY;
  const max = maxDelay ?? TIMEOUT_DEFAULTS.RETRY.MAX_RETRY_DELAY;
  const delay = base * Math.pow(TIMEOUT_DEFAULTS.RETRY.BACKOFF_MULTIPLIER, retryCount);
  return Math.min(delay, max);
}

/**
 * 验证超时值是否有效
 */
export function isValidTimeout(timeout: number): boolean {
  return Number.isInteger(timeout) && timeout > 0 && timeout <= 300000; // 最大5分钟
}

/**
 * 获取所有超时配置的摘要
 */
export function getTimeoutSummary(customConfig?: Record<string, number>): Record<string, number> {
  return {
    httpRequestTimeout: getHttpRequestTimeout(customConfig?.httpRequestTimeout),
    connectionTimeout: getConnectionTimeout(customConfig?.connectionTimeout),
    healthCheckInterval: getHealthCheckInterval(customConfig?.healthCheckInterval),
    healthCheckTimeout: getHealthCheckTimeout(customConfig?.healthCheckTimeout),
    providerRequestTimeout: getProviderRequestTimeout(customConfig?.providerRequestTimeout),
    reconnectTimeout: getReconnectTimeout(customConfig?.reconnectTimeout),
    cooldownTimeout: getCooldownTimeout(customConfig?.cooldownTimeout),
    cacheTTL: getCacheTTL(customConfig?.cacheTTL),
    metricsInterval: getMetricsInterval(customConfig?.metricsInterval),
    replayTimeout: getReplayTimeout(customConfig?.replayTimeout),
  };
}
