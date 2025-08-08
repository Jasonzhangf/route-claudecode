/**
 * 统一流式处理基类
 * 消除重复的流式处理逻辑
 * 
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { validateStreamingChunk } from './response-validation';

export interface StreamingHandlerOptions {
  providerName: string;
  sessionManager?: any; // 会话管理器接口
  enableValidation?: boolean;
  allowedEvents?: string[];
}

export interface StreamingMetrics {
  chunkCount: number;
  hasValidContent: boolean;
  finishReason?: string;
  startTime: number;
  endTime?: number;
}

/**
 * 基础流式处理器
 * 提供统一的流式请求处理框架
 */
export abstract class BaseStreamingHandler {
  protected readonly options: StreamingHandlerOptions;
  protected metrics: StreamingMetrics;

  constructor(options: StreamingHandlerOptions) {
    this.options = {
      enableValidation: true,
      ...options
    };
    this.metrics = {
      chunkCount: 0,
      hasValidContent: false,
      startTime: Date.now()
    };
  }

  /**
   * 主要的流式处理方法
   */
  async *handleStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    this.resetMetrics();

    // 生成会话ID（如果有会话信息）
    let trackingRequestId = requestId;
    if (sessionId && conversationId && this.options.sessionManager) {
      trackingRequestId = this.options.sessionManager.generateRequestId(sessionId, conversationId, true);
      request.metadata = { ...request.metadata, requestId: trackingRequestId, originalRequestId: requestId };
    }

    logger.debug(`Processing streaming request with ${this.options.providerName}`, {
      originalRequestId: requestId,
      requestId: trackingRequestId,
      sessionId,
      conversationId,
      provider: this.options.providerName
    }, trackingRequestId, 'provider');

    try {
      // 调用具体的流式处理实现
      for await (const chunk of this.processStream(request)) {
        this.metrics.chunkCount++;
        
        // 🚨 验证chunk（如果启用）
        if (this.options.enableValidation) {
          this.validateChunk(chunk, trackingRequestId);
        }
        
        // 跟踪有效内容
        if (this.isValidContentChunk(chunk)) {
          this.metrics.hasValidContent = true;
        }
        
        // 提取finish reason
        const finishReason = this.extractFinishReason(chunk);
        if (finishReason) {
          this.metrics.finishReason = finishReason;
        }
        
        yield chunk;
      }
      
      this.metrics.endTime = Date.now();
      
      // 🚨 验证整体流式输出
      if (this.options.enableValidation) {
        this.validateStreamOutput(trackingRequestId);
      }
      
      // 标记会话完成
      if (sessionId && conversationId && this.options.sessionManager) {
        this.options.sessionManager.completeRequest(
          trackingRequestId,
          this.metrics.finishReason || 'stream_end'
        );
      }
      
      logger.debug('Streaming request completed successfully', {
        chunkCount: this.metrics.chunkCount,
        hasValidContent: this.metrics.hasValidContent,
        finishReason: this.metrics.finishReason,
        duration: this.metrics.endTime - this.metrics.startTime,
        requestId: trackingRequestId
      }, trackingRequestId, 'provider');

    } catch (error) {
      this.metrics.endTime = Date.now();
      
      // 🚨 确保无静默失败
      this.logStreamingError(error, trackingRequestId);
      
      // 标记会话失败
      if (sessionId && conversationId && this.options.sessionManager) {
        this.options.sessionManager.failRequest(trackingRequestId, error);
      }
      
      throw error;
    }
  }

  /**
   * 非流式请求处理（通过流式实现）
   */
  async handleNonStreamRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug(`Converting non-streaming request to streaming for ${this.options.providerName}`, {
      requestId,
      provider: this.options.providerName
    }, requestId, 'provider');

    // 🎯 通过流式响应收集完整响应
    const chunks: any[] = [];
    let finalResponse: BaseResponse | null = null;

    try {
      for await (const chunk of this.handleStreamRequest(request)) {
        chunks.push(chunk);
        
        // 收集完整响应
        if (this.isStreamEndChunk(chunk)) {
          finalResponse = await this.buildCompleteResponseFromStream(chunks, request);
          break;
        }
      }

      if (!finalResponse) {
        throw new Error('Failed to build complete response from stream');
      }

      logger.debug('Successfully converted streaming response to complete response', {
        requestId,
        chunks: chunks.length,
        stopReason: finalResponse.stop_reason
      }, requestId, 'provider');

      return finalResponse;

    } catch (error) {
      logger.error(`${this.options.providerName} non-streaming request failed`, {
        error: error instanceof Error ? error.message : String(error),
        provider: this.options.providerName,
        requestId
      }, requestId, 'provider');
      throw error;
    }
  }

  /**
   * 抽象方法：具体的流式处理实现
   */
  protected abstract processStream(request: BaseRequest): AsyncIterable<any>;

  /**
   * 抽象方法：从流式响应构建完整响应
   */
  protected abstract buildCompleteResponseFromStream(chunks: any[], originalRequest: BaseRequest): Promise<BaseResponse>;

  /**
   * 抽象方法：判断是否为有效内容chunk
   */
  protected abstract isValidContentChunk(chunk: any): boolean;

  /**
   * 抽象方法：判断是否为流结束chunk
   */
  protected abstract isStreamEndChunk(chunk: any): boolean;

  /**
   * 抽象方法：提取finish reason
   */
  protected abstract extractFinishReason(chunk: any): string | undefined;

  /**
   * 重置指标
   */
  protected resetMetrics(): void {
    this.metrics = {
      chunkCount: 0,
      hasValidContent: false,
      startTime: Date.now()
    };
  }

  /**
   * 验证单个chunk
   */
  protected validateChunk(chunk: any, requestId: string): void {
    validateStreamingChunk(
      chunk, 
      requestId, 
      this.options.providerName,
      this.metrics.chunkCount
    );
  }

  /**
   * 验证整体流式输出
   */
  protected validateStreamOutput(requestId: string): void {
    // 简化验证逻辑
    if (this.metrics.chunkCount === 0) {
      logger.warn('Streaming completed with no chunks received', {
        requestId,
        providerName: this.options.providerName
      });
    }
  }

  /**
   * 记录流式错误
   */
  protected logStreamingError(error: unknown, requestId: string): void {
    console.error(`🚨 [${this.options.providerName}] STREAMING REQUEST FAILED - NO SILENT FAILURE:`);
    console.error(`   Request ID: ${requestId}`);
    console.error(`   Chunks Processed: ${this.metrics.chunkCount}`);
    console.error(`   Had Valid Content: ${this.metrics.hasValidContent}`);
    console.error(`   Duration: ${this.metrics.endTime ? this.metrics.endTime - this.metrics.startTime : 'unknown'}ms`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`   Provider: ${this.options.providerName}`);
    console.error(`   RESULT: Throwing error to client`);
  }

  /**
   * 获取当前指标
   */
  getMetrics(): Readonly<StreamingMetrics> {
    return { ...this.metrics };
  }
}

