/**
 * Gemini Streaming Simulator Module
 * 流式响应模拟器，基于非流式API响应生成流式输出
 * Project owner: Jason Zhang
 */

import { BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 流式响应模拟器
 * 职责：将非流式响应转换为Anthropic兼容的流式事件
 * 🔧 Critical Fix: Use content-driven stop_reason (OpenAI success pattern)
 */
export class GeminiStreamingSimulator {

  /**
   * 模拟流式响应
   * 基于OpenAI Provider的成功模式：非流式API + 流式模拟
   */
  static async *simulateStreamingResponse(
    response: BaseResponse, 
    originalRequest: any, 
    requestId: string
  ): AsyncIterable<any> {
    if (!response) {
      throw new Error('GeminiStreamingSimulator: response is required');
    }

    if (!response.content || !Array.isArray(response.content)) {
      throw new Error('GeminiStreamingSimulator: response must have content array');
    }

    logger.debug('Starting streaming simulation', {
      contentBlocks: response.content.length,
      responseId: response.id,
      stopReason: response.stop_reason
    }, requestId, 'gemini-streaming-simulator');

    if (!response.id) {
      throw new Error('GeminiStreamingSimulator: response.id is required');
    }
    const messageId = response.id;

    try {
      // Send message_start event
      yield {
        event: 'message_start',
        data: {
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: response.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        }
      };

      // Send ping event
      yield {
        event: 'ping',
        data: { type: 'ping' }
      };

      // Process each content block
      for (let i = 0; i < response.content.length; i++) {
        const block = response.content[i];
        
        // Send content_block_start
        yield {
          event: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: i,
            content_block: block
          }
        };

        if (block.type === 'text' && block.text) {
          // Simulate streaming text with chunks
          yield* this.simulateTextStreaming(block.text, i, requestId);
        } else if (block.type === 'tool_use') {
          // Simulate tool use streaming
          yield* this.simulateToolUseStreaming(block, i, requestId);
        }

        // Send content_block_stop
        yield {
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: i
          }
        };
      }

      // Send message_delta with usage
      yield {
        event: 'message_delta',
        data: {
          type: 'message_delta',
          delta: {},
          usage: {
            output_tokens: response.usage?.output_tokens ?? 0
          }
        }
      };

      // 🔧 Critical Fix: Use content-driven stop_reason (OpenAI success pattern)
      if (!response.stop_reason) {
        throw new Error('GeminiStreamingSimulator: response.stop_reason is required');
      }
      let actualStopReason = response.stop_reason;
      const hasToolCalls = response.content.some(block => block.type === 'tool_use');
      
      if (hasToolCalls) {
        actualStopReason = 'tool_use'; // Force tool_use if we have tool calls
        logger.debug('Streaming: Content-driven stop_reason applied', {
          toolCallCount: response.content.filter(block => block.type === 'tool_use').length,
          actualStopReason
        }, requestId, 'gemini-streaming-simulator');
      }

      // Send message_stop event
      yield {
        event: 'message_stop',
        data: {
          type: 'message_stop',
          stop_reason: actualStopReason,
          stop_sequence: null
        }
      };

      logger.debug('Streaming simulation completed', {
        contentBlocks: response.content.length,
        actualStopReason,
        hasToolCalls
      }, requestId, 'gemini-streaming-simulator');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Streaming simulation failed', {
        error: errorMessage,
        responseId: response.id,
        contentBlocks: response.content?.length ?? 0
      }, requestId, 'gemini-streaming-simulator');
      
      throw error;
    }
  }

  /**
   * 模拟文本流式输出
   */
  private static async *simulateTextStreaming(
    text: string, 
    index: number, 
    requestId: string
  ): AsyncIterable<any> {
    const chunkSize = 10; // 每次发送10个字符
    const delay = 10; // 10ms延迟模拟真实流式体验

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      
      yield {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: index,
          delta: {
            type: 'text_delta',
            text: chunk
          }
        }
      };
      
      // Add small delay for realistic streaming effect
      if (i > 0 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.debug('Text streaming simulation completed', {
      index,
      textLength: text.length,
      chunkCount: Math.ceil(text.length / chunkSize)
    }, requestId, 'gemini-streaming-simulator');
  }

  /**
   * 模拟工具调用流式输出
   */
  private static async *simulateToolUseStreaming(
    toolUse: any, 
    index: number, 
    requestId: string
  ): AsyncIterable<any> {
    if (!toolUse.input) {
      logger.debug('Tool use has no input to stream', {
        index,
        toolName: toolUse.name
      }, requestId, 'gemini-streaming-simulator');
      return;
    }

    // 模拟工具参数的流式输出
    const inputJson = JSON.stringify(toolUse.input, null, 2);
    const chunkSize = 20;
    const delay = 15; // 稍微慢一点模拟工具调用的思考过程

    for (let i = 0; i < inputJson.length; i += chunkSize) {
      const chunk = inputJson.slice(i, i + chunkSize);
      
      yield {
        event: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: index,
          delta: {
            type: 'input_json_delta',
            partial_json: chunk
          }
        }
      };
      
      // Add delay for tool use simulation
      if (i > 0 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.debug('Tool use streaming simulation completed', {
      index,
      toolName: toolUse.name,
      inputLength: inputJson.length,
      chunkCount: Math.ceil(inputJson.length / chunkSize)
    }, requestId, 'gemini-streaming-simulator');
  }
}