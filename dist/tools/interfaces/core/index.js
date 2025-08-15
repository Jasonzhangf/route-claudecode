"use strict";
/**
 * 核心模块接口统一导出
 *
 * 这个文件是RCC v4.0模块化架构的核心，定义了所有模块必须遵循的标准接口
 * 所有模块间的通信都必须通过这些接口进行，严禁直接调用具体实现
 *
 * @author Jason Zhang
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
exports.MODULE_DEPENDENCY_GRAPH = exports.SUPPORTED_MODULE_TYPES = exports.MODULE_INTERFACE_VERSION = void 0;
exports.validateModuleDependency = validateModuleDependency;
exports.detectCircularDependencies = detectCircularDependencies;
// 基础模块接口
__exportStar(require("./module-interface"), exports);
// 客户端模块接口
__exportStar(require("./client-interface"), exports);
// 路由器模块接口
__exportStar(require("./router-interface"), exports);
// Debug系统接口
__exportStar(require("./debug-interface"), exports);
// 服务器模块接口
__exportStar(require("./server-interface"), exports);
/**
 * 模块接口版本信息
 */
exports.MODULE_INTERFACE_VERSION = '4.0.0-alpha.1';
/**
 * 支持的模块类型列表
 */
exports.SUPPORTED_MODULE_TYPES = [
    'client',
    'router',
    'pipeline',
    'debug',
    'server'
];
/**
 * 模块依赖关系图
 * 定义模块间的允许依赖关系
 */
exports.MODULE_DEPENDENCY_GRAPH = {
    client: ['router', 'server'], // 客户端可以依赖路由器和服务器接口
    router: ['pipeline', 'debug'], // 路由器可以依赖流水线和Debug接口
    pipeline: ['debug'], // 流水线可以依赖Debug接口
    debug: [], // Debug系统不依赖其他模块
    server: ['pipeline', 'debug'] // 服务器可以依赖流水线和Debug接口
};
/**
 * 验证模块依赖是否合法
 * @param sourceModule 源模块类型
 * @param targetModule 目标模块类型
 * @returns boolean 是否允许依赖
 */
function validateModuleDependency(sourceModule, targetModule) {
    const allowedDependencies = exports.MODULE_DEPENDENCY_GRAPH[sourceModule];
    return allowedDependencies ? allowedDependencies.includes(targetModule) : false;
}
/**
 * 检查是否存在循环依赖
 * @param dependencies 依赖关系映射
 * @returns string[] 循环依赖路径，空数组表示无循环依赖
 */
function detectCircularDependencies(dependencies) {
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    function dfs(node) {
        if (recursionStack.has(node)) {
            return true; // 找到循环
        }
        if (visited.has(node)) {
            return false;
        }
        visited.add(node);
        recursionStack.add(node);
        path.push(node);
        const deps = dependencies[node] || [];
        for (const dep of deps) {
            if (dfs(dep)) {
                return true;
            }
        }
        recursionStack.delete(node);
        path.pop();
        return false;
    }
    for (const node of Object.keys(dependencies)) {
        if (!visited.has(node)) {
            if (dfs(node)) {
                return [...path];
            }
        }
    }
    return [];
}
