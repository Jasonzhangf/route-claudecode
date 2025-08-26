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
 * 负责六层流水线中的四个核心处理层
 */
export class PipelineLayersProcessor {
  private config: MergedConfig;
  private httpRequestHandler: HttpRequestHandler;

  constructor(config: MergedConfig, httpRequestHandler: HttpRequestHandler) {
    this.config = config;
    this.httpRequestHandler = httpRequestHandler;
  }

  /**
   * 处理Router层 - 路由决策
   */
  public async processRouterLayer(input: any, context: RequestContext): Promise<any> {
    const { VirtualModelMapper } = require('../../router/virtual-model-mapping');
    const mappedModel = VirtualModelMapper.mapToVirtual(input.model, input);
    
    secureLogger.info('Model mapping completed', {
      requestId: context.requestId,
      inputModel: input.model,
      mappedModel: mappedModel,
    });

    const availablePipelines = this.getAvailablePipelinesForMappedModel(mappedModel);
    const routingDecision = {
      originalModel: input.model,
      virtualModel: mappedModel,
      availablePipelines: availablePipelines,
      reasoning: `Found ${availablePipelines.length} healthy pipelines for ${mappedModel}`
    };

    context.transformations.push({
      layer: 'router',
      inputModel: input.model,
      outputModel: mappedModel,
      timestamp: new Date(),
    });

    return routingDecision;
  }

  /**
   * 处理Transformer层 - 协议转换
   */
  public async processTransformerLayer(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    const providers = this.config.providers || [];
    const matchingProvider = providers.find(p => p.name === providerType);

    let transformerDirection = 'passthrough';
    let transformedRequest = input;
    
    secureLogger.info('Transformer layer processing', {
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
        
        secureLogger.info('Anthropic-to-OpenAI transformation completed', {
          requestId: context.requestId,
          hasOutput: !!transformedRequest && Object.keys(transformedRequest).length > 0
        });
      } catch (error) {
        secureLogger.error('Transformer processing failed', {
          requestId: context.requestId,
          error: error.message
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
        
        secureLogger.info('Anthropic-to-OpenAI transformation completed', {
          requestId: context.requestId,
          hasOutput: !!transformedRequest && Object.keys(transformedRequest).length > 0
        });
      } catch (error) {
        secureLogger.error('Transformer processing failed', {
          requestId: context.requestId,
          error: error.message
        });
        transformedRequest = input;
      }
    }

    context.transformations.push({
      layer: 'transformer',
      direction: transformerDirection,
      timestamp: new Date(),
    });

    secureLogger.info('Transformer layer completed', {
      requestId: context.requestId,
      direction: transformerDirection,
      outputSize: transformedRequest ? Object.keys(transformedRequest).length : 0
    });

    return transformedRequest;
  }

  /**
   * 处理Protocol层 - 协议处理
   */
  public async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    let providerInfo = this.config.systemConfig.providerTypes[providerType];
    
    if (!providerInfo) {
      const providers = this.config.providers || [];
      const matchingProvider = providers.find(p => p.name === providerType);
      
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
    let apiKey = matchingProvider?.api_key;
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }

    let actualModel = request.model;
    if (context.routingDecision) {
      const routerConfig = (this.config as any).router;
      const mappedModel = context.routingDecision.virtualModel;
      const routeEntry = routerConfig[mappedModel] || routerConfig.default;
      
      if (routeEntry && typeof routeEntry === 'string' && routeEntry.includes(',')) {
        const firstRoute = routeEntry.split(';')[0].trim();
        const [, modelName] = firstRoute.split(',');
        if (modelName?.trim()) {
          actualModel = modelName.trim();
        }
      }
    }

    const protocolRequest = {
      ...request,
      model: actualModel,
    };

    context.metadata.protocolConfig = {
      endpoint,
      apiKey,
      protocol: providerInfo?.protocol,
      timeout: providerInfo?.timeout || 30000,
      maxRetries: providerInfo?.maxRetries || 3,
      originalModel: request.model,
      actualModel,
    };

    return protocolRequest;
  }

  /**
   * 处理Server层 - HTTP API调用
   */
  public async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
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
      timeout,
    };

    const response = await this.httpRequestHandler.makeHttpRequest(fullEndpoint, httpOptions);
    
    // 添加响应体调试信息和更好的错误处理
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

      // 尝试返回原始响应作为文本内容
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: `服务器返回了无效的JSON格式响应。状态码: ${response.status}, 响应长度: ${response.body?.length || 0}字节。\n\n原始响应预览:\n${response.body?.substring(0, 500) || '空响应'}`
          },
          finish_reason: 'stop'
        }],
        model: request.model,
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        error: {
          type: 'json_parse_error',
          message: parseError.message,
          response_preview: response.body?.substring(0, 100)
        }
      };
    }
  }

  private extractProviderFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    return parts[0] || 'unknown';
  }

  private getAvailablePipelinesForMappedModel(mappedModel: string): string[] {
    const routerConfig = (this.config as any).router;
    
    if (routerConfig && routerConfig[mappedModel]) {
      const routeEntry = routerConfig[mappedModel];
      const firstRoute = routeEntry.split(';')[0].trim();
      const [providerName, modelName] = firstRoute.split(',');
      
      if (providerName && modelName) {
        const pipelineId = `${providerName}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        return [pipelineId];
      }
    }
    
    if (mappedModel !== 'default' && routerConfig?.default) {
      const defaultRoute = routerConfig.default;
      const firstDefaultRoute = defaultRoute.split(';')[0].trim();
      const [providerName, modelName] = firstDefaultRoute.split(',');
      
      if (providerName && modelName) {
        const pipelineId = `${providerName}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        return [pipelineId];
      }
    }
    
    const providers = (this.config as any).providers;
    if (providers?.length > 0) {
      const firstProvider = providers[0];
      if (firstProvider.models?.length > 0) {
        const modelName = firstProvider.models[0];
        const pipelineId = `${firstProvider.name}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        return [pipelineId];
      }
    }
    
    return [];
  }
}