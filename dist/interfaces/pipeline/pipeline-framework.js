"use strict";
/**
 * 流水线框架接口定义
 *
 * 定义11模块流水线的标准框架接口
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineFrameworkModuleAdapter = exports.ModuleType = void 0;
/**
 * 导入base-module中的类型定义
 */
const base_module_1 = require("../module/base-module");
Object.defineProperty(exports, "ModuleType", { enumerable: true, get: function () { return base_module_1.ModuleType; } });
// ModuleInterface implementation for architecture compliance
const base_module_2 = require("../module/base-module");
exports.pipelineFrameworkModuleAdapter = new base_module_2.SimpleModuleAdapter('pipeline-framework-module', 'Pipeline Framework Interfaces', base_module_1.ModuleType.PIPELINE, '4.0.0-alpha.1');
//# sourceMappingURL=pipeline-framework.js.map