/**
 * 全局服务注册表
 *
 * 提供系统级服务的单例访问，用于API路由、CLI命令等
 *
 * @author Jason Zhang
 */

import { ProviderManager } from '../modules/providers/provider-manager';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { ConfigReader, MergedConfig } from '../config/config-reader';

/**
 * 全局服务实例
 */
interface GlobalServices {
  providerManager: ProviderManager | null;
  pipelineManager: PipelineManager | null;
  configManager: IConfigManager | null;
  serverManager: IServerManager | null;
  cacheManager: ICacheManager | null;
}

/**
 * 服务器管理器接口
 */
export interface IServerManager {
  restart(): Promise<{ restartId: string; estimatedDowntime: string }>;
  getStatus(): { status: string; uptime: number; version: string };
  shutdown(): Promise<void>;
}

/**
 * 缓存管理器接口
 */
export interface ICacheManager {
  clearAll(): Promise<{ itemsCleared: number; cacheTypes: string[] }>;
  clear(cacheType: string): Promise<{ itemsCleared: number }>;
  getStats(): { totalItems: number; memoryUsage: number; cacheTypes: string[] };
}

/**
 * 配置管理器扩展接口
 */
export interface IConfigManager {
  getCurrentConfig(): Promise<any>;
  validateConfig(config: any): Promise<{ valid: boolean; errors: string[] }>;
  updateConfig(config: any): Promise<void>;
  exportConfig(): Promise<any>;
}

/**
 * 全局服务注册表接口
 */
export interface GlobalServiceRegistry {
  services: Record<string, boolean>;
  healthy: boolean;
}

// 全局服务实例存储
const globalServices: GlobalServices = {
  providerManager: null,
  pipelineManager: null,
  configManager: null,
  serverManager: null,
  cacheManager: null,
};

/**
 * 注册Provider管理器
 */
export function registerProviderManager(manager: ProviderManager): void {
  globalServices.providerManager = manager;
}

/**
 * 获取Provider管理器
 */
export function getGlobalProviderManager(): ProviderManager | null {
  return globalServices.providerManager;
}

/**
 * 注册Pipeline管理器
 */
export function registerPipelineManager(manager: PipelineManager): void {
  globalServices.pipelineManager = manager;
}

/**
 * 获取Pipeline管理器
 */
export function getGlobalPipelineManager(): PipelineManager | null {
  return globalServices.pipelineManager;
}

/**
 * 注册配置管理器
 */
export function registerConfigManager(manager: IConfigManager): void {
  globalServices.configManager = manager;
}

/**
 * 获取配置管理器
 */
export function getGlobalConfigManager(): IConfigManager | null {
  return globalServices.configManager;
}

/**
 * 注册服务器管理器
 */
export function registerServerManager(manager: IServerManager): void {
  globalServices.serverManager = manager;
}

/**
 * 获取服务器管理器
 */
export function getGlobalServerManager(): IServerManager | null {
  return globalServices.serverManager;
}

/**
 * 注册缓存管理器
 */
export function registerCacheManager(manager: ICacheManager): void {
  globalServices.cacheManager = manager;
}

/**
 * 获取缓存管理器
 */
export function getGlobalCacheManager(): ICacheManager | null {
  return globalServices.cacheManager;
}

/**
 * 清理所有服务（用于测试和shutdown）
 */
export function clearAllServices(): void {
  globalServices.providerManager = null;
  globalServices.pipelineManager = null;
  globalServices.configManager = null;
  globalServices.serverManager = null;
  globalServices.cacheManager = null;
}

/**
 * 获取所有服务状态
 */
export function getServiceRegistry(): GlobalServiceRegistry {
  const services = {
    providerManager: globalServices.providerManager !== null,
    pipelineManager: globalServices.pipelineManager !== null,
    configManager: globalServices.configManager !== null,
    serverManager: globalServices.serverManager !== null,
    cacheManager: globalServices.cacheManager !== null,
  };

  const healthy = Object.values(services).every(Boolean);

  return { services, healthy };
}

/**
 * 验证必要服务是否已注册
 */
export function validateRequiredServices(): { valid: boolean; missing: string[] } {
  const required = ['providerManager', 'pipelineManager', 'configManager'];
  const missing: string[] = [];

  for (const service of required) {
    if (globalServices[service as keyof GlobalServices] === null) {
      missing.push(service);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
