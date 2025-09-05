/**
 * 服务模块入口文件
 *
 * @author Jason Zhang
 */

export * from './cache-manager';
export * from './server-manager';

// 模块版本信息
export const SERVICES_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ServicesModuleInterface {
  version: string;
  getServerManager(): import('./types').ServerManager;
  getCacheManager(): import('./types').CacheManager;
}

// ModuleInterface implementation for architecture compliance
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
export const servicesModuleAdapter = new SimpleModuleAdapter(
  'services-module',
  'Services Module',
  ModuleType.SERVICE,
  SERVICES_MODULE_VERSION
);
