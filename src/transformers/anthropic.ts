/**
 * Anthropic Format Transformer
 * Handles conversion between Anthropic API format and unified format
 */

import { 
  MessageTransformer, 
  UnifiedRequest, 
  UnifiedResponse, 
  UnifiedMessage, 
  UnifiedContent,
  UnifiedTool,
  StreamChunk
} from './types';
import { logger } from '@/utils/logger';

export class AnthropicTransformer implements MessageTransformer {
  public readonly name = 'anthropic';

  /**
   * Convert Anthropic request to unified format
   */
  transformRequestToUnified(request: any): UnifiedRequest {
    const unified: UnifiedRequest = {
      messages: this.convertMessagesToUnified(request.messages || []),
      model: request.model,
      max_tokens: request.max_tokens || 131072, // 128K tokens default
      temperature: request.temperature,
      stream: request.stream || false
    };

    // Handle system messages
    if (request.system) {
      if (typeof request.system === 'string') {
        unified.system = request.system;
      } else if (Array.isArray(request.system)) {
        unified.system = request.system
          .filter((s: any) => s.type === 'text')
          .map((s: any) => s.text)
          .join('\n');
      }
    }

    // Handle tools
    if (request.tools && Array.isArray(request.tools)) {
      unified.tools = request.tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.input_schema
        }
      }));
    }

    // Handle tool choice
    if (request.tool_choice) {
      if (request.tool_choice.type === 'auto') {
        unified.tool_choice = 'auto';
      } else if (request.tool_choice.type === 'tool' && request.tool_choice.name) {
        unified.tool_choice = request.tool_choice.name;
      }
    }

    return unified;
  }

  /**
   * Convert unified request to Anthropic format
   */
  transformRequestFromUnified(request: UnifiedRequest): any {
    const anthropicRequest: any = {
      model: request.model,
      messages: this.convertMessagesFromUnified(request.messages),
      max_tokens: request.max_tokens || 131072, // 128K tokens default
      temperature: request.temperature,
      stream: request.stream || false
    };

    // Handle system messages
    if (request.system) {
      anthropicRequest.system = request.system;
    }

    // Handle tools
    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = request.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));

      // Handle tool choice
      if (request.tool_choice) {
        if (request.tool_choice === 'auto') {
          anthropicRequest.tool_choice = { type: 'auto' };
        } else if (typeof request.tool_choice === 'string') {
          anthropicRequest.tool_choice = {
            type: 'tool',
            name: request.tool_choice
          };
        }
      }
    }

    return anthropicRequest;
  }

  /**
   * Convert Anthropic response to unified format
   */
  transformResponseToUnified(response: any): UnifiedResponse {
    const textContent = response.content?.find((c: any) => c.type === 'text');
    const toolUses = response.content?.filter((c: any) => c.type === 'tool_use') || [];

    const toolCalls = toolUses.map((toolUse: any, index: number) => ({
      id: toolUse.id || `call_${Date.now()}_${index}`,
      type: 'function' as const,
      function: {
        name: toolUse.name,
        arguments: JSON.stringify(toolUse.input || {})
      }
    }));

    return {
      id: response.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: textContent?.text || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        },
        finish_reason: this.mapStopReason(response.stop_reason)
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Convert unified response to Anthropic format
   */
  transformResponseFromUnified(response: UnifiedResponse): any {
    const choice = response.choices[0];
    const content: any[] = [];

    // Add text content
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content
      });
    }

    // Add tool uses
    if (choice.message.tool_calls) {
      choice.message.tool_calls.forEach(toolCall => {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}')
        });
      });
    }

    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content,
      model: response.model,
      stop_reason: this.mapFinishReason(choice.finish_reason),
      stop_sequence: null,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens
      }
    };
  }

  /**
   * Convert Anthropic streaming chunk to unified format
   */
  transformStreamChunk(chunk: any): StreamChunk | null {
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'unknown',
        choices: [{
          index: 0,
          delta: {
            content: chunk.delta.text
          }
        }]
      };
    }

    if (chunk.type === 'message_delta' && chunk.delta?.stop_reason) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'unknown',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: this.mapStopReason(chunk.delta.stop_reason)
        }]
      };
    }

    return null;
  }

  /**
   * Convert messages to unified format
   */
  private convertMessagesToUnified(messages: any[]): UnifiedMessage[] {
    return messages.map(msg => {
      const unified: UnifiedMessage = {
        role: msg.role,
        content: this.convertContentToUnified(msg.content)
      };

      return unified;
    });
  }

  /**
   * Convert messages from unified format
   */
  private convertMessagesFromUnified(messages: UnifiedMessage[]): any[] {
    const anthropicMessages: any[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'system') {
        continue; // System messages handled separately
      }

      const anthropicMsg: any = {
        role: msg.role,
        content: this.convertContentFromUnified(msg, messages, i)
      };

      anthropicMessages.push(anthropicMsg);
    }

    return this.preprocessMessages(anthropicMessages);
  }

  /**
   * Convert content to unified format
   */
  private convertContentToUnified(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text') {
          return block.text;
        } else if (block.type === 'tool_result') {
          const result = typeof block.content === 'string' 
            ? block.content 
            : JSON.stringify(block.content);
          return `Tool result (${block.tool_use_id}): ${result}`;
        } else if (block.type === 'tool_use') {
          return `Tool call: ${block.name}(${JSON.stringify(block.input)})`;
        }
        return JSON.stringify(block);
      }).join('\n');
    }

    return JSON.stringify(content);
  }

  /**
   * Convert content from unified format
   */
  private convertContentFromUnified(msg: UnifiedMessage, allMessages: UnifiedMessage[], index: number): any {
    const content: any[] = [];

    // Handle tool results for user messages
    if (msg.role === 'user') {
      // Look for preceding tool messages
      const toolResults: any[] = [];
      let j = index - 1;
      while (j >= 0 && allMessages[j].role === 'tool') {
        toolResults.unshift(allMessages[j]);
        j--;
      }

      // Add tool results first
      toolResults.forEach(toolMsg => {
        content.push({
          type: 'tool_result',
          tool_use_id: toolMsg.tool_call_id,
          content: toolMsg.content || ''
        });
      });

      // Add user text content
      if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
        content.push({
          type: 'text',
          text: msg.content
        });
      }

      return content.length === 1 && content[0].type === 'text' 
        ? content[0].text 
        : content.length === 0 
          ? '' 
          : content;
    }

    // Handle assistant messages with tool calls
    if (msg.role === 'assistant') {
      // Add text content
      if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
        content.push({
          type: 'text',
          text: msg.content
        });
      }

      // Add tool uses
      if (msg.tool_calls) {
        msg.tool_calls.forEach(toolCall => {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments || '{}')
          });
        });
      }

      return content.length === 1 && content[0].type === 'text' 
        ? content[0].text 
        : content;
    }

    return msg.content || '';
  }

  /**
   * Preprocess messages to handle tool result placement
   */
  private preprocessMessages(messages: any[]): any[] {
    const processed: any[] = [];
    const toolResultMap = new Map<string, any>();
    const toolResultPositions = new Map<string, number>();

    // First pass: collect tool results and their positions
    messages.forEach((msg, index) => {
      if (Array.isArray(msg.content)) {
        msg.content.forEach((block: any) => {
          if (block.type === 'tool_result' && block.tool_use_id) {
            toolResultMap.set(block.tool_use_id, block);
            toolResultPositions.set(block.tool_use_id, index);
          }
        });
      }
    });

    // Second pass: process messages and handle tool result placement
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const toolUses = msg.content.filter((block: any) => block.type === 'tool_use');
        
        if (toolUses.length > 0) {
          processed.push(msg);
          
          // Check if tool results are properly placed
          const missingResults: any[] = [];
          toolUses.forEach((toolUse: any) => {
            if (!toolResultMap.has(toolUse.id)) {
              missingResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  success: true,
                  message: 'Tool call executed successfully'
                })
              });
            }
          });

          // Add missing tool results as a user message
          if (missingResults.length > 0) {
            processed.push({
              role: 'user',
              content: missingResults
            });
          }
        } else {
          processed.push(msg);
        }
      } else {
        // Filter out tool results that are already handled
        if (Array.isArray(msg.content)) {
          const filteredContent = msg.content.filter((block: any) => 
            block.type !== 'tool_result' || !toolResultMap.has(block.tool_use_id)
          );
          
          if (filteredContent.length > 0) {
            processed.push({
              ...msg,
              content: filteredContent
            });
          }
        } else {
          processed.push(msg);
        }
      }
    }

    return processed;
  }

  /**
   * Map Anthropic stop reason to OpenAI finish reason
   */
  private mapStopReason(stopReason: string): string {
    const mapping: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'tool_use': 'tool_calls',
      'stop_sequence': 'stop'
    };
    return mapping[stopReason] || 'stop';
  }

  /**
   * Map OpenAI finish reason to Anthropic stop reason
   */
  private mapFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'function_call': 'tool_use'
    };
    return mapping[finishReason] || 'end_turn';
  }
}

/**
 * Utility function to create Anthropic transformer
 */
export function createAnthropicTransformer(): AnthropicTransformer {
  return new AnthropicTransformer();
}