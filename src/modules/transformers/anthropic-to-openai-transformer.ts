/**
 * Anthropic到OpenAI格式转换器
 * 
 * 将Anthropic格式的请求转换为OpenAI兼容格式
 * 
 * @author Jason Zhang
 */

import { BaseModule } from '../base-module-impl';
import { StandardRequest } from '../../interfaces/standard/request';

/**
 * Anthropic到OpenAI转换器配置
 */
export interface AnthropicToOpenAITransformerConfig {
  model: string;
  preserveToolCalls: boolean;
  mapSystemMessage: boolean;
  defaultMaxTokens: number;
}

/**
 * Anthropic到OpenAI格式转换器
 */
export class AnthropicToOpenAITransformer extends BaseModule {
  private transformerConfig: AnthropicToOpenAITransformerConfig;
  
  constructor(id: string, config: Partial<AnthropicToOpenAITransformerConfig> = {}) {
    super(id, 'Anthropic to OpenAI Transformer', 'transformer', '1.0.0');
    
    this.transformerConfig = {
      model: 'gpt-3.5-turbo',
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      ...config
    };
  }
  
  /**
   * 配置处理
   */
  protected async onConfigure(config: Partial<AnthropicToOpenAITransformerConfig>): Promise<void> {
    this.transformerConfig = { ...this.transformerConfig, ...config };
  }
  
  /**
   * 处理格式转换
   */
  protected async onProcess(input: StandardRequest): Promise<any> {
    const openaiRequest: any = {};
    
    // 转换模型名称
    openaiRequest.model = this.transformerConfig.model;
    
    // 转换消息格式
    openaiRequest.messages = this.convertMessages(input.messages);
    
    // 转换参数
    if (input.max_tokens) {
      openaiRequest.max_tokens = input.max_tokens;
    } else {
      openaiRequest.max_tokens = this.transformerConfig.defaultMaxTokens;
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
        content: input.system
      });
    }
    
    // 转换工具定义
    if (input.tools && this.transformerConfig.preserveToolCalls) {
      openaiRequest.tools = this.convertTools(input.tools);
      
      if (input.tool_choice) {
        openaiRequest.tool_choice = this.convertToolChoice(input.tool_choice);
      }
    }
    
    return openaiRequest;
  }
  
  /**
   * 转换消息格式
   */
  private convertMessages(messages: any[]): any[] {
    const convertedMessages: any[] = [];
    
    for (const message of messages) {
      const convertedMessage: any = {
        role: message.role,
        content: this.convertMessageContent(message.content)
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
            arguments: JSON.stringify(block.input || {})
          }
        });
      }
    }
    
    return toolCalls;
  }
  
  /**
   * 转换工具定义
   */
  private convertTools(tools: any[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
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
          name: toolChoice.name
        }
      };
    }
    
    return 'auto';
  }
}