/**
 * Pure OpenAI Client - 纯粹的OpenAI逻辑 (重构版)
 * @deprecated Use UnifiedOpenAIClient instead - this client will be removed in v3.0.0
 * 废弃警告：请使用UnifiedOpenAIClient - 此客户端将在v3.0.0中移除
 * 
 * 只负责与OpenAI API的通信，所有转换逻辑都在transformer中处理
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getSimpleSessionManager } from '@/session/simple-session-manager';
import { 
  validateNonStreamingResponse, 
  handleProviderError,
  isValidContentChunk,
  extractFinishReasonFromChunk
} from '@/utils/response-validation';
import { 
  validateProviderConfig, 
  type ValidatedConfig 
} from '@/utils/config-validation';
import { 
  createPureAPIHandler,
  type PureOpenAIAPIHandler 
} from '@/utils/pure-openai-api-handler';

export interface PureOpenAIConfig extends ProviderConfig {
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * 纯粹的OpenAI客户端 - 只做API调用 (重构版)
 */
export class PureOpenAIClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai-pure';
  public readonly config: PureOpenAIConfig;
  
  private openaiClient: OpenAI;
  private validatedConfig: ValidatedConfig;
  private sessionManager: ReturnType<typeof getSimpleSessionManager>;
  private apiHandler: PureOpenAIAPIHandler;

  constructor(config: PureOpenAIConfig, providerId: string) {
    this.name = providerId;
    this.config = config;
    
    // 🚨 严格配置验证 - 零fallback原则
    this.validatedConfig = validateProviderConfig(config, providerId, config.sdkOptions);

    // 初始化OpenAI SDK
    this.openaiClient = new OpenAI({
      apiKey: this.validatedConfig.apiKey,
      baseURL: this.validatedConfig.baseURL,
      timeout: this.validatedConfig.sdkOptions.timeout,
      maxRetries: this.validatedConfig.sdkOptions.maxRetries,
      defaultHeaders: this.validatedConfig.sdkOptions.defaultHeaders
    });

    // 初始化会话管理
    this.sessionManager = getSimpleSessionManager(this.validatedConfig.port);
    
    // 初始化纯净API处理器（无transformer耦合）
    this.apiHandler = createPureAPIHandler({
      providerName: this.name,
      openaiClient: this.openaiClient
    });

    logger.info('Pure OpenAI Client initialized', {
      providerId,
      baseURL: this.validatedConfig.baseURL,
      hasApiKey: true,
      port: this.validatedConfig.port,
      timeout: this.validatedConfig.sdkOptions.timeout,
      maxRetries: this.validatedConfig.sdkOptions.maxRetries
    });
  }

  /**
   * 发送非流式请求 - 使用统一API处理器
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
      // 🎯 预期 request.metadata.openaiRequest 包含已转换的OpenAI格式
      const openaiRequest = request.metadata?.openaiRequest || this.extractOpenAIFormat(request);
      
      // 纯净的OpenAI API调用，不做任何转换
      const rawResponse = await this.apiHandler.callAPI(openaiRequest, requestId);
      
      // 简单包装为BaseResponse格式，详细转换由外部Transformer处理
      const baseResponse = this.wrapResponse(rawResponse, requestId);

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, baseResponse.stop_reason);
      }

      return baseResponse;

    } catch (error) {
      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      // 🚨 统一错误处理，确保无静默失败
      handleProviderError(error, requestId, this.name, 'non-streaming');
    }
  }

  /**
   * 发送流式请求 - 基于非流式API的流式模拟
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

    try {
      // 🎯 预期 request.metadata.openaiRequest 包含已转换的OpenAI格式
      const openaiRequest = request.metadata?.openaiRequest || this.extractOpenAIFormat(request);
      
      // 直接使用纯净的OpenAI流式 API
      let finalResponse: any = null;
      
      for await (const chunk of this.apiHandler.callStreamingAPI(openaiRequest, requestId)) {
        // 直接传递OpenAI原始 chunk，转换由外部处理
        yield chunk;
        
        // 记录最后的chunk用于会话管理
        if (chunk.choices && chunk.choices[0]?.finish_reason) {
          finalResponse = { stop_reason: chunk.choices[0].finish_reason };
        }
      }

      // 标记会话完成
      if (sessionId && conversationId && finalResponse) {
        this.sessionManager.completeRequest(requestId, finalResponse.stop_reason);
      }

      logger.debug('Pure OpenAI streaming completed', {
        requestId,
        provider: this.name
      }, requestId, 'provider');

    } catch (error) {
      // 标记会话失败
      if (sessionId && conversationId) {
        this.sessionManager.failRequest(requestId, error);
      }

      // 🚨 统一错误处理，确保无静默失败
      handleProviderError(error, requestId, this.name, 'streaming');
    }
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 简单的健康检查请求
      const testRequest = {
        model: this.validatedConfig.defaultModel,
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
   * 从 BaseRequest 提取 OpenAI 格式（备用方法）
   * 预期外部 Transformer 已完成转换，这里只是简单提取
   */
  private extractOpenAIFormat(request: BaseRequest): any {
    return {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: (request as any).top_p,
      tools: request.metadata?.tools,
      tool_choice: request.metadata?.tool_choice,
      stream: request.stream
    };
  }

  /**
   * 包装原始 OpenAI 响应为 BaseResponse 格式
   * 最小包装，详细转换由外部 Transformer 处理
   */
  private wrapResponse(rawResponse: any, requestId: string): BaseResponse {
    return {
      id: rawResponse.id || `provider-${Date.now()}`,
      model: rawResponse.model,
      role: 'assistant',
      content: rawResponse.choices?.[0]?.message?.content ? 
        [{ type: 'text', text: rawResponse.choices[0].message.content }] : [],
      stop_reason: rawResponse.choices?.[0]?.finish_reason || 'unknown',
      usage: rawResponse.usage,
      metadata: {
        requestId,
        provider: this.name,
        rawResponse // 保留原始响应供外部转换使用
      }
    };
  }
}

/**
 * 创建Pure OpenAI客户端 - 重构后的简化版本
 */
export function createPureOpenAIClient(config: PureOpenAIConfig, providerId: string): PureOpenAIClient {
  return new PureOpenAIClient(config, providerId);
}