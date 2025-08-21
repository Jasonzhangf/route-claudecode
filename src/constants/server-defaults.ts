/**
 * 服务器默认值常量
 * 
 * 包含所有服务器相关的默认配置值
 * 任何涉及服务器端口、主机、连接的硬编码都应定义在此文件中
 * 
 * @module ServerDefaults
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

/**
 * 基础服务器默认配置常量
 */
export const SERVER_DEFAULTS = {
  // HTTP服务器配置
  HTTP: {
    PORT: 5506,              // 主要端口，统一使用5506
    FALLBACK_PORT: 3456,     // 备用端口，向后兼容
    HOST: '0.0.0.0',         // 默认绑定所有接口
    MAX_REQUEST_SIZE: 50 * 1024 * 1024, // 50MB，增加到50MB
    KEEP_ALIVE_TIMEOUT: 30000, // 30秒
    CONNECTION_TIMEOUT: 5000,   // 5秒连接超时
    REQUEST_TIMEOUT: 30000,     // 30秒请求超时
    SHUTDOWN_TIMEOUT: 10000,    // 10秒优雅关闭超时
  },

  // CORS配置
  CORS: {
    ALLOWED_ORIGINS: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    CREDENTIALS: true,
  },

  // 中间件配置
  MIDDLEWARE: {
    RATE_LIMIT: {
      MAX_REQUESTS: 1000,
      WINDOW_MS: 60000, // 1分钟
      MESSAGE: 'Too many requests from this IP',
    },
  },
} as const;

/**
 * 获取服务器端口
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getServerPort(configPort?: number): number {
  const envPort = process.env.RCC_SERVER_PORT || process.env.PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return configPort ?? SERVER_DEFAULTS.HTTP.PORT;
}

/**
 * 获取服务器主机地址
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getServerHost(configHost?: string): string {
  return process.env.RCC_SERVER_HOST || configHost || SERVER_DEFAULTS.HTTP.HOST;
}

/**
 * 获取最大请求大小
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getMaxRequestSize(configSize?: number): number {
  const envSize = process.env.RCC_MAX_REQUEST_SIZE;
  if (envSize) {
    const parsed = parseInt(envSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configSize ?? SERVER_DEFAULTS.HTTP.MAX_REQUEST_SIZE;
}

/**
 * 获取Keep-Alive超时时间
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getKeepAliveTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_KEEP_ALIVE_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? SERVER_DEFAULTS.HTTP.KEEP_ALIVE_TIMEOUT;
}

/**
 * 获取CORS配置
 */
export function getCorsConfig(configCors?: Partial<typeof SERVER_DEFAULTS.CORS>) {
  return {
    origin: configCors?.ALLOWED_ORIGINS ?? SERVER_DEFAULTS.CORS.ALLOWED_ORIGINS,
    methods: configCors?.ALLOWED_METHODS ?? SERVER_DEFAULTS.CORS.ALLOWED_METHODS,
    allowedHeaders: configCors?.ALLOWED_HEADERS ?? SERVER_DEFAULTS.CORS.ALLOWED_HEADERS,
    credentials: configCors?.CREDENTIALS ?? SERVER_DEFAULTS.CORS.CREDENTIALS,
  };
}

/**
 * 获取速率限制配置
 */
export function getRateLimitConfig(configRateLimit?: Partial<typeof SERVER_DEFAULTS.MIDDLEWARE.RATE_LIMIT>) {
  return {
    maxRequests: configRateLimit?.MAX_REQUESTS ?? SERVER_DEFAULTS.MIDDLEWARE.RATE_LIMIT.MAX_REQUESTS,
    windowMs: configRateLimit?.WINDOW_MS ?? SERVER_DEFAULTS.MIDDLEWARE.RATE_LIMIT.WINDOW_MS,
    message: configRateLimit?.MESSAGE ?? SERVER_DEFAULTS.MIDDLEWARE.RATE_LIMIT.MESSAGE,
  };
}

/**
 * 构建服务器URL
 */
export function buildServerUrl(host?: string, port?: number, protocol: 'http' | 'https' = 'http'): string {
  const finalHost = getServerHost(host);
  const finalPort = getServerPort(port);
  return `${protocol}://${finalHost}:${finalPort}`;
}

/**
 * 验证端口号是否有效
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * 验证主机地址是否有效
 */
export function isValidHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;

  // localhost
  if (host === 'localhost') return true;

  // IP地址验证
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipPattern.test(host)) {
    const parts = host.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // 域名验证
  const hostnamePattern = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
  return hostnamePattern.test(host);
}
