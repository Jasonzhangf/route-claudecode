"use strict";
/**
 * 路由器模块接口定义
 *
 * 定义路由器模块的标准接口，包括请求路由、配置管理、流水线管理等功能
 * 严格遵循模块边界，通过接口与其他模块通信
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingStrategy = void 0;
/**
 * 路由策略枚举
 */
var RoutingStrategy;
(function (RoutingStrategy) {
    RoutingStrategy["ROUND_ROBIN"] = "round_robin";
    RoutingStrategy["LEAST_CONNECTIONS"] = "least_connections";
    RoutingStrategy["FASTEST_RESPONSE"] = "fastest_response";
    RoutingStrategy["WEIGHTED"] = "weighted";
    RoutingStrategy["RANDOM"] = "random";
})(RoutingStrategy || (exports.RoutingStrategy = RoutingStrategy = {}));
