/**
 * 兼容性常量定义
 * 
 * 包含所有兼容性相关的常量值，避免硬编码
 * 
 * @author RCC v4.0
 */

export const COMPATIBILITY_TAGS = {
  LMSTUDIO: 'lmstudio',
  OLLAMA: 'ollama',
  VLLM: 'vllm',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  MODELSCOPE: 'modelscope',
  QWEN: 'qwen',
  DEFAULT: 'default',
  PASSTHROUGH: 'passthrough'
} as const;

export const PROVIDER_NAMES = {
  LMSTUDIO: 'lmstudio',
  OLLAMA: 'ollama',
  VLLM: 'vllm',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  MODELSCOPE: 'modelscope',
  QWEN: 'qwen'
} as const;

export const DEFAULT_ENDPOINTS = {
  LMSTUDIO: 'http://localhost:1234/v1',
  OLLAMA: 'http://localhost:11434',
  VLLM: 'http://localhost:8000',
  ANTHROPIC: 'https://api.anthropic.com'
} as const;

export const DEFAULT_PORTS = {
  LMSTUDIO: 1234,
  OLLAMA: 11434,
  VLLM: 8000
} as const;

export const DEFAULT_TIMEOUTS = {
  STANDARD: 30000,
  LONG: 60000,
  SHORT: 15000
} as const;

export const DEFAULT_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BACKOFF_MULTIPLIER: 2,
  MAX_DELAY: 10000
} as const;

export const DEFAULT_API_KEYS = {
  LMSTUDIO: 'lm-studio'
} as const;

export const DEFAULT_MODELS = {
  LMSTUDIO: ['gpt-oss-20b-mlx'],
  OLLAMA: ['llama2'],
  ANTHROPIC: ['claude-3-sonnet'],
  OPENAI: ['gpt-3.5-turbo']
} as const;

export const DEFAULT_MAX_TOKENS = {
  SMALL_MODEL: 4096,
  MEDIUM_MODEL: 8192,
  LARGE_MODEL: 16384,
  EXTRA_LARGE_MODEL: 32768
} as const;

export const COMPATIBILITY_MODULE_PATHS = {
  LMSTUDIO: '../modules/pipeline-modules/server-compatibility/lmstudio-compatibility',
  OLLAMA: '../modules/pipeline-modules/server-compatibility/ollama-compatibility',
  VLLM: '../modules/pipeline-modules/server-compatibility/vllm-compatibility',
  ANTHROPIC: '../modules/pipeline-modules/server-compatibility/anthropic-compatibility',
  MODELSCOPE: '../modules/pipeline-modules/server-compatibility/modelscope-compatibility',
  QWEN: '../modules/pipeline-modules/server-compatibility/qwen-compatibility',
  PASSTHROUGH: '../modules/pipeline-modules/server-compatibility/passthrough-compatibility'
} as const;

export const COMPATIBILITY_MODULE_CLASSES = {
  LMSTUDIO: 'LMStudioCompatibilityModule',
  OLLAMA: 'OllamaCompatibilityModule',
  VLLM: 'VLLMCompatibilityModule',
  ANTHROPIC: 'AnthropicCompatibilityModule',
  MODELSCOPE: 'ModelScopeCompatibilityModule',
  QWEN: 'QwenCompatibilityModule',
  PASSTHROUGH: 'PassthroughCompatibilityModule'
} as const;

export const PROVIDER_TO_COMPATIBILITY_MAPPING = {
  [PROVIDER_NAMES.LMSTUDIO]: COMPATIBILITY_TAGS.LMSTUDIO,
  [PROVIDER_NAMES.OLLAMA]: COMPATIBILITY_TAGS.OLLAMA,
  [PROVIDER_NAMES.VLLM]: COMPATIBILITY_TAGS.VLLM,
  [PROVIDER_NAMES.ANTHROPIC]: COMPATIBILITY_TAGS.ANTHROPIC,
  [PROVIDER_NAMES.MODELSCOPE]: COMPATIBILITY_TAGS.MODELSCOPE,
  [PROVIDER_NAMES.QWEN]: COMPATIBILITY_TAGS.QWEN
} as const;

export const URL_PATTERNS = {
  LMSTUDIO_LOCALHOST: 'localhost:1234',
  OLLAMA_LOCALHOST: 'localhost:11434',
  VLLM_PATTERN: 'vllm',
  ANTHROPIC_DOMAIN: 'anthropic.com',
  QWEN_DOMAIN: 'dashscope.aliyuncs.com'
} as const;

export const LAYER_NAMES = {
  SERVER_COMPATIBILITY: 'server-compatibility',
  TRANSFORMER: 'transformer',
  PROTOCOL: 'protocol',
  SERVER: 'server',
  ROUTER: 'router'
} as const;

export const PROCESSING_MODES = {
  PASSTHROUGH: 'passthrough',
  TRANSFORM: 'transform',
  ADAPT: 'adapt'
} as const;