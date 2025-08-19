/**
 * 路由管理器
 *
 * @author Jason Zhang
 */

export class RouteManager {
  private routes: Map<string, any> = new Map();

  addRoute(path: string, handler: any): void {
    this.routes.set(path, handler);
  }

  getRoute(path: string): any {
    return this.routes.get(path);
  }

  getAllRoutes(): Map<string, any> {
    return new Map(this.routes);
  }
}
