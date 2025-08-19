/**
 * 状态类型定义
 *
 * @author Jason Zhang
 */

import { ModuleStatus } from '../interfaces/module/base-module';

/**
 * 扩展的模块状态接口
 */
export interface ExtendedModuleStatus extends ModuleStatus {
  uptime?: number;
  lastUpdated?: Date;
  memoryUsage?: number;
  cpuUsage?: number;
}

/**
 * 流水线状态接口
 */
export interface PipelineStatus {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy';
  modules?: ExtendedModuleStatus[];
  uptime?: number;
  performance?: {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  moduleCount?: number;
  protocols?: string[];
  supportedProviders?: string[];
}

/**
 * Provider路由信息
 */
export interface ProviderRouteInfo {
  id: string;
  name: string;
  endpoint: string;
  protocol: string;
  status: 'active' | 'inactive' | 'error';
}
