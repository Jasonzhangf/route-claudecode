/**
 * 智能自适应兼容性模块 - 基于适配标记的智能处理
 *
 * 设计理念：
 * 1. 优先检查适配标记 - 已适配的Provider使用专门策略
 * 2. 通用策略兜底 - 未适配的Provider使用通用OpenAI兼容策略
 * 3. 响应格式检测 - 自动修正非标准响应格式
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';

export interface AdaptiveCompatibilityConfig {
  enableResponseFormatDetection?: boolean;
  enableGenericStrategy?: boolean;
  enableToolCallFormatFix?: boolean;
  enableErrorFormatFix?: boolean;
  [key: string]: any;
}

/**
 * 标准协议请求接口（OpenAI格式）
 */
export interface StandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: any[];
  [key: string]: any;
}

/**
 * Provider配置接口
 */
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  compatibilityAdapter?: string; // 适配标记
  models?: string[];
  authentication?: any;
  [key: string]: any;
}

export class AdaptiveCompatibilityModule extends EventEmitter implements ModuleInterface {
  private config: AdaptiveCompatibilityConfig;
  private currentStatus: ModuleStatus;
  private providerConfig?: ProviderConfig;

  constructor(config: AdaptiveCompatibilityConfig = {}) {
    super();
    this.config = {
      enableResponseFormatDetection: true,
      enableGenericStrategy: true,
      enableToolCallFormatFix: true,
      enableErrorFormatFix: true,
      ...config,
    };
    this.currentStatus = {
      id: 'adaptive-compatibility',
      name: 'Adaptive Compatibility Module',
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'stopped',
      health: 'healthy',
    };
  }

  getId(): string {
    return this.currentStatus.id;
  }

  getName(): string {
    return this.currentStatus.name;
  }

  getType(): ModuleType {
    return this.currentStatus.type;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getStatus(): ModuleStatus {
    return { ...this.currentStatus };
  }

  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
    // 从配置中提取Provider信息
    if (config.providerConfig) {
      this.providerConfig = config.providerConfig;
    }
  }

  async start(): Promise<void> {
    this.currentStatus.status = 'starting';
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
  }

  async stop(): Promise<void> {
    this.currentStatus.status = 'stopping';
    this.currentStatus.status = 'stopped';
  }

  async reset(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.currentStatus.health = 'healthy';
    this.currentStatus.error = undefined;
  }

  async cleanup(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.removeAllListeners();
  }

  async process(input: StandardRequest | any): Promise<StandardRequest | any> {
    this.currentStatus.lastActivity = new Date();

    // 检查输入类型：请求 vs 响应
    if (this.isRequest(input)) {
      console.log('🔄 [AdaptiveCompatibility] 处理请求阶段');
      // 优先检查适配标记
      if (this.providerConfig?.compatibilityAdapter) {
        return this.useAdaptedStrategy(input as StandardRequest, this.providerConfig.compatibilityAdapter);
      }
      // 使用通用策略
      return this.useGenericStrategy(input as StandardRequest);
    } else {
      console.log('🔄 [AdaptiveCompatibility] 处理响应阶段');
      // 响应阶段：转换为标准OpenAI格式
      return this.handleResponse(input);
    }
  }

  /**
   * 使用已适配的策略
   */
  private async useAdaptedStrategy(request: StandardRequest, adapter: string): Promise<StandardRequest> {
    switch (adapter.toLowerCase()) {
      case 'lmstudio':
        return this.handleLMStudioAdapter(request);
      case 'modelscope':
        return this.handleModelScopeAdapter(request);
      // 未来可扩展其他适配器
      default:
        return this.useGenericStrategy(request);
    }
  }

  /**
   * LM Studio适配策略
   */
  private handleLMStudioAdapter(request: StandardRequest): StandardRequest {
    // LM Studio模型映射
    const originalModel = request.model;
    const mappedModel = this.mapLMStudioModel(originalModel);

    // 验证LM Studio支持的模型
    this.validateLMStudioModel(mappedModel);

    return {
      ...request,
      model: mappedModel,
    };
  }

