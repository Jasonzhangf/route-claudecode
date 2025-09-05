/**
 * RCC v4.0 Router模块导出
 *
 * 严格遵循零接口暴露设计原则
 * 只导出RouterPreprocessor门面和必要类型
 *
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */
export { RouterPreprocessor } from './router-preprocessor';
export type { PipelineConfig, PipelineLayer, RouterPreprocessResult } from './router-preprocessor';
export declare const ROUTER_MODULE_VERSION = "4.1.0-zero-interface";
import { ModuleType } from '../interfaces/module/base-module';
export declare function getRouterModuleInfo(): {
    name: string;
    version: string;
    type: ModuleType;
};
//# sourceMappingURL=index.d.ts.map