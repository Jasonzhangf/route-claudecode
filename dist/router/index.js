"use strict";
/**
 * RCC v4.0 Router模块导出
 *
 * 基于新的标准化接口架构:
 * - RouterModuleInterface: 标准路由器接口
 * - PipelineRouter: 流水线选择路由器
 * - LoadBalancer: APIKey级负载均衡器
 * - 统一的配置和错误处理
 *
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
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
exports.RouterModuleFactory = exports.ROUTER_MODULE_VERSION = exports.VIRTUAL_MODEL_MAPPING_RULES = exports.VirtualModelType = exports.SimpleRouter = exports.DEFAULT_LOAD_BALANCER_CONFIG = exports.LoadBalancer = exports.PipelineRouter = void 0;
// 标准接口导出
__exportStar(require("../interfaces/core/router-interface"), exports);
// RCC v4.0 核心组件
var pipeline_router_1 = require("./pipeline-router");
Object.defineProperty(exports, "PipelineRouter", { enumerable: true, get: function () { return pipeline_router_1.PipelineRouter; } });
var load_balancer_1 = require("./load-balancer");
Object.defineProperty(exports, "LoadBalancer", { enumerable: true, get: function () { return load_balancer_1.LoadBalancer; } });
Object.defineProperty(exports, "DEFAULT_LOAD_BALANCER_CONFIG", { enumerable: true, get: function () { return load_balancer_1.DEFAULT_LOAD_BALANCER_CONFIG; } });
var simple_router_1 = require("./simple-router");
Object.defineProperty(exports, "SimpleRouter", { enumerable: true, get: function () { return simple_router_1.SimpleRouter; } });
var virtual_model_mapping_1 = require("./virtual-model-mapping");
Object.defineProperty(exports, "VirtualModelType", { enumerable: true, get: function () { return virtual_model_mapping_1.VirtualModelType; } });
Object.defineProperty(exports, "VIRTUAL_MODEL_MAPPING_RULES", { enumerable: true, get: function () { return virtual_model_mapping_1.VIRTUAL_MODEL_MAPPING_RULES; } });
// 会话控制组件
__exportStar(require("./session-control"), exports);
// 导入用于类型注解
const pipeline_router_2 = require("./pipeline-router");
const load_balancer_2 = require("./load-balancer");
// 模块版本信息
exports.ROUTER_MODULE_VERSION = '4.0.0-beta.1';
/**
 * RCC v4.0 Router模块工厂
 */
class RouterModuleFactory {
    /**
     * 创建完整的路由系统
     */
    static createRoutingSystem(pipelineManager, routingTable, config) {
        const pipelineRouter = new pipeline_router_2.PipelineRouter(routingTable);
        const loadBalancer = new load_balancer_2.LoadBalancer(pipelineManager, config);
        return {
            pipelineRouter,
            loadBalancer
        };
    }
}
exports.RouterModuleFactory = RouterModuleFactory;
//# sourceMappingURL=index.js.map