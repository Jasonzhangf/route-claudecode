/**
 * Constants统一导出文件
 * 
 * 统一导出所有常量模块，方便其他模块导入
 * 
 * @module Constants
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

// 导出所有常量模块
export * from './api-defaults';
export * from './server-defaults';
export * from './timeout-defaults';
export * from './error-messages';
export * from './model-mappings';
export * from './router-defaults';
export * from './cli-defaults';
export * from './refactoring-constants';

// 重新导出主要常量对象以便快速访问
export { API_DEFAULTS } from './api-defaults';
export { SERVER_DEFAULTS } from './server-defaults';
export { TIMEOUT_DEFAULTS, getProviderRequestTimeout, getHttpRequestTimeout } from './timeout-defaults';
export { ERROR_MESSAGES } from './error-messages';
export { SUPPORTED_MODELS, VIRTUAL_MODELS, MODEL_CAPABILITIES } from './model-mappings';
export { ROUTER_DEFAULTS, LOAD_BALANCER_DEFAULTS, PIPELINE_DEFAULTS } from './router-defaults';
export { CLI_DEFAULTS, CLI_COMMANDS, CLI_MESSAGES } from './cli-defaults';
export { REFACTORING_GOALS, REFACTORING_PRINCIPLES, REFACTORING_PHASES } from './refactoring-constants';

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
        httpRequest: process.env.RCC_HTTP_REQUEST_TIMEOUT || SERVER_DEFAULTS.HTTP.REQUEST_TIMEOUT,
        connection: process.env.RCC_CONNECTION_TIMEOUT || SERVER_DEFAULTS.HTTP.CONNECTION_TIMEOUT,
        healthCheck: process.env.RCC_HEALTH_CHECK_INTERVAL || TIMEOUT_DEFAULTS.COMMAND_TIMEOUT,
      },
    };
  },
} as const;
