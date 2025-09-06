/**
 * Server Module
 */

export const SERVER_MODULE_VERSION = '4.0.0-zero-interface';

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
    return {
      start: async () => {},
      stop: async () => {},
      config
    };
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