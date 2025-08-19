/**
 * ⚠️ DEPRECATED - SECURITY VULNERABILITIES FOUND ⚠️
 *
 * This transformer implementation has been deprecated due to critical security vulnerabilities
 * identified in the security audit report. DO NOT USE in production.
 *
 * Security Issues:
 * - Hardcoded configuration values
 * - Unsafe JSON parsing (lines 265, 361)
 * - Missing input validation and boundary checks
 * - No timeout protection
 * - Business logic mixed with protocol conversion
 * - Information disclosure in error messages
 *
 * Migration Path:
 * Use SecureAnthropicToOpenAITransformer instead:
 * import { SecureAnthropicToOpenAITransformer } from './secure-anthropic-openai-transformer';
 *
 * @deprecated Use SecureAnthropicToOpenAITransformer instead
 * @security-risk HIGH - Multiple critical vulnerabilities
 * @author Jason Zhang
 */

import {
  IModuleInterface,
  ModuleType,
  IModuleStatus,
  IModuleMetrics,
} from '../../interfaces/core/module-implementation-interface';
import { EventEmitter } from 'events';

/**
 * Anthropic到OpenAI转换器配置
 */
export interface AnthropicToOpenAITransformerConfig {
  model: string;
  preserveToolCalls: boolean;
  mapSystemMessage: boolean;
  defaultMaxTokens: number;
  modelMapping?: { [key: string]: string }; // 模型映射信息
  modelMaxTokens?: { [key: string]: number }; // 各模型的最大token配置
  apiMaxTokens?: number; // API提供商的最大token限制（如ModelScope的8192）
}

/**
 * Anthropic到OpenAI格式转换器
 */
