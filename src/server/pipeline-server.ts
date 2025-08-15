/**
 * Pipeline集成HTTP服务器
 * 
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
 * 
 * @author Jason Zhang
 */

import { HTTPServer, ServerConfig, RequestContext, ResponseContext, MiddlewareFunction, RouteHandler } from './http-server';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { StandardPipelineFactoryImpl } from '../pipeline/pipeline-factory';
import { ModuleRegistry } from '../pipeline/module-registry';
import { PipelineConfig, ExecutionContext } from '../interfaces/pipeline/pipeline-framework';
import { IMiddlewareManager, CorsOptions, LoggerOptions, AuthenticationOptions, ValidationOptions, RateLimitOptions } from '../interfaces/core';
import { ServerStatus } from '../interfaces';
import { EventEmitter } from 'events';

/**
 * Pipeline服务器配置
 */
export interface PipelineServerConfig extends ServerConfig {
  pipelines: PipelineConfig[];
  enableAuth?: boolean;
  enableValidation?: boolean;
  enableCors?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
export class PipelineServer extends EventEmitter {
  private httpServer: HTTPServer;
  private pipelineManager: PipelineManager;
  private pipelineConfigs: PipelineConfig[];
  private serverConfig: PipelineServerConfig;
  private middlewareManager: IMiddlewareManager;

  constructor(config: PipelineServerConfig, middlewareManager: IMiddlewareManager) {
    super();
    this.serverConfig = config;
    this.pipelineConfigs = config.pipelines || [];
    this.middlewareManager = middlewareManager;
    
    // 使用组合：创建HTTPServer实例
    this.httpServer = new HTTPServer(config);
    
    // 转发HTTPServer的事件到PipelineServer
    this.httpServer.on('error', (error) => this.emit('error', error));
    this.httpServer.on('started', (data) => this.emit('started', data));
    this.httpServer.on('stopped', () => this.emit('stopped'));
    
    // 初始化Pipeline管理器
    const moduleRegistry = new ModuleRegistry();
    const factory = new StandardPipelineFactoryImpl(moduleRegistry);
    this.pipelineManager = new PipelineManager(factory);
    
    this.initializePipelineRoutes();
    this.initializeMiddleware();
  }

  /**
   * 初始化Pipeline相关路由
   */
  private initializePipelineRoutes(): void {
    // Anthropic兼容端点 - 使用Pipeline处理
    this.httpServer.addRoute('POST', '/v1/messages', async (req, res) => {
      await this.handleAnthropicRequest(req, res);
    });

    // OpenAI兼容端点 - 使用Pipeline处理
    this.httpServer.addRoute('POST', '/v1/chat/completions', async (req, res) => {
      await this.handleOpenAIRequest(req, res);
    });

    // Gemini兼容端点 - 使用Pipeline处理
    this.httpServer.addRoute('POST', '/v1beta/models/:model/generateContent', async (req, res) => {
      await this.handleGeminiRequest(req, res);
    });

    // 统一Pipeline端点
    this.httpServer.addRoute('POST', '/v1/pipeline/:pipelineId', async (req, res) => {
      await this.handlePipelineRequest(req, res);
    });

    // Pipeline管理端点
    this.httpServer.addRoute('GET', '/v1/pipelines', async (req, res) => {
      await this.handleGetPipelines(req, res);
    });

    this.httpServer.addRoute('GET', '/v1/pipelines/:pipelineId/status', async (req, res) => {
      await this.handleGetPipelineStatus(req, res);
    });

    this.httpServer.addRoute('POST', '/v1/pipelines/:pipelineId/start', async (req, res) => {
      await this.handleStartPipeline(req, res);
    });

    this.httpServer.addRoute('POST', '/v1/pipelines/:pipelineId/stop', async (req, res) => {
      await this.handleStopPipeline(req, res);
    });
  }

