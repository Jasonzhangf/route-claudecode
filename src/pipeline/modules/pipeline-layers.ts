/**
 * Pipeline层处理器 - RCC4六层流水线核心处理逻辑
 *
 * 职责：
 * 1. Router层 - 路由决策和模型映射
 * 2. Transformer层 - 协议转换 (Anthropic ↔ OpenAI)
 * 3. Protocol层 - 协议处理和配置管理
 * 4. Server层 - HTTP API调用和响应处理
 *
 * @author RCC v4.0
 */

import { secureLogger } from '../../utils/secure-logger';
import { JQJsonHandler } from '../../utils/jq-json-handler';
// 🔧 配置访问违规修复：移除直接配置访问，通过参数注入获取配置
// import { MergedConfig } from '../../config/config-reader';
import { HttpRequestHandler, HttpRequestOptions } from './http-request-handler';

/**
 * Pipeline层处理器配置接口 - 替代直接配置访问
 * 只包含Pipeline层实际需要的配置字段，避免依赖完整配置对象
 */
export interface PipelineLayersConfig {
  router?: Record<string, string>;  // 路由映射配置
  providers?: Array<{
    name: string;
    baseURL?: string;
    api_base_url?: string;
    base_url?: string;
    apiKey?: string;
    api_key?: string;
    models?: string[];
  }>;
  server?: {
    timeout?: number;
    maxRetries?: number;
  };
  debug?: {
    enabled?: boolean;
    logLevel?: string;
  };
}
import { API_DEFAULTS, generatePipelineId, PROVIDER_CONFIG_FIELDS } from '../../constants/api-defaults';
import { transformAnthropicToOpenAI } from '../../modules/transformers/anthropic-openai-converter';
import { PROVIDER_ERRORS, LOG_MESSAGES } from '../../constants/error-messages';
import { ZeroFallbackErrorFactory } from '../../interfaces/core/zero-fallback-errors';

export interface RequestContext {
  requestId: string;
  startTime: Date;
  layerTimings: Record<string, number>;
  routingDecision?: any;
  transformations: any[];
  errors: any[];
  metadata: any;
}

/**
 * Pipeline层处理器
 * 负责六层流水线中的核心处理层，直接处理逻辑而非通过API调用
 */
export class PipelineLayersProcessor {
  private config: PipelineLayersConfig;
  private httpRequestHandler: HttpRequestHandler;
  // 🔧 修复：使用静态计数器确保跨请求持久化
  private static roundRobinCounters = new Map<string, number>();

  constructor(config: PipelineLayersConfig, httpRequestHandler: HttpRequestHandler) {
    this.config = config;
    this.httpRequestHandler = httpRequestHandler;
    
    secureLogger.info('Pipeline Layers Processor initialized with direct processing mode');
  }

