/**
 * 错误消息常量
 * 
 * 包含所有系统错误消息的集中定义
 * 任何涉及错误消息的硬编码都应定义在此文件中
 * 
 * @module ErrorMessages
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

// 通用错误消息
export const GENERAL_ERRORS = {
  INITIALIZATION_FAILED: 'Initialization failed',
  VALIDATION_FAILED: 'Validation failed',
  OPERATION_NOT_SUPPORTED: 'Operation not supported',
  INTERNAL_ERROR: 'Internal error occurred',
  TIMEOUT_ERROR: 'Operation timed out',
  UNKNOWN_ERROR: 'Unknown error occurred',
} as const;

// 配置相关错误
export const CONFIG_ERRORS = {
  CONFIG_NOT_FOUND: 'Configuration file not found',
  CONFIG_INVALID: 'Configuration file is invalid',
  CONFIG_PARSE_ERROR: 'Failed to parse configuration',
  CONFIG_LOAD_ERROR: 'Failed to load configuration',
  PROVIDER_NOT_CONFIGURED: 'Provider not configured',
  MISSING_API_KEY: 'API key is missing',
  INVALID_CONFIG_FORMAT: 'Invalid configuration format',
  CONFIG_VALIDATION_FAILED: 'Configuration validation failed',
} as const;

// 网络和连接错误
export const NETWORK_ERRORS = {
  CONNECTION_FAILED: 'Failed to connect to provider',
  REQUEST_FAILED: 'Request failed',
  NETWORK_TIMEOUT: 'Network timeout',
  AUTHENTICATION_FAILED: 'Authentication failed',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  SERVER_UNAVAILABLE: 'Server unavailable',
  CONNECTION_REFUSED: 'Connection refused',
  INVALID_ENDPOINT: 'Invalid endpoint',
} as const;

// CLI相关错误
export const CLI_ERRORS = {
  INVALID_COMMAND: 'Invalid command',
  MISSING_ARGUMENTS: 'Missing required arguments',
  INVALID_ARGUMENTS: 'Invalid arguments provided',
  COMMAND_EXECUTION_FAILED: 'Command execution failed',
  PERMISSION_DENIED: 'Permission denied',
  FILE_NOT_FOUND: 'File not found',
  DIRECTORY_NOT_FOUND: 'Directory not found',
  INVALID_PATH: 'Invalid path provided',
} as const;

// 模型和Provider错误
export const MODEL_ERRORS = {
  INVALID_MODEL: 'Invalid model specified',
  MODEL_NOT_FOUND: 'Model not found',
  MODEL_NOT_SUPPORTED: 'Model not supported',
  PROVIDER_ERROR: 'Provider error',
  MODEL_UNAVAILABLE: 'Model temporarily unavailable',
  INVALID_REQUEST_FORMAT: 'Invalid request format',
  TOKEN_LIMIT_EXCEEDED: 'Token limit exceeded',
} as const;

// 流水线相关错误
export const PIPELINE_ERRORS = {
  PIPELINE_NOT_FOUND: 'Pipeline not found',
  PIPELINE_INITIALIZATION_FAILED: 'Pipeline initialization failed',
  PIPELINE_EXECUTION_FAILED: 'Pipeline execution failed',
  MODULE_NOT_FOUND: 'Module not found',
  MODULE_INITIALIZATION_FAILED: 'Module initialization failed',
  MODULE_EXECUTION_FAILED: 'Module execution failed',
  INVALID_PIPELINE_CONFIG: 'Invalid pipeline configuration',
} as const;

// 路由相关错误
export const ROUTING_ERRORS = {
  ROUTING_FAILED: 'Request routing failed',
  NO_AVAILABLE_PROVIDERS: 'No available providers',
  NO_HEALTHY_ENDPOINTS: 'No healthy endpoints available',
  LOAD_BALANCING_FAILED: 'Load balancing failed',
  ROUTING_TABLE_INVALID: 'Routing table is invalid',
  VIRTUAL_MODEL_MAPPING_FAILED: 'Virtual model mapping failed',
} as const;

// 服务器相关错误
export const SERVER_ERRORS = {
  SERVER_START_FAILED: 'Server failed to start',
  SERVER_STOP_FAILED: 'Server failed to stop',
  PORT_IN_USE: 'Port is already in use',
  HEALTH_CHECK_FAILED: 'Health check failed',
  SERVER_NOT_RUNNING: 'Server is not running',
  SERVER_ALREADY_RUNNING: 'Server is already running',
} as const;

// Debug和日志相关错误
export const DEBUG_ERRORS = {
  DEBUG_SESSION_NOT_FOUND: 'Debug session not found',
  DEBUG_RECORDING_FAILED: 'Debug recording failed',
  LOG_FILE_NOT_FOUND: 'Log file not found',
  DEBUG_DATA_CORRUPTED: 'Debug data is corrupted',
  REPLAY_FAILED: 'Replay failed',
} as const;

// 验证相关错误
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD_MISSING: 'Required field is missing',
  INVALID_TYPE: 'Invalid type provided',
  INVALID_FORMAT: 'Invalid format',
  VALUE_OUT_OF_RANGE: 'Value is out of range',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_URL: 'Invalid URL format',
  INVALID_JSON: 'Invalid JSON format',
} as const;

// 权限和安全相关错误
export const SECURITY_ERRORS = {
  ACCESS_DENIED: 'Access denied',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  SECURITY_VIOLATION: 'Security violation detected',
  INVALID_TOKEN: 'Invalid token',
  TOKEN_EXPIRED: 'Token has expired',
  ENCRYPTION_FAILED: 'Encryption failed',
  DECRYPTION_FAILED: 'Decryption failed',
} as const;

// 统一错误消息导出
export const ERROR_MESSAGES = {
  ...GENERAL_ERRORS,
  ...CONFIG_ERRORS,
  ...NETWORK_ERRORS,
  ...CLI_ERRORS,
  ...MODEL_ERRORS,
  ...PIPELINE_ERRORS,
  ...ROUTING_ERRORS,
  ...SERVER_ERRORS,
  ...DEBUG_ERRORS,
  ...VALIDATION_ERRORS,
  ...SECURITY_ERRORS,
} as const;

// 错误消息类型定义
export type ErrorMessage = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES];
export type GeneralError = typeof GENERAL_ERRORS[keyof typeof GENERAL_ERRORS];
export type ConfigError = typeof CONFIG_ERRORS[keyof typeof CONFIG_ERRORS];
export type NetworkError = typeof NETWORK_ERRORS[keyof typeof NETWORK_ERRORS];
export type CLIError = typeof CLI_ERRORS[keyof typeof CLI_ERRORS];
export type ModelError = typeof MODEL_ERRORS[keyof typeof MODEL_ERRORS];
export type PipelineError = typeof PIPELINE_ERRORS[keyof typeof PIPELINE_ERRORS];
export type RoutingError = typeof ROUTING_ERRORS[keyof typeof ROUTING_ERRORS];
export type ServerError = typeof SERVER_ERRORS[keyof typeof SERVER_ERRORS];
export type DebugError = typeof DEBUG_ERRORS[keyof typeof DEBUG_ERRORS];
export type ValidationError = typeof VALIDATION_ERRORS[keyof typeof VALIDATION_ERRORS];
export type SecurityError = typeof SECURITY_ERRORS[keyof typeof SECURITY_ERRORS];