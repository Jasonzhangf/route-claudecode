/**
 * HTTP路由系统
 * 
 * 负责路由注册、匹配和执行
 * 
 * @author RCC v4.0
 */

import { 
  Route, 
  RouteHandler, 
  HTTPRoutingSystem,
  RequestContext, 
  ResponseContext 
} from './http-types';

/**
 * HTTP路由系统实现
 */
export class HTTPRoutingSystemImpl implements HTTPRoutingSystem {
  private routes: Map<string, Route[]> = new Map();

  /**
   * 添加路由
   */
  addRoute(method: string, path: string, handler: RouteHandler): void {
    const route: Route = { method, path, handler };

    if (!this.routes.has(method)) {
      this.routes.set(method, []);
    }

    this.routes.get(method)!.push(route);
  }

  /**
   * 执行路由处理器
   */
  async executeRoute(req: RequestContext, res: ResponseContext): Promise<void> {
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
    // 基本实现：先查找精确匹配，后续可以扩展支持路径参数
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

    // 基本实现：精确匹配
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
   * 获取路由统计信息
   */
  getRouteStats(): {
    totalRoutes: number;
    routesByMethod: Record<string, number>;
  } {
    const routesByMethod: Record<string, number> = {};
    let totalRoutes = 0;

    for (const [method, methodRoutes] of this.routes.entries()) {
      routesByMethod[method] = methodRoutes.length;
      totalRoutes += methodRoutes.length;
    }

    return {
      totalRoutes,
      routesByMethod
    };
  }

  /**
   * 清除所有路由
   */
  clearRoutes(): void {
    this.routes.clear();
  }

  /**
   * 获取所有路由
   */
  getAllRoutes(): Route[] {
    const allRoutes: Route[] = [];
    for (const routes of this.routes.values()) {
      allRoutes.push(...routes);
    }
    return allRoutes;
  }
}