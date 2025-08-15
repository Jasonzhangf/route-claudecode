/**
 * 高级路由管理器
 * 
 * 支持路径参数、中间件组合、路由组等高级功能
 * 
 * @author Jason Zhang
 */

import { HTTPServer, RouteHandler, MiddlewareFunction } from '../server/http-server';

/**
 * 路由参数类型
 */
export type RouteParams = Record<string, string>;

/**
 * 增强的路由处理器
 */
export type EnhancedRouteHandler = (
  req: any,
  res: any,
  params: RouteParams
) => void | Promise<void>;

/**
 * 路由定义接口
 */
export interface RouteDefinition {
  method: string;
  path: string;
  handler: EnhancedRouteHandler;
  middleware?: MiddlewareFunction[];
  name?: string;
  description?: string;
}

/**
 * 路由组配置
 */
export interface RouteGroup {
  prefix: string;
  middleware?: MiddlewareFunction[];
  routes: RouteDefinition[];
}

/**
 * 路径匹配结果
 */
interface PathMatch {
  matched: boolean;
  params: RouteParams;
}

/**
 * 高级路由管理器
 */
export class Router {
  private routes: RouteDefinition[] = [];
  private server: HTTPServer;
  
  constructor(server: HTTPServer) {
    this.server = server;
  }
  
  /**
   * 添加GET路由
   */
  get(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    this.addRoute('GET', path, handler, middleware);
  }
  
  /**
   * 添加POST路由
   */
  post(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    this.addRoute('POST', path, handler, middleware);
  }
  
  /**
   * 添加PUT路由
   */
  put(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    this.addRoute('PUT', path, handler, middleware);
  }
  
  /**
   * 添加DELETE路由
   */
  delete(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    this.addRoute('DELETE', path, handler, middleware);
  }
  
  /**
   * 添加PATCH路由
   */
  patch(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    this.addRoute('PATCH', path, handler, middleware);
  }
  
  /**
   * 添加所有HTTP方法的路由
   */
  all(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    methods.forEach(method => {
      this.addRoute(method, path, handler, middleware);
    });
  }
  
  /**
   * 添加路由
   */
  addRoute(
    method: string,
    path: string,
    handler: EnhancedRouteHandler,
    middleware?: MiddlewareFunction[]
  ): void {
    const route: RouteDefinition = {
      method: method.toUpperCase(),
      path: this.normalizePath(path),
      handler,
      middleware
    };
    
    this.routes.push(route);
    
    // 在HTTP服务器上注册路由
    this.server.addRoute(
      route.method,
      route.path,
      this.createRouteHandler(route),
      middleware
    );
  }
  
  /**
   * 添加路由组
   */
  group(groupConfig: RouteGroup): void {
    groupConfig.routes.forEach(route => {
      const fullPath = this.joinPaths(groupConfig.prefix, route.path);
      const combinedMiddleware = [
        ...(groupConfig.middleware || []),
        ...(route.middleware || [])
      ];
      
      this.addRoute(
        route.method,
        fullPath,
        route.handler,
        combinedMiddleware
      );
    });
  }
  
  /**
   * 创建路由处理器包装器
   */
  private createRouteHandler(route: RouteDefinition): RouteHandler {
    return async (req, res) => {
      // 解析路径参数
      const url = req.url || '/';
      const path = url.split('?')[0] || '/';
      const pathMatch = this.matchPath(route.path, path);
      
      if (!pathMatch.matched) {
        res.statusCode = 404;
        res.body = { error: 'Not Found' };
        return;
      }
      
      // 调用增强的路由处理器
      await route.handler(req, res, pathMatch.params);
    };
  }
  
  /**
   * 标准化路径
   */
  private normalizePath(path: string): string {
    // 确保路径以/开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // 移除尾部的/（除非是根路径）
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    return path;
  }
  
  /**
   * 连接路径
   */
  private joinPaths(prefix: string, path: string): string {
    const normalizedPrefix = this.normalizePath(prefix);
    const normalizedPath = this.normalizePath(path);
    
    if (normalizedPath === '/') {
      return normalizedPrefix;
    }
    
    return normalizedPrefix + normalizedPath;
  }
  
  /**
   * 匹配路径并提取参数
   */
  private matchPath(routePath: string, requestPath: string): PathMatch {
    const routeSegments = routePath.split('/').filter(Boolean);
    const requestSegments = requestPath.split('/').filter(Boolean);
    
    // 检查段数是否匹配
    if (routeSegments.length !== requestSegments.length) {
      return { matched: false, params: {} };
    }
    
    const params: RouteParams = {};
    
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const requestSegment = requestSegments[i];
      
      if (!routeSegment || !requestSegment) {
        return { matched: false, params: {} };
      }
      
      if (routeSegment.startsWith(':')) {
        // 参数段
        const paramName = routeSegment.slice(1);
        params[paramName] = decodeURIComponent(requestSegment);
      } else if (routeSegment !== requestSegment) {
        // 静态段不匹配
        return { matched: false, params: {} };
      }
    }
    
    return { matched: true, params };
  }
  
  /**
   * 获取所有路由信息
   */
  getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }
  
  /**
   * 根据名称查找路由
   */
  findRoute(name: string): RouteDefinition | undefined {
    return this.routes.find(route => route.name === name);
  }
  
  /**
   * 生成路由URL
   */
  generateUrl(routeName: string, params: RouteParams = {}): string {
    const route = this.findRoute(routeName);
    if (!route) {
      throw new Error(`Route '${routeName}' not found`);
    }
    
    let url = route.path;
    
    // 替换路径参数
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    }
    
    return url;
  }
  
  /**
   * 打印路由表
   */
  printRoutes(): void {
    console.log('\\n📋 Registered Routes:');
    console.log('════════════════════════════════════════');
    
    this.routes.forEach(route => {
      const middlewareInfo = route.middleware ? ` (${route.middleware.length} middleware)` : '';
      console.log(`${route.method.padEnd(7)} ${route.path}${middlewareInfo}`);
      
      if (route.description) {
        console.log(`        ${route.description}`);
      }
    });
    
    console.log('════════════════════════════════════════\\n');
  }
}