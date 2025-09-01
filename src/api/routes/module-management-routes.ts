/**
 * 模块管理API路由
 * 
 * 提供模块实例管理的REST API端点
 * 
 * @author RCC v4.0 Phase 3 API Implementation
 */

import { 
  createModule, 
  startModule, 
  stopModule, 
  configureModule, 
  processWithModule, 
  getModuleStatus, 
  destroyModule,
  getAllModulesStatus
} from '../modules/module-management-api';

/**
 * 配置模块管理API路由
 * 
 * @param router 路由器实例
 */
export function configureModuleManagementRoutes(router: any): void {
  // 创建模块实例
  router.post('/api/v1/modules/:type/create', async (req: any, res: any) => {
    try {
      const request = {
        type: req.params.type as any,
        moduleType: req.body.moduleType,
        config: req.body.config
      };
      
      const result = await createModule(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_CREATION_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 启动模块实例
  router.post('/api/v1/modules/:type/:id/start', async (req: any, res: any) => {
    try {
      const request = {
        id: req.params.id
      };
      
      const result = await startModule(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_START_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 停止模块实例
  router.post('/api/v1/modules/:type/:id/stop', async (req: any, res: any) => {
    try {
      const request = {
        id: req.params.id
      };
      
      const result = await stopModule(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_STOP_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 配置模块实例
  router.post('/api/v1/modules/:type/:id/configure', async (req: any, res: any) => {
    try {
      const request = {
        id: req.params.id,
        config: req.body.config
      };
      
      const result = await configureModule(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_CONFIGURE_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 处理请求
  router.post('/api/v1/modules/:type/:id/process', async (req: any, res: any) => {
    try {
      const request = {
        id: req.params.id,
        input: req.body.input
      };
      
      const result = await processWithModule(request);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_PROCESS_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 获取模块状态
  router.get('/api/v1/modules/:type/:id/status', async (req: any, res: any) => {
    try {
      const result = await getModuleStatus(req.params.id);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_STATUS_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 销毁模块实例
  router.delete('/api/v1/modules/:type/:id', async (req: any, res: any) => {
    try {
      await destroyModule(req.params.id);
      res.json({
        success: true,
        data: {
          id: req.params.id,
          status: 'destroyed'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULE_DESTROY_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  // 获取所有模块状态
  router.get('/api/v1/modules/status', async (req: any, res: any) => {
    try {
      const result = await getAllModulesStatus();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MODULES_STATUS_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });
}