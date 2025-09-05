"use strict";
/**
 * 中间件模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出MiddlewareFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIDDLEWARE_MODULE_VERSION = exports.MiddlewareFactory = void 0;
exports.getMiddlewareModuleInfo = getMiddlewareModuleInfo;
// 主要门面接口 - 零接口暴露设计
var middleware_factory_1 = require("./middleware-factory");
Object.defineProperty(exports, "MiddlewareFactory", { enumerable: true, get: function () { return middleware_factory_1.MiddlewareFactory; } });
// 模块版本信息
exports.MIDDLEWARE_MODULE_VERSION = '4.0.0-zero-interface';
// 内部模块适配器 - 不暴露实现细节
const base_module_1 = require("../interfaces/module/base-module");
// 私有模块适配器工厂函数
function createMiddlewareModuleAdapter() {
    return new base_module_1.SimpleModuleAdapter('middleware-module', 'Middleware Module', base_module_1.ModuleType.MIDDLEWARE, exports.MIDDLEWARE_MODULE_VERSION);
}
// 只导出获取模块信息的函数，而不是实例
function getMiddlewareModuleInfo() {
    return {
        name: 'middleware-module',
        version: exports.MIDDLEWARE_MODULE_VERSION,
        type: base_module_1.ModuleType.MIDDLEWARE
    };
}
//# sourceMappingURL=index.js.map