"use strict";
/**
 * RCC v4.0 Router模块导出
 *
 * 重构后的路由器模块 - 零接口暴露设计
 * 只导出RouterPreprocessor和必要的类型定义
 *
 * @version 4.1.0-preprocessor
 * @author Claude - Refactored
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTER_MODULE_VERSION = exports.DEFAULT_LOAD_BALANCER_CONFIG = exports.LoadBalancer = exports.PipelineRouter = exports.RouterPreprocessor = void 0;
// 唯一的路由处理接口
var router_preprocessor_1 = require("./router-preprocessor");
Object.defineProperty(exports, "RouterPreprocessor", { enumerable: true, get: function () { return router_preprocessor_1.RouterPreprocessor; } });
// 保留核心路由器类（用于向后兼容，但内部方法已封装）
var pipeline_router_1 = require("./pipeline-router");
Object.defineProperty(exports, "PipelineRouter", { enumerable: true, get: function () { return pipeline_router_1.PipelineRouter; } });
// 负载均衡器（保留用于系统集成）
var load_balancer_1 = require("./load-balancer");
Object.defineProperty(exports, "LoadBalancer", { enumerable: true, get: function () { return load_balancer_1.LoadBalancer; } });
Object.defineProperty(exports, "DEFAULT_LOAD_BALANCER_CONFIG", { enumerable: true, get: function () { return load_balancer_1.DEFAULT_LOAD_BALANCER_CONFIG; } });
// 模块版本信息
exports.ROUTER_MODULE_VERSION = '4.1.0-preprocessor';
//# sourceMappingURL=index.js.map