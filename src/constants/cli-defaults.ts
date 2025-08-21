/**
 * CLI模块默认配置常量
 * 
 * 集中管理所有CLI相关的硬编码值，遵循零硬编码原则
 * 所有CLI模块配置都应该引用这些常量
 * 
 * @module CLIDefaults
 * @version 4.0.0-beta.1
 * @lastUpdated 2025-08-21
 * @author RCC v4.0 Team
 */

// =============================================================================
// 基础配置常量
// =============================================================================

/**
 * CLI核心默认配置
 */
export const CLI_DEFAULTS = {
  /** 默认日志级别 */
  LOG_LEVEL: 'info',
  
  /** 默认操作超时时间 (毫秒) */
  TIMEOUT: 30000,
  
  /** 默认输出格式 */
  OUTPUT_FORMAT: 'json',
  
  /** 默认配置文件名 */
  CONFIG_FILE_NAME: 'config.json',
  
  /** 默认端口 */
  DEFAULT_PORT: 5506,
  
  /** 默认主机地址 */
  DEFAULT_HOST: 'localhost',
  
  /** 默认最大重试次数 */
  MAX_RETRIES: 3,
  
  /** 默认重试延迟 (毫秒) */
  RETRY_DELAY: 1000,
  
  /** 默认命令历史大小 */
  COMMAND_HISTORY_SIZE: 100,
  
  /** 默认输出缓冲区大小 (字节) */
  OUTPUT_BUFFER_SIZE: 8192
} as const;

// =============================================================================
// 命令定义常量
// =============================================================================

/**
 * RCC CLI命令常量
 */
export const CLI_COMMANDS = {
  /** 启动服务器命令 */
  START: 'start',
  
  /** 停止服务器命令 */
  STOP: 'stop',
  
  /** 查看状态命令 */
  STATUS: 'status',
  
  /** 配置管理命令 */
  CONFIG: 'config',
  
  /** Claude Code代理命令 */
  CODE: 'code',
  
  /** 重启服务器命令 */
  RESTART: 'restart',
  
  /** 查看日志命令 */
  LOGS: 'logs',
  
  /** 查看版本命令 */
  VERSION: 'version',
  
  /** 显示帮助命令 */
  HELP: 'help',
  
  /** 测试连接命令 */
  TEST: 'test'
} as const;

/**
 * CLI子命令常量
 */
export const CLI_SUBCOMMANDS = {
  CONFIG: {
    /** 查看配置 */
    VIEW: 'view',
    
    /** 设置配置 */
    SET: 'set',
    
    /** 获取配置值 */
    GET: 'get',
    
    /** 验证配置 */
    VALIDATE: 'validate',
    
    /** 重置配置 */
    RESET: 'reset',
    
    /** 导出配置 */
    EXPORT: 'export',
    
    /** 导入配置 */
    IMPORT: 'import'
  },
  
  LOGS: {
    /** 查看所有日志 */
    ALL: 'all',
    
    /** 查看错误日志 */
    ERROR: 'error',
    
    /** 查看调试日志 */
    DEBUG: 'debug',
    
    /** 清除日志 */
    CLEAR: 'clear',
    
    /** 跟踪日志 */
    FOLLOW: 'follow'
  }
} as const;

// =============================================================================
// 命令选项和参数常量
// =============================================================================

/**
 * CLI命令选项常量
 */
export const CLI_OPTIONS = {
  /** 配置文件路径选项 */
  CONFIG_FILE: {
    SHORT: '-c',
    LONG: '--config',
    DESCRIPTION: 'Path to configuration file'
  },
  
  /** 端口选项 */
  PORT: {
    SHORT: '-p',
    LONG: '--port',
    DESCRIPTION: 'Port number to use'
  },
  
  /** 主机选项 */
  HOST: {
    SHORT: '-h',
    LONG: '--host',
    DESCRIPTION: 'Host address to bind to'
  },
  
  /** 详细输出选项 */
  VERBOSE: {
    SHORT: '-v',
    LONG: '--verbose',
    DESCRIPTION: 'Enable verbose output'
  },
  
  /** 安静模式选项 */
  QUIET: {
    SHORT: '-q',
    LONG: '--quiet',
    DESCRIPTION: 'Suppress output'
  },
  
  /** 强制执行选项 */
  FORCE: {
    SHORT: '-f',
    LONG: '--force',
    DESCRIPTION: 'Force execution without confirmation'
  },
  
  /** 调试模式选项 */
  DEBUG: {
    SHORT: '-d',
    LONG: '--debug',
    DESCRIPTION: 'Enable debug mode'
  },
  
  /** 输出格式选项 */
  FORMAT: {
    SHORT: '-F',
    LONG: '--format',
    DESCRIPTION: 'Output format (json, yaml, table)'
  },
  
  /** 超时选项 */
  TIMEOUT: {
    SHORT: '-t',
    LONG: '--timeout',
    DESCRIPTION: 'Operation timeout in seconds'
  },
  
  /** 帮助选项 */
  HELP: {
    SHORT: '-?',
    LONG: '--help',
    DESCRIPTION: 'Show help information'
  }
} as const;

