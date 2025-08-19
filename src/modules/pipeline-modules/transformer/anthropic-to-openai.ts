/**
 * ⚠️ DEPRECATED - SECURITY VULNERABILITIES FOUND ⚠️
 *
 * This transformer implementation has been deprecated due to critical security vulnerabilities
 * identified in the security audit report. DO NOT USE in production.
 *
 * Security Issues:
 * - Unsafe JSON parsing without try-catch (line 375)
 * - No input validation or boundary checks
 * - Resource consumption without limits
 * - Duplicate implementation causing inconsistencies
 * - Architecture layer violations (business logic in transformer)
 * - Missing authentication and authorization
 *
 * Migration Path:
 * Use SecureAnthropicToOpenAITransformer instead:
 * import { SecureAnthropicToOpenAITransformer } from '../../transformers/secure-anthropic-openai-transformer';
 *
 * @deprecated Use SecureAnthropicToOpenAITransformer instead
 * @security-risk HIGH - Multiple critical vulnerabilities
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';

/**
 * Transformer配置接口
 */
export interface TransformerConfig {
  targetModel?: string; // 目标模型名，由Router层确定
  model?: string;
  preserveToolCalls?: boolean;
  mapSystemMessage?: boolean;
  defaultMaxTokens?: number;
  apiMaxTokens?: number; // API提供商的最大token限制（如ModelScope的8192）
  modelMaxTokens?: { [key: string]: number }; // 各模型的最大token配置
  modelMapping?: { [key: string]: string }; // 模型映射信息
}

/**
 * Anthropic请求格式
 */
export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content:
      | string
      | Array<{
          type: 'text' | 'image';
          text?: string;
          source?: {
            type: 'base64';
            media_type: string;
            data: string;
          };
        }>;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: any;
  }>;
}

/**
 * OpenAI协议请求格式
 */
export interface OpenAIRequest {
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
 * Anthropic响应格式
 */
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * OpenAI协议响应格式
 */
export interface OpenAIResponse {
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
}

/**
 * Anthropic到OpenAI转换器模块
 */
export class AnthropicToOpenAITransformer extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'anthropic-to-openai-transformer';
  private readonly name: string = 'Anthropic to OpenAI Transformer';
  private readonly type: any = 'transformer';
  private readonly version: string = '1.0.0';
  private status: ModuleStatus['health'] = 'healthy';
  private targetModel: string = ''; // 目标模型名
  private transformerConfig: TransformerConfig;

  constructor(config?: TransformerConfig) {
    super();

    // 设置默认配置
    this.transformerConfig = {
      model: 'gpt-3.5-turbo',
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      apiMaxTokens: 8192,
      modelMaxTokens: {},
      modelMapping: {},
      ...config, // 覆盖传入的配置
    };

    if (this.transformerConfig.targetModel) {
      this.targetModel = this.transformerConfig.targetModel;
    }

    console.log(`🔄 初始化Anthropic→OpenAI转换器模块`);
    console.log(`   目标模型: ${this.targetModel || '未指定'}`);
    console.log(`   API最大tokens: ${this.transformerConfig.apiMaxTokens}`);
    console.log(`   默认tokens: ${this.transformerConfig.defaultMaxTokens}`);
    console.log(`   模型限制配置: ${Object.keys(this.transformerConfig.modelMaxTokens || {}).length} 个模型`);
  }

  // 移除重复的ModuleInterface实现

  // 移除重复的方法实现，使用下面的完整实现

