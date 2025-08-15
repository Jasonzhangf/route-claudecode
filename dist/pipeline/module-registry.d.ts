/**
 * 模块注册表
 *
 * 负责模块的注册、创建和管理
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { ModuleInterface, ModuleType } from '../interfaces/module/base-module';
/**
 * 模块工厂函数类型
 */
export type ModuleFactoryFunction = (config: any) => Promise<ModuleInterface>;
/**
 * 模块注册信息
 */
export interface ModuleRegistration {
    id: string;
    name: string;
    type: ModuleType;
    description?: string;
    factory: ModuleFactoryFunction;
    version: string;
    author?: string;
    dependencies?: string[];
    tags?: string[];
    metadata?: Record<string, any>;
}
/**
 * 模块注册表
 */
export declare class ModuleRegistry extends EventEmitter {
    private modules;
    private instances;
    /**
     * 注册模块
     */
    registerModule(registration: ModuleRegistration): void;
    /**
     * 取消注册模块
     */
    unregisterModule(moduleId: string): void;
    /**
     * 获取模块注册信息
     */
    getModuleRegistration(moduleId: string): ModuleRegistration | null;
    /**
     * 获取所有注册的模块
     */
    getAllRegistrations(): ModuleRegistration[];
    /**
     * 按类型获取模块
     */
    getModulesByType(type: ModuleType): ModuleRegistration[];
    /**
     * 按标签搜索模块
     */
    searchModulesByTags(tags: string[]): ModuleRegistration[];
    /**
     * 创建模块实例
     */
    createModule(moduleId: string, config?: any): Promise<ModuleInterface>;
    /**
     * 销毁模块实例
     */
    destroyModuleInstance(instanceId: string): Promise<boolean>;
    /**
     * 获取模块实例
     */
    getModuleInstance(instanceId: string): ModuleInterface | null;
    /**
     * 获取所有模块实例
     */
    getAllInstances(): Map<string, ModuleInterface>;
    /**
     * 获取指定模块的所有实例
     */
    getInstancesByModuleId(moduleId: string): ModuleInterface[];
    /**
     * 验证模块依赖
     */
    validateDependencies(moduleId: string): {
        valid: boolean;
        missingDependencies: string[];
        circularDependencies: string[];
    };
    /**
     * 获取注册表统计信息
     */
    getStatistics(): {
        totalModules: number;
        totalInstances: number;
        modulesByType: Record<ModuleType, number>;
        instancesByModule: Record<string, number>;
    };
    /**
     * 清理注册表
     */
    clear(): Promise<void>;
    /**
     * 验证模块注册信息
     */
    private validateRegistration;
    /**
     * 生成实例ID
     */
    private generateInstanceId;
    /**
     * 检查循环依赖
     */
    private hasCyclicDependency;
}
//# sourceMappingURL=module-registry.d.ts.map