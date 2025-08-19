"use strict";
/**
 * 基础模块接口定义
 *
 * 所有模块必须实现的基础接口，确保模块间的一致性
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleType = void 0;
/**
 * 模块类型枚举
 */
var ModuleType;
(function (ModuleType) {
    ModuleType["VALIDATOR"] = "validator";
    ModuleType["TRANSFORMER"] = "transformer";
    ModuleType["PROTOCOL"] = "protocol";
    ModuleType["SERVER_COMPATIBILITY"] = "server-compatibility";
    ModuleType["SERVER"] = "server";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
//# sourceMappingURL=base-module.js.map