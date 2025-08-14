/**
 * Messages Request Handler Module
 * 
 * 处理/v1/messages请求的专用处理器
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseRequest, Provider, ProviderError } from '@/types';
import { UnifiedInputProcessor } from '@/input/unified-processor';
import { RoutingEngine } from '@/routing';
import { AnthropicOutputProcessor } from '@/output/anthropic';
import { v4 as uuidv4 } from 'uuid';
import { handleInputError, handleRoutingError, handleProviderError, handleOutputError } from '@/utils/error-handler';
import { StreamingHandler } from './streaming-handler';

export interface MessagesHandlerDependencies {
  inputProcessor: UnifiedInputProcessor;
  routingEngine: RoutingEngine;
  outputProcessor: AnthropicOutputProcessor;
  streamingHandler: StreamingHandler;
  providers: Map<string, Provider>;
  logger: any;
  config: any;
}

export class MessagesHandler {
  constructor(private deps: MessagesHandlerDependencies) {}

  /**
   * 处理/v1/messages请求的主要入口
   */
  async handleMessagesRequest(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const requestId = (request as any).requestId || uuidv4();
    
    try {
      // 1. 输入处理
      const processedInput = await this.processInput(request, reply, requestId);
      
      // 2. 路由处理
      const routingResult = await this.processRouting(processedInput, reply, requestId);
      
      // 3. 判断是否为流式请求
      if (processedInput.stream) {
        return await this.handleStreamingFlow(
          processedInput,
          routingResult.provider,
          reply,
          requestId
        );
      }
      
      // 4. 非流式请求处理
      return await this.handleRegularFlow(
        processedInput,
        routingResult.provider,
        reply,
        requestId
      );
      
    } catch (error) {
      return this.handleRequestError(error, reply, requestId);
    }
  }

  /**
   * 处理输入阶段
   */
  private async processInput(request: FastifyRequest, reply: FastifyReply, requestId: string): Promise<BaseRequest> {
    try {
      this.deps.logger.info('Processing input request', {
        method: request.method,
        url: request.url,
        hasBody: !!request.body
      }, requestId, 'input-processing');
      
      const processedRequest = await this.deps.inputProcessor.process(request.body as any);
      
      // 添加请求元数据
      processedRequest.metadata = {
        ...processedRequest.metadata,
        sessionId: (request.headers['x-session-id'] as string) || requestId,
        conversationId: (request.headers['x-conversation-id'] as string),
        user_id: (request.headers['x-user-id'] as string),
        requestId,
        timestamp: Date.now()
      };
      
      this.deps.logger.debug('Input processing completed', {
        model: processedRequest.model,
        messageCount: processedRequest.messages?.length || 0,
        hasTools: !!processedRequest.tools,
        isStreaming: !!processedRequest.stream
      }, requestId, 'input-processing');
      
      return processedRequest;
      
    } catch (error) {
      this.deps.logger.error('Input processing failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'input-processing');
      
      handleInputError(error, reply, {
        requestId,
        providerId: 'input-processor',
        model: 'unknown'
      });
      
      throw error;
    }
  }

  /**
   * 处理路由阶段
   */
  private async processRouting(
    processedRequest: BaseRequest,
    reply: FastifyReply,
    requestId: string
  ): Promise<{ provider: Provider; providerId: string }> {
    try {
      this.deps.logger.info('Processing routing', {
        requestedModel: processedRequest.model,
        messageCount: processedRequest.messages?.length || 0
      }, requestId, 'routing');
      
      const selectedProviderId = await this.deps.routingEngine.route(processedRequest, requestId);
      const provider = this.findProvider(selectedProviderId, requestId);
      
      // 验证provider可用性
      await this.validateProvider(provider, requestId);
      
      this.deps.logger.info('Routing completed', {
        originalModel: processedRequest.model,
        targetProvider: selectedProviderId,
        targetModel: processedRequest.model
      }, requestId, 'routing');
      
      return { provider, providerId: selectedProviderId };
      
    } catch (error) {
      this.deps.logger.error('Routing failed', {
        error: error instanceof Error ? error.message : String(error),
        requestedModel: processedRequest.model
      }, requestId, 'routing');
      
      handleRoutingError(error, reply, {
        requestId,
        providerId: 'routing-engine',
        model: processedRequest.model
      });
      
      throw error;
    }
  }

  /**
   * 处理流式请求流程
   */
  private async handleStreamingFlow(
    request: BaseRequest,
    provider: Provider,
    reply: FastifyReply,
    requestId: string
  ): Promise<void> {
    this.deps.logger.info('Starting streaming request', {
      provider: provider.name,
      model: request.model
    }, requestId, 'streaming-flow');
    
    return await this.deps.streamingHandler.handleStreamingRequest(
      request,
      provider,
      reply,
      requestId
    );
  }

  /**
   * 处理常规（非流式）请求流程
   */
  private async handleRegularFlow(
    request: BaseRequest,
    provider: Provider,
    reply: FastifyReply,
    requestId: string
  ): Promise<any> {
    try {
      this.deps.logger.info('Starting regular request', {
        provider: provider.name,
        model: request.model
      }, requestId, 'regular-flow');
      
      // 1. 发送Provider请求
      const providerResponse = await this.sendProviderRequest(request, provider, reply, requestId);
      
      console.log(`🔍 [HANDLER-DEBUG] providerResponse after sendProviderRequest:`, {
        hasResponse: !!providerResponse,
        responseKeys: providerResponse ? Object.keys(providerResponse) : [],
        role: providerResponse?.role,
        hasContent: !!providerResponse?.content,
        contentType: Array.isArray(providerResponse?.content) ? 'array' : typeof providerResponse?.content,
        stopReason: providerResponse?.stop_reason,
        model: providerResponse?.model,
        usage: providerResponse?.usage
      });
      
      // 2. 处理输出
      const finalResponse = await this.processOutput(providerResponse, request, reply, requestId);
      
      this.deps.logger.info('Regular request completed', {
        provider: provider.name,
        model: request.model,
        hasResponse: !!finalResponse
      }, requestId, 'regular-flow');
      
      return finalResponse;
      
    } catch (error) {
      throw error; // 让上层统一处理错误
    }
  }

  /**
   * 发送Provider请求
   */
  private async sendProviderRequest(
    request: BaseRequest,
    provider: Provider,
    reply: FastifyReply,
    requestId: string
  ): Promise<any> {
    try {
      this.deps.logger.debug('Sending request to provider', {
        provider: provider.name,
        model: request.model
      }, requestId, 'provider-request');
      
      const response = await provider.sendRequest(request);
      
      this.deps.logger.debug('Provider response received', {
        provider: provider.name,
        hasResponse: !!response
      }, requestId, 'provider-response');
      
      return response;
      
    } catch (error) {
      this.deps.logger.error('Provider request failed', {
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'provider-error');
      
      handleProviderError(error, reply, {
        requestId,
        providerId: provider.name || 'unknown',
        model: request.model
      });
      
      throw error;
    }
  }

  /**
   * 处理输出阶段
   */
  private async processOutput(
    providerResponse: any,
    originalRequest: BaseRequest,
    reply: FastifyReply,
    requestId: string
  ): Promise<any> {
    try {
      this.deps.logger.debug('Processing output', {
        hasProviderResponse: !!providerResponse
      }, requestId, 'output-processing');
      
      const finalResponse = await this.deps.outputProcessor.process(providerResponse, originalRequest);
      
      this.deps.logger.debug('Output processing completed', {
        hasResponse: !!finalResponse
      }, requestId, 'output-processing');
      
      return reply.send(finalResponse);
      
    } catch (error) {
      this.deps.logger.error('Output processing failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'output-processing');
      
      handleOutputError(error, reply, {
        requestId,
        providerId: 'output-processor',
        model: 'unknown'
      });
      
      throw error;
    }
  }

  /**
   * 查找Provider
   */
  private findProvider(providerId: string, requestId: string): Provider {
    const provider = this.deps.providers.get(providerId);
    
    if (!provider) {
      const availableProviders = Array.from(this.deps.providers.keys());
      const error = new Error(
        `Provider '${providerId}' not found. Available providers: ${availableProviders.join(', ')}`
      );
      
      this.deps.logger.error('Provider not found', {
        requestedProviderId: providerId,
        availableProviders
      }, requestId, 'provider-lookup');
      
      throw error;
    }
    
    return provider;
  }

  /**
   * 验证Provider可用性
   */
  private async validateProvider(provider: Provider, requestId: string): Promise<void> {
    try {
      const isHealthy = await provider.isHealthy();
      
      if (!isHealthy) {
        throw new ProviderError(
          `Provider '${provider.name}' is currently unavailable`,
          provider.name || 'unknown',
          503,
          'service_unavailable'
        );
      }
      
    } catch (error) {
      this.deps.logger.warn('Provider health check failed', {
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'provider-validation');
      
      // 对于健康检查失败，我们记录但不阻断请求
      // 让实际的请求来验证provider状态
    }
  }

  /**
   * 处理请求错误
   */
  private handleRequestError(error: any, reply: FastifyReply, requestId: string): any {
    const errorMessage = error instanceof Error ? error.message : 'Request processing failed';
    
    this.deps.logger.error('Messages request failed', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, requestId, 'messages-error');
    
    // 如果回复还没有发送，发送错误响应
    if (!reply.sent) {
      const statusCode = (error as any)?.statusCode || 500;
      const errorType = statusCode >= 500 ? 'internal_server_error' : 'bad_request';
      
      return reply.code(statusCode).send({
        error: {
          type: errorType,
          message: errorMessage
        }
      });
    }
  }
}

/**
 * 创建Messages Handler实例的工厂函数
 */
export function createMessagesHandler(deps: MessagesHandlerDependencies): MessagesHandler {
  return new MessagesHandler(deps);
}