"use strict";
/**
 * 核心模块接口定义
 *
 * 定义RCC v4.0所有模块必须遵循的标准接口
 * 确保模块间只能通过接口通信，严禁直接调用具体实现
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleType = exports.ModuleStatus = void 0;
/**
 * 模块状态枚举
 */
var ModuleStatus;
(function (ModuleStatus) {
    ModuleStatus["IDLE"] = "idle";
    ModuleStatus["STARTING"] = "starting";
    ModuleStatus["RUNNING"] = "running";
    ModuleStatus["STOPPING"] = "stopping";
    ModuleStatus["STOPPED"] = "stopped";
    ModuleStatus["ERROR"] = "error";
})(ModuleStatus || (exports.ModuleStatus = ModuleStatus = {}));
/**
 * 模块类型枚举
 */
var ModuleType;
(function (ModuleType) {
    ModuleType["CLIENT"] = "client";
    ModuleType["ROUTER"] = "router";
    ModuleType["PIPELINE"] = "pipeline";
    ModuleType["DEBUG"] = "debug";
    ModuleType["SERVER"] = "server";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
