/**
 * 服务器模块入口文件
 *
 * @author Jason Zhang
 */

export * from './http-server';
export { PipelineServerManager } from '../pipeline/pipeline-server-manager';
export * from './server-factory';
export * from './middleware-manager';
export * from './request-handler';
export * from './response-builder';
export * from './route-manager';
export * from './health-checker';
export * from './security';
export * from './monitoring';

// 模块版本信息
export const SERVER_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ServerModuleInterface {
  version: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
