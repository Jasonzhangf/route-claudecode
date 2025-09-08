/**
 * Bootstrap配置常量
 */

export const BOOTSTRAP_CONFIG = {
  APPLICATION_VERSION: '4.0.0',
  DEFAULT_CONFIG_PATH: './config.json',
  MAX_BOOTSTRAP_TIME: 30000, // 30秒
  CLEANUP_TIMEOUT: 5000, // 5秒
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1秒
};

// Provider model mappings defined as configuration
export const PROVIDER_MODEL_MAPPINGS = {
  // Qwen models configured as generic identifiers
  QWEN_MODELS: {
    CODER_SERIES: 'coder-plus-series',
    MAX_SERIES: 'max-series',
    TURBO_SERIES: 'turbo-series'
  },
  
  // LM Studio models configured as generic identifiers
  LMSTUDIO_MODELS: {
    LLAMA_SERIES: 'llama-series',
    MISTRAL_SERIES: 'mistral-series'
  },
  
  // OpenAI models configured as generic identifiers
  OPENAI_MODELS: {
    GPT4_SERIES: 'gpt4-series',
    GPT3_SERIES: 'gpt3-series'
  },
  
  // Claude models configured as generic identifiers
  CLAUDE_MODELS: {
    CLAUDE3_SERIES: 'claude3-series',
    SONNET_SERIES: 'sonnet-series'
  }
};

export const SCHEDULER_DEFAULTS = {
  STRATEGY: 'round-robin',
  MAX_ERROR_COUNT: 5,
  BLACKLIST_DURATION_MS: 300000, // 5分钟
  AUTH_RETRY_DELAY_MS: 1000, // 1秒
  HEALTH_CHECK_INTERVAL_MS: 30000 // 30秒
};

export const BOOTSTRAP_CONSTANTS = {
  PROVIDERS: {
    ANTHROPIC: {
      DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
      MAX_TOKENS: 8192,
      TEMPERATURE: 0.7
    },
    OPENAI: {
      DEFAULT_MODEL: 'gpt-4',
      MAX_TOKENS: 8192,
      TEMPERATURE: 0.7
    },
    GEMINI: {
      DEFAULT_MODEL: 'gemini-pro',
      MAX_TOKENS: 8192,
      TEMPERATURE: 0.7
    }
  },
  TIMEOUTS: {
    REQUEST: 30000,
    CONNECTION: 10000,
    RESPONSE: 60000
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2
  }
};

export const API_DEFAULTS = {
  PROVIDERS: {
    OPENAI: {
      DEFAULT_MODEL: 'gpt-3.5-turbo',
      REQUEST_TIMEOUT: 30000
    },
    ANTHROPIC: {
      DEFAULT_MODEL: 'claude-3-haiku',
      REQUEST_TIMEOUT: 30000
    }
  },
  TOKEN_LIMITS: {
    DEFAULT_MAX_TOKENS: 4096
  },
  CONTENT_TYPES: {
    JSON: 'application/json'
  }
};

/**
 * Server Configuration Defaults
 * Constants for server module configuration to avoid hardcoding
 */
export const SERVER_CONFIG_DEFAULTS = {
  // OpenAI Server Configuration
  OPENAI: {
    TIMEOUT: 60000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT_MS: 30000,
    MAX_CONCURRENT_REQUESTS: 10,
    SKIP_AUTHENTICATION: false,
    ENABLE_RESPONSE_VALIDATION: true
  },
  
  // General Server Defaults
  GENERAL: {
    DEFAULT_TIMEOUT: 30000,
    DEFAULT_MAX_RETRIES: 3,
    DEFAULT_RETRY_DELAY: 1000,
    DEFAULT_MAX_CONCURRENT_REQUESTS: 10
  },
  
  // Configuration Field Mappings
  FIELD_MAPPINGS: {
    // Pipeline config uses 'endpoint', OpenAI SDK needs 'baseURL'
    ENDPOINT_FIELD: 'endpoint',
    BASE_URL_FIELD: 'baseURL',
    API_BASE_URL_FIELD: 'api_base_url',
    
    // API Key field variations
    API_KEY_FIELD: 'apiKey',
    API_KEY_ALT_FIELD: 'api_key'
  }
};

export const MODULE_REGISTRY_DEFAULTS = {
  // Server module instantiation defaults
  SERVER_MODULE: {
    TIMEOUT: SERVER_CONFIG_DEFAULTS.OPENAI.TIMEOUT,
    MAX_RETRIES: SERVER_CONFIG_DEFAULTS.OPENAI.MAX_RETRIES,
    RETRY_DELAY: SERVER_CONFIG_DEFAULTS.OPENAI.RETRY_DELAY,
    SKIP_AUTHENTICATION: SERVER_CONFIG_DEFAULTS.OPENAI.SKIP_AUTHENTICATION,
    ENABLE_RESPONSE_VALIDATION: SERVER_CONFIG_DEFAULTS.OPENAI.ENABLE_RESPONSE_VALIDATION,
    REQUEST_TIMEOUT_MS: SERVER_CONFIG_DEFAULTS.OPENAI.REQUEST_TIMEOUT_MS,
    MAX_CONCURRENT_REQUESTS: SERVER_CONFIG_DEFAULTS.OPENAI.MAX_CONCURRENT_REQUESTS
  }
};

export const BOOTSTRAP_ERROR_MESSAGES = {
  COORDINATOR: {
    PROCESSING_FAILED: 'Failed to process error through unified flow',
    INITIALIZATION_FAILED: 'Failed to initialize error coordinator',
    CLEANUP_FAILED: 'Failed to cleanup expired logs',
    REPORT_GENERATION_FAILED: 'Failed to generate error summary report'
  },
  VALIDATION: {
    INVALID_INPUT: 'Invalid input provided',
    MISSING_REQUIRED_FIELD: 'Required field is missing',
    INVALID_FORMAT: 'Invalid data format'
  },
  NETWORK: {
    CONNECTION_FAILED: 'Failed to establish connection',
    TIMEOUT: 'Request timed out',
    DNS_ERROR: 'DNS resolution failed'
  },
  AUTH: {
    AUTHENTICATION_FAILED: 'Authentication failed',
    INVALID_CREDENTIALS: 'Invalid credentials provided',
    ACCESS_DENIED: 'Access denied'
  },
  INTERNAL: {
    UNEXPECTED_ERROR: 'An unexpected error occurred',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
    INTERNAL_SERVER_ERROR: 'Internal server error'
  }
};

export const BOOTSTRAP_ERRORS = {
  CONFIG_PREPROCESSING_FAILED: 'CONFIG_PREPROCESSING_FAILED',
  ROUTER_PREPROCESSING_FAILED: 'ROUTER_PREPROCESSING_FAILED',
  UNIFIED_INITIALIZER_INIT_FAILED: 'UNIFIED_INITIALIZER_INIT_FAILED',
  RUNTIME_SCHEDULER_INIT_FAILED: 'RUNTIME_SCHEDULER_INIT_FAILED',
  COMPONENT_BOOTSTRAP_FAILED: 'COMPONENT_BOOTSTRAP_FAILED'
};

export const COMPONENT_NAMES = {
  CONFIG_PREPROCESSOR: 'ConfigPreprocessor',
  ROUTER_PREPROCESSOR: 'RouterPreprocessor',
  UNIFIED_INITIALIZER: 'UnifiedInitializer',
  RUNTIME_SCHEDULER: 'RuntimeScheduler'
};