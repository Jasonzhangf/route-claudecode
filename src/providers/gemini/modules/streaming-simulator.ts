/**
 * Gemini流式响应模拟器
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 将非流式响应转换为流式格式
 * - 模拟SSE事件流
 * - 支持工具调用的流式输出
 * - 确保与真实流式响应格式一致
 */

import { AnthropicResponse } from '../../../types';
import { logger } from '../../../utils/logger';

export interface StreamingEvent {
  event: string;
  data: string;
}

export interface StreamingSimulatorConfig {
  chunkDelay: number; // 每个chunk之间的延迟(ms)
  textChunkSize: number; // 每个文本chunk的字符数
  enableToolCallStreaming: boolean; // 是否启用工具调用流式输出
}

export class GeminiStreamingSimulator {
  private config: StreamingSimulatorConfig;

  constructor(config: Partial<StreamingSimulatorConfig> = {}) {
    // 使用配置驱动的默认值，避免硬编码
    const defaultConfig: StreamingSimulatorConfig = {
      chunkDelay: 20,
      textChunkSize: 10,
      enableToolCallStreaming: true
    };
    
    this.config = {
      ...defaultConfig,
      ...config
    };
  }

  /**
   * 处理Gemini SDK的真实流式响应
   */
  async *processStream(
    geminiStream: any,
    originalRequest: any,
    requestId: string
  ): AsyncIterable<any> {
    logger.info('Processing Gemini SDK stream with modular architecture', {
      streamType: 'gemini-sdk-stream',
      hasTools: !!originalRequest.tools
    }, requestId, 'gemini-streaming-simulator');

    let contentIndex = 0;
    let hasToolCalls = false;
    let textContent = '';
    let toolCalls: any[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let finalFinishReason = 'STOP';
    let currentTextBlockStarted = false;

    // Send message_start
    yield {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
          type: 'message',
          role: 'assistant',
          model: originalRequest.model,
          content: [],
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      }
    };

    try {
      // Process the stream
      for await (const chunk of geminiStream) {
        if (!chunk.candidates || chunk.candidates.length === 0) continue;
        
        const candidate = chunk.candidates[0];
        if (!candidate.content?.parts || candidate.content.parts.length === 0) continue;
        
        const parts = candidate.content.parts;
        
        // Update finish reason if provided
        if (candidate.finishReason) {
          finalFinishReason = candidate.finishReason;
        }
        
        for (const part of parts) {
          if (part.text) {
            // Handle text content
            if (!currentTextBlockStarted) {
              yield {
                event: 'content_block_start',
                data: {
                  type: 'content_block_start',
                  index: contentIndex,
                  content_block: { type: 'text', text: '' }
                }
              };
              currentTextBlockStarted = true;
            }
            
            // Send text in chunks for better UX
            const chunkSize = this.config.textChunkSize;
            for (let i = 0; i < part.text.length; i += chunkSize) {
              const textChunk = part.text.slice(i, i + chunkSize);
              yield {
                event: 'content_block_delta',
                data: {
                  type: 'content_block_delta',
                  index: contentIndex,
                  delta: {
                    type: 'text_delta',
                    text: textChunk
                  }
                }
              };
              
              if (i > 0) {
                await this.sleep(this.config.chunkDelay);
              }
            }
            
            textContent += part.text;
            
          } else if (part.functionCall) {
            // Handle tool calls
            hasToolCalls = true;
            
            // End current text block if started
            if (currentTextBlockStarted) {
              yield {
                event: 'content_block_stop',
                data: {
                  type: 'content_block_stop',
                  index: contentIndex
                }
              };
              contentIndex++;
              currentTextBlockStarted = false;
            }
            
            const toolUse = {
              type: 'tool_use',
              id: `toolu_${Date.now()}_${contentIndex}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            };
            
            toolCalls.push(toolUse);
            
            // Send tool use block
            yield {
              event: 'content_block_start',
              data: {
                type: 'content_block_start',
                index: contentIndex,
                content_block: toolUse
              }
            };
            
            yield {
              event: 'content_block_stop',
              data: {
                type: 'content_block_stop',
                index: contentIndex
              }
            };
            
            contentIndex++;
            
            logger.debug('Converted Gemini SDK functionCall to tool_use', {
              functionName: part.functionCall.name,
              toolId: toolUse.id
            }, requestId, 'gemini-streaming-simulator');
          }
        }
        
        // Extract usage metadata
        if (chunk.usageMetadata) {
          inputTokens = Math.max(inputTokens, chunk.usageMetadata.promptTokenCount || 0);
          outputTokens += chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }
      
      // End current text block if started
      if (currentTextBlockStarted) {
        yield {
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: contentIndex
          }
        };
      }
      
      // Estimate tokens if not provided
      if (outputTokens === 0) {
        outputTokens = Math.ceil((textContent.length + toolCalls.length * 50) / 4);
      }
      
      // Send message_delta with usage
      yield {
        event: 'message_delta',
        data: {
          type: 'message_delta',
          delta: {},
          usage: {
            output_tokens: outputTokens
          }
        }
      };

      // 🔧 Critical Fix: Use content-driven stop_reason (OpenAI success pattern)
      let actualStopReason = 'end_turn';
      if (hasToolCalls) {
        actualStopReason = 'tool_use'; // Force tool_use if we have tool calls
      } else if (finalFinishReason === 'MAX_TOKENS') {
        actualStopReason = 'max_tokens';
      } else if (finalFinishReason && finalFinishReason !== 'STOP') {
        actualStopReason = 'stop_sequence';
      }

      // Send message_stop with proper stop_reason
      yield {
        event: 'message_stop',
        data: {
          type: 'message_stop',
          stop_reason: actualStopReason,
          stop_sequence: null
        }
      };
      
      logger.info('Gemini SDK stream processing completed with modular architecture', {
        textLength: textContent.length,
        toolCallCount: toolCalls.length,
        outputTokens,
        hasToolCalls,
        finalStopReason: actualStopReason
      }, requestId, 'gemini-streaming-simulator');
      
    } catch (error) {
      logger.error('Failed to process Gemini SDK stream', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name
      }, requestId, 'gemini-streaming-simulator');
      throw error;
    }
  }

  /**
   * 将非流式Anthropic响应转换为流式事件流
   */
  async *simulateStreaming(
    response: AnthropicResponse, 
    requestId: string
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    if (!response) {
      throw new Error('GeminiStreamingSimulator: response is required');
    }

    logger.debug('Starting streaming simulation', {
      responseId: response.id,
      contentBlocks: response.content?.length || 0,
      stopReason: response.stop_reason
    }, requestId, 'gemini-streaming-simulator');

    try {
      // 1. 发送message_start事件
      yield this.createMessageStartEvent(response);

      // 2. 处理内容块
      if (response.content && Array.isArray(response.content)) {
        for (let i = 0; i < response.content.length; i++) {
          const contentBlock = response.content[i];
          
          // 发送content_block_start事件
          yield this.createContentBlockStartEvent(i, contentBlock);

          // 根据内容类型生成相应的流式事件
          if (contentBlock.type === 'text') {
            yield* this.simulateTextStreaming(contentBlock, i, requestId);
          } else if (contentBlock.type === 'tool_use') {
            yield* this.simulateToolUseStreaming(contentBlock, i, requestId);
          }

          // 发送content_block_stop事件
          yield this.createContentBlockStopEvent(i);
        }
      }

      // 3. 发送message_delta事件（包含stop_reason和usage）
      yield this.createMessageDeltaEvent(response);

      // 4. 发送message_stop事件
      yield this.createMessageStopEvent();

      logger.debug('Streaming simulation completed', {
        responseId: response.id
      }, requestId, 'gemini-streaming-simulator');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error during streaming simulation', {
        error: errorMessage,
        responseId: response.id
      }, requestId, 'gemini-streaming-simulator');
      
      // 发送错误事件
      yield this.createErrorEvent(errorMessage);
    }
  }

  /**
   * 模拟文本内容的流式输出
   */
  private async *simulateTextStreaming(
    textBlock: any, 
    index: number, 
    requestId: string
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    if (!textBlock.text) {
      logger.debug('Empty text block, skipping streaming', { index }, requestId, 'gemini-streaming-simulator');
      return;
    }

    const text = textBlock.text;
    const chunkSize = this.config.textChunkSize;
    
    logger.debug('Starting text streaming simulation', {
      textLength: text.length,
      chunkSize: chunkSize,
      estimatedChunks: Math.ceil(text.length / chunkSize)
    }, requestId, 'gemini-streaming-simulator');

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      
      // 创建content_block_delta事件
      yield this.createContentBlockDeltaEvent(index, 'text', { text: chunk });

      // 模拟网络延迟
      if (i + chunkSize < text.length) { // 最后一个chunk不延迟
        await this.sleep(this.config.chunkDelay);
      }
    }
  }

  /**
   * 模拟工具调用的流式输出
   */
  private async *simulateToolUseStreaming(
    toolBlock: any, 
    index: number, 
    requestId: string
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    if (!this.config.enableToolCallStreaming) {
      // 一次性输出整个工具调用
      yield this.createContentBlockDeltaEvent(index, 'tool_use', {
        id: toolBlock.id,
        name: toolBlock.name,
        input: toolBlock.input
      });
      return;
    }

    logger.debug('Starting tool use streaming simulation', {
      toolId: toolBlock.id,
      toolName: toolBlock.name
    }, requestId, 'gemini-streaming-simulator');

    // 1. 先输出工具ID和名称
    yield this.createContentBlockDeltaEvent(index, 'tool_use', {
      id: toolBlock.id,
      name: toolBlock.name
    });
    
    await this.sleep(this.config.chunkDelay);

    // 2. 模拟输入参数的流式输出
    if (toolBlock.input && typeof toolBlock.input === 'object') {
      const inputJson = JSON.stringify(toolBlock.input, null, 2);
      const chunkSize = Math.max(this.config.textChunkSize, 20); // 工具参数chunk稍大一些
      
      for (let i = 0; i < inputJson.length; i += chunkSize) {
        const chunk = inputJson.slice(i, i + chunkSize);
        
        yield this.createContentBlockDeltaEvent(index, 'tool_use', {
          input: chunk
        });

        if (i + chunkSize < inputJson.length) {
          await this.sleep(this.config.chunkDelay);
        }
      }
    }
  }

  /**
   * 创建message_start事件
   */
  private createMessageStartEvent(response: AnthropicResponse): StreamingEvent {
    return {
      event: 'message_start',
      data: JSON.stringify({
        type: 'message_start',
        message: {
          id: response.id,
          type: response.type,
          role: response.role,
          model: response.model,
          content: [],
          stop_sequence: response.stop_sequence,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })
    };
  }

  /**
   * 创建content_block_start事件
   */
  private createContentBlockStartEvent(index: number, contentBlock: any): StreamingEvent {
    const blockStart: any = {
      type: 'content_block_start',
      index: index,
      content_block: {
        type: contentBlock.type
      }
    };

    if (contentBlock.type === 'tool_use') {
      blockStart.content_block.id = contentBlock.id;
      blockStart.content_block.name = contentBlock.name;
    }

    return {
      event: 'content_block_start', 
      data: JSON.stringify(blockStart)
    };
  }

  /**
   * 创建content_block_delta事件
   */
  private createContentBlockDeltaEvent(index: number, type: string, delta: any): StreamingEvent {
    return {
      event: 'content_block_delta',
      data: JSON.stringify({
        type: 'content_block_delta',
        index: index,
        delta: {
          type: type === 'text' ? 'text_delta' : 'input_json_delta',
          ...delta
        }
      })
    };
  }

  /**
   * 创建content_block_stop事件
   */
  private createContentBlockStopEvent(index: number): StreamingEvent {
    return {
      event: 'content_block_stop',
      data: JSON.stringify({
        type: 'content_block_stop',
        index: index
      })
    };
  }

  /**
   * 创建message_delta事件
   */
  private createMessageDeltaEvent(response: AnthropicResponse): StreamingEvent {
    const delta: any = {};
    
    if (response.stop_reason) {
      delta.stop_reason = response.stop_reason;
    }

    if (response.usage) {
      delta.usage = response.usage;
    }

    return {
      event: 'message_delta',
      data: JSON.stringify({
        type: 'message_delta',
        delta: delta
      })
    };
  }

  /**
   * 创建message_stop事件
   */
  private createMessageStopEvent(): StreamingEvent {
    return {
      event: 'message_stop',
      data: JSON.stringify({
        type: 'message_stop'
      })
    };
  }

  /**
   * 创建错误事件
   */
  private createErrorEvent(errorMessage: string): StreamingEvent {
    return {
      event: 'error',
      data: JSON.stringify({
        type: 'error',
        error: {
          type: 'streaming_error',
          message: errorMessage
        }
      })
    };
  }

  /**
   * 睡眠工具函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<StreamingSimulatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Streaming simulator config updated', this.config);
  }

  /**
   * 验证响应格式
   */
  static validateResponse(response: AnthropicResponse): void {
    if (!response) {
      throw new Error('GeminiStreamingSimulator: response is required');
    }

    if (!response.id || !response.type || !response.role) {
      throw new Error('GeminiStreamingSimulator: response missing required fields (id, type, role)');
    }

    if (!Array.isArray(response.content)) {
      throw new Error('GeminiStreamingSimulator: response.content must be an array');
    }
  }
}