/**
 * 环境变量常量
 */
export const CLI_ENV_VARS = {
  /** RCC配置文件路径 */
  RCC_CONFIG_FILE: 'RCC_CONFIG_FILE',
  
  /** RCC默认端口 */
  RCC_DEFAULT_PORT: 'RCC_DEFAULT_PORT',
  
  /** RCC日志级别 */
  RCC_LOG_LEVEL: 'RCC_LOG_LEVEL',
  
  /** RCC调试模式 */
  RCC_DEBUG: 'RCC_DEBUG',
  
  /** RCC数据目录 */
  RCC_DATA_DIR: 'RCC_DATA_DIR',
  
  /** RCC配置目录 */
  RCC_CONFIG_DIR: 'RCC_CONFIG_DIR',
  
  /** RCC缓存目录 */
  RCC_CACHE_DIR: 'RCC_CACHE_DIR',
  
  /** RCC用户目录 */
  RCC_USER_DIR: 'RCC_USER_DIR'
} as const;

// =============================================================================
// 消息和提示常量
// =============================================================================

/**
 * CLI成功消息常量
 */
export const CLI_MESSAGES = {
  /** 服务器启动成功 */
  SERVER_STARTED: 'RCC server started successfully',
  
  /** 服务器停止成功 */
  SERVER_STOPPED: 'RCC server stopped successfully',
  
  /** 服务器重启成功 */
  SERVER_RESTARTED: 'RCC server restarted successfully',
  
  /** 配置更新成功 */
  CONFIG_UPDATED: 'Configuration updated successfully',
  
  /** 配置验证成功 */
  CONFIG_VALIDATED: 'Configuration validation passed',
  
  /** 配置重置成功 */
  CONFIG_RESET: 'Configuration reset to defaults',
  
  /** 连接测试成功 */
  CONNECTION_TEST_PASSED: 'Connection test passed',
  
  /** 日志清除成功 */
  LOGS_CLEARED: 'Logs cleared successfully',
  
  /** 操作取消 */
  OPERATION_CANCELLED: 'Operation cancelled by user'
} as const;

/**
 * CLI提示消息常量
 */
export const CLI_PROMPTS = {
  /** 确认操作提示 */
  CONFIRM_OPERATION: 'Are you sure you want to continue?',
  
  /** 确认停止服务器 */
  CONFIRM_STOP_SERVER: 'Are you sure you want to stop the server?',
  
  /** 确认重置配置 */
  CONFIRM_RESET_CONFIG: 'Are you sure you want to reset configuration to defaults?',
  
  /** 确认清除日志 */
  CONFIRM_CLEAR_LOGS: 'Are you sure you want to clear all logs?',
  
  /** 确认强制执行 */
  CONFIRM_FORCE_EXECUTION: 'Force execution may cause data loss. Continue?',
  
  /** 输入配置值提示 */
  INPUT_CONFIG_VALUE: 'Please enter the configuration value:',
  
  /** 选择配置文件提示 */
  SELECT_CONFIG_FILE: 'Please select a configuration file:'
} as const;

// =============================================================================
// 输出格式和样式常量
// =============================================================================

/**
 * 支持的输出格式
 */
export const OUTPUT_FORMATS = {
  /** JSON格式 */
  JSON: 'json',
  
  /** YAML格式 */
  YAML: 'yaml',
  
  /** 表格格式 */
  TABLE: 'table',
  
  /** 纯文本格式 */
  TEXT: 'text',
  
  /** CSV格式 */
  CSV: 'csv',
  
  /** XML格式 */
  XML: 'xml'
} as const;

/**
 * 日志级别常量
 */
export const LOG_LEVELS = {
  /** 错误级别 */
  ERROR: 'error',
  
  /** 警告级别 */
  WARN: 'warn',
  
  /** 信息级别 */
  INFO: 'info',
  
  /** 调试级别 */
  DEBUG: 'debug',
  
  /** 详细级别 */
  VERBOSE: 'verbose',
  
  /** 静默级别 */
  SILENT: 'silent'
} as const;

/**
 * 颜色主题常量
 */
export const COLOR_THEMES = {
  /** 默认主题 */
  DEFAULT: 'default',
  
  /** 暗色主题 */
  DARK: 'dark',
  
  /** 亮色主题 */
  LIGHT: 'light',
  
  /** 高对比度主题 */
  HIGH_CONTRAST: 'high-contrast',
  
  /** 无颜色主题 */
  NO_COLOR: 'no-color'
} as const;

// =============================================================================
// 验证和限制常量
// =============================================================================

/**
 * CLI验证规则常量
 */
