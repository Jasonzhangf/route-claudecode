/**
 * Model Mappings Constants
 * Standardized model identifiers to avoid hardcoding
 */

// Provider Model Mappings
export const PROVIDER_MODELS = {
  QWEN: {
    QWEN3_CODER_PLUS: 'qwen3-coder-plus',
    QWEN_MAX: 'qwen-max',
    QWEN_TURBO: 'qwen-turbo',
    QWEN_PLUS: 'qwen-plus'
  },
  
  LMSTUDIO: {
    LLAMA_3_1_8B: 'llama-3.1-8b',
    LLAMA_3_1_70B: 'llama-3.1-70b',
    MISTRAL_7B: 'mistral-7b',
    MIXTRAL_8X7B: 'mixtral-8x7b'
  },
  
  OPENAI: {
    GPT4: 'gpt-4',
    GPT4_TURBO: 'gpt-4-turbo',
    GPT3_5_TURBO: 'gpt-3.5-turbo',
    GPT4O: 'gpt-4o'
  },
  
  ANTHROPIC: {
    CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
    CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
    CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
    CLAUDE_3_OPUS: 'claude-3-opus-20240229'
  },
  
  GEMINI: {
    GEMINI_PRO: 'gemini-pro',
    GEMINI_PRO_VISION: 'gemini-pro-vision',
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash'
  }
} as const;

// Model Capabilities
export const MODEL_CAPABILITIES = {
  CONTEXT_LENGTH: {
    SHORT: 4096,
    MEDIUM: 8192,
    LONG: 32768,
    VERY_LONG: 128000
  },
  
  TOKEN_LIMITS: {
    DEFAULT_MAX: 4096,
    HIGH_MAX: 8192,
    MAX_AVAILABLE: 32768
  }
} as const;

// Model Categories
export const MODEL_CATEGORIES = {
  CODING: 'coding',
  REASONING: 'reasoning',
  CREATIVE: 'creative',
  CHAT: 'chat',
  ANALYSIS: 'analysis'
} as const;

// Default Model Selections
export const DEFAULT_MODELS = {
  CODING: PROVIDER_MODELS.QWEN.QWEN3_CODER_PLUS,
  REASONING: PROVIDER_MODELS.ANTHROPIC.CLAUDE_3_5_SONNET,
  CHAT: PROVIDER_MODELS.OPENAI.GPT3_5_TURBO,
  ANALYSIS: PROVIDER_MODELS.GEMINI.GEMINI_1_5_PRO
} as const;

// Model Configuration Templates
export const MODEL_CONFIG_TEMPLATES = {
  HIGH_PERFORMANCE: {
    temperature: 0.7,
    maxTokens: MODEL_CAPABILITIES.TOKEN_LIMITS.HIGH_MAX,
    timeout: 30000
  },
  
  PRECISE: {
    temperature: 0.2,
    maxTokens: MODEL_CAPABILITIES.TOKEN_LIMITS.DEFAULT_MAX,
    timeout: 15000
  },
  
  CREATIVE: {
    temperature: 0.9,
    maxTokens: MODEL_CAPABILITIES.TOKEN_LIMITS.HIGH_MAX,
    timeout: 45000
  }
} as const;