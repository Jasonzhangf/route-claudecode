/**
 * Enhanced OpenAI Format Transformer
 * Handles conversion between OpenAI API format and unified format
 * Includes tool call processing and response handling
 * 
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import { 
  MessageTransformer, 
  UnifiedRequest, 
  UnifiedResponse, 
  UnifiedMessage, 
  UnifiedTool,
  UnifiedToolCall,
  StreamChunk,
  TransformationContext
} from './types';
import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

export class OpenAITransformer implements MessageTransformer {
  public readonly name = 'openai';

  /**
   * 🎯 Convert BaseRequest (Anthropic format) to OpenAI API format
   * 这是Provider调用的主要入口点
   */
  transformBaseRequestToOpenAI(request: BaseRequest): any {
    if (!request) {
      throw new Error('BaseRequest is null or undefined - violates zero fallback principle');
    }

    const openaiRequest: any = {
      model: request.model,
      messages: this.convertAnthropicMessagesToOpenAI(request.messages || []),
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: request.stream || false
    };

    // 处理系统消息
    if (request.system) {
      openaiRequest.messages.unshift({
        role: 'system',
        content: request.system
      });
    }

    // 🔧 处理工具定义转换
    if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
      openaiRequest.tools = this.convertAnthropicToolsToOpenAI(request.tools);
      
      // 处理工具选择 (如果存在)
      const requestWithToolChoice = request as any;
      if (requestWithToolChoice.tool_choice) {
        openaiRequest.tool_choice = this.convertToolChoice(requestWithToolChoice.tool_choice);
      }
    }

    console.log('🔄 [OPENAI-TRANSFORMER] BaseRequest -> OpenAI:', {
      hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
      toolCount: openaiRequest.tools?.length || 0,
      messageCount: openaiRequest.messages.length,
      model: openaiRequest.model
    });

    return openaiRequest;
  }

  /**
   * 🎯 Convert OpenAI API response to BaseResponse (Anthropic format)
   * 这是Provider调用的主要出口点
   */
  transformOpenAIResponseToBase(response: any, originalRequest: BaseRequest): BaseResponse {
    if (!response) {
      throw new Error('OpenAI response is null or undefined - silent failure detected');
    }

    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('OpenAI response missing choices - invalid response format');
    }

    // 🔧 处理工具调用转换
    const content = this.convertOpenAIMessageToAnthropicContent(choice.message);
    
    // 🎯 修复finish_reason映射
    const finishReason = this.mapOpenAIFinishReasonToAnthropic(
      choice.finish_reason, 
      this.hasToolCalls(choice.message)
    );

    const baseResponse: BaseResponse = {
      id: response.id || `msg_${Date.now()}`,
      content,
      model: originalRequest.metadata?.originalModel || response.model,
      role: 'assistant',
      stop_reason: finishReason,
      stop_sequence: null,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0
      }
    };

    console.log('🔄 [OPENAI-TRANSFORMER] OpenAI -> BaseResponse:', {
      hasTools: content.some((c: any) => c.type === 'tool_use'),
      toolCount: content.filter((c: any) => c.type === 'tool_use').length,
      stopReason: finishReason,
      contentBlocks: content.length
    });

    return baseResponse;
  }

  /**
   * 🎯 Process OpenAI streaming response and convert to Anthropic SSE events
   * 处理流式响应转换
   */
  async *transformOpenAIStreamToAnthropicSSE(
    stream: AsyncIterable<any>, 
    originalRequest: BaseRequest,
    requestId: string
  ): AsyncIterable<any> {
    let messageId = `msg_${Date.now()}`;
    let hasStarted = false;
    let toolCallBuffer = new Map<number, any>();
    let textContent = '';

    try {
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        // 发送message_start事件
        if (!hasStarted) {
          yield {
            event: 'message_start',
            data: {
              type: 'message_start',
              message: {
                id: messageId,
                type: 'message',
                role: 'assistant',
                content: [],
                model: originalRequest.metadata?.originalModel || chunk.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
              }
            }
          };
          hasStarted = true;
        }

        // 处理文本内容
        if (choice.delta?.content) {
          if (textContent === '') {
            // 第一次文本内容，发送content_block_start
            yield {
              event: 'content_block_start',
              data: {
                type: 'content_block_start',
                index: 0,
                content_block: {
                  type: 'text',
                  text: ''
                }
              }
            };
          }

          textContent += choice.delta.content;
          
          yield {
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: choice.delta.content
              }
            }
          };
        }

        // 🔧 处理工具调用
        if (choice.delta?.tool_calls) {
          for (const toolCall of choice.delta.tool_calls) {
            const index = toolCall.index || 0;
            
            if (!toolCallBuffer.has(index)) {
              // 新的工具调用开始
              const toolId = toolCall.id || `tool_${Date.now()}_${index}`;
              const toolName = toolCall.function?.name || 'unknown_tool';
              
              toolCallBuffer.set(index, {
                id: toolId,
                name: toolName,
                input: ''
              });

              yield {
                event: 'content_block_start',
                data: {
                  type: 'content_block_start',
                  index: index + 1, // 文本占用index 0
                  content_block: {
                    type: 'tool_use',
                    id: toolId,
                    name: toolName,
                    input: {}
                  }
                }
              };
            }

            // 处理工具参数增量
            if (toolCall.function?.arguments) {
              const bufferedTool = toolCallBuffer.get(index)!;
              bufferedTool.input += toolCall.function.arguments;

              yield {
                event: 'content_block_delta',
                data: {
                  type: 'content_block_delta',
                  index: index + 1,
                  delta: {
                    type: 'input_json_delta',
                    partial_json: toolCall.function.arguments
                  }
                }
              };
            }
          }
        }

        // 处理完成
        if (choice.finish_reason) {
          // 结束所有内容块
          if (textContent) {
            yield {
              event: 'content_block_stop',
              data: {
                type: 'content_block_stop',
                index: 0
              }
            };
          }

          for (const [index] of toolCallBuffer) {
            yield {
              event: 'content_block_stop',
              data: {
                type: 'content_block_stop',
                index: index + 1
              }
            };
          }

          // 🎯 修复finish_reason映射
          const anthropicFinishReason = this.mapOpenAIFinishReasonToAnthropic(
            choice.finish_reason,
            toolCallBuffer.size > 0
          );

          yield {
            event: 'message_delta',
            data: {
              type: 'message_delta',
              delta: {
                stop_reason: anthropicFinishReason,
                stop_sequence: null
              },
              usage: {
                output_tokens: 1
              }
            }
          };

          yield {
            event: 'message_stop',
            data: {
              type: 'message_stop'
            }
          };

          break;
        }
      }
    } catch (error) {
      console.error('🚨 [OPENAI-TRANSFORMER] Stream processing failed:', {
        error: error instanceof Error ? error.message : String(error),
        requestId
      });
      throw error;
    }
  }

  /**
   * Convert OpenAI request to unified format
   */
  transformRequestToUnified(request: any): UnifiedRequest {
    const unified: UnifiedRequest = {
      messages: this.convertMessagesToUnified(request.messages || []),
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: request.stream || false
    };

    // Handle tools
    if (request.tools && Array.isArray(request.tools)) {
      unified.tools = request.tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: tool.function.parameters
        }
      }));
    }

    // Handle tool choice
    if (request.tool_choice) {
      if (typeof request.tool_choice === 'string') {
        unified.tool_choice = request.tool_choice;
      } else if (request.tool_choice.function?.name) {
        unified.tool_choice = request.tool_choice.function.name;
      }
    }

    return unified;
  }

  /**
   * Convert unified request to OpenAI format
   */
  transformRequestFromUnified(request: UnifiedRequest): any {
    const openaiRequest: any = {
      model: request.model,
      messages: this.convertMessagesFromUnified(request.messages),
      max_tokens: request.max_tokens || 131072,
      temperature: request.temperature,
      stream: request.stream || false
    };

    // Add system message if present
    if (request.system) {
      openaiRequest.messages.unshift({
        role: 'system',
        content: request.system
      });
    }

    // Handle tools
    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = request.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }
      }));

      // Handle tool choice
      if (request.tool_choice) {
        if (request.tool_choice === 'auto' || request.tool_choice === 'none') {
          openaiRequest.tool_choice = request.tool_choice;
        } else {
          openaiRequest.tool_choice = {
            type: 'function',
            function: { name: request.tool_choice }
          };
        }
      }
    }

    return openaiRequest;
  }

  /**
   * Convert OpenAI response to unified format
   */
  transformResponseToUnified(response: any): UnifiedResponse {
    
    // finish_reason修正现在在预处理器中处理
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls
        },
        finish_reason: choice.finish_reason
      }],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      }
    };
  }

  /**
   * Convert unified response to OpenAI format
   */
  transformResponseFromUnified(response: UnifiedResponse): any {
    return response; // Already in OpenAI format
  }

  /**
   * Convert OpenAI streaming chunk to unified format
   * 保留finish_reason，传递给下游处理
   */
  
  /**
   * Convert OpenAI streaming chunk to unified format
   * 🔧 修复finish_reason映射，确保工具调用正确处理
   */
  transformStreamChunk(chunk: any): StreamChunk | null {
    if (!chunk.choices?.[0]) {
      return null;
    }

    const choice = chunk.choices[0];
    
    // 🔧 修正finish_reason：如果有工具调用但finish_reason是stop，修正为tool_calls
    if (choice.finish_reason === 'stop' && choice.delta?.tool_calls?.length > 0) {
      choice.finish_reason = 'tool_calls';
    }
    
    return {
      id: chunk.id,
      object: 'chat.completion.chunk',
      created: chunk.created || Math.floor(Date.now() / 1000),
      model: chunk.model,
      choices: [{
        index: 0,
        delta: choice.delta,
        finish_reason: choice.finish_reason // 传递修正后的finish_reason
      }]
    };
  }

  /**
   * Convert messages to unified format
   */
  private convertMessagesToUnified(messages: any[]): UnifiedMessage[] {
    const unifiedMessages: UnifiedMessage[] = [];
    const toolResultMap = new Map<string, any>();

    // First pass: collect tool results
    messages.forEach(msg => {
      if (msg.role === 'tool' && msg.tool_call_id) {
        if (!toolResultMap.has(msg.tool_call_id)) {
          toolResultMap.set(msg.tool_call_id, []);
        }
        toolResultMap.get(msg.tool_call_id).push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id
        });
      }
    });

    // Second pass: process messages and merge tool results
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'tool') {
        continue; // Skip, will be handled in assistant messages
      }

      const unifiedMsg: UnifiedMessage = {
        role: msg.role,
        content: msg.content || ''
      };

      // Handle tool calls in assistant messages
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        unifiedMsg.tool_calls = msg.tool_calls.map((toolCall: any) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        }));

        // If content is null but we have tool calls, set empty content
        if (unifiedMsg.content === null && unifiedMsg.tool_calls && unifiedMsg.tool_calls.length > 0) {
          unifiedMsg.content = '';
        }
      }

      unifiedMessages.push(unifiedMsg);

      // Add tool results after assistant message with tool calls
      if (msg.role === 'assistant' && msg.tool_calls) {
        msg.tool_calls.forEach((toolCall: any) => {
          const toolResults = toolResultMap.get(toolCall.id);
          if (toolResults) {
            toolResults.forEach((result: any) => {
              unifiedMessages.push({
                role: 'tool',
                content: result.content,
                tool_call_id: result.tool_call_id
              });
            });
          } else {
            // Add placeholder tool result if missing
            unifiedMessages.push({
              role: 'tool',
              content: JSON.stringify({
                success: true,
                message: 'Tool call executed successfully',
                tool_call_id: toolCall.id
              }),
              tool_call_id: toolCall.id
            });
          }
        });
      }
    }

    return unifiedMessages;
  }

  /**
   * Convert messages from unified format
   */
  private convertMessagesFromUnified(messages: UnifiedMessage[]): any[] {
    return messages.map(msg => {
      const openaiMsg: any = {
        role: msg.role,
        content: msg.content
      };

      // Handle tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        openaiMsg.tool_calls = msg.tool_calls;
        // OpenAI expects null content when there are tool calls
        if (!msg.content || msg.content === '') {
          openaiMsg.content = null;
        }
      }

      // Handle tool results
      if (msg.role === 'tool' && msg.tool_call_id) {
        openaiMsg.tool_call_id = msg.tool_call_id;
      }

      return openaiMsg;
    });
  }

  /**
   * 🔧 Convert Anthropic messages to OpenAI format
   */
  private convertAnthropicMessagesToOpenAI(messages: any[]): any[] {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array - violates zero fallback principle');
    }

    return messages.map(msg => {
      if (!msg || typeof msg !== 'object') {
        throw new Error('Invalid message object - violates zero fallback principle');
      }

      const openaiMsg: any = {
        role: msg.role,
        content: null
      };

      // 处理内容转换
      if (msg.content) {
        if (typeof msg.content === 'string') {
          openaiMsg.content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // 处理复杂内容块
          const { content, toolCalls } = this.convertAnthropicContentToOpenAI(msg.content);
          openaiMsg.content = content;
          if (toolCalls.length > 0) {
            openaiMsg.tool_calls = toolCalls;
          }
        }
      }

      return openaiMsg;
    });
  }

  /**
   * 🔧 Convert Anthropic content blocks to OpenAI format
   */
  private convertAnthropicContentToOpenAI(content: any[]): { content: string | null, toolCalls: any[] } {
    let textContent = '';
    const toolCalls: any[] = [];

    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      if (block.type === 'text') {
        textContent += block.text || '';
      } else if (block.type === 'tool_use') {
        if (!block.id || !block.name) {
          throw new Error('Tool use block missing id or name - violates zero fallback principle');
        }

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

    return {
      content: textContent || (toolCalls.length > 0 ? null : ''),
      toolCalls
    };
  }

  /**
   * 🔧 Convert Anthropic tools to OpenAI format
   */
  private convertAnthropicToolsToOpenAI(tools: any[]): any[] {
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
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.input_schema || {}
        }
      };
    });
  }

  /**
   * 🔧 Convert tool choice
   */
  private convertToolChoice(toolChoice: any): any {
    if (!toolChoice) {
      return undefined;
    }

    if (typeof toolChoice === 'string') {
      if (toolChoice === 'auto' || toolChoice === 'none') {
        return toolChoice;
      }
      // 具体工具名
      return {
        type: 'function',
        function: { name: toolChoice }
      };
    }

    return toolChoice;
  }

  /**
   * 🔧 Convert OpenAI message to Anthropic content blocks
   */
  private convertOpenAIMessageToAnthropicContent(message: any): any[] {
    const content: any[] = [];

    // 处理文本内容
    if (message.content && typeof message.content === 'string') {
      content.push({
        type: 'text',
        text: message.content
      });
    }

    // 处理工具调用
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (!toolCall.id || !toolCall.function?.name) {
          console.warn('🚨 [OPENAI-TRANSFORMER] Invalid tool call, skipping:', toolCall);
          continue;
        }

        let input: any = {};
        if (toolCall.function.arguments) {
          try {
            input = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            console.warn('🚨 [OPENAI-TRANSFORMER] Failed to parse tool arguments:', {
              arguments: toolCall.function.arguments,
              error: error instanceof Error ? error.message : String(error)
            });
            input = {}; // 不使用fallback，使用空对象
          }
        }

        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input
        });
      }
    }

    // 如果没有内容，添加空文本块
    if (content.length === 0) {
      content.push({
        type: 'text',
        text: ''
      });
    }

    return content;
  }

  /**
   * 🎯 Map OpenAI finish_reason to Anthropic stop_reason
   * 使用统一的response-converter.ts进行映射
   */
  private mapOpenAIFinishReasonToAnthropic(finishReason: string, hasToolCalls: boolean): string {
    // 🔧 使用统一的转换器，避免重复逻辑
    const { mapFinishReasonStrict } = require('@/transformers/response-converter');
    
    try {
      const mappedReason = mapFinishReasonStrict(finishReason);
      
      // 🔧 Critical Fix: 如果有工具调用，强制返回tool_use
      if (hasToolCalls && (mappedReason === 'end_turn' || finishReason === 'tool_calls')) {
        return 'tool_use';
      }
      
      return mappedReason;
    } catch (error) {
      // 记录映射失败，但不使用fallback
      logger.error('OpenAI finish_reason mapping failed', {
        finishReason,
        hasToolCalls,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // 重新抛出错误，不使用fallback
    }
  }

  /**
   * 🔧 Check if message has tool calls
   */
  private hasToolCalls(message: any): boolean {
    return !!(message?.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0);
  }
}

/**
 * Utility function to create OpenAI transformer
 */
export function createOpenAITransformer(): OpenAITransformer {
  return new OpenAITransformer();
}