"use strict";
/**
 * 模块注册表
 *
 * 负责模块的注册、创建和管理
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleRegistryAdapter = exports.ModuleRegistry = void 0;
const events_1 = require("events");
const base_module_1 = require("../interfaces/module/base-module");
/**
 * 模块注册表
 */
class ModuleRegistry extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.modules = new Map();
        this.instances = new Map();
    }
    /**
     * 注册模块
     */
    registerModule(registration) {
        if (this.modules.has(registration.id)) {
            throw new Error(`Module ${registration.id} is already registered`);
        }
        this.validateRegistration(registration);
        this.modules.set(registration.id, registration);
        this.emit('moduleRegistered', { moduleId: registration.id, registration });
    }
    /**
     * 取消注册模块
     */
    unregisterModule(moduleId) {
        const registration = this.modules.get(moduleId);
        if (!registration) {
            return;
        }
        // 清理所有该模块的实例
        const instancesToRemove = [];
        for (const [instanceId, instance] of this.instances) {
            if (instance.getType() === registration.type && instance.getId().startsWith(moduleId)) {
                instancesToRemove.push(instanceId);
            }
        }
        for (const instanceId of instancesToRemove) {
            this.destroyModuleInstance(instanceId);
        }
        this.modules.delete(moduleId);
        this.emit('moduleUnregistered', { moduleId });
    }
    /**
     * 获取模块注册信息
     */
    getModuleRegistration(moduleId) {
        return this.modules.get(moduleId) || null;
    }
    /**
     * 获取所有注册的模块
     */
    getAllRegistrations() {
        return Array.from(this.modules.values());
    }
    /**
     * 按类型获取模块
     */
    getModulesByType(type) {
        return Array.from(this.modules.values()).filter(reg => reg.type === type);
    }
    /**
     * 按标签搜索模块
     */
    searchModulesByTags(tags) {
        return Array.from(this.modules.values()).filter(reg => {
            if (!reg.tags)
                return false;
            return tags.some(tag => reg.tags.includes(tag));
        });
    }
    /**
     * 创建模块实例
     */
    async createModule(moduleId, config = {}) {
        const registration = this.modules.get(moduleId);
        if (!registration) {
            throw new Error(`Module ${moduleId} is not registered`);
        }
        try {
            // 检查依赖
            if (registration.dependencies) {
                for (const dependency of registration.dependencies) {
                    if (!this.modules.has(dependency)) {
                        throw new Error(`Missing dependency: ${dependency} for module ${moduleId}`);
                    }
                }
            }
            // 创建模块实例
            const instance = await registration.factory(config);
            // 生成唯一实例ID
            const instanceId = this.generateInstanceId(moduleId);
            this.instances.set(instanceId, instance);
            this.emit('moduleInstanceCreated', {
                moduleId,
                instanceId,
                instance
            });
            return instance;
        }
        catch (error) {
            this.emit('moduleCreationFailed', {
                moduleId,
                config,
                error
            });
            throw new Error(`Failed to create module ${moduleId}: ${error}`);
        }
    }
    /**
     * 销毁模块实例
     */
    async destroyModuleInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return false;
        }
        try {
            // 停止模块
            await instance.stop();
            // 清理资源
            await instance.cleanup();
            // 从注册表中移除
            this.instances.delete(instanceId);
            this.emit('moduleInstanceDestroyed', { instanceId });
            return true;
        }
        catch (error) {
            this.emit('moduleDestructionFailed', { instanceId, error });
            throw new Error(`Failed to destroy module instance ${instanceId}: ${error}`);
        }
    }
    /**
     * 获取模块实例
     */
    getModuleInstance(instanceId) {
        return this.instances.get(instanceId) || null;
    }
    /**
     * 获取所有模块实例
     */
    getAllInstances() {
        return new Map(this.instances);
    }
    /**
     * 获取指定模块的所有实例
     */
    getInstancesByModuleId(moduleId) {
        const instances = [];
        for (const [instanceId, instance] of this.instances) {
            if (instanceId.startsWith(`${moduleId}_`)) {
                instances.push(instance);
            }
        }
        return instances;
    }
    /**
     * 验证模块依赖
     */
    validateDependencies(moduleId) {
        const registration = this.modules.get(moduleId);
        if (!registration) {
            throw new Error(`Module ${moduleId} is not registered`);
        }
        const missingDependencies = [];
        const circularDependencies = [];
        // 检查直接依赖
        if (registration.dependencies) {
            for (const dependency of registration.dependencies) {
                if (!this.modules.has(dependency)) {
                    missingDependencies.push(dependency);
                }
            }
        }
        // 检查循环依赖
        const visited = new Set();
        const recursionStack = new Set();
        if (this.hasCyclicDependency(moduleId, visited, recursionStack)) {
            circularDependencies.push(moduleId);
        }
        return {
            valid: missingDependencies.length === 0 && circularDependencies.length === 0,
            missingDependencies,
            circularDependencies
        };
    }
    /**
     * 获取注册表统计信息
     */
    getStatistics() {
        const modulesByType = {
            transformer: 0,
            protocol: 0,
            server: 0,
            validator: 0
        };
        const instancesByModule = {};
        // 统计模块类型
        for (const registration of this.modules.values()) {
            modulesByType[registration.type]++;
        }
        // 统计实例数量
        for (const [instanceId, instance] of this.instances) {
            const moduleId = instanceId.split('_')[0];
            if (moduleId) {
                instancesByModule[moduleId] = (instancesByModule[moduleId] || 0) + 1;
            }
        }
        return {
            totalModules: this.modules.size,
            totalInstances: this.instances.size,
            modulesByType,
            instancesByModule
        };
    }
    /**
     * 清理注册表
     */
    async clear() {
        // 销毁所有实例
        const instanceIds = Array.from(this.instances.keys());
        for (const instanceId of instanceIds) {
            await this.destroyModuleInstance(instanceId);
        }
        // 清除所有注册
        this.modules.clear();
        this.instances.clear();
        this.emit('registryCleared');
    }
    /**
     * 验证模块注册信息
     */
    validateRegistration(registration) {
        if (!registration.id || !registration.id.trim()) {
            throw new Error('Module ID is required');
        }
        if (!registration.name || !registration.name.trim()) {
            throw new Error('Module name is required');
        }
        if (!registration.factory || typeof registration.factory !== 'function') {
            throw new Error('Module factory function is required');
        }
        if (!registration.version || !registration.version.trim()) {
            throw new Error('Module version is required');
        }
        // 验证依赖项
        if (registration.dependencies) {
            for (const dependency of registration.dependencies) {
                if (!dependency || !dependency.trim()) {
                    throw new Error('Invalid dependency in module registration');
                }
            }
        }
    }
    /**
     * 生成实例ID
     */
    generateInstanceId(moduleId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `${moduleId}_${timestamp}_${random}`;
    }
    /**
     * 检查循环依赖
     */
    hasCyclicDependency(moduleId, visited, recursionStack) {
        visited.add(moduleId);
        recursionStack.add(moduleId);
        const registration = this.modules.get(moduleId);
        if (registration && registration.dependencies) {
            for (const dependency of registration.dependencies) {
                if (!visited.has(dependency)) {
                    if (this.hasCyclicDependency(dependency, visited, recursionStack)) {
                        return true;
                    }
                }
                else if (recursionStack.has(dependency)) {
                    return true;
                }
            }
        }
        recursionStack.delete(moduleId);
        return false;
    }
}
exports.ModuleRegistry = ModuleRegistry;
// ModuleInterface implementation for architecture compliance
const base_module_2 = require("../interfaces/module/base-module");
exports.moduleRegistryAdapter = new base_module_2.SimpleModuleAdapter('module-registry', 'Pipeline Module Registry', base_module_1.ModuleType.PIPELINE, '4.0.0-alpha.2');
//# sourceMappingURL=module-registry.js.map