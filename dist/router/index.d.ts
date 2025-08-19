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
export { PipelineRouter } from './pipeline-router';
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';
export { ConfigLoader } from './config-loader';
export type { LoadBalancingStats, PipelineWeight, LoadBalancingStrategy, LoadBalancerConfig } from './load-balancer';
export type { RoutingTable, PipelineRoute } from '../interfaces/router/request-router';
export declare const ROUTER_MODULE_VERSION = "4.0.0-beta.1";
export interface RouterModuleInterface {
    version: string;
    initialize(): Promise<void>;
    routeRequest(request: any): Promise<any>;
}
/**
 * RCC v4.0 Router模块工厂
 */
export declare class RouterModuleFactory {
    /**
     * 创建完整的路由系统
     */
    static createRoutingSystem(pipelineManager: any, routingTable: any, config?: any): {
        pipelineRouter: PipelineRouter;
        loadBalancer: LoadBalancer;
    };
}
//# sourceMappingURL=index.d.ts.map