/**
 * Pipeline相关常量定义
 * 
 * 集中管理所有Pipeline架构相关的常量，消除硬编码
 * 
 * @author RCC v4.0 Team
 */

/**
 * Transformer组件类型
 */
export const TRANSFORMER_TYPES = {
  ANTHROPIC_TO_OPENAI: 'anthropic-to-openai',
  PASSTHROUGH: 'passthrough'
} as const;

/**
 * Protocol组件类型
 */
export const PROTOCOL_TYPES = {
  STANDARD: 'standard',
  OPENAI: 'openai'
} as const;

/**
 * Server Compatibility组件类型
 */
export const SERVER_COMPATIBILITY_TYPES = {
  QWEN: 'qwen',
  PASSTHROUGH: 'passthrough',
  LMSTUDIO: 'lmstudio',
  OLLAMA: 'ollama',
  VLLM: 'vllm',
  MODELSCOPE: 'modelscope',
  ANTHROPIC: 'anthropic'
} as const;

/**
 * Server组件类型
 */
export const SERVER_TYPES = {
  HTTP: 'http',
  WEBSOCKET: 'websocket'
} as const;

/**
 * Pipeline执行状态
 */
export const PIPELINE_EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

/**
 * Pipeline层级名称
 */
export const PIPELINE_LAYERS = {
  TRANSFORMER: 'transformer',
  PROTOCOL: 'protocol', 
  SERVER_COMPATIBILITY: 'serverCompatibility',
  SERVER: 'server'
} as const;

/**
 * Pipeline错误类型
 */
export const PIPELINE_ERRORS = {
  PIPELINE_NOT_FOUND: 'PIPELINE_NOT_FOUND',
  COMPONENT_CREATION_FAILED: 'COMPONENT_CREATION_FAILED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION'
} as const;

/**
 * Pipeline错误消息
 */
export const PIPELINE_ERROR_MESSAGES = {
  COMPONENT_CREATION_FAILED: '组件实例创建失败',
  EXECUTOR_GENERATION_FAILED: '固定管道执行器生成失败',
  FIXED_PIPELINE_NOT_IMPLEMENTED: 'Fixed pipeline execution not yet implemented',
  SERVER_HTTP_NOT_IMPLEMENTED: 'Server component HTTP call not yet implemented in fixed pipeline'
} as const;

/**
 * 组件创建配置
 */
export const COMPONENT_CREATION = {
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  DEFAULT_BATCH_SIZE: 1
} as const;

/**
 * 组件默认配置
 */
export const COMPONENT_DEFAULTS = {
  SERVER_TIMEOUT: 30000,
  SERVER_MAX_RETRIES: 3,
  PROTOCOL_TIMEOUT: 30000
} as const;

/**
 * Pipeline架构版本
 */
export const PIPELINE_ARCHITECTURE = {
  VERSION: '4.0',
  LAYER_COUNT: 4,
  SUPPORTED_PROTOCOLS: ['openai', 'anthropic'] as const
} as const;

/**
 * Provider到Compatibility映射
 */
export const PROVIDER_COMPATIBILITY_MAPPING = {
  qwen: SERVER_COMPATIBILITY_TYPES.QWEN,
  shuaihong: SERVER_COMPATIBILITY_TYPES.PASSTHROUGH,
  modelscope: SERVER_COMPATIBILITY_TYPES.PASSTHROUGH,
  lmstudio: SERVER_COMPATIBILITY_TYPES.LMSTUDIO,
  ollama: SERVER_COMPATIBILITY_TYPES.OLLAMA,
  vllm: SERVER_COMPATIBILITY_TYPES.VLLM,
  anthropic: SERVER_COMPATIBILITY_TYPES.ANTHROPIC
} as const;

/**
 * Provider到Transformer映射
 */
export const PROVIDER_TRANSFORMER_MAPPING = {
  qwen: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  shuaihong: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  modelscope: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  lmstudio: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  ollama: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  vllm: TRANSFORMER_TYPES.ANTHROPIC_TO_OPENAI,
  anthropic: TRANSFORMER_TYPES.PASSTHROUGH
} as const;