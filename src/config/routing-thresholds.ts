/**
 * 路由阈值配置 - 替代硬编码值
 * 
 * @author RCC v4.0 Security Hardening
 */

export interface RoutingThresholds {
  tokenLimits: {
    longContextMin: number;
    defaultMax: number;
    extremeLongContext: number;
  };
  performance: {
    requestTimeoutMs: number;
    longRequestTimeoutMs: number;
    heartbeatIntervalMs: number;
  };
  tokenEstimation: {
    // 更精确的token估算参数
    charsPerTokenEstimate: number;
    toolDefinitionMultiplier: number;
    systemMessageMultiplier: number;
  };
  security: {
    maxConcurrentRequests: number;
    rateLimitWindow: number;
    roundRobinLockTimeout: number;
  };
}

/**
 * 默认路由阈值配置
 * 可通过环境变量或配置文件覆盖
 */
export const DEFAULT_ROUTING_THRESHOLDS: RoutingThresholds = {
  tokenLimits: {
    longContextMin: parseInt(process.env.RCC_LONG_CONTEXT_MIN_TOKENS || '60000'),
    defaultMax: parseInt(process.env.RCC_DEFAULT_MAX_TOKENS || '32000'),
    extremeLongContext: parseInt(process.env.RCC_EXTREME_CONTEXT_TOKENS || '200000'),
  },
  performance: {
    requestTimeoutMs: parseInt(process.env.RCC_REQUEST_TIMEOUT_MS || '120000'),
    longRequestTimeoutMs: parseInt(process.env.RCC_LONG_REQUEST_TIMEOUT_MS || '600000'),
    heartbeatIntervalMs: parseInt(process.env.RCC_HEARTBEAT_INTERVAL_MS || '30000'),
  },
  tokenEstimation: {
    charsPerTokenEstimate: parseFloat(process.env.RCC_CHARS_PER_TOKEN || '3.5'), // 更准确的估算
    toolDefinitionMultiplier: parseFloat(process.env.RCC_TOOL_TOKEN_MULTIPLIER || '1.2'),
    systemMessageMultiplier: parseFloat(process.env.RCC_SYSTEM_TOKEN_MULTIPLIER || '1.1'),
  },
  security: {
    maxConcurrentRequests: parseInt(process.env.RCC_MAX_CONCURRENT_REQUESTS || '100'),
    rateLimitWindow: parseInt(process.env.RCC_RATE_LIMIT_WINDOW || '60000'),
    roundRobinLockTimeout: parseInt(process.env.RCC_RR_LOCK_TIMEOUT || '5000'),
  },
};

/**
 * 获取当前路由阈值配置
 * 优先级: 运行时配置 > 环境变量 > 默认值
 */
export function getRoutingThresholds(): RoutingThresholds {
  // TODO: 添加从配置文件加载的逻辑
  return DEFAULT_ROUTING_THRESHOLDS;
}

/**
 * 更精确的token数量估算
 */
export function estimateTokenCount(
  content: string, 
  type: 'message' | 'system' | 'tool' = 'message',
  thresholds = DEFAULT_ROUTING_THRESHOLDS
): number {
  const baseEstimate = Math.ceil(content.length / thresholds.tokenEstimation.charsPerTokenEstimate);
  
  switch (type) {
    case 'system':
      return Math.ceil(baseEstimate * thresholds.tokenEstimation.systemMessageMultiplier);
    case 'tool':
      return Math.ceil(baseEstimate * thresholds.tokenEstimation.toolDefinitionMultiplier);
    case 'message':
    default:
      return baseEstimate;
  }
}