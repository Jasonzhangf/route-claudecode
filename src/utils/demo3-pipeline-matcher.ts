/**
 * Demo3流水线数据匹配器 - 完整流程一致性保证
 * 确保从输入到输出的每个环节都与Demo3 AIClient-2-API保持一致
 * 项目所有者: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { demo3DataMatcher, Demo3RequestFormat, Demo3ResponseFormat } from './demo3-data-matcher';

export interface Demo3PipelineConfig {
  // Demo3特有配置
  endpoint: string;
  authHeaderName: 'x-api-key' | 'Authorization';
  authHeaderValue: string;
  enableProfileArn: boolean;
  profileArnTruncateLength: number;
  conversationIdPrefix: string;
  messageIdPrefix: string;
}

export interface Demo3PipelineContext {
  requestId: string;
  sessionId?: string;
  conversationId?: string;
  originalRequest: any;
  demo3Request: Demo3RequestFormat;
  demo3Response?: Demo3ResponseFormat;
  transformedResponse?: BaseResponse;
  metadata: {
    startTime: number;
    endTime?: number;
    duration?: number;
    stage: string;
    profileArn?: string;
  };
}

export class Demo3PipelineMatcher {
  private readonly config: Demo3PipelineConfig;

  constructor(config?: Partial<Demo3PipelineConfig>) {
    this.config = {
      endpoint: '/v1/messages',
      authHeaderName: 'x-api-key',
      authHeaderValue: 'demo3-api-key',
      enableProfileArn: true,
      profileArnTruncateLength: 50,
      conversationIdPrefix: 'demo3_conv_',
      messageIdPrefix: 'msg_demo3_',
      ...config
    };

    logger.info('Demo3 Pipeline Matcher initialized', {
      endpoint: this.config.endpoint,
      authHeader: this.config.authHeaderName,
      enableProfileArn: this.config.enableProfileArn
    });
  }

  /**
   * 🎯 Step 1: 输入预处理 - 完全匹配Demo3的输入处理逻辑
   */
  preprocessInput(request: BaseRequest): Demo3PipelineContext {
    const requestId = this.generateRequestId();
    
    const context: Demo3PipelineContext = {
      requestId,
      sessionId: request.metadata?.sessionId,
      conversationId: request.metadata?.conversationId || this.generateConversationId(),
      originalRequest: { ...request },
      demo3Request: {} as Demo3RequestFormat, // Will be filled in next step
      metadata: {
        startTime: Date.now(),
        stage: 'preprocessing'
      }
    };

    // 🎯 Demo3特殊处理：ProfileArn处理（与demo3保持一致）
    if (this.config.enableProfileArn && request.metadata) {
      const profileArn = (request.metadata as any).profileArn;
      if (profileArn && typeof profileArn === 'string') {
        context.metadata.profileArn = profileArn.length > this.config.profileArnTruncateLength 
          ? profileArn.substring(0, this.config.profileArnTruncateLength) + '...'
          : profileArn;
      } else {
        context.metadata.profileArn = 'N/A (authMethod!=social)';
      }
    }

    logger.debug('Demo3 input preprocessing completed', {
      requestId: context.requestId,
      conversationId: context.conversationId,
      hasProfileArn: !!context.metadata.profileArn,
      originalModel: request.model
    });

    return context;
  }

  /**
   * 🎯 Step 2: 请求转换 - 精确转换为Demo3格式
   */
  transformRequest(context: Demo3PipelineContext): Demo3PipelineContext {
    context.metadata.stage = 'request_transformation';

    try {
      // 使用Demo3数据匹配器进行精确转换
      context.demo3Request = demo3DataMatcher.transformToDemo3Format(context.originalRequest);

      // 🎯 Demo3特殊字段处理
      context.demo3Request.max_tokens = context.originalRequest.max_tokens || 131072;

      // 验证转换结果
      demo3DataMatcher.validateDemo3Request(context.demo3Request);

      logger.debug('Demo3 request transformation completed', {
        requestId: context.requestId,
        demo3Model: context.demo3Request.model,
        messageCount: context.demo3Request.messages.length,
        hasTools: !!(context.demo3Request.tools && context.demo3Request.tools.length > 0)
      });

      return context;

    } catch (error) {
      logger.error('Demo3 request transformation failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        originalRequest: context.originalRequest
      });
      throw error;
    }
  }

  /**
   * 🎯 Step 3: API调用准备 - 生成Demo3兼容的API调用参数
   */
  prepareApiCall(context: Demo3PipelineContext): {
    url: string;
    headers: Record<string, string>;
    body: Demo3RequestFormat;
    method: string;
  } {
    context.metadata.stage = 'api_preparation';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router/2.8.0 (demo3-compatible)'
    };

    // 🎯 Demo3认证头处理
    headers[this.config.authHeaderName] = this.config.authHeaderValue;

    // 🎯 Demo3特殊头部 (如果需要)
    if (context.metadata.profileArn) {
      headers['X-Profile-Arn'] = context.metadata.profileArn;
    }

    const apiCall = {
      url: this.config.endpoint,
      method: 'POST',
      headers,
      body: context.demo3Request
    };

    logger.debug('Demo3 API call prepared', {
      requestId: context.requestId,
      endpoint: apiCall.url,
      authMethod: this.config.authHeaderName,
      bodySize: JSON.stringify(apiCall.body).length
    });

    return apiCall;
  }

  /**
   * 🎯 Step 4: 响应处理 - 处理Demo3返回的响应
   */
  processResponse(context: Demo3PipelineContext, apiResponse: any): Demo3PipelineContext {
    context.metadata.stage = 'response_processing';
    context.metadata.endTime = Date.now();
    context.metadata.duration = context.metadata.endTime - context.metadata.startTime;

    try {
      // 🎯 确保响应符合Demo3格式
      const demo3Response = this.validateAndNormalizeDemo3Response(apiResponse);
      context.demo3Response = demo3Response;

      // 验证响应完整性
      demo3DataMatcher.validateDemo3Response(demo3Response);

      logger.debug('Demo3 response processing completed', {
        requestId: context.requestId,
        responseId: demo3Response.id,
        contentBlocks: demo3Response.content.length,
        stopReason: demo3Response.stop_reason,
        duration: context.metadata.duration
      });

      return context;

    } catch (error) {
      logger.error('Demo3 response processing failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        apiResponse: typeof apiResponse === 'object' ? JSON.stringify(apiResponse).substring(0, 500) : apiResponse
      });
      throw error;
    }
  }

  /**
   * 🎯 Step 5: 输出转换 - 转换为标准格式但保持Demo3特征
   */
  transformOutput(context: Demo3PipelineContext): Demo3PipelineContext {
    context.metadata.stage = 'output_transformation';

    if (!context.demo3Response) {
      throw new Error('No Demo3 response available for transformation');
    }

    try {
      // 使用Demo3数据匹配器转换响应
      const transformedResponse = demo3DataMatcher.transformFromDemo3Format(context.demo3Response);

      // 🎯 保持Demo3特殊字段
      context.transformedResponse = {
        ...transformedResponse,
        // 保留原始请求ID映射
        id: context.demo3Response.id,
        // 保留Demo3模型名
        model: context.demo3Response.model,
        // 添加Demo3特有的元数据
        metadata: {
          demo3Compatible: true,
          originalRequestId: context.requestId,
          conversationId: context.conversationId,
          processingDuration: context.metadata.duration
        }
      };

      logger.debug('Demo3 output transformation completed', {
        requestId: context.requestId,
        outputId: context.transformedResponse?.id,
        contentBlocks: context.transformedResponse?.content?.length,
        demo3Compatible: true
      });

      return context;

    } catch (error) {
      logger.error('Demo3 output transformation failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 🎯 完整流水线处理 - 一站式Demo3兼容处理
   */
  async processFullPipeline(
    request: BaseRequest,
    apiCallFunction: (apiCall: any) => Promise<any>
  ): Promise<BaseResponse> {
    let context: Demo3PipelineContext | undefined;

    try {
      // Step 1: 输入预处理
      context = this.preprocessInput(request);

      // Step 2: 请求转换
      context = this.transformRequest(context);

      // Step 3: API调用准备
      const apiCall = this.prepareApiCall(context);

      // Step 4: 执行API调用
      logger.debug('Executing Demo3-compatible API call', {
        requestId: context.requestId,
        endpoint: apiCall.url
      });

      const apiResponse = await apiCallFunction(apiCall);

      // Step 5: 响应处理
      context = this.processResponse(context, apiResponse);

      // Step 6: 输出转换
      context = this.transformOutput(context);

      if (!context.transformedResponse) {
        throw new Error('Pipeline completed but no transformed response available');
      }

      logger.info('Demo3 pipeline processing completed successfully', {
        requestId: context.requestId,
        totalDuration: context.metadata.duration,
        stage: context.metadata.stage
      });

      return context.transformedResponse;

    } catch (error) {
      logger.error('Demo3 pipeline processing failed', {
        requestId: context?.requestId || 'unknown',
        stage: context?.metadata.stage || 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * 🎯 流式处理支持 - Demo3兼容的流式响应处理
   */
  async *processStreamPipeline(
    request: BaseRequest,
    streamApiCallFunction: (apiCall: any) => AsyncIterable<any>
  ): AsyncIterable<any> {
    let context: Demo3PipelineContext | undefined;

    try {
      // 准备阶段
      context = this.preprocessInput(request);
      context = this.transformRequest(context);
      const apiCall = this.prepareApiCall(context);

      // 流式处理
      logger.debug('Starting Demo3-compatible stream processing', {
        requestId: context.requestId
      });

      let chunkCount = 0;
      for await (const chunk of streamApiCallFunction(apiCall)) {
        chunkCount++;

        // 🎯 Demo3流式响应格式化
        const formattedChunk = this.formatStreamChunk(chunk, context, chunkCount);
        
        logger.trace(context.requestId, 'demo3', 'Demo3 stream chunk processed', {
          requestId: context.requestId,
          chunkIndex: chunkCount,
          chunkType: formattedChunk.event
        });

        yield formattedChunk;
      }

      logger.debug('Demo3 stream processing completed', {
        requestId: context.requestId,
        totalChunks: chunkCount
      });

    } catch (error) {
      logger.error('Demo3 stream pipeline failed', {
        requestId: context?.requestId || 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Demo3响应格式验证和标准化
   */
  private validateAndNormalizeDemo3Response(apiResponse: any): Demo3ResponseFormat {
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('Invalid API response: not an object');
    }

    // 🎯 确保具有Demo3响应的必需字段
    const normalized: Demo3ResponseFormat = {
      id: apiResponse.id || this.generateMessageId(),
      type: 'message',
      role: 'assistant',
      content: Array.isArray(apiResponse.content) ? apiResponse.content : [],
      model: apiResponse.model || 'CLAUDE_SONNET_4_20250514_V1_0',
      stop_reason: apiResponse.stop_reason || 'end_turn',
      stop_sequence: apiResponse.stop_sequence || null,
      usage: apiResponse.usage || {
        input_tokens: 0,
        output_tokens: 0
      }
    };

    return normalized;
  }

  /**
   * 流式chunk格式化
   */
  private formatStreamChunk(chunk: any, context: Demo3PipelineContext, chunkIndex: number): any {
    return {
      event: chunk.event || 'data',
      data: chunk.data || chunk,
      metadata: {
        requestId: context.requestId,
        chunkIndex,
        demo3Compatible: true
      }
    };
  }

  /**
   * 生成Demo3兼容的请求ID
   */
  private generateRequestId(): string {
    return `demo3_req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 生成Demo3兼容的对话ID
   */
  private generateConversationId(): string {
    return `${this.config.conversationIdPrefix}${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 生成Demo3兼容的消息ID
   */
  private generateMessageId(): string {
    return `${this.config.messageIdPrefix}${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 🎯 获取处理统计信息
   */
  getProcessingStats(context: Demo3PipelineContext): Record<string, any> {
    return {
      requestId: context.requestId,
      conversationId: context.conversationId,
      stage: context.metadata.stage,
      duration: context.metadata.duration,
      hasProfileArn: !!context.metadata.profileArn,
      demo3Model: context.demo3Request?.model,
      contentBlocks: context.transformedResponse?.content?.length || 0,
      demo3Compatible: true
    };
  }
}

/**
 * 创建Demo3流水线匹配器实例
 */
export function createDemo3PipelineMatcher(config?: Partial<Demo3PipelineConfig>): Demo3PipelineMatcher {
  return new Demo3PipelineMatcher(config);
}