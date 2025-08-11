/**
 * Gemini管道协调器
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 协调所有Gemini模块的工作流程
 * - 管理请求-响应生命周期
 * - 处理流式/非流式转换逻辑
 * - 统一错误处理和日志记录
 */

import { BaseRequest, BaseResponse, ProviderConfig } from '@/types';
import { logger } from '@/utils/logger';
import { GeminiRequestConverter, GeminiApiRequest } from './request-converter';
import { GeminiResponseConverter, GeminiApiResponse } from './response-converter';
import { GeminiApiClient } from './api-client';
import { GeminiStreamingSimulator, StreamingEvent } from './streaming-simulator';

export interface PipelineCoordinatorConfig {
  streaming: boolean; // 客户端是否请求流式响应
  simulateStreaming: boolean; // 是否模拟流式响应
  streamingConfig?: {
    chunkDelay: number;
    textChunkSize: number;
    enableToolCallStreaming: boolean;
  };
}

export class GeminiPipelineCoordinator {
  private apiClient: GeminiApiClient;
  private streamingSimulator: GeminiStreamingSimulator;

  constructor(providerConfig: ProviderConfig, providerId: string) {
    this.apiClient = new GeminiApiClient(providerConfig, providerId);
    this.streamingSimulator = new GeminiStreamingSimulator();
    
    logger.info('Gemini pipeline coordinator initialized', {
      providerId
    });
  }

