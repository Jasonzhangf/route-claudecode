/**
 * 测试常量定义
 * 
 * 为测试提供统一的常量配置，所有具体值通过环境变量或配置文件获取
 * 
 * @author Claude Code Router v4.0 - Test Constants
 */

export const TEST_TIMEOUTS = {
  STANDARD: 30000,
  SHORT: 5000,
  LONG: 60000,
  PROCESSING_MAX: 200,
  PERFORMANCE_THRESHOLD: 5000
};

export const TEST_THRESHOLDS = {
  COMPATIBILITY: 80,
  FIELD_MAPPING_ACCURACY: 95,
  TOOL_CONVERSION_SUCCESS: 100,
  TYPE_CONVERSION_SUCCESS: 100,
  ADJUSTMENT_EFFECTIVENESS: 100
};

export const TEST_OUTPUT_FILES = {
  CONFIG_INPUT: '01-config-input.json',
  PREPROCESSOR_ANALYSIS: '02-config-preprocessor-analysis.json',
  ROUTING_ANALYSIS: '03-routing-table-analysis.json',
  MULTIKEY_ANALYSIS: '04-multi-key-config-analysis.json',
  ROUTER_ANALYSIS: '05-router-preprocessor-analysis.json',
  PIPELINE_ANALYSIS: '06-pipeline-configs-analysis.json',
  COMPATIBILITY_ANALYSIS: '07-compatibility-analysis.json',
  STARTUP_REPORT: 'startup-analysis-report.json'
};

export const PIPELINE_TEST_OUTPUT_FILES = {
  REQUEST: 'e2e-pipeline-request.json',
  TRANSFORMER: 'transformer-layer-output.json',
  PROTOCOL: 'protocol-layer-output.json',
  COMPATIBILITY: 'server-compatibility-output.json',
  SERVER: 'server-layer-output.json',
  RESPONSE: 'response-transformer-output.json',
  MULTIKEY: 'multi-key-rotation-test.json',
  ERROR: 'error-handling-test.json',
  REPORT: 'e2e-pipeline-report.json'
};

export const TEST_DIRECTORIES = {
  STARTUP: 'startup-analysis',
  PIPELINE: 'e2e-pipeline',
  COMPARISON: 'comparison-results',
  ADJUSTMENTS: 'template-adjustments'
};

export const REQUEST_FIELDS = {
  MODEL: 'model',
  MESSAGES: 'messages',
  TOOLS: 'tools',
  MAX_TOKENS: 'max_tokens',
  TEMPERATURE: 'temperature',
  STREAM: 'stream'
};

export const RESPONSE_FIELDS = {
  ID: 'id',
  TYPE: 'type',
  ROLE: 'role',
  MODEL: 'model',
  CONTENT: 'content',
  TOOL_CALLS: 'tool_calls',
  STOP_REASON: 'stop_reason'
};

export const PROCESSING_STEPS = {
  CONFIG_LOADING: 'Config Loading & Analysis',
  PREPROCESSOR: 'ConfigPreprocessor Deep Analysis',
  ROUTING: 'Routing Table Structure Analysis',
  MULTIKEY: 'Multi-Key Configuration Analysis',
  ROUTER: 'RouterPreprocessor Processing & Analysis',
  PIPELINE: 'Pipeline Configuration Detailed Analysis',
  COMPATIBILITY: 'Provider Compatibility Analysis'
};

export const LAYER_TYPES = {
  TRANSFORMER: 'transformer',
  PROTOCOL: 'protocol',
  SERVER_COMPATIBILITY: 'server-compatibility',
  SERVER: 'server'
};

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
};

export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  XML: 'application/xml'
};

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

export const TOOL_TYPES = {
  FUNCTION: 'function',
  TOOL_USE: 'tool_use'
};

export const CONFIG_KEYS = {
  VERSION: 'version',
  PROVIDERS: 'Providers',
  ROUTER: 'router',
  SERVER: 'server',
  API_KEY: 'apiKey',
  MULTI_KEY_CONFIG: 'MultiKeyConfig'
};

export const PROVIDER_FIELDS = {
  NAME: 'name',
  PROTOCOL: 'protocol',
  API_BASE_URL: 'api_base_url',
  API_KEY: 'api_key',
  MODELS: 'models',
  MAX_TOKENS: 'maxTokens',
  SERVER_COMPATIBILITY: 'serverCompatibility'
};

export const MULTI_KEY_FIELDS = {
  ROTATION_STRATEGY: 'rotationStrategy',
  KEY_FAILURE_HANDLING: 'keyFailureHandling',
  LOAD_BALANCING: 'loadBalancing'
};

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2
};

