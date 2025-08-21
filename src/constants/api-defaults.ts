/**
 * API相关默认常量
 *
 * 集中管理所有API配置的默认值，包括Provider端点、模型名称等
 *
 * @author Jason Zhang
 */

/**
 * API默认配置常量
 */
export const API_DEFAULTS = {
  // Provider端点配置
  PROVIDERS: {
    LMSTUDIO: {
      BASE_URL: 'http://localhost:1234/v1',
      CHAT_COMPLETIONS_ENDPOINT: '/v1/chat/completions',
      MODELS_ENDPOINT: '/v1/models',
      DEFAULT_MODEL: 'llama-3.1-8b',
    },
    ANTHROPIC: {
      BASE_URL: 'https://api.anthropic.com',
      MESSAGES_ENDPOINT: '/v1/messages',
      DEFAULT_MODEL: 'claude-3-haiku-20240307',
      API_VERSION: '2023-06-01',
    },
    OPENAI: {
      BASE_URL: 'https://api.openai.com',
      CHAT_COMPLETIONS_ENDPOINT: '/v1/chat/completions',
      MODELS_ENDPOINT: '/v1/models',
      DEFAULT_MODEL: 'gpt-3.5-turbo',
    },
    GEMINI: {
      BASE_URL: 'https://generativelanguage.googleapis.com',
      GENERATE_CONTENT_ENDPOINT: '/v1beta/models/{model}/generateContent',
      DEFAULT_MODEL: 'gemini-pro',
    },
  },

  // Provider映射配置
  PROVIDER_MAPPING: {
    // 模型名称到Provider的映射
    MODEL_TO_PROVIDER: {
      // OpenAI模型
      'gpt': 'openai',
      'openai': 'openai',
      'text-davinci': 'openai',
      'text-curie': 'openai',
      'text-babbage': 'openai',
      'text-ada': 'openai',
      
      // Anthropic模型
      'claude': 'anthropic',
      'anthropic': 'anthropic',
      
      // Google模型
      'gemini': 'gemini',
      'google': 'gemini',
      'palm': 'gemini',
      
      // LM Studio模型（使用openai兼容接口）
      'llama': 'openai',
      'mistral': 'openai',
      'qwen': 'openai',
      'deepseek': 'openai',
      'gpt-oss': 'openai',
    },
    
    // Provider默认映射
    DEFAULT_PROVIDER: 'openai', // 默认使用OpenAI兼容接口
    
    // Provider别名映射
    PROVIDER_ALIASES: {
      'lmstudio': 'openai',
      'local': 'openai',
      'ollama': 'openai',
      'vllm': 'openai',
    },
  },

  // RCC内部API端点
  RCC: {
    API_VERSION: 'v1',
    ENDPOINTS: {
      MESSAGES: '/v1/messages', // Anthropic兼容
      CHAT_COMPLETIONS: '/v1/chat/completions', // OpenAI兼容
      GENERATE_CONTENT: '/v1beta/models/:model/generateContent', // Gemini兼容
      PIPELINES: '/v1/pipelines', // Pipeline管理
      STATUS: '/v1/status', // 服务状态
      HEALTH: '/v1/health', // 健康检查
      METRICS: '/v1/metrics', // 指标收集
      DEBUG: '/v1/debug', // 调试接口
    },
  },

  // Token限制和配置
  TOKEN_LIMITS: {
    // 默认值 - 如果用户未指定则使用
    DEFAULT_MAX_TOKENS: 4096,
    
    // Provider默认最大限制 (仅用于安全检查，用户配置优先)
    PROVIDER_DEFAULTS: {
      LMSTUDIO: 131072, // LM Studio通常支持长上下文
      ANTHROPIC: 100000, // Claude-3系列支持长上下文
      OPENAI: 128000,    // GPT-4系列支持长上下文
      GEMINI: 1048576,   // Gemini支持超长上下文
      GENERIC: 8192,     // 通用默认值
    },
    
    // 绝对最大限制 (安全上限)
    ABSOLUTE_MAX: 2000000,
    
    // 最小值
    MIN_TOKENS: 1,
  },

  // HTTP状态码
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    TIMEOUT: 408,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  },

  // Content-Type常量
  CONTENT_TYPES: {
    JSON: 'application/json',
    TEXT: 'text/plain',
    HTML: 'text/html',
    STREAM: 'text/event-stream',
    FORM_DATA: 'multipart/form-data',
    URL_ENCODED: 'application/x-www-form-urlencoded',
  },

  // 请求头常量
  HEADERS: {
    AUTHORIZATION: 'Authorization',
    CONTENT_TYPE: 'Content-Type',
    ACCEPT: 'Accept',
    USER_AGENT: 'User-Agent',
    X_API_KEY: 'X-API-Key',
    X_REQUEST_ID: 'X-Request-ID',
    X_PIPELINE_ID: 'X-Pipeline-ID',
    X_EXECUTION_ID: 'X-Execution-ID',
    X_PROCESSING_TIME: 'X-Processing-Time',
    X_RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
    X_RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  },

  // 默认用户代理
  USER_AGENTS: {
    RCC: 'Route-Claude-Code/4.0',
    ANTHROPIC: 'anthropic-sdk-typescript',
    OPENAI: 'openai-node',
  },
} as const;

