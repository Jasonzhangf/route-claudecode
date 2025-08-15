/**
 * HTTP服务器核心类
 * 
 * 实现RCC v4.0的HTTP服务器基础功能，包括路由、中间件、错误处理
 * 
 * @author Jason Zhang
 */

import * as http from 'http';
import * as url from 'url';
import { EventEmitter } from 'events';
import { ServerStatus } from '../interfaces';

/**
 * HTTP请求上下文
 */
export interface RequestContext {
  readonly id: string;
  readonly startTime: Date;
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string | string[]>;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
  body?: any;
  user?: any;
  metadata?: Record<string, any>;
}

/**
 * HTTP响应上下文
 */
export interface ResponseContext {
  readonly req: RequestContext;
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  sent: boolean;
}

/**
 * 中间件函数类型
 */
export type MiddlewareFunction = (
  req: RequestContext,
  res: ResponseContext,
  next: (error?: Error) => void
) => void | Promise<void>;

/**
 * 路由处理函数类型
 */
export type RouteHandler = (
  req: RequestContext,
  res: ResponseContext
) => void | Promise<void>;

/**
 * 路由定义
 */
export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: MiddlewareFunction[];
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  maxRequestSize?: number;
  timeout?: number;
  keepAliveTimeout?: number;
  debug?: boolean;
}

/**
 * HTTP服务器核心类
 */
export class HTTPServer extends EventEmitter {
  private server: http.Server | null = null;
  private routes: Map<string, Route[]> = new Map();
  private middleware: MiddlewareFunction[] = [];
  private config: ServerConfig;
  private isRunning: boolean = false;
  private startTime: Date | null = null;
  private requestCount: number = 0;
  
  constructor(config: ServerConfig) {
    super();
    this.config = {
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000, // 30秒
      keepAliveTimeout: 5000, // 5秒
      debug: false,
      ...config
    };
    
    this.initializeRoutes();
  }
  
  /**
   * 初始化默认路由
   */
  private initializeRoutes(): void {
    // 健康检查路由
    this.addRoute('GET', '/health', async (req, res) => {
      await this.handleHealthCheck(req, res);
    });
    
    // 状态路由
    this.addRoute('GET', '/status', async (req, res) => {
      await this.handleStatus(req, res);
    });
    
    // 版本信息路由
    this.addRoute('GET', '/version', async (req, res) => {
      await this.handleVersion(req, res);
    });
  }
  
  /**
   * 添加全局中间件
   */
  use(middleware: MiddlewareFunction): void {
    this.middleware.push(middleware);
  }
  
