/**
 * 服务器模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出ServerFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
export { ServerFactory } from './server-factory';
export { HealthChecker } from './health-checker';
export type { ServerConfig } from './http-server';
export type { HealthCheckResult } from './health-checker';
export declare const SERVER_MODULE_VERSION = "4.0.0-zero-interface";
import { ModuleType } from '../interfaces/module/base-module';
export declare function getServerModuleInfo(): {
    name: string;
    version: string;
    type: ModuleType;
};
//# sourceMappingURL=index.d.ts.map