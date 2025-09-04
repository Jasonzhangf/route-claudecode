"use strict";
/**
 * RCC v4.0 配置管理模块 - 统一导出接口
 *
 * 零接口暴露设计：只导出公开接口，所有内部实现完全隐藏
 *
 * @author RCC v4.0 Architecture Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_INFO = exports.ConfigPreprocessor = void 0;
// 导出核心配置预处理器
var config_preprocessor_1 = require("./config-preprocessor");
Object.defineProperty(exports, "ConfigPreprocessor", { enumerable: true, get: function () { return config_preprocessor_1.ConfigPreprocessor; } });
// 模块元信息（编译时会自动更新）
exports.MODULE_INFO = {
    name: 'config',
    version: '4.1.0',
    description: 'RCC v4.0 Configuration Management Module',
    apiVersion: '4.1.0',
    isolationLevel: 'complete'
};
//# sourceMappingURL=index.js.map