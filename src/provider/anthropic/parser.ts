/**
 * Anthropic Response Parser Implementation
 * Real implementation of Anthropic response parsing and streaming
 */

import { AIResponse, Choice, Usage } from '../../types/interfaces.js';
import { AnthropicResponse, AnthropicStreamChunk, AnthropicContent } from './types.js';

export class AnthropicParser {
  constructor() {
    console.log('✅ AnthropicParser initialized');
  }

  async parseResponse(rawResponse: AnthropicResponse): Promise<AIResponse> {
    try {
      const content = this.extractContent(rawResponse.content);
      const toolCalls = this.extractToolCalls(rawResponse.content);
      
      const choice: Choice = {
        index: 0,
        message: {
          role: 'assistant',
          content,
          metadata: {
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            stopReason: rawResponse.stop_reason,
            stopSequence: rawResponse.stop_sequence
          }
        },
        finishReason: this.parseFinishReason(rawResponse.stop_reason)
      };

      return {
        id: rawResponse.id,
        model: rawResponse.model,
        choices: [choice],
        usage: this.parseUsage(rawResponse.usage),
        metadata: {
          timestamp: new Date(),
          processingTime: 0, // Would be calculated from request timing
          provider: 'anthropic'
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse Anthropic response: ${error.message}`);
    }
  }

  async parseStreamingResponse(chunk: AnthropicStreamChunk): Promise<Partial<AIResponse>> {
    try {
      switch (chunk.type) {
        case 'message_start':
          return {
            id: chunk.message?.id,
            model: chunk.message?.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: ''
              }
            }]
          };

        case 'content_block_start':
          return {
            choices: [{
              index: chunk.index || 0,
              message: {
                role: 'assistant',
                content: ''
              }
            }]
          };

        case 'content_block_delta':
          if (chunk.delta?.type === 'text_delta') {
            return {
              choices: [{
                index: chunk.index || 0,
                message: {
                  role: 'assistant',
                  content: chunk.delta.text || ''
                }
              }]
            };
          }
          break;

        case 'content_block_stop':
          return {
            choices: [{
              index: chunk.index || 0,
              message: {
                role: 'assistant',
                content: ''
              }
            }]
          };

        case 'message_delta':
          if (chunk.delta?.stop_reason) {
            return {
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: ''
                },
                finishReason: this.parseFinishReason(chunk.delta.stop_reason)
              }]
            };
          }
          break;

        case 'message_stop':
          return {
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: ''
              },
              finishReason: 'stop'
            }]
          };

        default:
          // Unknown chunk type, return empty partial response
          return {};
      }

      return {};
    } catch (error) {
      throw new Error(`Failed to parse Anthropic streaming chunk: ${error.message}`);
    }
  }

  private extractContent(content: AnthropicContent[]): string {
    if (!Array.isArray(content)) {
      return String(content);
    }

    return content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join('');
  }

  private extractToolCalls(content: AnthropicContent[]): any[] {
    if (!Array.isArray(content)) {
      return [];
    }

    return content
      .filter(item => item.type === 'tool_use')
      .map(item => ({
        id: item.id,
        type: 'function',
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input || {})
        }
      }));
  }

  private parseFinishReason(stopReason: string): string {
    const reasonMap: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop',
      'tool_use': 'tool_calls'
    };
    return reasonMap[stopReason] || 'stop';
  }

  private parseUsage(usage: any): Usage {
    return {
      promptTokens: usage?.input_tokens || 0,
      completionTokens: usage?.output_tokens || 0,
      totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
    };
  }

  // Utility method to validate response format
  validateResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Check required fields
    if (!response.id || !response.type || !response.role || !response.content) {
      return false;
    }

    // Validate content array
    if (!Array.isArray(response.content)) {
      return false;
    }

    // Validate each content item
    for (const item of response.content) {
      if (!item.type || !['text', 'tool_use', 'tool_result'].includes(item.type)) {
        return false;
      }
    }

    return true;
  }

  // Utility method to extract error information from response
  extractError(response: any): { code: string; message: string } | null {
    if (response.error) {
      return {
        code: response.error.type || 'unknown_error',
        message: response.error.message || 'Unknown error occurred'
      };
    }

    return null;
  }

  // Method to handle tool results in conversation
  parseToolResult(toolResult: any): AnthropicContent {
    return {
      type: 'tool_result',
      tool_use_id: toolResult.tool_use_id,
      content: typeof toolResult.content === 'string' 
        ? toolResult.content 
        : JSON.stringify(toolResult.content)
    };
  }

  // Method to format messages for conversation continuation
  formatMessagesForContinuation(messages: any[], newContent: AnthropicContent[]): any[] {
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage && lastMessage.role === 'assistant') {
      // Append to existing assistant message
      return [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          content: [...(Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content]), ...newContent]
        }
      ];
    } else {
      // Add new assistant message
      return [
        ...messages,
        {
          role: 'assistant',
          content: newContent
        }
      ];
    }
  }

  // Method to calculate response statistics
  calculateResponseStats(response: AnthropicResponse): {
    textLength: number;
    toolCallCount: number;
    contentBlocks: number;
  } {
    const textLength = this.extractContent(response.content).length;
    const toolCallCount = this.extractToolCalls(response.content).length;
    const contentBlocks = response.content.length;

    return {
      textLength,
      toolCallCount,
      contentBlocks
    };
  }
}

console.log('✅ Anthropic parser loaded - real implementation');