/**
 * DEPRECATED: This router module has been replaced by src/modules/routing/
 *
 * ❌ DO NOT USE: This router module is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * @deprecated Use CoreRouter from src/modules/routing/ instead
 * @see src/modules/routing/core-router.ts
 */

// DEPRECATED: Use new routing module
// export * from './config';
// export * from './routing';
// export { FlowController } from './flow-control';
// export { LoadBalancer } from './load-balancing';

// Re-export the new CoreRouter for compatibility
export { CoreRouter } from '../modules/routing';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface RouterModuleInterface {
  version: string;
  initialize(): Promise<void>;
  routeRequest(request: any): Promise<any>;
}
