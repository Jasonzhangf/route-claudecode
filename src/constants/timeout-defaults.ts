/**
 * 超时默认值常量
 * 
 * 包含所有超时相关的默认配置值
 * 任何涉及setTimeout、setInterval、网络超时的硬编码都应定义在此文件中
 * 
 * @module TimeoutDefaults
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

// 网络请求超时配置
export const NETWORK_TIMEOUTS = {
  // 基础网络超时
  CONNECTION_TIMEOUT: 5000,           // 5秒连接超时
  REQUEST_TIMEOUT: 30000,             // 30秒请求超时
  RESPONSE_TIMEOUT: 60000,            // 60秒响应超时
  
  // DNS和代理超时
  DNS_TIMEOUT: 5000,                  // 5秒DNS解析超时
  PROXY_TIMEOUT: 10000,               // 10秒代理超时
  
  // 重试相关超时
  RETRY_DELAY: 1000,                  // 1秒重试延迟
  RETRY_BACKOFF_MULTIPLIER: 2,        // 重试指数退避倍数
  MAX_RETRY_DELAY: 30000,             // 最大重试延迟30秒
} as const;

// CLI和工具超时配置
export const CLI_TIMEOUTS = {
  // 命令执行超时
  COMMAND_TIMEOUT: 30000,             // 30秒命令执行超时
  SCRIPT_TIMEOUT: 120000,             // 2分钟脚本执行超时
  
  // 用户输入超时
  USER_INPUT_TIMEOUT: 300000,         // 5分钟用户输入超时
  CONFIRMATION_TIMEOUT: 30000,        // 30秒确认超时
  
  // 启动和关闭超时
  STARTUP_TIMEOUT: 60000,             // 60秒启动超时
  SHUTDOWN_TIMEOUT: 30000,            // 30秒关闭超时
} as const;

// 所有超时配置的统一导出
export const TIMEOUT_DEFAULTS = {
  ...NETWORK_TIMEOUTS,
  ...CLI_TIMEOUTS,
} as const;

// 超时配置类型定义
export type NetworkTimeoutsType = typeof NETWORK_TIMEOUTS;
export type CLITimeoutsType = typeof CLI_TIMEOUTS;
export type AllTimeoutsType = typeof TIMEOUT_DEFAULTS;

/**
 * 获取Provider请求超时时间
 */
export function getProviderRequestTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_PROVIDER_REQUEST_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.REQUEST_TIMEOUT;
}

/**
 * 获取HTTP请求超时时间
 */
export function getHttpRequestTimeout(configTimeout?: number): number {
  const envTimeout = process.env.RCC_HTTP_REQUEST_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return configTimeout ?? TIMEOUT_DEFAULTS.REQUEST_TIMEOUT;
}