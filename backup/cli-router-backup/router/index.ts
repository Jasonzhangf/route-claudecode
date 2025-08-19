/**
 * 路由器模块入口文件
 * 
 * @author Jason Zhang
 */

export * from './config';
export * from './routing';
export * from './flow-control';
export * from './load-balancing';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface RouterModuleInterface {
  version: string;
  initialize(): Promise<void>;
  routeRequest(request: any): Promise<any>;
}