  /**
   * 初始化中间件
   */
  private initializeMiddleware(): void {
    // 使用中间件管理器创建标准中间件栈
    const middlewareOptions = {
      cors: this.serverConfig.enableCors !== false ? {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      } as CorsOptions : undefined,

      logger: {
        level: this.serverConfig.logLevel === 'debug' ? 2 : 1,
        format: 'detailed'
      } as LoggerOptions,

      authentication: this.serverConfig.enableAuth ? {
        required: false,
        apiKeyHeader: 'Authorization'
      } as AuthenticationOptions : undefined,

      validation: this.serverConfig.enableValidation !== false ? {
        maxBodySize: this.serverConfig.maxRequestSize || 10 * 1024 * 1024,
        validateContentType: true
      } as ValidationOptions : undefined,

      rateLimit: {
        maxRequests: 1000,
        windowMs: 60000,
        message: 'Too many requests from this IP'
      } as RateLimitOptions
    };

    // 创建并应用中间件栈
    const middlewares = this.middlewareManager.createStandardMiddlewareStack(middlewareOptions);
    middlewares.forEach(middleware => {
      this.httpServer.use(middleware);
    });
  }

  /**
   * 启动服务器并初始化所有Pipeline
   */
  async start(): Promise<void> {
    // 先创建和启动所有Pipeline
    await this.initializePipelines();
    
    // 启动HTTP服务器
    await this.httpServer.start();
    
    // 设置Pipeline事件监听
    this.setupPipelineEventListeners();
    
    console.log(`🎯 Pipeline Server started with ${this.pipelineConfigs.length} pipelines`);
  }

  /**
   * 停止服务器并清理Pipeline资源
   */
  async stop(): Promise<void> {
    // 停止所有Pipeline
    await this.cleanupPipelines();
    
    // 停止HTTP服务器
    await this.httpServer.stop();
    
    console.log('🛑 Pipeline Server stopped');
  }

  /**
   * 初始化所有Pipeline
   */
  private async initializePipelines(): Promise<void> {
    console.log(`🔧 Initializing ${this.pipelineConfigs.length} pipelines...`);
    
    for (const config of this.pipelineConfigs) {
      try {
        const pipelineId = await this.pipelineManager.createPipeline(config);
        const pipeline = this.pipelineManager.getPipeline(pipelineId);
        
        if (pipeline) {
          await pipeline.start();
          console.log(`✅ Pipeline ${config.name} (${pipelineId}) initialized successfully`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize pipeline ${config.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * 清理所有Pipeline
   */
  private async cleanupPipelines(): Promise<void> {
    const pipelines = this.pipelineManager.getAllPipelines();
    
    for (const [pipelineId, pipeline] of pipelines) {
      try {
        await pipeline.stop();
        await this.pipelineManager.destroyPipeline(pipelineId);
        console.log(`🧹 Pipeline ${pipelineId} cleaned up`);
      } catch (error) {
        console.error(`❌ Failed to cleanup pipeline ${pipelineId}:`, error);
      }
    }
  }

  /**
   * 设置Pipeline事件监听
   */
  private setupPipelineEventListeners(): void {
    this.pipelineManager.on('executionStarted', (data) => {
      if (this.serverConfig.debug) {
        console.log(`🏃 Pipeline execution started: ${data.pipelineId} (${data.executionId})`);
      }
    });

    this.pipelineManager.on('executionCompleted', (data) => {
      if (this.serverConfig.debug) {
        console.log(`✅ Pipeline execution completed: ${data.executionResult.executionId} in ${data.executionResult.performance.totalTime}ms`);
      }
    });

    this.pipelineManager.on('executionFailed', (data) => {
      console.error(`❌ Pipeline execution failed: ${data.executionResult.executionId}`, data.executionResult.error);
    });
  }

  /**
   * 处理Anthropic格式请求
   */
  private async handleAnthropicRequest(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestBody = req.body;
    
    if (!requestBody || !requestBody.messages) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid request format. Expected Anthropic messages format.'
      };
      return;
    }

    // 查找合适的Anthropic Pipeline
    const pipeline = this.findPipelineByProtocol('anthropic', requestBody.model);
    if (!pipeline) {
      res.statusCode = 503;
      res.body = {
        error: 'Service Unavailable',
        message: 'No available Anthropic pipeline found'
      };
      return;
    }

    try {
      const executionContext: ExecutionContext = {
        requestId: req.id,
        priority: 'normal',
        debug: this.serverConfig.debug,
        metadata: {
          protocol: 'anthropic',
          model: requestBody.model,
          clientInfo: req.headers['user-agent']
        }
      };

      const result = await this.pipelineManager.executePipeline(
        pipeline.getId(),
        requestBody,
        executionContext
      );

      res.body = result.result;
      res.headers['X-Pipeline-ID'] = pipeline.getId();
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
      
    } catch (error) {
      console.error('Anthropic request processing failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: 'Pipeline execution failed'
      };
    }
  }

  /**
   * 处理OpenAI格式请求
   */
  private async handleOpenAIRequest(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestBody = req.body;
    
    if (!requestBody || !requestBody.messages) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid request format. Expected OpenAI chat completions format.'
      };
      return;
    }

    // 查找合适的OpenAI Pipeline
    const pipeline = this.findPipelineByProtocol('openai', requestBody.model);
    if (!pipeline) {
      res.statusCode = 503;
      res.body = {
        error: 'Service Unavailable',
        message: 'No available OpenAI pipeline found'
      };
      return;
    }

    try {
      const executionContext: ExecutionContext = {
        requestId: req.id,
        priority: 'normal',
        debug: this.serverConfig.debug,
        metadata: {
          protocol: 'openai',
          model: requestBody.model,
          clientInfo: req.headers['user-agent']
        }
      };

      const result = await this.pipelineManager.executePipeline(
        pipeline.getId(),
        requestBody,
        executionContext
      );

      res.body = result.result;
      res.headers['X-Pipeline-ID'] = pipeline.getId();
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
      
    } catch (error) {
      console.error('OpenAI request processing failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: 'Pipeline execution failed'
      };
    }
  }

  /**
   * 处理Gemini格式请求
   */
  private async handleGeminiRequest(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestBody = req.body;
    const model = this.extractPathParam(req.url, '/v1beta/models/:model/generateContent', 'model');
    
    if (!requestBody || !requestBody.contents) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid request format. Expected Gemini generateContent format.'
      };
      return;
    }

    if (!model) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Model parameter is required'
      };
      return;
    }