/**
 * 获取LM Studio基础URL
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getLMStudioBaseUrl(configUrl?: string): string {
  return (
    process.env.LMSTUDIO_BASE_URL ||
    process.env.RCC_LMSTUDIO_ENDPOINT ||
    configUrl ||
    API_DEFAULTS.PROVIDERS.LMSTUDIO.BASE_URL
  );
}

/**
 * 获取Anthropic基础URL
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getAnthropicBaseUrl(configUrl?: string): string {
  return (
    process.env.ANTHROPIC_BASE_URL ||
    process.env.RCC_ANTHROPIC_ENDPOINT ||
    configUrl ||
    API_DEFAULTS.PROVIDERS.ANTHROPIC.BASE_URL
  );
}

/**
 * 获取OpenAI基础URL
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getOpenAIBaseUrl(configUrl?: string): string {
  return (
    process.env.OPENAI_BASE_URL ||
    process.env.RCC_OPENAI_ENDPOINT ||
    configUrl ||
    API_DEFAULTS.PROVIDERS.OPENAI.BASE_URL
  );
}

/**
 * 获取Gemini基础URL
 * 优先级: 环境变量 > 配置文件 > 默认值
 */
export function getGeminiBaseUrl(configUrl?: string): string {
  return (
    process.env.GEMINI_BASE_URL ||
    process.env.RCC_GEMINI_ENDPOINT ||
    configUrl ||
    API_DEFAULTS.PROVIDERS.GEMINI.BASE_URL
  );
}

/**
 * 获取API密钥
 * 优先级: 环境变量 > 配置文件 > 无
 */
export function getApiKey(provider: 'anthropic' | 'openai' | 'gemini', configKey?: string): string | undefined {
  const envKeyMap = {
    anthropic: process.env.ANTHROPIC_API_KEY || process.env.RCC_ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY || process.env.RCC_OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY || process.env.RCC_GEMINI_API_KEY,
  };

  return envKeyMap[provider] || configKey;
}

/**
 * 构建完整的API端点URL
 */
export function buildApiUrl(baseUrl: string, endpoint: string, params?: Record<string, string>): string {
  let url = baseUrl.replace(/\/$/, '') + endpoint;

  // 替换路径参数
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }

  return url;
}

/**
 * 获取Provider配置
 */
