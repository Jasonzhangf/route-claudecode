/**
 * 流水线默认配置常量
 * 
 * 定义流水线处理中使用的默认值和配置参数
 * 
 * @author Pipeline Constants Manager  
 */

export const PIPELINE_DEFAULTS = {
  // Provider端点配置
  PROVIDER_ENDPOINTS: {
    QWEN: {
      BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      CHAT_PATH: '/v1/chat/completions'
    },
    LMSTUDIO: {
      BASE_URL: 'http://localhost:1234',
      CHAT_PATH: '/v1/chat/completions'
    },
    MODELSCOPE: {
      BASE_URL: 'https://api.modelscope.cn/v1',
      CHAT_PATH: '/v1/chat/completions'
    }
  },

  // HTTP请求配置
  HTTP_CONFIG: {
    METHOD: 'POST',
    HEADERS: {
      CONTENT_TYPE: 'application/json',
      USER_AGENT: 'RCC-v4.0-Pipeline'
    },
    TIMEOUT: 30000
  },

  // 请求参数默认值
  REQUEST_DEFAULTS: {
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.7,
    STREAM: false
  },

  // Provider特定参数限制
  PROVIDER_LIMITS: {
    QWEN: {
      MAX_TEMPERATURE: 2.0
    },
    LMSTUDIO: {
      FORCE_STREAM_OFF: true
    }
  },

  // 流水线标识符格式
  PIPELINE_ID_FORMAT: {
    SEPARATOR: '-',
    KEY_SUFFIX: 'key0'
  },

  // 性能要求
  PERFORMANCE_LIMITS: {
    MAX_PROCESSING_TIME: 1000,
    MAX_CONTENT_SIZE: 10000
  }
};

export default PIPELINE_DEFAULTS;