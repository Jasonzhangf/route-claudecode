"use strict";
/**
 * 工具模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出必要的工具函数
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UTILS_MODULE_VERSION = exports.DataValidator = exports.secureLogger = void 0;
exports.getUtilsModuleInfo = getUtilsModuleInfo;
// 主要工具函数 - 精简导出
var secure_logger_1 = require("./secure-logger");
Object.defineProperty(exports, "secureLogger", { enumerable: true, get: function () { return secure_logger_1.secureLogger; } });
var data_validator_1 = require("./data-validator");
Object.defineProperty(exports, "DataValidator", { enumerable: true, get: function () { return data_validator_1.DataValidator; } });
// 模块版本信息
exports.UTILS_MODULE_VERSION = '4.0.0-zero-interface';
// 内部模块适配器 - 不暴露实现细节
const base_module_1 = require("../interfaces/module/base-module");
// 私有模块适配器工厂函数
function createUtilsModuleAdapter() {
    return new base_module_1.SimpleModuleAdapter('utils-module', 'Utils Module', base_module_1.ModuleType.UTILITY, exports.UTILS_MODULE_VERSION);
}
// 只导出获取模块信息的函数，而不是实例
function getUtilsModuleInfo() {
    return {
        name: 'utils-module',
        version: exports.UTILS_MODULE_VERSION,
        type: base_module_1.ModuleType.UTILITY
    };
}
//# sourceMappingURL=index.js.map