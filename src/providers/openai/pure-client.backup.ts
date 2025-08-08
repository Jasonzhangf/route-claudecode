/**
 * Pure OpenAI Client - 纯粹的OpenAI逻辑
 * 只负责与OpenAI API的通信，所有转换逻辑都在transformer中处理
 * 
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getSimpleSessionManager } from '@/session/simple-session-manager';
import { createOpenAITransformer } from '@/transformers/openai';

export interface PureOpenAIConfig extends ProviderConfig {
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * 纯粹的OpenAI客户端 - 只做API调用
 */
export class PureOpenAIClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai-pure';
  public readonly config: PureOpenAIConfig;
  
  private openaiClient: OpenAI;
  private sessionManager: ReturnType<typeof getSimpleSessionManager>;
  private transformer = createOpenAITransformer();

  constructor(config: PureOpenAIConfig, providerId: string) {
    this.name = providerId;
    this.config = config;

    // 初始化OpenAI SDK
    const apiKey = this.extractApiKey(config);
    const baseURL = this.extractBaseURL(config);

    if (!baseURL) {
      throw new Error(`OpenAI provider ${providerId} requires endpoint configuration - violates zero fallback principle`);
    }

    this.openaiClient = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
      timeout: config.sdkOptions?.timeout || 60000,
      maxRetries: config.sdkOptions?.maxRetries || 3,
      defaultHeaders: {
        'User-Agent': 'claude-code-router-pure/2.9.0',
        ...config.sdkOptions?.defaultHeaders
      }
    });

    // 初始化会话管理
    const port = this.extractPortFromConfig(config);
    this.sessionManager = getSimpleSessionManager(port);

    logger.info('Pure OpenAI Client initialized', {
      providerId,
      baseURL,
      hasApiKey: !!apiKey,
      timeout: config.sdkOptions?.timeout || 60000,
      maxRetries: config.sdkOptions?.maxRetries || 3
    });
  }

  /**
   * 🚨 Critical: 验证非流式响应，防止静默失败
   */
  private validateNonStreamingResponse(response: BaseResponse, requestId: string): void {
    if (!response) {
      const error = new Error('Response is null or undefined - silent failure detected');
      console.error(`🚨 [${this.name}] SILENT FAILURE: Null response for ${requestId}`);
      throw error;
    }

    if (!response.content || response.content.length === 0) {
      const error = new Error('Response has no content - potential silent failure');
      console.error(`🚨 [${this.name}] SILENT FAILURE: Empty content for ${requestId}`);
      throw error;
    }

    if (!response.stop_reason) {
      const error = new Error('Response missing stop_reason - potential silent failure');
      console.error(`🚨 [${this.name}] SILENT FAILURE: Missing stop_reason for ${requestId}`);
      throw error;
    }

    // 检查fallback值
    if (response.stop_reason === 'unknown' || response.stop_reason === 'default') {
      const error = new Error(`Response has fallback stop_reason: ${response.stop_reason} - violates zero fallback principle`);
      console.error(`🚨 [${this.name}] FALLBACK VIOLATION: ${response.stop_reason} for ${requestId}`);
      throw error;
    }
  }

  /**
   * 🚨 Critical: 验证流式chunk，防止静默失败
   */
  private validateStreamingChunk(chunk: any, requestId: string, chunkIndex: number): void {
    if (!chunk) {
      const error = new Error(`Streaming chunk ${chunkIndex} is null/undefined - silent failure detected`);
      console.error(`🚨 [${this.name}] STREAMING SILENT FAILURE: Null chunk ${chunkIndex} for ${requestId}`);
      throw error;
    }

    if (!chunk.event) {
      const error = new Error(`Streaming chunk ${chunkIndex} missing event type - malformed chunk`);
      console.error(`🚨 [${this.name}] STREAMING MALFORMED: Missing event in chunk ${chunkIndex} for ${requestId}`);
      throw error;
    }

    // 检查fallback事件类型
    if (chunk.event === 'unknown' || chunk.event === 'default' || chunk.event === 'fallback') {
      const error = new Error(`Streaming chunk has fallback event: ${chunk.event} - violates zero fallback principle`);
      console.error(`🚨 [${this.name}] STREAMING FALLBACK VIOLATION: ${chunk.event} in chunk ${chunkIndex} for ${requestId}`);
      throw error;
    }
  }

  /**
   * 发送非流式请求
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    // 生成会话ID（如果有会话信息）
    let requestId = originalRequestId;
    if (sessionId && conversationId) {
      requestId = this.sessionManager.generateRequestId(sessionId, conversationId, false);
      request.metadata = { ...request.metadata, requestId, originalRequestId };
    }

    try {
      // 🔄 使用transformer转换请求
      const openaiRequest = this.transformer.transformBaseRequestToOpenAI(request);
      
      logger.debug('Sending non-streaming request to OpenAI', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages.length,
        requestId
      }, requestId, 'provider');

      // 🎯 纯粹的OpenAI API调用
      const response = await this.openaiClient.chat.completions.create(openaiRequest);

      // 🔄 使用transformer转换响应
      const baseResponse = this.transformer.transformOpenAIResponseToBase(response, request);

      // 🚨 验证响应，防止静默失败
      this.validateNonStreamingResponse(baseResponse, requestId);

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, baseResponse.stop_reason);
      }

      logger.debug('Non-streaming request completed successfully', {
        stopReason: baseResponse.stop_reason,
        hasTools: baseResponse.content.some((c: any) => c.type === 'tool_use'),
        requestId
      }, requestId, 'provider');

      return baseResponse;

    } catch (error) {
      // 🚨 确保无静默失败
      const httpStatus = (error as any)?.response?.status || (error as any)?.status || 500;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`🚨 [${this.name}] NON-STREAMING REQUEST FAILED - NO SILENT FAILURE:`);
      console.error(`   Request ID: ${requestId}`);
      console.error(`   Status: ${httpStatus}`);
      console.error(`   Error: ${errorMessage}`);
      console.error(`   Provider: ${this.name}`);
      console.error(`   RESULT: Throwing error to client`);

      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      if (error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError(
        `${this.name} request failed: ${errorMessage}`,
        this.name,
        httpStatus,
        error
      );
    }
  }

  /**
   * 发送流式请求
   */
  async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const originalRequestId = request.metadata?.requestId || 'unknown';
    const sessionId = request.metadata?.sessionId;
    const conversationId = request.metadata?.conversationId;

    // 生成会话ID（如果有会话信息）
    let requestId = originalRequestId;
    if (sessionId && conversationId) {
      requestId = this.sessionManager.generateRequestId(sessionId, conversationId, true);
      request.metadata = { ...request.metadata, requestId, originalRequestId };
    }

    let chunkCount = 0;
    let hasValidContent = false;
    let finishReason: string | undefined;

    try {
      // 🔄 使用transformer转换请求
      const openaiRequest = { ...this.transformer.transformBaseRequestToOpenAI(request), stream: true as const };
      
      logger.debug('Sending streaming request to OpenAI', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages.length,
        requestId
      }, requestId, 'provider');

      // 🎯 纯粹的OpenAI API调用
      const stream = await this.openaiClient.chat.completions.create(openaiRequest);

      // 🔄 使用transformer转换流式响应
      for await (const chunk of this.transformer.transformOpenAIStreamToAnthropicSSE(stream as unknown as AsyncIterable<any>, request, requestId)) {
        chunkCount++;

        // 🚨 验证chunk，防止静默失败
        this.validateStreamingChunk(chunk, requestId, chunkCount);

        // 跟踪有效内容
        if (chunk.event === 'content_block_delta' || 
            chunk.event === 'content_block_start' ||
            chunk.event === 'message_start') {
          hasValidContent = true;
        }

        // 提取finish reason
        if (chunk.event === 'message_delta' && chunk.data?.delta?.stop_reason) {
          finishReason = chunk.data.delta.stop_reason;
        }

        yield chunk;
      }

      // 🚨 确保流式请求产生了有效内容
      if (chunkCount === 0) {
        const error = new Error('Streaming request produced no chunks - potential silent failure');
        console.error(`🚨 [${this.name}] STREAMING SILENT FAILURE DETECTED:`);
        console.error(`   Request ID: ${requestId}`);
        console.error(`   Chunks: ${chunkCount}`);
        console.error(`   Valid Content: ${hasValidContent}`);
        console.error(`   RESULT: Throwing error to prevent silent failure`);
        throw error;
      }

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, finishReason || 'stream_end');
      }

      logger.debug('Streaming request completed successfully', {
        chunkCount,
        hasValidContent,
        finishReason,
        requestId
      }, requestId, 'provider');

    } catch (error) {
      // 🚨 确保无静默失败
      console.error(`🚨 [${this.name}] STREAMING REQUEST FAILED - NO SILENT FAILURE:`);
      console.error(`   Request ID: ${requestId}`);
      console.error(`   Chunks Processed: ${chunkCount}`);
      console.error(`   Had Valid Content: ${hasValidContent}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`   Provider: ${this.name}`);
      console.error(`   RESULT: Throwing error to client`);

      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      throw error;
    }
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 简单的健康检查请求
      const testRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user' as const, content: 'test' }],
        max_tokens: 1
      };

      await this.openaiClient.chat.completions.create(testRequest);
      return true;
    } catch (error) {
      logger.warn('OpenAI health check failed', {
        provider: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 提取API Key
   */
  private extractApiKey(config: PureOpenAIConfig): string | undefined {
    const credentials = config.authentication?.credentials;
    if (!credentials) return undefined;

    const apiKey = credentials.apiKey || credentials.api_key;
    return Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }

  /**
   * 提取Base URL
   */
  private extractBaseURL(config: PureOpenAIConfig): string {
    if (!config.endpoint) {
      throw new Error('OpenAI endpoint is required - violates zero fallback principle');
    }
    return config.endpoint;
  }

  /**
   * 提取端口配置
   */
  private extractPortFromConfig(config: PureOpenAIConfig): number {
    // 尝试从endpoint URL提取端口
    try {
      const url = new URL(config.endpoint);
      if (url.port) {
        return parseInt(url.port, 10);
      }
    } catch (error) {
      // URL解析失败，继续其他方法
    }

    // 从环境变量获取
    if (process.env.RCC_PORT) {
      return parseInt(process.env.RCC_PORT, 10);
    }

    // 必须明确配置端口
    throw new Error(`OpenAI provider ${this.name} requires explicit port configuration - violates zero fallback principle`);
  }
}