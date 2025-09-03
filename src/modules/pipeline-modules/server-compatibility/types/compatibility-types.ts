/**
 * Compatibility Types - 兼容性模块类型定义
 *
 * 定义服务器兼容性模块使用的所有类型
 *
 * @author Jason Zhang
 */

/**
 * 服务器兼容性配置接口
 */
export interface ServerCompatibilityConfig {
  enableRequestAdaptation?: boolean;
  enableResponseFixing?: boolean;
  enableErrorNormalization?: boolean;
  enableDebugLogging?: boolean;
  providerConfigs?: Record<string, ProviderSpecificConfig>;
}

/**
 * Provider特定配置
 */
export interface ProviderSpecificConfig {
  name: string;
  type: 'lmstudio' | 'deepseek' | 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'generic';
  baseUrl?: string;
  timeout?: number;
  retryCount?: number;
  customSettings?: Record<string, any>;
}

/**
 * 请求适配结果
 */
export interface RequestAdaptationResult {
  adapted: boolean;
  originalRequest: any;
  adaptedRequest: any;
  adaptations: AdaptationInfo[];
  serverType: string;
}

/**
 * 响应修复结果
 */
export interface ResponseFixResult {
  fixed: boolean;
  originalResponse: any;
  fixedResponse: any;
  fixes: FixInfo[];
  serverType: string;
}

/**
 * 错误标准化结果
 */
export interface ErrorNormalizationResult {
  normalized: boolean;
  originalError: any;
  normalizedError: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  retryDelay?: number;
  serverType: string;
}

/**
 * 适配信息
 */
export interface AdaptationInfo {
  type: 'parameter_adjustment' | 'feature_removal' | 'feature_addition' | 'validation';
  parameter?: string;
  originalValue?: any;
  newValue?: any;
  reason: string;
  description: string;
}

/**
 * 修复信息
 */
export interface FixInfo {
  type: 'missing_field' | 'format_correction' | 'field_removal' | 'calculation' | 'standardization';
  field?: string;
  originalValue?: any;
  newValue?: any;
  reason: string;
  description: string;
}

/**
 * 兼容性检查结果
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean;
  serverType: string;
  issues: CompatibilityIssue[];
  recommendations: string[];
  confidence: number; // 0-100
}

/**
 * 兼容性问题
 */
export interface CompatibilityIssue {
  severity: 'warning' | 'error' | 'critical';
  category: 'parameter' | 'feature' | 'format' | 'protocol';
  message: string;
  field?: string;
  suggestedFix?: string;
}

/**
 * Debug事件类型
 */
export interface DebugEvent {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'request' | 'response' | 'error' | 'adaptation' | 'fix';
  serverType: string;
  requestId?: string;
  message: string;
  data?: any;
}

/**
 * 性能指标
 */
export interface CompatibilityMetrics {
  requestsProcessed: number;
  adaptationsPerformed: number;
  fixesApplied: number;
  errorsNormalized: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  serverTypeBreakdown: Record<
    string,
    {
      requests: number;
      adaptations: number;
      fixes: number;
      averageTime: number;
    }
  >;
}

/**
 * Provider能力评估
 */
export interface ProviderCapabilityAssessment {
  serverType: string;
  overallScore: number; // 0-100
  capabilities: {
    tools: boolean;
    thinking: boolean;
    streaming: boolean;
    customParameters: boolean;
  };
  parameterSupport: {
    temperature: boolean;
    topP: boolean;
    maxTokens: boolean;
    frequencyPenalty: boolean;
    presencePenalty: boolean;
  };
  responseQuality: {
    standardCompliance: number; // 0-100
    consistencyScore: number; // 0-100
    completenessScore: number; // 0-100
  };
  reliability: {
    uptimeScore: number; // 0-100
    errorRate: number; // 0-1
    averageLatency: number; // ms
  };
}

/**
 * 兼容性统计
 */
export interface CompatibilityStats {
  totalRequests: number;
  adaptedRequests: number;
  fixedResponses: number;
  normalizedErrors: number;
  adaptationRate: number; // 0-1
  fixRate: number; // 0-1
  errorNormalizationRate: number; // 0-1
  processingTimeStats: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
  serverTypeStats: Record<
    string,
    {
      requests: number;
      adaptationRate: number;
      fixRate: number;
      averageTime: number;
    }
  >;
}

/**
 * 兼容性规则
 */
export interface CompatibilityRule {
  id: string;
  name: string;
  serverType: string;
  category: 'parameter' | 'response' | 'error';
  condition: (input: any) => boolean;
  action: (input: any) => any;
  priority: number; // 1-10, 10 highest
  description: string;
  enabled: boolean;
}

/**
 * 兼容性模式配置
 */
export interface CompatibilityMode {
  strict: boolean; // 严格模式：任何不兼容都报错
  permissive: boolean; // 宽松模式：尽可能适配
  preserveOriginal: boolean; // 保留原始数据用于调试
  logAllChanges: boolean; // 记录所有更改
  validateResults: boolean; // 验证结果格式
}

/**
 * 兼容性测试用例
 */
export interface CompatibilityTestCase {
  id: string;
  name: string;
  serverType: string;
  testType: 'request' | 'response' | 'error';
  input: any;
  expectedOutput: any;
  description: string;
  tags: string[];
}

/**
 * 兼容性报告
 */
export interface CompatibilityReport {
  timestamp: number;
  serverType: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    compatibilityScore: number; // 0-100
  };
  details: {
    adaptations: AdaptationInfo[];
    fixes: FixInfo[];
    issues: CompatibilityIssue[];
    recommendations: string[];
  };
  metrics: CompatibilityMetrics;
  performance: {
    processingTime: number;
    memoryUsage: number;
    successRate: number;
  };
}

/**
 * 用于扩展的钩子类型
 */
export interface CompatibilityHooks {
  beforeRequestAdaptation?: (request: any, serverType: string) => Promise<any> | any;
  afterRequestAdaptation?: (result: RequestAdaptationResult) => Promise<void> | void;
  beforeResponseFix?: (response: any, serverType: string) => Promise<any> | any;
  afterResponseFix?: (result: ResponseFixResult) => Promise<void> | void;
  beforeErrorNormalization?: (error: any, serverType: string) => Promise<any> | any;
  afterErrorNormalization?: (result: ErrorNormalizationResult) => Promise<void> | void;
  onDebugEvent?: (event: DebugEvent) => Promise<void> | void;
}

/**
 * OpenAI标准请求格式
 */
export interface OpenAIStandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'none' | 'auto' | {
    type: 'function';
    function: { name: string };
  };
}

/**
 * OpenAI标准响应格式
 */
export interface OpenAIStandardResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  system_fingerprint?: string;
  thinking?: any;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI错误响应格式
 */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string | number;
  };
}

/**
 * Debug记录器接口
 */
export interface DebugRecorder {
  record(eventType: string, data: any): void;
  recordInput(moduleType: string, requestId: string, data: any): void;
  recordOutput(moduleType: string, requestId: string, data: any): void;
  recordError(moduleType: string, requestId: string, data: any): void;
}

/**
 * Provider能力定义
 */
export interface ProviderCapabilities {
  name?: string;
  tools: boolean;
  thinking: boolean;
  streaming: boolean;
  customParameters: boolean;
  supportsTools?: boolean;
  supportsThinking?: boolean;
  responseFixesNeeded?: boolean;
  parameterLimits: {
    maxTokens: number;
    max_tokens?: number;
    temperatureMin: number;
    temperatureMax: number;
    temperature?: number;
    topPMin: number;
    topPMax: number;
    top_p?: number;
  };
}
