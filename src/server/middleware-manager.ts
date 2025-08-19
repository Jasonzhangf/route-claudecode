/**
 * 中间件管理器
 *
 * @author Jason Zhang
 */

export class MiddlewareManager {
  createCors(options: any) {
    return (req: any, res: any, next: any) => next();
  }

  createLogger(options: any) {
    return (req: any, res: any, next: any) => next();
  }

  createRateLimit(options: any) {
    return (req: any, res: any, next: any) => next();
  }

  createAuth(options: any) {
    return (req: any, res: any, next: any) => next();
  }
}
