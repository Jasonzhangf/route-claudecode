"use strict";
/**
 * Debug系统模块入口文件
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugManagerImpl = exports.DEBUG_MODULE_VERSION = void 0;
// 模块版本信息
exports.DEBUG_MODULE_VERSION = '4.0.0-alpha.2';
// 选择性导出避免名称冲突
var debug_manager_1 = require("./debug-manager");
Object.defineProperty(exports, "DebugManagerImpl", { enumerable: true, get: function () { return debug_manager_1.DebugManagerImpl; } });
//# sourceMappingURL=index.js.map