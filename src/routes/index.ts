/**
 * 路由模块入口文件
 *
 * @author Jason Zhang
 */

export * from './route-manager';
export * from './health-routes';
export * from './debug-routes';
export * from './admin-routes';
export * from './pipeline-routes';
export * from './provider-routes';
export * from './config-routes';
export * from './metrics-routes';
export * from './auth-routes';
export * from './proxy-routes';
export * from './webhook-routes';
export * from './param-validator';
export * from './route-matcher';

// 模块版本信息
export const ROUTES_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface RoutesModuleInterface {
  version: string;
  addRoute(route: any): void;
  matchRoute(url: string, method: string): any;
}
