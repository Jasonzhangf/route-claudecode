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
import { MergedConfig } from '../../config/config-reader';
import { HttpRequestHandler, HttpRequestOptions } from './http-request-handler';
import { API_DEFAULTS, generatePipelineId } from '../../constants/api-defaults';

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
  private config: MergedConfig;
  private httpRequestHandler: HttpRequestHandler;
  // 🔧 修复：使用静态计数器确保跨请求持久化
  private static roundRobinCounters = new Map<string, number>();

  constructor(config: MergedConfig, httpRequestHandler: HttpRequestHandler) {
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
        apiMode: false
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
   * 转换请求格式
   */
  private transformRequest(input: any, routingDecision: any, context: RequestContext): any {
    // 这里应该实现实际的转换逻辑
    // 目前返回简化版本
    return {
      model: routingDecision.targetModel,
      messages: input.messages,
      max_tokens: input.max_tokens || 4096,
      temperature: input.temperature || 0.7,
      stream: false
    };
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
   * 执行服务器请求
   */
  private async makeServerRequest(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 获取provider配置
    const providers = (this.config as any).providers || [];
    const provider = providers.find((p: any) => p.name === routingDecision.provider);
    
    if (!provider) {
      throw new Error(`Provider not found: ${routingDecision.provider}`);
    }
    
    // 构建请求选项
    const requestOptions: HttpRequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`
      },
      body: JQJsonHandler.stringifyJson(request),
      timeout: provider.timeout || 30000
    };
    
    // 执行HTTP请求
    const endpoint = `${provider.api_base_url}/v1/chat/completions`;
    const response = await this.httpRequestHandler.makeHttpRequest(endpoint, requestOptions);
    
    // 解析响应
    if (response.status >= 200 && response.status < 300) {
      return JQJsonHandler.parseJsonString(response.body);
    } else {
      throw new Error(`Server request failed with status ${response.status}: ${response.body}`);
    }
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
    const routerConfig = (this.config as any).router;
    
    secureLogger.debug('🔍 Pipeline routing debug', {
      mappedModel,
      routerConfigKeys: routerConfig ? Object.keys(routerConfig) : 'none',
      routerConfigForModel: routerConfig ? routerConfig[mappedModel] : 'not found'
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