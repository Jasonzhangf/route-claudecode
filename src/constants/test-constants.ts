/**
 * 测试用常量配置
 * 避免硬编码，提供统一的配置管理
 */

export const TEST_CONSTANTS = {
  // Qwen 测试配置
  QWEN: {
    SERVER: {
      DEFAULT_PORT: 5506,
      HOST: '0.0.0.0' as const,
      DEBUG_ENABLED: true
    },
    PROVIDER: {
      NAME: 'qwen' as const,
      PROTOCOL: 'openai' as const,
      API_BASE_URL: 'https://portal.qwen.ai/v1',
      API_KEYS: ['qwen-auth-1', 'qwen-auth-2'] as const,
      MAX_TOKENS: 262144
    },
    MODELS: {
      QWEN3_CODER_PLUS: 'qwen3-coder-plus' as const,
      QWEN_MAX: 'qwen-max' as const
    },
    PERFORMANCE: {
      MAX_STARTUP_TIME: 5000,
      MAX_STEP_TIME: 1000,
      MIN_PIPELINE_LAYERS: 4
    }
  }
};