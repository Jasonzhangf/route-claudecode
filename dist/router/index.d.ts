/**
 * RCC v4.0 Router模块导出
 *
 * 重构后的路由器模块 - 零接口暴露设计
 * 只导出RouterPreprocessor和必要的类型定义
 *
 * @version 4.1.0-preprocessor
 * @author Claude - Refactored
 */
export { RouterPreprocessor } from './router-preprocessor';
export type { PipelineConfig, PipelineLayer, RouterPreprocessResult } from './router-preprocessor';
export { PipelineRouter } from './pipeline-router';
export type { PipelineRoute, PipelineRoutingDecision } from './pipeline-router';
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';
export declare const ROUTER_MODULE_VERSION = "4.1.0-preprocessor";
//# sourceMappingURL=index.d.ts.map