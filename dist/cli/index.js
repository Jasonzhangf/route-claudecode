"use strict";
/**
 * RCC v4.0 CLI模块导出
 *
 * 基于新的标准化接口架构:
 * - CLIModuleInterface: 标准CLI接口
 * - CommandParser: 命令解析器
 * - ArgumentValidator: 参数验证器
 * - CommandExecutor: 命令执行器
 * - 统一的配置和错误处理
 *
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_MODULE_VERSION = exports.RCCCli = void 0;
// RCC v4.0 CLI核心组件
var rcc_cli_1 = require("./rcc-cli");
Object.defineProperty(exports, "RCCCli", { enumerable: true, get: function () { return rcc_cli_1.RCCCli; } });
// 模块版本信息
exports.CLI_MODULE_VERSION = '4.0.0-beta.1';
//# sourceMappingURL=index.js.map