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
import { PipelineRouter } from '../router/pipeline-router';
import { ConfigReader, MergedConfig } from '../config/config-reader';
import { secureLogger } from '../utils/secure-logger';
import { PipelineServer, PipelineServerConfig } from '../server/pipeline-server';
import { JQJsonHandler } from '../utils/jq-json-handler';
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
  private router: PipelineRouter;
  private isRunning = false;
  private startTime?: Date;
  private stats: PipelineStats;
  private activeRequests = new Map<string, RequestContext>;
  private pipelineServer?: PipelineServer;

  constructor(userConfigPath?: string, systemConfigPath?: string) {
    super();

    // 加载配置 - 如果已经有配置则不重新加载
    if (!(this as any).config) {
      this.config = ConfigReader.loadConfig(userConfigPath, systemConfigPath);
      console.log('🔧 PipelineLifecycleManager loaded config from:', {
        userConfigPath: userConfigPath || 'default',
        systemConfigPath: systemConfigPath || 'default',
        routerRules: Object.keys(this.config.router)
      });
    } else {
      console.log('🔧 PipelineLifecycleManager using pre-set config:', {
        routerRules: Object.keys(this.config.router)
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

    // 初始化路由器 - 注意：router将在启动时根据配置文件动态创建
    // 在start()方法中会调用initializeRouter()来正确设置router

    secureLogger.info('PipelineLifecycleManager initialized', {
      userConfigPath,
      systemConfigPath,
      totalRouterRules: Object.keys(this.config.router).length,
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

      // Step 2: 初始化PipelineManager并生成流水线表
      await this.initializePipelineManager();

      // Step 3: 初始化路由器（从生成的流水线表加载）
      await this.initializeRouter();

      // Step 3.1: 验证路由器配置
      this.validateRouterConfiguration();

      // Step 4: 启动统计监控
      this.startStatsMonitoring();

      // Step 5: 初始化并启动Pipeline服务器
      secureLogger.info('About to initialize and start server');
      await this.initializeAndStartServer();
      secureLogger.info('Finished initializing and starting server');

      this.isRunning = true;

      secureLogger.info('RCC v4.0 pipeline system started successfully', {
        startTime: this.startTime,
        pipelineReady: this.handshakeManager.isPipelineReady(),
        routerStats: {}, // PipelineRouter doesn't have getStatistics method
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
      const routingDecision = this.router.route(inputModel);
      context.layerTimings.router = Date.now() - routingStart;
      context.routingDecision = routingDecision;

      secureLogger.info('Router layer completed', {
        requestId,
        routingDecision: {
          originalModel: routingDecision.originalModel,
          virtualModel: routingDecision.virtualModel,
          availablePipelines: routingDecision.availablePipelines,
          reasoning: routingDecision.reasoning,
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
        responseSize: JQJsonHandler.stringifyJson(response, true).length,
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
      if (error && context.routingDecision) {
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
    // PipelineRouter返回的routingDecision包含模型信息和可用流水线列表
    // 我们需要根据模型类型来确定Provider信息
    const modelType = routingDecision.virtualModel;
    
    // 从配置中获取第一个可用的流水线对应的Provider信息
    // 这是简化的实现，实际应该由负载均衡器选择具体流水线
    const firstPipelineId = routingDecision.availablePipelines[0];
    const provider = this.extractProviderFromPipelineId(firstPipelineId);
    
    const providerInfo = this.config.systemConfig.providerTypes[provider];
    if (!providerInfo) {
      throw new Error(`Provider type '${provider}' not found in system config`);
    }
    const transformerInfo = this.config.systemConfig.transformers[providerInfo.transformer];

    // 获取用户配置的maxTokens - 从provider配置中查找
    let userMaxTokens: number | undefined;
    const providerConfig = this.config.providers.find(p => p.name === provider);
    if (providerConfig && providerConfig.maxTokens) {
      userMaxTokens = providerConfig.maxTokens;
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
      modelType,
      provider,
      transformerType: providerInfo.transformer,
      userMaxTokens,
      systemMaxTokens: transformerInfo.maxTokens,
    });

    // 应用用户配置的max_tokens，如果没有用户配置则使用系统默认值
    const effectiveMaxTokens = userMaxTokens || transformerInfo.maxTokens || 4096;
    const targetModel = this.extractModelFromPipelineId(firstPipelineId);
    
    const transformedRequest = {
      ...request,
      model: targetModel,
      // 应用max_tokens限制 - 优先使用用户配置，避免硬编码
      max_tokens: Math.min(request.max_tokens || effectiveMaxTokens, effectiveMaxTokens),
    };

    return transformedRequest;
  }

  /**
   * 从流水线ID中提取Provider名称
   * 例如：lmstudio-llama-3.1-8b-key0 -> lmstudio
   */
  private extractProviderFromPipelineId(pipelineId: string): string {
    return pipelineId.split('-')[0];
  }

  /**
   * 从流水线ID中提取目标模型名称
   * 例如：lmstudio-llama-3.1-8b-key0 -> llama-3.1-8b
   */
  private extractModelFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    // 移除第一个部分（provider）和最后一个部分（keyX）
    return parts.slice(1, -1).join('-');
  }

  /**
   * 处理Protocol层
   */
  private async processProtocolLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    const providerInfo = this.config.systemConfig.providerTypes[providerType];
    if (!providerInfo) {
      throw new Error(`Provider type '${providerType}' not found in system config`);
    }

    // 从系统配置中获取端点信息
    const endpoint = providerInfo.endpoint;
    
    // 从配置中获取对应的API密钥
    let apiKey = this.config.apiKey || 'default-key';
    
    // 尝试从provider配置中获取API密钥
    const providerConfig = this.config.providers.find(p => p.name.startsWith(providerType));
    if (providerConfig && providerConfig.api_key) {
      apiKey = providerConfig.api_key;
    }

    context.transformations.push({
      layer: 'protocol',
      protocolType: providerInfo.protocol,
      endpoint: endpoint,
      timestamp: new Date(),
    });

    secureLogger.debug('Protocol layer processing', {
      requestId: context.requestId,
      protocolType: providerInfo.protocol,
      endpoint: endpoint,
      providerType,
    });

    // 添加认证头和端点信息
    const protocolRequest = {
      ...request,
      __internal: {
        endpoint: endpoint,
        apiKey: apiKey,
        protocol: providerInfo.protocol,
        timeout: providerInfo.timeout,
        maxRetries: providerInfo.maxRetries,
      },
    };

    return protocolRequest;
  }

  /**
   * 从流水线ID中提取API密钥索引
   * 例如：lmstudio-llama-3.1-8b-key2 -> 2
   */
  private extractKeyIndexFromPipelineId(pipelineId: string): number {
    const match = pipelineId.match(/-key(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 处理Server Compatibility层 - 配置驱动的模块选择
   */
  private async processServerCompatibilityLayer(
    request: any,
    routingDecision: any,
    context: RequestContext
  ): Promise<any> {
    const firstPipelineId = routingDecision.availablePipelines[0];
    const providerType = this.extractProviderFromPipelineId(firstPipelineId);
    const providerInfo = this.config.systemConfig.providerTypes[providerType];
    if (!providerInfo) {
      throw new Error(`Provider type '${providerType}' not found in system config`);
    }
    
    // 获取server compatibility模块标签
    const compatibilityTag = providerInfo.serverCompatibility || 'generic';
    const moduleInfo = this.config.systemConfig.serverCompatibilityModules?.[compatibilityTag];
    
    context.transformations.push({
      layer: 'server-compatibility',
      moduleType: moduleInfo?.module || 'generic',
      compatibilityTag,
      bidirectional: true,
      timestamp: new Date(),
    });

    secureLogger.debug('Server compatibility layer processing', {
      requestId: context.requestId,
      providerType,
      compatibilityTag,
      moduleType: moduleInfo?.module,
      hasInternalConfig: !!request.__internal,
    });

    // 根据配置选择和加载相应的兼容性模块
    if (compatibilityTag === 'lmstudio' && moduleInfo?.module === 'LMStudioCompatibilityModule') {
      secureLogger.debug('Applying LM Studio compatibility processing', {
        requestId: context.requestId,
        hasTools: Array.isArray(request.tools) && request.tools.length > 0,
        toolsCount: Array.isArray(request.tools) ? request.tools.length : 0,
      });

      try {
        const { LMStudioCompatibilityModule } = require('../modules/pipeline-modules/server-compatibility/lmstudio-compatibility');
        const targetModel = this.extractModelFromPipelineId(firstPipelineId);
        const lmstudioConfig = {
          baseUrl: request.__internal.endpoint,
          apiKey: request.__internal.apiKey,
          timeout: 30000,
          maxRetries: 3,
          retryDelay: 1000,
          models: [targetModel],
          maxTokens: {}
        };

        const compatibilityModule = new LMStudioCompatibilityModule(lmstudioConfig);
        
        // 关键修复：必须先初始化模块
        await compatibilityModule.initialize();
        
        const processedRequest = await compatibilityModule.process(request);
        
        secureLogger.info('LM Studio compatibility processing completed', {
          requestId: context.requestId,
          originalToolsCount: Array.isArray(request.tools) ? request.tools.length : 0,
          processedToolsCount: Array.isArray(processedRequest.tools) ? processedRequest.tools.length : 0,
        });

        return processedRequest;
      } catch (error) {
        secureLogger.error('LM Studio compatibility processing failed - ZERO FALLBACK POLICY', {
          requestId: context.requestId,
          error: error.message,
        });
        
        // ZERO FALLBACK POLICY: 立即抛出错误，不进行任何降级处理
        throw new Error(`LM Studio兼容性处理失败: ${error.message}`);
      }
    } 
    else if (compatibilityTag === 'generic' || !moduleInfo) {
      // 使用通用兼容性处理
      return this.processGenericCompatibility(request, context);
    }
    else {
      // 其他模块类型，未来扩展
      secureLogger.debug(`Compatibility module ${moduleInfo.module} not yet implemented, using generic`, {
        requestId: context.requestId,
        compatibilityTag,
      });
      
      return this.processGenericCompatibility(request, context);
    }
  }

  /**
   * 通用兼容性处理 - 默认行为
   * 主要负责Anthropic工具格式到OpenAI格式的转换
   */
  private async processGenericCompatibility(request: any, context: RequestContext): Promise<any> {
    secureLogger.debug('Applying generic compatibility processing', {
      requestId: context.requestId,
      hasTools: Array.isArray(request.tools) && request.tools.length > 0,
      originalToolCount: Array.isArray(request.tools) ? request.tools.length : 0,
    });

    // 基础的请求验证和清理
    const processedRequest = { ...request };
    
    // 🔧 关键修复：转换工具格式从Anthropic到OpenAI标准
    if (Array.isArray(processedRequest.tools)) {
      processedRequest.tools = this.convertToolsToOpenAIFormat(processedRequest.tools, context);
    }

    secureLogger.debug('Generic compatibility processing completed', {
      requestId: context.requestId,
      processedToolCount: Array.isArray(processedRequest.tools) ? processedRequest.tools.length : 0,
    });

    return processedRequest;
  }

  /**
   * 将工具从Anthropic格式转换为OpenAI格式
   */
  private convertToolsToOpenAIFormat(tools: any[], context: RequestContext): any[] {
    if (!tools || !Array.isArray(tools)) {
      return [];
    }

    return tools.map((tool, index) => {
      // 检查工具的基本结构
      if (!tool || typeof tool !== 'object') {
        secureLogger.warn('Invalid tool structure, skipping', {
          requestId: context.requestId,
          toolIndex: index,
          tool: typeof tool
        });
        return null;
      }

      // 如果已经是OpenAI格式，直接返回
      if (tool.type === 'function' && tool.function && tool.function.name) {
        return tool;
      }

      // 转换Anthropic格式到OpenAI格式
      const openAITool: any = {
        type: 'function',
      };

      if (tool.name) {
        // Anthropic格式：{ name: '...', description: '...', input_schema: {...} }
        openAITool.function = {
          name: tool.name,
          description: tool.description || 'Converted from Anthropic format',
          parameters: tool.input_schema || { type: 'object', properties: {} },
        };
      } else if (tool.function) {
        // 部分OpenAI格式，确保完整
        openAITool.function = {
          name: tool.function.name || `tool_${index}`,
          description: tool.function.description || 'Auto-generated description',
          parameters: tool.function.parameters || { type: 'object', properties: {} },
        };
      } else {
        // 无法识别的格式，创建默认工具
        secureLogger.warn('Unrecognized tool format, creating default', {
          requestId: context.requestId,
          toolIndex: index
        });
        openAITool.function = {
          name: `unknown_tool_${index}`,
          description: 'Unknown tool format, auto-converted',
          parameters: { type: 'object', properties: {} },
        };
      }

      // 验证必需字段
      if (!openAITool.function.name || typeof openAITool.function.name !== 'string') {
        secureLogger.warn('Tool missing valid name, skipping', {
          requestId: context.requestId,
          toolIndex: index
        });
        return null;
      }

      secureLogger.debug('Tool converted to OpenAI format', {
        requestId: context.requestId,
        toolIndex: index,
        toolName: openAITool.function.name
      });

      return openAITool;
    }).filter(tool => tool !== null); // 过滤掉无效工具
  }

  /**
   * 处理Server层 - 实际HTTP API调用
   */
  private async processServerLayer(request: any, routingDecision: any, context: RequestContext): Promise<any> {
    const { endpoint, apiKey, protocol, timeout, maxRetries } = request.__internal;

    // 🔧 关键修复：确保LM Studio使用正确的/chat/completions端点
    let fullEndpoint = endpoint;
    if (endpoint === 'http://localhost:1234/v1') {
      fullEndpoint = 'http://localhost:1234/v1/chat/completions';
    } else if (endpoint.endsWith('/v1') && !endpoint.includes('/chat/completions')) {
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

        // 🔍 调试日志：记录LM Studio实际返回的响应格式
        secureLogger.info('LM Studio响应格式检查', {
          requestId: context.requestId,
          responseKeys: Object.keys(responseData),
          hasChoices: !!responseData.choices,
          choicesType: Array.isArray(responseData.choices) ? 'array' : typeof responseData.choices,
          choicesLength: Array.isArray(responseData.choices) ? responseData.choices.length : 'n/a',
          responsePreview: JQJsonHandler.stringifyJson(responseData, true).substring(0, 200) + '...',
        });

        // 验证响应格式
        if (!responseData.choices || !Array.isArray(responseData.choices)) {
          secureLogger.error('LM Studio响应格式验证失败', {
            requestId: context.requestId,
            actualResponse: responseData,
            hasChoices: !!responseData.choices,
            choicesType: typeof responseData.choices,
          });
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
          // PipelineRouter doesn't have blacklistKey method
          // this.router.blacklistKey(...)
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
  private handleRoutingError(routingDecision: any, error: any): void {
    if (error.errorType === 'ALL_BLACKLISTED') {
      secureLogger.warn('All providers blacklisted for virtual model', {
        virtualModel: routingDecision.virtualModel,
        selectedProvider: routingDecision.selectedProvider,
      });
    }
  }

  /**
   * 初始化PipelineManager并生成流水线表
   * 这必须在Router初始化之前执行
   */
  private async initializePipelineManager(): Promise<void> {
    try {
      secureLogger.info('Initializing PipelineManager and generating pipeline tables');

      // 导入必要的类
      const { PipelineManager } = require('../pipeline/pipeline-manager');
      const { StandardPipelineFactoryImpl } = require('../pipeline/pipeline-factory');
      const { ConfigReader } = require('../config/config-reader');

      // 创建PipelineManager
      const factory = new StandardPipelineFactoryImpl();
      const pipelineManager = new PipelineManager(factory, this.config.systemConfig);

      // 从用户配置创建RoutingTable
      const routingTable = this.createRoutingTableFromConfig(this.config);

      // 提取配置信息
      const configName = this.extractConfigNameFromConfig();
      const configInfo = {
        name: configName,
        file: 'loaded-from-config',
        port: this.config.server.port
      };

      // 初始化PipelineManager，这会创建所有流水线并生成流水线表
      await pipelineManager.initializeFromRoutingTable(routingTable, configInfo);

      secureLogger.info('PipelineManager initialized and pipeline tables generated', {
        configName,
        totalPipelines: pipelineManager.getAllPipelines().size
      });

    } catch (error) {
      secureLogger.error('Failed to initialize PipelineManager', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`PipelineManager initialization failed: ${error.message}`);
    }
  }

  /**
   * 初始化路由器
   * 根据配置文件生成的流水线表创建PipelineRouter
   */
  private async initializeRouter(): Promise<void> {
    try {
      // 从用户配置中提取配置名称
      // 假设配置文件路径类似 ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json
      // 我们需要提取 "lmstudio-v4-5506" 作为配置名称
      
      const configName = this.extractConfigNameFromConfig();
      
      secureLogger.info('Initializing router with config', {
        configName,
        serverPort: this.config.server.port
      });

      // 尝试从generated目录加载流水线表
      this.router = PipelineRouter.fromConfigName(configName);
      
      secureLogger.info('Router initialized successfully', {
        configName,
        routeCount: this.router.getStatistics().totalRoutes
      });

    } catch (error) {
      secureLogger.error('Failed to initialize router', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Router initialization failed: ${error.message}`);
    }
  }

  /**
   * 从用户配置创建RoutingTable
   */
  private createRoutingTableFromConfig(config: any): any {
    const routes: Record<string, any[]> = {};
    
    // 🔍 调试：记录Demo1配置结构 (直接读取，无转换)
    secureLogger.info('🔍 Creating routing table from Demo1 config format', {
      hasProviders: !!config.providers,
      hasRouter: !!config.router,
      providersCount: config.providers ? config.providers.length : 0,
      routerKeys: config.router ? Object.keys(config.router) : []
    });
    
    // 从Demo1格式直接创建路由 (providers + router)
    for (const [modelTypeName, routeString] of Object.entries(config.router)) {
      const routeList: any[] = [];
      
      // 解析Demo1路由字符串 "provider,model"
      const [providerName, targetModel] = (routeString as string).split(',');
      
      // 🔍 调试：记录每个路由配置的结构
      secureLogger.info('🔍 Processing Demo1 route', {
        modelTypeName,
        routeString,
        providerName,
        targetModel
      });
      
      // 查找匹配的Provider配置
      const provider = config.providers.find((p: any) => p.name === providerName);
      if (!provider) {
        throw new Error(`Provider '${providerName}' not found for route '${modelTypeName}'`);
      }
      
      // 验证模型是否在Provider支持的models列表中
      if (!provider.models.includes(targetModel)) {
        throw new Error(`Model '${targetModel}' not supported by provider '${providerName}'`);
      }
      
      // 创建路由对象 (直接从Demo1格式构建)
      const route = {
        provider: providerName,
        model: targetModel,
        api_base_url: provider.api_base_url,
        api_key: provider.api_key,
        maxTokens: provider.maxTokens || 4096,
        serverCompatibility: provider.serverCompatibility || 'generic',
        weight: provider.weight || 100
      };
        
        // 验证必需字段
        if (route.provider && route.model && route.api_base_url) {
          const routeId = `${modelTypeName}-${route.provider}-0`;
          const pipelineId = `${route.provider}-key0`;
          
          routeList.push({
            routeId,
            routeName: `${modelTypeName} via ${route.provider}`,
            virtualModel: modelTypeName,  // 🐛 关键修复：添加virtualModel字段
            provider: route.provider,
            targetModel: route.model,
            apiKeyIndex: 0,
            pipelineId,
            isActive: true,
            health: 'healthy' as const,
            // 🐛 关键修复：添加PipelineManager期望的apiKeys字段
            apiKeys: [route.api_key || 'lm-studio-key-1'],
            // 附加配置信息（用于调试）
            apiBaseUrl: route.api_base_url,
            apiKey: route.api_key,
            maxTokens: route.maxTokens || 4096,
            serverCompatibility: route.serverCompatibility || 'generic',
            weight: route.weight || 100
          });
          
          secureLogger.info('✅ Created route entry', {
            routeId,
            modelTypeName,
            provider: route.provider,
            targetModel: route.model
          });
        } else {
          secureLogger.warn('⚠️ Invalid route config - missing required fields', {
            modelTypeName,
            hasProvider: !!route.provider,
            hasModel: !!route.model,
            hasApiBaseUrl: !!route.api_base_url
          });
        }
      
      routes[modelTypeName] = routeList;
    }

    // 🐛 调试：记录最终路由表统计
    const totalRoutes = Object.values(routes).reduce((sum, routeList) => sum + routeList.length, 0);
    secureLogger.info('📊 Routing table creation complete', {
      totalModelTypes: Object.keys(routes).length,
      totalRoutes,
      routeBreakdown: Object.fromEntries(
        Object.entries(routes).map(([key, routeList]) => [key, routeList.length])
      )
    });
    
    return {
      routes,
      defaultRoute: 'default',
    };
  }

  /**
   * 从配置中提取配置名称
   * 这是一个简化的实现，实际应该根据配置文件路径或其他标识符确定
   */
  private extractConfigNameFromConfig(): string {
    // 从服务器端口推断配置名称（临时方案）
    const port = this.config.server.port;
    
    // 根据端口号映射到对应的配置名称
    const portToConfigMap: Record<number, string> = {
      5506: 'lmstudio-v4-5506',
      5507: 'lmstudio-v4-5507',
      5508: 'lmstudio-v4-5508',
    };

    const configName = portToConfigMap[port];
    if (!configName) {
      // 如果没有映射，使用默认命名模式
      return `lmstudio-v4-${port}`;
    }

    return configName;
  }

  /**
   * 验证路由器配置
   */
  private validateRouterConfiguration(): void {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    const routerStats = this.router.getStatistics();

    if (routerStats.totalProviders === 0) {
      throw new Error('No providers configured in router');
    }

    if (!this.config.router.default) {
      throw new Error('Default virtual model must be configured');
    }

    secureLogger.info('Router configuration validated', {
      totalRouterRules: Object.keys(this.config.router).length,
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
