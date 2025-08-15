"use strict";
/**
 * Route Claude Code (RCC) v4.0 - 主入口文件
 *
 * 高性能、模块化的多AI提供商路由转换系统
 *
 * @author Jason Zhang
 * @version 4.0.0-alpha.1
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteClaudeCode = exports.BUILD_DATE = exports.VERSION = exports.PipelineModuleRegistry = exports.PipelineFactoryImpl = exports.StandardPipeline = exports.PipelineManager = exports.PIPELINE_MODULE_VERSION = exports.PipelineServer = exports.HTTPServer = void 0;
// 核心接口导出
__exportStar(require("./interfaces"), exports);
// CLI模块导出
__exportStar(require("./cli"), exports);
// 客户端模块导出
__exportStar(require("./client"), exports);
// 服务器模块导出
var server_1 = require("./server");
Object.defineProperty(exports, "HTTPServer", { enumerable: true, get: function () { return server_1.HTTPServer; } });
Object.defineProperty(exports, "PipelineServer", { enumerable: true, get: function () { return server_1.PipelineServer; } });
// 路由器模块导出
__exportStar(require("./router"), exports);
// 流水线模块导出 - 避免与interfaces中的命名冲突
var pipeline_1 = require("./pipeline");
Object.defineProperty(exports, "PIPELINE_MODULE_VERSION", { enumerable: true, get: function () { return pipeline_1.PIPELINE_MODULE_VERSION; } });
var pipeline_manager_1 = require("./pipeline/pipeline-manager");
Object.defineProperty(exports, "PipelineManager", { enumerable: true, get: function () { return pipeline_manager_1.PipelineManager; } });
var standard_pipeline_1 = require("./pipeline/standard-pipeline");
Object.defineProperty(exports, "StandardPipeline", { enumerable: true, get: function () { return standard_pipeline_1.StandardPipeline; } });
var pipeline_factory_1 = require("./pipeline/pipeline-factory");
Object.defineProperty(exports, "PipelineFactoryImpl", { enumerable: true, get: function () { return pipeline_factory_1.StandardPipelineFactoryImpl; } });
var module_registry_1 = require("./pipeline/module-registry");
Object.defineProperty(exports, "PipelineModuleRegistry", { enumerable: true, get: function () { return module_registry_1.ModuleRegistry; } });
// Debug系统导出
__exportStar(require("./debug"), exports);
// 工具函数导出
__exportStar(require("./utils"), exports);
// 版本信息
exports.VERSION = '4.0.0-alpha.1';
exports.BUILD_DATE = new Date().toISOString();
/**
 * RCC主类 - 统一入口点
 */
class RouteClaudeCode {
    static instance;
    constructor() {
        // 私有构造函数，单例模式
    }
    /**
     * 获取RCC实例
     */
    static getInstance() {
        if (!RouteClaudeCode.instance) {
            RouteClaudeCode.instance = new RouteClaudeCode();
        }
        return RouteClaudeCode.instance;
    }
    /**
     * 获取版本信息
     */
    getVersion() {
        return exports.VERSION;
    }
    /**
     * 获取构建日期
     */
    getBuildDate() {
        return exports.BUILD_DATE;
    }
}
exports.RouteClaudeCode = RouteClaudeCode;
//# sourceMappingURL=index.js.map