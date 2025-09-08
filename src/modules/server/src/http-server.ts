/**
 * HTTP服务器核心类 - 集成RCC v4.0完整流水线
 *
 * 重构版本：按功能模块拆分，提高代码可维护性
 *
 * @author Claude Code Router v4.0
 */

import * as http from 'http';
import * as url from 'url';
import { EventEmitter } from 'events';
import {
  HTTPServerCore,
  ServerConfig,
  RequestContext,
  ResponseContext,
  AssembledPipeline,
  HTTPMethod,
  ServerStatus,
  RouteHandler,
  Route
} from './http-types';
import { HTTPContextManager } from './http-context-manager';
import { HTTPRoutingSystemImpl } from './http-routing-system';
import { HTTPRequestHandlersImpl } from './http-handlers';
import { AnthropicMessageHandlerImpl } from './http-anthropic-handler';
import { getEnhancedErrorHandler, EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { HTTPErrorCenter } from './http-error-center';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';
import { RCCError, RCCErrorCode } from '../../types/src/index';

/**
 * HTTP服务器核心类 - 组合架构重构版本
 * 
 * 将大文件拆分为多个功能模块，每个模块专注于特定功能：
 * - HTTPContextManager: 请求上下文管理
 * - HTTPRoutingSystemImpl: 路由系统
 * - HTTPRequestHandlersImpl: 基础请求处理
 * - AnthropicMessageHandlerImpl: Anthropic消息处理
 * - HTTPErrorCenter: 错误处理
 */
export class HTTPServer extends EventEmitter implements HTTPServerCore {
  private server: http.Server | null = null;
  private routes: Map<string, Route[]> = new Map();
  private config: ServerConfig;
  private isRunning: boolean = false;
  private startTime: Date | null = null;
  private requestCount: number = 0;
  private connections: Set<any> = new Set();
  
  // 组件实例
  private contextManager: HTTPContextManager;
  private routingSystem: HTTPRoutingSystemImpl;
  private requestHandlers: HTTPRequestHandlersImpl;
  private anthropicHandler: AnthropicMessageHandlerImpl;
  private errorHandler: EnhancedErrorHandler;
  private httpErrorCenter: HTTPErrorCenter;
  private debugIntegration: ModuleDebugIntegration;
  
  // 外部注入的流水线组件
  private assembledPipelines: AssembledPipeline[] = [];
  private initialized: boolean = false;

  constructor(config: ServerConfig, private configPath?: string) {
    super();
    this.config = {
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000, // 30秒
      keepAliveTimeout: 5000, // 5秒
      debug: false,
      ...config,
    };

    // 初始化组件
    this.contextManager = new HTTPContextManager(this.config);
    this.routingSystem = new HTTPRoutingSystemImpl();
    this.requestHandlers = new HTTPRequestHandlersImpl();
    this.anthropicHandler = new AnthropicMessageHandlerImpl([], false, this.config.debug);
    
    // 初始化错误处理器
    this.errorHandler = getEnhancedErrorHandler(this.config.port);
    this.httpErrorCenter = new HTTPErrorCenter(this.errorHandler, this.config.debug);
    
    // Debug集成将在外部通过setDebugIntegration方法设置
    this.debugIntegration = null as any; // 初始化为null，等待外部设置

    this.initializeRoutes();
  }

  /**
   * 设置流水线（供外部调用）
   */
  setPipelines(pipelines: AssembledPipeline[], initialized: boolean): void {
    this.assembledPipelines = pipelines;
    this.initialized = initialized;
    this.requestHandlers.setPipelines(pipelines, initialized);
    this.anthropicHandler.setPipelines(pipelines, initialized);
  }

  /**
   * 设置Debug集成（供外部调用）
   */
  setDebugIntegration(debugIntegration: ModuleDebugIntegration): void {
    this.debugIntegration = debugIntegration;
    
    // 确保路由系统有访问Debug集成的能力
    (this.routingSystem as any).debugIntegration = debugIntegration;
    
    // 为Anthropic处理器设置端口信息（用于日志记录）
    if (this.anthropicHandler && typeof this.anthropicHandler.setPort === 'function') {
      const serverPort = debugIntegration['config']?.serverPort || this.config.port;
      this.anthropicHandler.setPort(serverPort);
    }
  }

  /**
   * 初始化默认路由
   */
  private initializeRoutes(): void {
    // 健康检查路由
    this.addRoute('GET', '/health', async (req, res) => {
      await this.requestHandlers.handleHealthCheck(req, res);
    });

    // 状态路由
    this.addRoute('GET', '/status', async (req, res) => {
      await this.requestHandlers.handleStatus(req, res);
    });

    // 版本信息路由
    this.addRoute('GET', '/version', async (req, res) => {
      await this.requestHandlers.handleVersion(req, res);
    });

    // Anthropic标准messages端点
    this.addRoute('POST', '/v1/messages', async (req, res) => {
      await this.anthropicHandler.handleAnthropicMessages(req, res);
    });

    // OpenAI兼容的聊天完成端点
    this.addRoute('POST', '/v1/chat/completions', async (req, res) => {
      await this.handleChatCompletions(req, res);
    });
  }

  /**
   * 添加路由
   */
  addRoute(method: string, path: string, handler: any): void {
    this.routingSystem.addRoute(method, path, handler);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    return new Promise(async (resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res).catch(error => {
            this.handleError(error, req, res);
          });
        });

        // 配置服务器选项
        this.server.timeout = this.config.timeout!;
        this.server.keepAliveTimeout = this.config.keepAliveTimeout!;

        // 跟踪连接以便强制关闭
        this.server.on('connection', socket => {
          this.connections.add(socket);
          socket.on('close', () => {
            this.connections.delete(socket);
          });
        });

        this.server.on('error', error => {
          this.emit('error', error);
          reject(error);
        });

        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          this.startTime = new Date();
          this.emit('started', {
            host: this.config.host,
            port: this.config.port,
          });

          console.log(`✅ HTTP Server successfully started on http://${this.config.host}:${this.config.port}`);
          console.log(`🌐 Server is listening and ready to accept connections`);
          console.log(`🎉 Clean HTTP server is ready to process requests!`);

          resolve();
        });
      } catch (error) {
        console.error('❌ Failed to initialize HTTP server:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      if (this.config.debug) {
        console.log('⚠️ HTTP Server is not running, skipping stop');
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 超时处理：强制关闭所有连接
        if (this.config.debug) {
          console.log('⏰ HTTP Server stop timeout, forcing connections to close');
        }

        for (const socket of this.connections) {
          try {
            socket.destroy();
          } catch (error) {
            // 忽略销毁连接时的错误
          }
        }
        this.connections.clear();

        this.isRunning = false;
        this.startTime = null;
        this.server = null;
        this.emit('stopped');

        resolve();
      }, 5000); // 5秒超时

      // 首先停止接受新连接
      this.server!.close(error => {
        clearTimeout(timeout);

        if (error) {
          if (this.config.debug) {
            console.log('❌ HTTP Server close error:', error.message);
          }
          // 即使有错误，也要强制关闭连接
        }

        // 强制关闭所有现有连接
        for (const socket of this.connections) {
          try {
            socket.destroy();
          } catch (socketError) {
            // 忽略销毁连接时的错误
          }
        }
        this.connections.clear();

        this.isRunning = false;
        this.startTime = null;
        this.server = null;
        this.emit('stopped');

        if (this.config.debug) {
          console.log('🛑 HTTP Server stopped successfully');
        }

        resolve();
      });
    });
  }

  /**
   * 获取服务器状态
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      startTime: this.startTime,
      version: '4.0.0-alpha.1-clean',
      activePipelines: this.assembledPipelines.length,
      totalRequests: this.requestCount,
      uptime: this.calculateUptime(),
      health: {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        checks: this.requestHandlers.getServerStatus().health.checks,
      },
    };
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.requestCount++;

    // 创建请求上下文
    const requestContext = this.contextManager.createRequestContext(req);
    const responseContext = this.contextManager.createResponseContext(requestContext, res);

    try {
      // 解析请求体
      await this.contextManager.parseRequestBody(req, requestContext);

      // 执行路由处理器
      await this.routingSystem.executeRoute(requestContext, responseContext);

      // 发送响应
      await this.contextManager.sendResponse(res, responseContext);
    } catch (error) {
      await this.handleError(error, req, res);
    }
  }

  /**
   * 创建请求上下文
   */
  private createRequestContext(req: http.IncomingMessage): RequestContext {
    const requestId = this.generateRequestId();
    const parsedUrl = url.parse(req.url || '', true);

    return {
      id: requestId,
      startTime: new Date(),
      method: (req.method || 'GET') as HTTPMethod,
      url: req.url || '/',
      headers: req.headers as Record<string, string | string[]>,
      query: parsedUrl.query as Record<string, string>,
      params: {},
      metadata: {},
    };
  }

  /**
   * 创建响应上下文
   */
  private createResponseContext(req: RequestContext, originalResponse?: http.ServerResponse): ResponseContext {
    return {
      req,
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': req.id,
      },
      sent: false,
      _originalResponse: originalResponse,
    };
  }

  /**
   * 解析请求体
   */
  private async parseRequestBody(req: http.IncomingMessage, context: RequestContext): Promise<void> {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return;
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > this.config.maxRequestSize!) {
          reject(new Error('Request body too large'));
          return;
        }

        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');

          if (body.trim()) {
            const contentType = req.headers['content-type'] || '';

            if (contentType.includes('application/json')) {
              try {
                // 使用标准JSON.parse替代JQJsonHandler.parseJsonString
                context.body = JSON.parse(body);
              } catch (parseError) {
                // 提供详细的JSON解析错误信息
                const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown JSON parsing error';
                const contextualError = new Error(`Invalid JSON format in request body: ${errorMessage}. Body preview: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
                
                if (this.config.debug) {
                  console.error('❌ JSON parsing failed:', {
                    error: errorMessage,
                    bodyLength: body.length,
                    bodyPreview: body.substring(0, 100),
                    contentType: contentType
                  });
                }
                
                reject(contextualError);
                return;
              }
            } else {
              context.body = body;
            }
          } else {
            // 空请求体，设置为undefined
            context.body = undefined;
          }

          resolve();
        } catch (error) {
          // 捕获其他可能的错误（如编码问题）
          const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
          const contextualError = new Error(`Failed to process request body: ${errorMessage}`);
          
          if (this.config.debug) {
            console.error('❌ Request body processing failed:', {
              error: errorMessage,
              totalSize: totalSize,
              chunksCount: chunks.length
            });
          }
          
          reject(contextualError);
        }
      });

      req.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown request error';
        reject(new Error(`Request stream error: ${errorMessage}`));
      });
    });
  }

  
  /**
   * 执行路由处理器
   */
  private async executeRoute(req: RequestContext, res: ResponseContext): Promise<void> {
    const routes = this.routes.get(req.method) || [];
    const route = this.findMatchingRoute(routes, req.url);

    if (!route) {
      res.statusCode = 404;
      res.body = { error: 'Not Found', message: `Route ${req.method} ${req.url} not found` };
      return;
    }

    // 提取路径参数
    this.extractPathParams(route.path, req.url, req);

    // 执行路由处理器
    await route.handler(req, res);
  }

  /**
   * 查找匹配的路由
   */
  private findMatchingRoute(routes: Route[], path: string): Route | null {
    // 简单实现：先查找精确匹配，后续可以扩展支持路径参数
    for (const route of routes) {
      if (this.pathMatches(route.path, path)) {
        return route;
      }
    }
    return null;
  }

  /**
   * 路径匹配检查
   */
  private pathMatches(routePath: string, requestPath: string): boolean {
    // 移除查询参数
    const cleanPath = requestPath.split('?')[0];

    // 简单实现：精确匹配
    if (routePath === cleanPath) {
      return true;
    }

    // TODO: 支持路径参数匹配 (如 /user/:id)
    return false;
  }

  /**
   * 提取路径参数
   */
  private extractPathParams(routePath: string, requestPath: string, req: RequestContext): void {
    // TODO: 实现路径参数提取
    // 目前只支持精确匹配，不需要参数提取
  }

  
  /**
   * 发送响应
   */
  private async sendResponse(res: http.ServerResponse, context: ResponseContext): Promise<void> {
    if (context.sent) {
      return;
    }

    context.sent = true;

    // 设置响应头
    for (const [key, value] of Object.entries(context.headers)) {
      if (value !== undefined && value !== null) {
        res.setHeader(key, value);
      }
    }

    res.statusCode = context.statusCode;

    // 发送响应体
    if (context.body !== undefined) {
      // 检查是否为流式响应
      if (typeof context.body === 'object' && context.body !== null && 'chunks' in context.body) {
        // 处理流式响应
        const streamResponse = context.body as any;
        if (Array.isArray(streamResponse.chunks)) {
          // 设置流式响应头
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          // 发送每个chunk
          for (const chunk of streamResponse.chunks) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);

            // 添加延迟以实现流式传输效果
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          res.end();
        } else {
          // 如果chunks不是数组，回退到普通JSON响应
          res.end(JSON.stringify(context.body, null, 2));
        }
      } else if (typeof context.body === 'object') {
        res.end(JSON.stringify(context.body, null, 2));
      } else {
        res.end(String(context.body));
      }
    } else {
      res.end();
    }

    if (this.config.debug) {
      const duration = Date.now() - context.req.startTime.getTime();
      console.log(
        `📤 ${context.statusCode} ${context.req.method} ${context.req.url} [${context.req.id}] ${duration}ms`
      );
    }
  }

  /**
   * 处理错误 - 使用HTTP错误中心协同机制
   * 
   * 错误处理流程：
   * 1. 错误处理中心分类和处理错误
   * 2. 无法处理的错误交给HTTP错误中心
   * 3. HTTP错误中心生成响应：500为本地错误，其余错误码原样返回
   */
  private async handleError(error: unknown, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestId = `http-error-${Date.now()}`;
    
    // 创建RCC错误对象
    let rccError: RCCError;
    if (error instanceof RCCError) {
      rccError = error;
    } else {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      rccError = new RCCError(
        message,
        RCCErrorCode.INTERNAL_ERROR,
        'http-server',
        { details: { originalError: error } }
      );
    }

    // 使用HTTP错误中心处理错误
    try {
      const httpErrorResponse = await this.httpErrorCenter.handleUnprocessedError(rccError, {
        requestId,
        endpoint: req.url || 'unknown',
        method: req.method || 'unknown',
        originalError: error
      });

      // 发送HTTP错误响应
      await this.sendErrorResponse(res, httpErrorResponse);

      console.error(`❌ Server Error [${httpErrorResponse.statusCode}]: ${rccError.message}`);
      if (this.config.debug) {
        console.error('Stack trace:', rccError.stack);
      }

    } catch (centerError) {
      // HTTP错误中心本身失败，使用最基本的错误响应
      console.error('❌ HTTP Error Center failed:', centerError);
      
      try {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Request-ID', requestId);
        res.setHeader('X-Error-Type', 'error_center_failed');
        
        const fallbackResponse = {
          error: {
            message: this.config.debug ? 
              `HTTP Error Center failed: ${centerError instanceof Error ? centerError.message : String(centerError)}` :
              'Internal Server Error',
            type: 'internal_server_error',
            code: 'error_center_failed',
            requestId: requestId,
            timestamp: new Date().toISOString()
          }
        };

        res.end(JSON.stringify(fallbackResponse, null, 2));
      } catch (responseError) {
        // 如果连 fallback 响应都无法发送，则发送最基本的文本响应
        console.error('❌ Critical: Failed to send fallback error response:', responseError);
        try {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Critical Internal Server Error');
        } catch (criticalError) {
          console.error('❌ Catastrophic: Cannot send any error response:', criticalError);
        }
      }
    }

    // 发出错误事件但不让它在错误处理过程中导致进程崩溃
    try {
      this.emit('error', rccError);
    } catch (eventError) {
      console.error('❌ Error in error event handler:', eventError);
    }
  }

  /**
   * 发送HTTP错误响应
   */
  private async sendErrorResponse(res: http.ServerResponse, errorResponse: any): Promise<void> {
    if (res.headersSent) {
      return; // 如果响应已经发送，无法再发送错误响应
    }

    // 设置响应头
    for (const [key, value] of Object.entries(errorResponse.headers)) {
      if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) {
        res.setHeader(key, value);
      }
    }

    // 设置状态码
    res.statusCode = errorResponse.statusCode;

    // 发送响应体
    res.end(JSON.stringify(errorResponse.body, null, 2));
  }

  /**
   * 获取公开的错误消息（不暴露内部细节）
   */
  private getPublicErrorMessage(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'Bad Request - The request could not be processed due to invalid syntax or content.';
      case 413:
        return 'Payload Too Large - The request body exceeds the maximum allowed size.';
      case 500:
        return 'Internal Server Error - An unexpected error occurred while processing the request.';
      default:
        return 'An error occurred while processing the request.';
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置内置路由
   */
  private setupBuiltinRoutes(): void {
    // 健康检查端点
    this.addRoute('GET', '/health', async (req, res) => {
      const healthChecks = this.performHealthChecks();
      const overallStatus = healthChecks.every(check => check.status === 'pass') ? 'healthy' : 'unhealthy';

      res.statusCode = overallStatus === 'healthy' ? 200 : 503;
      res.body = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: healthChecks,
        version: '4.0.0-alpha.1',
        pipelines: this.assembledPipelines.length
      };
    });

    // 详细状态端点
    this.addRoute('GET', '/status', async (req, res) => {
      const serverStatus = this.getStatus();

      res.body = {
        server: {
          status: serverStatus.isRunning ? 'running' : 'stopped',
          host: serverStatus.host,
          port: serverStatus.port,
          uptime: serverStatus.uptime,
          totalRequests: serverStatus.totalRequests,
          startTime: serverStatus.startTime,
          version: serverStatus.version,
        },
        health: {
          overall: serverStatus.health.status,
          checks: serverStatus.health.checks,
        },
        pipelines: {
          total: this.assembledPipelines.length,
          initialized: this.initialized
        },
        performance: {
          memoryUsage: process.memoryUsage().heapUsed,
          cpuUsage: process.cpuUsage(),
          averageResponseTime: 0,
        },
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * 获取活跃Pipeline数量
   */
  private getActivePipelineCount(): number {
    return this.assembledPipelines.length;
  }

  /**
   * 计算运行时间
   */
  private calculateUptime(): string {
    if (!this.startTime) {
      return '0s';
    }

    const uptimeMs = Date.now() - this.startTime.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 执行健康检查
   */
  private performHealthChecks(): Array<{ name: string; status: 'pass' | 'warn' | 'fail'; responseTime: number }> {
    const checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; responseTime: number }> = [];

    // HTTP服务器检查
    const start = Date.now();
    checks.push({
      name: 'HTTP Server',
      status: this.isRunning ? 'pass' : 'fail',
      responseTime: Date.now() - start,
    });

    // 内存检查
    const memStart = Date.now();
    const memUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB
    checks.push({
      name: 'Memory Usage',
      status: memUsage.heapUsed < maxMemory ? 'pass' : 'warn',
      responseTime: Date.now() - memStart,
    });

    return checks;
  }

  /**
   * 处理健康检查请求
   */
  private async handleHealthCheck(req: RequestContext, res: ResponseContext): Promise<void> {
    const health = this.performHealthChecks();
    const overallStatus = health.every(check => check.status === 'pass') ? 'healthy' : 'degraded';

    res.body = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: health,
    };
  }

  /**
   * 处理状态请求
   */
  private async handleStatus(req: RequestContext, res: ResponseContext): Promise<void> {
    res.body = this.getStatus();
  }

  /**
   * 处理版本信息请求
   */
  private async handleVersion(req: RequestContext, res: ResponseContext): Promise<void> {
    res.body = {
      name: 'RCC (Route Claude Code)',
      version: '4.0.0-alpha.1',
      description: 'Modular AI routing proxy system',
      author: 'Jason Zhang',
    };
  }


  /**
   * 处理OpenAI兼容的聊天完成请求 - 带详细流水线日志
   */
  private async handleChatCompletions(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestId = req.id;
    const startTime = Date.now();
    
    // 初始化debug系统并开始会话
    if (this.debugIntegration) {
      await this.debugIntegration.initialize();
    }
    let sessionId;
    if (this.debugIntegration) {
      sessionId = this.debugIntegration.startSession();
    }
    
    console.log(`🎯 [${requestId}] 收到OpenAI聊天完成请求`);
    console.log(`📡 [${requestId}] 请求详情: ${req.method} ${req.url}`);
    console.log(`📋 [${requestId}] 请求体类型: ${typeof req.body}, 大小: ${JSON.stringify(req.body || {}).length} 字符`);
    
    // 记录输入
    if (this.debugIntegration) {
      this.debugIntegration.recordInput(requestId, {
        method: req.method,
        url: req.url,
        hasBody: !!req.body,
        bodyType: typeof req.body,
        endpoint: 'chat-completions',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // HTTP层基础验证
      if (!req.body) {
        console.error(`❌ [${requestId}] 请求体缺失`);
        const error = new RCCError(
          'Request body is required',
          RCCErrorCode.VALIDATION_ERROR,
          'http-server',
          { endpoint: '/v1/chat/completions' }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordError(requestId, error);
        }
        await this.errorHandler.handleRCCError(error, { requestId, endpoint: '/v1/chat/completions' });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        res.statusCode = 400;
        res.body = { error: { message: 'Request body is required', type: 'invalid_request_error' } };
        return;
      }

      console.log(`🔍 [${requestId}] 开始流水线选择过程...`);
      
      // 选择合适的流水线  
      const selectedPipeline = this.assembledPipelines[0]; // 简单选择第一个可用流水线
      if (!selectedPipeline) {
        console.error(`❌ [${requestId}] 未找到合适的流水线处理此请求`);
        const error = new RCCError(
          'No suitable pipeline found for this request',
          RCCErrorCode.PIPELINE_MODULE_MISSING,
          'http-server',
          { endpoint: '/v1/chat/completions' }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordError(requestId, error);
        }
        await this.errorHandler.handleRCCError(error, { requestId, endpoint: '/v1/chat/completions' });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        res.statusCode = 503;
        res.body = { error: { message: 'Service Temporarily Unavailable - No pipeline available', type: 'service_unavailable' } };
        return;
      }

      console.log(`✅ [${requestId}] 已选择流水线: ${selectedPipeline.id}`);
      console.log(`📊 [${requestId}] 流水线信息: provider=${selectedPipeline.provider}, model=${selectedPipeline.model}`);

      // 准备流水线输入数据
      const pipelineInput = {
        url: req.url,
        method: 'POST',
        headers: req.headers,
        body: req.body,
        requestId: requestId,
        isOpenAIFormat: true
      };

      console.log(`⚡ [${requestId}] 开始执行流水线处理...`);
      
      try {
        // 执行流水线处理
        const pipelineResult = await selectedPipeline.execute(pipelineInput);
        const processingTime = Date.now() - startTime;

        console.log(`🎉 [${requestId}] 流水线处理成功完成! 耗时: ${processingTime}ms`);
        console.log(`📤 [${requestId}] 响应状态码: ${pipelineResult.statusCode || 200}`);
        console.log(`📝 [${requestId}] 响应内容类型: ${pipelineResult.contentType || 'application/json'}`);

        // 设置响应头和状态码
        res.statusCode = pipelineResult.statusCode || 200;
        res.headers['Content-Type'] = pipelineResult.contentType || 'application/json';
        res.headers['X-Pipeline-ID'] = selectedPipeline.id;
        res.headers['X-Processing-Time'] = processingTime.toString();
        res.headers['X-Provider'] = selectedPipeline.provider;
        res.headers['X-Model'] = selectedPipeline.model;
        
        // 直接使用流水线返回的响应体
        res.body = pipelineResult.responseBody;
        
        console.log(`✅ [${requestId}] 响应已准备完成，等待发送`);
        
        // 记录成功输出
        if (this.debugIntegration) {
          this.debugIntegration.recordOutput(requestId, {
            success: true,
            pipelineId: selectedPipeline.id,
            processingTime,
            statusCode: res.statusCode,
            endpoint: 'chat-completions',
            provider: selectedPipeline.provider,
            model: selectedPipeline.model
          });
        }

      } catch (pipelineError) {
        const processingTime = Date.now() - startTime;
        console.error(`💥 [${requestId}] 流水线执行失败! 耗时: ${processingTime}ms`);
        console.error(`🔥 [${requestId}] 流水线错误详情:`, pipelineError);
        
        const error = new RCCError(
          `Pipeline execution failed: ${pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error'}`,
          RCCErrorCode.PIPELINE_EXECUTION_FAILED,
          'http-server',
          { 
            endpoint: '/v1/chat/completions',
            pipelineId: selectedPipeline.id,
            details: { originalError: pipelineError, processingTime }
          }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordError(requestId, pipelineError as Error);
        }
        await this.errorHandler.handleRCCError(error, { 
          requestId, 
          endpoint: '/v1/chat/completions',
          pipelineId: selectedPipeline.id 
        });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        // 返回OpenAI格式的错误响应
        res.statusCode = 500;
        res.headers['Content-Type'] = 'application/json';
        res.body = {
          error: {
            message: 'Internal server error during processing',
            type: 'server_error',
            code: 'pipeline_execution_failed'
          }
        };
        return;
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`💀 [${requestId}] 系统级错误! 耗时: ${processingTime}ms`);
      console.error(`🚨 [${requestId}] 系统错误详情:`, error);
      
      if (this.debugIntegration) {
        this.debugIntegration.recordError(requestId, error as Error);
      }
      
      const rccError = new RCCError(
        `Internal server error during chat completion processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.INTERNAL_ERROR,
        'http-server',
        { details: { endpoint: '/v1/chat/completions', originalError: error, processingTime } }
      );
      
      await this.errorHandler.handleRCCError(rccError, { requestId, endpoint: '/v1/chat/completions' });
      if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
      
      // 返回OpenAI格式的错误响应
      res.statusCode = 500;
      res.headers['Content-Type'] = 'application/json';
      res.body = {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 'internal_error'
        }
      };
      return;
    } finally {
      const totalTime = Date.now() - startTime;
      console.log(`🏁 [${requestId}] 请求处理结束，总耗时: ${totalTime}ms`);
      if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
    }
  }

  /**
   * 处理Anthropic标准messages请求 - 纯HTTP层处理
   */
  private async handleAnthropicMessages(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestId = req.id;
    const startTime = Date.now();
    
    // 初始化debug系统并开始会话
    if (this.debugIntegration) {
      await this.debugIntegration.initialize();
    }
    let sessionId;
    if (this.debugIntegration) {
      sessionId = this.debugIntegration.startSession();
    }
    
    console.log(`🎯 [${requestId}] 收到Anthropic Messages请求`);
    console.log(`📡 [${requestId}] 请求详情: ${req.method} ${req.url}`);
    console.log(`📋 [${requestId}] 请求体类型: ${typeof req.body}, 大小: ${JSON.stringify(req.body || {}).length} 字符`);
    
    // 记录输入
    if (this.debugIntegration) {
      this.debugIntegration.recordInput(requestId, {
        method: req.method,
        url: req.url,
        hasBody: !!req.body,
        bodyType: typeof req.body,
        endpoint: 'anthropic-messages',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // HTTP层基础验证
      if (!req.body) {
        console.error(`❌ [${requestId}] 请求体缺失`);
        const error = new RCCError(
          'Request body is required',
          RCCErrorCode.VALIDATION_ERROR,
          'http-server',
          { endpoint: '/v1/messages' }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordEvent('request_error', requestId, { error: 'missing_body' });
        }
        await this.errorHandler.handleRCCError(error, { requestId, endpoint: '/v1/messages' });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        // 直接返回错误响应
        const httpError = await this.httpErrorCenter.handleUnprocessedError(error, {
          requestId,
          endpoint: '/v1/messages',
          method: req.method,
          originalError: error
        });
        await this.sendErrorResponse(res._originalResponse || res as any, httpError);
        return;
      }

      console.log(`🔍 [${requestId}] 开始检查流水线系统状态...`);
      console.log(`📊 [${requestId}] 系统状态: initialized=${this.initialized}, pipelines=${this.assembledPipelines.length}`);
      
      // 检查流水线系统状态
      if (!this.initialized || this.assembledPipelines.length === 0) {
        console.error(`❌ [${requestId}] 流水线系统未初始化或无可用流水线`);
        const error = new RCCError(
          'Pipeline system not initialized or no pipelines available',
          RCCErrorCode.PIPELINE_MODULE_MISSING,
          'http-server',
          { endpoint: '/v1/messages' }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordEvent('service_error', requestId, { error: 'pipeline_not_ready' });
        }
        await this.errorHandler.handleRCCError(error, { requestId, endpoint: '/v1/messages' });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        // 直接返回错误响应
        const httpError = await this.httpErrorCenter.handleUnprocessedError(error, {
          requestId,
          endpoint: '/v1/messages',
          method: req.method,
          originalError: error
        });
        await this.sendErrorResponse(res._originalResponse || res as any, httpError);
        return;
      }

      // 选择流水线
      const selectedPipeline = this.assembledPipelines[0];
      
      console.log(`✅ [${requestId}] 已选择流水线: ${selectedPipeline.id}`);
      console.log(`📊 [${requestId}] 流水线信息: provider=${selectedPipeline.provider}, model=${selectedPipeline.model}`);

      // 准备流水线输入 - 发送原始请求数据
      const pipelineInput = {
        endpoint: '/v1/messages',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        requestId: requestId,
        isAnthropicFormat: true
      };

      console.log(`⚡ [${requestId}] 开始执行流水线处理...`);

      // 通过流水线处理请求
      const pipelineStartTime = Date.now();
      
      try {
        // 执行流水线处理 - 流水线负责所有格式转换
        const pipelineResult = await selectedPipeline.execute(pipelineInput);
        const processingTime = Date.now() - pipelineStartTime;
        const totalTime = Date.now() - startTime;

        console.log(`🎉 [${requestId}] 流水线处理成功完成! 耗时: ${processingTime}ms`);
        console.log(`📤 [${requestId}] 响应状态码: ${pipelineResult.statusCode || 200}`);
        console.log(`📝 [${requestId}] 响应内容类型: ${pipelineResult.contentType || 'application/json'}`);

        // 设置响应头和状态码
        res.statusCode = pipelineResult.statusCode || 200;
        res.headers['Content-Type'] = pipelineResult.contentType || 'application/json';
        res.headers['X-Pipeline-ID'] = selectedPipeline.id;
        res.headers['X-Processing-Time'] = processingTime.toString();
        res.headers['X-Provider'] = selectedPipeline.provider;
        res.headers['X-Model'] = selectedPipeline.model;
        
        // 直接使用流水线返回的响应体（已转换为Anthropic格式）
        res.body = pipelineResult.responseBody;
        
        console.log(`✅ [${requestId}] 响应已准备完成，等待发送`);
        
        // 记录成功输出
        if (this.debugIntegration) {
          this.debugIntegration.recordOutput(requestId, {
            success: true,
            pipelineId: selectedPipeline.id,
            processingTime,
            statusCode: res.statusCode,
            endpoint: 'anthropic-messages'
          });
        }

      } catch (pipelineError) {
        const processingTime = Date.now() - pipelineStartTime;
        console.error(`💥 [${requestId}] 流水线执行失败! 耗时: ${processingTime}ms`);
        console.error(`🔥 [${requestId}] 流水线错误详情:`, pipelineError);
        console.error(`📍 [${requestId}] 失败的流水线: ${selectedPipeline.id} (${selectedPipeline.provider}/${selectedPipeline.model})`);
        
        const error = new RCCError(
          `Pipeline execution failed: ${pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error'}`,
          RCCErrorCode.PIPELINE_EXECUTION_FAILED,
          'http-server',
          { 
            endpoint: '/v1/messages',
            pipelineId: selectedPipeline.id,
            details: { originalError: pipelineError, processingTime }
          }
        );
        
        if (this.debugIntegration) {
          this.debugIntegration.recordError(requestId, pipelineError as Error);
        }
        await this.errorHandler.handleRCCError(error, { 
          requestId, 
          endpoint: '/v1/messages',
          pipelineId: selectedPipeline.id 
        });
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
        
        // 直接返回错误响应
        const httpError = await this.httpErrorCenter.handleUnprocessedError(error, {
          requestId,
          endpoint: '/v1/messages',
          method: req.method,
          pipelineId: selectedPipeline.id,
          originalError: pipelineError
        });
        await this.sendErrorResponse(res._originalResponse || res as any, httpError);
        return;
      }

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`💀 [${requestId}] 系统级错误! 总耗时: ${totalTime}ms`);
      console.error(`🚨 [${requestId}] 系统错误详情:`, error);
      
      if (this.debugIntegration) {
        this.debugIntegration.recordError(requestId, error as Error);
      }
      
      const rccError = new RCCError(
        `Internal server error during message processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.INTERNAL_ERROR,
        'http-server',
        { details: { endpoint: '/v1/messages', originalError: error, totalTime } }
      );
      
      await this.errorHandler.handleRCCError(rccError, { requestId, endpoint: '/v1/messages' });
      if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
      
      // 直接返回错误响应
      const httpError = await this.httpErrorCenter.handleUnprocessedError(rccError, {
        requestId,
        endpoint: '/v1/messages',
        method: req.method,
        originalError: error
      });
      await this.sendErrorResponse(res._originalResponse || res as any, httpError);
      return;
    } finally {
      const totalTime = Date.now() - startTime;
      console.log(`🏁 [${requestId}] Anthropic Messages请求处理结束，总耗时: ${totalTime}ms`);
      if (this.debugIntegration) {
        if (this.debugIntegration) {
          if (this.debugIntegration) {
        await this.debugIntegration.endSession();
      }
        }
      }
    }
  }

  /**
   * 安全的Debug集成调用助手方法
   */
  private async safeDebugCall<T>(operation: (debug: any) => T): Promise<T | void> {
    if (this.debugIntegration) {
      return await operation(this.debugIntegration);
    }
  }
}
