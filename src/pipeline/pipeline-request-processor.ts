/**
 * Pipeline请求处理器 - 处理6层流水线逻辑
 *
 * 职责：
 * 1. 处理完整的6层流水线请求处理逻辑
 * 2. 路由、转换、协议、兼容性、服务器层的协调
 * 3. 请求/响应的层级处理和错误管理
 *
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { MergedConfig } from '../config/config-reader';
import { PipelineCompatibilityManager } from './pipeline-compatibility-manager';
import { DebugManagerImpl } from '../debug/debug-manager';
import https from 'https';
import http from 'http';

export interface RequestContext {
  requestId: string;
  startTime: Date;
  layerTimings: Record<string, number>;
  routingDecision?: any;
  transformations: any[];
  errors: any[];
  metadata: any;
}

export interface PipelineStats {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  layerHealth: Record<string, any>;
  routerStats: any;
}

/**
 * Pipeline请求处理器
 * 负责完整的6层流水线请求处理
 */
export class PipelineRequestProcessor extends EventEmitter {
  private config: MergedConfig;
  private compatibilityManager: PipelineCompatibilityManager;
  private stats: PipelineStats;
  private responseTimeHistory: number[] = [];
  private debugManager: DebugManagerImpl;

  constructor(config: MergedConfig, debugEnabled: boolean = false) {
    super();
    this.config = config;
    this.compatibilityManager = new PipelineCompatibilityManager(config);
    
    this.stats = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      layerHealth: {},
      routerStats: {},
    };

    // 初始化Debug管理器
    this.debugManager = new DebugManagerImpl({
      enabled: debugEnabled,
      maxRecordSize: 10 * 1024 * 1024, // 10MB
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24小时
      retentionDays: 7,
      compressionEnabled: true,
      storageBasePath: './debug-logs',
      modules: {
        'pipeline-request-processor': { enabled: true, logLevel: 'debug' },
        'router': { enabled: true, logLevel: 'debug' },
        'transformer': { enabled: true, logLevel: 'debug' },
        'protocol': { enabled: true, logLevel: 'debug' },
        'server-compatibility': { enabled: true, logLevel: 'debug' },
        'server': { enabled: true, logLevel: 'debug' },
        'response-transformer': { enabled: true, logLevel: 'debug' },
      }
    });

