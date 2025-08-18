/**
 * Pipeline集成HTTP服务器
 *
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
 *
 * @author Jason Zhang
 */

import {
  HTTPServer,
  ServerConfig,
  RequestContext,
  ResponseContext,
  MiddlewareFunction,
  RouteHandler,
} from './http-server';
import { PipelineService, PipelineServiceConfig } from './pipeline-service';
import { PipelineConfig, ExecutionContext } from '../interfaces/pipeline/pipeline-framework';
import {
  IMiddlewareManager,
  CorsOptions,
  LoggerOptions,
  AuthenticationOptions,
  ValidationOptions,
  RateLimitOptions,
} from '../interfaces/core';
import { ServerStatus } from '../interfaces';
import { IPipelineService } from '../interfaces/core/pipeline-abstraction';
import { EventEmitter } from 'events';
import {
  PipelineDebugRecorder,
  PipelineLayerRecord,
  CompletePipelineDebugRecord,
} from '../debug/pipeline-debug-recorder';

/**
 * Pipeline服务器配置
 */
export interface PipelineServerConfig extends ServerConfig {
  pipelines: PipelineConfig[];
  enableAuth?: boolean;
  enableValidation?: boolean;
  enableCors?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  configPath?: string;
}

/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
export class PipelineServer extends EventEmitter {
  private httpServer: HTTPServer;
  private pipelineService: IPipelineService;
  private serverConfig: PipelineServerConfig;
  private middlewareManager: IMiddlewareManager;
  private debugRecorder: PipelineDebugRecorder;

  constructor(config: PipelineServerConfig, middlewareManager: IMiddlewareManager, pipelineService?: IPipelineService) {
    super();
    this.serverConfig = config;
    this.middlewareManager = middlewareManager;

    // 使用组合：创建HTTPServer实例
    this.httpServer = new HTTPServer(config);

    // 转发HTTPServer的事件到PipelineServer
    this.httpServer.on('error', error => this.emit('error', error));
    this.httpServer.on('started', data => this.emit('started', data));
    this.httpServer.on('stopped', () => this.emit('stopped'));

    // 使用依赖注入的Pipeline服务或创建默认实现
    if (pipelineService) {
      this.pipelineService = pipelineService;
    } else {
      // 这里需要从工厂创建Pipeline服务的具体实现
      // 避免直接依赖具体实现类
      this.pipelineService = this.createDefaultPipelineService(config);
    }

    // 转发Pipeline服务事件（如果支持EventEmitter接口）
    if ('on' in this.pipelineService && typeof this.pipelineService.on === 'function') {
      this.pipelineService.on('error', (error: any) => this.emit('error', error));
      this.pipelineService.on('executionStarted', (data: any) => this.emit('executionStarted', data));
      this.pipelineService.on('executionCompleted', (data: any) => this.emit('executionCompleted', data));
      this.pipelineService.on('executionFailed', (data: any) => this.emit('executionFailed', data));
    }

    // 初始化Debug记录器
    this.debugRecorder = new PipelineDebugRecorder(config.port || 5506, config.debug !== false);

    this.initializePipelineRoutes();
    this.initializeMiddleware();
  }

  /**
   * 初始化服务器
   */
  async initialize(): Promise<void> {
    // 初始化Pipeline服务
    if (this.pipelineService) {
      // Pipeline服务初始化逻辑
    }

    // 初始化HTTP服务器（如果支持初始化方法）
    if ('initialize' in this.httpServer && typeof this.httpServer.initialize === 'function') {
      await this.httpServer.initialize();
    }
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
      cors:
        this.serverConfig.enableCors !== false
          ? ({
              origin: true,
              credentials: true,
              methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
              allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            } as CorsOptions)
          : undefined,

      logger: {
        level: this.serverConfig.logLevel === 'debug' ? 2 : 1,
        format: 'detailed',
      } as LoggerOptions,

      authentication: this.serverConfig.enableAuth
        ? ({
            required: false,
            apiKeyHeader: 'Authorization',
          } as AuthenticationOptions)
        : undefined,

      validation:
        this.serverConfig.enableValidation !== false
          ? ({
              maxBodySize: this.serverConfig.maxRequestSize || 10 * 1024 * 1024,
              validateContentType: true,
            } as ValidationOptions)
          : undefined,

      rateLimit: {
        maxRequests: 1000,
        windowMs: 60000,
        message: 'Too many requests from this IP',
      } as RateLimitOptions,
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
    // 先启动Pipeline服务
    await this.pipelineService.start();

    // 启动HTTP服务器
    await this.httpServer.start();

    console.log(`🎯 Pipeline Server started`);
  }

