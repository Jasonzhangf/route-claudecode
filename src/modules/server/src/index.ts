/**
 * Server Module
 * 
 * HTTP服务器模块，包含所有相关的组件和接口
 */

export const SERVER_MODULE_VERSION = '4.0.0-zero-interface';

// 导出主要类型和接口
export * from './http-types';

// 导出主要组件类
export { HTTPServer } from './http-server';
export { HTTPContextManager } from './http-context-manager';
export { HTTPRoutingSystemImpl } from './http-routing-system';
export { HTTPRequestHandlersImpl } from './http-handlers';
export { AnthropicMessageHandlerImpl } from './http-anthropic-handler';

// 导出错误处理组件
export { HTTPErrorCenter } from './http-error-center';

// 兼容之前的接口
export interface ServerConfig {
  port: number;
  host: string;
  [key: string]: any;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  [key: string]: any;
}

export class ServerFactory {
  static createServer(config: ServerConfig): any {
    // 创建HTTP服务器实例
    const { HTTPServer } = require('./http-server');
    return new HTTPServer(config, config.configPath);
  }
}

export class HealthChecker {
  async checkHealth(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      timestamp: Date.now()
    };
  }
}

export function createServerModuleAdapter(): any {
  return {
    getId: () => 'server-module',
    getName: () => 'Server Module',
    getType: () => 'server',
    getVersion: () => SERVER_MODULE_VERSION
  };
}

export function getServerModuleInfo() {
  return {
    name: 'server-module',
    version: SERVER_MODULE_VERSION,
    type: 'server'
  };
}