  /**
   * 执行完整的请求处理管道
   */
  async processRequest(
    request: BaseRequest,
    config: PipelineCoordinatorConfig
  ): Promise<BaseResponse | AsyncGenerator<StreamingEvent, void, unknown>> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Processing Gemini request through pipeline', {
      streaming: config.streaming,
      simulateStreaming: config.simulateStreaming,
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools
    }, requestId, 'gemini-pipeline-coordinator');

    try {
      // Stage 1: 请求格式转换
      const geminiRequest = this.convertRequest(request, requestId);
      
      // Stage 2: 执行API调用（始终非流式）
      const geminiResponse = await this.executeApiCall(geminiRequest, requestId);
      
      // Stage 3: 响应格式转换
      const anthropicResponse = this.convertResponse(geminiResponse, request.model, requestId);
      
      // Stage 4: 根据配置决定返回格式
      if (config.streaming && config.simulateStreaming) {
        // 返回流式模拟器
        return this.simulateStreamingResponse(anthropicResponse, requestId, config.streamingConfig);
      } else {
        // 返回非流式响应
        return anthropicResponse;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Gemini pipeline processing failed', {
        error: errorMessage,
        stage: this.identifyErrorStage(error)
      }, requestId, 'gemini-pipeline-coordinator');
      
      throw error;
    }
  }

  /**
   * Stage 1: 转换请求格式
   */
  private convertRequest(request: BaseRequest, requestId: string): GeminiApiRequest {
    logger.debug('Stage 1: Converting request to Gemini format', {}, requestId, 'gemini-pipeline-coordinator');
    
    try {
      const geminiRequest = GeminiRequestConverter.convertToGeminiFormat(request);
      
      logger.debug('Request conversion successful', {
        model: geminiRequest.model,
        contentCount: geminiRequest.contents?.length || 0,
        hasTools: !!geminiRequest.tools
      }, requestId, 'gemini-pipeline-coordinator');
      
      return geminiRequest;
      
    } catch (error) {
      logger.error('Request conversion failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-pipeline-coordinator');
      
      throw new Error(`Gemini request conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stage 2: 执行API调用
   */
  private async executeApiCall(geminiRequest: GeminiApiRequest, requestId: string): Promise<GeminiApiResponse> {
    logger.debug('Stage 2: Executing Gemini API call', {
      model: geminiRequest.model
    }, requestId, 'gemini-pipeline-coordinator');
    
    try {
      const response = await this.apiClient.executeRequest(geminiRequest, requestId);
      
      logger.debug('API call successful', {
        candidateCount: response.candidates?.length || 0,
        hasUsage: !!response.usageMetadata
      }, requestId, 'gemini-pipeline-coordinator');
      
      return response;
      
    } catch (error) {
      logger.error('API call failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-pipeline-coordinator');
      
      throw error; // 保持原始错误信息
    }
  }

  /**
   * Stage 3: 转换响应格式
   */
  private convertResponse(
    geminiResponse: GeminiApiResponse, 
    originalModel: string, 
    requestId: string
  ): BaseResponse {
    logger.debug('Stage 3: Converting response to Anthropic format', {}, requestId, 'gemini-pipeline-coordinator');
    
    try {
      // 验证响应
      GeminiResponseConverter.validateResponse(geminiResponse, requestId);
      
      // 转换格式
      const anthropicResponse = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        originalModel,
        requestId
      );
      
      logger.debug('Response conversion successful', {
        responseId: anthropicResponse.id,
        contentBlocks: anthropicResponse.content?.length || 0,
        stopReason: anthropicResponse.stop_reason
      }, requestId, 'gemini-pipeline-coordinator');
      
      return anthropicResponse;
      
    } catch (error) {
      logger.error('Response conversion failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-pipeline-coordinator');
      
      throw new Error(`Gemini response conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stage 4: 模拟流式响应
   */
  private async simulateStreamingResponse(
    anthropicResponse: BaseResponse,
    requestId: string,
    streamingConfig?: any
  ): Promise<AsyncGenerator<StreamingEvent, void, unknown>> {
    logger.debug('Stage 4: Simulating streaming response', {
      responseId: anthropicResponse.id
    }, requestId, 'gemini-pipeline-coordinator');
    
    try {
      // 更新流式模拟器配置
      if (streamingConfig) {
        this.streamingSimulator.updateConfig(streamingConfig);
      }
      
      // 验证响应格式
      GeminiStreamingSimulator.validateResponse(anthropicResponse as any);
      
      // 返回流式生成器
      return this.streamingSimulator.simulateStreaming(anthropicResponse as any, requestId);
      
    } catch (error) {
      logger.error('Streaming simulation setup failed', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-pipeline-coordinator');
      
      throw new Error(`Gemini streaming simulation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.apiClient.healthCheck();
      logger.debug('Gemini pipeline health check', { isHealthy });
      return isHealthy;
    } catch (error) {
      logger.warn('Gemini pipeline health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 识别错误发生的阶段 - 使用类型化错误检测而非字符串匹配
   */
  private identifyErrorStage(error: any): string {
    // 基于错误类型而非字符串内容进行判断
    if (error instanceof Error) {
      const errorName = error.constructor.name;
      const errorMessage = error.message;
      
      // 优先基于错误类名判断
      if (errorName.includes('Request') || errorMessage.startsWith('GeminiRequestConverter:')) {
        return 'request-conversion';
      } else if (errorName.includes('ApiClient') || errorMessage.startsWith('GeminiApiClient:')) {
        return 'api-execution';
      } else if (errorName.includes('Response') || errorMessage.startsWith('GeminiResponseConverter:')) {
        return 'response-conversion';
      } else if (errorName.includes('Streaming') || errorMessage.startsWith('GeminiStreamingSimulator:')) {
        return 'streaming-simulation';
      }
    }
    
    // 对于未知错误类型，返回具体描述
    return `unknown-error-type: ${error instanceof Error ? error.constructor.name : typeof error}`;
  }

  /**
   * 获取管道统计信息
   */
  getPipelineStats(): any {
    return {
      coordinator: 'GeminiPipelineCoordinator',
      modules: [
        'GeminiRequestConverter',
        'GeminiApiClient', 
        'GeminiResponseConverter',
        'GeminiStreamingSimulator'
      ],
      capabilities: [
        'request-format-conversion',
        'api-communication',
        'response-format-conversion',
        'streaming-simulation'
      ],
      architecture: 'modular-pipeline'
    };
  }
}