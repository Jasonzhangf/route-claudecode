"use strict";
/**
 * RCC v4.0 Router模块导出
 *
 * 严格遵循零接口暴露设计原则
 * 只导出RouterPreprocessor门面和必要类型
 *
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTER_MODULE_VERSION = exports.RouterPreprocessor = void 0;
exports.getRouterModuleInfo = getRouterModuleInfo;
// 主要门面接口 - 零接口暴露设计
var router_preprocessor_1 = require("./router-preprocessor");
Object.defineProperty(exports, "RouterPreprocessor", { enumerable: true, get: function () { return router_preprocessor_1.RouterPreprocessor; } });
// 模块版本信息
exports.ROUTER_MODULE_VERSION = '4.1.0-zero-interface';
// 内部模块适配器 - 不暴露实现细节
const base_module_1 = require("../interfaces/module/base-module");
// 私有模块适配器工厂函数
function createRouterModuleAdapter() {
    return new base_module_1.SimpleModuleAdapter('router-module', 'Router Module', base_module_1.ModuleType.ROUTER, exports.ROUTER_MODULE_VERSION);
}
// 只导出获取模块信息的函数，而不是实例
function getRouterModuleInfo() {
    return {
        name: 'router-module',
        version: exports.ROUTER_MODULE_VERSION,
        type: base_module_1.ModuleType.ROUTER
    };
}
//# sourceMappingURL=index.js.map