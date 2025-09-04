/**
 * 应用程序引导常量定义
 * 
 * 包含ApplicationBootstrap和CLI启动相关的所有常量，避免硬编码
 * 
 * @author RCC v4.0 Architecture Team
 */

import { LOAD_BALANCE_STRATEGIES } from './router-defaults';

export const BOOTSTRAP_CONFIG = {
  /** 默认调试日志路径 */
  DEFAULT_DEBUG_LOGS_PATH: './test-debug-logs',
  
  /** 应用程序版本 */
  APPLICATION_VERSION: '4.1.0',
  
  /** 引导超时时间（毫秒） */
  BOOTSTRAP_TIMEOUT_MS: 60000,
  
  /** 默认服务器主机 */
  DEFAULT_HOST: '0.0.0.0',
} as const;

export const SCHEDULER_DEFAULTS = {
  /** 负载均衡策略 */
  STRATEGY: LOAD_BALANCE_STRATEGIES.ROUND_ROBIN,
  
  /** 最大错误次数 */
  MAX_ERROR_COUNT: 3,
  
  /** 拉黑时长（毫秒） */
  BLACKLIST_DURATION_MS: 60000,
  
  /** 认证重试延迟（毫秒） */
  AUTH_RETRY_DELAY_MS: 5000,
  
  /** 健康检查间隔（毫秒） */
  HEALTH_CHECK_INTERVAL_MS: 30000,
} as const;

export const PORT_CLEANUP_CONFIG = {
  /** TERM信号等待时间（毫秒） */
  TERM_SIGNAL_WAIT_MS: 3000,
  
  /** 强制终止后等待时间（毫秒） */
  FORCE_KILL_WAIT_MS: 1000,
  
  /** 端口检查超时时间（毫秒） */
  PORT_CHECK_TIMEOUT_MS: 5000,
} as const;

export const BOOTSTRAP_ERRORS = {
  CONFIG_REQUIRED: 'Configuration file is required. Please specify --config <path>',
  PORT_EXTRACTION_FAILED: 'Port not found in configuration file and not specified via --port <number>',
  PORT_REQUIRED: 'Port is required. Please specify --port <number> or ensure port is configured in the configuration file',
  BOOTSTRAP_FAILED: 'BOOTSTRAP_FAILED',
  FORCE_KILL_FAILED: 'FORCE_KILL_FAILED',
} as const;

export const BOOTSTRAP_PHASES = {
  START: 'start',
  PORT_CLEANUP: 'port-cleanup', 
  LOGGING_CONFIG: 'logging-config',
  BOOTSTRAP: 'bootstrap',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const COMPONENT_NAMES = {
  CONFIG_PREPROCESSOR: 'configPreprocessor',
  ROUTER_PREPROCESSOR: 'routerPreprocessor', 
  PIPELINE_LIFECYCLE_MANAGER: 'pipelineLifecycleManager',
  RUNTIME_SCHEDULER: 'runtimeScheduler',
} as const;