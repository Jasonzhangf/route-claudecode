"use strict";
/**
 * 服务器模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出ServerFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_MODULE_VERSION = exports.HealthChecker = exports.ServerFactory = void 0;
exports.getServerModuleInfo = getServerModuleInfo;
// 主要门面接口 - 零接口暴露设计
var server_factory_1 = require("./server-factory");
Object.defineProperty(exports, "ServerFactory", { enumerable: true, get: function () { return server_factory_1.ServerFactory; } });
var health_checker_1 = require("./health-checker");
Object.defineProperty(exports, "HealthChecker", { enumerable: true, get: function () { return health_checker_1.HealthChecker; } });
// 模块版本信息
exports.SERVER_MODULE_VERSION = '4.0.0-zero-interface';
// 内部模块适配器 - 不暴露实现细节
const base_module_1 = require("../interfaces/module/base-module");
// 私有模块适配器工厂函数
function createServerModuleAdapter() {
    return new base_module_1.SimpleModuleAdapter('server-module', 'Server Module', base_module_1.ModuleType.SERVER, exports.SERVER_MODULE_VERSION);
}
// 只导出获取模块信息的函数，而不是实例
function getServerModuleInfo() {
    return {
        name: 'server-module',
        version: exports.SERVER_MODULE_VERSION,
        type: base_module_1.ModuleType.SERVER
    };
}
//# sourceMappingURL=index.js.map