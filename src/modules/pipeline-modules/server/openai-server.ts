/**
 * OpenAI Server Module
 *
 * Server模块：标准服务器协议处理，使用官方SDK
 * 按照RCC v4.0四层架构设计实现
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../pipeline/src/module-interface';
import { BidirectionalServerProcessor, RequestContext, ResponseContext } from '../../interfaces/module/four-layer-interfaces';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { getEnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { UnifiedErrorHandlerInterface } from '../../error-handler/src/unified-error-handler-interface';
import { UnifiedErrorHandlerFactory } from '../../error-handler/src/unified-error-handler-impl';
import { ErrorContext } from '../../interfaces/core/error-coordination-center';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { 
  API_PATHS, 
  PROTOCOL_BASE_URLS, 
  MODEL_LIMITS, 
  getModelLimits,
  PROTOCOL_DEFAULTS,
  USER_AGENTS
} from '../../constants/src/pipeline-constants';

// 根据环境选择HTTP客户端
const https = require('https');
const http = require('http');

/**
 * Server错误上下文构建器
 */
class ServerErrorContextBuilder {
  private context: Partial<ErrorContext> = {};

  static create(): ServerErrorContextBuilder {
    return new ServerErrorContextBuilder();
  }

  withRequestId(requestId: string): this {
    this.context.requestId = requestId;
    return this;
  }

  withPipelineId(pipelineId: string): this {
    this.context.pipelineId = pipelineId;
    return this;
  }

  withProvider(provider: string): this {
    this.context.provider = provider;
    return this;
  }

  withModel(model: string): this {
    this.context.model = model;
    return this;
  }

