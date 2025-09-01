/**
 * 流水线路由 - 增强版API支持
 *
 * @author Jason Zhang
 * @updated RCC v4.0 API Refactoring
 */

import { configureModuleManagementRoutes } from './module-management-routes';

// 存储处理器实例
let pipelineProcessor: any | null = null;

/**
 * 设置流水线处理器实例
 */
export function setPipelineProcessor(processor: any): void {
  pipelineProcessor = processor;
}

/**
 * 创建流水线路由
 */
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
        health: '/api/v1/pipeline/health',
        modules: '/api/v1/modules'
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
export function configurePipelineRoutes(router: any, middlewareManager: any): void {
  // 保持向后兼容的基础路由
  const basicRoutes = createPipelineRoutes();
  Object.entries(basicRoutes).forEach(([path, handler]) => {
    router.get(path, handler as any);
  });

  // API路由处理器
  const handleAPIRequest = async (req: any, res: any, handler: Function) => {
    try {
      const result = await handler(req.body);
      res.json({
        success: true,
        data: result,
        metadata: {
          timestamp: Date.now(),
          processingTime: 0 // 实际实现中应该计算处理时间
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error)
        },
        metadata: {
          timestamp: Date.now()
        }
      });
    }
  };

  // Router层处理端点
  router.post('/api/v1/pipeline/router/process', async (req: any, res: any) => {
    if (!pipelineProcessor) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Pipeline processor not configured'
        }
      });
    }

    try {
      const result = await pipelineProcessor.processRouterLayer(req.body.input, req.body.context);
      res.json({
        success: true,
        data: {
          output: result,
          context: req.body.context
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTING_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // Transformer层处理端点
  router.post('/api/v1/pipeline/transformer/process', async (req: any, res: any) => {
    if (!pipelineProcessor) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Pipeline processor not configured'
        }
      });
    }

    try {
      const result = await pipelineProcessor.processTransformerLayer(
        req.body.input, 
        req.body.routingDecision, 
        req.body.context
      );
      res.json({
        success: true,
        data: {
          output: result,
          context: req.body.context
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'TRANSFORMATION_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // Protocol层处理端点
  router.post('/api/v1/pipeline/protocol/process', async (req: any, res: any) => {
    if (!pipelineProcessor) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Pipeline processor not configured'
        }
      });
    }

    try {
      const result = await pipelineProcessor.processProtocolLayer(
        req.body.request, 
        req.body.routingDecision, 
        req.body.context
      );
      res.json({
        success: true,
        data: {
          output: result,
          context: req.body.context
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'PROTOCOL_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // Server层处理端点
  router.post('/api/v1/pipeline/server/process', async (req: any, res: any) => {
    if (!pipelineProcessor) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Pipeline processor not configured'
        }
      });
    }

    try {
      const result = await pipelineProcessor.processServerLayer(
        req.body.request, 
        req.body.routingDecision, 
        req.body.context
      );
      res.json({
        success: true,
        data: {
          output: result,
          context: req.body.context
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 健康检查端点
  router.get('/api/v1/pipeline/health', (req: any, res: any) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  });

  // 状态检查端点
  router.get('/api/v1/pipeline/status', (req: any, res: any) => {
    res.json({
      success: true,
      data: {
        status: 'running',
        timestamp: new Date().toISOString(),
        processor: pipelineProcessor ? 'configured' : 'not configured'
      }
    });
  });

  // 配置模块管理路由
  configureModuleManagementRoutes(router);
}