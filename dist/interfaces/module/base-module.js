"use strict";
/**
 * 基础模块接口定义
 *
 * 所有模块必须实现的基础接口，确保模块间的一致性
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleEventType = exports.ModuleType = void 0;
/**
 * 模块类型枚举
 */
var ModuleType;
(function (ModuleType) {
    ModuleType["VALIDATOR"] = "validator";
    ModuleType["TRANSFORMER"] = "transformer";
    ModuleType["PROTOCOL"] = "protocol";
    ModuleType["SERVER_COMPATIBILITY"] = "server-compatibility";
    ModuleType["COMPATIBILITY"] = "compatibility";
    ModuleType["SERVER"] = "server";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
/**
 * 模块事件类型
 */
var ModuleEventType;
(function (ModuleEventType) {
    ModuleEventType["STARTED"] = "started";
    ModuleEventType["STOPPED"] = "stopped";
    ModuleEventType["ERROR"] = "error";
    ModuleEventType["STATUS_CHANGED"] = "statusChanged";
    ModuleEventType["CONFIG_UPDATED"] = "configUpdated";
    ModuleEventType["PROCESSING_STARTED"] = "processingStarted";
    ModuleEventType["PROCESSING_COMPLETED"] = "processingCompleted";
    ModuleEventType["PROCESSING_FAILED"] = "processingFailed";
    ModuleEventType["HEALTH_CHECK_FAILED"] = "healthCheckFailed";
})(ModuleEventType || (exports.ModuleEventType = ModuleEventType = {}));
//# sourceMappingURL=base-module.js.map