  /**
   * 处理请求转换
   * 支持双向转换：Anthropic → OpenAI 和 OpenAI → Anthropic
   *
   * 注意：本模块只负责协议格式转换，模型映射由Router层完成
   * 目标模型名通过配置传入，确保职责分离
   */
  async process(input: AnthropicRequest | OpenAIResponse): Promise<OpenAIRequest | AnthropicResponse> {
    const startTime = Date.now();

    try {
      // 判断输入类型并执行相应转换
      if (this.isAnthropicRequest(input)) {
        console.log(`🔄 转换Anthropic请求 → OpenAI格式`);
        const result = this.transformAnthropicToOpenAI(input as AnthropicRequest);
        const processingTime = Date.now() - startTime;
        console.log(`✅ 请求转换完成 (${processingTime}ms)`);
        return result;
      } else if (this.isOpenAIResponse(input)) {
        console.log(`🔄 转换OpenAI响应 → Anthropic格式`);
        const result = this.transformOpenAIToAnthropic(input as OpenAIResponse);
        const processingTime = Date.now() - startTime;
        console.log(`✅ 响应转换完成 (${processingTime}ms)`);
        return result;
      } else {
        throw new Error('不支持的输入格式');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 转换失败 (${processingTime}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 判断是否为Anthropic请求格式
   */
  private isAnthropicRequest(input: any): boolean {
    return (
      input &&
      typeof input.model === 'string' &&
      typeof input.max_tokens === 'number' &&
      Array.isArray(input.messages) &&
      input.messages.every((msg: any) => msg.role === 'user' || msg.role === 'assistant')
    );
  }

  /**
   * 判断是否为OpenAI响应格式
   */
  private isOpenAIResponse(input: any): boolean {
    return (
      input &&
      input.object === 'chat.completion' &&
      Array.isArray(input.choices) &&
      input.usage &&
      typeof input.usage.total_tokens === 'number'
    );
  }

  /**
   * Anthropic请求 → OpenAI请求转换
   *
   * Transformer模块只负责协议格式转换，模型映射由Router层完成
   * 本模块使用Router层确定的目标模型名进行转换
   */
  private transformAnthropicToOpenAI(anthropicRequest: AnthropicRequest): OpenAIRequest {
    // 使用由Router层确定的目标模型名，确保模型映射在Router层完成
    const targetModel = this.targetModel || anthropicRequest.model;

    const openaiRequest: OpenAIRequest = {
      model: targetModel, // 优先使用配置的目标模型，如果没有则使用源模型（用于向后兼容）
      messages: [],
      temperature: anthropicRequest.temperature,
      top_p: anthropicRequest.top_p,
      stream: anthropicRequest.stream || false,
    };

    // 智能max_tokens处理
    if (anthropicRequest.max_tokens) {
      // 用户指定了max_tokens，需要检查是否超出API限制
      openaiRequest.max_tokens = this.clampMaxTokens(anthropicRequest.max_tokens, targetModel);
    } else {
      // 用户未指定max_tokens，使用智能默认值
      openaiRequest.max_tokens = this.getOptimalMaxTokens(targetModel);
    }

    // 添加系统消息（如果有且不为空）
    if (anthropicRequest.system && typeof anthropicRequest.system === 'string' && anthropicRequest.system.trim()) {
      openaiRequest.messages.push({
        role: 'system',
        content: anthropicRequest.system,
      });
    }

    // 转换消息
    for (const message of anthropicRequest.messages) {
      if (typeof message.content === 'string') {
        // 简单文本消息 - 确保内容不为空
        if (message.content && message.content.trim()) {
          openaiRequest.messages.push({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: message.content,
          });
        }
      } else if (Array.isArray(message.content)) {
        // 多模态消息 - 提取文本内容
        const textContent = message.content
          .filter(item => item && typeof item === 'object' && item.type === 'text' && item.text && item.text.trim())
          .map(item => item.text)
          .join('\n');

        // 只有在有有效文本内容时才添加消息
        if (textContent.trim()) {
          openaiRequest.messages.push({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: textContent,
          });
        }
      }
    }

    // 确保至少有一条消息（除了可能的系统消息）
    const nonSystemMessages = openaiRequest.messages.filter(
      msg => msg && typeof msg === 'object' && msg.role !== 'system'
    );
    if (nonSystemMessages.length === 0) {
      // 如果没有有效的用户消息，创建一个默认消息
      openaiRequest.messages.push({
        role: 'user',
        content: 'Hello', // 简单的默认消息
      });
    }

    // 转换停止序列
    if (anthropicRequest.stop_sequences) {
      openaiRequest.stop = anthropicRequest.stop_sequences;
    }

    // 转换工具定义
    if (anthropicRequest.tools) {
      openaiRequest.tools = anthropicRequest.tools
        .filter(tool => tool && typeof tool === 'object' && tool.name) // 过滤有效的tools
        .map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
          },
        }));
    }

    return openaiRequest;
  }