    // 注册所有流水线模块
    this.registerDebugModules();
  }

  /**
   * 注册Debug模块
   */
  private registerDebugModules(): void {
    const defaultPort = this.config.server?.port || 5506;
    
    this.debugManager.registerModule('pipeline-request-processor', defaultPort);
    this.debugManager.registerModule('router', defaultPort);
    this.debugManager.registerModule('transformer', defaultPort);
    this.debugManager.registerModule('protocol', defaultPort);
    this.debugManager.registerModule('server-compatibility', defaultPort);
    this.debugManager.registerModule('server', defaultPort);
    this.debugManager.registerModule('response-transformer', defaultPort);

    // 简化：不需要复杂的session管理，直接记录requests
    console.log(`📦 Debug系统已初始化 (端口: ${defaultPort})`);
  }

  /**
   * 处理Pipeline请求 - 完整的6层处理逻辑
   */
  async processRequest(protocol: string, input: any, executionContext: any): Promise<any> {
    const requestId = executionContext.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: RequestContext = {
      requestId,
      startTime: new Date(),
      layerTimings: {},
      transformations: [],
      errors: [],
      metadata: executionContext.metadata || {},
    };

    try {
      this.stats.totalRequests++;
      
      secureLogger.info('Starting pipeline request processing', {
        requestId,
        protocol,
        hasInput: !!input,
        executionContext: executionContext.debug ? executionContext : '[CONTEXT_PRESENT]',
      });

      // Step 1: Router层 - 路由决策
      const routerStart = Date.now();
      this.debugManager.recordInput('router', requestId, input);
      const routingDecision = await this.processRouterLayer(input, context);
      this.debugManager.recordOutput('router', requestId, routingDecision);
      context.layerTimings.router = Date.now() - routerStart;
      context.routingDecision = routingDecision;

      // Step 2: Transformer层 - 协议转换
      const transformerStart = Date.now();
      this.debugManager.recordInput('transformer', requestId, { input, routingDecision });
      const transformedRequest = await this.processTransformerLayer(
        input,
        routingDecision,
        context
      );
      this.debugManager.recordOutput('transformer', requestId, transformedRequest);
      context.layerTimings.transformer = Date.now() - transformerStart;

      // Step 3: Protocol层 - 协议处理
      const protocolStart = Date.now();
      this.debugManager.recordInput('protocol', requestId, { transformedRequest, routingDecision });
      const protocolRequest = await this.processProtocolLayer(
        transformedRequest,
        routingDecision,
        context
      );
      this.debugManager.recordOutput('protocol', requestId, protocolRequest);
      context.layerTimings.protocol = Date.now() - protocolStart;

      // Step 4: Server-Compatibility层 - 兼容性处理
      const compatibilityStart = Date.now();
      this.debugManager.recordInput('server-compatibility', requestId, { protocolRequest, routingDecision });
      const compatibleRequest = await this.compatibilityManager.processServerCompatibilityLayer(
        protocolRequest,
        routingDecision,
        context
      );
      this.debugManager.recordOutput('server-compatibility', requestId, compatibleRequest);
      context.layerTimings.serverCompatibility = Date.now() - compatibilityStart;

      // Step 5: Server层 - 实际API调用
      const serverStart = Date.now();
      this.debugManager.recordInput('server', requestId, { compatibleRequest, routingDecision });
      const response = await this.processServerLayer(compatibleRequest, routingDecision, context);
      this.debugManager.recordOutput('server', requestId, response);
      context.layerTimings.server = Date.now() - serverStart;

      // Step 6: 响应转换层 - 将响应转换为原始协议格式
      const transformStart = Date.now();
      this.debugManager.recordInput('response-transformer', requestId, { response, protocol });
      const finalResponse = await this.processResponseTransformation(response, protocol, context);
      this.debugManager.recordOutput('response-transformer', requestId, finalResponse);
      context.layerTimings.responseTransform = Date.now() - transformStart;

      // 计算总响应时间
      const totalTime = Date.now() - context.startTime.getTime();
      this.updateResponseTimeStats(totalTime);

      this.stats.successfulRequests++;

      secureLogger.info('Request processing completed successfully', {
        requestId,
        totalTime,
        layerTimings: context.layerTimings,
        transformationCount: context.transformations.length,
      });

      return {
        executionId: requestId,
        pipelineId: routingDecision.selectedPipeline || 'default',
        startTime: context.startTime.getTime(),
        endTime: Date.now(),
        result: finalResponse,
        error: null,
        performance: {
          startTime: context.startTime.getTime(),
          endTime: Date.now(),
          totalTime,
          moduleTimings: context.layerTimings,
        },
        metadata: {
          processingSteps: context.transformations.map(t => t.layer),
          routingDecision,
          layerCount: Object.keys(context.layerTimings).length,
        }
      };

    } catch (error) {
      const totalTime = Date.now() - context.startTime.getTime();
      this.stats.failedRequests++;

      // 记录详细的错误信息
      context.errors.push({
        layer: 'pipeline',
        error: error.message,
        timestamp: new Date(),
      });

      // Debug记录错误
      this.debugManager.recordError('pipeline-request-processor', requestId, {
        message: error.message,
        stack: error.stack,
        type: 'PipelineProcessingError',
        code: 'PIPELINE_ERROR',
        timestamp: new Date(),
        context: {
          layerTimings: context.layerTimings,
          errors: context.errors,
        }
      } as any);

      secureLogger.error('Request processing failed', {
        requestId,
        error: error.message,
        stack: error.stack,
        layerTimings: context.layerTimings,
        errors: context.errors,
      });

      secureLogger.warn('Request failed', {
        requestId,
        error: error.message,
      });

      throw new Error(`Pipeline request processing failed: ${error.message}`);
    }
  }

  /**
   * 处理Router层 - 路由决策
   */
  private async processRouterLayer(input: any, context: RequestContext): Promise<any> {
    // 使用模型映射系统
    const { VirtualModelMapper } = require('../router/virtual-model-mapping');
    const mappedModel = VirtualModelMapper.mapToVirtual(input.model, input);
    
    secureLogger.info('Model mapping completed', {
      requestId: context.requestId,
      inputModel: input.model,
      mappedModel: mappedModel,
      priority: 99, // 模型映射的优先级
      tokenCount: '[REDACTED]', // 不记录具体token数量
    });

    // 构建路由决策结果 - 使用实际的流水线ID
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

    secureLogger.info('Router layer completed', {
      requestId: context.requestId,
      routingDecision,
      timing: context.layerTimings.router || 0,
    });

    return routingDecision;
  }

  /**
   * 处理Transformer层 - 协议转换
   */
  private async processTransformerLayer(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 🔧 关键修复：使用真实的SecureAnthropicToOpenAITransformer进行协议转换
    const { SecureAnthropicToOpenAITransformer } = await import('../modules/transformers/secure-anthropic-openai-transformer');
    const transformer = new SecureAnthropicToOpenAITransformer();
    await transformer.start();

    // 进行Anthropic → OpenAI协议转换
    const transformedRequest = await transformer.process(input);

    // 应用路由决策的模型映射
    (transformedRequest as any).model = routingDecision.virtualModel || input.model;

    context.transformations.push({
      layer: 'transformer',
      direction: 'anthropic-to-openai',
      timestamp: new Date(),
    });

    secureLogger.debug('Transformer layer processing', {
      requestId: context.requestId,
      originalModel: input.model,
      transformedModel: (transformedRequest as any).model,
      hasTools: Array.isArray(input.tools) && input.tools.length > 0,
      transformedMessageCount: (transformedRequest as any)?.messages?.length || 0,
      originalMessageCount: input?.messages?.length || 0,
    });

    return transformedRequest;
  }

  /**
   * 处理Protocol层 - 协议处理
   */
  private async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 从路由决策中获取provider信息
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    let providerInfo = this.config.systemConfig.providerTypes[providerType];
    
    // 🔧 修复硬编码问题：如果system config中没有找到provider类型，使用动态默认配置
    if (!providerInfo) {
      // 获取用户配置中的provider信息来创建默认配置
      const providers = this.config.providers || [];
      const matchingProvider = providers.find(p => p.name === providerType);
      
      if (matchingProvider && matchingProvider.api_base_url) {
        // 根据用户配置动态生成provider信息
        providerInfo = {
          endpoint: matchingProvider.api_base_url,
          protocol: "openai", // 默认使用OpenAI协议
          transformer: "openai-standard", // 默认transformer
          timeout: 30000,
          maxRetries: 3
        };
        
        secureLogger.info(`💡 动态生成provider配置`, {
          providerType,
          endpoint: providerInfo.endpoint,
          protocol: providerInfo.protocol
        });
      } else {
        throw new Error(`Provider type '${providerType}' not found in system config and cannot be auto-generated from user config`);
      }
    }

    // 获取provider endpoint和认证信息
    const providers = this.config.providers || [];
    const matchingProvider = providers.find(p => p.name === providerType);
    
    if (!matchingProvider) {
      throw new Error(`Provider '${providerType}' not found in user config`);
    }

    const endpoint = matchingProvider.api_base_url || providerInfo.endpoint;
    
    // 🔧 关键修复：处理多API密钥配置
    let apiKey = matchingProvider.api_key;
    if (Array.isArray(apiKey)) {
      // 如果是数组，使用第一个可用的密钥
      apiKey = apiKey[0];
      secureLogger.debug('Protocol层：多密钥配置检测', {
        requestId: context.requestId,
        providerType,
        totalKeys: matchingProvider.api_key.length,
        selectedKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
      });
    }

    secureLogger.debug('Protocol layer processing', {
      requestId: context.requestId,
      providerType,
      protocolType: providerInfo.protocol,
      endpoint: endpoint,
    });

    // 🔧 关键修复：从路由决策中获取实际的模型名
    // 如果当前模型是映射模型，需要获取实际映射的模型名
    let actualModel = request.model;
    if (context.routingDecision && context.routingDecision.originalModel !== context.routingDecision.virtualModel) {
      // 从配置中获取实际的模型名
      const routerConfig = (this.config as any).router;
      const mappedModel = context.routingDecision.virtualModel;
      
      // 首先尝试直接匹配映射模型，如果没有则使用default路由
      let routeEntry = routerConfig[mappedModel] || routerConfig.default;
      
      if (routeEntry) {
        const [, modelName] = routeEntry.split(',');
        if (modelName) {
          actualModel = modelName;
          secureLogger.info('Protocol层：模型名映射', {
            requestId: context.requestId,
            mappedModel,
            actualModel,
            routeEntry,
            usedDefault: !routerConfig[mappedModel]
          });
        }
      }
    }

    // 添加认证头和端点信息
    const protocolRequest = {
      ...request,
      __internal: {
        endpoint: endpoint,
        apiKey: apiKey,
        protocol: providerInfo.protocol,
        timeout: providerInfo.timeout,
        maxRetries: providerInfo.maxRetries,
        actualModel: actualModel, // 🔧 关键修复：传递实际的模型名给后续层
      },
    };

    return protocolRequest;
  }

  /**
   * 处理Server层 - 实际HTTP API调用
   */
  private async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 🔧 关键修复：防御性检查__internal对象
    if (!request.__internal) {
      throw new Error(`Server layer requires __internal configuration but it was not found. Request may have been improperly processed by compatibility layer.`);
    }

    const { endpoint, apiKey, protocol, timeout, maxRetries } = request.__internal;

    // 🔧 关键修复：防御性检查endpoint
    if (!endpoint) {
      throw new Error(`Server layer requires endpoint configuration but it was not found in __internal object.`);
    }

    // 🔧 关键修复：通用端点处理，基于配置而非硬编码
    let fullEndpoint = endpoint;
    // 如果端点以 /v1 结尾但不包含具体API路径，则添加标准的chat/completions路径
    if (endpoint.endsWith('/v1') && !endpoint.includes('/chat/completions') && !endpoint.includes('/messages') && !endpoint.includes('/generateContent')) {
      fullEndpoint = `${endpoint}/chat/completions`;
    }

    secureLogger.debug('Server layer processing', {
      requestId: context.requestId,
      originalEndpoint: endpoint,
      fullEndpoint,
      model: request.model,
      apiKeyPresent: !!apiKey,
      protocol,
      timeout,
    });

    // 构建HTTP请求
    const httpOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'RCC-v4.0-Pipeline',
      },
      body: JQJsonHandler.stringifyJson({
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature || 0.7,
        stream: false, // 🔧 关键修复：强制禁用流式响应，使用标准JSON格式
        tools: request.tools,
      }),
      timeout,
    };

    // 执行实际的HTTP请求
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        secureLogger.debug('Attempting HTTP request', {
          requestId: context.requestId,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          originalEndpoint: endpoint,
          fullEndpoint,
        });

        const response = await this.makeHttpRequest(fullEndpoint, httpOptions);

        secureLogger.info('HTTP request successful', {
          requestId: context.requestId,
          attempt: attempt + 1,
          statusCode: response.status,
          responseSize: response.body?.length || 0,
        });

        // 解析响应
        const responseData = JQJsonHandler.parseJsonString(response.body);

        // 🔍 调试日志：记录API实际返回的响应格式
        secureLogger.info('API响应格式检查', {
          requestId: context.requestId,
          responseKeys: Object.keys(responseData),
          hasChoices: !!responseData.choices,
          choicesType: Array.isArray(responseData.choices) ? 'array' : typeof responseData.choices,
          choicesLength: Array.isArray(responseData.choices) ? responseData.choices.length : 'n/a',
          responsePreview: JQJsonHandler.stringifyJson(responseData, true).substring(0, 200) + '...',
        });

        // 验证响应格式
        if (!responseData.choices || !Array.isArray(responseData.choices)) {
          secureLogger.error('API响应格式验证失败', {
            requestId: context.requestId,
            actualResponse: responseData,
            hasChoices: !!responseData.choices,
            choicesType: typeof responseData.choices,
          });
          throw new Error('Invalid response format: missing choices array');
        }

        // 清理内部配置信息
        delete request.__internal;

        return responseData;

      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxRetries;

        secureLogger.warn('HTTP request failed', {
          requestId: context.requestId,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: error.message,
          isLastAttempt,
          willRetry: !isLastAttempt,
        });

        if (!isLastAttempt) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 如果所有重试都失败，抛出最后的错误
    secureLogger.error('All HTTP request attempts failed', {
      requestId: context.requestId,
      totalAttempts: maxRetries + 1,
      finalError: lastError?.message,
    });

    throw lastError || new Error('HTTP request failed after all retries');
  }

  /**
   * 执行HTTP请求 - 使用原生Node.js HTTP/HTTPS
   */
  private async makeHttpRequest(url: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'POST',
          headers: options.headers,
          timeout: options.timeout || 30000,
        };

        const req = httpModule.request(requestOptions, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: responseData,
              headers: res.headers,
            });
          });
        });

        req.on('error', (error) => {
          secureLogger.error('HTTP请求失败', {
            url,
            error: error.message,
            stack: error.stack,
          });
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          const timeoutError = new Error(`Request timeout after ${options.timeout}ms`);
          secureLogger.error('HTTP请求超时', {
            url,
            timeout: options.timeout,
          });
          reject(timeoutError);
        });

        // 写入请求体
        if (options.body) {
          req.write(options.body);
        }
        
        req.end();

      } catch (error) {
        secureLogger.error('HTTP请求创建失败', {
          url,
          error: error.message,
          stack: error.stack,
        });
        reject(error);
      }
    });
  }

  /**
   * 处理响应转换层 - 将OpenAI格式响应转换为原始协议格式
   */
  private async processResponseTransformation(response: any, originalProtocol: string, context: RequestContext): Promise<any> {
    secureLogger.debug('Response transformation processing', {
      requestId: context.requestId,
      originalProtocol,
      responseType: response?.object || 'unknown',
    });

    // 如果原始协议是anthropic，将OpenAI格式转换为Anthropic格式
    if (originalProtocol === 'anthropic') {
      return this.transformOpenAIToAnthropic(response, context);
    }

    // 如果原始协议是openai或其他，保持原格式
    return response;
  }

  /**
   * 将OpenAI格式响应转换为Anthropic格式
   */
  private transformOpenAIToAnthropic(openaiResponse: any, context: RequestContext): any {
    try {
      // 提取OpenAI响应的内容
      const choice = openaiResponse.choices?.[0];
      const message = choice?.message;
      const content = message?.content || '';
      const toolCalls = message?.tool_calls;

      // 构建Anthropic格式的content数组
      const anthropicContent: any[] = [];

      // 添加文本内容（如果有）
      if (content && content.trim()) {
        anthropicContent.push({
          type: 'text',
          text: content
        });
      }

      // 处理tool calls（如果有）
      if (toolCalls && Array.isArray(toolCalls)) {
        toolCalls.forEach((toolCall: any) => {
          anthropicContent.push({
            type: 'tool_use',
            id: toolCall.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: toolCall.function?.name || 'unknown_tool',
            input: toolCall.function?.arguments ? 
              (typeof toolCall.function.arguments === 'string' ? 
                JSON.parse(toolCall.function.arguments) : 
                toolCall.function.arguments) : {}
          });
        });
      }

      // 如果没有任何内容，添加默认文本
      if (anthropicContent.length === 0) {
        anthropicContent.push({
          type: 'text',
          text: 'I can help you with that.'
        });
      }

      // 确定stop_reason
      let stopReason = 'end_turn';
      if (choice?.finish_reason === 'tool_calls') {
        stopReason = 'tool_use';
      } else if (choice?.finish_reason === 'length') {
        stopReason = 'max_tokens';
      }

      // 构建Anthropic格式的响应
      const anthropicResponse = {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: anthropicContent,
        model: openaiResponse.model || 'rcc4-router',
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: openaiResponse.usage?.prompt_tokens || 0,
          output_tokens: openaiResponse.usage?.completion_tokens || 0
        }
      };

      context.transformations.push({
        layer: 'response-transformer',
        direction: 'openai-to-anthropic',
        timestamp: new Date(),
      });

      secureLogger.debug('Response transformed to Anthropic format', {
        requestId: context.requestId,
        originalId: openaiResponse.id,
        transformedId: anthropicResponse.id,
        contentBlocks: anthropicContent.length,
        hasToolCalls: toolCalls && toolCalls.length > 0,
        stopReason: stopReason,
        textContentLength: content.length,
      });

      return anthropicResponse;

    } catch (error) {
      secureLogger.error('Response transformation failed', {
        requestId: context.requestId,
        error: error.message,
        originalResponse: openaiResponse,
      });

      // 返回备用的Anthropic格式响应
      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '⚠️ 响应转换失败，但RCC4流水线处理成功。'
          }
        ],
        model: 'rcc4-router',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      };
    }
  }

  /**
   * 从流水线ID中提取Provider类型
   */
  private extractProviderFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    return parts[0] || 'unknown';
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTimeStats(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);
    
    // 保持最近100个响应时间记录
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }
    
    // 计算平均响应时间
    const sum = this.responseTimeHistory.reduce((a, b) => a + b, 0);
    this.stats.averageResponseTime = sum / this.responseTimeHistory.length;
  }

  /**
   * 获取处理器统计信息
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * 获取映射模型的可用流水线ID
   * 基于已知的流水线表配置
   */
  private getAvailablePipelinesForMappedModel(mappedModel: string): string[] {
    // 根据配置文件动态生成pipeline ID
    const routerConfig = (this.config as any).router;
    
    console.log(`🔍 Debug: getAvailablePipelinesForMappedModel - mappedModel=${mappedModel}`);
    console.log(`🔍 Debug: routerConfig=`, JSON.stringify(routerConfig, null, 2));
    
    if (routerConfig && routerConfig[mappedModel]) {
      const routeEntry = routerConfig[mappedModel];
      console.log(`🔍 Debug: Found route entry for ${mappedModel}: ${routeEntry}`);
      
      // 解析 "provider,model" 格式
      const [providerName, modelName] = routeEntry.split(',');
      
      if (providerName && modelName) {
        // 生成pipeline ID格式: provider-model-key0
        const pipelineId = `${providerName}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        console.log(`🔍 Debug: Generated pipeline ID: ${pipelineId}`);
        return [pipelineId];
      }
    }
    
    // 如果没有配置或解析失败，尝试使用default路由
    if (mappedModel !== 'default' && routerConfig && routerConfig.default) {
      const defaultRoute = routerConfig.default;
      const [providerName, modelName] = defaultRoute.split(',');
      
      if (providerName && modelName) {
        const pipelineId = `${providerName}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        console.log(`🔍 Debug: Using default route, generated pipeline ID: ${pipelineId}`);
        return [pipelineId];
      }
    }
    
    // 最终fallback - 检查配置中的第一个Provider
    const providers = (this.config as any).providers;
    console.log(`🔍 Debug: Fallback to providers=`, JSON.stringify(providers, null, 2));
    if (providers && providers.length > 0) {
      const firstProvider = providers[0];
      if (firstProvider.models && firstProvider.models.length > 0) {
        const modelName = firstProvider.models[0];
        const pipelineId = `${firstProvider.name}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        console.log(`🔍 Debug: Fallback generated pipeline ID: ${pipelineId}`);
        return [pipelineId];
      }
    }
    
    // 如果所有方法都失败，返回空数组
    console.log(`🔍 Debug: All methods failed, returning empty array`);
    return [];
  }

  /**
   * 清理debug系统资源
   */
  async cleanup(): Promise<void> {
    if (this.debugManager) {
      await this.debugManager.cleanup();
    }
  }
}