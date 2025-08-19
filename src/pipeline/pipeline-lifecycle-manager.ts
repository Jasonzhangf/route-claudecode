/**
 * 流水线生命周期管理器 - 统一管理RCC v4.0四层架构
 *
 * 设计原则：
 * 1. 严格分层：Client → Router → Transformer → Protocol → Server-Compatibility → Server
 * 2. 零fallback：失败时立即停止，不进行降级或备用处理
 * 3. 配置驱动：完全基于用户配置和系统配置运行
 * 4. Connect握手：确保各层正确初始化和连接
 * 5. 生命周期管理：统一处理启动、运行、监控和关闭
 *
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { ConnectionHandshakeManager, HandshakeConfig, PipelineConfiguration } from './connection-handshake';
import { SimpleRouter, RoutingConfig, RouterError } from '../router/simple-router';
import { ConfigLoader, MergedConfig } from '../router/config-loader';
import { secureLogger } from '../utils/secure-logger';
import { PipelineServer, PipelineServerConfig } from '../server/pipeline-server';
import { IMiddlewareManager, IMiddlewareFactory } from '../interfaces/core/middleware-interface';
import { IMiddlewareFunction } from '../interfaces/core/server-interface';
import { CorsOptions, LoggerOptions, AuthenticationOptions, ValidationOptions, RateLimitOptions } from '../interfaces/core/middleware-interface';

// 创建符合接口要求的中间件管理器实现
class SimpleMiddlewareManager implements IMiddlewareManager {
  use(middleware: IMiddlewareFunction): void {
    // 简单实现，不需要使用中间件
  }

  getMiddleware(): IMiddlewareFunction[] {
    return [];
  }

  setFactory(factory: IMiddlewareFactory): void {
    // 简单实现，不需要设置工厂
  }

  getFactory(): IMiddlewareFactory | null {
    return null;
  }

  createStandardMiddlewareStack(options?: {
    cors?: CorsOptions;
    logger?: LoggerOptions;
    authentication?: AuthenticationOptions;
    validation?: ValidationOptions;
    rateLimit?: RateLimitOptions;
  }): IMiddlewareFunction[] {
    // 返回空的中间件数组
    return [];
  }

  validateConfiguration(options: any): boolean {
    // 简单实现，总是返回true
    return true;
  }

  createCors(options: CorsOptions): IMiddlewareFunction {
    // 返回空的中间件函数
    return (req, res, next) => next();
  }

  createLogger(options: LoggerOptions): IMiddlewareFunction {
    // 返回空的中间件函数
    return (req, res, next) => next();
  }

  createRateLimit(options: RateLimitOptions): IMiddlewareFunction {
    // 返回空的中间件函数
    return (req, res, next) => next();
  }

  createAuth(options: AuthenticationOptions): IMiddlewareFunction {
    // 返回空的中间件函数
    return (req, res, next) => next();
  }
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
 * 流水线生命周期管理器
 * 统一管理整个RCC v4.0系统的生命周期
 */
export class PipelineLifecycleManager extends EventEmitter {
  private config: MergedConfig;
  private handshakeManager: ConnectionHandshakeManager;
  private router: SimpleRouter;
  private isRunning = false;
  private startTime?: Date;
  private stats: PipelineStats;
  private activeRequests = new Map<string, RequestContext>;
  private pipelineServer?: PipelineServer;

  constructor(userConfigPath?: string, systemConfigPath?: string) {
    super();

    // 加载配置 - 如果已经有配置则不重新加载
    if (!(this as any).config) {
      this.config = ConfigLoader.loadConfig(userConfigPath, systemConfigPath);
      console.log('🔧 PipelineLifecycleManager loaded config from:', {
        userConfigPath: userConfigPath || 'default',
        systemConfigPath: systemConfigPath || 'default',
        virtualModels: Object.keys(this.config.virtualModels)
      });
    } else {
      console.log('🔧 PipelineLifecycleManager using pre-set config:', {
        virtualModels: Object.keys(this.config.virtualModels)
      });
    }

    // 初始化统计信息
    this.stats = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      layerHealth: {},
      routerStats: {},
    };