  /**
   * 处理Router层 - 路由决策 (直接处理)
   */
  public async processRouterLayer(input: any, context: RequestContext): Promise<any> {
    try {
      secureLogger.info('Router layer processing directly', {
        requestId: context.requestId,
        inputModel: input.model
      });

      // 直接处理路由逻辑，而不是通过API调用
      const routingDecision = this.makeRoutingDecision(input.model, context);
      
      context.routingDecision = routingDecision;
      context.metadata.routingDecision = routingDecision;
      
      context.transformations.push({
        layer: 'router',
        inputModel: input.model,
        outputModel: routingDecision.virtualModel,
        timestamp: new Date(),
        apiMode: false
      });

      secureLogger.info('Router layer processed directly', {
        requestId: context.requestId,
        inputModel: input.model,
        outputModel: routingDecision.virtualModel
      });

      return routingDecision;
    } catch (error) {
      secureLogger.error('Router layer processing failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  

  /**
   * 处理Transformer层 - 协议转换 (直接处理)
   */
  public async processTransformerLayer(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    try {
      secureLogger.info('Transformer layer processing directly', {
        requestId: context.requestId
      });

      // 直接处理转换逻辑，而不是通过API调用
      const transformedRequest = this.transformRequest(input, routingDecision, context);
      
      context.transformations.push({
        layer: 'transformer',
        direction: 'anthropic-to-openai',
        timestamp: new Date(),
        apiMode: false,
        result: transformedRequest  // 🔥 关键修复：添加转换结果
      });

      secureLogger.info('Transformer layer processed directly', {
        requestId: context.requestId
      });

      return transformedRequest;
    } catch (error) {
      secureLogger.error('Transformer layer processing failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  

  /**
   * 处理Protocol层 - 协议处理 (直接处理)
   */
  public async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    try {
      secureLogger.info('Protocol layer processing directly', {
        requestId: context.requestId
      });

      // 直接处理协议逻辑，而不是通过API调用
      const protocolRequest = this.handleProtocol(request, routingDecision, context);
      
      secureLogger.info('Protocol layer processed directly', {
        requestId: context.requestId
      });

      return protocolRequest;
    } catch (error) {
      secureLogger.error('Protocol layer processing failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  

  /**
   * 处理Server层 - HTTP API调用 (直接处理)
   */
  public async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    try {
      secureLogger.info('Server layer processing directly', {
        requestId: context.requestId
      });

      // 直接处理服务器调用逻辑，而不是通过API调用
      const serverResponse = await this.makeServerRequest(request, routingDecision, context);
      
      secureLogger.info('Server layer processed directly', {
        requestId: context.requestId
      });

      return serverResponse;
    } catch (error) {
      secureLogger.error('Server layer processing failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  

  /**
   * 执行路由决策
   */
  private makeRoutingDecision(model: string, context: RequestContext): any {
    // 获取可用的流水线
    const availablePipelines = this.getAvailablePipelinesForMappedModel(model);
    
    if (availablePipelines.length === 0) {
      throw new Error(`No available pipelines for model: ${model}`);
    }
    
    // 选择流水线
    const selectedPipeline = this.selectPipelineRoundRobin(availablePipelines);
    
    // 从流水线ID中提取provider和模型信息
    const [providerName, ...modelParts] = selectedPipeline.split('-');
    const modelName = modelParts.slice(0, -1).join('-'); // 移除key部分
    
    return {
      provider: providerName,
      virtualModel: model,
      targetModel: modelName,
      selectedPipeline: selectedPipeline,
      availablePipelines: availablePipelines,
      originalModel: model
    };
  }

  /**
   * 转换请求格式 - 完整的Anthropic到OpenAI转换
   */
  private transformRequest(input: any, routingDecision: any, context: RequestContext): any {
    try {
      secureLogger.info('🔄 [PIPELINE-TRANSFORMER] 开始Anthropic → OpenAI转换', {
        requestId: context.requestId,
        inputModel: input?.model,
        targetModel: routingDecision?.targetModel,
        hasTools: Array.isArray(input?.tools) ? input.tools.length : 0,
        hasMessages: Array.isArray(input?.messages) ? input.messages.length : 0,
        inputValid: !!(input && typeof input === 'object')
      });
      
      if (!input || typeof input !== 'object') {
        secureLogger.error('❌ [PIPELINE-TRANSFORMER] 输入数据无效，创建最小有效请求', {
          requestId: context.requestId,
          inputType: typeof input,
          isNull: input === null,
          isUndefined: input === undefined
        });
        // 🔧 CRITICAL FIX: Return valid minimal request instead of empty object
        return {
          model: routingDecision?.targetModel || API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
          messages: [{
            role: 'user',
            content: 'Request processing error: Invalid input data'
          }],
          max_tokens: API_DEFAULTS.TOKEN_LIMITS.DEFAULT_MAX_TOKENS,
          temperature: 0.7
        };
      }
      
      // 🔧 ARCHITECTURE FIX: Transformer层只负责协议格式转换，不处理具体参数值
      // maxTokens的处理应该在ServerCompatibility层进行
      const transformed = transformAnthropicToOpenAI(input);
      
      secureLogger.debug('🔍 [PIPELINE-TRANSFORMER] 转换结果验证', {
        requestId: context.requestId,
        transformedType: typeof transformed,
        hasKeys: transformed ? Object.keys(transformed).length : 0,
        isValidObject: !!(transformed && typeof transformed === 'object' && !Array.isArray(transformed))
      });
      
      if (!transformed || typeof transformed !== 'object' || Array.isArray(transformed)) {
        secureLogger.error('❌ [PIPELINE-TRANSFORMER] 转换失败，抛出ZeroFallback错误', {
          requestId: context.requestId,
          transformedType: typeof transformed,
          isArray: Array.isArray(transformed),
          isNull: transformed === null
        });
        // 🔧 CRITICAL FIX: Throw ZeroFallbackError instead of returning fallback request
        const error = ZeroFallbackErrorFactory.createProviderFailure(
          routingDecision?.provider || 'unknown',
          routingDecision?.targetModel || input?.model || 'unknown',
          'Request processing error: Transformation failed',
          { requestId: context.requestId }
        );
        throw error;
      }
      
      // 检查转换结果是否为空对象
      if (Object.keys(transformed).length === 0) {
        secureLogger.error('❌ [PIPELINE-TRANSFORMER] 转换结果为空对象，抛出ZeroFallback错误', {
          requestId: context.requestId,
          originalModel: input?.model,
          targetModel: routingDecision?.targetModel
        });
        
        // 抛出ZeroFallback错误而不是使用降级方案
        const error = ZeroFallbackErrorFactory.createProviderFailure(
          routingDecision?.provider || 'unknown',
          routingDecision?.targetModel || input?.model || 'unknown',
          'Request processing error: Transformation returned empty object',
          { requestId: context.requestId }
        );
        throw error;
      }
      
      // 应用路由决策中的目标模型
      if (transformed && typeof transformed === 'object' && routingDecision?.targetModel) {
        transformed.model = routingDecision.targetModel;
      }
      
      secureLogger.info('✅ [PIPELINE-TRANSFORMER] 转换完成', {
        requestId: context.requestId,
        outputModel: transformed?.model,
        hasTools: transformed?.tools ? transformed.tools.length : 0,
        hasMessages: transformed?.messages ? transformed.messages.length : 0,
        outputKeys: transformed ? Object.keys(transformed).length : 0
      });
      
      return transformed;
    } catch (error) {
      secureLogger.error('❌ [PIPELINE-TRANSFORMER] 转换异常', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // 抛出ZeroFallback错误而不是返回空对象
      const zfError = ZeroFallbackErrorFactory.createProviderFailure(
        context.routingDecision?.provider || 'unknown',
        context.routingDecision?.targetModel || 'unknown',
        error instanceof Error ? error.message : String(error),
        { requestId: context.requestId }
      );
      throw zfError;
    }
  }

  /**
   * 处理协议
   */
  private handleProtocol(request: any, routingDecision: any, context: RequestContext): any {
    // 这里应该实现实际的协议处理逻辑
    // 目前返回简化版本
    return {
      ...request,
      model: routingDecision.targetModel
    };
  }

  /**
   * 执行服务器请求 - 完全使用OpenAI SDK
   */
  private async makeServerRequest(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 获取provider配置 - 支持大小写字段名
    const providers = (this.config as any).providers || (this.config as any).Providers || [];
    const provider = providers.find((p: any) => p.name === routingDecision.provider);
    
    secureLogger.info('🔍 Provider查找调试', {
      requestId: context.requestId,
      targetProvider: routingDecision.provider,
      availableProviders: providers.map((p: any) => p.name),
      foundProvider: !!provider,
      providersSource: (this.config as any).providers ? 'providers' : 'Providers'
    });
    
    if (!provider) {
      throw new Error(`Provider not found: ${routingDecision.provider}`);
    }
    
    // 🔥 关键修复：优先使用protocolConfig，其次才用provider配置
    // 这是重构后的正确架构：compatibility层设置protocolConfig，server层使用
    const protocolConfig = context.metadata?.protocolConfig;
    const baseURL = protocolConfig?.endpoint || provider.baseURL || provider.api_base_url || provider.base_url;
    const apiKey = protocolConfig?.apiKey || provider.apiKey || provider.api_key;
    
    secureLogger.info(LOG_MESSAGES.OPENAI_SDK_REQUEST_START, {
      requestId: context.requestId,
      provider: provider.name,
      baseURL: baseURL,
      model: request.model,
      hasProtocolConfig: !!protocolConfig,
      hasProtocolApiKey: !!protocolConfig?.apiKey,
      hasProviderApiKey: !!(provider.apiKey || provider.api_key),
      finalHasApiKey: !!apiKey,
      dataSource: protocolConfig?.apiKey ? 'protocolConfig' : 'provider'
    });
    
    // 🔥 完全使用OpenAI SDK，自动处理HTTP请求、认证、SSE解析等
    const openaiResponse = await this.httpRequestHandler.makeOpenAIRequest(request, baseURL, apiKey);
    
    secureLogger.info(LOG_MESSAGES.OPENAI_SDK_REQUEST_COMPLETE, {
      requestId: context.requestId,
      responseId: openaiResponse.id,
      model: openaiResponse.model,
      hasChoices: openaiResponse.choices?.length > 0
    });

    return openaiResponse;
  }
  
  private extractProviderFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    return parts[0] || 'unknown';
  }

  /**
   * Round Robin负载均衡选择流水线 - 线程安全实现
   */
  private selectPipelineRoundRobin(availablePipelines: string[]): string {
    if (availablePipelines.length === 1) {
      return availablePipelines[0];
    }

    // 按流水线列表排序后轮询，确保一致性
    const sortedPipelines = availablePipelines.sort();
    const routeKey = sortedPipelines.join(',');
    
    // 🔒 线程安全的原子操作 - 使用Node.js单线程的原子性保证
    // 避免在同一事件循环tick内的竞争条件
    const currentIndex = PipelineLayersProcessor.roundRobinCounters.get(routeKey) || 0;
    const selectedIndex = currentIndex % sortedPipelines.length;
    const selectedPipeline = sortedPipelines[selectedIndex];

    // 🔧 原子性地更新计数器 - 在同一个同步操作中完成
    const nextIndex = currentIndex + 1;
    PipelineLayersProcessor.roundRobinCounters.set(routeKey, nextIndex);

    // 🔧 关键调试：使用info级别确保显示Round Robin状态
    secureLogger.info('🔄 Round Robin负载均衡选择', {
      routeKey,
      currentIndex,
      selectedIndex,
      selectedPipeline,
      totalPipelines: sortedPipelines.length,
      position: `${selectedIndex + 1}/${sortedPipelines.length}`,
      nextIndex,
      allCounters: Array.from(PipelineLayersProcessor.roundRobinCounters.entries()),
      sortedPipelines
    });

    return selectedPipeline;
  }

  private getAvailablePipelinesForMappedModel(mappedModel: string): string[] {
    const routerConfig = (this.config as any).router || (this.config as any).Router || (this.config as any).routing;
    
    secureLogger.info('🔍 Pipeline routing debug - 详细配置检查', {
      mappedModel,
      configKeys: Object.keys(this.config || {}),
      hasRouter: !!(this.config as any).router,
      hasRouterCapital: !!(this.config as any).Router,
      routerConfig: routerConfig,
      routerConfigKeys: routerConfig ? Object.keys(routerConfig) : 'none',
      routerConfigForModel: routerConfig ? routerConfig[mappedModel] : 'not found',
      providersCount: (this.config as any).providers?.length || (this.config as any).Providers?.length || 0
    });
    
    if (routerConfig && routerConfig[mappedModel]) {
      const routeEntry = routerConfig[mappedModel];
      // 🔧 修复：解析所有路由选项，支持跨provider切换
      const allRoutes = routeEntry.split(';').map((route: string) => route.trim());
      const availablePipelines: string[] = [];
      
      secureLogger.info('🔧 解析路由配置', {
        mappedModel,
        routeEntry,
        allRoutes
      });
      
      for (const route of allRoutes) {
        const [providerName, modelName] = route.split(',').map((s: string) => s.trim());
        
        if (providerName && modelName) {
          const pipelineId = generatePipelineId(providerName, modelName);
          availablePipelines.push(pipelineId);
          
          secureLogger.debug('🔧 生成pipeline ID', {
            route,
            providerName,
            modelName,
            pipelineId
          });
        } else {
          secureLogger.warn('🚨 路由解析失败', {
            route,
            providerName,
            modelName
          });
        }
      }
      
      secureLogger.info('🔧 Pipeline生成完成', {
        mappedModel,
        generatedPipelines: availablePipelines,
        totalCount: availablePipelines.length
      });
      
      if (availablePipelines.length > 0) {
        return availablePipelines;
      }
    }
    
    if (mappedModel !== 'default' && routerConfig?.default) {
      const defaultRoute = routerConfig.default;
      // 🔧 修复：解析所有默认路由选项
      const allDefaultRoutes = defaultRoute.split(';').map((route: string) => route.trim());
      const availablePipelines: string[] = [];
      
      for (const route of allDefaultRoutes) {
        const [providerName, modelName] = route.split(',').map((s: string) => s.trim());
        
        if (providerName && modelName) {
          const pipelineId = generatePipelineId(providerName, modelName);
          availablePipelines.push(pipelineId);
        }
      }
      
      if (availablePipelines.length > 0) {
        return availablePipelines;
      }
    }
    
    const providers = (this.config as any).providers;
    if (providers?.length > 0) {
      const firstProvider = providers[0];
      if (firstProvider.models?.length > 0) {
        const modelName = firstProvider.models[0];
        const pipelineId = generatePipelineId(firstProvider.name, modelName);
        return [pipelineId];
      }
    }
    
    return [];
  }
}