/**
 * Router Module Entry Point
 * 
 * @author RCC v4.0 Architecture
 */

export { RouterPreprocessor } from './router-preprocessor';
export type { 
  PipelineConfig, 
  PipelineLayer, 
  RouterPreprocessResult 
} from './router-preprocessor';
export type { 
  RoutingTable, 
  ProviderInfo, 
  RouteMapping,
  ModelInfo,
  ServerInfo
} from './routing-table-types';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.1.0';
