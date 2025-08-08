/**
 * CodeWhisperer Transformer - 统一格式转换
 * 将CodeWhisperer格式与统一格式之间进行转换
 * 项目所有者: Jason Zhang
 */

import { MessageTransformer, UnifiedRequest, UnifiedResponse, UnifiedMessage, UnifiedToolCall } from './types';
import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

export interface CodeWhispererRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: any;
  }>;
  stream?: boolean;
  temperature?: number;
  system?: Array<{ type: string; text: string }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: any;
  }>;
}

export interface CodeWhispererResponse {
  id: string;
  type: string;
  model: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class CodeWhispererTransformer implements MessageTransformer {
  public readonly name = 'codewhisperer';

  /**
   * 🎯 Convert BaseRequest (Anthropic format) to CodeWhisperer format
   * 这是Provider调用的主要入口点
   */
  transformBaseToCodeWhisperer(request: BaseRequest): CodeWhispererRequest {
    if (!request) {
      throw new Error('BaseRequest is null or undefined - violates zero fallback principle');
    }

    const cwRequest: CodeWhispererRequest = {
      model: request.model,
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      messages: this.convertAnthropicMessagesToCodeWhisperer(request.messages || [])
    };

    // 处理系统消息
    if (request.system) {
      cwRequest.system = typeof request.system === 'string' 
        ? [{ type: 'text', text: request.system }]
        : request.system;
    }

    // 处理工具定义
    if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
      cwRequest.tools = this.convertAnthropicToolsToCodeWhisperer(request.tools);
    }

    console.log('🔄 [CODEWHISPERER-TRANSFORMER] BaseRequest -> CodeWhisperer:', {
      hasTools: !!(cwRequest.tools && cwRequest.tools.length > 0),
      toolCount: cwRequest.tools?.length || 0,
      messageCount: cwRequest.messages.length,
      model: cwRequest.model
    });

    return cwRequest;
  }

  /**
   * 🎯 Convert CodeWhisperer response to BaseResponse (Anthropic format)
   * 这是Provider调用的主要出口点
   */
  transformCodeWhispererToBase(response: CodeWhispererResponse, originalRequest: BaseRequest): BaseResponse {
    if (!response) {
      throw new Error('CodeWhisperer response is null or undefined - silent failure detected');
    }

    if (!response.content || response.content.length === 0) {
      throw new Error('CodeWhisperer response missing content - invalid response format');
    }

    // 🎯 修复finish_reason映射
    const finishReason = this.mapCodeWhispererStopReasonToAnthropic(
      response.stop_reason, 
      this.hasToolCallsInContent(response.content)
    );

    const baseResponse: BaseResponse = {
      id: response.id || `msg_${Date.now()}`,
      content: response.content, // CodeWhisperer already uses Anthropic content format
      model: originalRequest.metadata?.originalModel || response.model,
      role: 'assistant',
      stop_reason: finishReason,
      stop_sequence: null,
      usage: {
        input_tokens: response.usage.input_tokens || 0,
        output_tokens: response.usage.output_tokens || 0
      }
    };

    console.log('🔄 [CODEWHISPERER-TRANSFORMER] CodeWhisperer -> BaseResponse:', {
      hasTools: response.content.some((c: any) => c.type === 'tool_use'),
      toolCount: response.content.filter((c: any) => c.type === 'tool_use').length,
      stopReason: finishReason,
      contentBlocks: response.content.length
    });

    return baseResponse;
  }

