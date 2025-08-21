/**
 * 简单路由器实现
 * 
 * 提供基础的路由定义功能
 * 
 * @author RCC v4.0 Team
 */

export interface RouteHandler {
  (req: any, res: any, next?: any): void | Promise<void>;
}

// 兼容中间件类型
export interface IMiddlewareFunction extends RouteHandler {}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  path: string;
  handler: RouteHandler;
  middleware?: RouteHandler[];
  name?: string; // 路由名称，可选
  description?: string; // 路由描述，可选
}

export class Router {
  private routes: RouteDefinition[] = [];

  get(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'GET', path, handler, middleware: middlewareArray });
  }

  post(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'POST', path, handler, middleware: middlewareArray });
  }

  put(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'PUT', path, handler, middleware: middlewareArray });
  }

  delete(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'DELETE', path, handler, middleware: middlewareArray });
  }

  patch(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'PATCH', path, handler, middleware: middlewareArray });
  }

  options(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void {
    const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
    this.routes.push({ method: 'OPTIONS', path, handler, middleware: middlewareArray });
  }

  group(prefixOrGroup: string | RouteGroup, options?: { middleware?: RouteHandler[] }): RouteGroup {
    if (typeof prefixOrGroup === 'string') {
      return new RouteGroupClass(prefixOrGroup, options?.middleware);
    } else {
      // Handle RouteGroup object registration
      const routeGroup = prefixOrGroup;
      if (routeGroup.routes) {
        routeGroup.routes.forEach(route => {
          this.routes.push({
            ...route,
            path: `${routeGroup.prefix || ''}${route.path}`,
            middleware: [...(routeGroup.middleware || []), ...(route.middleware || [])]
          });
        });
      }
      return routeGroup;
    }
  }

  getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }
}

// RouteGroup接口，支持对象字面量和类实例
export interface RouteGroup {
  prefix: string;
  middleware?: RouteHandler[];
  routes?: RouteDefinition[];
}

export class RouteGroupClass implements RouteGroup {
  public prefix: string;
  private router: Router;
  public middleware?: RouteHandler[];
  public routes?: RouteDefinition[];

  constructor(prefix: string, middleware?: RouteHandler[]) {
    this.prefix = prefix;
    this.router = new Router();
    this.middleware = middleware;
    this.routes = [];
  }

  get(path: string, handler: RouteHandler): void {
    this.router.get(`${this.prefix}${path}`, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.router.post(`${this.prefix}${path}`, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.router.put(`${this.prefix}${path}`, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.router.delete(`${this.prefix}${path}`, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.router.patch(`${this.prefix}${path}`, handler);
  }

  options(path: string, handler: RouteHandler): void {
    this.router.options(`${this.prefix}${path}`, handler);
  }

  getRoutes(): RouteDefinition[] {
    return this.router.getRoutes();
  }
}