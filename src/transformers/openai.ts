/**
 * OpenAI Format Transformer
 * Handles conversion between OpenAI API format and unified format
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
import { logger } from '@/utils/logger';

export class OpenAITransformer implements MessageTransformer {
  public readonly name = 'openai';

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
   * 移除finish_reason，保证停止的权力在模型这边
   */
  transformStreamChunk(chunk: any): StreamChunk | null {
    if (!chunk.choices?.[0]) {
      return null;
    }

    // 移除finish_reason，不传递给Anthropic
    return {
      id: chunk.id,
      object: 'chat.completion.chunk',
      created: chunk.created || Math.floor(Date.now() / 1000),
      model: chunk.model,
      choices: [{
        index: 0,
        delta: chunk.choices[0].delta
        // 完全移除finish_reason
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
}

/**
 * Utility function to create OpenAI transformer
 */
export function createOpenAITransformer(): OpenAITransformer {
  return new OpenAITransformer();
}