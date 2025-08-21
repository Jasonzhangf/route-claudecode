/**
 * 模型映射常量
 * 
 * 包含所有AI模型相关的硬编码值
 * 任何涉及模型名称、版本、能力的常量都应定义在此文件中
 * 
 * @module ModelMappings
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

// OpenAI模型定义
export const OPENAI_MODELS = {
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4_TURBO_PREVIEW: 'gpt-4-turbo-preview',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_3_5_TURBO_16K: 'gpt-3.5-turbo-16k',
} as const;

// Anthropic模型定义
export const ANTHROPIC_MODELS = {
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20240620',
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
} as const;

// Google Gemini模型定义
export const GEMINI_MODELS = {
  GEMINI_PRO: 'gemini-pro',
  GEMINI_PRO_VISION: 'gemini-pro-vision',
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
  GEMINI_1_5_FLASH: 'gemini-1.5-flash',
} as const;

// LM Studio本地模型定义
export const LMSTUDIO_MODELS = {
  LLAMA_3_1_8B: 'llama-3.1-8b',
  LLAMA_3_1_70B: 'llama-3.1-70b',
  LLAMA_3_1_405B: 'llama-3.1-405b',
  LLAMA_3_2_1B: 'llama-3.2-1b',
  LLAMA_3_2_3B: 'llama-3.2-3b',
} as const;

// 所有支持的模型
export const SUPPORTED_MODELS = {
  OPENAI: OPENAI_MODELS,
  ANTHROPIC: ANTHROPIC_MODELS,
  GEMINI: GEMINI_MODELS,
  LMSTUDIO: LMSTUDIO_MODELS,
} as const;

// 虚拟模型映射 (Demo1风格)
export const VIRTUAL_MODELS = {
  DEFAULT: 'default',
  BACKGROUND: 'background',
  REASONING: 'reasoning',
  WEB_SEARCH: 'webSearch',
  LONG_CONTEXT: 'longContext',
} as const;

// 模型能力映射
export const MODEL_CAPABILITIES = {
  // OpenAI模型能力
  [OPENAI_MODELS.GPT_4]: {
    maxTokens: 8192,
    supportsToolCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 8192,
  },
  [OPENAI_MODELS.GPT_4_TURBO]: {
    maxTokens: 4096,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },
  [OPENAI_MODELS.GPT_3_5_TURBO]: {
    maxTokens: 4096,
    supportsToolCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 16385,
  },
  
  // Anthropic模型能力
  [ANTHROPIC_MODELS.CLAUDE_3_OPUS]: {
    maxTokens: 4096,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_SONNET]: {
    maxTokens: 4096,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_HAIKU]: {
    maxTokens: 4096,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_3_5_SONNET]: {
    maxTokens: 8192,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  [ANTHROPIC_MODELS.CLAUDE_SONNET_4]: {
    maxTokens: 8192,
    supportsToolCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 200000,
  },
  
  // Gemini模型能力
  [GEMINI_MODELS.GEMINI_PRO]: {
    maxTokens: 2048,
    supportsToolCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    contextWindow: 32768,
  },
  [GEMINI_MODELS.GEMINI_PRO_VISION]: {
    maxTokens: 2048,
    supportsToolCalling: false,
    supportsVision: true,
    supportsStreaming: true,
    contextWindow: 16384,
  },
} as const;

// 虚拟模型到实际模型的默认映射
export const VIRTUAL_MODEL_MAPPINGS = {
  [VIRTUAL_MODELS.DEFAULT]: [
    ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    ANTHROPIC_MODELS.CLAUDE_SONNET_4,
    OPENAI_MODELS.GPT_4_TURBO,
  ],
  [VIRTUAL_MODELS.BACKGROUND]: [
    ANTHROPIC_MODELS.CLAUDE_3_HAIKU,
    ANTHROPIC_MODELS.CLAUDE_3_5_HAIKU,
  ],
  [VIRTUAL_MODELS.REASONING]: [
    ANTHROPIC_MODELS.CLAUDE_3_OPUS,
    OPENAI_MODELS.GPT_4,
  ],
  [VIRTUAL_MODELS.WEB_SEARCH]: [
    ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    OPENAI_MODELS.GPT_4_TURBO,
  ],
  [VIRTUAL_MODELS.LONG_CONTEXT]: [
    ANTHROPIC_MODELS.CLAUDE_3_OPUS,
    ANTHROPIC_MODELS.CLAUDE_3_SONNET,
  ],
} as const;

// 模型检测规则
export const MODEL_DETECTION_RULES = {
  // 长上下文检测阈值
  LONG_CONTEXT_THRESHOLD: 60000,
  
  // 推理模型检测关键词
  REASONING_KEYWORDS: ['thinking', 'reasoning', 'analysis', 'step-by-step'],
  
  // Web搜索工具检测
  WEB_SEARCH_TOOLS: ['web_search', 'search', 'browser', 'internet'],
  
  // 背景任务模型前缀
  BACKGROUND_MODEL_PREFIXES: ['claude-3-5-haiku', 'claude-3-haiku'],
} as const;

// 模型别名映射
export const MODEL_ALIASES = {
  // 通用别名
  'gpt4': OPENAI_MODELS.GPT_4,
  'gpt-4o': OPENAI_MODELS.GPT_4_TURBO,
  'claude': ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
  'claude-sonnet': ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
  'claude-opus': ANTHROPIC_MODELS.CLAUDE_3_OPUS,
  'claude-haiku': ANTHROPIC_MODELS.CLAUDE_3_HAIKU,
  'gemini': GEMINI_MODELS.GEMINI_PRO,
  
  // 版本别名
  'claude-3': ANTHROPIC_MODELS.CLAUDE_3_SONNET,
  'claude-3.5': ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
  'gpt-3.5': OPENAI_MODELS.GPT_3_5_TURBO,
} as const;

// 导出所有模型相关类型
export type OpenAIModel = typeof OPENAI_MODELS[keyof typeof OPENAI_MODELS];
export type AnthropicModel = typeof ANTHROPIC_MODELS[keyof typeof ANTHROPIC_MODELS];
export type GeminiModel = typeof GEMINI_MODELS[keyof typeof GEMINI_MODELS];
export type LMStudioModel = typeof LMSTUDIO_MODELS[keyof typeof LMSTUDIO_MODELS];
export type VirtualModel = typeof VIRTUAL_MODELS[keyof typeof VIRTUAL_MODELS];
export type SupportedModel = OpenAIModel | AnthropicModel | GeminiModel | LMStudioModel;
export type ModelAlias = keyof typeof MODEL_ALIASES;

// 模型能力类型
export interface ModelCapability {
  maxTokens: number;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

export type ModelCapabilityMap = typeof MODEL_CAPABILITIES;