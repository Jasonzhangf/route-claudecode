"use strict";
/**
 * Pipeline Module Interface
 *
 * 统一的模块接口定义，用于Pipeline组装器的动态模块注册
 *
 * @author Claude Code Router v4.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleType = void 0;
/**
 * 模块类型枚举
 */
var ModuleType;
(function (ModuleType) {
    ModuleType["TRANSFORMER"] = "transformer";
    ModuleType["PROTOCOL"] = "protocol";
    ModuleType["SERVER_COMPATIBILITY"] = "server-compatibility";
    ModuleType["SERVER"] = "server";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
//# sourceMappingURL=module-interface.js.map