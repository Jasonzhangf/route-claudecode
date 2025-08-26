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
export * from '../interfaces/core/router-interface';
export { PipelineRouter } from './pipeline-router';
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';
export { SimpleRouter } from './simple-router';
export { VirtualModelMappingRule, VirtualModelType } from './virtual-model-mapping';
export * from './session-control';
import { PipelineRouter } from './pipeline-router';
import { LoadBalancer } from './load-balancer';
export type { RouterModuleInterface, RouterModuleConfig, RouterModuleMetrics, RCCRequest, RCCResponse, PipelineWorker, RoutingTable, PipelineRoute, LoadBalancingStats, HealthStatus, SessionInfo } from '../interfaces/core/router-interface';
export type { LoadBalancingStats as LegacyLoadBalancingStats, PipelineWeight, LoadBalancingStrategy, LoadBalancerConfig } from './load-balancer';
export declare const ROUTER_MODULE_VERSION = "4.0.0-beta.1";
/**
 * RCC v4.0 Router模块工厂
 */
export declare class RouterModuleFactory {
    /**
     * 创建完整的路由系统
     */
    static createRoutingSystem(pipelineManager: any, routingTable: any, config?: any, pipelineTableManager?: any): {
        pipelineRouter: PipelineRouter;
        loadBalancer: LoadBalancer;
    };
}
//# sourceMappingURL=index.d.ts.map