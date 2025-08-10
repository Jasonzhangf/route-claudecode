/**
 * Enhanced Routing Engine with Clean Pipeline Architecture
 * 集成了Pipeline Coordinator的增强路由引擎
 * Project owner: Jason Zhang
 * 
 * Architecture Flow:
 * Input → Preprocessing → Route → Transform → Provider → Response Transform → Output
 */

import { BaseRequest, BaseResponse, RoutingCategory } from '../types';
import { logger } from '../utils/logger';
import { RoutingEngine } from './engine';
import { PipelineCoordinator, getPipelineCoordinator } from '../preprocessing/pipeline-coordinator';

export interface RoutingResult {
  provider: string;
  model: string;
  preprocessedRequest: BaseRequest;
  transformedData: any;
  metadata: any;
}

/**
 * 增强路由引擎
 * 结合了路由决策和流水线预处理
 */
export class EnhancedRoutingEngine {
  private baseRoutingEngine: RoutingEngine;
  private pipelineCoordinator: PipelineCoordinator;

  constructor(
    routingConfig: Record<RoutingCategory, any>,
    port?: number
  ) {
    this.baseRoutingEngine = new RoutingEngine(routingConfig);
    this.pipelineCoordinator = getPipelineCoordinator(port);
  }

  /**
   * 完整的路由和预处理流程
   * 返回Provider可以直接使用的数据
   */
  async routeAndPreprocess(request: BaseRequest, requestId: string): Promise<RoutingResult> {
    logger.debug('Enhanced routing engine: Starting route and preprocess', {
      model: request.model,
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools
    }, requestId, 'enhanced-routing');

    // 1. 传统路由决策：选择Provider和Model
    const selectedProvider = await this.baseRoutingEngine.route(request, requestId);
    
    // 2. 输入预处理：统一请求格式清理和修复
    const preprocessedRequest = await this.pipelineCoordinator.processInput(
      request,
      selectedProvider,
      request.model
    );

    // 3. 确定转换目标格式
    const targetFormat = this.determineTargetFormat(selectedProvider);
    
    // 4. 格式转换：Anthropic → 目标格式
    const { transformedData, metadata } = await this.pipelineCoordinator.processTransform(
      preprocessedRequest,
      targetFormat
    );

    // 5. Provider准备：打包成Provider可直接使用的格式
    const providerReadyRequest = await this.pipelineCoordinator.prepareForProvider(
      transformedData,
      {
        ...metadata,
        provider: selectedProvider,
        requestId,
        targetFormat
      },
      request.model
    );

    logger.info('Enhanced routing engine: Route and preprocess completed', {
      provider: selectedProvider,
      targetFormat,
      hasTransformedData: !!transformedData,
      hasMetadata: !!metadata
    }, requestId, 'enhanced-routing');

    return {
      provider: selectedProvider,
      model: request.model,
      preprocessedRequest: providerReadyRequest,
      transformedData,
      metadata: {
        ...metadata,
        provider: selectedProvider,
        requestId,
        targetFormat
      }
    };
  }

  /**
   * 响应后处理：将Provider响应转换回统一格式
   */
  async processProviderResponse(
    providerResponse: BaseResponse,
    routingMetadata: any
  ): Promise<BaseResponse> {
    const requestId = routingMetadata.requestId || this.generateRequestId();
    
    logger.debug('Enhanced routing engine: Processing provider response', {
      provider: routingMetadata.provider,
      targetFormat: routingMetadata.targetFormat,
      hasResponse: !!providerResponse
    }, requestId, 'enhanced-routing');

    // 使用Pipeline Coordinator处理响应
    const processedResponse = await this.pipelineCoordinator.processResponse(
      providerResponse,
      routingMetadata.targetFormat || 'anthropic',
      routingMetadata.model || providerResponse.model
    );

    logger.info('Enhanced routing engine: Provider response processed', {
      finalModel: processedResponse.model,
      contentBlocks: processedResponse.content?.length || 0
    }, requestId, 'enhanced-routing');

    return processedResponse;
  }

  /**
   * 确定Provider的目标转换格式
   */
  private determineTargetFormat(provider: string): 'gemini' | 'openai' | 'anthropic' {
    // 基于Provider名称确定目标格式
    if (provider.toLowerCase().includes('gemini') || 
        provider.toLowerCase().includes('google')) {
      return 'gemini';
    }
    
    if (provider.toLowerCase().includes('openai') || 
        provider.toLowerCase().includes('shuaihong') ||
        provider.toLowerCase().includes('modelscope') ||
        provider.toLowerCase().includes('lmstudio')) {
      return 'openai';
    }
    
    if (provider.toLowerCase().includes('anthropic') ||
        provider.toLowerCase().includes('claude')) {
      return 'anthropic';
    }

    // 默认使用OpenAI格式（最通用）
    logger.debug('Enhanced routing engine: Using default OpenAI format for unknown provider', {
      provider
    });
    return 'openai';
  }

  /**
   * 获取路由统计信息
   */
  getRoutingStats() {
    return {
      pipelineStats: this.pipelineCoordinator.getStats()
    };
  }

  /**
   * 生成唯一请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `req_enhanced_${timestamp}_${random}`;
  }
}

/**
 * 全局Enhanced Routing Engine实例管理
 */
const enhancedRoutingInstances = new Map<string, EnhancedRoutingEngine>();

export function getEnhancedRoutingEngine(
  routingConfig: Record<RoutingCategory, any>,
  port?: number
): EnhancedRoutingEngine {
  const key = port?.toString() || 'default';
  
  if (!enhancedRoutingInstances.has(key)) {
    enhancedRoutingInstances.set(key, new EnhancedRoutingEngine(routingConfig, port));
  }

  return enhancedRoutingInstances.get(key)!;
}

export function createEnhancedRoutingEngine(
  routingConfig: Record<RoutingCategory, any>,
  port?: number
): EnhancedRoutingEngine {
  const key = port?.toString() || 'default';
  const engine = new EnhancedRoutingEngine(routingConfig, port);
  enhancedRoutingInstances.set(key, engine);
  return engine;
}