/**
 * 路由管理器
 *
 * @author Jason Zhang
 */

export class RouteManager {
  private routes: Map<string, any> = new Map();

  register(path: string, handler: any): void {
    this.routes.set(path, handler);
  }

  unregister(path: string): void {
    this.routes.delete(path);
  }

  getHandler(path: string): any {
    return this.routes.get(path);
  }
}