  /**
   * 添加路由
   */
  addRoute(
    method: string,
    path: string,
    handler: RouteHandler,
    middleware?: MiddlewareFunction[]
  ): void {
    const route: Route = { method, path, handler, middleware };
    
    if (!this.routes.has(method)) {
      this.routes.set(method, []);
    }
    
    this.routes.get(method)!.push(route);
    
    if (this.config.debug) {
      console.log(`📍 Route added: ${method} ${path}`);
    }
  }
  
  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          this.handleError(error, req, res);
        });
      });
      
      // 配置服务器选项
      this.server.timeout = this.config.timeout!;
      this.server.keepAliveTimeout = this.config.keepAliveTimeout!;
      
      this.server.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
      
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.startTime = new Date();
        this.emit('started', {
          host: this.config.host,
          port: this.config.port
        });
        
        if (this.config.debug) {
          console.log(`🚀 HTTP Server started on http://${this.config.host}:${this.config.port}`);
        }
        
        resolve();
      });
    });
  }
  
  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      throw new Error('Server is not running');
    }
    
    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this.emit('error', error);
          reject(error);
          return;
        }
        
        this.isRunning = false;
        this.startTime = null;
        this.server = null;
        this.emit('stopped');
        
        if (this.config.debug) {
          console.log('🛑 HTTP Server stopped');
        }
        
        resolve();
      });
    });
  }
  
  /**
   * 获取服务器状态
   */
  getStatus(): ServerStatus {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      startTime: this.startTime || undefined,
      version: '4.0.0-alpha.1',
      activePipelines: 0, // TODO: 实现流水线计数
      totalRequests: this.requestCount,
      uptime: this.calculateUptime(),
      health: {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        checks: this.performHealthChecks()
      }
    };
  }
  
  /**
   * 处理HTTP请求
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    this.requestCount++;
    
    // 创建请求上下文
    const requestContext = this.createRequestContext(req);
    const responseContext = this.createResponseContext(requestContext);
    
    try {
      if (this.config.debug) {
        console.log(`📥 ${requestContext.method} ${requestContext.url} [${requestContext.id}]`);
      }
      
      // 解析请求体
      await this.parseRequestBody(req, requestContext);
      
      // 执行中间件链
      await this.executeMiddleware(requestContext, responseContext);
      
      // 查找并执行路由处理器
      await this.executeRoute(requestContext, responseContext);
      
      // 发送响应
      this.sendResponse(res, responseContext);
      
    } catch (error) {
      this.handleError(error, req, res);
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
      method: req.method || 'GET',
      url: req.url || '/',
      headers: req.headers as Record<string, string | string[]>,
      query: parsedUrl.query as Record<string, string>,
      params: {},
      metadata: {}
    };
  }
  
  /**
   * 创建响应上下文
   */
  private createResponseContext(req: RequestContext): ResponseContext {
    return {
      req,
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': req.id
      },
      sent: false
    };
  }
  
  /**
   * 解析请求体
   */
  private async parseRequestBody(
    req: http.IncomingMessage,
    context: RequestContext
  ): Promise<void> {
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
          
          if (body) {
            const contentType = req.headers['content-type'] || '';
            
            if (contentType.includes('application/json')) {
              context.body = JSON.parse(body);
            } else {
              context.body = body;
            }
          }
          
          resolve();
        } catch (error) {
          reject(new Error('Invalid request body format'));
        }
      });
      
      req.on('error', reject);
    });
  }
  
  /**
   * 执行中间件链
   */
  private async executeMiddleware(
    req: RequestContext,
    res: ResponseContext
  ): Promise<void> {
    let index = 0;
    
    const next = (error?: Error): void => {
      if (error) {
        throw error;
      }
      
      if (index >= this.middleware.length) {
        return;
      }
      
      const middleware = this.middleware[index++];
      
      if (middleware) {
        try {
          const result = middleware(req, res, next);
          if (result instanceof Promise) {
            result.catch(next);
          }
        } catch (err) {
          next(err as Error);
        }
      }
    };
    
    return new Promise((resolve, reject) => {
      const originalNext = next;
      const wrappedNext = (error?: Error) => {
        if (error) {
          reject(error);
        } else if (index >= this.middleware.length) {
          resolve();
        } else {
          originalNext();
        }
      };
      
      wrappedNext();
    });
  }
  
  /**
   * 执行路由处理器
   */
  private async executeRoute(
    req: RequestContext,
    res: ResponseContext
  ): Promise<void> {
    const routes = this.routes.get(req.method) || [];
    const route = this.findMatchingRoute(routes, req.url);
    
    if (!route) {
      res.statusCode = 404;
      res.body = { error: 'Not Found', message: `Route ${req.method} ${req.url} not found` };
      return;
    }
    
    // 提取路径参数
    this.extractPathParams(route.path, req.url, req);
    
    // 执行路由中间件
    if (route.middleware) {
      await this.executeRouteMiddleware(route.middleware, req, res);
    }
    
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
  private extractPathParams(
    routePath: string,
    requestPath: string,
    req: RequestContext
  ): void {
    // TODO: 实现路径参数提取
    // 目前只支持精确匹配，不需要参数提取
  }
  
  /**
   * 执行路由中间件
   */
  private async executeRouteMiddleware(
    middleware: MiddlewareFunction[],
    req: RequestContext,
    res: ResponseContext
  ): Promise<void> {
    let index = 0;
    
    const next = (error?: Error): void => {
      if (error) {
        throw error;
      }
      
      if (index >= middleware.length) {
        return;
      }
      
      const mw = middleware[index++];
      
      if (mw) {
        try {
          const result = mw(req, res, next);
          if (result instanceof Promise) {
            result.catch(next);
          }
        } catch (err) {
          next(err as Error);
        }
      }
    };
    
    return new Promise((resolve, reject) => {
      const originalNext = next;
      const wrappedNext = (error?: Error) => {
        if (error) {
          reject(error);
        } else if (index >= middleware.length) {
          resolve();
        } else {
          originalNext();
        }
      };
      
      wrappedNext();
    });
  }
  
  /**
   * 发送响应
   */
  private sendResponse(res: http.ServerResponse, context: ResponseContext): void {
    if (context.sent) {
      return;
    }
    
    context.sent = true;
    
    // 设置响应头
    for (const [key, value] of Object.entries(context.headers)) {
      res.setHeader(key, value);
    }
    
    res.statusCode = context.statusCode;
    
    // 发送响应体
    if (context.body !== undefined) {
      if (typeof context.body === 'object') {
        res.end(JSON.stringify(context.body, null, 2));
      } else {
        res.end(String(context.body));
      }
    } else {
      res.end();
    }
    
    if (this.config.debug) {
      const duration = Date.now() - context.req.startTime.getTime();
      console.log(`📤 ${context.statusCode} ${context.req.method} ${context.req.url} [${context.req.id}] ${duration}ms`);
    }
  }
  
  /**
   * 处理错误
   */
  private handleError(
    error: unknown,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const statusCode = 500;
    
    console.error(`❌ Server Error: ${message}`);
    if (error instanceof Error && this.config.debug) {
      console.error(error.stack);
    }
    
    if (!res.headersSent) {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: this.config.debug ? message : 'An unexpected error occurred'
      }, null, 2));
    }
    
    this.emit('error', error);
  }
  
  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      responseTime: Date.now() - start
    });
    
    // 内存检查
    const memStart = Date.now();
    const memUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB
    checks.push({
      name: 'Memory Usage',
      status: memUsage.heapUsed < maxMemory ? 'pass' : 'warn',
      responseTime: Date.now() - memStart
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
      checks: health
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
      author: 'Jason Zhang'
    };
  }
}