  /**
   * OpenAI响应 → Anthropic响应转换
   */
  private transformOpenAIToAnthropic(openaiResponse: OpenAIResponse): AnthropicResponse {
    const choice = openaiResponse.choices[0]; // 取第一个选择

    const anthropicResponse: AnthropicResponse = {
      id: openaiResponse.id,
      type: 'message',
      role: 'assistant',
      content: [],
      model: openaiResponse.model, // 直接使用模型名，不进行反向映射
      stop_reason: this.mapFinishReason(choice.finish_reason),
      usage: {
        input_tokens: openaiResponse.usage.prompt_tokens,
        output_tokens: openaiResponse.usage.completion_tokens,
      },
    };

    // 转换消息内容
    if (choice.message.content) {
      anthropicResponse.content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    // 转换工具调用
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        anthropicResponse.content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    return anthropicResponse;
  }

  /**
   * 映射完成原因
   */
  private mapFinishReason(finishReason: string): AnthropicResponse['stop_reason'] {
    const reasonMapping: Record<string, AnthropicResponse['stop_reason']> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'end_turn',
    };

    return reasonMapping[finishReason] || 'end_turn';
  }

  /**
   * 限制max_tokens在API允许范围内
   */
  private clampMaxTokens(requestedTokens: number, targetModel: string): number {
    const apiLimit = this.transformerConfig.apiMaxTokens || 8192;
    const modelConfigLimit = this.getModelMaxTokensFromConfig(targetModel);

    // 使用较小的限制值
    const effectiveLimit = Math.min(apiLimit, modelConfigLimit);
    const clampedTokens = Math.min(requestedTokens, effectiveLimit);

    if (clampedTokens !== requestedTokens) {
      console.log(
        `🔧 [Transformer] max_tokens从${requestedTokens}调整到${clampedTokens} (API限制: ${apiLimit}, 模型限制: ${modelConfigLimit})`
      );
    }

    return clampedTokens;
  }

  /**
   * 获取最优的max_tokens默认值
   */
  private getOptimalMaxTokens(targetModel: string): number {
    const apiLimit = this.transformerConfig.apiMaxTokens || 8192;
    const modelConfigLimit = this.getModelMaxTokensFromConfig(targetModel);
    const defaultLimit = this.transformerConfig.defaultMaxTokens || 4096;

    // 选择一个安全的默认值：API限制的一半，但不超过配置的默认值
    const safeDefault = Math.min(
      Math.floor(apiLimit / 2), // API限制的一半
      modelConfigLimit, // 模型配置限制
      defaultLimit // 配置的默认值
    );

    console.log(
      `🎯 [Transformer] 为模型${targetModel}选择最优max_tokens: ${safeDefault} (API: ${apiLimit}, 模型: ${modelConfigLimit}, 默认: ${defaultLimit})`
    );

    return safeDefault;
  }

  /**
   * 从配置中获取模型的最大token限制
   */
  private getModelMaxTokensFromConfig(targetModel: string): number {
    if (this.transformerConfig.modelMaxTokens && this.transformerConfig.modelMaxTokens[targetModel]) {
      return this.transformerConfig.modelMaxTokens[targetModel];
    }

    // 如果配置中没有找到，返回一个保守的默认值
    return this.transformerConfig.apiMaxTokens || 8192;
  }

  /**
   * 验证Anthropic请求格式
   */
  validateAnthropicRequest(request: AnthropicRequest): boolean {
    if (!request.model || typeof request.model !== 'string') {
      return false;
    }

    if (!request.max_tokens || typeof request.max_tokens !== 'number') {
      return false;
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 验证OpenAI响应格式
   */
  validateOpenAIResponse(response: OpenAIResponse): boolean {
    if (!response.id || typeof response.id !== 'string') {
      return false;
    }

    if (!Array.isArray(response.choices) || response.choices.length === 0) {
      return false;
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      return false;
    }

    return true;
  }

  // ModuleInterface 实现
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return ModuleType.TRANSFORMER;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.TRANSFORMER,
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

  async configure(config: TransformerConfig): Promise<void> {
    if (config && config.targetModel) {
      this.targetModel = config.targetModel;
      console.log(`🔧 Transformer配置更新: 目标模型设置为 ${this.targetModel}`);
    }
  }

  async start(): Promise<void> {
    // Start logic
  }

  async stop(): Promise<void> {
    // Stop logic
  }

  async reset(): Promise<void> {
    // Reset logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
  }

  // 移除重复的process方法
}
