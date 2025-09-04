"use strict";
/**
 * 流水线模块导出文件
 *
 * RCC v4.0 架构重构核心组件
 * 遵循零接口暴露设计原则
 *
 * @author RCC v4.0 Architecture Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_MODULE_VERSION = exports.PipelineModule = exports.PipelineManager = exports.RuntimeScheduler = exports.UnifiedInitializer = void 0;
// 核心组件 - 遵循零接口暴露设计
var unified_initializer_1 = require("./unified-initializer");
Object.defineProperty(exports, "UnifiedInitializer", { enumerable: true, get: function () { return unified_initializer_1.UnifiedInitializer; } });
var runtime_scheduler_1 = require("./runtime-scheduler");
Object.defineProperty(exports, "RuntimeScheduler", { enumerable: true, get: function () { return runtime_scheduler_1.RuntimeScheduler; } });
var pipeline_manager_1 = require("./pipeline-manager");
Object.defineProperty(exports, "PipelineManager", { enumerable: true, get: function () { return pipeline_manager_1.PipelineManager; } });
var pipeline_module_1 = require("./pipeline-module");
Object.defineProperty(exports, "PipelineModule", { enumerable: true, get: function () { return pipeline_module_1.PipelineModule; } });
// 模块版本信息
exports.PIPELINE_MODULE_VERSION = '4.0.0-unified';
//# sourceMappingURL=index.js.map