  /**
   * ModelScope适配策略
   */
  private handleModelScopeAdapter(request: StandardRequest): StandardRequest {
    // ModelScope特殊处理逻辑
    // 注意：实际的多Key轮询在Server层处理，这里主要做请求预处理
    return request; // ModelScope使用标准OpenAI格式，直接透传
  }

  /**
   * 通用策略
   */
  private useGenericStrategy(request: StandardRequest): StandardRequest {
    // 通用策略直接透传，在响应阶段进行格式检测
    return request;
  }

  /**
   * 检查输入是否为请求格式
   */
  private isRequest(input: any): boolean {
    // 如果输入为空或不是对象，不是请求
    if (!input || typeof input !== 'object') {
      return false;
    }

    // 明确的响应格式标识
    if (
      input.object === 'chat.completion' ||
      input.object === 'chat.completion.chunk' ||
      input.id || // 响应通常有唯一ID
      input.choices || // 响应包含choices
      input.usage || // 响应包含usage
      input.created || // 响应包含created时间戳
      input.system_fingerprint !== undefined // ModelScope特有字段
    ) {
      return false;
    }

    // 检查是否为ModelScope流式响应的特殊结构
    if (input.choices && Array.isArray(input.choices)) {
      const choice = input.choices[0];
      if (choice && (choice.delta || choice.message || choice.finish_reason)) {
        // 这是ModelScope的流式响应格式
        return false;
      }
    }

    // 标准请求格式检查：包含model和messages字段
    return typeof input.model === 'string' && Array.isArray(input.messages) && input.messages.length > 0;
  }

  /**
   * 检查输入是否为响应格式
   */
  private isResponse(input: any): boolean {
    // 检查是否为标准OpenAI响应格式
    return (
      input &&
      typeof input === 'object' &&
      (input.object === 'chat.completion' || input.id || input.choices || input.usage)
    );
  }

  /**
   * 处理响应阶段的格式转换
   */
  private async handleResponse(response: any): Promise<any> {
    // 如果已经是标准OpenAI格式，直接返回
    if (this.isStandardOpenAIResponse(response)) {
      console.log('✅ [AdaptiveCompatibility] 响应已是标准OpenAI格式，直接透传');
      return response;
    }

    // 根据适配标记选择转换策略
    if (this.providerConfig?.compatibilityAdapter) {
      const adapter = this.providerConfig.compatibilityAdapter;
      console.log(`🧠 [AdaptiveCompatibility] 使用${adapter}适配器处理响应`);

      switch (adapter) {
        case 'modelscope':
          return this.convertModelScopeResponseToOpenAI(response);
        case 'lmstudio':
          return this.convertLMStudioResponseToOpenAI(response);
        default:
          console.warn(`⚠️  未知的适配器类型: ${adapter}，使用通用策略`);
          return this.convertGenericResponseToOpenAI(response);
      }
    }

    // 使用通用响应处理策略
    return this.convertGenericResponseToOpenAI(response);
  }