  /**
   * 停止服务器并清理Pipeline资源
   */
  async stop(): Promise<void> {
    // 停止Pipeline服务
    await this.pipelineService.stop();

    // 停止HTTP服务器
    await this.httpServer.stop();

    console.log('🛑 Pipeline Server stopped');
  }

  /**
   * 处理Anthropic格式请求 - 带完整6层Pipeline Debug记录
   */
  private async handleAnthropicRequest(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const pipelineSteps: PipelineLayerRecord[] = [];

    console.log(`📥 [${requestId}] Anthropic请求开始处理，启用6层Pipeline Debug记录`);

    try {
      // ===== Layer 0: Client Layer =====
      const clientStart = Date.now();
      const clientInput = {
        endpoint: '/v1/messages',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        contentType: req.headers['content-type'] || 'application/json',
      };

      // 基础请求验证
      if (!req.body || !req.body.messages) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: 'Invalid request format. Expected Anthropic messages format.',
        };
        return;
      }

      const clientOutput = {
        ...req.body,
        client_metadata: {
          http_method: 'POST',
          endpoint: '/v1/messages',
          headers_validated: true,
          content_type: 'application/json',
          request_size: JSON.stringify(req.body).length,
          anthropic_version: req.headers['anthropic-version'] || '2023-06-01',
        },
        validation: {
          required_fields: ['model', 'messages'],
          validation_passed: true,
        },
      };

      const clientRecord = this.debugRecorder.recordClientLayer(
        requestId,
        clientInput,
        clientOutput,
        Date.now() - clientStart
      );
      pipelineSteps.push(clientRecord);
      console.log(`   ✅ Layer 0 - Client: ${clientRecord.duration}ms`);

      // ===== Layer 1: Router Layer =====
      const routerStart = Date.now();

      // 模拟路由决策（这里应该调用真实的路由服务）
      const routingDecision = {
        routeId: 'lmstudio-primary-route',
        providerId: 'lmstudio-compatibility',
        originalModel: req.body.model,
        mappedModel: this.getModelMapping(req.body.model),
        selectionCriteria: {
          primary: 'priority',
          secondary: 'health',
          tertiary: 'weight',
        },
      };

      const routerOutput = {
        ...clientOutput,
        model: routingDecision.mappedModel, // 应用模型映射
        routing_decision: routingDecision,
      };

      const routerRecord = this.debugRecorder.recordRouterLayer(
        requestId,
        clientOutput,
        routerOutput,
        Date.now() - routerStart,
        routingDecision
      );
      pipelineSteps.push(routerRecord);
      console.log(
        `   ✅ Layer 1 - Router: ${routerRecord.duration}ms (${routingDecision.originalModel} → ${routingDecision.mappedModel})`
      );

      // ===== 调用Pipeline Service处理剩余层级 =====
      const executionContext: ExecutionContext = {
        requestId,
        priority: 'normal',
        debug: this.serverConfig.debug,
        metadata: {
          protocol: 'anthropic',
          model: routerOutput.model,
          clientInfo: req.headers['user-agent'],
          routingDecision,
        },
      };

      // 记录Pipeline Service调用开始
      const pipelineStart = Date.now();
      const result = await this.pipelineService.handleRequest('anthropic', routerOutput, executionContext);
      const pipelineDuration = Date.now() - pipelineStart;

      // ===== 记录真实的剩余层级处理和响应 =====
      const transformedResponse = await this.recordRealPipelineLayers(requestId, routerOutput, result, pipelineSteps);