  /**
   * 转换请求到统一格式
   */
  transformRequestToUnified(request: CodeWhispererRequest): UnifiedRequest {
    const unified: UnifiedRequest = {
      model: request.model,
      messages: this.normalizeMessages(request.messages),
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: request.stream || false
    };

    // 处理system消息
    if (request.system && Array.isArray(request.system)) {
      unified.system = request.system.map(s => s.text).join('\n\n');
    }

    // 处理tools
    if (request.tools && Array.isArray(request.tools)) {
      unified.tools = request.tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));
    }

    logger.debug('CodeWhisperer request transformed to unified', {
      model: unified.model,
      messageCount: unified.messages.length,
      hasSystem: !!unified.system,
      hasTools: !!(unified.tools && unified.tools.length > 0)
    });

    return unified;
  }

  /**
   * 从统一格式转换请求
   */
  transformRequestFromUnified(unified: UnifiedRequest): CodeWhispererRequest {
    const request: CodeWhispererRequest = {
      model: unified.model,
      max_tokens: unified.max_tokens || 131072,
      messages: this.denormalizeMessages(unified.messages),
      stream: unified.stream || false,
      temperature: unified.temperature
    };

    // 处理system消息
    if (unified.system) {
      request.system = [{ type: 'text', text: unified.system }];
    }

    // 处理tools
    if (unified.tools && unified.tools.length > 0) {
      request.tools = unified.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));
    }

    logger.debug('Unified request transformed to CodeWhisperer', {
      model: request.model,
      messageCount: request.messages.length,
      hasSystem: !!(request.system && request.system.length > 0),
      hasTools: !!(request.tools && request.tools.length > 0)
    });

    return request;
  }

  /**
   * 转换响应到统一格式
   */
  transformResponseToUnified(response: CodeWhispererResponse): UnifiedResponse {
    const unified: UnifiedResponse = {
      id: response.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: response.role,
          content: this.extractTextContent(response.content),
          tool_calls: this.extractToolCalls(response.content)
        },
        finish_reason: this.mapStopReason(response.stop_reason)
      }],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };

    logger.debug('CodeWhisperer response transformed to unified', {
      id: unified.id,
      contentBlocks: response.content.length,
      stopReason: unified.choices[0].finish_reason
    });

    return unified;
  }

  /**
   * 从统一格式转换响应
   */
  transformResponseFromUnified(unified: UnifiedResponse): CodeWhispererResponse {
    const choice = unified.choices[0];
    const response: CodeWhispererResponse = {
      id: unified.id,
      type: 'message',
      model: unified.model,
      role: choice.message.role,
      content: this.buildContentFromUnified(choice.message),
      stop_reason: this.mapStopReason(choice.finish_reason),
      stop_sequence: null,
      usage: {
        input_tokens: unified.usage.prompt_tokens,
        output_tokens: unified.usage.completion_tokens
      }
    };

    logger.debug('Unified response transformed to CodeWhisperer', {
      id: response.id,
      contentBlocks: response.content.length,
      stopReason: response.stop_reason
    });

    return response;
  }

  /**
   * 标准化消息格式
   */
  private normalizeMessages(messages: Array<{ role: string; content: any }>): UnifiedMessage[] {
    return messages.map(message => ({
      role: message.role as 'user' | 'assistant' | 'system' | 'tool',
      content: this.normalizeMessageContent(message.content)
    }));
  }

  /**
   * 反标准化消息格式
   */
  private denormalizeMessages(messages: Array<{ role: string; content: any }>): Array<{ role: string; content: any }> {
    return messages.map(message => ({
      role: message.role,
      content: this.denormalizeMessageContent(message.content)
    }));
  }

  /**
   * 标准化消息内容
   */
  private normalizeMessageContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input
          };
        }
        return block;
      });
    }

    return content;
  }

  /**
   * 反标准化消息内容
   */
  private denormalizeMessageContent(content: any): any {
    // CodeWhisperer使用与Anthropic相似的格式，直接返回
    return content;
  }

  /**
   * 标准化内容块
   */
  private normalizeContent(content: Array<any>): Array<any> {
    return content.map(block => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input
        };
      }
      return block;
    });
  }

  /**
   * 反标准化内容块
   */
  private denormalizeContent(content: Array<any>): Array<any> {
    return content.map(block => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input
        };
      }
      return block;
    });
  }

  /**
   * 映射stop reason到统一格式
   */
  private mapStopReason(stopReason: string): string {
    const mapping: Record<string, string> = {
      'end_turn': 'end_turn',
      'max_tokens': 'max_tokens',
      'tool_use': 'tool_use',
      'stop_sequence': 'stop_sequence'
    };

    return mapping[stopReason] || stopReason;
  }

  /**
   * 🔧 Convert Anthropic messages to CodeWhisperer format
   */
  private convertAnthropicMessagesToCodeWhisperer(messages: any[]): any[] {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array - violates zero fallback principle');
    }

    return messages.map(msg => {
      if (!msg || typeof msg !== 'object') {
        throw new Error('Invalid message object - violates zero fallback principle');
      }

      const cwMsg: any = {
        role: msg.role,
        content: msg.content
      };

      return cwMsg;
    });
  }

  /**
   * 🔧 Convert Anthropic tools to CodeWhisperer format
   */
  private convertAnthropicToolsToCodeWhisperer(tools: any[]): any[] {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array - violates zero fallback principle');
    }

    return tools.map(tool => {
      if (!tool || typeof tool !== 'object') {
        throw new Error('Invalid tool object - violates zero fallback principle');
      }

      if (!tool.name) {
        throw new Error('Tool missing name - violates zero fallback principle');
      }

      return {
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.input_schema || {}
      };
    });
  }

  /**
   * 🎯 Map CodeWhisperer stop_reason to Anthropic stop_reason
   */
  private mapCodeWhispererStopReasonToAnthropic(stopReason: string, hasToolCalls: boolean): string {
    // 🔧 Critical Fix: 如果有工具调用，强制返回tool_use
    if (hasToolCalls && (stopReason === 'end_turn' || stopReason === 'stop')) {
      return 'tool_use';
    }
    
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'end_turn': 'end_turn',
      'max_tokens': 'max_tokens',
      'tool_use': 'tool_use',
      'stop_sequence': 'stop_sequence'
    };

    return mapping[stopReason] || 'end_turn';
  }

  /**
   * 🔧 Check if content has tool calls
   */
  private hasToolCallsInContent(content: any[]): boolean {
    return content.some((block: any) => block.type === 'tool_use');
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(content: Array<any>): string | null {
    const textBlocks = content.filter(block => block.type === 'text');
    if (textBlocks.length === 0) return null;
    return textBlocks.map(block => block.text).join('');
  }

  /**
   * 提取工具调用
   */
  private extractToolCalls(content: Array<any>): UnifiedToolCall[] | undefined {
    const toolCalls = content.filter(block => block.type === 'tool_use');
    if (toolCalls.length === 0) return undefined;
    
    return toolCalls.map(tool => ({
      id: tool.id,
      type: 'function' as const,
      function: {
        name: tool.name,
        arguments: JSON.stringify(tool.input)
      }
    }));
  }

  /**
   * 从统一格式构建内容
   */
  private buildContentFromUnified(message: any): Array<any> {
    const content: Array<any> = [];
    
    if (message.content) {
      content.push({
        type: 'text',
        text: message.content
      });
    }
    
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments)
        });
      }
    }
    
    return content;
  }
}

/**
 * 创建CodeWhisperer转换器实例
 */
export function createCodeWhispererTransformer(): CodeWhispererTransformer {
  return new CodeWhispererTransformer();
}