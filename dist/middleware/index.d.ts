/**
 * 中间件模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出MiddlewareFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
export { MiddlewareFactory } from './middleware-factory';
export type { MiddlewareConfig, MiddlewareOptions } from './middleware-factory';
export declare const MIDDLEWARE_MODULE_VERSION = "4.0.0-zero-interface";
import { ModuleType } from '../interfaces/module/base-module';
export declare function getMiddlewareModuleInfo(): {
    name: string;
    version: string;
    type: ModuleType;
};
//# sourceMappingURL=index.d.ts.map