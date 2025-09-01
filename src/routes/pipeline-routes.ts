/**
 * 流水线路由 - 增强版API支持
 *
 * @author Jason Zhang
 * @updated RCC v4.0 API Refactoring
 */

import { Router } from './router';
import { IMiddlewareManager } from '../interfaces/core/middleware-interface';

export function createPipelineRoutes() {
  return {
    '/pipeline': (req: any, res: any) => res.json({ 
      message: 'Pipeline API available',
      version: '4.0.0',
      endpoints: {
        router: '/api/v1/pipeline/router/process',
        transformer: '/api/v1/pipeline/transformer/process',
        protocol: '/api/v1/pipeline/protocol/process',
        server: '/api/v1/pipeline/server/process',
        status: '/api/v1/pipeline/status',
        health: '/api/v1/pipeline/health'
      }
    }),
  };
}

/**
 * 配置增强的Pipeline路由
 * 
 * @param router 路由器实例
 * @param middlewareManager 中间件管理器
 */
export function configurePipelineRoutes(router: Router, middlewareManager: IMiddlewareManager): void {
  // 保持向后兼容的基础路由
  const basicRoutes = createPipelineRoutes();
  Object.entries(basicRoutes).forEach(([path, handler]) => {
    router.get(path, handler as any);
  });
}
