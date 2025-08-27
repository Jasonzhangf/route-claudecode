/**
 * Gemini CLI Configuration Constants
 * 避免硬编码，用于配置文件生成和验证
 */

export const GEMINI_CONFIG_CONSTANTS = {
  PROVIDER: {
    NAME: 'gemini-cli',
    PROTOCOL: 'gemini',
    API_BASE_URL: 'https://cloudcode-pa.googleapis.com/v1beta1',
    AUTH_FILE: 'gemini-cli-auth'
  },
  
  MODELS: [
    'gemini-2.5-flash',
    'gemini-2.5-pro', 
    'gemini-2.5-flash-8b',
    'gemini-2.0-flash-experimental',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
  ],
  
  SERVER_COMPATIBILITY: {
    USE: 'gemini-cli',
    OPTIONS: {
      MAX_TOKENS: 2097152,
      ENHANCE_TOOL: true,
      PROJECT_ID: 'neat-achievment-gvmxc',
      ENABLE_THINKING: false,
      STREAMING_ENABLED: true
    }
  },
  
  ROUTER_ROUTES: {
    DEFAULT: 'gemini-cli,gemini-2.5-flash',
    LONG_CONTEXT: 'gemini-cli,gemini-2.5-pro',
    BACKGROUND: 'gemini-cli,gemini-2.5-flash-8b',
    THINK: 'gemini-cli,gemini-2.5-pro',
    WEB_SEARCH: 'gemini-cli,gemini-2.5-flash',
    CODING: 'gemini-cli,gemini-2.5-pro'
  },
  
  AUTH_CONFIG: {
    AUTH_TYPE: 'oauth2',
    AUTH_FILE_NAME: 'gemini-cli-auth',
    AUTO_REFRESH: true,
    REFRESH_THRESHOLD_SECONDS: 30,
    PROJECT_ID: 'neat-achievment-gvmxc',
    SCOPES: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/generative-language'
    ]
  },
  
  SERVER: {
    PORT: 5508,
    HOST: '0.0.0.0',
    DEBUG: true
  }
} as const;