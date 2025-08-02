/**
 * Streaming Response Transformer
 * Handles real-time conversion of streaming responses between formats
 */

import { StreamChunk, MessageTransformer } from './types';
import { logger } from '@/utils/logger';
import { PipelineDebugger } from '@/debug/pipeline-debugger';

export interface StreamTransformOptions {
  sourceFormat: 'openai' | 'anthropic';
  targetFormat: 'openai' | 'anthropic';
  model?: string;
  requestId?: string;
  port?: number;
}

export class StreamingTransformer {
  private messageId: string;
  private model: string;
  private requestId: string;
  private toolCallMap: Map<number, any> = new Map();
  private contentBlockIndex = 0;
  private hasStarted = false;
  private isCompleted = false;
  private pipelineDebugger: PipelineDebugger;

  constructor(
    private sourceTransformer: MessageTransformer,
    private targetTransformer: MessageTransformer,
    private options: StreamTransformOptions
  ) {
    this.messageId = `msg_${Date.now()}`;
    // Use the model from options (should be the targetModel from routing)
    this.model = options.model || 'unknown';
    this.requestId = options.requestId || 'unknown';
    this.pipelineDebugger = new PipelineDebugger(options.port || 3456);
    
    logger.debug('StreamingTransformer initialized', {
      model: this.model,
      sourceFormat: options.sourceFormat,
      targetFormat: options.targetFormat,
      requestId: this.requestId
    });
  }

  /**
   * Transform streaming response from OpenAI to Anthropic format
   */
  async *transformOpenAIToAnthropic(stream: ReadableStream): AsyncIterable<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let outputTokens = 0;
    let stopReason = undefined; // 移除默认停止原因

    try {
      // Send message start event
      if (!this.hasStarted) {
        const messageStartEvent = this.createAnthropicEvent('message_start', {
          type: 'message_start',
          message: {
            id: this.messageId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: this.model,
            // 完全移除stop_reason，保证停止的权力在模型这边
            // stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        });
        if (messageStartEvent) {
          yield messageStartEvent;
        }

        const pingEvent = this.createAnthropicEvent('ping', { type: 'ping' });
        if (pingEvent) {
          yield pingEvent;
        }
        this.hasStarted = true;
      }

      let hasContentBlock = false;

      while (!this.isCompleted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              this.isCompleted = true;
              break;
            }

            try {
              const chunk = JSON.parse(data);
              const choice = chunk.choices?.[0];
              if (!choice) continue;
              
              // Track if we handled this chunk
              let handledChunk = false;

              // Handle content deltas - with defensive programming like demo1
              if (choice.delta?.content !== undefined) {
                handledChunk = true;
                
                if (!hasContentBlock) {
                  const startEvent = this.createAnthropicEvent('content_block_start', {
                    type: 'content_block_start',
                    index: 0,
                    content_block: { type: 'text', text: '' }
                  });
                  if (startEvent) {
                    yield startEvent;
                    hasContentBlock = true;
                  }
                }

                // Only yield content delta if there is actual non-empty content
                if (choice.delta.content && choice.delta.content.length > 0) {
                  // Check for tool calls appearing in text content (error condition)
                  this.pipelineDebugger.detectToolCallError(
                    choice.delta.content,
                    this.requestId,
                    'streaming-text-delta',
                    'streaming-transformer',
                    this.model
                  );
                  
                  const deltaEvent = this.createAnthropicEvent('content_block_delta', {
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'text_delta', text: choice.delta.content }
                  });
                  if (deltaEvent) {
                    yield deltaEvent;
                    outputTokens += Math.ceil(choice.delta.content.length / 4);
                  }
                }
                // Note: for empty content, we don't yield a delta but we still marked it as handled
              }

              // Handle tool calls
              if (choice.delta?.tool_calls) {
                handledChunk = true;
                
                for (const toolCall of choice.delta.tool_calls) {
                  const index = toolCall.index ?? 0;
                  
                  if (!this.toolCallMap.has(index)) {
                    // Close previous content block if exists
                    if (hasContentBlock) {
                      const stopEvent = this.createAnthropicEvent('content_block_stop', {
                        type: 'content_block_stop',
                        index: 0
                      });
                      if (stopEvent) {
                        yield stopEvent;
                      }
                    }

                    const blockIndex = hasContentBlock ? 1 : 0;
                    this.toolCallMap.set(index, {
                      id: toolCall.id || `call_${Date.now()}_${index}`,
                      name: toolCall.function?.name || `tool_${index}`,
                      arguments: '',
                      blockIndex
                    });

                    const toolStartEvent = this.createAnthropicEvent('content_block_start', {
                      type: 'content_block_start',
                      index: blockIndex,
                      content_block: {
                        type: 'tool_use',
                        id: this.toolCallMap.get(index).id,
                        name: this.toolCallMap.get(index).name,
                        input: {}
                      }
                    });
                    if (toolStartEvent) {
                      yield toolStartEvent;
                    }
                  }

                  // Update tool call data
                  const toolCallData = this.toolCallMap.get(index);
                  if (toolCall.function?.arguments) {
                    toolCallData.arguments += toolCall.function.arguments;
                    
                    const toolDeltaEvent = this.createAnthropicEvent('content_block_delta', {
                      type: 'content_block_delta',
                      index: toolCallData.blockIndex,
                      delta: {
                        type: 'input_json_delta',
                        partial_json: toolCall.function.arguments
                      }
                    });
                    if (toolDeltaEvent) {
                      yield toolDeltaEvent;
                    }
                  }
                }
              }

              // Handle finish reason
              if (choice.finish_reason) {
                handledChunk = true;
                stopReason = this.mapFinishReason(choice.finish_reason);
              }
              
              // If we didn't handle this chunk, it means it's just a metadata chunk that doesn't need transformation
              // This is normal and we should NOT yield anything for such chunks
              if (!handledChunk) {
                // This is expected for chunks like: {"delta": {"role": "assistant"}} or {"delta": {}}
                // We simply skip them without yielding anything
              }
              
            } catch (error) {
              logger.debug('Failed to parse streaming chunk', error, this.requestId);
              
              // Check for tool call errors in the problematic chunk
              if (data && this.isLikelyToolCallError(data, error)) {
                logger.error('Tool call parsing error detected', { 
                  error: (error as Error).message, 
                  rawChunk: data,
                  requestId: this.requestId 
                });
                
                // Save raw data for analysis - this will be captured by the debug system
                this.saveRawStreamDataForAnalysis([data], 'openai-to-anthropic', error);
              }
            }
          }
        }
      }

