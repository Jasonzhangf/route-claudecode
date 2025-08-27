/**
 * Pipeline Retry Constants
 * 
 * 流水线重试相关的常量定义
 */

export const PIPELINE_RETRY_CONSTANTS = {
  // Pipeline重试相关
  RETRY_STRATEGY: {
    ATTEMPT_OTHER_PIPELINES: 'attempt_other_pipelines',
    FINAL_ERROR_HANDLING: 'final_error_handling'
  },
  
  // 默认值常量
  DEFAULT_VALUES: {
    PROVIDER_NAME_DEFAULT: 'provider',
    MODEL_NAME_DEFAULT: 'model',
    PIPELINE_SEPARATOR: '-'
  },
  
  // 日志消息常量
  LOG_MESSAGES: {
    RETRY_ATTEMPT: '🔄 尝试使用其他可用流水线进行恢复',
    RETRY_SUCCESS: '✅ 流水线重试成功',
    RETRY_FAILED: '🔄 流水线重试失败',
    ALL_PIPELINES_EXHAUSTED: '❌ 所有可用流水线都已失败',
    FINAL_ERROR_TRIGGERED: '❌ 所有流水线重试都失败'
  },
  
  // 错误处理策略
  ERROR_HANDLING: {
    SERVER_LAYER_RETRY_ENABLED: true,
    MAX_PIPELINE_RETRIES: 3,
    CONTINUE_ON_SINGLE_FAILURE: true
  }
} as const;