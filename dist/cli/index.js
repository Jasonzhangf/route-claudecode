"use strict";
/**
 * RCC v4.0 CLI模块导出
 *
 * 零接口暴露设计 - 只导出必要的公共接口
 *
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliModuleAdapter = exports.CLI_MODULE_VERSION = exports.RCCCli = void 0;
// 核心CLI组件
var rcc_cli_1 = require("./rcc-cli");
Object.defineProperty(exports, "RCCCli", { enumerable: true, get: function () { return rcc_cli_1.RCCCli; } });
// 模块版本信息
exports.CLI_MODULE_VERSION = '4.0.0-beta.1';
// ModuleInterface implementation for architecture compliance
const base_module_1 = require("../interfaces/module/base-module");
exports.cliModuleAdapter = new base_module_1.SimpleModuleAdapter('cli-module', 'CLI Module', base_module_1.ModuleType.VALIDATOR, exports.CLI_MODULE_VERSION);
//# sourceMappingURL=index.js.map