export function getProviderConfig(provider: 'lmstudio' | 'anthropic' | 'openai' | 'gemini') {
  switch (provider) {
    case 'lmstudio':
      return {
        baseUrl: getLMStudioBaseUrl(),
        endpoints: {
          chatCompletions: API_DEFAULTS.PROVIDERS.LMSTUDIO.CHAT_COMPLETIONS_ENDPOINT,
          models: API_DEFAULTS.PROVIDERS.LMSTUDIO.MODELS_ENDPOINT,
        },
        defaultModel: API_DEFAULTS.PROVIDERS.LMSTUDIO.DEFAULT_MODEL,
      };

    case 'anthropic':
      return {
        baseUrl: getAnthropicBaseUrl(),
        endpoints: {
          messages: API_DEFAULTS.PROVIDERS.ANTHROPIC.MESSAGES_ENDPOINT,
        },
        defaultModel: API_DEFAULTS.PROVIDERS.ANTHROPIC.DEFAULT_MODEL,
        apiVersion: API_DEFAULTS.PROVIDERS.ANTHROPIC.API_VERSION,
        apiKey: getApiKey('anthropic'),
      };

    case 'openai':
      return {
        baseUrl: getOpenAIBaseUrl(),
        endpoints: {
          chatCompletions: API_DEFAULTS.PROVIDERS.OPENAI.CHAT_COMPLETIONS_ENDPOINT,
          models: API_DEFAULTS.PROVIDERS.OPENAI.MODELS_ENDPOINT,
        },
        defaultModel: API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
        apiKey: getApiKey('openai'),
      };

    case 'gemini':
      return {
        baseUrl: getGeminiBaseUrl(),
        endpoints: {
          generateContent: API_DEFAULTS.PROVIDERS.GEMINI.GENERATE_CONTENT_ENDPOINT,
        },
        defaultModel: API_DEFAULTS.PROVIDERS.GEMINI.DEFAULT_MODEL,
        apiKey: getApiKey('gemini'),
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * 获取RCC内部端点配置
 */
export function getRCCEndpoints() {
  return { ...API_DEFAULTS.RCC.ENDPOINTS };
}

/**
 * 验证API密钥格式
 */
export function isValidApiKey(provider: 'anthropic' | 'openai' | 'gemini', apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;

  switch (provider) {
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length >= 20;
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length >= 20;
    case 'gemini':
      return apiKey.length >= 20; // Gemini API键没有固定前缀
    default:
      return false;
  }
}

/**
 * 构建标准请求头
 */
export function buildRequestHeaders(options: {
  contentType?: string;
  authorization?: string;
  apiKey?: string;
  userAgent?: string;
  requestId?: string;
  additionalHeaders?: Record<string, string>;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.contentType) {
    headers[API_DEFAULTS.HEADERS.CONTENT_TYPE] = options.contentType;
  }

  if (options.authorization) {
    headers[API_DEFAULTS.HEADERS.AUTHORIZATION] = options.authorization;
  }

  if (options.apiKey) {
    headers[API_DEFAULTS.HEADERS.X_API_KEY] = options.apiKey;
  }

  if (options.userAgent) {
    headers[API_DEFAULTS.HEADERS.USER_AGENT] = options.userAgent;
  }

  if (options.requestId) {
    headers[API_DEFAULTS.HEADERS.X_REQUEST_ID] = options.requestId;
  }

  if (options.additionalHeaders) {
    Object.assign(headers, options.additionalHeaders);
  }

  return headers;
}

/**
 * 检查HTTP状态码是否表示成功
 */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * 检查HTTP状态码是否表示客户端错误
 */
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * 检查HTTP状态码是否表示服务器错误
 */
export function isServerError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600;
}

/**
 * 检查HTTP状态码是否表示可重试的错误
 */
export function isRetryableError(statusCode: number): boolean {
  return (
    statusCode === API_DEFAULTS.HTTP_STATUS.TIMEOUT ||
    statusCode === API_DEFAULTS.HTTP_STATUS.TOO_MANY_REQUESTS ||
    statusCode === API_DEFAULTS.HTTP_STATUS.BAD_GATEWAY ||
    statusCode === API_DEFAULTS.HTTP_STATUS.SERVICE_UNAVAILABLE ||
    statusCode === API_DEFAULTS.HTTP_STATUS.GATEWAY_TIMEOUT
  );
}

/**
 * 获取安全的MaxTokens值
 * 优先级: 用户配置 > Provider默认值 > 通用默认值
 */
export function getSafeMaxTokens(
  userMaxTokens?: number,
  provider?: 'lmstudio' | 'anthropic' | 'openai' | 'gemini'
): number {
  // 如果用户指定了值，验证并返回
  if (userMaxTokens && userMaxTokens > 0) {
    return Math.min(userMaxTokens, API_DEFAULTS.TOKEN_LIMITS.ABSOLUTE_MAX);
  }

  // 如果指定了provider，使用provider默认值
  if (provider) {
    const providerKey = provider.toUpperCase() as keyof typeof API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS;
    return API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS[providerKey] || API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS.GENERIC;
  }

  // 返回通用默认值
  return API_DEFAULTS.TOKEN_LIMITS.DEFAULT_MAX_TOKENS;
}

/**
 * 验证MaxTokens值是否合法
 */
export function validateMaxTokens(maxTokens: number): { valid: boolean; message?: string } {
  if (!Number.isInteger(maxTokens)) {
    return { valid: false, message: 'maxTokens must be an integer' };
  }

  if (maxTokens < API_DEFAULTS.TOKEN_LIMITS.MIN_TOKENS) {
    return { valid: false, message: `maxTokens must be >= ${API_DEFAULTS.TOKEN_LIMITS.MIN_TOKENS}` };
  }

  if (maxTokens > API_DEFAULTS.TOKEN_LIMITS.ABSOLUTE_MAX) {
    return { valid: false, message: `maxTokens must be <= ${API_DEFAULTS.TOKEN_LIMITS.ABSOLUTE_MAX}` };
  }

  return { valid: true };
}

/**
 * 获取Provider推荐的MaxTokens值
 */
export function getRecommendedMaxTokens(provider: 'lmstudio' | 'anthropic' | 'openai' | 'gemini'): number {
  const providerKey = provider.toUpperCase() as keyof typeof API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS;
  return API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS[providerKey] || API_DEFAULTS.TOKEN_LIMITS.PROVIDER_DEFAULTS.GENERIC;
}