  /**
   * 检查是否为标准OpenAI响应格式
   */
  private isStandardOpenAIResponse(response: any): boolean {
    return (
      response &&
      response.object === 'chat.completion' &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  /**
   * LM Studio模型映射
   */
  private mapLMStudioModel(model: string): string {
    // LM Studio常见模型映射规则
    const modelMappings: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'gpt-oss-20b-mlx',
      'claude-3-haiku-20240307': 'qwen3-4b-thinking-2507-mlx',
      'claude-sonnet-4-20250514': 'qwen3-30b-a3b-instruct-2507-mlx',
      'gpt-4o-mini': 'gpt-oss-20b-mlx',
      'gpt-4': 'qwen3-30b-a3b-instruct-2507-mlx',
    };

    return modelMappings[model] || model;
  }

  /**
   * 验证LM Studio模型支持
   */
  private validateLMStudioModel(model: string): void {
    const supportedModels = ['gpt-oss-20b-mlx', 'qwen3-30b-a3b-instruct-2507-mlx', 'qwen3-4b-thinking-2507-mlx'];

    if (!supportedModels.includes(model)) {
      // 模型不在支持列表中，但继续执行（由后续层处理错误）
    }
  }

  /**
   * ModelScope响应转换为标准OpenAI格式
   * 处理ModelScope的流式响应结构
   */
  private convertModelScopeResponseToOpenAI(response: any): any {
    console.log('🔄 [AdaptiveCompatibility] ModelScope响应 → 标准OpenAI格式');
    console.log('🔍 ModelScope原始响应结构:', {
      hasId: !!response.id,
      hasObject: !!response.object,
      hasChoices: !!response.choices,
      hasUsage: !!response.usage,
      hasCreated: !!response.created,
      hasModel: !!response.model,
    });

    // ModelScope已经返回OpenAI兼容格式，只需要小调整
    if (this.isStandardOpenAIResponse(response)) {
      console.log('✅ [AdaptiveCompatibility] ModelScope响应已是标准格式，直接返回');
      return response;
    }

    // ModelScope的响应通常已经很接近OpenAI格式，主要是处理特殊字段
    let processedResponse = { ...response };

    // 确保有正确的object字段
    if (!processedResponse.object) {
      processedResponse.object = 'chat.completion';
    }

    // 处理choices中的消息结构
    if (processedResponse.choices && Array.isArray(processedResponse.choices)) {
      processedResponse.choices = processedResponse.choices.map((choice: any, index: number) => {
        let processedChoice = { ...choice, index: index };

        // 处理ModelScope的特殊流式响应结构
        if (choice.message && choice.message.content) {
          // 标准消息格式，保持不变
          processedChoice.message = {
            role: choice.message.role || 'assistant',
            content: choice.message.content,
            ...(choice.message.tool_calls && { tool_calls: choice.message.tool_calls }),
          };
        } else if (choice.delta && choice.delta.content) {
          // 从delta中提取完整消息
          processedChoice.message = {
            role: choice.delta.role || 'assistant',
            content: choice.delta.content,
            ...(choice.delta.tool_calls && { tool_calls: choice.delta.tool_calls }),
          };
          // 移除delta字段，因为这不是流式响应
          delete processedChoice.delta;
        }

        // 确保有finish_reason
        if (!processedChoice.finish_reason) {
          processedChoice.finish_reason = 'stop';
        }

        return processedChoice;
      });
    }

    // 如果没有ID，生成一个
    if (!processedResponse.id) {
      processedResponse.id = `chatcmpl-${this.generateUUID()}`;
    }

    // 如果没有created时间戳，生成一个
    if (!processedResponse.created) {
      processedResponse.created = Math.floor(Date.now() / 1000);
    }

    // 确保usage字段格式正确
    if (!processedResponse.usage) {
      processedResponse.usage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };
    }

    // 移除ModelScope特有的字段
    if (processedResponse.system_fingerprint === '') {
      delete processedResponse.system_fingerprint;
    }

    console.log('✅ [AdaptiveCompatibility] ModelScope转换完成');
    return processedResponse;
  }

  /**
   * LM Studio响应转换为标准OpenAI格式
   */
  private convertLMStudioResponseToOpenAI(response: any): any {
    console.log('🔄 [AdaptiveCompatibility] LM Studio响应 → 标准OpenAI格式');

    // LM Studio通常已经返回OpenAI兼容格式，但可能需要小调整
    if (this.isStandardOpenAIResponse(response)) {
      return response;
    }

    // 处理LM Studio特有的响应格式
    return this.convertGenericResponseToOpenAI(response);
  }