  withOperation(operation: string): this {
    this.context.operation = operation;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  build(): ErrorContext {
    return {
      requestId: this.context.requestId || `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pipelineId: this.context.pipelineId || 'unknown',
      layerName: 'server',
      provider: this.context.provider || 'unknown',
      model: this.context.model || 'unknown',
      operation: this.context.operation || 'server-process',
      timestamp: new Date(),
      metadata: this.context.metadata
    };
  }
}

/**
 * 处理OpenAI错误并标准化 - 集成统一错误处理
 */
async function handleOpenAIError(
  error: any,
  model: string,
  baseURL: string | undefined,
  context: { requestId: string; moduleId: string; operation: string },
  keepOriginalStatus: boolean = false,
  errorHandler?: UnifiedErrorHandlerInterface
): Promise<{ standardizedError: Error }> {
  // 创建标准化的错误信息
  const errorMessage = error.message || String(error);
  
  // 构建完整的错误上下文
  const errorContext = ServerErrorContextBuilder.create()
    .withRequestId(context.requestId)
    .withModel(model)
    .withProvider(baseURL || 'unknown')
    .withOperation(context.operation)
    .withMetadata({
      moduleId: context.moduleId,
      errorType: error.constructor?.name || 'unknown',
      errorMessage: errorMessage,
      keepOriginalStatus: keepOriginalStatus,
      timestamp: Date.now()
    })
    .build();
  
  // 如果提供了错误处理器，使用统一错误处理
  if (errorHandler) {
    try {
      await errorHandler.handleError(error, errorContext);
    } catch (handlingError) {
      secureLogger.warn('Server错误处理器处理异常', {
        requestId: context.requestId,
        originalError: errorMessage,
        handlingError: handlingError.message
      });
    }
  }
  
  // 创建RCC错误
  const rccError = new RCCError(
    `OpenAI API Error: ${errorMessage}`,
    RCCErrorCode.PROVIDER_UNAVAILABLE,
    context.moduleId,
    {
      requestId: context.requestId,
      operation: context.operation,
      model: model,
      details: {
        originalError: errorMessage,
        baseURL: baseURL
      }
      // Note: stack is not part of ErrorContext, it's handled by RCCError constructor
    }
  );
  
  return { standardizedError: rccError };
}
import { JQJsonHandler } from '../../utils/jq-json-handler';

/**
 * 服务器请求格式（标准OpenAI格式）
 */
export interface ServerRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * 服务器响应格式（标准OpenAI格式）
 */
export interface ServerResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI服务器预配置接口 - 四层双向处理架构
 */
export interface OpenAIServerPreConfig {
  baseURL?: string;
  apiKey?: string;
  organization?: string;
  project?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  skipAuthentication?: boolean;
  // Bearer Token认证支持（用于iFlow, Qwen等）
  authMethod?: 'openai' | 'bearer';
  customHeaders?: Record<string, string>;
  // 新增：双向处理配置
  enableResponseValidation?: boolean;
  requestTimeoutMs?: number;
  maxConcurrentRequests?: number;
}

/**
 * OpenAI服务器配置 - 向后兼容
 * @deprecated 使用 OpenAIServerPreConfig
 */
export interface OpenAIServerConfig extends OpenAIServerPreConfig {}

/**
 * OpenAI服务器模块 - 四层双向处理架构实现
 */
export class OpenAIServerModule extends EventEmitter implements ModuleInterface, BidirectionalServerProcessor {
  private readonly id: string = 'openai-server-module';
  private readonly name: string = 'OpenAI Server Module';
  private readonly type: any = 'server';
  private readonly version: string = '4.0.0';
  private readonly preConfig: OpenAIServerPreConfig;
  private openaiClient: OpenAI;
  private status: any = 'healthy';
  private isInitialized = false;
  private connections: Map<string, ModuleInterface> = new Map();
  private readonly isPreConfigured: boolean = true;
  private errorHandler: UnifiedErrorHandlerInterface;
  private requestMetrics = {
    totalRequests: 0,
    totalResponses: 0,
    avgRequestTime: 0,
    avgResponseTime: 0
  };

  constructor(config: OpenAIServerPreConfig | OpenAIServerConfig) {
    super();
    
    // 固化预配置 - 支持向后兼容
    this.preConfig = {
      ...config,
      authMethod: config.authMethod || 'openai',
      enableResponseValidation: config.enableResponseValidation ?? true,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      maxConcurrentRequests: config.maxConcurrentRequests ?? 10,
      skipAuthentication: config.skipAuthentication ?? false
    };

    // 初始化统一错误处理器
    this.errorHandler = UnifiedErrorHandlerFactory.createErrorHandler();

    // 获取要使用的API Key - 扫描和组装阶段不强制要求密钥
    const apiKey = this.preConfig.apiKey;
    
    // 扫描和组装阶段不强制检查API密钥，只在运行时进行验证
    if (!apiKey) {
      console.log(`⚠️ 未配置API密钥 - 将在运行时在healthCheck/authenticate中检查`);
    }

    // 根据认证方法创建客户端 - 只在有API密钥的情况下才初始化
    if (apiKey && this.preConfig.authMethod === 'bearer') {
      // Bearer Token认证模式 - 不创建OpenAI SDK实例
      console.log(`🌐 初始化Bearer Token认证模式: ${this.preConfig.baseURL || PROTOCOL_BASE_URLS.OPENAI.DEFAULT}`);
      console.log(`🔑 认证方法: Bearer Token (非标准OpenAI)`);
    } else if (apiKey && this.preConfig.authMethod !== 'bearer') {
      // 标准OpenAI SDK模式
      this.openaiClient = new OpenAI({
        baseURL: this.preConfig.baseURL,
        apiKey: apiKey,
        organization: this.preConfig.organization,
        project: this.preConfig.project,
        timeout: this.preConfig.timeout,
        maxRetries: this.preConfig.maxRetries,
      });
      console.log(`🔑 使用标准API Key认证`);
    } else {
      // 没有API钥匙的情况 - 扫描阶段正常通过
      console.log(`📋 模块处于扫描阶段，不强制要求API密钥`);
      if (this.preConfig.authMethod === 'bearer') {
        console.log(`🌐 BC格式配置完成 (Bear Token模式)`);
      } else {
        console.log(`🔑 标准OpenAI格式配置完成`);
      }
    }
  }

  // ModuleInterface实现

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.SERVER,
      status: 'running',
      health: this.status,
    };
  }

  /**
   * 初始化模块 - REFACTORED: 移除强制认证检查
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 [ASSEMBLY] 初始化OpenAI服务器模块...`);

    // 组装阶段：只进行基础配置，不进行认证
    console.log(`🏭 [ASSEMBLY] 组装阶段 - 轻量级初始化（跳过认证）`);
    
    this.status = 'healthy';
    this.isInitialized = true;

    this.emit('statusChanged', { health: this.status });
    console.log(`✅ [ASSEMBLY] OpenAI服务器模块初始化完成`);
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    console.log(`▶️ OpenAI服务器模块已启动`);
  }

  /**
   * 运行时认证检查（由自检模块调用）
   */
  async performRuntimeAuthentication(): Promise<boolean> {
    console.log(`🔐 [RUNTIME] 执行运行时认证检查...`);
    try {
      return await this.authenticate();
    } catch (error) {
      console.error(`❌ [RUNTIME] 运行时认证失败:`, error.message);
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      return false;
    }
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    this.status = 'unhealthy';
    this.emit('statusChanged', { health: this.status });
    console.log(`⏹️ OpenAI服务器模块已停止`);
  }

  /**
   * 处理请求 - 四层双向处理架构主接口
   */
  async processRequest(input: ServerRequest, context?: RequestContext): Promise<ServerRequest> {
    if (!this.isInitialized) {
      throw new Error('OpenAI服务器模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🌐 OpenAI Server层处理请求开始: ${input?.model}`);
    console.log(`🔍 Server层接收到的request详细结构:`, JQJsonHandler.stringifyJson(input, false));

    try {
      // 验证请求
      this.validateServerRequest(input);

      // 在双向处理架构中，Server层的processRequest主要是预处理和验证
      // 实际的HTTP调用在后续流程中执行
      const processedRequest = {
        ...input,
        // 添加预处理标记
        _serverProcessed: true,
        _processingTimestamp: Date.now()
      };

      const processingTime = Date.now() - startTime;
      this.requestMetrics.totalRequests++;
      this.requestMetrics.avgRequestTime = 
        (this.requestMetrics.avgRequestTime * (this.requestMetrics.totalRequests - 1) + processingTime) / 
        this.requestMetrics.totalRequests;

      console.log(`✅ OpenAI Server层请求处理完成 (${processingTime}ms)`);

      this.emit('requestProcessed', {
        processingTime,
        success: true,
        model: input.model,
        stage: 'request'
      });

      return processedRequest;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OpenAI Server层请求处理失败 (${processingTime}ms):`, error.message);

      this.emit('requestProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: input.model,
        stage: 'request'
      });

      throw error;
    }
  }

  /**
   * 处理响应 - 四层双向处理架构主接口
   */
  async processResponse(input: ServerResponse, context?: ResponseContext): Promise<ServerResponse> {
    if (!this.isInitialized) {
      throw new Error('OpenAI服务器模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🌐 OpenAI Server层处理响应开始: ${input?.model}`);
    console.log(`🔍 Server层接收到的response详细结构:`, JQJsonHandler.stringifyJson(input, false));

    try {
      // 验证响应格式
      if (this.preConfig.enableResponseValidation) {
        this.validateServerResponse(input);
      }

      // 在双向处理架构中，Server层的processResponse主要是后处理和验证
      const processedResponse = {
        ...input,
        // 添加后处理标记
        _serverProcessed: true,
        _responseProcessingTimestamp: Date.now()
      };

      const processingTime = Date.now() - startTime;
      this.requestMetrics.totalResponses++;
      this.requestMetrics.avgResponseTime = 
        (this.requestMetrics.avgResponseTime * (this.requestMetrics.totalResponses - 1) + processingTime) / 
        this.requestMetrics.totalResponses;

      console.log(`✅ OpenAI Server层响应处理完成 (${processingTime}ms)`);

      this.emit('responseProcessed', {
        processingTime,
        success: true,
        model: input.model,
        tokensUsed: input.usage?.total_tokens,
        stage: 'response'
      });

      return processedResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OpenAI Server层响应处理失败 (${processingTime}ms):`, error.message);

      this.emit('responseProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: input.model,
        stage: 'response'
      });

      throw error;
    }
  }

  /**
   * 处理服务器请求 - 兼容旧接口
   * @deprecated 使用 processRequest 和 processResponse
   */
  async process(input: ServerRequest): Promise<ServerResponse> {
    console.warn('⚠️ process() method is deprecated, use processRequest() and processResponse()');
    
    if (!this.isInitialized) {
      throw new Error('OpenAI服务器模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🌐 OpenAI服务器处理开始: ${input?.model}`);
    console.log(`🔍 Server层接收到的input详细结构:`, JQJsonHandler.stringifyJson(input, false));

    try {
      // 验证请求
      this.validateServerRequest(input);

      // 发送请求到OpenAI
      const response = await this.sendRequest(input);

      const processingTime = Date.now() - startTime;
      console.log(`✅ OpenAI服务器处理完成 (${processingTime}ms)`);

      this.emit('requestProcessed', {
        processingTime,
        success: true,
        model: input.model,
        tokensUsed: response.usage.total_tokens,
      });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OpenAI服务器处理失败 (${processingTime}ms):`, error.message);

      this.emit('requestProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: input.model,
      });

      throw error;
    }
  }

  /**
   * 认证检查
   */
  async authenticate(): Promise<boolean> {
    // 如果配置中禁用了认证检查，直接跳过
    if (this.preConfig.skipAuthentication === true) {
      console.log(`⏭️ 已跳过认证检查 (skipAuthentication=true)`);
      return true;
    }

    try {
      if (this.preConfig.authMethod === 'bearer') {
        // Bearer Token认证验证
        const apiKey = this.getApiKey();
        if (!apiKey || !apiKey.startsWith('sk-')) {
          throw new Error('Bearer Token认证失败：API Key格式无效');
        }
        console.log(`🔐 Bearer Token认证成功 (API Key格式验证通过)`);
        return true;
      } else {
        // 标准OpenAI认证验证
        if (!this.openaiClient) {
          throw new Error('OpenAI客户端未初始化 - 请正确配置API密钥');
        }
        const models = await this.openaiClient.models.list();
        console.log(`🔐 OpenAI认证成功 (${models.data.length} 个模型可用)`);
        return true;
      }
    } catch (error) {
      // 使用统一的错误处理器
      const result = await handleOpenAIError(
        error,
        'authentication',
        this.preConfig.baseURL,
        {
          requestId: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          moduleId: this.id,
          operation: 'authenticate',
        },
        false,
        this.errorHandler
      );

      throw result.standardizedError;
    }
  }

  /**
   * 健康检查 - REFACTORED: 组装阶段轻量化检查
   */
  async checkHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();

    try {
      // REFACTORED: 根据skipAuthentication决定检查深度
      if (this.preConfig.skipAuthentication) {
        console.log(`🏭 [ASSEMBLY] 轻量级健康检查 - 跳过网络验证`);
        const responseTime = Date.now() - startTime;
        
        // 组装阶段只检查基本配置完整性
        const isConfigValid = !!(this.preConfig.baseURL || this.openaiClient);
        const health = isConfigValid ? 'healthy' : 'degraded';
        
        this.status = health;
        this.emit('statusChanged', { health: this.status });
        
        return { healthy: isConfigValid, responseTime };
      } else {
        // 运行时健康检查 - 包含网络验证
        console.log(`🔍 [RUNTIME] 完整健康检查 - 包含认证验证`);
        await this.authenticate();
        const responseTime = Date.now() - startTime;

        this.status = 'healthy';
        this.emit('statusChanged', { health: this.status });

        return { healthy: true, responseTime };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (this.preConfig.skipAuthentication) {
        // 组装阶段健康检查失败不致命
        console.log(`⚠️ [ASSEMBLY] 健康检查警告: ${error.message}`);
        this.status = 'degraded';
      } else {
        // 运行时健康检查失败是致命的
        this.status = 'unhealthy';
      }
      
      this.emit('statusChanged', { health: this.status });
      return { healthy: false, responseTime, error: error.message };
    }
  }

  /**
   * 获取请求头（支持Bearer Token认证）
   */
  private getHeadersForRequest(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 应用自定义请求头
    if (this.preConfig.customHeaders) {
      Object.assign(headers, this.preConfig.customHeaders);
    }

    // Bearer Token认证
    if (this.preConfig.authMethod === 'bearer') {
      const currentApiKey = this.getApiKey();
      headers['Authorization'] = `Bearer ${currentApiKey}`;
      
      // iFlow特定头部（基于CLIProxyAPI实现）
      if (this.preConfig.baseURL?.includes('iflow') || currentApiKey?.startsWith('sk-')) {
        headers['User-Agent'] = USER_AGENTS.GOOGLE_API_NODEJS;
        headers['X-Goog-Api-Client'] = USER_AGENTS.GL_NODE;
        headers['Client-Metadata'] = 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI';
      }
    }

    return headers;
  }

  /**
   * 发送请求到OpenAI服务器（支持Bearer Token模式）
   */
  public async sendRequest(request: ServerRequest, context?: RequestContext, retryCount: number = 0): Promise<ServerResponse> {
    const requestId = context?.requestId || `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (request.stream) {
        throw new Error('流式请求在Server模块不应该出现 - 应该在Protocol模块处理');
      }

      if (this.preConfig.authMethod === 'bearer') {
        // Bearer Token模式 - 使用HTTP客户端
        return await this.sendBearerTokenRequest(request, requestId);
      } else {
        // 标准OpenAI SDK模式
        const response = await this.openaiClient.chat.completions.create({
          model: request.model,
          messages: request.messages as any,
          max_tokens: request.max_tokens,
          temperature: request.temperature,
          top_p: request.top_p,
          frequency_penalty: request.frequency_penalty,
          presence_penalty: request.presence_penalty,
          stop: request.stop,
          tools: request.tools,
          tool_choice: request.tool_choice,
          stream: false,
        });

        return response as ServerResponse;
      }
    } catch (error) {
      // 使用统一的错误处理器
      const result = await handleOpenAIError(
        error,
        request.model,
        this.preConfig.baseURL,
        {
          requestId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          moduleId: this.id,
          operation: 'sendRequest',
        },
        false,
        this.errorHandler
      );

      throw result.standardizedError;
    }
  }

  /**
   * 验证服务器请求格式
   */
  private validateServerRequest(request: ServerRequest): void {
    // Debug: 检查request结构 - 详细输出
    console.log(`🔍 Server层验证输入详细结构:`);
    console.log(`   - Request type: ${typeof request}`);
    console.log(`   - Request constructor: ${request?.constructor?.name}`);
    console.log(`   - Request keys: ${request ? Object.keys(request) : 'null/undefined'}`);
    console.log(`   - Has model: ${!!request?.model}`);
    console.log(`   - Model value: ${request?.model}`);
    console.log(`   - Has messages: ${!!request?.messages}`);
    console.log(`   - Messages type: ${typeof request?.messages}`);
    console.log(`   - Messages is array: ${Array.isArray(request?.messages)}`);
    console.log(`   - Messages length: ${Array.isArray(request?.messages) ? request.messages.length : 'not array'}`);
    console.log(`   - Full request: ${JQJsonHandler.stringifyJson(request, false)}`);

    // 立即检查messages的真实性
    console.log('🚨 URGENT DEBUG: 检查messages的各种访问方式');
    console.log(`   - request.messages: ${request.messages}`);
    console.log(`   - request['messages']: ${request['messages']}`);
    console.log(`   - 'messages' in request: ${'messages' in request}`);
    console.log(`   - request.hasOwnProperty('messages'): ${request.hasOwnProperty('messages')}`);
    console.log(
      `   - Object.prototype.hasOwnProperty.call(request, 'messages'): ${Object.prototype.hasOwnProperty.call(request, 'messages')}`
    );
    console.log(`   - Object.getOwnPropertyNames(request): ${Object.getOwnPropertyNames(request)}`);
    console.log(
      `   - Object.getOwnPropertyDescriptor(request, 'messages'): ${JQJsonHandler.stringifyJson(Object.getOwnPropertyDescriptor(request, 'messages'))}`
    );

    if (!request) {
      throw new Error('请求对象为空');
    }

    if (!request.model) {
      throw new Error('缺少model参数');
    }

    // 详细调试消息验证条件
    console.log('🔍 详细消息验证调试:');
    console.log(`   - request.messages 存在: ${!!request.messages}`);
    console.log(`   - request.messages 类型: ${typeof request.messages}`);
    console.log(`   - request.messages 是数组: ${Array.isArray(request.messages)}`);
    console.log(`   - request.messages 长度: ${request.messages ? request.messages.length : 'undefined'}`);
    console.log(
      `   - request.messages 构造函数: ${request.messages ? request.messages.constructor.name : 'undefined'}`
    );

    const messagesExists = !!request.messages;
    const messagesIsArray = Array.isArray(request.messages);
    const messagesHasLength = request.messages && request.messages.length > 0;

    console.log(`   - 条件1 (!request.messages): ${!request.messages}`);
    console.log(`   - 条件2 (!Array.isArray): ${!Array.isArray(request.messages)}`);
    console.log(`   - 条件3 (length === 0): ${request.messages ? request.messages.length === 0 : 'no messages'}`);

    if (!messagesExists) {
      throw new Error('缺少messages字段');
    }

    if (!messagesIsArray) {
      throw new Error(`messages字段不是数组，类型是: ${typeof request.messages}`);
    }

    if (!messagesHasLength) {
      throw new Error(`messages数组为空，长度: ${request.messages.length}`);
    }

    // 过滤有效的消息 - 改进版本，处理更多边缘情况
    const validMessages = (request.messages && Array.isArray(request.messages) ? request.messages : []).filter(
      (message, index) => {
        // Debug: 检查每个消息的详细结构
        console.log(`🔍 Server层消息验证 [${index}]:`);
        console.log(`   - Message type: ${typeof message}`);
        console.log(`   - Message keys: ${message ? Object.keys(message) : 'null/undefined'}`);
        console.log(`   - Role: ${message?.role}`);
        console.log(`   - Content type: ${typeof message?.content}`);
        console.log(`   - Content length: ${message?.content ? message.content.length : 'no content'}`);
        console.log(
          `   - Content preview: ${message?.content ? message.content.substring(0, 100) + '...' : 'no content'}`
        );

        // 安全检查：确保message对象存在且不为null/undefined
        if (!message || typeof message !== 'object') {
          console.log(`   ❌ 消息 [${index}] 不是有效对象`);
          return false;
        }

        if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
          console.log(`   ❌ 消息 [${index}] 角色无效: ${message.role}`);
          return false;
        }

        // 改进的内容验证 - 更宽松的检查
        if (message.content === null || message.content === undefined) {
          console.log(`   ❌ 消息 [${index}] 内容为空`);
          return false;
        }

        if (typeof message.content !== 'string') {
          console.log(`   ❌ 消息 [${index}] 内容不是字符串类型: ${typeof message.content}`);
          return false;
        }

        // 只检查内容不为完全空白，允许长内容
        if (message.content.trim().length === 0) {
          console.log(`   ❌ 消息 [${index}] 内容为空白字符串`);
          return false;
        }

        console.log(`   ✅ 消息 [${index}] 验证通过`);
        return true;
      }
    );

    if (validMessages.length === 0) {
      throw new Error('没有找到有效的消息内容');
    }

    // 更新request的messages为有效消息
    request.messages = validMessages;

    // 验证工具定义
    if (request.tools) {
      for (const tool of request.tools) {
        // 安全检查：确保tool对象存在且不为null/undefined
        if (!tool || typeof tool !== 'object') {
          continue; // 跳过无效的tool对象
        }
        if (tool.type !== 'function') {
          throw new Error(`不支持的工具类型: ${tool.type}`);
        }
        // 安全检查：确保tool.function存在
        if (!tool.function || typeof tool.function !== 'object') {
          throw new Error('工具函数定义无效');
        }
        if (!tool.function.name) {
          throw new Error('工具函数缺少名称');
        }
        if (!tool.function.description) {
          throw new Error('工具函数缺少描述');
        }
      }
    }

    // 验证参数范围
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw new Error('temperature参数必须在0-2之间');
    }

    if (request.top_p !== undefined && (request.top_p < 0 || request.top_p > 1)) {
      throw new Error('top_p参数必须在0-1之间');
    }

    if (request.max_tokens !== undefined && request.max_tokens < 1) {
      throw new Error('max_tokens参数必须大于0');
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.openaiClient.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      console.warn('获取OpenAI模型列表失败，使用默认列表');
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  /**
   * 估算token数量（简化版）
   */
  estimateTokens(text: string): number {
    // 简化的token估算：大约4个字符 = 1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 获取当前使用的API Key
   */
  private getApiKey(): string {
    if (this.preConfig.apiKey) {
      return this.preConfig.apiKey;
    }

    throw new Error('未配置API Key：请设置apiKey');
  }


  /**
   * 使用Bearer Token发送HTTP请求
   */
  private async sendBearerTokenRequest(request: ServerRequest, requestId: string): Promise<ServerResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(API_PATHS.OPENAI.CHAT_COMPLETIONS, this.preConfig.baseURL || PROTOCOL_BASE_URLS.OPENAI.DEFAULT);
      const isHttps = url.protocol === 'https:';
      const httpClient = isHttps ? https : http;

      const requestData = JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
        tools: request.tools,
        tool_choice: request.tool_choice,
        stream: false,
      });

      const headers = this.getHeadersForRequest();
      headers['Content-Length'] = Buffer.byteLength(requestData).toString();

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: headers,
        timeout: this.preConfig.requestTimeoutMs || 30000,
      };

      console.log(`📡 发送Bearer Token请求到: ${url.toString()}`);
      const currentApiKey = this.getApiKey();
      console.log(`🔑 使用认证头: Authorization: Bearer ${currentApiKey?.substring(0, 10)}...`);

      const req = httpClient.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${response.error?.message || data}`));
              return;
            }

            // 确保响应符合ServerResponse格式
            const serverResponse: ServerResponse = {
              id: response.id || `bearer_${requestId}`,
              object: 'chat.completion',
              created: response.created || Math.floor(Date.now() / 1000),
              model: response.model || request.model,
              choices: response.choices || [],
              usage: response.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
            };

            console.log(`✅ Bearer Token请求成功: ${serverResponse.usage.total_tokens} tokens`);
            resolve(serverResponse);
          } catch (parseError) {
            reject(new Error(`响应解析失败: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ Bearer Token请求失败:`, error.message);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Bearer Token请求超时'));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * 获取模型限制信息 - 使用常量管理的版本
   */
  getModelLimits(modelName: string): { maxTokens: number; maxRequestTokens: number } {
    return getModelLimits(modelName, 'OPENAI');
  }

  /**
   * 验证服务器响应格式
   */
  private validateServerResponse(response: ServerResponse): void {
    console.log('🔍 Server层验证响应详细结构:');
    console.log(`   - Response type: ${typeof response}`);
    console.log(`   - Response constructor: ${response?.constructor?.name}`);
    console.log(`   - Response keys: ${response ? Object.keys(response) : 'null/undefined'}`);
    console.log(`   - Has id: ${!!response?.id}`);
    console.log(`   - Has choices: ${!!response?.choices}`);
    console.log(`   - Choices is array: ${Array.isArray(response?.choices)}`);
    console.log(`   - Full response: ${JQJsonHandler.stringifyJson(response, false)}`);

    if (!response) {
      throw new Error('响应对象为空');
    }

    if (!response.id) {
      throw new Error('缺少响应ID');
    }

    if (!response.choices || !Array.isArray(response.choices)) {
      throw new Error('响应choices字段无效');
    }

    if (response.choices.length === 0) {
      throw new Error('响应choices数组为空');
    }

    // 验证第一个choice的基本结构
    const firstChoice = response.choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') {
      throw new Error('第一个choice无效');
    }

    if (!firstChoice.message || typeof firstChoice.message !== 'object') {
      throw new Error('choice.message字段无效');
    }

    if (!firstChoice.message.role) {
      throw new Error('choice.message.role字段缺失');
    }

    // 验证usage信息（如果存在）
    if (response.usage) {
      if (typeof response.usage !== 'object') {
        throw new Error('usage字段类型无效');
      }
      
      if (response.usage.total_tokens !== undefined && 
          (typeof response.usage.total_tokens !== 'number' || response.usage.total_tokens < 0)) {
        throw new Error('usage.total_tokens字段无效');
      }
    }

    console.log('✅ Server层响应验证通过');
  }

  // ModuleInterface methods implementation
  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: this.requestMetrics.totalRequests + this.requestMetrics.totalResponses,
      averageProcessingTime: (this.requestMetrics.avgRequestTime + this.requestMetrics.avgResponseTime) / 2,
      errorRate: 0, // TODO: Implement error rate calculation
      memoryUsage: process.memoryUsage?.()?.heapUsed || 0,
      cpuUsage: 0, // TODO: Implement CPU usage calculation
    };
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    const connection = this.connections.get(targetModuleId);
    if (!connection) {
      return 'disconnected';
    }
    const status = connection.getStatus();
    return status.status === 'running' ? 'connected' : status.status as any;
  }
  
  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      const status = targetModule.getStatus();
      const metrics = targetModule.getMetrics();
      return status.status === 'running' && status.health === 'healthy';
    } catch (error) {
      return false;
    }
  }

  async configure(config: any): Promise<void> {
    if (this.isPreConfigured) {
      console.warn('⚠️ Module is pre-configured, runtime configuration ignored');
      return;
    }
    // Legacy configuration support for non-pre-configured instances
    console.log('🔧 Applying runtime configuration (deprecated mode)');
  }

  async reset(): Promise<void> {
    // Reset logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
  }

  // ModuleInterface连接管理方法
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  hasConnection(moduleId: string): boolean {
    return this.connections.has(moduleId);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // 模块间通信方法
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      // 发送消息到目标模块
      targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
      });
      return Promise.resolve({ success: true, targetModuleId, message, type });
    }
    return Promise.resolve({ success: false, targetModuleId, message, type });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.on('moduleMessage', (data: any) => {
      listener(data.fromModuleId, data.message, data.type);
    });
  }
}
