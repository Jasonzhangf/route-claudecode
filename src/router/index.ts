/**
 * RCC v4.0 Router模块导出
 * 
 * 基于新的标准化接口架构:
 * - RouterModuleInterface: 标准路由器接口
 * - PipelineRouter: 流水线选择路由器
 * - LoadBalancer: APIKey级负载均衡器
 * - 统一的配置和错误处理
 * 
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
 */

// 标准接口导出
export * from '../interfaces/core/router-interface';

// RCC v4.0 核心组件
export { PipelineRouter } from './pipeline-router';
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';
export { SimpleRouter } from './simple-router';
export { VirtualModelMappingRule, VirtualModelType } from './virtual-model-mapping';

// 会话控制组件
export * from './session-control';

// 导入用于类型注解
import { PipelineRouter } from './pipeline-router';
import { LoadBalancer } from './load-balancer';
import { 
  RouterModuleInterface, 
  RouterModuleConfig,
  RouterModuleMetrics,
  BaseRouterModule
} from '../interfaces/core/router-interface';

// 重新导出标准接口类型
export type {
  RouterModuleInterface,
  RouterModuleConfig,
  RouterModuleMetrics,
  RCCRequest,
  RCCResponse,
  PipelineWorker,
  RoutingTable,
  PipelineRoute,
  LoadBalancingStats,
  HealthStatus,
  SessionInfo
} from '../interfaces/core/router-interface';

// Legacy类型兼容（废弃）
export type {
  LoadBalancingStats as LegacyLoadBalancingStats,
  PipelineWeight,
  LoadBalancingStrategy,
  LoadBalancerConfig
} from './load-balancer';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.0.0-beta.1';

/**
 * RCC v4.0 Router模块工厂
 */
export class RouterModuleFactory {
  /**
   * 创建完整的路由系统
   */
  static createRoutingSystem(
    pipelineManager: any,
    routingTable: any,
    config?: any,
    pipelineTableManager?: any
  ): {
    pipelineRouter: PipelineRouter;
    loadBalancer: LoadBalancer;
  } {
    const pipelineRouter = new PipelineRouter(routingTable);
    const loadBalancer = new LoadBalancer(pipelineManager, config, pipelineTableManager);
    
    return {
      pipelineRouter,
      loadBalancer
    };
  }
}
