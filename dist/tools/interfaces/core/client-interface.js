"use strict";
/**
 * 客户端模块接口定义
 *
 * 定义客户端模块的标准接口，包括CLI管理、服务器管理、会话管理等功能
 * 严格遵循模块边界，不允许直接调用其他模块的具体实现
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLICommandType = void 0;
/**
 * CLI命令类型枚举
 */
var CLICommandType;
(function (CLICommandType) {
    CLICommandType["START"] = "start";
    CLICommandType["STOP"] = "stop";
    CLICommandType["STATUS"] = "status";
    CLICommandType["CONFIG"] = "config";
    CLICommandType["DEBUG"] = "debug";
    CLICommandType["VERSION"] = "version";
})(CLICommandType || (exports.CLICommandType = CLICommandType = {}));
