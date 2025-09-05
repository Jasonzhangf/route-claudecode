/**
 * 工具模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出必要的工具函数
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
export { secureLogger } from './secure-logger';
export { DataValidator } from './data-validator';
export type { LogLevel, LogEntry } from './secure-logger';
export type { ValidationResult, ValidationRule } from './data-validator';
export declare const UTILS_MODULE_VERSION = "4.0.0-zero-interface";
import { ModuleType } from '../interfaces/module/base-module';
export declare function getUtilsModuleInfo(): {
    name: string;
    version: string;
    type: ModuleType;
};
//# sourceMappingURL=index.d.ts.map