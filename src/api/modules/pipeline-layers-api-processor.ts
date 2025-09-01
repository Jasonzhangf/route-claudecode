/**
 * Pipeline Layers API Processor - 流水线层API处理器
 * 
 * 将流水线各层处理封装为API调用接口
 * 支持API化改造后的流水线处理
 * 
 * @author RCC v4.0 API Refactoring
 */

import { InternalAPIClient } from '../internal-api-client';
import { APIResponse } from '../types/api-response';
import { 
  RouterProcessRequest, 
  RouterProcessResponse,
  TransformerProcessRequest,
  TransformerProcessResponse,
  ProtocolProcessRequest,
  ProtocolProcessResponse,
  ServerProcessRequest,
  ServerProcessResponse
} from '../../interfaces/api/pipeline-api';

/**
 * Pipeline Layers API处理器
 * 通过API调用替代直接方法调用
 */
export class PipelineLayersAPIProcessor {
  private apiClient: InternalAPIClient;

  constructor(apiClient: InternalAPIClient) {
    this.apiClient = apiClient;
  }

  /**
   * 处理Router层 - 通过API调用
   */
  async processRouterLayer(input: any, context: any): Promise<RouterProcessResponse> {
    const request: RouterProcessRequest = {
      input,
      context
    };

    const response = await this.apiClient.post<RouterProcessResponse>(
      '/api/v1/pipeline/router/process',
      request
    );

    if (!response.success) {
      throw new Error(`Router layer processing failed: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * 处理Transformer层 - 通过API调用
   */
  async processTransformerLayer(
    input: any, 
    routingDecision: any, 
    context: any
  ): Promise<TransformerProcessResponse> {
    const request: TransformerProcessRequest = {
      input,
      routingDecision,
      context
    };

    const response = await this.apiClient.post<TransformerProcessResponse>(
      '/api/v1/pipeline/transformer/process',
      request
    );

    if (!response.success) {
      throw new Error(`Transformer layer processing failed: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * 处理Protocol层 - 通过API调用
   */
  async processProtocolLayer(
    request: any, 
    routingDecision: any, 
    context: any
  ): Promise<ProtocolProcessResponse> {
    const apiRequest: ProtocolProcessRequest = {
      request,
      routingDecision,
      context
    };

    const response = await this.apiClient.post<ProtocolProcessResponse>(
      '/api/v1/pipeline/protocol/process',
      apiRequest
    );

    if (!response.success) {
      throw new Error(`Protocol layer processing failed: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * 处理Server层 - 通过API调用
   */
  async processServerLayer(
    request: any, 
    routingDecision: any, 
    context: any
  ): Promise<ServerProcessResponse> {
    const apiRequest: ServerProcessRequest = {
      request,
      routingDecision,
      context
    };

    const response = await this.apiClient.post<ServerProcessResponse>(
      '/api/v1/pipeline/server/process',
      apiRequest
    );

    if (!response.success) {
      throw new Error(`Server layer processing failed: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * 处理完整的流水线 - 通过API调用
   */
  async processFullPipeline(input: any, context: any): Promise<ServerProcessResponse> {
    // Router层处理
    const routingResult = await this.processRouterLayer(input, context);
    
    // Transformer层处理
    const transformerResult = await this.processTransformerLayer(
      input, 
      routingResult, 
      context
    );
    
    // Protocol层处理
    const protocolResult = await this.processProtocolLayer(
      transformerResult.transformedRequest, 
      routingResult, 
      context
    );
    
    // Server层处理
    const serverResult = await this.processServerLayer(
      protocolResult.protocolRequest, 
      routingResult, 
      context
    );

    return serverResult;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get<any>('/health');
      return response.success && response.data?.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * 更新API客户端配置
   */
  updateAPIClientConfig(config: Partial<{ timeout: number; retries: number }>): void {
    // 这里可以实现配置更新逻辑
    // 由于InternalAPIClient目前不支持动态更新，我们可以创建新的实例
  }
}

/**
 * 创建Pipeline Layers API处理器实例
 */
export function createPipelineLayersAPIProcessor(apiClient: InternalAPIClient): PipelineLayersAPIProcessor {
  return new PipelineLayersAPIProcessor(apiClient);
}