export class AnthropicToOpenAITransformer extends EventEmitter implements IModuleInterface {
  protected readonly id: string = 'anthropic-to-openai-transformer';
  protected readonly name: string = 'Anthropic to OpenAI Transformer';
  protected readonly type: ModuleType = ModuleType.TRANSFORMER;
  protected readonly version: string = '1.0.0';
  protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  protected metrics: IModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  getId(): string {
    return this.id;
  }
  getName(): string {
    return this.name;
  }
  getType(): ModuleType {
    return this.type;
  }
  getVersion(): string {
    return this.version;
  }
  getStatus(): IModuleStatus {
    return { id: this.id, name: this.name, type: this.type, status: this.status, health: 'healthy' };
  }
  getMetrics(): IModuleMetrics {
    return { ...this.metrics };
  }
  async configure(config: any): Promise<void> {}
  async start(): Promise<void> {
    this.status = 'running';
  }
  async stop(): Promise<void> {
    this.status = 'stopped';
  }
  async reset(): Promise<void> {}
  async cleanup(): Promise<void> {}
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
  }
  async process(input: any): Promise<any> {
    return this.onProcess(input);
  }
  private transformerConfig: AnthropicToOpenAITransformerConfig;

  constructor(
    id: string = 'anthropic-to-openai-transformer',
    config: Partial<AnthropicToOpenAITransformerConfig> = {}
  ) {
    super();

    this.transformerConfig = {
      model: 'gpt-3.5-turbo',
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      apiMaxTokens: 8192, // 默认API限制为8192（ModelScope兼容）
      ...config,
    };
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: Partial<AnthropicToOpenAITransformerConfig>): Promise<void> {
    this.transformerConfig = { ...this.transformerConfig, ...config };
  }

  /**
   * 处理格式转换 - 支持请求和响应双向转换
   */
  protected async onProcess(input: any): Promise<any> {
    // 检测输入是请求还是响应
    if (this.isAnthropicRequest(input)) {
      return this.convertRequestToOpenAI(input);
    } else if (this.isOpenAIResponse(input)) {
      return this.convertResponseToAnthropic(input);
    } else {
      throw new Error('不支持的输入格式：既不是Anthropic请求也不是OpenAI响应');
    }
  }

  /**
   * 判断是否为Anthropic请求
   */
  private isAnthropicRequest(input: any): boolean {
    return input && Array.isArray(input.messages) && !input.choices && !input.usage;
  }

  /**
   * 判断是否为OpenAI响应
   */
  private isOpenAIResponse(input: any): boolean {
    return input && input.object === 'chat.completion' && Array.isArray(input.choices) && input.usage;
  }

  /**
   * 转换Anthropic请求为OpenAI格式
   */
  private convertRequestToOpenAI(input: any): any {
    const openaiRequest: any = {};

    // 🔍 Transformer层输入日志
    console.log(`🔄 [Transformer层] 接收Anthropic请求:`);
    console.log(`   输入模型: ${input.model || '(未指定)'}`);
    console.log(`   消息数量: ${input.messages?.length || 0}`);
    console.log(`   系统消息: ${input.system ? '存在' : '无'}`);
    console.log(`   工具定义: ${input.tools?.length || 0} 个`);

    // Transformer层只负责协议转换，不进行模型映射
    // 模型映射应该在路由层或配置层完成
    const inputModel = input.model || 'claude-3-5-sonnet-20241022'; // 默认模型
    console.log(`🔄 [Transformer层] 保持原始模型进行协议转换: ${inputModel}`);

    // 直接传递模型名称，不做映射
    openaiRequest.model = inputModel;

    // 转换消息格式
    openaiRequest.messages = this.convertMessages(input.messages);

    // 转换参数 - 智能max_tokens处理
    if (input.max_tokens) {
      // 用户指定了max_tokens，需要检查是否超出API限制
      openaiRequest.max_tokens = this.clampMaxTokens(input.max_tokens, openaiRequest.model);
    } else {
      // 用户未指定max_tokens，使用智能默认值
      openaiRequest.max_tokens = this.getOptimalMaxTokens(openaiRequest.model);
    }

    if (input.temperature !== undefined) {
      openaiRequest.temperature = input.temperature;
    }

    if (input.top_p !== undefined) {
      openaiRequest.top_p = input.top_p;
    }

    // 转换停止序列
    if (input.stop) {
      openaiRequest.stop = Array.isArray(input.stop) ? input.stop : [input.stop];
    }

    // 转换流式设置
    if (input.stream !== undefined) {
      openaiRequest.stream = input.stream;
    }

    // 转换系统消息（如果需要）
    if (input.system && this.transformerConfig.mapSystemMessage) {
      // 在OpenAI格式中，系统消息是messages数组的第一个元素
      openaiRequest.messages.unshift({
        role: 'system',
        content: input.system,
      });
    }

    // 转换工具定义
    if (input.tools && Array.isArray(input.tools) && this.transformerConfig.preserveToolCalls) {
      openaiRequest.tools = this.convertTools(input.tools);

      if (input.tool_choice) {
        openaiRequest.tool_choice = this.convertToolChoice(input.tool_choice);
      }
    }

    // 🔍 Transformer层输出日志
    console.log(`📤 [Transformer层] OpenAI请求转换完成:`);
    console.log(`   目标模型: ${openaiRequest.model}`);
    console.log(`   消息数量: ${openaiRequest.messages?.length || 0}`);
    console.log(`   max_tokens: ${openaiRequest.max_tokens}`);
    console.log(`   temperature: ${openaiRequest.temperature}`);
    console.log(`   stream: ${openaiRequest.stream}`);
    console.log(`   工具数量: ${openaiRequest.tools?.length || 0}`);

    return openaiRequest;
  }

  /**
   * 转换OpenAI响应为Anthropic格式
   */
  private convertResponseToAnthropic(openaiResponse: any): any {
    // 安全检查：确保OpenAI响应结构完整
    if (
      !openaiResponse ||
      !openaiResponse.choices ||
      !Array.isArray(openaiResponse.choices) ||
      openaiResponse.choices.length === 0
    ) {
      throw new Error('OpenAI响应格式无效：缺少choices数组或choices为空');
    }

    const choice = openaiResponse.choices[0];
    if (!choice || !choice.message) {
      throw new Error('OpenAI响应格式无效：choice或message结构缺失');
    }

    const message = choice.message;

    // Anthropic响应基础结构
    const anthropicResponse: any = {
      id: openaiResponse.id,
      type: 'message',
      role: 'assistant',
      model: openaiResponse.model, // Transformer只负责协议转换，模型名逆映射应在Router层处理
      content: [],
      stop_reason: this.convertStopReason(choice.finish_reason),
      stop_sequence: null,
      usage: {
        input_tokens: openaiResponse.usage.prompt_tokens,
        output_tokens: openaiResponse.usage.completion_tokens,
      },
    };

    // 处理文本内容
    if (message.content) {
      anthropicResponse.content.push({
        type: 'text',
        text: message.content,
      });
    }

    // 处理工具调用
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        anthropicResponse.content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}'),
        });
      }
      anthropicResponse.stop_reason = 'tool_use';
    }

    console.log(`🔄 OpenAI → Anthropic响应转换完成`);
    return anthropicResponse;
  }

  /**
   * 转换停止原因
   */
  private convertStopReason(finishReason: string): string {
    switch (finishReason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      case 'content_filter':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: any[]): any[] {
    const convertedMessages: any[] = [];

    for (const message of messages) {
      const convertedMessage: any = {
        role: message.role,
        content: this.convertMessageContent(message.content),
      };

      // 处理助手消息中的tool_calls
      if (message.role === 'assistant' && message.content) {
        const toolCalls = this.extractToolCallsFromContent(message.content);
        if (toolCalls.length > 0) {
          convertedMessage.tool_calls = toolCalls;
        }
      }

      convertedMessages.push(convertedMessage);
    }

    return convertedMessages;
  }

  /**
   * 转换消息内容
   */
  private convertMessageContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // 对于复杂内容，合并文本部分，单独处理工具调用
      const textParts: string[] = [];

      for (const block of content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        }
        // tool_use 和 tool_result 会在其他地方处理
      }

      return textParts.join('\n').trim() || null;
    }

    return content;
  }

  /**
   * 从Anthropic内容中提取工具调用
   */
  private extractToolCallsFromContent(content: any[]): any[] {
    if (!Array.isArray(content)) {
      return [];
    }

    const toolCalls: any[] = [];

    for (const block of content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {}),
          },
        });
      }
    }

    return toolCalls;
  }

  /**
   * 转换工具定义
   */
  private convertTools(tools: any[]): any[] {
    if (!tools || !Array.isArray(tools)) {
      return [];
    }
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  /**
   * 转换工具选择
   */
  private convertToolChoice(toolChoice: any): any {
    if (typeof toolChoice === 'string') {
      switch (toolChoice) {
        case 'auto':
          return 'auto';
        case 'none':
          return 'none';
        case 'required':
          return 'required';
        default:
          return 'auto';
      }
    }

    if (typeof toolChoice === 'object' && toolChoice.type === 'tool') {
      return {
        type: 'function',
        function: {
          name: toolChoice.name,
        },
      };
    }

    return 'auto';
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
    const defaultLimit = this.transformerConfig.defaultMaxTokens;

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
}
