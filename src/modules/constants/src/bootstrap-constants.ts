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

export const ERROR_MESSAGES = {
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