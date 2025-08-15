"use strict";
/**
 * RCC v4.0 流水线模块
 *
 * 处理11模块流水线的动态管理和执行
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistry = exports.StandardPipelineFactoryImpl = exports.StandardPipeline = exports.PipelineManager = exports.PIPELINE_MODULE_VERSION = void 0;
// 版本信息
exports.PIPELINE_MODULE_VERSION = '4.0.0-alpha.1';
// 核心Pipeline组件
var pipeline_manager_1 = require("./pipeline-manager");
Object.defineProperty(exports, "PipelineManager", { enumerable: true, get: function () { return pipeline_manager_1.PipelineManager; } });
var standard_pipeline_1 = require("./standard-pipeline");
Object.defineProperty(exports, "StandardPipeline", { enumerable: true, get: function () { return standard_pipeline_1.StandardPipeline; } });
var pipeline_factory_1 = require("./pipeline-factory");
Object.defineProperty(exports, "StandardPipelineFactoryImpl", { enumerable: true, get: function () { return pipeline_factory_1.StandardPipelineFactoryImpl; } });
var module_registry_1 = require("./module-registry");
Object.defineProperty(exports, "ModuleRegistry", { enumerable: true, get: function () { return module_registry_1.ModuleRegistry; } });
//# sourceMappingURL=index.js.map