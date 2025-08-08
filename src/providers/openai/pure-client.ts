/**
 * Pure OpenAI Client - 纯粹的OpenAI逻辑 (重构版)
 * 只负责与OpenAI API的通信，所有转换逻辑都在transformer中处理
 * 
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getSimpleSessionManager } from '@/session/simple-session-manager';
import { createOpenAITransformer } from '@/transformers/openai';
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
  createAPIHandler,
  StreamingSimulator,
  type OpenAIStreamingHandler 
} from '@/utils/openai-streaming-handler';

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
  private transformer = createOpenAITransformer();
  private apiHandler: OpenAIStreamingHandler;

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
    
    // 初始化API处理器（统一非流式调用）
    this.apiHandler = createAPIHandler({
      providerName: this.name,
      openaiClient: this.openaiClient,
      transformer: this.transformer
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
      // 🎯 统一使用非流式API调用（所有转换在transformer中完成）
      const baseResponse = await this.apiHandler.callAPI(request);

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
      // 🎯 1. 统一使用非流式API调用（所有转换在transformer中完成）
      const baseResponse = await this.apiHandler.callAPI(request);

      // 🎯 2. 将非流式响应转换为流式事件序列
      for (const chunk of StreamingSimulator.simulateStreamingResponse(baseResponse, requestId)) {
        yield chunk;
      }

      // 标记会话完成
      if (sessionId && conversationId) {
        this.sessionManager.completeRequest(requestId, baseResponse.stop_reason);
      }

      logger.debug('Streaming simulation completed successfully', {
        stopReason: baseResponse.stop_reason,
        hasTools: baseResponse.content.some((c: any) => c.type === 'tool_use'),
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
}

/**
 * 创建Pure OpenAI客户端 - 重构后的简化版本
 */
export function createPureOpenAIClient(config: PureOpenAIConfig, providerId: string): PureOpenAIClient {
  return new PureOpenAIClient(config, providerId);
}