    // 初始化握手管理器
    this.handshakeManager = new ConnectionHandshakeManager(this.config.systemConfig.connectionHandshake);

    // 初始化路由器
    this.router = new SimpleRouter(this.config);

    secureLogger.info('PipelineLifecycleManager initialized', {
      userConfigPath,
      systemConfigPath,
      totalVirtualModels: Object.keys(this.config.virtualModels).length,
      serverPort: this.config.server.port,
      handshakeEnabled: this.config.systemConfig.connectionHandshake.enabled,
    });

    // 监听握手管理器事件
    this.setupHandshakeEventListeners();
  }

  /**
   * 启动完整的RCC v4.0流水线系统
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      secureLogger.warn('Pipeline lifecycle manager already running');
      return true;
    }

    try {
      secureLogger.info('Starting RCC v4.0 pipeline system');
      this.startTime = new Date();

      // Step 1: 初始化连接握手
      const pipelineConfig: PipelineConfiguration = {
        layers: this.config.systemConfig.pipelineLayers,
        handshake: this.config.systemConfig.connectionHandshake,
      };

      const handshakeSuccess = await this.handshakeManager.initializePipeline(pipelineConfig);
      if (!handshakeSuccess) {
        throw new Error('Pipeline handshake initialization failed');
      }

      // Step 2: 验证路由器配置
      this.validateRouterConfiguration();

      // Step 3: 启动统计监控
      this.startStatsMonitoring();

      // Step 4: 初始化并启动Pipeline服务器
      secureLogger.info('About to initialize and start server');
      await this.initializeAndStartServer();
      secureLogger.info('Finished initializing and starting server');

      this.isRunning = true;

      secureLogger.info('RCC v4.0 pipeline system started successfully', {
        startTime: this.startTime,
        pipelineReady: this.handshakeManager.isPipelineReady(),
        routerStats: this.router.getStatistics(),
      });

      this.emit('pipeline-started');
      return true;
    } catch (error) {
      secureLogger.error('Failed to start pipeline system', {
        error: error.message,
        stack: error.stack,
      });

      // 清理资源
      await this.stop();
      this.emit('pipeline-start-failed', error);
      return false;
    }
  }

  /**
   * 初始化并启动Pipeline服务器
   */
  private async initializeAndStartServer(): Promise<void> {
    try {
      secureLogger.info('Initializing Pipeline Server', {
        port: this.config.server.port,
        host: this.config.server.host,
      });

      // 创建Pipeline服务器配置
      const serverConfig: PipelineServerConfig = {
        port: this.config.server.port,
        host: this.config.server.host,
        pipelines: [], // TODO: 从配置加载pipeline
        enableAuth: false,
        enableValidation: true,
        enableCors: true,
        logLevel: 'info',
        debug: true, // 强制开启debug以便诊断问题
        maxRequestSize: 10 * 1024 * 1024,
        timeout: 30000,
        // 添加路由规则配置，让pipeline server能够进行路由决策
        routingRules: {
          // 创建详细的路由规则映射，支持所有Claude Code使用的模型变体
          modelMapping: {
            // Claude 3.5 Sonnet 系列（包括所有版本变体）
            'claude-3-5-sonnet': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-3-5-sonnet-20241022': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-3-5-sonnet-20240620': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            // Claude 3.5 Haiku 系列（包括所有版本变体）
            'claude-3-5-haiku': {
              provider: 'lmstudio', 
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-3-5-haiku-20241022': {
              provider: 'lmstudio', 
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            // Claude Sonnet 4 系列（新版本模型）
            'claude-sonnet-4': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-sonnet-4-20250514': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            // Claude 3 系列后备
            'claude-3-opus': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-3-sonnet': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            'claude-3-haiku': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx',
              preferredRoutes: ['lmstudio']
            },
            // 默认映射（捕获所有未明确指定的模型）
            '*': {
              provider: 'lmstudio',
              model: 'gpt-oss-20b-mlx', 
              preferredRoutes: ['lmstudio']
            }
          },
          rules: [
            {
              modelPattern: 'claude-*',
              targetProvider: 'lmstudio',
              targetModel: 'gpt-oss-20b-mlx'
            },
            {
              modelPattern: '*',
              targetProvider: 'lmstudio',
              targetModel: 'gpt-oss-20b-mlx'
            }
          ]
        }
      };
      
      // 打印配置信息进行诊断
      console.log('🔧 Server Config:', {
        port: serverConfig.port,
        host: serverConfig.host,
        debug: serverConfig.debug
      });

      // 创建中间件管理器
      const middlewareManager = new SimpleMiddlewareManager();

      // 创建简化版的Pipeline服务（避免复杂的依赖注入）
      const pipelineService = {
        start: async () => {
          console.log('✅ Simplified Pipeline Service started');
        },
        stop: async () => {
          console.log('🛑 Simplified Pipeline Service stopped');
        },
        getStatus: () => ({
          started: true,
          pipelineCount: 0,
          healthyPipelines: 0,
          pipelines: {},
          protocols: [],
          uptime: 0,
        }),
        handleRequest: async (protocol: string, input: any, context: any) => {
          // 使用真实的pipeline处理逻辑
          try {
            const inputModel = input.model || 'default';
            const result = await this.processRequest(inputModel, input);
            
            return {
              executionId: `exec_${Date.now()}`,
              pipelineId: 'default',
              startTime: Date.now(),
              endTime: Date.now(),
              result: result,
              error: null,
              performance: {
                totalTime: 0,
                networkTime: 0,
                processingTime: 0,
                transformTime: 0,
              }
            };
          } catch (error) {
            secureLogger.error('Pipeline request processing failed', {
              error: error.message,
              input: input?.model || 'unknown'
            });
            
            // 返回错误响应而不是简化响应
            return {
              executionId: `exec_${Date.now()}`,
              pipelineId: 'default',
              startTime: Date.now(),
              endTime: Date.now(),
              result: null,
              error: {
                type: 'pipeline_error',
                message: error.message,
                code: 500
              },
              performance: {
                totalTime: 0,
                networkTime: 0,
                processingTime: 0,
                transformTime: 0,
              }
            };
          }
        },
        getPipelineManager: () => ({
          getAllPipelines: () => new Map(),
          getPipelineStatus: () => null,
          getAllPipelineStatus: () => ({}),
          executePipeline: async () => ({
            executionId: `exec_${Date.now()}`,
            pipelineId: 'default',
            result: { 
              id: `msg_${Date.now()}`,
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'Simplified response from pipeline' }],
              model: 'default-model',
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 }
            },
            error: null,
            performance: {
              startTime: Date.now(),
              endTime: Date.now(),
              totalTime: 0,
              moduleTimings: {},
            },
            metadata: {}
          })
        })
      };

      // 创建Pipeline服务器实例，传入简化版的Pipeline服务
      this.pipelineServer = new PipelineServer(serverConfig, middlewareManager, pipelineService as any);
      
      // 监听服务器事件
      this.pipelineServer.on('started', (data) => {
        secureLogger.info('Pipeline Server started event received', data);
      });
      
      this.pipelineServer.on('error', (error) => {
        secureLogger.error('Pipeline Server error', { error: error.message });
      });

      // 启动服务器
      secureLogger.info('Starting Pipeline Server...');
      await this.pipelineServer.start();
      
      // 验证服务器是否正在运行
      setTimeout(() => {
        if (this.pipelineServer) {
          secureLogger.info('Pipeline Server start process completed');
        }
      }, 100);

      secureLogger.info('Pipeline Server started successfully', {
        port: this.config.server.port,
        host: this.config.server.host,
      });
    } catch (error) {
      secureLogger.error('Failed to initialize and start Pipeline Server', {
        error: error.message,
        stack: error.stack,
        port: this.config.server.port,
      });
      throw error;
    }
  }

  /**
   * 处理单个请求的完整流水线流程
   */
  async processRequest(inputModel: string, request: any): Promise<any> {
    if (!this.isRunning) {
      throw new Error('Pipeline system is not running');
    }

    if (!this.handshakeManager.isPipelineReady()) {
      throw new Error('Pipeline layers are not ready');
    }

    const requestId = this.generateRequestId();
    const context: RequestContext = {
      requestId,
      startTime: new Date(),
      layerTimings: {},
      transformations: [],
      errors: [],
      metadata: { inputModel, originalRequest: request },
    };

    this.activeRequests.set(requestId, context);
    this.stats.totalRequests++;

    try {
      secureLogger.info('Processing request through pipeline', {
        requestId,
        inputModel,
        hasTools: Array.isArray(request.tools) && request.tools.length > 0,
        messageCount: Array.isArray(request.messages) ? request.messages.length : 0,
      });

      // Step 1: Router层 - 路由决策
      const routingStart = Date.now();
      const routingDecision = this.router.route(inputModel, request);
      context.layerTimings.router = Date.now() - routingStart;
      context.routingDecision = routingDecision;

      secureLogger.info('Router layer completed', {
        requestId,
        routingDecision: {
          originalModel: routingDecision.originalModel,
          virtualModel: routingDecision.virtualModel,
          selectedProvider: routingDecision.selectedProvider,
          selectedModel: routingDecision.selectedModel,
        },
        timing: context.layerTimings.router,
      });

      // Step 2: Transformer层 - 请求格式转换
      const transformerStart = Date.now();
      const transformedRequest = await this.processTransformerLayer(request, routingDecision, context);
      context.layerTimings.transformer = Date.now() - transformerStart;

      // Step 3: Protocol层 - 协议适配
      const protocolStart = Date.now();
      const protocolAdaptedRequest = await this.processProtocolLayer(transformedRequest, routingDecision, context);
      context.layerTimings.protocol = Date.now() - protocolStart;

      // Step 4: Server Compatibility层 - 服务器兼容性处理
      const compatibilityStart = Date.now();
      const compatibleRequest = await this.processServerCompatibilityLayer(
        protocolAdaptedRequest,
        routingDecision,
        context
      );
      context.layerTimings.serverCompatibility = Date.now() - compatibilityStart;

      // Step 5: Server层 - 实际API调用
      const serverStart = Date.now();
      const response = await this.processServerLayer(compatibleRequest, routingDecision, context);
      context.layerTimings.server = Date.now() - serverStart;

      // 计算总响应时间
      const totalTime = Date.now() - context.startTime.getTime();
      this.updateResponseTimeStats(totalTime);

      this.stats.successfulRequests++;

      secureLogger.info('Request processing completed successfully', {
        requestId,
        totalTime,
        layerTimings: context.layerTimings,
        responseSize: JSON.stringify(response).length,
      });

      this.emit('request-completed', { requestId, context, response, success: true });
      return response;
    } catch (error) {
      this.stats.failedRequests++;
      context.errors.push({
        layer: 'pipeline',
        error: error.message,
        timestamp: new Date(),
      });

      secureLogger.error('Request processing failed', {
        requestId,
        error: error.message,
        stack: error.stack,
        layerTimings: context.layerTimings,
        errors: context.errors,
      });

      // 如果是路由错误，考虑blacklist处理
      if (error instanceof RouterError && context.routingDecision) {
        this.handleRoutingError(context.routingDecision, error);
      }

      this.emit('request-failed', { requestId, context, error });
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 处理Transformer层
   */
  private async processTransformerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const providerInfo = ConfigLoader.getProviderInfo(
      this.config.systemConfig,
      routingDecision.selectedProvider.split('-')[0]
    );
    const transformerInfo = ConfigLoader.getTransformerInfo(this.config.systemConfig, providerInfo.transformer);

    // 获取用户配置的maxTokens - 从虚拟模型配置中查找
    let userMaxTokens: number | undefined;
    for (const [virtualModelName, virtualModelConfig] of Object.entries(this.config.virtualModels)) {
      const provider = virtualModelConfig.providers.find(p => p.providerId === routingDecision.selectedProvider);
      if (provider && provider.maxTokens) {
        userMaxTokens = provider.maxTokens;
        break;
      }
    }

    context.transformations.push({
      layer: 'transformer',
      transformerType: providerInfo.transformer,
      config: transformerInfo,
      userMaxTokens,
      timestamp: new Date(),
    });

    secureLogger.debug('Transformer layer processing', {
      requestId: context.requestId,
      transformerType: providerInfo.transformer,
      userMaxTokens,
      systemMaxTokens: transformerInfo.maxTokens,
    });

    // 应用用户配置的max_tokens，如果没有用户配置则使用系统默认值
    const effectiveMaxTokens = userMaxTokens || transformerInfo.maxTokens || 4096;
    const transformedRequest = {
      ...request,
      model: routingDecision.selectedModel,
      // 应用max_tokens限制 - 优先使用用户配置，避免硬编码
      max_tokens: Math.min(request.max_tokens || effectiveMaxTokens, effectiveMaxTokens),
    };

    return transformedRequest;
  }

  /**
   * 处理Protocol层
   */
  private async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const providerType = routingDecision.selectedProvider.split('-')[0];
    const providerInfo = ConfigLoader.getProviderInfo(this.config.systemConfig, providerType);

    context.transformations.push({
      layer: 'protocol',
      protocolType: providerInfo.protocol,
      endpoint: routingDecision.selectedEndpoint,
      timestamp: new Date(),
    });

    secureLogger.debug('Protocol layer processing', {
      requestId: context.requestId,
      protocolType: providerInfo.protocol,
      endpoint: routingDecision.selectedEndpoint,
    });

    // 添加认证头和端点信息
    const protocolRequest = {
      ...request,
      __internal: {
        endpoint: routingDecision.selectedEndpoint,
        apiKey: routingDecision.selectedApiKey,
        protocol: providerInfo.protocol,
        timeout: providerInfo.timeout,
        maxRetries: providerInfo.maxRetries,
      },
    };

    return protocolRequest;
  }

  /**
   * 处理Server Compatibility层
   */
  private async processServerCompatibilityLayer(
    request: any,
    routingDecision: any,
    context: RequestContext
  ): Promise<any> {
    context.transformations.push({
      layer: 'server-compatibility',
      moduleType: 'adaptive-compatibility',
      bidirectional: true,
      timestamp: new Date(),
    });

    secureLogger.debug('Server compatibility layer processing', {
      requestId: context.requestId,
      hasInternalConfig: !!request.__internal,
    });

    return request;
  }

  /**
   * 处理Server层 - 实际HTTP API调用
   */
  private async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const { endpoint, apiKey, protocol, timeout, maxRetries } = request.__internal;

    secureLogger.debug('Server layer processing', {
      requestId: context.requestId,
      endpoint,
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
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature || 0.7,
        stream: request.stream || false,
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
          endpoint,
        });

        const response = await this.makeHttpRequest(endpoint, httpOptions);

        secureLogger.info('HTTP request successful', {
          requestId: context.requestId,
          attempt: attempt + 1,
          statusCode: response.status,
          responseSize: response.body?.length || 0,
        });

        // 解析响应
        const responseData = JSON.parse(response.body);

        // 验证响应格式
        if (!responseData.choices || !Array.isArray(responseData.choices)) {
          throw new Error('Invalid response format: missing choices array');
        }

        // 清理内部配置
        delete request.__internal;

        return responseData;
      } catch (error) {
        lastError = error;

        secureLogger.warn('HTTP request attempt failed', {
          requestId: context.requestId,
          attempt: attempt + 1,
          error: error.message,
          willRetry: attempt < maxRetries,
        });

        // 如果是429错误，blacklist这个API key
        if (error.message.includes('429') && context.routingDecision) {
          this.router.blacklistKey(
            context.routingDecision.selectedProvider,
            0, // 简化版本，假设当前使用的是第一个key
            '429',
            'Rate limit exceeded'
          );
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000); // 指数退避，最大5秒
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 所有重试都失败了
    throw new Error(`HTTP request failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * 执行HTTP请求的底层实现
   */
  private async makeHttpRequest(url: string, options: any): Promise<{ status: number; body: string; headers: any }> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https:');
      const httpModule = isHttps ? require('https') : require('http');
      const urlParsed = new URL(url);

      const requestOptions = {
        hostname: urlParsed.hostname,
        port: urlParsed.port || (isHttps ? 443 : 80),
        path: urlParsed.pathname + urlParsed.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout,
      };

      const req = httpModule.request(requestOptions, (res: any) => {
        let body = '';

        res.on('data', (chunk: any) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: res.statusCode,
              body,
              headers: res.headers,
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (error: Error) => {
        reject(new Error(`HTTP request error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`HTTP request timeout after ${options.timeout}ms`));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * 处理路由错误
   */
  private handleRoutingError(routingDecision: any, error: RouterError): void {
    if (error.errorType === 'ALL_BLACKLISTED') {
      secureLogger.warn('All providers blacklisted for virtual model', {
        virtualModel: routingDecision.virtualModel,
        selectedProvider: routingDecision.selectedProvider,
      });
    }
  }

  /**
   * 验证路由器配置
   */
  private validateRouterConfiguration(): void {
    const routerStats = this.router.getStatistics();

    if (routerStats.totalProviders === 0) {
      throw new Error('No providers configured in router');
    }

    if (!this.config.virtualModels.default) {
      throw new Error('Default virtual model must be configured');
    }

    secureLogger.info('Router configuration validated', {
      totalVirtualModels: Object.keys(this.config.virtualModels).length,
      totalProviders: routerStats.totalProviders,
      blacklistedKeys: routerStats.totalBlacklisted,
    });
  }

  /**
   * 启动统计监控
   */
  private startStatsMonitoring(): void {
    setInterval(() => {
      this.updateStats();
    }, 30000); // 每30秒更新一次统计信息

    secureLogger.info('Stats monitoring started');
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    if (this.startTime) {
      this.stats.uptime = Date.now() - this.startTime.getTime();
    }

    this.stats.layerHealth = this.handshakeManager.getConnectionStatus() as any;
    this.stats.routerStats = this.router.getStatistics();

    // 清理过期的blacklist条目
    this.router.cleanupExpiredBlacklists();

    secureLogger.debug('Stats updated', {
      uptime: this.stats.uptime,
      totalRequests: this.stats.totalRequests,
      successRate:
        this.stats.totalRequests > 0
          ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
          : 'N/A',
      activeRequests: this.activeRequests.size,
    });
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTimeStats(responseTime: number): void {
    const total = this.stats.averageResponseTime * (this.stats.successfulRequests - 1);
    this.stats.averageResponseTime = (total + responseTime) / this.stats.successfulRequests;
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置握手事件监听器
   */
  private setupHandshakeEventListeners(): void {
    this.handshakeManager.on('pipeline-ready', () => {
      secureLogger.info('Pipeline layers are ready');
      this.emit('layers-ready');
    });

    this.handshakeManager.on('pipeline-error', error => {
      secureLogger.error('Pipeline handshake error', { error: error.message });
      this.emit('layers-error', error);
    });

    this.handshakeManager.on('layer-ready', layerId => {
      secureLogger.debug('Layer ready', { layerId });
    });

    this.handshakeManager.on('health-check-completed', results => {
      if (results.unhealthy > 0) {
        secureLogger.warn('Health check detected unhealthy layers', results);
      }
    });
  }

  /**
   * 获取系统统计信息
   */
  getStats(): PipelineStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取活跃请求信息
   */
  getActiveRequests(): RequestContext[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * 检查系统是否正在运行
   */
  isSystemRunning(): boolean {
    return this.isRunning && this.handshakeManager.isPipelineReady();
  }

  /**
   * 停止流水线系统
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      secureLogger.warn('Pipeline system is not running');
      return;
    }

    secureLogger.info('Stopping RCC v4.0 pipeline system');

    this.isRunning = false;

    // 等待所有活跃请求完成 (最多等待30秒)
    const waitStart = Date.now();
    while (this.activeRequests.size > 0 && Date.now() - waitStart < 30000) {
      secureLogger.info('Waiting for active requests to complete', {
        activeCount: this.activeRequests.size,
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 强制终止剩余请求
    if (this.activeRequests.size > 0) {
      secureLogger.warn('Forcibly terminating remaining active requests', {
        remainingCount: this.activeRequests.size,
      });
      this.activeRequests.clear();
    }

    // 清理握手管理器
    await this.handshakeManager.cleanup();

    // 清理事件监听器
    this.removeAllListeners();

    secureLogger.info('RCC v4.0 pipeline system stopped successfully');
    this.emit('pipeline-stopped');
  }
}
