/**
 * Unified OpenAI Client - 统一OpenAI客户端实现
 * 项目所有者: Jason Zhang
 * 
 * 合并Pure Client和SDK Client的功能，消除重复代码
 * 遵循零硬编码、零Fallback、零沉默失败原则
 * 符合六层清晰架构：Provider只做API调用，所有转换在Transformer层
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse, Provider, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { getSimpleSessionManager } from '@/session/simple-session-manager';
import { 
  validateNonStreamingResponse, 
  handleProviderError 
} from '@/utils/response-validation';
import { 
  validateProviderConfig, 
  type ValidatedConfig 
} from '@/utils/config-validation';

export interface UnifiedOpenAIConfig extends ProviderConfig {
  clientType?: 'sdk' | 'pure';
  sdkOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

/**
 * 统一OpenAI客户端 - 合并重复实现
 * 基于项目记忆中的成功重构经验
 */
export class UnifiedOpenAIClient implements Provider {
  public readonly name: string;
  public readonly type = 'openai-unified';
  public readonly config: UnifiedOpenAIConfig;
  
  private openaiClient: OpenAI;
  private validatedConfig: ValidatedConfig;
  private sessionManager: ReturnType<typeof getSimpleSessionManager>;

  constructor(config: UnifiedOpenAIConfig, providerId: string) {
    this.name = providerId;
    this.config = config;
    
    // 🚨 严格配置验证 - 零fallback原则
    this.validatedConfig = validateProviderConfig(config, providerId, config.sdkOptions);

    // 初始化统一OpenAI客户端
    this.openaiClient = new OpenAI({
      apiKey: this.validatedConfig.apiKey,
      baseURL: this.validatedConfig.baseURL,
      timeout: this.validatedConfig.sdkOptions.timeout,
      maxRetries: this.validatedConfig.sdkOptions.maxRetries,
      defaultHeaders: this.validatedConfig.sdkOptions.defaultHeaders
    });

    // 初始化会话管理
    this.sessionManager = getSimpleSessionManager(this.validatedConfig.port);

    logger.info('Unified OpenAI Client initialized', {
      providerId,
      baseURL: this.validatedConfig.baseURL,
      hasApiKey: true,
      port: this.validatedConfig.port,
      clientType: config.clientType || 'unified',
      architecture: 'six-layer-clean'
    });
  }

  /**
   * 🎯 发送非流式请求 - 统一实现
   * 假设request.metadata.openaiRequest包含已转换的OpenAI格式请求
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
      // 🔍 从metadata中获取已转换的OpenAI请求
      const openaiRequest = request.metadata?.openaiRequest;
      if (!openaiRequest) {
        throw new Error('Missing openaiRequest in metadata - transformer step required');
      }

      logger.debug('Unified OpenAI API call', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages?.length || 0,
        requestId,
        provider: this.name
      });

      // 🎯 纯粹的API调用，不做转换
      const response = await this.openaiClient.chat.completions.create(openaiRequest);
      
      // 🔄 包装为BaseResponse格式进行验证
      const baseResponse = this.wrapResponse(response, requestId);
      
      // 🚨 严格响应验证
      validateNonStreamingResponse(baseResponse, requestId, this.name);

      logger.debug('Unified OpenAI API response received', {
        responseId: response.id,
        model: response.model,
        hasChoices: !!(response.choices && response.choices.length > 0),
        finishReason: response.choices?.[0]?.finish_reason,
        requestId,
        provider: this.name
      });

      // 🔄 返回包装后的BaseResponse，保留原始响应在metadata中
      baseResponse.metadata = {
        ...baseResponse.metadata,
        openaiResponse: response,
        providerId: this.name,
        responseId: response.id
      };

      return baseResponse;

    } catch (error) {
      logger.error('Unified OpenAI API call failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name,
        requestId
      });

      throw handleProviderError(error, requestId, this.name, 'non-streaming');
    }
  }

  /**
   * 🎯 发送流式请求 - 统一实现
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
      // 🔍 从metadata中获取已转换的OpenAI请求
      const openaiRequest = request.metadata?.openaiRequest;
      if (!openaiRequest) {
        throw new Error('Missing openaiRequest in metadata - transformer step required');
      }

      // 确保流式标志
      openaiRequest.stream = true;

      logger.debug('Unified OpenAI streaming API call', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        requestId,
        provider: this.name
      });

      // 🎯 纯粹的流式API调用
      const streamingRequest = { ...openaiRequest, stream: true };
      const stream = await this.openaiClient.chat.completions.create(streamingRequest) as any;

      for await (const chunk of stream) {
        // 🔄 将原始chunk放入metadata，由transformer处理转换
        const chunkWithMetadata = {
          ...request,
          metadata: {
            ...request.metadata,
            openaiChunk: chunk,
            providerId: this.name,
            chunkId: chunk.id
          }
        };

        yield chunkWithMetadata;
      }

      logger.debug('Unified OpenAI streaming API completed', {
        requestId,
        provider: this.name
      });

    } catch (error) {
      logger.error('Unified OpenAI streaming API failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.name,
        requestId
      });

      throw handleProviderError(error, requestId, this.name, 'streaming');
    }
  }

  /**
   * 🔧 健康检查 - 统一实现
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.validatedConfig.defaultModel,
        messages: [{ role: 'user', content: 'health check' }],
        max_tokens: 1,
        temperature: 0
      });

      const isHealthy = !!(response?.choices?.[0]);
      
      logger.debug('Health check completed', {
        provider: this.name,
        healthy: isHealthy,
        model: this.validatedConfig.defaultModel
      });

      return isHealthy;
    } catch (error) {
      logger.warn('Health check failed', {
        provider: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🎯 获取支持的模型 - 统一实现
   */
  async getSupportedModels(): Promise<string[]> {
    // 从原始配置中返回支持的模型，不硬编码
    if (Array.isArray(this.config.models)) {
      return this.config.models;
    }
    
    // 默认返回配置的默认模型
    return this.config.defaultModel ? [this.config.defaultModel] : [];
  }

  /**
   * 🔄 包装原始响应为BaseResponse格式
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
 * 🎯 工厂函数：创建统一OpenAI客户端
 */
export function createUnifiedOpenAIClient(
  config: UnifiedOpenAIConfig, 
  providerId: string
): UnifiedOpenAIClient {
  return new UnifiedOpenAIClient(config, providerId);
}