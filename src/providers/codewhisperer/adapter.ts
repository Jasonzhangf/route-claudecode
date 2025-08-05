/**
 * CodeWhisperer Provider Adapter
 * 将基于demo2的新实现适配到现有的provider系统
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { BaseRequest, BaseResponse, Provider, ProviderConfig } from '@/types';
import { CodeWhispererClient } from './client';
import { AnthropicRequest, createCodeWhispererConfig } from './types';

export class CodeWhispererProvider implements Provider {
  public name: string;
  public type: string;  
  public config: ProviderConfig;
  private client: CodeWhispererClient;
  private providerId: string;

  constructor(providerId: string = 'codewhisperer-demo2') {
    this.providerId = providerId;
    this.name = 'CodeWhisperer (Demo2 Port)';
    this.type = 'codewhisperer';
    const cwConfig = createCodeWhispererConfig();
    this.config = {
      type: 'codewhisperer',
      endpoint: cwConfig.endpoint,
      authentication: {
        type: 'bearer',
      },
      settings: {},
    };
    this.client = new CodeWhispererClient();
    
    logger.info('CodeWhisperer Provider初始化完成 (基于demo2)', {
      providerId: this.providerId,
    });
  }

  /**
   * Provider接口实现 - 健康检查
   */
  async isHealthy(): Promise<boolean> {
    return this.healthCheck();
  }

  /**
   * Provider接口实现 - 发送请求
   */
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    const result = await this.processRequest(request);
    if (!result) {
      throw new Error('CodeWhisperer请求未返回响应');
    }
    return result;
  }

  /**
   * Provider接口实现 - 发送流式请求  
   */
  async* sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
    const events: any[] = [];
    
    await this.processRequest(request, (event: string, data: any) => {
      events.push({ event, data });
    });

    for (const event of events) {
      yield event;
    }
  }

  /**
   * 处理请求 - 适配现有provider接口
   */
  async processRequest(
    request: BaseRequest,
    writeSSE?: (event: string, data: any) => void
  ): Promise<BaseResponse | void> {
    try {
      logger.debug('CodeWhisperer处理请求开始', {
        providerId: this.providerId,
        model: request.model,
        stream: request.stream,
        requestId: request.metadata?.requestId,
      });

      // 转换请求格式
      const anthropicReq = this.convertToAnthropicRequest(request);

      if (request.stream && writeSSE) {
        // 流式请求处理
        await this.client.handleStreamRequest(
          anthropicReq,
          writeSSE,
          (message: string, error: Error) => {
            logger.error('流式请求错误', { message, error: error.message });
            writeSSE('error', {
              type: 'error',
              error: {
                type: 'api_error',
                message: message,
              },
            });
          }
        );
        
        // 流式请求不返回响应对象
        return;
      } else {
        // 非流式请求处理
        const response = await this.client.handleNonStreamRequest(anthropicReq);
        
        // 转换为BaseResponse格式
        const baseResponse: BaseResponse = {
          id: response.id || `cw_${Date.now()}`,
          type: response.type || 'message',
          model: response.model,
          role: response.role,
          content: response.content || [],
          stop_reason: response.stop_reason,
          stop_sequence: response.stop_sequence,
          usage: response.usage,
        };

        logger.debug('CodeWhisperer处理请求完成', {
          providerId: this.providerId,
          responseId: baseResponse.id,
          contentBlocks: baseResponse.content.length,
        });

        return baseResponse;
      }
    } catch (error) {
      logger.error('CodeWhisperer请求处理失败', {
        providerId: this.providerId,
        error: error instanceof Error ? error.message : String(error),
        requestId: request.metadata?.requestId,
      });

      throw error;
    }
  }

  /**
   * 将BaseRequest转换为AnthropicRequest格式
   */
  private convertToAnthropicRequest(request: BaseRequest): AnthropicRequest {
    const anthropicReq: AnthropicRequest = {
      model: request.model,
      max_tokens: request.max_tokens || 32000,
      messages: request.messages as any[], // Type assertion to bypass readonly check
      stream: request.stream || false,
      temperature: request.temperature,
      metadata: request.metadata,
    };

    // 处理system消息
    if (request.metadata?.system) {
      if (typeof request.metadata.system === 'string') {
        (anthropicReq as any).system = [{ type: 'text', text: request.metadata.system }];
      } else if (Array.isArray(request.metadata.system)) {
        (anthropicReq as any).system = request.metadata.system;
      }
    }

    // 处理tools
    const tools = request.tools || request.metadata?.tools;
    if (tools && Array.isArray(tools)) {
      (anthropicReq as any).tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema || tool.parameters || {},
      }));
    }

    logger.debug('请求格式转换完成', {
      originalModel: request.model,
      messageCount: anthropicReq.messages.length,
      hasSystem: !!(anthropicReq.system && anthropicReq.system.length > 0),
      hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      stream: anthropicReq.stream,
    });

    return anthropicReq;
  }

  /**
   * 获取provider信息
   */
  getProviderInfo() {
    return {
      id: this.providerId,
      name: 'CodeWhisperer (Demo2 Port)',
      type: 'anthropic',
      version: '2.0.0-demo2',
      capabilities: {
        streaming: true,
        tools: true,
        system_messages: true,
        conversation_history: true,
      },
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 使用client的healthCheck方法
      const healthResult = await this.client.healthCheck();
      
      logger.debug('CodeWhisperer健康检查', {
        providerId: this.providerId,
        healthy: healthResult.healthy,
        type: healthResult.type,
        implementation: healthResult.implementation,
      });

      return healthResult.healthy;
    } catch (error) {
      logger.warn('CodeWhisperer健康检查失败', {
        providerId: this.providerId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}