export const OPTIMIZATION_FLAGS = {
  MULTI_KEY_ROTATION: 'multiKeyRotation',
  SERVER_COMPATIBILITY: 'serverCompatibility',
  TOOL_CALL_ENHANCEMENT: 'toolCallEnhancement',
  STREAMING_OPTIMIZATION: 'streamingOptimization'
};

export const VALIDATION_KEYS = {
  CONFIG_VALID: 'configValid',
  ROUTING_VALID: 'routingValid',
  PIPELINES_VALID: 'pipelinesValid',
  COMPATIBILITY_VALID: 'compatibilityValid'
};

export const ANALYSIS_TYPES = {
  FORMAT_COMPATIBILITY: 'formatCompatibility',
  CONTENT_SIMILARITY: 'contentSimilarity',
  STRUCTURAL_DIFFERENCES: 'structuralDifferences',
  PROCESSING_DIFFERENCES: 'processingDifferences'
};

/**
 * Qwen特定测试常量
 */
export const QWEN_TEST_CONFIG = {
  provider: 'qwen',
  baseURL: 'https://portal.qwen.ai/v1',
  apiKey: 'qwen-auth-1',
  model: 'qwen3-coder-plus',
  port: 5507,
  serverCompatibility: 'qwen',
  maxTokens: 32768,
  enhanceTool: true,
  routes: ['default', 'longContext', 'background', 'think', 'webSearch']
};

/**
 * 测试输出文件常量 - Qwen专用
 */
export const QWEN_TEST_OUTPUT_FILES = {
  CONFIG_VALIDATION: '00-config-validation.json',
  CONFIG_PREPROCESSING: '01-qwen-config-preprocessing.json',
  ROUTER_PREPROCESSING: '02-qwen-router-preprocessing.json', 
  PIPELINE_ASSEMBLY: '03-qwen-pipeline-assembly.json',
  COMPLETE_SYSTEM: '04-qwen-complete-system-result.json',
  TEST_SUMMARY: '00-qwen-test-summary.json',
  PERFORMANCE_RESULTS: 'qwen-performance-results.json',
  ERROR_HANDLING: 'qwen-error-handling.json',
  MEMORY_USAGE: 'qwen-memory-usage.json',
  COMPLETENESS_REPORT: 'qwen-test-completeness-report.json'
};

/**
 * 性能要求常量 - Qwen专用
 */
export const QWEN_PERFORMANCE_THRESHOLDS = {
  STARTUP_TIME_MAX: 2000, // 2秒
  AVERAGE_TIME_MAX: 1000, // 1秒
  MEMORY_INCREASE_MAX: 200, // 200MB
  LAYER_VALIDATION_REQUIRED: true,
  ITERATIONS_DEFAULT: 3,
  CONSISTENCY_THRESHOLD: 0.3 // 30%变异系数
};

/**
 * 测试步骤常量 - Qwen专用
 */
export const QWEN_TEST_STEPS = {
  CONFIG_PREPROCESSING: 'Qwen Configuration Preprocessing',
  ROUTER_PREPROCESSING: 'Qwen Router Preprocessing',
  PIPELINE_ASSEMBLY: 'Qwen Pipeline Assembly',
  SYSTEM_VALIDATION: 'Qwen System Validation'
};

/**
 * 从环境变量获取测试配置
 */
export function getTestConfig() {
  return {
    timeout: Number(process.env.TEST_TIMEOUT) || TEST_TIMEOUTS.STANDARD,
    maxProcessingTime: Number(process.env.MAX_PROCESSING_TIME) || TEST_TIMEOUTS.PROCESSING_MAX,
    compatibilityThreshold: Number(process.env.COMPATIBILITY_THRESHOLD) || TEST_THRESHOLDS.COMPATIBILITY,
    fieldMappingAccuracy: Number(process.env.FIELD_MAPPING_ACCURACY) || TEST_THRESHOLDS.FIELD_MAPPING_ACCURACY
  };
}

/**
 * 从环境变量获取提供商配置
 */
export function getProviderConfig() {
  return {
    name: process.env.PROVIDER_NAME || 'test-provider',
    protocol: process.env.PROVIDER_PROTOCOL || 'openai',
    maxTokens: Number(process.env.MAX_TOKENS) || 262144,
    temperature: Number(process.env.TEMPERATURE) || 0.7
  };
}

/**
 * 从环境变量获取服务器配置
 */
export function getServerConfig() {
  return {
    port: process.env.TEST_PORT || '5506',
    host: process.env.TEST_HOST || '0.0.0.0',
    debug: process.env.DEBUG === 'true' || true
  };
}

/**
 * 从环境变量获取路径配置
 */
export function getPathConfig() {
  return {
    configPath: process.env.CONFIG_PATH || './config.json',
    outputDir: process.env.OUTPUT_DIR || './test-outputs',
    baseDir: process.env.BASE_DIR || __dirname
  };
}