    // 查找合适的Gemini Pipeline
    const pipeline = this.findPipelineByProtocol('gemini', model);
    if (!pipeline) {
      res.statusCode = 503;
      res.body = {
        error: 'Service Unavailable',
        message: 'No available Gemini pipeline found'
      };
      return;
    }

    try {
      const executionContext: ExecutionContext = {
        requestId: req.id,
        priority: 'normal',
        debug: this.serverConfig.debug,
        metadata: {
          protocol: 'gemini',
          model: model,
          clientInfo: req.headers['user-agent']
        }
      };

      const result = await this.pipelineManager.executePipeline(
        pipeline.getId(),
        { ...requestBody, model },
        executionContext
      );

      res.body = result.result;
      res.headers['X-Pipeline-ID'] = pipeline.getId();
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
      
    } catch (error) {
      console.error('Gemini request processing failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: 'Pipeline execution failed'
      };
    }
  }

  /**
   * 处理直接Pipeline请求
   */
  private async handlePipelineRequest(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineId = this.extractPathParam(req.url, '/v1/pipeline/:pipelineId', 'pipelineId');
    
    if (!pipelineId) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Pipeline ID is required'
      };
      return;
    }

    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`
      };
      return;
    }

    try {
      const executionContext: ExecutionContext = {
        requestId: req.id,
        priority: 'normal',
        debug: this.serverConfig.debug,
        metadata: {
          direct: true,
          clientInfo: req.headers['user-agent']
        }
      };

      const result = await this.pipelineManager.executePipeline(
        pipelineId,
        req.body,
        executionContext
      );

      res.body = {
        success: true,
        executionId: result.executionId,
        result: result.result,
        performance: result.performance
      };
      
    } catch (error) {
      console.error('Direct pipeline request failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: 'Pipeline execution failed'
      };
    }
  }

  /**
   * 获取所有Pipeline状态
   */
  private async handleGetPipelines(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineStatuses = this.pipelineManager.getAllPipelineStatus();
    
    res.body = {
      pipelines: pipelineStatuses,
      count: Object.keys(pipelineStatuses).length,
      server: this.getStatus()
    };
  }

  /**
   * 获取特定Pipeline状态
   */
  private async handleGetPipelineStatus(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/status', 'pipelineId');
    
    if (!pipelineId) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Pipeline ID is required'
      };
      return;
    }

    const status = this.pipelineManager.getPipelineStatus(pipelineId);
    if (!status) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`
      };
      return;
    }

    res.body = status;
  }

  /**
   * 启动Pipeline
   */
  private async handleStartPipeline(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/start', 'pipelineId');
    
    if (!pipelineId) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Pipeline ID is required'
      };
      return;
    }

    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`
      };
      return;
    }

    try {
      await pipeline.start();
      res.body = {
        success: true,
        message: `Pipeline ${pipelineId} started successfully`
      };
    } catch (error) {
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to start pipeline'
      };
    }
  }

  /**
   * 停止Pipeline
   */
  private async handleStopPipeline(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/stop', 'pipelineId');
    
    if (!pipelineId) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Pipeline ID is required'
      };
      return;
    }

    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`
      };
      return;
    }

    try {
      await pipeline.stop();
      res.body = {
        success: true,
        message: `Pipeline ${pipelineId} stopped successfully`
      };
    } catch (error) {
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to stop pipeline'
      };
    }
  }

  /**
   * 根据协议和模型查找Pipeline
   */
  private findPipelineByProtocol(protocol: string, model?: string) {
    const pipelines = this.pipelineManager.getAllPipelines();
    
    for (const [pipelineId, pipeline] of pipelines) {
      const status = pipeline.getStatus();
      
      if (status.status === 'running') {
        // 简单匹配逻辑，可以根据需要扩展
        const pipelineProvider = pipeline.provider;
        const pipelineModel = pipeline.model;
        
        if (protocol === 'anthropic' && pipelineProvider.includes('anthropic')) {
          if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
            return pipeline;
          }
        } else if (protocol === 'openai' && pipelineProvider.includes('openai')) {
          if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
            return pipeline;
          }
        } else if (protocol === 'gemini' && pipelineProvider.includes('gemini')) {
          if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
            return pipeline;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * 提取路径参数
   */
  private extractPathParam(url: string, pattern: string, paramName: string): string | null {
    // 简单实现，去除查询参数
    const cleanUrl = url?.split('?')[0];
    
    if (!cleanUrl) {
      return null;
    }
    
    // 转换pattern为正则表达式
    const regexPattern = pattern.replace(/:([^/]+)/g, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    
    const match = cleanUrl.match(regex);
    if (match) {
      // 查找参数位置
      const paramIndex = pattern.split('/').findIndex(part => part === `:${paramName}`);
      if (paramIndex > 0 && match[paramIndex]) {
        return match[paramIndex];
      }
    }
    
    return null;
  }

  /**
   * 获取Pipeline管理器
   */
  getPipelineManager(): PipelineManager {
    return this.pipelineManager;
  }

  /**
   * 获取Pipeline配置
   */
  getPipelineConfigs(): PipelineConfig[] {
    return [...this.pipelineConfigs];
  }

  /**
   * 获取服务器状态
   * 委托给HTTPServer并添加Pipeline相关信息
   */
  getStatus(): ServerStatus & { pipelines?: any } {
    const httpStatus = this.httpServer.getStatus();
    const pipelineStatuses = this.pipelineManager.getAllPipelineStatus();
    
    return {
      ...httpStatus,
      activePipelines: Object.keys(pipelineStatuses).length,
      pipelines: pipelineStatuses
    };
  }

  /**
   * 添加中间件 - 委托给HTTPServer
   */
  use(middleware: MiddlewareFunction): void {
    this.httpServer.use(middleware);
  }

  /**
   * 添加路由 - 委托给HTTPServer
   */
  addRoute(method: string, path: string, handler: RouteHandler, middleware?: MiddlewareFunction[]): void {
    this.httpServer.addRoute(method, path, handler, middleware);
  }
}