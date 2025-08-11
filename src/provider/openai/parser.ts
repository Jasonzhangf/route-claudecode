/**
 * OpenAI Response Parser Implementation
 * Real implementation of OpenAI response parsing and streaming
 */

import { AIResponse, Choice, Usage } from '../../types/interfaces.js';

export class OpenAIParser {
  constructor() {
    console.log('✅ OpenAIParser initialized');
  }

  async parseResponse(rawResponse: any): Promise<AIResponse> {
    try {
      const choices: Choice[] = rawResponse.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          metadata: {
            toolCalls: choice.message.tool_calls,
            functionCall: choice.message.function_call // Legacy function calling
          }
        },
        finishReason: this.parseFinishReason(choice.finish_reason)
      }));

      return {
        id: rawResponse.id,
        model: rawResponse.model,
        choices,
        usage: this.parseUsage(rawResponse.usage),
        metadata: {
          timestamp: new Date(),
          processingTime: 0, // Would be calculated from request timing
          provider: 'openai'
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
  }

  async parseStreamingResponse(chunk: any): Promise<Partial<AIResponse>> {
    try {
      if (!chunk.choices || chunk.choices.length === 0) {
        return {};
      }

      const choices = chunk.choices.map((choice: any) => {
        const result: any = {
          index: choice.index,
          message: {
            role: 'assistant',
            content: ''
          }
        };

        // Handle content delta
        if (choice.delta?.content) {
          result.message.content = choice.delta.content;
        }

        // Handle tool calls delta
        if (choice.delta?.tool_calls) {
          result.message.metadata = {
            toolCalls: choice.delta.tool_calls
          };
        }

        // Handle function call delta (legacy)
        if (choice.delta?.function_call) {
          result.message.metadata = {
            functionCall: choice.delta.function_call
          };
        }

        // Handle finish reason
        if (choice.finish_reason) {
          result.finishReason = this.parseFinishReason(choice.finish_reason);
        }

        return result;
      });

      const result: Partial<AIResponse> = {
        choices
      };

      // Add ID and model if present
      if (chunk.id) {
        result.id = chunk.id;
      }
      if (chunk.model) {
        result.model = chunk.model;
      }

      // Add usage if present (usually only in the last chunk)
      if (chunk.usage) {
        result.usage = this.parseUsage(chunk.usage);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to parse OpenAI streaming chunk: ${error.message}`);
    }
  }

  private parseFinishReason(finishReason: string | null): string {
    if (!finishReason) {
      return 'stop';
    }

    // OpenAI finish reasons are already in the expected format
    const reasonMap: Record<string, string> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_calls',
      'function_call': 'function_call',
      'content_filter': 'content_filter'
    };

    return reasonMap[finishReason] || finishReason;
  }

  private parseUsage(usage: any): Usage {
    if (!usage) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };
    }

    return {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
    };
  }

  // Utility method to validate response format
  validateResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Check required fields
    if (!response.id || !response.model || !response.choices) {
      return false;
    }

    // Validate choices array
    if (!Array.isArray(response.choices) || response.choices.length === 0) {
      return false;
    }

    // Validate each choice
    for (const choice of response.choices) {
      if (typeof choice.index !== 'number' || !choice.message) {
        return false;
      }
      
      if (!choice.message.role || !['assistant', 'user', 'system'].includes(choice.message.role)) {
        return false;
      }
    }

    return true;
  }

  // Utility method to extract error information from response
  extractError(response: any): { code: string; message: string } | null {
    if (response.error) {
      return {
        code: response.error.code || 'unknown_error',
        message: response.error.message || 'Unknown error occurred'
      };
    }

    return null;
  }

  // Method to handle tool call responses
  parseToolCallResponse(toolCall: any): any {
    return {
      id: toolCall.id,
      type: toolCall.type || 'function',
      function: {
        name: toolCall.function?.name,
        arguments: toolCall.function?.arguments
      }
    };
  }

  // Method to format tool results for conversation continuation
  formatToolResult(toolCallId: string, result: any): any {
    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    };
  }

  // Method to calculate response statistics
  calculateResponseStats(response: any): {
    textLength: number;
    toolCallCount: number;
    choiceCount: number;
  } {
    const textLength = response.choices?.reduce((total: number, choice: any) => {
      return total + (choice.message?.content?.length || 0);
    }, 0) || 0;

    const toolCallCount = response.choices?.reduce((total: number, choice: any) => {
      return total + (choice.message?.tool_calls?.length || 0);
    }, 0) || 0;

    const choiceCount = response.choices?.length || 0;

    return {
      textLength,
      toolCallCount,
      choiceCount
    };
  }

  // Method to merge streaming chunks into a complete response
  mergeStreamingChunks(chunks: Partial<AIResponse>[]): AIResponse {
    if (chunks.length === 0) {
      throw new Error('No chunks to merge');
    }

    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];

    // Merge content from all chunks
    const mergedContent = chunks
      .map(chunk => chunk.choices?.[0]?.message?.content || '')
      .join('');

    return {
      id: firstChunk.id || `merged-${Date.now()}`,
      model: firstChunk.model || 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: mergedContent,
          metadata: lastChunk.choices?.[0]?.message?.metadata
        },
        finishReason: lastChunk.choices?.[0]?.finishReason || 'stop'
      }],
      usage: lastChunk.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'openai'
      }
    };
  }
}

console.log('✅ OpenAI parser loaded - real implementation');