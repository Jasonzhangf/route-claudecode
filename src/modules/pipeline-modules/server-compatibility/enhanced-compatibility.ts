/**
 * Enhanced Server-Compatibility Module - 精简版设计实现
 *
 * 设计理念：
 * 1. 响应后处理 - 修复各Provider响应格式不一致问题
 * 2. 参数范围适配 - 调整超出Provider限制的参数
 * 3. 错误标准化 - 统一不同Provider的错误响应格式
 * 4. 移除模型映射 - 该功能属于Router层职责
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import {
  LMStudioResponseFixer,
  DeepSeekResponseFixer,
  OllamaResponseFixer,
  GenericResponseFixer,
} from './response-compatibility-fixer';

/**
 * 标准OpenAI请求接口
 */
export interface OpenAIStandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * 标准OpenAI响应接口
 */
export interface OpenAIStandardResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
  thinking?: string; // DeepSeek等模型的thinking模式字段
}

/**
 * 标准OpenAI错误响应接口
 */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: 'api_error' | 'invalid_request_error' | 'authentication_error' | 'rate_limit_error';
    code: string | null;
    param: string | null;
  };
}

/**
 * Provider能力配置接口
 */
export interface ProviderCapabilities {
  name: string;
  supportsTools: boolean;
  supportsThinking: boolean;
  parameterLimits: {
    temperature?: { min: number; max: number };
    top_p?: { min: number; max: number };
    max_tokens?: { min: number; max: number };
  };
  responseFixesNeeded: string[];
}

/**
 * Debug记录器接口（模拟）
 */
export interface DebugRecorder {
  record(eventType: string, data: any): void;
  recordInput(moduleType: string, requestId: string, data: any): void;
  recordOutput(moduleType: string, requestId: string, data: any): void;
  recordError(moduleType: string, requestId: string, data: any): void;
}

/**
 * 响应分析结果接口
 */
export interface ResponseAnalysis {
  has_id: boolean;
  has_object: boolean;
  has_created: boolean;
  has_choices: boolean;
  choices_count: number;
  has_usage: boolean;
  usage_complete: boolean;
  has_tool_calls: boolean;
  extra_fields: string[];
}

/**
 * Enhanced Server Compatibility Module
 * 专注于响应兼容性修复，不处理模型映射
 */
export class EnhancedServerCompatibilityModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'enhanced-server-compatibility-module';
  private readonly name: string = 'Enhanced Server Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = '1.0.0';
  private status: ModuleStatus['health'] = 'healthy';
  private debugRecorder: DebugRecorder;

  // Response fixers
  private lmstudioFixer: LMStudioResponseFixer;
  private deepseekFixer: DeepSeekResponseFixer;
  private ollamaFixer: OllamaResponseFixer;
  private genericFixer: GenericResponseFixer;

  constructor(debugRecorder?: DebugRecorder) {
    super();
    // 零Mockup策略：必须提供真实的debugRecorder
    if (!debugRecorder) {
      throw new Error('Zero Mockup Policy: debugRecorder is required and cannot be mocked');
    }
    this.debugRecorder = debugRecorder;

    // 初始化响应修复器
    this.lmstudioFixer = new LMStudioResponseFixer(this.debugRecorder);
    this.deepseekFixer = new DeepSeekResponseFixer(this.debugRecorder);
    this.ollamaFixer = new OllamaResponseFixer(this.debugRecorder);
    this.genericFixer = new GenericResponseFixer(this.debugRecorder);

    console.log('🔧 初始化增强服务器兼容性模块');
  }

  // ModuleInterface 实现
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return ModuleType.SERVER_COMPATIBILITY;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'running',
      health: this.status,
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async configure(config: any): Promise<void> {
    // 配置逻辑
    console.log('🔧 配置服务器兼容性模块:', config);
  }

  async start(): Promise<void> {
    console.log('▶️ 启动服务器兼容性模块');
  }

  async stop(): Promise<void> {
    console.log('⏹️ 停止服务器兼容性模块');
  }

  async reset(): Promise<void> {
    // 重置逻辑
  }

  async cleanup(): Promise<void> {
    // 清理逻辑
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: { status: 'running' } };
  }

  /**
   * 主处理方法 - 根据输入类型决定处理方式
   */
  async process(input: OpenAIStandardRequest | any): Promise<OpenAIStandardRequest | OpenAIStandardResponse> {
    const startTime = Date.now();

    try {
      if (this.isRequest(input)) {
        console.log('🔄 [ServerCompatibility] 处理请求适配');
        const serverType = this.detectServerType(input);
        const result = await this.adaptRequest(input as OpenAIStandardRequest, serverType);

        const processingTime = Date.now() - startTime;
        console.log(`✅ 请求适配完成 (${processingTime}ms)`);
        return result;
      } else {
        console.log('🔄 [ServerCompatibility] 处理响应修复');
        const serverType = this.detectServerTypeFromResponse(input);
        const result = await this.adaptResponse(input, serverType);

        const processingTime = Date.now() - startTime;
        console.log(`✅ 响应修复完成 (${processingTime}ms)`);
        return result;
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 服务器兼容性处理失败 (${processingTime}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 请求参数适配（轻量级，无模型映射）
   */
  async adaptRequest(request: OpenAIStandardRequest, serverType: string): Promise<OpenAIStandardRequest> {
    const requestId = this.generateRequestId();

    // 记录请求适配前状态
    this.debugRecorder.recordInput('server-compatibility-request', requestId, {
      server_type: serverType,
      original_request: request,
      needs_adaptation: this.detectRequestAdaptationNeeds(request, serverType),
    });

    try {
      let adaptedRequest = { ...request };

      // 根据服务器类型进行参数适配
      switch (serverType) {
        case 'deepseek':
          adaptedRequest = this.adaptForDeepSeek(adaptedRequest);
          break;
        case 'lmstudio':
          adaptedRequest = this.adaptForLMStudio(adaptedRequest);
          break;
        case 'ollama':
          adaptedRequest = this.adaptForOllama(adaptedRequest);
          break;
        default:
          // 通用适配，主要是参数范围检查
          adaptedRequest = this.adaptGeneric(adaptedRequest);
      }

      // 记录适配后状态
      this.debugRecorder.recordOutput('server-compatibility-request', requestId, {
        server_type: serverType,
        adapted_request: adaptedRequest,
        adaptations_applied: this.getAppliedAdaptations(request, adaptedRequest),
      });

      return adaptedRequest;
    } catch (error) {
      this.debugRecorder.recordError('server-compatibility-request', requestId, {
        server_type: serverType,
        error_type: error.constructor.name,
        error_message: error.message,
        original_request: request,
      });
      throw error;
    }
  }

  /**
   * 响应兼容性修复（重点功能）
   */
  async adaptResponse(response: any, serverType: string): Promise<OpenAIStandardResponse> {
    const requestId = this.generateRequestId();

    // 记录响应修复前状态
    this.debugRecorder.recordInput('server-compatibility-response', requestId, {
      server_type: serverType,
      original_response: response,
      response_analysis: this.analyzeResponse(response),
      fixes_needed: this.detectNeededFixes(response, serverType),
    });

    try {
      let fixedResponse: OpenAIStandardResponse;

      // 根据服务器类型选择修复策略
      switch (serverType) {
        case 'lmstudio':
          fixedResponse = await this.lmstudioFixer.fixResponse(response);
          break;
        case 'deepseek':
          fixedResponse = await this.deepseekFixer.fixResponse(response);
          break;
        case 'ollama':
          fixedResponse = await this.ollamaFixer.fixResponse(response);
          break;
        default:
          fixedResponse = await this.genericFixer.fixResponse(response);
      }

      // 记录修复后状态
      this.debugRecorder.recordOutput('server-compatibility-response', requestId, {
        server_type: serverType,
        fixed_response: fixedResponse,
        fixes_applied: this.getAppliedFixes(response, fixedResponse),
        validation_passed: this.validateResponse(fixedResponse),
      });

      return fixedResponse;
    } catch (error) {
      this.debugRecorder.recordError('server-compatibility-response', requestId, {
        server_type: serverType,
        error_type: error.constructor.name,
        error_message: error.message,
        original_response: response,
      });
      throw error;
    }
  }

  /**
   * 错误响应标准化
   */
  async normalizeError(error: any, serverType: string): Promise<OpenAIErrorResponse> {
    const baseError: OpenAIErrorResponse = {
      error: {
        message: '',
        type: 'api_error',
        code: null,
        param: null,
      },
    };

    this.debugRecorder.record('error_normalization', {
      server_type: serverType,
      original_error_type: error.constructor?.name,
      original_error_message: error.message,
    });

    switch (serverType) {
      case 'lmstudio':
        return this.normalizeLMStudioError(error, baseError);
      case 'deepseek':
        return this.normalizeDeepSeekError(error, baseError);
      case 'ollama':
        return this.normalizeOllamaError(error, baseError);
      default:
        return this.normalizeGenericError(error, baseError);
    }
  }

  /**
   * 获取Provider能力配置
   */
  getProviderCapabilities(serverType: string): ProviderCapabilities {
    return this.getCapabilitiesForProvider(serverType);
  }

  // 私有辅助方法

  /**
   * 判断输入是否为请求格式
   */
  private isRequest(input: any): boolean {
    return (
      input &&
      typeof input.model === 'string' &&
      Array.isArray(input.messages) &&
      input.messages.length > 0 &&
      !input.id && // 响应通常有id
      !input.choices && // 响应有choices
      !input.usage
    ); // 响应有usage
  }

  /**
   * 从请求中检测服务器类型
   */
  private detectServerType(request: OpenAIStandardRequest): string {
    // 简化实现，实际应该从配置或其他上下文获取
    // 这里基于模型名称或其他特征推断
    if (request.model.includes('deepseek')) return 'deepseek';
    if (request.model.includes('qwen') || request.model.includes('mlx')) return 'lmstudio';
    if (request.model.includes('ollama')) return 'ollama';
    return 'generic';
  }

  /**
   * 从响应中检测服务器类型
   */
  private detectServerTypeFromResponse(response: any): string {
    // 基于响应特征检测服务器类型
    if (response.thinking) return 'deepseek'; // DeepSeek特有
    if (response.model && (response.model.includes('qwen') || response.model.includes('mlx'))) return 'lmstudio';
    if (response.model && response.model.includes('ollama')) return 'ollama';
    return 'generic';
  }

  /**
   * DeepSeek请求适配
   */
  private adaptForDeepSeek(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };

    // DeepSeek工具调用优化
    if (adapted.tools && adapted.tools.length > 0) {
      adapted.tool_choice = adapted.tool_choice || 'auto';
    }

    // 参数范围限制
    if (adapted.max_tokens && adapted.max_tokens > 8192) {
      adapted.max_tokens = 8192;
      this.debugRecorder.record('deepseek_max_tokens_adjusted', {
        original: request.max_tokens,
        adjusted: adapted.max_tokens,
      });
    }

    if (adapted.temperature && (adapted.temperature < 0.01 || adapted.temperature > 2.0)) {
      adapted.temperature = Math.max(0.01, Math.min(2.0, adapted.temperature));
    }

    return adapted;
  }

  /**
   * LM Studio请求适配 - 恢复正确逻辑：只做参数调整，不转换协议
   */
  private adaptForLMStudio(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };

    // LM Studio支持工具调用，但需要确保格式正确
    if (adapted.tools && Array.isArray(adapted.tools)) {
      // 只做格式验证和修复，不做协议转换
      adapted.tools = adapted.tools.filter(tool => {
        return tool && tool.type === 'function' && tool.function && tool.function.name;
      });
      
      this.debugRecorder.record('lmstudio_tools_validated', {
        original_count: request.tools?.length || 0,
        validated_count: adapted.tools.length
      });
      
      // 确保tool_choice格式正确
      if (adapted.tool_choice && typeof adapted.tool_choice === 'object') {
        // 验证对象格式的tool_choice
        if (!adapted.tool_choice.type || !adapted.tool_choice.function?.name) {
          adapted.tool_choice = 'auto';
        }
      }
    }

    // 参数限制调整
    if (adapted.temperature && adapted.temperature > 2.0) {
      adapted.temperature = 2.0;
    }

    if (adapted.max_tokens && adapted.max_tokens > 4096) {
      adapted.max_tokens = 4096;
    }

    return adapted;
  }

  /**
   * Ollama请求适配
   */
  private adaptForOllama(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };

    // Ollama参数限制
    if (adapted.temperature && (adapted.temperature < 0 || adapted.temperature > 2.0)) {
      adapted.temperature = Math.max(0, Math.min(2.0, adapted.temperature));
    }

    // Ollama通常不支持工具调用
    if (adapted.tools) {
      delete adapted.tools;
      delete adapted.tool_choice;
    }

    return adapted;
  }

  /**
   * 通用请求适配
   */
  private adaptGeneric(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };

    // 通用参数范围检查
    if (adapted.temperature && (adapted.temperature < 0 || adapted.temperature > 2.0)) {
      adapted.temperature = Math.max(0, Math.min(2.0, adapted.temperature));
    }

    if (adapted.top_p && (adapted.top_p < 0 || adapted.top_p > 1.0)) {
      adapted.top_p = Math.max(0, Math.min(1.0, adapted.top_p));
    }

    return adapted;
  }

  /**
   * LM Studio响应修复
   */
  private async fixLMStudioResponse(response: any): Promise<OpenAIStandardResponse> {
    this.debugRecorder.record('lmstudio_response_fix_start', {
      original_structure: this.analyzeResponseStructure(response),
      has_usage: !!response.usage,
      has_choices: !!response.choices,
    });

    // 必需字段补全
    const fixedResponse: OpenAIStandardResponse = {
      id: response.id || `chatcmpl-lms-${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      object: 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || 'local-model',
      choices: this.fixChoicesArray(response.choices || []),
      usage: this.fixUsageStatistics(response.usage),
      system_fingerprint: response.system_fingerprint,
    };

    // 记录修复操作
    this.debugRecorder.record('lmstudio_response_fix_completed', {
      fixes_applied: this.getAppliedFixes(response, fixedResponse),
      final_structure_valid: this.validateOpenAIFormat(fixedResponse),
    });

    return fixedResponse;
  }

  /**
   * DeepSeek响应修复
   */
  private async fixDeepSeekResponse(response: any): Promise<OpenAIStandardResponse> {
    // DeepSeek通常返回标准格式，但处理思考模式特殊情况
    const fixedResponse: OpenAIStandardResponse = {
      ...response,
      object: 'chat.completion', // 确保object字段正确
    };

    // 处理思考模式的特殊响应
    if (response.thinking && response.thinking.length > 0) {
      this.debugRecorder.record('deepseek_thinking_mode_detected', {
        thinking_content_length: response.thinking.length,
        has_reasoning_chain: true,
      });
      // 思考内容不暴露给客户端，仅记录调试信息
      delete fixedResponse.thinking; // 移除非标准字段
    }

    // 工具调用格式确保正确
    if (fixedResponse.choices) {
      fixedResponse.choices = fixedResponse.choices.map(choice => {
        if (choice.message?.tool_calls) {
          choice.message.tool_calls = choice.message.tool_calls.map(toolCall => ({
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments:
                typeof toolCall.function?.arguments === 'string'
                  ? toolCall.function.arguments
                  : JSON.stringify(toolCall.function?.arguments || {}),
            },
          }));
        }
        return choice;
      });
    }

    return fixedResponse;
  }

  /**
   * Ollama响应修复
   */
  private async fixOllamaResponse(response: any): Promise<OpenAIStandardResponse> {
    // Ollama响应修复逻辑
    return this.fixGenericResponse(response);
  }

  /**
   * 通用响应修复
   */
  private async fixGenericResponse(response: any): Promise<OpenAIStandardResponse> {
    const chatId = `chatcmpl-${this.generateUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // 如果已经是标准格式，进行基础修复
    if (this.isStandardOpenAIResponse(response)) {
      return {
        ...response,
        id: response.id || chatId,
        created: response.created || timestamp,
        usage: this.fixUsageStatistics(response.usage),
      };
    }

    // 从各种可能的响应格式中提取内容
    let content = '';
    if (typeof response === 'string') {
      content = response;
    } else if (response.content) {
      content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } else if (response.choices?.[0]?.message?.content) {
      content = response.choices[0].message.content;
    } else if (response.message) {
      content = typeof response.message === 'string' ? response.message : JSON.stringify(response.message);
    }

    const fixedResponse: OpenAIStandardResponse = {
      id: chatId,
      object: 'chat.completion',
      created: timestamp,
      model: response.model || 'generic-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };

    return fixedResponse;
  }

  /**
   * 修复使用统计信息
   */
  private fixUsageStatistics(usage: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    const fixedUsage = {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    };

    // 自动计算total_tokens如果缺失
    if (fixedUsage.total_tokens === 0) {
      fixedUsage.total_tokens = fixedUsage.prompt_tokens + fixedUsage.completion_tokens;
    }

    return fixedUsage;
  }

  /**
   * 修复choices数组
   */
  private fixChoicesArray(choices: any[]): OpenAIStandardResponse['choices'] {
    if (!Array.isArray(choices) || choices.length === 0) {
      return [
        {
          index: 0,
          message: { role: 'assistant', content: '' },
          finish_reason: 'stop',
        },
      ];
    }

    return choices.map((choice, index) => ({
      index: choice.index ?? index,
      message: {
        role: 'assistant',
        content: choice.message?.content || '',
        tool_calls: choice.message?.tool_calls ? this.fixToolCallsFormat(choice.message.tool_calls) : undefined,
      },
      finish_reason: choice.finish_reason || 'stop',
    }));
  }

  /**
   * 修复工具调用格式
   */
  private fixToolCallsFormat(
    toolCalls: any[]
  ): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
    return toolCalls.map(toolCall => ({
      id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: {
        name: toolCall.function?.name || '',
        arguments:
          typeof toolCall.function?.arguments === 'string'
            ? toolCall.function.arguments
            : JSON.stringify(toolCall.function?.arguments || {}),
      },
    }));
  }

  /**
   * LM Studio错误标准化
   */
  private normalizeLMStudioError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    if (error.message?.includes('model not loaded')) {
      baseError.error.message = 'Model not available on local server';
      baseError.error.type = 'invalid_request_error';
      baseError.error.code = 'model_not_found';
    } else if (error.message?.includes('context length')) {
      baseError.error.message = 'Request exceeds maximum context length';
      baseError.error.type = 'invalid_request_error';
      baseError.error.code = 'context_length_exceeded';
    } else {
      baseError.error.message = error.message || 'LM Studio server error';
      baseError.error.type = 'api_error';
    }

    return baseError;
  }

  /**
   * DeepSeek错误标准化
   */
  private normalizeDeepSeekError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    if (error.status === 429) {
      baseError.error.message = 'Rate limit exceeded';
      baseError.error.type = 'rate_limit_error';
      baseError.error.code = 'rate_limit_exceeded';
    } else if (error.status === 401) {
      baseError.error.message = 'Invalid API key';
      baseError.error.type = 'authentication_error';
      baseError.error.code = 'invalid_api_key';
    } else {
      baseError.error.message = error.message || 'DeepSeek API error';
      baseError.error.type = 'api_error';
    }

    return baseError;
  }

  /**
   * Ollama错误标准化
   */
  private normalizeOllamaError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    baseError.error.message = error.message || 'Ollama server error';
    baseError.error.type = 'api_error';
    return baseError;
  }

  /**
   * 通用错误标准化
   */
  private normalizeGenericError(error: any, baseError: OpenAIErrorResponse): OpenAIErrorResponse {
    baseError.error.message = error.message || 'Unknown server error';
    baseError.error.type = 'api_error';
    return baseError;
  }

  /**
   * Provider能力配置获取
   */
  private getCapabilitiesForProvider(serverType: string): ProviderCapabilities {
    const capabilities: Record<string, ProviderCapabilities> = {
      deepseek: {
        name: 'deepseek',
        supportsTools: true,
        supportsThinking: true,
        parameterLimits: {
          temperature: { min: 0.01, max: 2.0 },
          top_p: { min: 0.01, max: 1.0 },
          max_tokens: { min: 1, max: 8192 },
        },
        responseFixesNeeded: ['tool_calls_format', 'thinking_mode_cleanup'],
      },

      lmstudio: {
        name: 'lmstudio',
        supportsTools: false,
        supportsThinking: false,
        parameterLimits: {
          temperature: { min: 0.01, max: 2.0 },
          top_p: { min: 0.01, max: 1.0 },
          max_tokens: { min: 1, max: 4096 },
        },
        responseFixesNeeded: ['missing_usage', 'missing_id', 'missing_created', 'choices_array_fix'],
      },

      ollama: {
        name: 'ollama',
        supportsTools: false,
        supportsThinking: false,
        parameterLimits: {
          temperature: { min: 0, max: 2.0 },
          top_p: { min: 0, max: 1.0 },
          max_tokens: { min: 1, max: 8192 },
        },
        responseFixesNeeded: ['format_standardization', 'usage_calculation'],
      },
    };

    return (
      capabilities[serverType] || {
        name: 'unknown',
        supportsTools: false,
        supportsThinking: false,
        parameterLimits: {
          temperature: { min: 0, max: 2.0 },
          top_p: { min: 0, max: 1.0 },
          max_tokens: { min: 1, max: 4096 },
        },
        responseFixesNeeded: ['basic_standardization'],
      }
    );
  }

  // 辅助方法

  private analyzeResponse(response: any): ResponseAnalysis {
    return {
      has_id: !!response.id,
      has_object: !!response.object,
      has_created: !!response.created,
      has_choices: Array.isArray(response.choices),
      choices_count: Array.isArray(response.choices) ? response.choices.length : 0,
      has_usage: !!response.usage,
      usage_complete: response.usage && response.usage.total_tokens > 0,
      has_tool_calls: response.choices?.[0]?.message?.tool_calls?.length > 0,
      extra_fields: Object.keys(response).filter(
        key => !['id', 'object', 'created', 'model', 'choices', 'usage', 'system_fingerprint'].includes(key)
      ),
    };
  }

  private analyzeResponseStructure(response: any): any {
    return {
      type: typeof response,
      keys: Object.keys(response || {}),
      has_standard_fields: {
        id: !!response?.id,
        object: !!response?.object,
        choices: Array.isArray(response?.choices),
        usage: !!response?.usage,
      },
    };
  }

  private detectRequestAdaptationNeeds(request: OpenAIStandardRequest, serverType: string): string[] {
    const needs = [];
    const capabilities = this.getCapabilitiesForProvider(serverType);

    if (request.tools && !capabilities.supportsTools) {
      needs.push('remove_tools');
    }

    if (
      request.temperature &&
      (request.temperature < capabilities.parameterLimits.temperature?.min ||
        request.temperature > capabilities.parameterLimits.temperature?.max)
    ) {
      needs.push('adjust_temperature');
    }

    return needs;
  }

  private detectNeededFixes(response: any, serverType: string): string[] {
    const capabilities = this.getCapabilitiesForProvider(serverType);
    return capabilities.responseFixesNeeded;
  }

  private getAppliedAdaptations(original: OpenAIStandardRequest, adapted: OpenAIStandardRequest): string[] {
    const adaptations = [];

    if (original.tools && !adapted.tools) {
      adaptations.push('removed_tools');
    }

    if (original.max_tokens !== adapted.max_tokens) {
      adaptations.push('adjusted_max_tokens');
    }

    if (original.temperature !== adapted.temperature) {
      adaptations.push('adjusted_temperature');
    }

    return adaptations;
  }

  private getAppliedFixes(original: any, fixed: OpenAIStandardResponse): string[] {
    const fixes = [];

    if (!original.id && fixed.id) {
      fixes.push('added_id');
    }

    if (!original.created && fixed.created) {
      fixes.push('added_created');
    }

    if (!original.usage || !original.usage.total_tokens) {
      fixes.push('fixed_usage_statistics');
    }

    return fixes;
  }

  private validateResponse(response: OpenAIStandardResponse): boolean {
    return !!(
      response.id &&
      response.object === 'chat.completion' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  private validateOpenAIFormat(response: any): boolean {
    return this.validateResponse(response);
  }

  private isStandardOpenAIResponse(response: any): boolean {
    return (
      response &&
      response.object === 'chat.completion' &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * REMOVED: createMockDebugRecorder violates Zero Mockup Policy
   */
  private createMockDebugRecorder(): never {
    throw new Error('Zero Mockup Policy: Mock debug recorder is not allowed');
  }

  /**
   * 清理Debug数据，移除敏感信息
   */
  private sanitizeDebugData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // 移除可能的敏感信息
    const sensitiveFields = ['api_key', 'authorization', 'token', 'password', 'secret'];

    const recursiveSanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(recursiveSanitize);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = recursiveSanitize(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return recursiveSanitize(sanitized);
  }

  /**
   * 写入Debug日志到系统
   */
  private writeDebugLogToSystem(eventType: string, data: any): void {
    // 这里可以集成实际的日志系统
    // 例如：写入文件、发送到外部服务、存储到数据库等

    const debugEntry = {
      timestamp: Date.now(),
      eventType,
      module: 'server-compatibility',
      data,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
      },
    };

    // 模拟写入操作 - 在实际实现中可以替换为真实的存储逻辑
    if (process.env.DEBUG_LOG_FILE) {
      // 写入文件的逻辑
      console.log(`📝 [DebugLog] Would write to ${process.env.DEBUG_LOG_FILE}:`, debugEntry);
    }

    if (process.env.DEBUG_WEBHOOK_URL) {
      // 发送到webhook的逻辑
      console.log(`📡 [DebugWebhook] Would send to ${process.env.DEBUG_WEBHOOK_URL}:`, debugEntry);
    }
  }

  /**
   * 确定错误严重程度
   */
  private determineErrorSeverity(data: any): 'low' | 'medium' | 'high' | 'critical' {
    if (data?.error_type === 'ValidationError' || data?.error_message?.includes('parameter')) {
      return 'low';
    }

    if (data?.error_type === 'NetworkError' || data?.error_message?.includes('timeout')) {
      return 'medium';
    }

    if (data?.error_type === 'AuthenticationError' || data?.error_message?.includes('unauthorized')) {
      return 'high';
    }

    if (data?.error_type === 'SystemError' || data?.error_message?.includes('critical')) {
      return 'critical';
    }

    return 'medium'; // 默认中等严重程度
  }

}
