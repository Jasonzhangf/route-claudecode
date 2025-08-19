/**
 * 服务模块入口文件
 *
 * @author Jason Zhang
 */

export * from './cache-manager';
export * from './global-service-registry';
export * from './server-manager';
export * from './service-initializer';

// 模块版本信息
export const SERVICES_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ServicesModuleInterface {
  version: string;
  initializeServices(): Promise<void>;
  getServerManager(): import('./types').ServerManager;
  getCacheManager(): import('./types').CacheManager;
  getServiceRegistry(): import('./types').GlobalServiceRegistry;
}
