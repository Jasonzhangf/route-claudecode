/**
 * Pipeline Coordinator - Clean Architecture
 * 统一流水线协调器，确保清晰的层次分离
 * Project owner: Jason Zhang
 * 
 * Architecture Principles:
 * Input → Preprocessing → Transformer → Provider → Third-party API
 * 
 * 职责:
 * 1. 协调各层之间的数据流
 * 2. 确保单向依赖
 * 3. 集中化转换和修复逻辑
 */

import { BaseRequest, BaseResponse } from '../types';
import { logger } from '../utils/logger';
import { GeminiTransformer } from '../transformers/gemini';
import { GeminiApiRequest, GeminiApiResponse } from '../types';
import { UnifiedPatchPreprocessor } from './unified-patch-preprocessor';

export interface PipelineContext {
  requestId: string;
  provider: string;
  model: string;
  stage: 'input' | 'transform' | 'provider' | 'response';
  timestamp: number;
}

/**
 * 流水线协调器
 * 管理Input → Preprocessing → Transformer → Provider的数据流
 */
export class PipelineCoordinator {
  private geminiTransformer: GeminiTransformer;
  private patchPreprocessor: UnifiedPatchPreprocessor;

  constructor(port?: number) {
    this.geminiTransformer = new GeminiTransformer();
    this.patchPreprocessor = new UnifiedPatchPreprocessor(port);
  }

  /**
   * 输入阶段处理 - Input Layer
   * 统一的请求预处理入口
   */
  async processInput(
    request: BaseRequest,
    provider: string,
    model: string
  ): Promise<BaseRequest> {
    const context: PipelineContext = {
      requestId: request.metadata?.requestId || this.generateRequestId(),
      provider,
      model,
      stage: 'input',
      timestamp: Date.now()
    };

    logger.debug('PipelineCoordinator: Processing input stage', {
      provider,
      model,
      hasTools: !!request.tools
    }, context.requestId, 'pipeline-coordinator');

    // 通过统一预处理器处理输入
    const processedInput = await this.patchPreprocessor.preprocessInput(
      request,
      provider as any,
      model,
      context.requestId
    );

    return processedInput;
  }

  /**
   * 转换阶段处理 - Transformer Layer
   * 格式转换，不包含服务特定逻辑
   */
  async processTransform(
    request: BaseRequest,
    targetFormat: 'gemini' | 'openai' | 'anthropic'
  ): Promise<{ transformedData: any; metadata: any }> {
    const context: PipelineContext = {
      requestId: request.metadata?.requestId || this.generateRequestId(),
      provider: request.metadata?.provider || 'unknown',
      model: request.model,
      stage: 'transform',
      timestamp: Date.now()
    };

    logger.debug('PipelineCoordinator: Processing transform stage', {
      targetFormat,
      model: request.model
    }, context.requestId, 'pipeline-coordinator');

    switch (targetFormat) {
      case 'gemini':
        const geminiResult = this.geminiTransformer.transformAnthropicToGemini(request);
        return {
          transformedData: geminiResult.geminiRequest,
          metadata: {
            ...geminiResult.metadata,
            geminiFormat: true,
            geminiRequest: geminiResult.geminiRequest
          }
        };

      case 'openai':
        // TODO: Implement OpenAI transformer
        throw new Error('OpenAI transformer not yet implemented in clean architecture');

      case 'anthropic':
        // Pass through - already in Anthropic format
        return {
          transformedData: request,
          metadata: { anthropicFormat: true }
        };

      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }

  /**
   * Provider准备阶段 - Provider Layer Input
   * 将转换后的数据打包成Provider可以直接使用的格式
   */
  async prepareForProvider(
    transformedData: any,
    metadata: any,
    originalModel: string
  ): Promise<BaseRequest> {
    const context: PipelineContext = {
      requestId: metadata.requestId || this.generateRequestId(),
      provider: metadata.provider || 'unknown',
      model: originalModel,
      stage: 'provider',
      timestamp: Date.now()
    };

    logger.debug('PipelineCoordinator: Preparing data for provider', {
      hasMetadata: !!metadata,
      originalModel
    }, context.requestId, 'pipeline-coordinator');

    // 构建Provider可以直接使用的请求格式
    const providerRequest: BaseRequest = {
      model: originalModel,
      messages: [], // Provider不需要原始messages，已转换
      metadata: {
        ...metadata,
        requestId: context.requestId,
        stage: 'provider-ready'
      },
      // 占位符内容，实际数据在metadata中
      max_tokens: 1000,
      temperature: 0.7
    };

    return providerRequest;
  }

  /**
   * 响应处理阶段 - Response Layer
   * 处理Provider返回的原始响应，转换回统一格式
   */
  async processResponse(
    providerResponse: BaseResponse,
    originalFormat: 'gemini' | 'openai' | 'anthropic',
    originalModel: string
  ): Promise<BaseResponse> {
    const context: PipelineContext = {
      requestId: providerResponse.metadata?.requestId || this.generateRequestId(),
      provider: providerResponse.metadata?.provider || 'unknown',
      model: originalModel,
      stage: 'response',
      timestamp: Date.now()
    };

    logger.debug('PipelineCoordinator: Processing provider response', {
      originalFormat,
      hasMetadata: !!providerResponse.metadata
    }, context.requestId, 'pipeline-coordinator');

    // 如果是原始Provider响应，需要转换
    if (providerResponse.metadata?.geminiResponse) {
      const geminiResponse = providerResponse.metadata.geminiResponse as GeminiApiResponse;
      
      // 使用transformer转换回Anthropic格式
      const convertedResponse = this.geminiTransformer.transformGeminiToAnthropic(
        geminiResponse,
        originalModel,
        context.requestId
      );

      // 通过patches系统进行最终修复
      const finalResponse = await this.patchPreprocessor.preprocessResponse(
        convertedResponse,
        context.provider as any,
        originalModel,
        context.requestId
      );

      return finalResponse;
    }

    // 对于其他格式，直接通过patches处理
    const processedResponse = await this.patchPreprocessor.preprocessResponse(
      providerResponse,
      context.provider as any,
      originalModel,
      context.requestId
    );

    return processedResponse;
  }

  /**
   * 生成唯一请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `req_pipeline_${timestamp}_${random}`;
  }

  /**
   * 获取性能统计
   */
  getStats() {
    return {
      patchPreprocessorStats: this.patchPreprocessor.getPerformanceMetrics(),
      // patchManagerStats: removed - patch system no longer exists
    };
  }
}

/**
 * 全局Pipeline Coordinator实例管理
 */
const coordinatorInstances = new Map<string, PipelineCoordinator>();

export function getPipelineCoordinator(port?: number): PipelineCoordinator {
  const key = port?.toString() || 'default';
  
  if (!coordinatorInstances.has(key)) {
    coordinatorInstances.set(key, new PipelineCoordinator(port));
  }

  return coordinatorInstances.get(key)!;
}

export function createPipelineCoordinator(port?: number): PipelineCoordinator {
  const key = port?.toString() || 'default';
  const coordinator = new PipelineCoordinator(port);
  coordinatorInstances.set(key, coordinator);
  return coordinator;
}