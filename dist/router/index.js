"use strict";
/**
 * RCC v4.0 Router模块导出
 *
 * 新架构组件:
 * - PipelineRouter: 流水线选择路由器
 * - LoadBalancer: APIKey级负载均衡器
 * - Config系统: 配置加载和管理
 *
 * @author RCC v4.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterModuleFactory = exports.ROUTER_MODULE_VERSION = exports.ConfigLoader = exports.DEFAULT_LOAD_BALANCER_CONFIG = exports.LoadBalancer = exports.PipelineRouter = void 0;
// RCC v4.0 核心组件
var pipeline_router_1 = require("./pipeline-router");
Object.defineProperty(exports, "PipelineRouter", { enumerable: true, get: function () { return pipeline_router_1.PipelineRouter; } });
var load_balancer_1 = require("./load-balancer");
Object.defineProperty(exports, "LoadBalancer", { enumerable: true, get: function () { return load_balancer_1.LoadBalancer; } });
Object.defineProperty(exports, "DEFAULT_LOAD_BALANCER_CONFIG", { enumerable: true, get: function () { return load_balancer_1.DEFAULT_LOAD_BALANCER_CONFIG; } });
var config_loader_1 = require("./config-loader");
Object.defineProperty(exports, "ConfigLoader", { enumerable: true, get: function () { return config_loader_1.ConfigLoader; } });
// 废弃的CoreRouter已删除 - 使用PipelineRouter代替
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
        const pipelineRouter = new PipelineRouter(routingTable);
        const loadBalancer = new LoadBalancer(pipelineManager, config);
        return {
            pipelineRouter,
            loadBalancer
        };
    }
}
exports.RouterModuleFactory = RouterModuleFactory;
//# sourceMappingURL=index.js.map