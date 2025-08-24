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
import { PipelineDebugRecorder } from '../debug/pipeline-debug-recorder';
import https from 'https';
import http from 'http';

// 导入验证器
import { protocolTransformerValidator, ValidationResult } from '../validation/protocol-transformer-validator';

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
 * Module Processing Context - Architecture Engineer 设计
 * 用于在各层之间传递配置信息，避免污染API数据
 */
export interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
  };
  readonly metadata?: Record<string, any>;
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
  private pipelineDebugRecorder: PipelineDebugRecorder;

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

    // 初始化Pipeline Debug记录器
    const defaultPort = this.config.server?.port || 5506;
    this.pipelineDebugRecorder = new PipelineDebugRecorder(defaultPort, debugEnabled);

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

      // 🔍 验证: Transformer → Protocol (必须是OpenAI格式)
      const transformerValidation = protocolTransformerValidator.validateTransformerToProtocol(transformedRequest, {
        requestId,
        step: 'transformer-to-protocol'
      });
      
      if (!transformerValidation.isValid) {
        const errorMsg = `Transformer输出格式验证失败: ${transformerValidation.errors.join(', ')}`;
        secureLogger.error('❌ [Pipeline] Transformer输出格式验证失败', {
          requestId,
          errors: transformerValidation.errors,
          warnings: transformerValidation.warnings,
          summary: transformerValidation.summary
        });
        this.stats.failedRequests++;
        throw new Error(errorMsg);
      }
      
      secureLogger.info('✅ [Pipeline] Transformer输出验证通过', {
        requestId,
        format: transformerValidation.format,
        summary: transformerValidation.summary
      });

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

      // 🔍 验证: Protocol → ServerCompatibility (必须是Protocol格式，不是Anthropic)
      if (protocolRequest && typeof protocolRequest === 'object') {
        const hasAnthropicFields = (protocolRequest as any).type === 'message' || 
                                  (protocolRequest as any).stop_reason ||
                                  ((protocolRequest as any).content && Array.isArray((protocolRequest as any).content));
        
        if (hasAnthropicFields) {
          const errorMsg = `Protocol输出仍然是Anthropic格式，应该是OpenAI/Protocol格式`;
          secureLogger.error('❌ [Pipeline] Protocol输出格式错误', {
            requestId,
            error: errorMsg,
            hasType: !!(protocolRequest as any).type,
            hasStopReason: !!(protocolRequest as any).stop_reason,
            hasContentArray: Array.isArray((protocolRequest as any).content)
          });
          this.stats.failedRequests++;
          throw new Error(errorMsg);
        }
        
        secureLogger.info('✅ [Pipeline] Protocol输出验证通过（非Anthropic格式）', {
          requestId,
          hasModel: !!(protocolRequest as any).model,
          hasMessages: !!(protocolRequest as any).messages,
          isOpenAIFormat: !!(protocolRequest as any).model && !!(protocolRequest as any).messages
        });
      }

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

      // 🔍 验证: ServerCompatibility → Server (必须是OpenAI格式，不是兼容格式)
      const compatibilityValidation = protocolTransformerValidator.validateTransformerToProtocol(compatibleRequest, {
        requestId,
        step: 'compatibility-to-server'
      });
      
      if (!compatibilityValidation.isValid) {
        const errorMsg = `ServerCompatibility输出格式验证失败: ${compatibilityValidation.errors.join(', ')}`;
        secureLogger.error('❌ [Pipeline] ServerCompatibility输出格式验证失败', {
          requestId,
          errors: compatibilityValidation.errors,
          warnings: compatibilityValidation.warnings,
          summary: compatibilityValidation.summary
        });
        this.stats.failedRequests++;
        throw new Error(errorMsg);
      }
      
      secureLogger.info('✅ [Pipeline] ServerCompatibility输出验证通过', {
        requestId,
        format: compatibilityValidation.format,
        summary: compatibilityValidation.summary
      });

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

      // 记录完整的Pipeline执行
      this.recordCompletePipelineExecution(
        requestId,
        protocol as 'anthropic' | 'openai' | 'gemini',
        input,
        finalResponse,
        totalTime,
        context,
        true
      );

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

      // 记录失败的Pipeline执行
      this.recordCompletePipelineExecution(
        requestId,
        protocol as 'anthropic' | 'openai' | 'gemini',
        input,
        null,
        totalTime,
        context,
        false,
        error.message
      );

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
   * 处理Transformer层 - 基于协议自动选择转换器
   */
  private async processTransformerLayer(input: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 🔧 关键修复：基于配置的协议字段自动选择transformer
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    const providers = this.config.providers || [];
    const matchingProvider = providers.find(p => p.name === providerType);

    if (!matchingProvider) {
      throw new Error(`Provider '${providerType}' not found in user config`);
    }

    // 🔧 新架构：基于protocol字段自动选择transformer
    let transformerDirection = 'passthrough';
    let transformedRequest = input;
    
    // 检查新统一格式的protocol字段
    if (matchingProvider.protocol) {
      const protocol = matchingProvider.protocol;
      secureLogger.info('🔧 使用新统一格式的protocol配置', {
        requestId: context.requestId,
        providerName: providerType,
        protocol: protocol,
        architecture: 'unified-format'
      });

      // 新架构逻辑：protocol决定transformer选择
      if (protocol === 'openai') {
        // protocol: "openai" -> 需要anthropic-to-openai转换
        transformerDirection = 'anthropic-to-openai';
        const { SecureAnthropicToOpenAITransformer } = await import('../modules/transformers/secure-anthropic-openai-transformer');
        const transformer = new SecureAnthropicToOpenAITransformer();
        await transformer.start();
        transformedRequest = await transformer.process(input);
      } else if (protocol === 'anthropic') {
        // protocol: "anthropic" -> passthrough，无需转换
        transformerDirection = 'passthrough';
        transformedRequest = input;
      } else {
        secureLogger.warn('🔧 未知协议类型，使用passthrough', {
          requestId: context.requestId,
          protocol: protocol,
          fallback: 'passthrough'
        });
      }
    } else {
      // 向后兼容：检查旧格式的transformer配置
      secureLogger.info('🔧 使用向后兼容的transformer配置', {
        requestId: context.requestId,
        providerName: providerType,
        hasTransformerConfig: !!matchingProvider.transformer
      });

      if (matchingProvider.transformer?.use?.includes('openai')) {
        transformerDirection = 'anthropic-to-openai';
        const { SecureAnthropicToOpenAITransformer } = await import('../modules/transformers/secure-anthropic-openai-transformer');
        const transformer = new SecureAnthropicToOpenAITransformer();
        await transformer.start();
        transformedRequest = await transformer.process(input);
      }
    }

    // 🔧 关键修复：不要覆盖model字段，保持原始模型名用于API调用
    // 路由映射将通过Protocol层的__internal.actualModel传递
    // (transformedRequest as any).model = routingDecision.virtualModel || input.model;

    context.transformations.push({
      layer: 'transformer',
      direction: transformerDirection,
      timestamp: new Date(),
    });

    secureLogger.debug('Transformer layer processing', {
      requestId: context.requestId,
      originalModel: input.model,
      transformedModel: (transformedRequest as any).model,
      transformerDirection: transformerDirection,
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
    // 总是尝试从路由配置中获取实际模型名，因为需要支持跨Provider模型映射
    let actualModel = request.model;
    if (context.routingDecision) {
      // 从配置中获取实际的模型名
      const routerConfig = (this.config as any).router;
      const mappedModel = context.routingDecision.virtualModel;
      
      // 首先尝试直接匹配映射模型，如果没有则使用default路由
      let routeEntry = routerConfig[mappedModel] || routerConfig.default;
      
      if (routeEntry && typeof routeEntry === 'string' && routeEntry.includes(',')) {
        // 解析复合路由格式，选择第一个provider-model对
        const firstRoute = routeEntry.split(';')[0].trim();
        const [, modelName] = firstRoute.split(',');
        if (modelName && modelName.trim()) {
          actualModel = modelName.trim();
          secureLogger.info('Protocol层：模型名映射', {
            requestId: context.requestId,
            originalModel: context.routingDecision.originalModel,
            mappedModel,
            actualModel,
            routeEntry,
            usedDefault: !routerConfig[mappedModel]
          });
        }
      }
    }

    // 🔒 CRITICAL FIX: Protocol层必须符合目标协议的API标准
    // 根据CLAUDE.md六层架构规范，禁止传递非标准字段如__internal
    // 将模型映射结果直接更新到标准model字段
    const protocolRequest = {
      ...request,
      model: actualModel, // 🔧 关键修复：直接使用实际模型名，符合目标协议标准
    };

    // 🔧 将配置信息存储在RequestContext中，避免违反目标协议API标准
    context.metadata.protocolConfig = {
      endpoint: endpoint,
      apiKey: apiKey,
      protocol: providerInfo.protocol, // 🔒 使用配置的协议类型（openai/anthropic/gemini等）
      timeout: providerInfo.timeout,
      maxRetries: providerInfo.maxRetries,
      originalModel: request.model,
      actualModel: actualModel,
    };

    return protocolRequest;
  }

  /**
   * 处理Server层 - 实际HTTP API调用
   */
  private async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    // 🔧 关键调试：检查request对象的完整内容（符合OpenAI标准）
    secureLogger.info('🔥🔥 Server层接收到的request对象完整调试', {
      requestId: context.requestId,
      hasModel: 'model' in request,
      modelValue: request.model,
      hasProtocolConfig: !!context.metadata.protocolConfig,
      requestKeys: Object.keys(request),
      requestPreview: {
        model: request.model,
        messages: Array.isArray(request.messages) ? `${request.messages.length} messages` : 'no-messages',
        tools: Array.isArray(request.tools) ? `${request.tools.length} tools` : 'no-tools'
      }
    });

    // 🔧 关键修复：从context.metadata获取协议配置，符合OpenAI API标准
    const protocolConfig = context.metadata.protocolConfig;
    if (!protocolConfig) {
      throw new Error(`Server layer requires protocol configuration but it was not found in context metadata. Request may have been improperly processed by protocol layer.`);
    }

    const { endpoint, apiKey, protocol, timeout, maxRetries } = protocolConfig;

    // 🔧 关键修复：防御性检查endpoint
    if (!endpoint) {
      throw new Error(`Server layer requires endpoint configuration but it was not found in protocol configuration.`);
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

    // 🔧 关键修复：构建HTTP请求体，确保模型字段正确传递
    const requestBody = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature || 0.7,
      stream: false, // 🔧 关键修复：强制禁用流式响应，使用标准JSON格式
      ...(request.tools && Array.isArray(request.tools) && request.tools.length > 0 ? { tools: request.tools } : {}),
    };

    // 🔥🔥 CRITICAL DEBUG: 记录HTTP请求体构建过程
    secureLogger.info('🔥🔥 HTTP请求体构建调试', {
      requestId: context.requestId,
      modelField: requestBody.model,
      hasModel: 'model' in requestBody,
      requestBodyKeys: Object.keys(requestBody),
      requestBodyPreview: {
        model: requestBody.model,
        messagesCount: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
        max_tokens: requestBody.max_tokens,
        hasTools: !!requestBody.tools
      }
    });

    // 🔥🔥 CRITICAL DEBUG: 记录JSON序列化过程
    const serializedBody = JQJsonHandler.stringifyJson(requestBody);
    secureLogger.info('🔥🔥 JSON序列化调试', {
      requestId: context.requestId,
      originalBodyHasModel: 'model' in requestBody,
      serializedLength: serializedBody.length,
      serializedPreview: serializedBody.substring(0, 200),
      modelInSerialized: serializedBody.includes('"model"'),
      modelValueInSerialized: serializedBody.includes(`"model":"${requestBody.model}"`),
    });

    // 构建HTTP请求 - 支持Qwen等Provider的自定义头部
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'RCC-v4.0-Pipeline',
    };

    // 🔑 关键修复：合并自定义头部（用于Qwen等需要特殊头部的Provider）
    // 🔥🔥 ULTRA DEBUG: 检查protocolConfig.customHeaders详细结构
    secureLogger.info('🚨 [PIPELINE-ULTRA-DEBUG] protocolConfig结构完整检查', {
      requestId: context.requestId,
      hasProtocolConfig: !!protocolConfig,
      protocolConfigKeys: protocolConfig ? Object.keys(protocolConfig) : 'no-config',
      hasCustomHeadersField: 'customHeaders' in protocolConfig,
      customHeadersType: typeof protocolConfig.customHeaders,
      customHeadersValue: protocolConfig.customHeaders,
      customHeadersIsObject: protocolConfig.customHeaders && typeof protocolConfig.customHeaders === 'object',
      customHeadersIsNull: protocolConfig.customHeaders === null,
      customHeadersIsUndefined: protocolConfig.customHeaders === undefined,
      customHeadersAsString: protocolConfig.customHeaders ? JSON.stringify(protocolConfig.customHeaders) : 'no-custom-headers'
    });

    const customHeaders = protocolConfig.customHeaders || {};
    const finalHeaders = { ...defaultHeaders, ...customHeaders };

    // 🔥🔥 记录HTTP头部配置
    // 🔧 修复: 设置Content-Length头部，防止大型JSON请求被截断
    const bodyBuffer = Buffer.from(serializedBody, 'utf8');
    finalHeaders['Content-Length'] = bodyBuffer.length.toString();

    secureLogger.info('🔥🔥 HTTP头部构建完成', {
      requestId: context.requestId,
      hasCustomHeaders: Object.keys(customHeaders).length > 0,
      customHeaderKeys: Object.keys(customHeaders),
      finalHeaderKeys: Object.keys(finalHeaders),
      userAgent: finalHeaders['User-Agent'],
      hasAuth: !!finalHeaders['Authorization'],
      contentLength: bodyBuffer.length
    });

    const httpOptions = {
      method: 'POST',
      headers: finalHeaders,
      body: serializedBody,
      bodyBuffer: bodyBuffer, // 传递Buffer供HTTP请求使用
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

        // 解析响应 - 增强错误处理，使用jq处理所有JSON序列化
        let responseData: any;
        try {
          responseData = JQJsonHandler.parseJsonString(response.body);
        } catch (jqError) {
          secureLogger.error('jq JSON解析失败，尝试修复响应内容', {
            requestId: context.requestId,
            jqError: jqError.message,
            responseBodyPreview: response.body?.substring(0, 200) + '...',
            responseBodyLength: response.body?.length || 0,
          });
          
          // 尝试修复响应内容��再解析
          try {
            const fixedResponse = this.fixJsonResponse(response.body);
            responseData = JQJsonHandler.parseJsonString(fixedResponse);
            secureLogger.info('修复后JSON解析成功', {
              requestId: context.requestId,
              fallbackUsed: true,
            });
          } catch (fixError) {
            secureLogger.error('JSON修复和解析都失败', {
              requestId: context.requestId,
              jqError: jqError.message,
              fixError: fixError.message,
              responseBody: response.body,
            });
            throw new Error(`JSON解析和修复都失败 - jq错误: ${jqError.message}, 修复错误: ${fixError.message}, 响应内容: ${response.body?.substring(0, 100)}...`);
          }
        }

        // 🔍 调试日志：记录API实际返回的响应格式
        secureLogger.info('API响应格式检查', {
          requestId: context.requestId,
          responseKeys: Object.keys(responseData),
          hasChoices: !!responseData.choices,
          choicesType: Array.isArray(responseData.choices) ? 'array' : typeof responseData.choices,
          choicesLength: Array.isArray(responseData.choices) ? responseData.choices.length : 'n/a',
          responsePreview: JQJsonHandler.stringifyJson(responseData, true).substring(0, 200) + '...',
        });

        // 🔧 关键修复：更灵活的响应格式验证
        // 检查是否为错误响应
        if (responseData.error) {
          secureLogger.error('API返回错误响应', {
            requestId: context.requestId,
            error: responseData.error,
            statusCode: response.status
          });
          throw new Error(`API Error: ${JQJsonHandler.stringifyJson(responseData.error, true)}`);
        }
        
        // 检查是否为成功的OpenAI格式响应
        if (responseData.choices && Array.isArray(responseData.choices)) {
          // OpenAI格式响应，继续处理
          secureLogger.debug('API响应格式验证成功 - OpenAI格式', {
            requestId: context.requestId,
            choicesCount: responseData.choices.length
          });
        } else if (responseData.content || responseData.message || responseData.text) {
          // 可能是其他格式的成功响应
          secureLogger.debug('API响应格式验证成功 - 非OpenAI格式', {
            requestId: context.requestId,
            hasContent: !!responseData.content,
            hasMessage: !!responseData.message,
            hasText: !!responseData.text
          });
          
          // 转换为OpenAI格式以便后续处理
          responseData = {
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
          // 未知格式，记录警告但不失败
          secureLogger.warn('API响应格式未知，尝试继续处理', {
            requestId: context.requestId,
            responseKeys: Object.keys(responseData),
            responsePreview: JQJsonHandler.stringifyJson(responseData, true).substring(0, 200) + '...'
          });
          
          // 创建默认的OpenAI格式响应
          responseData = {
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

        // 🔧 修复: 使用Buffer写入请求体，确保大型JSON正确传输
        if (options.bodyBuffer) {
          req.write(options.bodyBuffer);
        } else if (options.body) {
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
      // 🔧 修复：检查是否为错误响应
      if (openaiResponse.error) {
        // 将OpenAI错误格式转换为Anthropic错误格式
        // 参考Anthropic官方错误格式规范
        return {
          type: 'error',
          error: {
            type: 'api_error',
            message: openaiResponse.error.message || 'Unknown API error'
          }
        };
      }

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
                JQJsonHandler.parseJsonString(toolCall.function.arguments) : 
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
    console.log(`🔍 Debug: routerConfig=`, JQJsonHandler.stringifyJson(routerConfig, false));
    
    if (routerConfig && routerConfig[mappedModel]) {
      const routeEntry = routerConfig[mappedModel];
      console.log(`🔍 Debug: Found route entry for ${mappedModel}: ${routeEntry}`);
      
      // 解析复合路由格式: "provider1,model1;provider2,model2;..."
      // 选择第一个provider-model对作为主要路由
      const firstRoute = routeEntry.split(';')[0].trim();
      console.log(`🔍 Debug: Extracted first route: "${firstRoute}" from "${routeEntry}"`);
      const [providerName, modelName] = firstRoute.split(',');
      console.log(`🔍 Debug: Parsed provider: "${providerName}", model: "${modelName}"`);
      
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
      // 解析复合默认路由，选择第一个provider-model对
      const firstDefaultRoute = defaultRoute.split(';')[0].trim();
      const [providerName, modelName] = firstDefaultRoute.split(',');
      
      if (providerName && modelName) {
        const pipelineId = `${providerName}-${modelName.replace(/[\/\s]+/g, '-').toLowerCase()}-key0`;
        console.log(`🔍 Debug: Using default route, generated pipeline ID: ${pipelineId}`);
        return [pipelineId];
      }
    }
    
    // 最终fallback - 检查配置中的第一个Provider
    const providers = (this.config as any).providers;
    console.log(`🔍 Debug: Fallback to providers=`, JQJsonHandler.stringifyJson(providers, false));
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

  /**
   * 修复JSON响应内容
   * @param responseBody 原始响应体
   * @returns 修复后的响应体
   */
  private fixJsonResponse(responseBody: string): string {
    try {
      // 使用jq修复常见的JSON格式问题
      // 1. 修复转义字符问题
      let fixedResponse = responseBody.replace(/\\/g, '\\\\');
      fixedResponse = fixedResponse.replace(/\"/g, '\\"');
      
      // 2. 修复未闭合的引号和括号
      // 使用简单的启发式方法检测和修复
      const openBraces = (fixedResponse.match(/{/g) || []).length;
      const closeBraces = (fixedResponse.match(/}/g) || []).length;
      const openBrackets = (fixedResponse.match(/\[/g) || []).length;
      const closeBrackets = (fixedResponse.match(/\]/g) || []).length;
      
      // 如果括号不匹配，尝试修复
      if (openBraces > closeBraces) {
        fixedResponse += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        fixedResponse += ']'.repeat(openBrackets - closeBrackets);
      }
      
      // 3. 修复工具调用参数格式问题
      fixedResponse = fixedResponse.replace(/"arguments":\s*"(\{[^}]*\})"/g, (match, jsonStr) => {
        try {
          // 尝试解析内部JSON字符串
          const parsed = JQJsonHandler.parseJsonString(jsonStr);
          return `"arguments":"${JQJsonHandler.stringifyJson(parsed, true).replace(/"/g, '\\"')}"`;
        } catch {
          // 如果解析失败，返回原始匹配
          return match;
        }
      });
      
      // 4. 使用jq验证修��后的JSON
      try {
        JQJsonHandler.parseJsonString(fixedResponse);
        return fixedResponse;
      } catch (validationError) {
        // 如果验证失败，尝试更激进的修复
        return this.aggressiveJsonFix(fixedResponse);
      }
    } catch (error) {
      // 如果修复失败，返回原始响应体
      return responseBody;
    }
  }

  /**
   * 激进的JSON修复方法
   * @param response 响应体
   * @returns 修复后的响应体
   */
  private aggressiveJsonFix(response: string): string {
    try {
      // 移除可能导致解析错误的控制字符
      let fixed = response.replace(/[\x00-\x1F\x7F]/g, '');
      
      // 修复常见的转义问题
      fixed = fixed.replace(/\\"/g, '\"');
      
      // 尝试使用jq重新格式化
      try {
        const tempObj = JQJsonHandler.parseJsonString(fixed);
        return JQJsonHandler.stringifyJson(tempObj, true);
      } catch {
        // 如果仍然失败，返回清理后的字符串
        return fixed;
      }
    } catch {
      // 最后的后备方案
      return response;
    }
  }

  /**
   * 记录完整的Pipeline执行
   */
  private recordCompletePipelineExecution(
    requestId: string,
    protocol: 'anthropic' | 'openai' | 'gemini',
    originalRequest: any,
    finalResponse: any,
    totalDuration: number,
    context: RequestContext,
    success: boolean,
    errorMessage?: string
  ): void {
    try {
      // 🔧 安全提取transformation结果，避免undefined访问
      const transformerResult = context.transformations.find(t => t.layer === 'transformer')?.result || {};
      const protocolResult = context.transformations.find(t => t.layer === 'protocol')?.result || { streamingSupported: false, protocol_metadata: {} };
      const serverCompatibilityResult = context.transformations.find(t => t.layer === 'server-compatibility')?.result || {};

      // 创建6层流水线记录
      const pipelineSteps = [
        this.pipelineDebugRecorder.recordClientLayer(
          requestId,
          { protocol, request: originalRequest },
          { processed: true, requestId },
          context.layerTimings.client || 0
        ),
        this.pipelineDebugRecorder.recordRouterLayer(
          requestId,
          originalRequest,
          context.routingDecision || {},
          context.layerTimings.router || 0,
          context.routingDecision || {}
        ),
        this.pipelineDebugRecorder.recordTransformerLayer(
          requestId,
          originalRequest,
          transformerResult,
          context.layerTimings.transformer || 0,
          'anthropic-to-openai'
        ),
        this.pipelineDebugRecorder.recordProtocolLayer(
          requestId,
          transformerResult,
          protocolResult,
          context.layerTimings.protocol || 0,
          protocol
        ),
        this.pipelineDebugRecorder.recordServerCompatibilityLayer(
          requestId,
          protocolResult,
          serverCompatibilityResult,
          context.layerTimings.serverCompatibility || 0,
          'passthrough'
        ),
        this.pipelineDebugRecorder.recordServerLayer(
          requestId,
          serverCompatibilityResult,
          finalResponse,
          context.layerTimings.server || 0,
          success,
          errorMessage
        )
      ];

      // 创建完整的Pipeline记录
      const completeRecord = this.pipelineDebugRecorder.createPipelineRecord(
        requestId,
        protocol,
        originalRequest,
        finalResponse,
        totalDuration,
        pipelineSteps,
        {
          configPath: 'runtime-config',
          routeId: context.routingDecision?.selectedPipeline || 'default',
          providerId: context.routingDecision?.providerId || 'unknown'
        }
      );

      // 记录完整请求
      this.pipelineDebugRecorder.recordCompleteRequest(completeRecord);
      console.log('✅ [PIPELINE-DEBUG] Pipeline执行记录完成:', requestId);

    } catch (debugError) {
      console.error('❌ [PIPELINE-DEBUG] Debug记录失败:', debugError.message);
      console.error('❌ [PIPELINE-DEBUG] 详细错误:', debugError.stack);
    }
  }
}