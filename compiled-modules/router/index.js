"use strict";
/**
 * RCC v4.0 路由器模块 - 统一导出接口
 *
 * 零接口暴露设计：只导出公开接口，所有内部实现完全隐藏
 *
 * @author RCC v4.0 Architecture Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_INFO = exports.RouterPreprocessor = void 0;
// 导出核心路由预处理器
var router_preprocessor_1 = require("./router-preprocessor");
Object.defineProperty(exports, "RouterPreprocessor", { enumerable: true, get: function () { return router_preprocessor_1.RouterPreprocessor; } });
// 模块元信息（编译时会自动更新）
exports.MODULE_INFO = {
    name: 'router',
    version: '4.1.0',
    description: 'RCC v4.0 Router Management Module',
    apiVersion: '4.1.0',
    isolationLevel: 'complete'
};
//# sourceMappingURL=index.js.map