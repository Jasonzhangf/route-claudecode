/**
 * 测试常量定义
 * 
 * 用于单元测试和集成测试的常量配置
 * 遵循零硬编码原则
 * 
 * @author RCC v4.0
 */

export const TEST_MODEL_NAMES = {
  CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  UNKNOWN_MODEL: 'unknown-model-xyz',
  LM_STUDIO_MODELS: {
    GPT_OSS_20B: 'gpt-oss-20b-mlx',
    LLAMA_3_1_8B: 'llama-3.1-8b-instruct-q4_k_m.gguf',
    QWEN_2_5_CODER: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
    DEEPSEEK_R1: 'deepseek-r1-distill-llama-8b-q4_k_m.gguf'
  }
} as const;

export const TEST_VIRTUAL_MODELS = {
  DEFAULT: 'default',
  CODING: 'coding',
  REASONING: 'reasoning',
  LONG_CONTEXT: 'longContext',
  WEB_SEARCH: 'webSearch'
} as const;

export const TEST_PROVIDER_CONFIG = {
  NAME: 'lmstudio', // 🔧 修复：使用正确的provider名称
  API_BASE_URL: 'http://localhost:1234/v1',
  API_KEY: 'lm-studio-key-1',
  WEIGHT: 100,
  MAX_TOKENS: 131072,
  SERVER_COMPATIBILITY: 'lmstudio',
  PROTOCOL: 'openai',
  TIMEOUT: 30000,
  MAX_RETRIES: 3
} as const;

export const TEST_PIPELINE_PATTERNS = {
  PIPELINE_ID_REGEX: /^lmstudio-.*-key\d+$/, // 🔧 修复：使用正确的provider名称
  EXPECTED_PIPELINE_ID: 'lmstudio-gpt-oss-20b-mlx-key0' // 🔧 修复：使用正确的pipeline ID格式
} as const;

