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
 * API化接口
 */
interface APIClientInterface {
  post(endpoint: string, data: any, requestId?: string): Promise<{ success: boolean; data?: any; error?: any }>;
}

/**
 * Pipeline层处理器 - 支持API化改造
 * 负责六层流水线中的四个核心处理层
 */
export class PipelineLayersProcessor {
  private config: MergedConfig;
  private httpRequestHandler: HttpRequestHandler;
  private apiClient?: APIClientInterface;
  // 🔧 修复：使用静态计数器确保跨请求持久化
  private static roundRobinCounters = new Map<string, number>();

  constructor(config: MergedConfig, httpRequestHandler: HttpRequestHandler, apiClient?: APIClientInterface) {
    this.config = config;
    this.httpRequestHandler = httpRequestHandler;
    this.apiClient = apiClient;
    
    if (apiClient) {
      secureLogger.info('Pipeline Layers Processor initialized with API client support');
    }
  }

  /**
   * 处理Router层 - 路由决策 (支持API化)
   */
  public async processRouterLayer(input: any, context: RequestContext): Promise<any> {
    // 如果配置了API客户端，尝试使用API调用
    if (this.apiClient) {
      try {
        const apiRequest = {
          input,
          context: {
            ...context,
            startTime: context.startTime.toISOString()
          }
        };

        const apiResponse = await this.apiClient.post(
          '/api/v1/pipeline/router/process',
          apiRequest,
          context.requestId
        );

        if (apiResponse.success && apiResponse.data?.output) {
          secureLogger.info('Router layer processed via API', {
            requestId: context.requestId,
            inputModel: input.model
          });

          const routingDecision = apiResponse.data.output;
          context.routingDecision = routingDecision;
          context.metadata.routingDecision = routingDecision;
          
          context.transformations.push({
            layer: 'router',
            inputModel: input.model,
            outputModel: routingDecision.virtualModel,
            timestamp: new Date(),
            apiMode: true
          });

          return routingDecision;
        }
      } catch (apiError) {
        secureLogger.warn('Router layer API call failed, using direct processing', {
          requestId: context.requestId,
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }

    // 直接处理逻辑（原有逻辑保持不变）
    return this.processRouterLayerDirect(input, context);
  }

  /**
   * Router层直接处理逻辑
   */
  private async processRouterLayerDirect(input: any, context: RequestContext): Promise<any> {
    const { VirtualModelMapper } = require('../../router/virtual-model-mapping');
    const mappedModel = VirtualModelMapper.mapToVirtual(input.model, input);
    
    secureLogger.info('Model mapping completed (direct)', {
      requestId: context.requestId,
      inputModel: input.model,
      mappedModel: mappedModel,
    });

    const availablePipelines = this.getAvailablePipelinesForMappedModel(mappedModel);
    
    // 使用简单的Round Robin负载均衡选择具体的流水线
    let selectedPipeline: string | undefined;
    if (availablePipelines.length > 0) {
      selectedPipeline = this.selectPipelineRoundRobin(availablePipelines);
      secureLogger.info('Round-robin load balancer selected pipeline (direct)', {
        requestId: context.requestId,
        selectedPipeline,
        availablePipelines,
        totalAvailable: availablePipelines.length
      });
    } else {
      selectedPipeline = undefined;
      secureLogger.warn('No pipelines available for load balancing (direct)', {
        requestId: context.requestId,
        mappedModel
      });
    }

    const routingDecision = {
      originalModel: input.model,
      virtualModel: mappedModel,
      availablePipelines: availablePipelines,
      selectedPipeline: selectedPipeline,
      reasoning: selectedPipeline ? 
        `Selected pipeline ${selectedPipeline} from ${availablePipelines.length} available pipelines for ${mappedModel}` :
        `No pipelines available for ${mappedModel}`,
      directMode: true
    };
    
    // 🔧 关键调试信息：longContext路由决策追踪
    if (mappedModel === 'longContext') {
      secureLogger.info('🔥 LongContext路由决策完成 (direct)', {
        requestId: context.requestId,
        originalModel: input.model,
        virtualModel: mappedModel,
        availablePipelines,
        selectedPipeline,
        routerConfigEntry: (this.config as any).router?.[mappedModel],
        expectedProviders: ['shuaihong', 'qwen'],
        actualProviderInPipeline: selectedPipeline ? this.extractProviderFromPipelineId(selectedPipeline) : 'none'
      });
    }

    context.transformations.push({
      layer: 'router',
      inputModel: input.model,
      outputModel: mappedModel,
      timestamp: new Date(),
      directMode: true
    });
    
    // 🔧 修复：确保路由决策信息保存到context中，供Protocol层使用
    context.routingDecision = routingDecision;
    context.metadata.routingDecision = routingDecision;

    return routingDecision;
  }

  /**
   * 处理Transformer层 - 协议转换 (支持API化)
   */
  public async processTransformerLayer(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 如果配置了API客户端，尝试使用API调用
    if (this.apiClient) {
      try {
        const apiRequest = {
          input,
          routingDecision,
          context: {
            ...context,
            startTime: context.startTime.toISOString()
          }
        };

        const apiResponse = await this.apiClient.post(
          '/api/v1/pipeline/transformer/process',
          apiRequest,
          context.requestId
        );

        if (apiResponse.success && apiResponse.data?.output) {
          secureLogger.info('Transformer layer processed via API', {
            requestId: context.requestId
          });

          context.transformations.push({
            layer: 'transformer',
            direction: 'anthropic-to-openai',
            timestamp: new Date(),
            apiMode: true
          });

          return apiResponse.data.output;
        }
      } catch (apiError) {
        secureLogger.warn('Transformer layer API call failed, using direct processing', {
          requestId: context.requestId,
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }

    // 直接处理逻辑
    return this.processTransformerLayerDirect(input, routingDecision, context);
  }

  /**
   * Transformer层直接处理逻辑
   */
  private async processTransformerLayerDirect(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    const selectedPipelineId = routingDecision.selectedPipeline || (routingDecision.availablePipelines && routingDecision.availablePipelines[0]);
    const providerType = this.extractProviderFromPipelineId(selectedPipelineId);
    const providers = this.config.providers || [];
    const matchingProvider = providers.find(p => p.name === providerType);

    let transformerDirection = 'passthrough';
    let transformedRequest = input;
    
    secureLogger.info('Transformer layer processing (direct)', {
      requestId: context.requestId,
      providerType,
      providerProtocol: matchingProvider?.protocol,
      hasInput: !!input && Object.keys(input).length > 0
    });
    
    if (matchingProvider?.protocol === 'openai') {
      transformerDirection = 'anthropic-to-openai';
      try {
        const { SecureAnthropicToOpenAITransformer } = await import('../../modules/transformers/secure-anthropic-openai-transformer');
        const transformer = new SecureAnthropicToOpenAITransformer();
        await transformer.start();
        transformedRequest = await transformer.process(input);
        
        secureLogger.info('Anthropic-to-OpenAI transformation completed (direct)', {
          requestId: context.requestId,
          hasOutput: !!transformedRequest && Object.keys(transformedRequest).length > 0
        });
      } catch (error) {
        secureLogger.error('Transformer processing failed (direct)', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        transformedRequest = input;
      }
    } else if (matchingProvider?.transformer?.use?.includes('openai')) {
      transformerDirection = 'anthropic-to-openai';
      try {
        const { SecureAnthropicToOpenAITransformer } = await import('../../modules/transformers/secure-anthropic-openai-transformer');
        const transformer = new SecureAnthropicToOpenAITransformer();
        await transformer.start();
        transformedRequest = await transformer.process(input);
        
        secureLogger.info('Anthropic-to-OpenAI transformation completed (direct)', {
          requestId: context.requestId,
          hasOutput: !!transformedRequest && Object.keys(transformedRequest).length > 0
        });
      } catch (error) {
        secureLogger.error('Transformer processing failed (direct)', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        transformedRequest = input;
      }
    }

    context.transformations.push({
      layer: 'transformer',
      direction: transformerDirection,
      timestamp: new Date(),
      directMode: true
    });

    secureLogger.info('Transformer layer completed (direct)', {
      requestId: context.requestId,
      direction: transformerDirection,
      outputSize: transformedRequest ? Object.keys(transformedRequest).length : 0
    });

    return transformedRequest;
  }

  /**
   * 处理Protocol层 - 协议处理 (支持API化)
   */
  public async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 如果配置了API客户端，尝试使用API调用
    if (this.apiClient) {
      try {
        const apiRequest = {
          input: request,
          routingDecision,
          context: {
            ...context,
            startTime: context.startTime.toISOString()
          }
        };

        const apiResponse = await this.apiClient.post(
          '/api/v1/pipeline/protocol/process',
          apiRequest,
          context.requestId
        );

        if (apiResponse.success && apiResponse.data?.output) {
          secureLogger.info('Protocol layer processed via API', {
            requestId: context.requestId
          });

          return apiResponse.data.output;
        }
      } catch (apiError) {
        secureLogger.warn('Protocol layer API call failed, using direct processing', {
          requestId: context.requestId,
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }

    // 直接处理逻辑
    return this.processProtocolLayerDirect(request, routingDecision, context);
  }

  /**
   * Protocol层直接处理逻辑
   */
  private async processProtocolLayerDirect(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const selectedPipelineId = routingDecision.selectedPipeline || (routingDecision.availablePipelines && routingDecision.availablePipelines[0]);
    const providerType = this.extractProviderFromPipelineId(selectedPipelineId);
    let providerInfo = this.config.systemConfig.providerTypes[providerType];
    
    // 🔧 关键调试：端点解析追踪
    secureLogger.info('🔍 端点解析调试', {
      requestId: context.requestId,
      selectedPipelineId,
      providerType,
      hasSystemProviderInfo: !!providerInfo,
      systemProviderInfoEndpoint: providerInfo?.endpoint
    });
    
    if (!providerInfo) {
      const providers = this.config.providers || [];
      const matchingProvider = providers.find(p => p.name === providerType);
      
      secureLogger.info('🔧 创建动态provider配置', {
        requestId: context.requestId,
        providerType,
        matchingProviderName: matchingProvider?.name,
        matchingProviderUrl: matchingProvider?.api_base_url
      });
      
      if (matchingProvider?.api_base_url) {
        providerInfo = {
          endpoint: matchingProvider.api_base_url,
          protocol: "openai",
          transformer: "openai-standard",
          timeout: 120000,
          maxRetries: 3
        };
      }
    }

    const providers = this.config.providers || [];
    const matchingProvider = providers.find(p => p.name === providerType);
    
    const endpoint = matchingProvider?.api_base_url || providerInfo?.endpoint;
    
    // 🔧 关键调试：最终端点解析结果
    secureLogger.info('🔥 端点解析结果', {
      requestId: context.requestId,
      selectedPipelineId,
      providerType,
      finalEndpoint: endpoint,
      matchingProviderUrl: matchingProvider?.api_base_url,
      providerInfoEndpoint: providerInfo?.endpoint,
      resolutionPath: matchingProvider?.api_base_url ? 'user-config' : 'system-config'
    });
    let apiKey = matchingProvider?.api_key;
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }

    let actualModel = request.model;
    if (context.routingDecision) {
      const routerConfig = (this.config as any).router;
      const mappedModel = context.routingDecision.virtualModel;
      const selectedPipeline = context.routingDecision.selectedPipeline;
      const routeEntry = routerConfig[mappedModel] || routerConfig.default;
      
      // 🔧 修复：根据选中的pipeline确定对应的provider模型名
      if (routeEntry && typeof routeEntry === 'string' && selectedPipeline) {
        const allRoutes = routeEntry.split(';').map((route: string) => route.trim());
        const selectedProviderType = this.extractProviderFromPipelineId(selectedPipeline);
        
        // 查找匹配选中provider的路由配置
        for (const route of allRoutes) {
          const [routeProviderName, modelName] = route.split(',').map((s: string) => s.trim());
          
          if (routeProviderName === selectedProviderType && modelName) {
            actualModel = modelName;
            secureLogger.info('Protocol layer model mapping', {
              requestId: context.requestId,
              selectedPipeline,
              selectedProvider: selectedProviderType,
              originalModel: request.model,
              virtualModel: mappedModel,
              actualModel: actualModel,
              routeUsed: route
            });
            break;
          }
        }
        
        // 如果没有找到匹配的路由，使用第一个路由的模型名（向后兼容）
        if (actualModel === request.model && allRoutes.length > 0 && allRoutes[0].includes(',')) {
          const [, fallbackModelName] = allRoutes[0].split(',').map((s: string) => s.trim());
          if (fallbackModelName) {
            actualModel = fallbackModelName;
            secureLogger.warn('Protocol layer model mapping fallback', {
              requestId: context.requestId,
              selectedPipeline,
              selectedProvider: selectedProviderType,
              originalModel: request.model,
              virtualModel: mappedModel,
              fallbackModel: actualModel,
              reason: 'No matching provider route found'
            });
          }
        }
      }
    }

    const protocolRequest = {
      ...request,
      model: actualModel,
    };

    // 🔧 为longContext任务设置特殊超时配置
    let timeoutValue = providerInfo?.timeout || context.metadata.configManager?.getConfiguration()?.server?.requestTimeout || 300000;
    
    // 检查是否为longContext任务，设置200秒特殊超时
    if (context.transformations && context.transformations.length > 0) {
      const routerTransform = context.transformations.find(t => t.layer === 'router');
      if (routerTransform && routerTransform.outputModel === 'longContext') {
        timeoutValue = 200000; // 200秒用于长上下文处理
        secureLogger.info('🔥 LongContext超时配置', {
          requestId: context.requestId,
          timeout: timeoutValue,
          reason: 'longContext任务需要更长的处理时间'
        });
      }
    }

    context.metadata.protocolConfig = {
      endpoint,
      apiKey,
      protocol: providerInfo?.protocol,
      timeout: timeoutValue,
      maxRetries: providerInfo?.maxRetries || 3,
      originalModel: request.model,
      actualModel,
      // 🔧 架构修复：Protocol层应该向ServerCompatibility层传递provider信息
      providerType: providerType,
      serverCompatibility: matchingProvider?.serverCompatibility?.use || 'passthrough'
    };

    return protocolRequest;
  }

  /**
   * 处理Server层 - HTTP API调用 (支持API化)
   */
  public async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 如果配置了API客户端，尝试使用API调用
    if (this.apiClient) {
      try {
        const apiRequest = {
          input: request,
          routingDecision,
          context: {
            ...context,
            startTime: context.startTime.toISOString()
          }
        };

        const apiResponse = await this.apiClient.post(
          '/api/v1/pipeline/server/process',
          apiRequest,
          context.requestId
        );

        if (apiResponse.success && apiResponse.data?.output) {
          secureLogger.info('Server layer processed via API', {
            requestId: context.requestId
          });

          return apiResponse.data.output;
        }
      } catch (apiError) {
        secureLogger.warn('Server layer API call failed, using direct processing', {
          requestId: context.requestId,
          error: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }

    // 直接处理逻辑
    return this.processServerLayerDirect(request, routingDecision, context);
  }

  /**
   * Server层直接处理逻辑
   */
  private async processServerLayerDirect(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const protocolConfig = context.metadata.protocolConfig;
    const { endpoint, apiKey, timeout, maxRetries } = protocolConfig;

    let fullEndpoint = endpoint;
    if (endpoint.endsWith('/v1') && !endpoint.includes('/chat/completions')) {
      fullEndpoint = `${endpoint}/chat/completions`;
    }

    const requestBody = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature || 0.7,
      stream: false,
      ...(request.tools && Array.isArray(request.tools) && request.tools.length > 0 ? { tools: request.tools } : {}),
    };

    const serializedBody = JQJsonHandler.stringifyJson(requestBody);
    
    // 🔧 检测大型请求并调整超时配置
    const bodySize = Buffer.from(serializedBody, 'utf8').length;
    const isLongTextRequest = bodySize > API_DEFAULTS.HTTP_CONFIG.LARGE_REQUEST_THRESHOLD;
    const adjustedTimeout = isLongTextRequest ? API_DEFAULTS.HTTP_CONFIG.LONG_REQUEST_TIMEOUT : timeout;
    
    if (isLongTextRequest) {
      secureLogger.info('检测到大型请求，启用长文本处理模式', {
        requestId: context.requestId,
        bodySize,
        originalTimeout: timeout,
        adjustedTimeout,
        endpoint: fullEndpoint
      });
    }
    
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'RCC-v4.0-Pipeline',
      'Content-Length': Buffer.from(serializedBody, 'utf8').length.toString(),
      ...(protocolConfig.customHeaders || {}),
    };

    const httpOptions: HttpRequestOptions = {
      method: 'POST',
      headers,
      body: serializedBody,
      bodyBuffer: Buffer.from(serializedBody, 'utf8'),
      timeout: adjustedTimeout, // 🔧 使用调整后的超时时间
      requestId: context.requestId, // 🔧 传递请求ID以启用心跳机制
      enableHeartbeat: isLongTextRequest, // 🔧 长文本请求启用心跳
    };

    const response = await this.httpRequestHandler.makeHttpRequest(fullEndpoint, httpOptions);
    
    // 使用HttpRequestHandler统一的错误检查方法
    this.httpRequestHandler.checkResponseStatusAndThrow(response, {
      requestId: context.requestId,
      endpoint: fullEndpoint
    });
    
    // 状态码检查通过，尝试解析响应
    try {
      let responseData = JQJsonHandler.parseJsonString(response.body);

      if (responseData.choices && Array.isArray(responseData.choices)) {
        return responseData;
    } else if (responseData.content || responseData.message || responseData.text) {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: responseData.content || responseData.message || responseData.text || 'No content available'
          },
          finish_reason: 'stop'
        }],
        model: request.model,
        usage: responseData.usage || { prompt_tokens: 0, completion_tokens: 0 }
      };
    } else {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: JQJsonHandler.stringifyJson(responseData, true)
          },
          finish_reason: 'stop'
        }],
        model: request.model,
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      };
    }
    } catch (parseError) {
      // JSON解析失败时的错误处理
      secureLogger.error('响应JSON解析失败', {
        requestId: context.requestId,
        responseBody: response.body?.substring(0, 200) + '...',
        responseBodyLength: response.body?.length,
        responseStatus: response.status,
        parseError: parseError.message
      });

      // JSON解析失败通常意味着服务器返回了无效响应，应该抛出错误以触发重试
      const errorMessage = `Invalid JSON response from server. Status: ${response.status}, Parse Error: ${parseError.message}`;
      throw new Error(errorMessage);
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