      // Send completion events
      if (hasContentBlock) {
        const stopEvent = this.createAnthropicEvent('content_block_stop', {
          type: 'content_block_stop',
          index: 0
        });
        if (stopEvent) {
          yield stopEvent;
        }
      }

      // Close any open tool call blocks
      for (const [index, toolCall] of this.toolCallMap.entries()) {
        const toolStopEvent = this.createAnthropicEvent('content_block_stop', {
          type: 'content_block_stop',
          index: toolCall.blockIndex
        });
        if (toolStopEvent) {
          yield toolStopEvent;
        }
      }

      // Send message delta with usage - 智能处理stop_reason
      const hasToolCalls = this.toolCallMap.size > 0;
      const shouldIncludeStopReason = stopReason === 'tool_use' || hasToolCalls;
      
      if (shouldIncludeStopReason) {
        // 工具调用完成 - 需要发送stop_reason以触发下一轮
        const messageDeltaEvent = this.createAnthropicEvent('message_delta', {
          type: 'message_delta',
          delta: { 
            stop_reason: stopReason || 'tool_use',
            stop_sequence: null
          },
          usage: { output_tokens: outputTokens }
        });
        if (messageDeltaEvent) {
          yield messageDeltaEvent;
        }

        // 发送message_stop事件以正确结束当前工具调用轮次
        const messageStopEvent = this.createAnthropicEvent('message_stop', {
          type: 'message_stop'
        });
        if (messageStopEvent) {
          yield messageStopEvent;
        }
      } else {
        // 非工具调用 - 移除stop signals保持对话开放
        const messageDeltaEvent = this.createAnthropicEvent('message_delta', {
          type: 'message_delta',
          delta: { 
            // Empty delta - no stop signals to keep conversation alive
          },
          usage: { output_tokens: outputTokens }
        });
        if (messageDeltaEvent) {
          yield messageDeltaEvent;
        }
        
        // 不发送message_stop事件，避免会话终止
      }

    } catch (error) {
      logger.error('Streaming transformation failed', error, this.requestId);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Transform streaming response from Anthropic to OpenAI format
   */
  async *transformAnthropicToOpenAI(stream: ReadableStream): AsyncIterable<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let toolCallIndex = 0;
    let currentToolCalls: Map<number, any> = new Map();

    try {
      while (!this.isCompleted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              this.isCompleted = true;
              break;
            }

            try {
              const event = JSON.parse(data);
              
              // Handle content block deltas
              if (event.type === 'content_block_delta' && event.delta?.text) {
                // Check for tool calls appearing in text content (error condition)
                this.pipelineDebugger.detectToolCallError(
                  event.delta.text,
                  this.requestId,
                  'streaming-anthropic-to-openai',
                  'streaming-transformer',
                  this.model
                );
                
                yield this.createOpenAIChunk({
                  choices: [{
                    index: 0,
                    delta: { content: event.delta.text }
                  }]
                });
              }

              // Handle tool use blocks
              if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                const toolCall = {
                  index: toolCallIndex++,
                  id: event.content_block.id,
                  type: 'function',
                  function: {
                    name: event.content_block.name,
                    arguments: ''
                  }
                };
                
                currentToolCalls.set(event.index, toolCall);
                
                yield this.createOpenAIChunk({
                  choices: [{
                    index: 0,
                    delta: { tool_calls: [toolCall] }
                  }]
                });
              }

              // Handle tool input deltas
              if (event.type === 'content_block_delta' && event.delta?.partial_json) {
                const toolCall = currentToolCalls.get(event.index);
                if (toolCall) {
                  yield this.createOpenAIChunk({
                    choices: [{
                      index: 0,
                      delta: {
                        tool_calls: [{
                          index: toolCall.index,
                          function: { arguments: event.delta.partial_json }
                        }]
                      }
                    }]
                  });
                }
              }

              // Handle message completion
              if (event.type === 'message_delta' && event.delta?.stop_reason) {
                yield this.createOpenAIChunk({
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: this.mapStopReason(event.delta.stop_reason)
                  }]
                });
              }

            } catch (error) {
              logger.debug('Failed to parse Anthropic streaming chunk', error, this.requestId);
            }
          }
        }
      }

      // Send final [DONE] marker
      yield 'data: [DONE]\n\n';

    } catch (error) {
      logger.error('Anthropic to OpenAI streaming transformation failed', error, this.requestId);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create Anthropic SSE event - with defensive programming
   */
  private createAnthropicEvent(event: string, data: any): string | null {
    try {
      // Defensive checks like demo1
      if (!event || event === undefined || event === null) {
        return null;
      }
      if (!data || data === undefined || data === null) {
        return null;
      }
      
      const jsonString = JSON.stringify(data);
      if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
        return null;
      }
      
      return `event: ${event}\ndata: ${jsonString}\n\n`;
    } catch (error) {
      // If JSON.stringify fails, return null instead of undefined
      console.error('Failed to create Anthropic event:', error);
      return null;
    }
  }

  /**
   * Create OpenAI streaming chunk
   */
  private createOpenAIChunk(chunkData: any): string {
    const chunk = {
      id: this.messageId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      ...chunkData
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
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
    const result = mapping[finishReason];
    if (!result) {
      throw new Error(`Unknown finish reason '${finishReason}' - no mapping found and fallback disabled. Available reasons: ${Object.keys(mapping).join(', ')}`);
    }
    return result;
  }

  /**
   * Check if raw data contains tool call signatures
   */
  private isLikelyToolCallError(rawChunk: string, error: any): boolean {
    const toolCallPatterns = [
      // Tool call signatures
      /\{\s*"type"\s*:\s*"tool_use"/i,
      /\{\s*"name"\s*:\s*"[a-zA-Z_][a-zA-Z0-9_]*"/i,
      /\{\s*"function"\s*:/i,
      // Tool call keywords
      /tool_call/i,
      /function_call/i,
      // JSON structures
      /\{\s*"id"\s*:\s*"call_/i,
      /\{\s*"index"\s*:\s*\d+/i
    ];

    return toolCallPatterns.some(pattern => pattern.test(rawChunk));
  }

  /**
   * Save raw stream data for analysis
   */
  private saveRawStreamDataForAnalysis(rawStreamData: string[], transformationStage: string, error: any): void {
    try {
      this.pipelineDebugger.addRawStreamData(this.requestId, rawStreamData.join(''));
      
      // Log the error for analysis
      this.pipelineDebugger.logToolCallError({
        requestId: this.requestId,
        errorType: 'raw_stream_analysis',
        errorMessage: `Raw stream analysis error: ${error.message}`,
        rawChunk: rawStreamData.slice(-5).join(''), // Last 5 chunks for context
        transformationStage,
        timestamp: new Date().toISOString(),
        provider: 'streaming-transformer',
        model: this.model,
        port: this.options.port || 3456
      }).catch(err => {
        console.error('Failed to log tool call error:', err);
      });
    } catch (error) {
      console.error('Failed to prepare raw stream analysis data:', error);
    }
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
    const result = mapping[stopReason];
    if (!result) {
      throw new Error(`Unknown stop reason '${stopReason}' - no mapping found and fallback disabled. Available reasons: ${Object.keys(mapping).join(', ')}`);
    }
    return result;
  }
}

/**
 * Create streaming transformer
 */
export function createStreamingTransformer(
  sourceTransformer: MessageTransformer,
  targetTransformer: MessageTransformer,
  options: StreamTransformOptions
): StreamingTransformer {
  return new StreamingTransformer(sourceTransformer, targetTransformer, options);
}