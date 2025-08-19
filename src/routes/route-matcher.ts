/**
 * 路由匹配器
 *
 * @author Jason Zhang
 */

export class RouteMatcher {
  static match(path: string, pattern: string): boolean {
    return path === pattern;
  }
}
