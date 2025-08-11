/**
 * Streaming Manager
 * Intelligent streaming architecture with force non-streaming + streaming simulation
 */

import { AIRequest, AIResponse } from '../../types/interfaces.js';
import { SupportedFormat } from './format-converter.js';

export type BufferingStrategy = 'full' | 'smart' | 'minimal';
export type StreamingMode = 'force_non_streaming' | 'native_streaming' | 'simulated_streaming';

export interface StreamingConfig {
  mode: StreamingMode;
  bufferingStrategy: BufferingStrategy;
  toolCallBuffering: boolean;
  chunkSize: number;
  simulationDelay: number;
  enableToolCallParsing: boolean;
}

export interface StreamChunk {
  id: string;
  type: 'content' | 'tool_call' | 'metadata' | 'error' | 'done';
  data: any;
  timestamp: Date;
  sequenceNumber: number;
}

export interface StreamingContext {
  requestId: string;
  provider: string;
  format: SupportedFormat;
  config: StreamingConfig;
  buffer: StreamChunk[];
  toolCallBuffer: any[];
  isComplete: boolean;
  error?: Error;
}

export class StreamingManager {
  private contexts: Map<string, StreamingContext> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('✅ StreamingManager initialized');
  }

  /**
   * Create streaming context for a request
   */
  createStreamingContext(
    requestId: string,
    provider: string,
    format: SupportedFormat,
    config: StreamingConfig
  ): StreamingContext {
    if (!this.initialized) {
      throw new Error('StreamingManager not initialized');
    }

    const context: StreamingContext = {
      requestId,
      provider,
      format,
      config,
      buffer: [],
      toolCallBuffer: [],
      isComplete: false
    };

    this.contexts.set(requestId, context);
    return context;
  }

  /**
   * Process streaming response based on configuration
   */
  async processStreamingResponse(
    response: any,
    context: StreamingContext,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<AIResponse> {
    switch (context.config.mode) {
      case 'force_non_streaming':
        return await this.forceNonStreaming(response, context);
      
      case 'native_streaming':
        return await this.processNativeStreaming(response, context, onChunk);
      
      case 'simulated_streaming':
        return await this.simulateStreaming(response, context, onChunk);
      
      default:
        throw new Error(`Unsupported streaming mode: ${context.config.mode}`);
    }
  }

  /**
   * Force non-streaming: Convert streaming response to complete response
   */
  private async forceNonStreaming(
    response: any,
    context: StreamingContext
  ): Promise<AIResponse> {
    console.log(`🔄 Force non-streaming for ${context.provider}`);

    // If response is already non-streaming, return as-is
    if (!this.isStreamingResponse(response)) {
      return this.convertToStandardResponse(response, context);
    }

    // Buffer all streaming chunks
    const chunks: StreamChunk[] = [];
    let sequenceNumber = 0;

    if (response[Symbol.asyncIterator]) {
      // Handle async iterator
      for await (const chunk of response) {
        const streamChunk = this.parseStreamChunk(chunk, context, sequenceNumber++);
        chunks.push(streamChunk);
        context.buffer.push(streamChunk);
      }
    } else if (response.on) {
      // Handle event emitter
      return new Promise((resolve, reject) => {
        response.on('data', (chunk: any) => {
          const streamChunk = this.parseStreamChunk(chunk, context, sequenceNumber++);
          chunks.push(streamChunk);
          context.buffer.push(streamChunk);
        });

        response.on('end', () => {
          const completeResponse = this.assembleCompleteResponse(chunks, context);
          resolve(completeResponse);
        });

        response.on('error', (error: Error) => {
          context.error = error;
          reject(error);
        });
      });
    }

    // Assemble complete response from chunks
    return this.assembleCompleteResponse(chunks, context);
  }

  /**
   * Process native streaming with intelligent buffering
   */
  private async processNativeStreaming(
    response: any,
    context: StreamingContext,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<AIResponse> {
    console.log(`🔄 Native streaming for ${context.provider} with ${context.config.bufferingStrategy} buffering`);

    const chunks: StreamChunk[] = [];
    let sequenceNumber = 0;

    if (response[Symbol.asyncIterator]) {
      for await (const chunk of response) {
        const streamChunk = this.parseStreamChunk(chunk, context, sequenceNumber++);
        chunks.push(streamChunk);
        
        // Apply buffering strategy
        const shouldEmit = this.shouldEmitChunk(streamChunk, context);
        if (shouldEmit && onChunk) {
          onChunk(streamChunk);
        }

        // Handle tool call buffering
        if (streamChunk.type === 'tool_call' && context.config.toolCallBuffering) {
          context.toolCallBuffer.push(streamChunk.data);
        }
      }
    }

    return this.assembleCompleteResponse(chunks, context);
  }

  /**
   * Simulate streaming from complete response
   */
  private async simulateStreaming(
    response: any,
    context: StreamingContext,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<AIResponse> {
    console.log(`🔄 Simulated streaming for ${context.provider}`);

    // Convert to complete response first
    const completeResponse = this.convertToStandardResponse(response, context);
    
    // Break down into chunks for simulation
    const chunks = this.createSimulatedChunks(completeResponse, context);

    // Emit chunks with delay
    for (const chunk of chunks) {
      if (onChunk) {
        onChunk(chunk);
      }
      
      // Add simulation delay
      if (context.config.simulationDelay > 0) {
        await this.delay(context.config.simulationDelay);
      }
    }

    return completeResponse;
  }

  /**
   * Parse streaming chunk based on provider format
   */
  private parseStreamChunk(
    chunk: any,
    context: StreamingContext,
    sequenceNumber: number
  ): StreamChunk {
    const streamChunk: StreamChunk = {
      id: `${context.requestId}-chunk-${sequenceNumber}`,
      type: 'content',
      data: chunk,
      timestamp: new Date(),
      sequenceNumber
    };

    // Provider-specific parsing
    switch (context.format) {
      case 'anthropic':
        return this.parseAnthropicChunk(chunk, streamChunk, context);
      
      case 'openai':
        return this.parseOpenAIChunk(chunk, streamChunk, context);
      
      case 'gemini':
        return this.parseGeminiChunk(chunk, streamChunk, context);
      
      case 'codewhisperer':
        return this.parseCodeWhispererChunk(chunk, streamChunk, context);
      
      default:
        return streamChunk;
    }
  }

  /**
   * Parse Anthropic streaming chunk
   */
  private parseAnthropicChunk(
    chunk: any,
    streamChunk: StreamChunk,
    context: StreamingContext
  ): StreamChunk {
    if (chunk.type === 'content_block_delta') {
      streamChunk.type = 'content';
      streamChunk.data = chunk.delta?.text || '';
    } else if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
      streamChunk.type = 'tool_call';
      streamChunk.data = {
        id: chunk.content_block.id,
        name: chunk.content_block.name,
        input: {}
      };
    } else if (chunk.type === 'content_block_delta' && chunk.delta?.partial_json) {
      streamChunk.type = 'tool_call';
      streamChunk.data = {
        partial_json: chunk.delta.partial_json
      };
    } else if (chunk.type === 'message_stop') {
      streamChunk.type = 'done';
      streamChunk.data = { stop_reason: chunk.stop_reason };
    }

    return streamChunk;
  }

  /**
   * Parse OpenAI streaming chunk
   */
  private parseOpenAIChunk(
    chunk: any,
    streamChunk: StreamChunk,
    context: StreamingContext
  ): StreamChunk {
    if (chunk.choices?.[0]?.delta?.content) {
      streamChunk.type = 'content';
      streamChunk.data = chunk.choices[0].delta.content;
    } else if (chunk.choices?.[0]?.delta?.tool_calls) {
      streamChunk.type = 'tool_call';
      streamChunk.data = chunk.choices[0].delta.tool_calls;
    } else if (chunk.choices?.[0]?.finish_reason) {
      streamChunk.type = 'done';
      streamChunk.data = { finish_reason: chunk.choices[0].finish_reason };
    }

    return streamChunk;
  }

  /**
   * Parse Gemini streaming chunk
   */
  private parseGeminiChunk(
    chunk: any,
    streamChunk: StreamChunk,
    context: StreamingContext
  ): StreamChunk {
    if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
      streamChunk.type = 'content';
      streamChunk.data = chunk.candidates[0].content.parts[0].text;
    } else if (chunk.candidates?.[0]?.finishReason) {
      streamChunk.type = 'done';
      streamChunk.data = { finish_reason: chunk.candidates[0].finishReason };
    }

    return streamChunk;
  }

  /**
   * Parse CodeWhisperer streaming chunk
   */
  private parseCodeWhispererChunk(
    chunk: any,
    streamChunk: StreamChunk,
    context: StreamingContext
  ): StreamChunk {
    // CodeWhisperer typically doesn't stream, but handle if it does
    if (chunk.completions) {
      streamChunk.type = 'content';
      streamChunk.data = chunk.completions.map((c: any) => c.content).join('\n');
    }

    return streamChunk;
  }

  /**
   * Determine if chunk should be emitted based on buffering strategy
   */
  private shouldEmitChunk(chunk: StreamChunk, context: StreamingContext): boolean {
    switch (context.config.bufferingStrategy) {
      case 'full':
        // Only emit when complete
        return chunk.type === 'done';
      
      case 'smart':
        // Buffer tool calls, emit content immediately
        if (chunk.type === 'tool_call' && context.config.toolCallBuffering) {
          return false; // Buffer tool calls
        }
        return chunk.type === 'content' || chunk.type === 'done';
      
      case 'minimal':
        // Emit everything immediately
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Assemble complete response from chunks
   */
  private assembleCompleteResponse(
    chunks: StreamChunk[],
    context: StreamingContext
  ): AIResponse {
    const contentChunks = chunks.filter(c => c.type === 'content');
    const toolCallChunks = chunks.filter(c => c.type === 'tool_call');
    const doneChunk = chunks.find(c => c.type === 'done');

    const content = contentChunks.map(c => c.data).join('');
    const toolCalls = this.assembleToolCalls(toolCallChunks, context);

    const response: AIResponse = {
      id: context.requestId,
      model: 'assembled-from-stream',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          metadata: {
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined
          }
        },
        finishReason: this.extractFinishReason(doneChunk, context)
      }],
      usage: {
        promptTokens: 0,
        completionTokens: this.estimateTokens(content),
        totalTokens: this.estimateTokens(content)
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: context.provider,
        streamingMode: context.config.mode,
        bufferingStrategy: context.config.bufferingStrategy
      }
    };

    return response;
  }

  /**
   * Assemble tool calls from streaming chunks
   */
  private assembleToolCalls(chunks: StreamChunk[], context: StreamingContext): any[] {
    if (!context.config.enableToolCallParsing) {
      return [];
    }

    const toolCalls: any[] = [];
    const toolCallMap = new Map<string, any>();

    for (const chunk of chunks) {
      if (chunk.data.id) {
        // New tool call
        if (!toolCallMap.has(chunk.data.id)) {
          toolCallMap.set(chunk.data.id, {
            id: chunk.data.id,
            type: 'function',
            function: {
              name: chunk.data.name || '',
              arguments: ''
            }
          });
        }
      } else if (chunk.data.partial_json) {
        // Accumulate partial JSON for tool call arguments
        const lastToolCall = Array.from(toolCallMap.values()).pop();
        if (lastToolCall) {
          lastToolCall.function.arguments += chunk.data.partial_json;
        }
      }
    }

    // Validate and parse tool call arguments
    for (const toolCall of toolCallMap.values()) {
      try {
        // Attempt to parse accumulated JSON
        if (toolCall.function.arguments) {
          JSON.parse(toolCall.function.arguments);
        }
        toolCalls.push(toolCall);
      } catch (error) {
        console.warn(`Failed to parse tool call arguments for ${toolCall.id}:`, error);
        // Include tool call with raw arguments for debugging
        toolCalls.push({
          ...toolCall,
          parseError: error.message
        });
      }
    }

    return toolCalls;
  }

  /**
   * Create simulated chunks from complete response
   */
  private createSimulatedChunks(
    response: AIResponse,
    context: StreamingContext
  ): StreamChunk[] {
    const chunks: StreamChunk[] = [];
    let sequenceNumber = 0;

    const content = response.choices[0]?.message?.content || '';
    const toolCalls = response.choices[0]?.message?.metadata?.toolCalls || [];

    // Break content into chunks
    const chunkSize = context.config.chunkSize || 50;
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push({
        id: `${context.requestId}-sim-${sequenceNumber++}`,
        type: 'content',
        data: content.slice(i, i + chunkSize),
        timestamp: new Date(),
        sequenceNumber: sequenceNumber - 1
      });
    }

    // Add tool calls as chunks
    for (const toolCall of toolCalls) {
      chunks.push({
        id: `${context.requestId}-tool-${sequenceNumber++}`,
        type: 'tool_call',
        data: toolCall,
        timestamp: new Date(),
        sequenceNumber: sequenceNumber - 1
      });
    }

    // Add done chunk
    chunks.push({
      id: `${context.requestId}-done`,
      type: 'done',
      data: { finish_reason: response.choices[0]?.finishReason || 'stop' },
      timestamp: new Date(),
      sequenceNumber: sequenceNumber
    });

    return chunks;
  }

  /**
   * Check if response is streaming
   */
  private isStreamingResponse(response: any): boolean {
    return !!(
      response[Symbol.asyncIterator] ||
      response.on ||
      response.pipe ||
      (typeof response === 'object' && response.stream)
    );
  }

  /**
   * Convert response to standard format
   */
  private convertToStandardResponse(response: any, context: StreamingContext): AIResponse {
    // Handle different response types
    if (response.choices && Array.isArray(response.choices)) {
      // Already in standard format
      return response as AIResponse;
    }

    // Convert from provider-specific format
    let content = '';
    let toolCalls: any[] = [];

    if (typeof response === 'string') {
      content = response;
    } else if (response.content) {
      if (Array.isArray(response.content)) {
        // Anthropic format
        content = response.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('');
        
        toolCalls = response.content
          .filter((item: any) => item.type === 'tool_use')
          .map((item: any) => ({
            id: item.id,
            type: 'function',
            function: {
              name: item.name,
              arguments: JSON.stringify(item.input)
            }
          }));
      } else {
        content = String(response.content);
      }
    } else if (response.text) {
      content = response.text;
    } else {
      content = JSON.stringify(response);
    }

    return {
      id: context.requestId,
      model: response.model || 'converted',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          metadata: toolCalls.length > 0 ? { toolCalls } : undefined
        },
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
      }],
      usage: {
        promptTokens: response.usage?.input_tokens || response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.output_tokens || response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: context.provider,
        streamingMode: context.config.mode,
        bufferingStrategy: context.config.bufferingStrategy
      }
    };
  }

  /**
   * Extract finish reason from done chunk
   */
  private extractFinishReason(doneChunk: StreamChunk | undefined, context: StreamingContext): string {
    if (!doneChunk) return 'stop';

    const data = doneChunk.data;
    if (data.finish_reason) return data.finish_reason;
    if (data.stop_reason) return data.stop_reason;
    
    return 'stop';
  }

  /**
   * Estimate token count (simple approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get streaming context
   */
  getStreamingContext(requestId: string): StreamingContext | undefined {
    return this.contexts.get(requestId);
  }

  /**
   * Clean up streaming context
   */
  cleanupContext(requestId: string): void {
    this.contexts.delete(requestId);
  }

  /**
   * Get default streaming config
   */
  getDefaultStreamingConfig(): StreamingConfig {
    return {
      mode: 'force_non_streaming',
      bufferingStrategy: 'smart',
      toolCallBuffering: true,
      chunkSize: 50,
      simulationDelay: 50,
      enableToolCallParsing: true
    };
  }

  async shutdown(): Promise<void> {
    this.contexts.clear();
    this.initialized = false;
    console.log('✅ StreamingManager shutdown completed');
  }
}

console.log('✅ StreamingManager loaded');