export const CLI_VALIDATION_RULES = {
  /** 端口号范围 */
  PORT_RANGE: {
    MIN: 1024,
    MAX: 65535
  },
  
  /** 超时时间范围 (秒) */
  TIMEOUT_RANGE: {
    MIN: 1,
    MAX: 3600
  },
  
  /** 命令历史大小范围 */
  HISTORY_SIZE_RANGE: {
    MIN: 10,
    MAX: 1000
  },
  
  /** 配置文件大小限制 (字节) */
  CONFIG_FILE_SIZE_LIMIT: 1048576, // 1MB
  
  /** 命令长度限制 */
  COMMAND_LENGTH_LIMIT: 1000,
  
  /** 参数数量限制 */
  ARGS_COUNT_LIMIT: 50
} as const;

/**
 * 文件路径常量
 */
export const CLI_PATHS = {
  /** 默认配置目录 */
  DEFAULT_CONFIG_DIR: '.rcc',
  
  /** 默认日志目录 */
  DEFAULT_LOG_DIR: 'logs',
  
  /** 默认缓存目录 */
  DEFAULT_CACHE_DIR: 'cache',
  
  /** 默认数据目录 */
  DEFAULT_DATA_DIR: 'data',
  
  /** 配置文件扩展名 */
  CONFIG_FILE_EXTENSIONS: ['.json', '.yaml', '.yml', '.toml'],
  
  /** 日志文件扩展名 */
  LOG_FILE_EXTENSION: '.log',
  
  /** PID文件名 */
  PID_FILE_NAME: 'rcc.pid',
  
  /** 锁文件名 */
  LOCK_FILE_NAME: 'rcc.lock'
} as const;

// =============================================================================
// 预定义配置组合
// =============================================================================

/**
 * 开发环境CLI配置
 */
export const DEVELOPMENT_CLI_CONFIG = {
  logLevel: LOG_LEVELS.DEBUG,
  timeout: 10000,
  outputFormat: OUTPUT_FORMATS.JSON,
  colorTheme: COLOR_THEMES.DEFAULT,
  verbose: true,
  retryAttempts: 1
} as const;

/**
 * 生产环境CLI配置
 */
export const PRODUCTION_CLI_CONFIG = {
  logLevel: LOG_LEVELS.INFO,
  timeout: CLI_DEFAULTS.TIMEOUT,
  outputFormat: OUTPUT_FORMATS.JSON,
  colorTheme: COLOR_THEMES.DEFAULT,
  verbose: false,
  retryAttempts: CLI_DEFAULTS.MAX_RETRIES
} as const;

/**
 * 测试环境CLI配置
 */
export const TEST_CLI_CONFIG = {
  logLevel: LOG_LEVELS.SILENT,
  timeout: 5000,
  outputFormat: OUTPUT_FORMATS.JSON,
  colorTheme: COLOR_THEMES.NO_COLOR,
  verbose: false,
  retryAttempts: 0
} as const;

// =============================================================================
// 状态和退出码常量
// =============================================================================

/**
 * CLI状态常量
 */
export const CLI_STATUS = {
  /** 未初始化 */
  UNINITIALIZED: 'uninitialized',
  
  /** 初始化中 */
  INITIALIZING: 'initializing',
  
  /** 就绪 */
  READY: 'ready',
  
  /** 运行中 */
  RUNNING: 'running',
  
  /** 错误 */
  ERROR: 'error',
  
  /** 已退出 */
  EXITED: 'exited'
} as const;

/**
 * 退出码常量
 */
export const EXIT_CODES = {
  /** 成功 */
  SUCCESS: 0,
  
  /** 一般错误 */
  GENERAL_ERROR: 1,
  
  /** 使用错误 */
  USAGE_ERROR: 2,
  
  /** 配置错误 */
  CONFIG_ERROR: 3,
  
  /** 网络错误 */
  NETWORK_ERROR: 4,
  
  /** 权限错误 */
  PERMISSION_ERROR: 5,
  
  /** 文件不存在错误 */
  FILE_NOT_FOUND: 6,
  
  /** 服务不可用错误 */
  SERVICE_UNAVAILABLE: 7,
  
  /** 超时错误 */
  TIMEOUT_ERROR: 8,
  
  /** 中断错误 */
  INTERRUPTED: 130
} as const;

// =============================================================================
// 版本和兼容性常量
// =============================================================================

/**
 * CLI模块版本信息
 */
export const CLI_MODULE_VERSION = '4.0.0-beta.1';

/**
 * 兼容的CLI版本
 */
export const COMPATIBLE_CLI_VERSIONS = [
  '4.0.0',
  '4.0.0-beta.1',
  '4.0.0-alpha.1'
] as const;

/**
 * 最小支持的Node.js版本
 */
export const MIN_NODE_VERSION = '18.0.0';

/**
 * 推荐的Node.js版本
 */
export const RECOMMENDED_NODE_VERSION = '20.0.0';

// =============================================================================
// 导出类型定义
// =============================================================================

export type CLICommand = typeof CLI_COMMANDS[keyof typeof CLI_COMMANDS];
export type OutputFormat = typeof OUTPUT_FORMATS[keyof typeof OUTPUT_FORMATS];
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
export type ColorTheme = typeof COLOR_THEMES[keyof typeof COLOR_THEMES];
export type CLIStatus = typeof CLI_STATUS[keyof typeof CLI_STATUS];
export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];