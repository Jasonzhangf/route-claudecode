"use strict";
/**
 * 基础模块接口定义
 *
 * 所有模块必须实现的基础接口，确保模块间的一致性
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleModuleAdapter = exports.ModuleEventType = exports.ModuleType = void 0;
/**
 * 模块类型枚举
 */
var ModuleType;
(function (ModuleType) {
    ModuleType["VALIDATOR"] = "validator";
    ModuleType["TRANSFORMER"] = "transformer";
    ModuleType["PROTOCOL"] = "protocol";
    ModuleType["SERVER_COMPATIBILITY"] = "server-compatibility";
    ModuleType["COMPATIBILITY"] = "compatibility";
    ModuleType["SERVER"] = "server";
    ModuleType["ROUTER"] = "router";
    ModuleType["PIPELINE"] = "pipeline";
    ModuleType["CLIENT"] = "client";
    ModuleType["CONFIG"] = "config";
    ModuleType["DEBUG"] = "debug";
    ModuleType["ERROR_HANDLER"] = "error-handler";
    ModuleType["MIDDLEWARE"] = "middleware";
    ModuleType["PROVIDER"] = "provider";
    ModuleType["SERVICE"] = "service";
    ModuleType["UTILITY"] = "utility";
})(ModuleType || (exports.ModuleType = ModuleType = {}));
/**
 * 模块事件类型
 */
var ModuleEventType;
(function (ModuleEventType) {
    ModuleEventType["STARTED"] = "started";
    ModuleEventType["STOPPED"] = "stopped";
    ModuleEventType["ERROR"] = "error";
    ModuleEventType["STATUS_CHANGED"] = "statusChanged";
    ModuleEventType["CONFIG_UPDATED"] = "configUpdated";
    ModuleEventType["PROCESSING_STARTED"] = "processingStarted";
    ModuleEventType["PROCESSING_COMPLETED"] = "processingCompleted";
    ModuleEventType["PROCESSING_FAILED"] = "processingFailed";
    ModuleEventType["HEALTH_CHECK_FAILED"] = "healthCheckFailed";
})(ModuleEventType || (exports.ModuleEventType = ModuleEventType = {}));
/**
 * 简单的ModuleInterface适配器类
 * 为现有类提供快速的ModuleInterface实现
 */
class SimpleModuleAdapter {
    constructor(id, name, type, version = '1.0.0') {
        this.connections = new Map();
        this.messageListeners = new Set();
        this.isStarted = false;
        this.moduleId = id;
        this.moduleName = name;
        this.moduleType = type;
        this.moduleVersion = version;
        this.status = { id, name, type, status: 'stopped', health: 'healthy' };
        this.metrics = { requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0 };
    }
    getId() { return this.moduleId; }
    getName() { return this.moduleName; }
    getType() { return this.moduleType; }
    getVersion() { return this.moduleVersion; }
    getStatus() { return { ...this.status }; }
    getMetrics() { return { ...this.metrics }; }
    async configure(config) {
        this.status.status = 'idle';
    }
    async start() {
        this.isStarted = true;
        this.status.status = 'running';
    }
    async stop() {
        this.isStarted = false;
        this.status.status = 'stopped';
    }
    async process(input) {
        this.metrics.requestsProcessed++;
        return input;
    }
    async reset() {
        this.metrics = { requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0 };
    }
    async cleanup() {
        this.connections.clear();
        this.messageListeners.clear();
    }
    async healthCheck() {
        return { healthy: this.isStarted, details: { status: this.status } };
    }
    addConnection(module) {
        this.connections.set(module.getId(), module);
    }
    removeConnection(moduleId) {
        this.connections.delete(moduleId);
    }
    getConnection(moduleId) {
        return this.connections.get(moduleId);
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    async sendToModule(targetModuleId, message, type) {
        return message;
    }
    async broadcastToModules(message, type) {
        // Empty implementation
    }
    onModuleMessage(listener) {
        this.messageListeners.add(listener);
    }
    on(event, listener) {
        // Empty implementation - could use EventEmitter if needed
    }
    removeAllListeners() {
        this.messageListeners.clear();
    }
}
exports.SimpleModuleAdapter = SimpleModuleAdapter;
//# sourceMappingURL=base-module.js.map