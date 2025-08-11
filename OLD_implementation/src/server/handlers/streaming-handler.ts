/**
 * Streaming Request Handler Module
 * 
 * 处理流式请求的专用处理器
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { FastifyReply } from 'fastify';
import { BaseRequest, Provider } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ResponsePipeline } from '@/pipeline/response-pipeline';
import { getUnifiedPatchPreprocessor } from '@/preprocessing/unified-patch-preprocessor';
import { handleStreamingError, UnifiedErrorHandler } from '@/utils/error-handler';

export interface StreamingHandlerDependencies {
  logger: any;
  responsePipeline: ResponsePipeline;
  unifiedPreprocessor: ReturnType<typeof getUnifiedPatchPreprocessor>;
  config: {
    debug: {
      enabled: boolean;
    };
    server: {
      port: number;
    };
  };
}

export class StreamingHandler {
  constructor(private deps: StreamingHandlerDependencies) {}

  /**
   * 处理流式请求的主要入口
   */
  async handleStreamingRequest(
    request: BaseRequest,
    provider: Provider,
    reply: FastifyReply,
    requestId: string
  ): Promise<void> {
    let outputTokens = 0;
    let chunkCount = 0;
    let streamInitialized = false;
    
    try {
      // 1. 验证流式响应
      const streamValidation = await this.validateStreamResponse(provider, request);
      
      // 2. 初始化流式响应
      this.initializeStreamResponse(reply);
      streamInitialized = true;
      
      // 3. 发送message_start事件
      const messageId = await this.sendMessageStart(reply, request, requestId);
      
      // 4. 处理流式数据
      const streamStats = await this.processStreamData(
        streamValidation.streamIterator,
        streamValidation.firstChunk,
        reply,
        request,
        provider,
        requestId,
        messageId
      );
      
      outputTokens = streamStats.outputTokens;
      chunkCount = streamStats.chunkCount;
      
      // 5. 完成流式响应
      await this.finalizeStreamResponse(reply, outputTokens, requestId);
      
    } catch (error) {
      await this.handleStreamingError(error, reply, provider, request, requestId, {
        outputTokens,
        chunkCount,
        streamInitialized
      });
    }
  }

  /**
   * 验证流式响应的有效性
   */
  private async validateStreamResponse(provider: Provider, request: BaseRequest) {
    const streamIterable = provider.sendStreamRequest(request);
    const streamIterator = streamIterable[Symbol.asyncIterator]();
    const firstChunk = await streamIterator.next();
    
    if (firstChunk.done && !firstChunk.value) {
      throw new Error('Streaming request failed: No valid response from provider');
    }
    
    return {
      streamIterator,
      firstChunk
    };
  }

  /**
   * 初始化流式响应头
   */
  private initializeStreamResponse(reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
  }

  /**
   * 发送message_start事件
   */
  private async sendMessageStart(
    reply: FastifyReply,
    request: BaseRequest,
    requestId: string
  ): Promise<string> {
    const messageId = `msg_${Date.now()}`;
    const modelForStreaming = request.metadata?.originalModel || request.model;
    
    this.deps.logger.debug('Streaming message start', {
      originalRequestModel: request.model,
      originalModelFromMetadata: request.metadata?.originalModel,
      targetModel: request.metadata?.targetModel,
      modelForStreaming,
      hasOriginalModel: !!request.metadata?.originalModel
    }, requestId, 'streaming');
    
    this.sendSSEEvent(reply, 'message_start', {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: modelForStreaming,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      }
    });
    
    return messageId;
  }

  /**
   * 处理流式数据的核心逻辑
   */
  private async processStreamData(
    streamIterator: AsyncIterator<any>,
    firstChunk: any,
    reply: FastifyReply,
    request: BaseRequest,
    provider: Provider,
    requestId: string,
    messageId: string
  ): Promise<{ outputTokens: number; chunkCount: number; hasToolUse: boolean }> {
    let outputTokens = 0;
    let chunkCount = 0;
    let hasToolUse = false;
    let currentChunk = firstChunk.value;
    let isDone = firstChunk.done;

    // 处理第一个块
    if (currentChunk) {
      await this.processChunk(currentChunk, reply, request, provider, requestId);
      chunkCount++;
    }

    // 处理后续数据块
    while (!isDone && currentChunk) {
      const processedResult = await this.processChunk(
        currentChunk,
        reply,
        request,
        provider,
        requestId
      );
      
      if (processedResult.hasToolUse) {
        hasToolUse = true;
      }
      
      outputTokens += processedResult.tokens;
      chunkCount++;
      
      const nextResult = await streamIterator.next();
      currentChunk = nextResult.value;
      isDone = nextResult.done;
    }

    return { outputTokens, chunkCount, hasToolUse };
  }

  /**
   * 处理单个数据块
   */
  private async processChunk(
    chunk: any,
    reply: FastifyReply,
    request: BaseRequest,
    provider: Provider,
    requestId: string
  ): Promise<{ tokens: number; hasToolUse: boolean }> {
    try {
      // 应用统一预处理
      const preprocessedChunk = await this.deps.unifiedPreprocessor.preprocessStreaming(
        chunk,
        provider as any,
        request.model,
        requestId
      );
      
      // 应用响应流水线处理
      let processedChunk = preprocessedChunk;
      if (preprocessedChunk.data) {
        const pipelineContext = {
          provider: provider.name || 'unknown',
          model: request.model,
          requestId,
          isStreaming: true,
          timestamp: Date.now()
        };
        
        const processedData = await this.deps.responsePipeline.process(
          preprocessedChunk.data,
          pipelineContext
        );
        processedChunk = { ...preprocessedChunk, data: processedData };
      }
      
      // 处理停止信号和工具调用
      const chunkResult = this.handleChunkEvents(processedChunk, reply, provider, request, requestId);
      
      // 计算token数量
      const tokens = this.calculateChunkTokens(processedChunk);
      
      return {
        tokens,
        hasToolUse: chunkResult.hasToolUse
      };
      
    } catch (error) {
      this.deps.logger.warn('Chunk processing failed, using original', {
        error: error instanceof Error ? error.message : String(error),
        chunkEvent: chunk.event
      }, requestId, 'streaming-chunk');
      
      this.sendSSEEvent(reply, chunk.event, chunk.data);
      return { tokens: 0, hasToolUse: false };
    }
  }

  /**
   * 处理块事件（停止信号、工具调用等）
   */
  private handleChunkEvents(
    chunk: any,
    reply: FastifyReply,
    provider: Provider,
    request: BaseRequest,
    requestId: string
  ): { hasToolUse: boolean } {
    let hasToolUse = false;

    if (chunk.event === 'message_delta' && chunk.data?.delta?.stop_reason) {
      const stopReason = chunk.data.delta.stop_reason;
      const isToolUse = stopReason === 'tool_use';
      
      if (isToolUse) {
        hasToolUse = true;
        this.sendSSEEvent(reply, chunk.event, chunk.data);
        this.deps.logger.logFinishReason?.(stopReason, {
          provider: provider.name,
          model: request.model,
          responseType: 'streaming',
          action: 'preserved-for-continuation'
        }, requestId, 'streaming-tool-use');
      } else {
        // 移除非工具调用的stop_reason
        const filteredData = { ...chunk.data };
        if (filteredData.delta) {
          filteredData.delta = { ...filteredData.delta };
          delete filteredData.delta.stop_reason;
          delete filteredData.delta.stop_sequence;
        }
        this.sendSSEEvent(reply, chunk.event, filteredData);
      }
    } else if (chunk.event === 'message_stop') {
      // 🔧 修复：始终发送message_stop事件，不再进行条件过滤
      this.sendSSEEvent(reply, chunk.event, chunk.data);
    } else {
      // 正常转发其他事件
      this.sendSSEEvent(reply, chunk.event, chunk.data);
    }

    return { hasToolUse };
  }

  /**
   * 计算数据块的token数量
   */
  private calculateChunkTokens(chunk: any): number {
    let tokens = 0;
    
    if (chunk.event === 'content_block_delta') {
      if (chunk.data?.delta?.text) {
        tokens += Math.ceil(chunk.data.delta.text.length / 4);
      } else if (chunk.data?.delta?.partial_json) {
        tokens += Math.ceil(chunk.data.delta.partial_json.length / 4);
      }
    } else if (chunk.event === 'content_block_start' && chunk.data?.content_block?.name) {
      tokens += Math.ceil(chunk.data.content_block.name.length / 4);
    }
    
    return tokens;
  }

  /**
   * 完成流式响应
   */
  private async finalizeStreamResponse(
    reply: FastifyReply,
    outputTokens: number,
    requestId: string
  ): Promise<void> {
    // 发送content_block_stop事件
    this.sendSSEEvent(reply, 'content_block_stop', {
      type: 'content_block_stop',
      index: 0
    });

    // 发送usage信息（不包含停止信号）
    this.sendSSEEvent(reply, 'message_delta', {
      type: 'message_delta',
      delta: {},
      usage: {
        output_tokens: outputTokens
      }
    });

    // 结束HTTP连接
    reply.raw.end();
    
    this.deps.logger.debug('Streaming request completed', {
      outputTokens
    }, requestId, 'streaming-finalize');
  }

  /**
   * 处理流式错误
   */
  private async handleStreamingError(
    error: any,
    reply: FastifyReply,
    provider: Provider,
    request: BaseRequest,
    requestId: string,
    context: {
      outputTokens: number;
      chunkCount: number;
      streamInitialized: boolean;
    }
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Stream processing failed';
    const providerName = provider.name || 'unknown';
    const modelName = request.metadata?.targetModel || request.model || 'unknown';
    
    // 详细错误日志
    this.deps.logger.error('Streaming request failed', {
      requestId,
      provider: providerName,
      model: modelName,
      error: errorMessage,
      chunkCount: context.chunkCount,
      outputTokens: context.outputTokens,
      streamInitialized: context.streamInitialized
    }, requestId, 'streaming-error');
    
    // 使用统一错误处理
    handleStreamingError(error, reply, {
      requestId,
      providerId: providerName,
      model: modelName
    });
    
    // 验证错误处理
    UnifiedErrorHandler.validateErrorHandling(error, reply, {
      requestId,
      providerId: providerName,
      model: modelName,
      stage: 'streaming',
      isStreaming: true
    });
  }

  /**
   * 发送SSE事件
   */
  private sendSSEEvent(reply: FastifyReply, event: string, data: any): void {
    const eventData = JSON.stringify(data);
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${eventData}\n\n`);
  }
}

/**
 * 创建Streaming Handler实例的工厂函数
 */
export function createStreamingHandler(deps: StreamingHandlerDependencies): StreamingHandler {
  return new StreamingHandler(deps);
}