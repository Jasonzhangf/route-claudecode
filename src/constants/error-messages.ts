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

// Provider相关错误消息
export const PROVIDER_ERRORS = {
  NOT_FOUND: 'Provider not found',
  API_KEY_MISSING: 'API key not found for provider',
  REQUEST_FAILED: 'Server request failed with status',
} as const;

// 日志消息常量
export const LOG_MESSAGES = {
  OPENAI_SDK_REQUEST_START: '使用OpenAI SDK执行请求 - 自动SSE处理',
  OPENAI_SDK_REQUEST_COMPLETE: 'OpenAI SDK请求完成',
  OPENAI_SDK_REQUEST_FAILED: 'OpenAI SDK请求失败',
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
  ROUTING_DECISION_MISSING: 'Routing decision missing for model',
} as const;

// 零Fallback策略相关错误
export const ZERO_FALLBACK_ERRORS = {
  MODEL_MAPPING_FAILED_ZERO_FALLBACK: 'Model mapping failed - Zero fallback policy enforced',
  PIPELINE_TABLE_LOAD_FAILED_ZERO_FALLBACK: 'Pipeline table loading failed - Zero fallback policy enforced',
  HEALTH_CHECK_FAILED_ZERO_FALLBACK: 'Health check failed - Zero fallback policy enforced',
  PROVIDER_UNAVAILABLE_ZERO_FALLBACK: 'Provider unavailable - Zero fallback policy enforced',
  CONFIGURATION_LOAD_FAILED_ZERO_FALLBACK: 'Configuration loading failed - Zero fallback policy enforced',
  SILENT_FAILURE_NOT_ALLOWED: 'Silent failure not allowed under zero fallback policy',
  EMPTY_RESPONSE_CONTENT_ZERO_FALLBACK: 'Empty response content detected - Zero fallback policy prevents default content',
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
  INVALID_JSON_INPUT: 'Invalid JSON input provided',
  JSON_PARSE_FAILED: 'JSON parsing failed',
  JSON_STRINGIFY_FAILED: 'JSON stringification failed',
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

// Qwen OAuth2认证相关错误
export const QWEN_AUTH_ERRORS = {
  DEVICE_AUTH_REQUEST_FAILED: '设备授权请求失败',
  TOKEN_POLLING_FAILED: 'Token轮询失败',
  AUTHORIZATION_PENDING: '用户授权待处理',
  SLOW_DOWN: '服务器要求降低轮询频率',
  EXPIRED_TOKEN: '设备授权已过期，请重新开始认证流程',
  ACCESS_DENIED: '用户拒绝了授权请求',
  OAUTH2_ERROR: 'OAuth2认证错误',
  INVALID_TOKEN_RESPONSE: '无效的token响应',
  AUTHENTICATION_TIMEOUT: '认证超时，请重新尝试',
  TOKEN_REFRESH_FAILED: 'Token刷新失败',
  AUTH_FILE_NOT_FOUND: '认证文件不存在',
  AUTH_FILE_PARSE_ERROR: '认证文件解析失败',
  BROWSER_OPEN_FAILED: '无法自动打开浏览器',
  RATE_LIMIT_HIT: '遇到频率限制',
  TOOLS_FORMAT_CONVERSION_FAILED: '工具格式转换失败',
  TOOLS_ARRAY_INVALID: '无效的工具数组格式',
  TOKEN_RECREATION_START: '开始Qwen token自动recreate流程',
  TOKEN_RECREATION_SUCCESS: 'Qwen token extended refresh成功',
  TOKEN_RECREATION_EXTENDED_FAILED: 'Qwen extended refresh也失败',
  TOKEN_RECREATION_FAILED: 'Qwen token自动recreate流程失败',
} as const;

// Gemini协议相关错误
export const GEMINI_PROTOCOL_ERRORS = {
  MODULE_NOT_RUNNING: 'Gemini Native Protocol Module not running',
  PROVIDER_NOT_FOUND: 'Gemini provider not found',
  PROVIDER_LOOKUP_FAILED: 'Provider lookup failed',
  PROCESSING_COMPLETED: 'Processing completed',
  PROCESSING_FAILED: 'Processing failed',
  REQUEST_NULL: 'Gemini request is null or undefined',
  MISSING_PROJECT: 'Gemini request missing project field',
  MISSING_REQUEST: 'Gemini request missing request field',
  INVALID_CONTENTS: 'Gemini request.contents must be an array',
  EMPTY_CONTENTS: 'Gemini request.contents cannot be empty',
  MISSING_MODEL: 'Gemini request missing model field',
  INVALID_ROLE: 'Invalid role in content',
  INVALID_PARTS: 'Content parts must be an array',
  MISSING_CONTENT: 'Content part must have either text or functionCall',
} as const;

// iFlow协议相关错误
export const IFLOW_ERRORS = {
  CONNECTION_FAILED: 'Unable to connect to iFlow API server',
  REQUEST_TIMEOUT: 'Request to iFlow API timed out',
  INVALID_REQUEST: 'Invalid request to iFlow API',
  AUTHENTICATION_FAILED: 'Invalid or missing API key for iFlow',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for iFlow API',
  SERVER_ERROR: 'iFlow API server error',
  UNKNOWN_ERROR: 'Unknown iFlow API error',
  INTERNAL_ERROR: 'Internal error in iFlow compatibility module',
} as const;

// 错误协调中心相关错误
export const ERROR_COORDINATION_ERRORS = {
  CENTER_PROCESSING_FAILED: 'Error coordination center failed to process the error',
  CLASSIFICATION_FAILED: 'Error classification failed',
  STRATEGY_EXECUTION_FAILED: 'Error handling strategy execution failed',
  RESPONSE_GENERATION_FAILED: 'Error response generation failed',
  EMERGENCY_RESPONSE_TRIGGERED: 'Emergency error response triggered',
  COORDINATION_CENTER_UNAVAILABLE: 'Error coordination center is unavailable',
} as const;

// 错误处理策略相关消息
export const ERROR_STRATEGY_MESSAGES = {
  RATE_LIMIT_WAIT_REQUIRED: 'Rate limit exceeded. Please wait before retrying',
  PIPELINE_BLACKLISTED: 'Pipeline has been temporarily blacklisted due to repeated failures',
  RETRY_RECOMMENDED: 'Temporary error detected. Retry recommended with backoff',
  FATAL_ERROR_OCCURRED: 'A fatal error occurred that cannot be recovered from',
  IMMEDIATE_RETURN_REQUIRED: 'Error requires immediate return to client',
  GENERIC_SERVICE_ERROR: 'Service error occurred',
  PROVIDER_TEMPORARILY_UNAVAILABLE: 'Service provider is temporarily unavailable',
  INTERNAL_SERVER_ERROR: 'An internal server error occurred',
  UPSTREAM_SERVICE_ERROR: 'The upstream service returned an error',
} as const;

// 错误响应相关消息
export const ERROR_RESPONSE_MESSAGES = {
  RATE_LIMIT_SUGGESTION: 'Wait for the specified time before retrying. Consider implementing exponential backoff',
  BLACKLIST_SUGGESTION: 'The system will automatically retry with other available pipelines',
  RETRY_SUGGESTION: 'Use exponential backoff for subsequent retries',
  FATAL_ERROR_SUGGESTION: 'Check your request parameters and authentication. Contact support if the issue persists',
  LOCAL_ERROR_SUGGESTION: 'This is a system error. Please contact support',
  REMOTE_ERROR_SUGGESTION: 'The request failed at the service provider level. Check your request and try again',
  COORDINATION_ERROR_SUGGESTION: 'This is a system error. Please contact support',
} as const;

// HTTP状态码相关错误消息
export const HTTP_STATUS_ERRORS = {
  HTTP_400: 'Bad Request - Invalid parameters or format',
  HTTP_401: 'Unauthorized - Authentication failed',
  HTTP_403: 'Forbidden - Insufficient permissions',
  HTTP_404: 'Not Found - Resource not available',
  HTTP_408: 'Request Timeout - Operation timed out',
  HTTP_429: 'Too Many Requests - Rate limit exceeded',
  HTTP_500: 'Internal Server Error - System error occurred',
  HTTP_502: 'Bad Gateway - Upstream service error',
  HTTP_503: 'Service Unavailable - Service temporarily unavailable',
  HTTP_504: 'Gateway Timeout - Upstream timeout',
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
  ...ZERO_FALLBACK_ERRORS,
  ...SERVER_ERRORS,
  ...DEBUG_ERRORS,
  ...VALIDATION_ERRORS,
  ...SECURITY_ERRORS,
  ...QWEN_AUTH_ERRORS,
  ...GEMINI_PROTOCOL_ERRORS,
  ...IFLOW_ERRORS,
  ...ERROR_COORDINATION_ERRORS,
  ...ERROR_STRATEGY_MESSAGES,
  ...ERROR_RESPONSE_MESSAGES,
  ...HTTP_STATUS_ERRORS,
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
export type QwenAuthError = typeof QWEN_AUTH_ERRORS[keyof typeof QWEN_AUTH_ERRORS];
export type ZeroFallbackError = typeof ZERO_FALLBACK_ERRORS[keyof typeof ZERO_FALLBACK_ERRORS];
export type IFlowError = typeof IFLOW_ERRORS[keyof typeof IFLOW_ERRORS];