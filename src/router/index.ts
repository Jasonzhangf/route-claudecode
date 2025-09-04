/**
 * RCC v4.0 Router模块导出
 * 
 * 重构后的路由器模块 - 零接口暴露设计
 * 只导出RouterPreprocessor和必要的类型定义
 * 
 * @version 4.1.0-preprocessor
 * @author Claude - Refactored
 */

// 唯一的路由处理接口
export { RouterPreprocessor } from './router-preprocessor';

// 路由和流水线类型定义
export type {
  PipelineConfig,
  PipelineLayer,
  RouterPreprocessResult
} from './router-preprocessor';

// 保留核心路由器类（用于向后兼容，但内部方法已封装）
export { PipelineRouter } from './pipeline-router';
export type { PipelineRoute, PipelineRoutingDecision } from './pipeline-router';

// 负载均衡器（保留用于系统集成）
export { LoadBalancer, DEFAULT_LOAD_BALANCER_CONFIG } from './load-balancer';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.1.0-preprocessor';