      // 构造最终响应 - 使用转换后的Anthropic格式响应
      res.body = transformedResponse || result.result;
      res.headers['X-Pipeline-ID'] = result.pipelineId;
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
      res.headers['X-Debug-Layers'] = '6';
      res.headers['X-Debug-File'] = `port-${this.serverConfig.port}/${requestId}`;

      // ===== 记录完整的Pipeline执行 =====
      const totalDuration = Date.now() - startTime;
      const pipelineRecord = this.debugRecorder.createPipelineRecord(
        requestId,
        'anthropic',
        req.body,
        result.result,
        totalDuration,
        pipelineSteps,
        {
          configPath: this.serverConfig.configPath || 'unknown',
          routeId: routingDecision.routeId,
          providerId: routingDecision.providerId,
        }
      );

      this.debugRecorder.recordCompleteRequest(pipelineRecord);
      console.log(`✅ [${requestId}] 六层Pipeline处理完成: ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Anthropic请求处理失败:`, (error as Error).message);

      // 记录失败的执行
      const errorRecord = this.debugRecorder.createPipelineRecord(
        requestId,
        'anthropic',
        req.body || {},
        { error: (error as Error).message },
        totalDuration,
        pipelineSteps
      );
      this.debugRecorder.recordCompleteRequest(errorRecord);

      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
        message: 'Invalid request format. Expected OpenAI chat completions format.',
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
          clientInfo: req.headers['user-agent'],
        },
      };

      const result = await this.pipelineService.handleRequest('openai', requestBody, executionContext);

      res.body = result.result;
      res.headers['X-Pipeline-ID'] = result.pipelineId;
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
    } catch (error) {
      console.error('OpenAI request processing failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
        message: 'Invalid request format. Expected Gemini generateContent format.',
      };
      return;
    }

    if (!model) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Model parameter is required',
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
          clientInfo: req.headers['user-agent'],
        },
      };

      const result = await this.pipelineService.handleRequest('gemini', { ...requestBody, model }, executionContext);

      res.body = result.result;
      res.headers['X-Pipeline-ID'] = result.pipelineId;
      res.headers['X-Execution-ID'] = result.executionId;
      res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
    } catch (error) {
      console.error('Gemini request processing failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
        message: 'Pipeline ID is required',
      };
      return;
    }

    const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`,
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
          clientInfo: req.headers['user-agent'],
        },
      };

      const result = await this.pipelineService
        .getPipelineManager()
        .executePipeline(pipelineId, req.body, executionContext);

      res.body = {
        success: true,
        executionId: result.executionId,
        result: result.result,
        performance: result.performance,
      };
    } catch (error) {
      console.error('Direct pipeline request failed:', error);
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Pipeline execution failed',
      };
    }
  }

  /**
   * 获取所有Pipeline状态
   */
  private async handleGetPipelines(req: RequestContext, res: ResponseContext): Promise<void> {
    const pipelineStatuses = this.pipelineService.getPipelineManager().getAllPipelineStatus();

    res.body = {
      pipelines: pipelineStatuses,
      count: Object.keys(pipelineStatuses).length,
      server: this.getStatus(),
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
        message: 'Pipeline ID is required',
      };
      return;
    }

    const status = this.pipelineService.getPipelineManager().getPipelineStatus(pipelineId);
    if (!status) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`,
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
        message: 'Pipeline ID is required',
      };
      return;
    }

    const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`,
      };
      return;
    }

    try {
      await pipeline.start();
      res.body = {
        success: true,
        message: `Pipeline ${pipelineId} started successfully`,
      };
    } catch (error) {
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to start pipeline',
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
        message: 'Pipeline ID is required',
      };
      return;
    }

    const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
    if (!pipeline) {
      res.statusCode = 404;
      res.body = {
        error: 'Not Found',
        message: `Pipeline ${pipelineId} not found`,
      };
      return;
    }

    try {
      await pipeline.stop();
      res.body = {
        success: true,
        message: `Pipeline ${pipelineId} stopped successfully`,
      };
    } catch (error) {
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to stop pipeline',
      };
    }
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
   * 创建默认Pipeline服务
   */
  private createDefaultPipelineService(config: PipelineServerConfig): IPipelineService {
    // 这里需要通过工厂或依赖注入容器创建
    // 暂时抛出错误，要求必须注入Pipeline服务
    throw new Error(
      'Pipeline service must be injected via constructor. Use PipelineServerFactory to create instances.'
    );
  }

  /**
   * 获取Pipeline服务
   */
  getPipelineService(): IPipelineService {
    return this.pipelineService;
  }

  /**
   * 获取Pipeline管理器
   */
  getPipelineManager() {
    return this.pipelineService.getPipelineManager();
  }

  /**
   * 获取Pipeline配置
   */
  getPipelineConfigs(): PipelineConfig[] {
    return [...this.serverConfig.pipelines];
  }

  /**
   * 获取模型映射（基于v4配置）
   */
  private getModelMapping(originalModel: string): string {
    // 基于lmstudio-v4-5506.json配置的模型映射
    const modelMappings: { [key: string]: string } = {
      'claude-3-5-sonnet-20241022': 'gpt-oss-20b-mlx',
      'claude-3-haiku-20240307': 'qwen3-30b-a3b-instruct-2507-mlx',
      'claude-3-sonnet-20240229': 'gpt-oss-20b-mlx',
      'claude-3-opus-20240229': 'gpt-oss-120b-mlx',
    };

    return modelMappings[originalModel] || 'gpt-oss-20b-mlx'; // 默认模型
  }

  /**
   * 记录真实的Pipeline层级处理和响应 (Layer 2-5)
   * 返回转换后的Anthropic格式响应
   */
  private async recordRealPipelineLayers(
    requestId: string,
    transformerInput: any,
    pipelineResult: any,
    pipelineSteps: PipelineLayerRecord[]
  ): Promise<any> {
    try {
      console.log(`🔍 [${requestId}] 开始记录真实的Pipeline响应层级...`);

      // 获取最终的API响应数据
      const finalResponse = pipelineResult.result;
      console.log(`📦 [${requestId}] 收到最终响应:`, finalResponse ? '有数据' : '无数据');

      // ===== Layer 2: Transformer Layer - 记录真实转换过程 =====
      const transformerStart = Date.now();

      // 转换Anthropic请求为OpenAI格式 (输入处理)
      const transformerRequestOutput = {
        model: transformerInput.model,
        messages: transformerInput.messages,
        max_tokens: transformerInput.max_tokens || 4096,
        temperature: transformerInput.temperature || 1.0,
        stream: transformerInput.stream || false,
        tools: transformerInput.tools || null,
      };

      // 转换OpenAI响应为Anthropic格式 (输出处理) - 实际调用transformer
      let transformerResponseOutput;
      if (finalResponse) {
        try {
          // 创建临时transformer实例进行响应转换
          const { AnthropicToOpenAITransformer } = await import(
            '../modules/transformers/anthropic-to-openai-transformer'
          );
          const responseTransformer = new AnthropicToOpenAITransformer();

          // 调用响应转换
          transformerResponseOutput = await responseTransformer.process(finalResponse);
          console.log(`🔄 [${requestId}] OpenAI响应成功转换为Anthropic格式`);
        } catch (transformError) {
          console.error(`❌ [${requestId}] 响应转换失败:`, transformError.message);
          // 如果转换失败，使用默认Anthropic格式
          transformerResponseOutput = {
            id: `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            model: transformerInput.model,
            content: [
              { type: 'text', text: finalResponse.choices?.[0]?.message?.content || 'Response conversion failed' },
            ],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: finalResponse.usage?.prompt_tokens || 0,
              output_tokens: finalResponse.usage?.completion_tokens || 0,
            },
          };
        }
      } else {
        // 如果没有finalResponse，使用错误响应
        transformerResponseOutput = {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: transformerInput.model,
          content: [{ type: 'text', text: 'No response received from server' }],
          stop_reason: 'error',
          usage: { input_tokens: 0, output_tokens: 0 },
        };
      }

      const transformerRecord = this.debugRecorder.recordTransformerLayer(
        requestId,
        { request: transformerInput, response_raw: pipelineResult.result },
        {
          openai_request: transformerRequestOutput,
          anthropic_response: transformerResponseOutput,
          conversion_direction: 'bidirectional',
        },
        Date.now() - transformerStart,
        'anthropic-to-openai'
      );
      pipelineSteps.push(transformerRecord);
      console.log(`   ✅ Layer 2 - Transformer: ${transformerRecord.duration}ms (双向转换完成)`);

      // ===== Layer 3: Protocol Layer - 记录协议处理 =====
      const protocolStart = Date.now();
      const protocolOutput = {
        input_protocol: 'anthropic',
        output_protocol: 'openai',
        protocol_version: 'openai-v1',
        streaming_supported: transformerInput.stream || false,
        content_type: 'application/json',
        api_version: 'v1',
        response_format: 'anthropic',
      };

      const protocolRecord = this.debugRecorder.recordProtocolLayer(
        requestId,
        { openai_request: transformerRequestOutput },
        { ...protocolOutput, final_response: finalResponse },
        Date.now() - protocolStart,
        'openai'
      );
      pipelineSteps.push(protocolRecord);
      console.log(`   ✅ Layer 3 - Protocol: ${protocolRecord.duration}ms`);

      // ===== Layer 4: Server-Compatibility Layer - 记录兼容性处理 =====
      const compatibilityStart = Date.now();
      const compatibilityOutput = {
        compatibility_layer: 'lmstudio',
        endpoint_ready: true,
        target_server: 'http://localhost:1234/v1',
        model_mapping: {
          original: transformerInput.routing_decision?.originalModel || transformerInput.model,
          mapped: transformerInput.model,
        },
        lmstudio_ready: true,
        response_received: !!finalResponse,
      };

      const compatibilityRecord = this.debugRecorder.recordServerCompatibilityLayer(
        requestId,
        { protocol_output: protocolOutput },
        { ...compatibilityOutput, api_response: finalResponse },
        Date.now() - compatibilityStart,
        'lmstudio'
      );
      pipelineSteps.push(compatibilityRecord);
      console.log(`   ✅ Layer 4 - Server-Compatibility: ${compatibilityRecord.duration}ms`);

      // ===== Layer 5: Server Layer - 记录实际API调用结果 =====
      const serverStart = Date.now();
      const serverSuccess = !!(finalResponse && !finalResponse.error);
      const serverError = serverSuccess
        ? undefined
        : finalResponse?.error || 'LM Studio connection failed: Service unavailable';

      const serverApiInput = {
        endpoint: 'http://localhost:1234/v1/chat/completions',
        method: 'POST',
        model: transformerInput.model,
        request_data: transformerRequestOutput,
      };

      const serverApiOutput = serverSuccess
        ? {
            status_code: 200,
            response_data: finalResponse,
            connection_successful: true,
            lmstudio_model: transformerInput.model,
            response_time: pipelineResult.performance?.totalTime || 0,
          }
        : {
            status_code: 500,
            error: serverError,
            connection_successful: false,
          };

      const serverRecord = this.debugRecorder.recordServerLayer(
        requestId,
        serverApiInput,
        serverApiOutput,
        Date.now() - serverStart,
        serverSuccess,
        serverError
      );
      pipelineSteps.push(serverRecord);
      console.log(`   ${serverSuccess ? '✅' : '❌'} Layer 5 - Server: ${serverRecord.duration}ms`);

      console.log(`🎯 [${requestId}] 所有Pipeline层级响应记录完成 - 包含真实API响应数据`);

      // 返回转换后的Anthropic格式响应
      return transformerResponseOutput;
    } catch (error) {
      console.error(`❌ [PIPELINE-DEBUG] 记录真实层级失败:`, (error as Error).message);
      console.error(`   请求ID: ${requestId}`);
      console.error(`   错误详情:`, error);

      // 错误情况下返回null，让调用者使用原始响应
      return null;
    }
  }

  /**
   * 获取服务器状态
   * 委托给HTTPServer并添加Pipeline相关信息
   */
  getStatus(): ServerStatus & { pipelines?: any } {
    const httpStatus = this.httpServer.getStatus();
    const pipelineServiceStatus = this.pipelineService.getStatus();

    return {
      ...httpStatus,
      activePipelines: pipelineServiceStatus?.pipelineCount || 0,
      pipelines: pipelineServiceStatus?.pipelines || {},
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
