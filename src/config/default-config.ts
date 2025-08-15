/**
 * 默认配置定义
 * 
 * 提供系统的默认配置值，支持环境变量覆盖
 * 
 * @author Jason Zhang
 */

/**
 * 获取环境变量或默认值
 */
function getEnvValue(envKey: string, defaultValue: string): string;
function getEnvValue(envKey: string, defaultValue: number): number;
function getEnvValue(envKey: string, defaultValue: boolean): boolean;
function getEnvValue(envKey: string, defaultValue: any): any {
  const envValue = process.env[envKey];
  
  if (envValue === undefined) {
    return defaultValue;
  }

  if (typeof defaultValue === 'number') {
    const parsed = parseFloat(envValue);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  if (typeof defaultValue === 'boolean') {
    return envValue.toLowerCase() === 'true' || envValue === '1';
  }

  return envValue;
}

/**
 * 服务器默认配置
 */
export const DEFAULT_SERVER_CONFIG = {
  port: getEnvValue('RCC_PORT', 3456),
  host: getEnvValue('RCC_HOST', '0.0.0.0'),
  debug: getEnvValue('RCC_DEBUG', false)
};

/**
 * 客户端默认配置
 */
export const DEFAULT_CLIENT_CONFIG = {
  autoStart: getEnvValue('RCC_AUTO_START', false),
  export: getEnvValue('RCC_EXPORT', false)
};

/**
 * 通用系统配置
 */
export const DEFAULT_SYSTEM_CONFIG = {
  timeout: getEnvValue('RCC_TIMEOUT', 30000),
  retryCount: getEnvValue('RCC_RETRY_COUNT', 3),
  logLevel: getEnvValue('RCC_LOG_LEVEL', 'info')
};

/**
 * 配置热重载默认配置
 */
export const DEFAULT_HOT_RELOAD_CONFIG = {
  autoReload: getEnvValue('RCC_AUTO_RELOAD', true),
  validationLevel: getEnvValue('RCC_VALIDATION_LEVEL', 'basic'),
  backupEnabled: getEnvValue('RCC_BACKUP_ENABLED', true),
  maxVersions: getEnvValue('RCC_MAX_VERSIONS', 100),
  debounceDelay: getEnvValue('RCC_DEBOUNCE_DELAY', 300),
  maxRetries: getEnvValue('RCC_MAX_RETRIES', 3),
  enableRollback: getEnvValue('RCC_ENABLE_ROLLBACK', true)
};

/**
 * 健康检查默认配置
 */
export const DEFAULT_HEALTH_CONFIG = {
  checkInterval: getEnvValue('RCC_HEALTH_CHECK_INTERVAL', 30000),
  enableAutoRecovery: getEnvValue('RCC_AUTO_RECOVERY', true),
  maxConcurrentChecks: getEnvValue('RCC_MAX_CONCURRENT_CHECKS', 10),
  healthCheckTimeout: getEnvValue('RCC_HEALTH_TIMEOUT', 10000),
  retryAttempts: getEnvValue('RCC_HEALTH_RETRY_ATTEMPTS', 3),
  enableNotifications: getEnvValue('RCC_HEALTH_NOTIFICATIONS', true),
  dashboardPort: getEnvValue('RCC_DASHBOARD_PORT', 8080)
};

/**
 * 安全配置
 */
export const DEFAULT_SECURITY_CONFIG = {
  cors: {
    enabled: getEnvValue('RCC_CORS_ENABLED', false),
    origins: (getEnvValue('RCC_CORS_ORIGINS', '') as string).split(',').filter(Boolean),
    credentials: getEnvValue('RCC_CORS_CREDENTIALS', false)
  },
  rateLimit: {
    enabled: getEnvValue('RCC_RATE_LIMIT_ENABLED', true),
    windowMs: getEnvValue('RCC_RATE_LIMIT_WINDOW', 60000),
    maxRequests: getEnvValue('RCC_RATE_LIMIT_MAX', 100)
  },
  auth: {
    enabled: getEnvValue('RCC_AUTH_ENABLED', false),
    secret: process.env.RCC_AUTH_SECRET || undefined,
    tokenExpiry: getEnvValue('RCC_TOKEN_EXPIRY', 3600)
  }
};

/**
 * 获取完整的默认配置
 */
export function getDefaultConfig() {
  return {
    server: DEFAULT_SERVER_CONFIG,
    client: DEFAULT_CLIENT_CONFIG,
    system: DEFAULT_SYSTEM_CONFIG,
    hotReload: DEFAULT_HOT_RELOAD_CONFIG,
    health: DEFAULT_HEALTH_CONFIG,
    security: DEFAULT_SECURITY_CONFIG
  };
}

/**
 * 验证必需的环境变量
 */
export function validateRequiredEnvVars(): void {
  const required = [
    // 添加必需的环境变量
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}