export const TEST_REQUEST_TEMPLATES = {
  SIMPLE_CLAUDE_REQUEST: {
    messages: [
      {
        role: 'user',
        content: 'Hello world'
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  },
  TOOL_CALLING_REQUEST: {
    messages: [
      {
        role: 'user', 
        content: 'List files in current directory'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute bash commands'
        }
      }
    ],
    max_tokens: 1000
  },
  UNKNOWN_MODEL_REQUEST: {
    messages: [{ role: 'user', content: 'test' }]
  }
} as const;

export const TEST_MESSAGES = {
  VIRTUAL_MODEL_MAPPING_SUCCESS: '✅ Claude模型映射测试通过',
  TOOL_CALLING_MAPPING_SUCCESS: '✅ Claude工具调用映射测试通过',
  UNKNOWN_MODEL_MAPPING_SUCCESS: '✅ 未知模型映射测试通过',
  PIPELINE_TABLE_SUCCESS: '✅ 流水线表生成测试通过',
  DEFAULT_PIPELINE_MAPPING_SUCCESS: '✅ Default虚拟模型流水线映射测试通过',
  COMPLETE_MAPPING_CHAIN_SUCCESS: '✅ 完整映射链路验证通过',
  INCONSISTENCY_DETECTION_SUCCESS: '✅ 不一致检测测试通过 - 成功识别了映射不匹配问题',
  FIX_VERIFICATION_SUCCESS: '✅ 修复方案验证通过 - 推荐使用统一的\'default\'虚拟模型名称'
} as const;

export const TEST_STEP_MESSAGES = {
  STEP_1_VIRTUAL_MODEL_MAPPING: '🔄 步骤1 - 虚拟模型映射',
  STEP_2_PIPELINE_LOOKUP: '🔄 步骤2 - 流水线查找',
  STEP_3_TARGET_MODEL_VALIDATION: '🔄 步骤3 - 目标模型验证',
  INCONSISTENCY_TEST_SCENARIO: '🚨 测试场景: 检测模型映射不一致问题',
  MAPPING_CONSISTENCY_RESULTS: '📊 映射一致性检查结果',
  SUGGESTED_FIXES: '🔧 建议修复方案',
  FIX_VERIFICATION: '🔧 修复方案验证'
} as const;

export const TEST_LOG_FORMATS = {
  VIRTUAL_MODEL_MAPPING: (inputModel: string, virtualModel: string) => 
    `${TEST_MESSAGES.VIRTUAL_MODEL_MAPPING_SUCCESS}: ${inputModel} -> ${virtualModel}`,
  TOOL_CALLING_MAPPING: (inputModel: string, virtualModel: string) => 
    `${TEST_MESSAGES.TOOL_CALLING_MAPPING_SUCCESS}: ${inputModel} -> ${virtualModel}`,
  UNKNOWN_MODEL_MAPPING: (inputModel: string, virtualModel: string) => 
    `${TEST_MESSAGES.UNKNOWN_MODEL_MAPPING_SUCCESS}: ${inputModel} -> ${virtualModel}`,
  PIPELINE_TABLE_GENERATION: (totalPipelines: number) => 
    `${TEST_MESSAGES.PIPELINE_TABLE_SUCCESS}: 总计${totalPipelines}个流水线`,
  PIPELINE_DETAILS: (pipelineId: string, targetModel: string, virtualModel: string) => ({
    pipelineId: `第一个流水线ID: ${pipelineId}`,
    targetModel: `目标模型: ${targetModel}`,
    virtualModel: `虚拟模型: ${virtualModel}`
  }),
  DEFAULT_PIPELINE_MAPPING: (pipelineId: string, targetModel: string, endpoint: string) => ({
    pipelineId: `流水线ID: ${pipelineId}`,
    targetModel: `目标模型: ${targetModel}`,
    endpoint: `端点: ${endpoint}`
  }),
  COMPLETE_MAPPING_CHAIN: (claudeModel: string, virtualModel: string, pipelineId: string, targetModel: string, endpoint: string) => ({
    claudeModel: `Claude请求模型: ${claudeModel}`,
    virtualModel: `-> 虚拟模型: ${virtualModel}`,
    pipelineId: `-> 流水线ID: ${pipelineId}`,
    targetModel: `-> LM Studio目标模型: ${targetModel}`,
    endpoint: `-> 端点: ${endpoint}`
  }),
  STEP_LOGGING: {
    VIRTUAL_MODEL_MAPPING: (claudeModel: string, virtualModel: string) => 
      `${TEST_STEP_MESSAGES.STEP_1_VIRTUAL_MODEL_MAPPING}: ${claudeModel} -> ${virtualModel}`,
    PIPELINE_LOOKUP: (virtualModel: string, pipelineId: string) => 
      `${TEST_STEP_MESSAGES.STEP_2_PIPELINE_LOOKUP}: virtualModel=${virtualModel} -> pipelineId=${pipelineId}`,
    TARGET_MODEL_VALIDATION: (targetModel: string) => 
      `${TEST_STEP_MESSAGES.STEP_3_TARGET_MODEL_VALIDATION}: ${targetModel} 存在于LM Studio模型列表中`
  }
} as const;

export const TEST_ENDPOINTS = {
  LOCALHOST_1234: 'localhost:1234'
} as const;

export const TEST_MOCK_CONFIGS = {
  SIMPLE_TEST_CONFIG: {
    PROVIDER: {
      name: 'lmstudio', // 🔧 修复：使用正确的provider名称
      models: ['gpt-oss-20b-mlx'],
      api_base_url: 'http://localhost:1234/v1',
      api_key: 'test-key'
    },
    SYSTEM_CONFIG: {
      lmstudio: { // 🔧 修复：使用正确的provider名称
        endpoint: 'http://localhost:1234/v1', 
        protocol: 'openai' 
      }
    }
  }
} as const;

export const TEST_FIX_SUGGESTIONS = {
  FIX_OPTION_1: '1. 修改VirtualModelMapper返回provider名称而不是\'default\'',
  FIX_OPTION_2: '2. 或修改PipelineTableManager使用\'default\'作为虚拟模型名称',
  SOLUTION_1_DESCRIPTION: '方案1 - VirtualModel映射结果',
  SOLUTION_2_DESCRIPTION: '方案2 - Pipeline虚拟模型'
} as const;

export const TEST_CONSISTENCY_MESSAGES = {
  MAPPER_RESULT: 'VirtualModelMapper返回',
  PIPELINE_AVAILABLE: 'PipelineTable中可用虚拟模型', 
  CONSISTENCY_STATUS: '映射一致性',
  CONSISTENT: '✅ 一致',
  INCONSISTENT: '❌ 不一致'
} as const;