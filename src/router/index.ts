/**
 * RCC v4.0 Router模块导出
 * 
 * 新架构组件:
 * - PipelineRouter: 流水线选择路由器
 * - LoadBalancer: APIKey级负载均衡器
 * - Config系统: 配置加载和管理
 * 
 * @author RCC v4.0
 */

// RCC v4.0 核心组件
export { PipelineRouter } from './pipeline-router';
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';
export { ConfigLoader } from './config-loader';

// 类型定义
export type {
  LoadBalancingStats,
  PipelineWeight,
  LoadBalancingStrategy,
  LoadBalancerConfig
} from './load-balancer';

export type {
  RoutingTable,
  PipelineRoute
} from '../interfaces/router/request-router';

// 废弃的CoreRouter已删除 - 使用PipelineRouter代替

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.0.0-beta.1';

// 模块接口
export interface RouterModuleInterface {
  version: string;
  initialize(): Promise<void>;
  routeRequest(request: any): Promise<any>;
}

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
    config?: any
  ): {
    pipelineRouter: PipelineRouter;
    loadBalancer: LoadBalancer;
  } {
    const pipelineRouter = new PipelineRouter(routingTable);
    const loadBalancer = new LoadBalancer(pipelineManager, config);
    
    return {
      pipelineRouter,
      loadBalancer
    };
  }
}
