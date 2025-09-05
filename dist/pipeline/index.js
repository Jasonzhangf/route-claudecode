"use strict";
/**
 * 流水线模块导出文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出PipelineManager门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author RCC v4.0 Architecture Team - Zero Interface Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_MODULE_VERSION = exports.PipelineManager = void 0;
exports.getPipelineModuleInfo = getPipelineModuleInfo;
// 主要门面接口 - 零接口暴露设计
var pipeline_manager_1 = require("./pipeline-manager");
Object.defineProperty(exports, "PipelineManager", { enumerable: true, get: function () { return pipeline_manager_1.PipelineManager; } });
// 模块版本信息
exports.PIPELINE_MODULE_VERSION = '4.0.0-zero-interface';
// 内部模块适配器 - 不暴露实现细节
const base_module_1 = require("../interfaces/module/base-module");
// 私有模块适配器工厂函数
function createPipelineModuleAdapter() {
    return new base_module_1.SimpleModuleAdapter('pipeline-module', 'Pipeline Module', base_module_1.ModuleType.PIPELINE, exports.PIPELINE_MODULE_VERSION);
}
// 只导出获取模块信息的函数，而不是实例
function getPipelineModuleInfo() {
    return {
        name: 'pipeline-module',
        version: exports.PIPELINE_MODULE_VERSION,
        type: base_module_1.ModuleType.PIPELINE
    };
}
//# sourceMappingURL=index.js.map