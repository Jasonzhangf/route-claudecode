/**
 * 常量模块统一导出
 *
 * 提供所有系统常量的统一访问点
 *
 * @author Jason Zhang
 */

// 服务器相关常量
export * from './server-defaults';

// 超时相关常量
export * from './timeout-defaults';

// API相关常量
export * from './api-defaults';

/**
 * 所有常量的命名空间导出
 */
export { SERVER_DEFAULTS } from './server-defaults';
export { TIMEOUT_DEFAULTS } from './timeout-defaults';
export { API_DEFAULTS } from './api-defaults';

// 导入常量用于内部使用
import { SERVER_DEFAULTS } from './server-defaults';
import { TIMEOUT_DEFAULTS } from './timeout-defaults';
import { API_DEFAULTS } from './api-defaults';

/**
 * 常量验证工具
 */
export const CONSTANTS_VALIDATION = {
  /**
   * 验证所有必要的环境变量是否设置
   */
  validateEnvironment(): { valid: boolean; missing: string[]; warnings: string[] } {
    const required: string[] = [];
    const optional = [
      'RCC_SERVER_PORT',
      'RCC_SERVER_HOST',
      'RCC_HTTP_REQUEST_TIMEOUT',
      'RCC_CONNECTION_TIMEOUT',
      'RCC_HEALTH_CHECK_INTERVAL',
      'LMSTUDIO_BASE_URL',
      'RCC_LMSTUDIO_ENDPOINT',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);
    const warnings = optional.filter(key => !process.env[key]);

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  },

  /**
   * 获取当前配置摘要
   */
  getConfigSummary(): Record<string, any> {
    return {
      server: {
        port: process.env.RCC_SERVER_PORT || SERVER_DEFAULTS.HTTP.PORT,
        host: process.env.RCC_SERVER_HOST || SERVER_DEFAULTS.HTTP.HOST,
      },
      providers: {
        lmstudio:
          process.env.LMSTUDIO_BASE_URL ||
          process.env.RCC_LMSTUDIO_ENDPOINT ||
          API_DEFAULTS.PROVIDERS.LMSTUDIO.BASE_URL,
        anthropic: process.env.ANTHROPIC_BASE_URL || API_DEFAULTS.PROVIDERS.ANTHROPIC.BASE_URL,
        openai: process.env.OPENAI_BASE_URL || API_DEFAULTS.PROVIDERS.OPENAI.BASE_URL,
        gemini: process.env.GEMINI_BASE_URL || API_DEFAULTS.PROVIDERS.GEMINI.BASE_URL,
      },
      timeouts: {
        httpRequest: process.env.RCC_HTTP_REQUEST_TIMEOUT || TIMEOUT_DEFAULTS.HTTP.REQUEST_TIMEOUT,
        connection: process.env.RCC_CONNECTION_TIMEOUT || TIMEOUT_DEFAULTS.HTTP.CONNECTION_TIMEOUT,
        healthCheck: process.env.RCC_HEALTH_CHECK_INTERVAL || TIMEOUT_DEFAULTS.HEALTH_CHECK.INTERVAL,
      },
    };
  },
} as const;
