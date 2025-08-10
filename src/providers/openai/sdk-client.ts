/**
 * OpenAI SDK Client - 并行模块
 * 使用官方OpenAI SDK实现，提供平滑切换选项
 * 
 * 设计目标:
 * 1. 使用官方OpenAI SDK
 * 2. 保持与enhanced-client相同的接口
 * 3. 支持平滑切换
 * 4. 集成竞态控制系统
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

export interface OpenAISDKConfig extends ProviderConfig {
  // 扩展配置选项
  useOfficialSDK?: boolean;
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * OpenAI SDK客户端 - 官方SDK实现
 */
export class OpenAISDKClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai-sdk';
  public readonly config: OpenAISDKConfig;
  
  protected openaiClient: OpenAI;
  private validatedConfig: ValidatedConfig;
  private sessionManager: ReturnType<typeof getSimpleSessionManager>;
  private apiHandler: PureOpenAIAPIHandler;

  constructor(config: OpenAISDKConfig, providerId: string) {
    this.name = providerId;
    this.config = config;
    
    // 🚨 严格配置验证 - 零fallback原则
    this.validatedConfig = validateProviderConfig(config, providerId, config.sdkOptions);

    // 初始化官方OpenAI SDK
    this.openaiClient = new OpenAI({
      apiKey: this.validatedConfig.apiKey,
      baseURL: this.validatedConfig.baseURL,
      timeout: this.validatedConfig.sdkOptions.timeout,
      maxRetries: this.validatedConfig.sdkOptions.maxRetries,
      defaultHeaders: this.validatedConfig.sdkOptions.defaultHeaders
    });

    // 初始化会话管理系统
    this.sessionManager = getSimpleSessionManager(this.validatedConfig.port);
    
    // 初始化纯净API处理器（无transformer耦合）
    this.apiHandler = createPureAPIHandler({
      providerName: this.name,
      openaiClient: this.openaiClient
    });

    logger.info('OpenAI SDK Client initialized', {
      providerId,
      baseURL: this.validatedConfig.baseURL,
      hasApiKey: true,
      port: this.validatedConfig.port,
      defaultModel: this.validatedConfig.defaultModel,
      timeout: this.validatedConfig.sdkOptions.timeout,
      maxRetries: this.validatedConfig.sdkOptions.maxRetries,
      sessionTracking: true
    });
  }

  // 配置提取方法已移至统一验证模块

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      // 使用官方SDK进行健康检查
      const response = await this.openaiClient.chat.completions.create({
        model: this.validatedConfig.defaultModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return !!response.id;
    } catch (error) {
      logger.warn('OpenAI SDK health check failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name
      });
      return false;
    }
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

      logger.debug('Pure OpenAI SDK streaming completed', {
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
 * 创建OpenAI SDK客户端 - 重构后的简化版本
 */
export function createOpenAISDKClient(config: OpenAISDKConfig, providerId: string): OpenAISDKClient {
  return new OpenAISDKClient(config, providerId);
}