/**
 * OpenAI专用流式处理器
 */
export class OpenAIStreamingHandler extends BaseStreamingHandler {
  private openaiClient: any;
  private transformer: any;

  constructor(options: StreamingHandlerOptions, openaiClient: any, transformer: any) {
    super(options);
    this.openaiClient = openaiClient;
    this.transformer = transformer;
  }

  protected async *processStream(request: BaseRequest): AsyncIterable<any> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      // 🔄 使用transformer转换请求
      const openaiRequest = { 
        ...this.transformer.transformBaseRequestToOpenAI(request), 
        stream: true as const 
      };
      
      logger.debug('Sending streaming request to OpenAI', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages.length,
        requestId
      }, requestId, 'provider');

      // 🎯 纯粹的OpenAI API调用
      const stream = await this.openaiClient.chat.completions.create(openaiRequest);

      // 🔄 使用transformer转换流式响应
      for await (const chunk of this.transformer.transformOpenAIStreamToAnthropicSSE(stream, request, requestId)) {
        yield chunk;
      }

    } catch (error) {
      logger.error('OpenAI streaming request failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.options.providerName,
        model: request.model
      }, requestId, 'provider');
      throw error;
    }
  }

  protected async buildCompleteResponseFromStream(chunks: any[], originalRequest: BaseRequest): Promise<BaseResponse> {
    // 这里可以调用transformer的方法来构建完整响应
    // 具体实现可以复用transformer中的逻辑
    throw new Error('buildCompleteResponseFromStream not implemented for OpenAI - should use transformer');
  }

  protected isValidContentChunk(chunk: any): boolean {
    return !!(chunk?.event === 'content_block_delta' || 
             chunk?.event === 'content_block_start' ||
             chunk?.event === 'message_start');
  }

  protected isStreamEndChunk(chunk: any): boolean {
    return chunk?.event === 'message_stop' || 
           (chunk?.event === 'message_delta' && chunk?.data?.delta?.stop_reason);
  }

  protected extractFinishReason(chunk: any): string | undefined {
    if (chunk?.event === 'message_delta' && chunk?.data?.delta?.stop_reason) {
      return chunk.data.delta.stop_reason;
    }
    return undefined;
  }
}