  /**
   * 通用响应格式转换
   */
  private convertGenericResponseToOpenAI(response: any): any {
    console.log('🔄 [AdaptiveCompatibility] 通用响应 → 标准OpenAI格式');
    console.log('🔍 通用原始响应:', JSON.stringify(response, null, 2));

    // 如果已经是标准格式，直接返回
    if (this.isStandardOpenAIResponse(response)) {
      return response;
    }

    // 通用转换逻辑
    const chatId = `chatcmpl-${this.generateUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    let content = '';
    if (typeof response === 'string') {
      content = response;
    } else if (response.content) {
      content = this.extractContentFromResponse(response.content);
    } else if (response.message) {
      content = typeof response.message === 'string' ? response.message : JSON.stringify(response.message);
    } else {
      // 尝试从其他字段提取内容
      content = response.text || response.output || JSON.stringify(response);
    }

    const openaiResponse = {
      id: chatId,
      object: 'chat.completion' as const,
      created: timestamp,
      model: response.model || 'generic-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: content,
          },
          finish_reason: 'stop' as const,
        },
      ],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };

    console.log('✅ [AdaptiveCompatibility] 通用转换完成:', JSON.stringify(openaiResponse, null, 2));
    return openaiResponse;
  }

  /**
   * 从响应内容中提取文本
   */
  private extractContentFromResponse(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') {
            return item;
          }
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          return JSON.stringify(item);
        })
        .join('\n');
    }

    if (content.text) {
      return content.text;
    }

    return JSON.stringify(content);
  }

  /**
   * 提取工具调用信息（如果存在）
   */
  private extractToolCalls(response: any): any[] | null {
    // 检查不同的工具调用格式
    if (response.tool_calls && Array.isArray(response.tool_calls)) {
      return response.tool_calls;
    }

    if (response.choices?.[0]?.message?.tool_calls) {
      return response.choices[0].message.tool_calls;
    }

    // 检查其他可能的工具调用格式
    if (response.function_call) {
      return [
        {
          id: `call_${this.generateUUID()}`,
          type: 'function',
          function: response.function_call,
        },
      ];
    }

    return null;
  }

  /**
   * 生成UUID (简化版)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * 响应格式检测和修正（在响应阶段调用）
   */
  async processResponse(response: any): Promise<any> {
    // 检测是否为标准OpenAI响应格式
    if (this.isStandardOpenAIResponse(response)) {
      return response;
    }

    // 工具调用格式修正
    if (this.config.enableErrorFormatFix && this.needsErrorFormatFix(response)) {
      return this.fixErrorFormat(response);
    }

    return response;
  }

  /**
   * 检测是否需要工具调用格式修正
   */
  private needsToolCallFormatFix(response: any): boolean {
    // 检测非标准的工具调用响应格式
    return (
      response &&
      response.choices &&
      response.choices.some(
        (choice: any) => choice.message?.tool_calls && !this.isStandardToolCallFormat(choice.message.tool_calls)
      )
    );
  }

  /**
   * 检测是否需要错误格式修正
   */
  private needsErrorFormatFix(response: any): boolean {
    // 检测非标准的错误响应格式
    return response && response.error && typeof response.error !== 'object';
  }

  /**
   * 修正工具调用格式
   */
  private fixToolCallFormat(response: any): any {
    // 实现工具调用格式标准化逻辑
    return response; // 简化实现，实际需要根据具体格式差异调整
  }

  /**
   * 修正错误格式
   */
  private fixErrorFormat(response: any): any {
    // 实现错误格式标准化逻辑
    return response; // 简化实现，实际需要根据具体格式差异调整
  }

  /**
   * 检测是否为标准工具调用格式
   */
  private isStandardToolCallFormat(toolCalls: any[]): boolean {
    return toolCalls.every(call => call.id && call.type === 'function' && call.function && call.function.name);
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const healthy = this.currentStatus.status === 'running';
    return {
      healthy,
      details: {
        status: this.currentStatus.status,
        providerAdapter: this.providerConfig?.compatibilityAdapter || 'generic',
        featuresEnabled: {
          responseFormatDetection: this.config.enableResponseFormatDetection,
          genericStrategy: this.config.enableGenericStrategy,
          toolCallFormatFix: this.config.enableToolCallFormatFix,
          errorFormatFix: this.config.enableErrorFormatFix,
        },
        lastActivity: this.currentStatus.lastActivity,
      },
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastProcessedAt: this.currentStatus.lastActivity,
    };
  }
}
