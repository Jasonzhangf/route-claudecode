/**
 * Module Registry
 *
 * 动态模块注册器 - 扫描和注册所有Pipeline模块
 *
 * @author Claude Code Router v4.0
 */
import { ModuleInterface, ModuleType, ModuleRegistration } from './module-interface';
/**
 * 动态模块注册器
 */
export declare class ModuleRegistry {
    private registeredModules;
    private modulesByType;
    private scanPaths;
    constructor();
    /**
     * 设置扫描路径
     */
    setScanPaths(paths: string[]): void;
    /**
     * 扫描并注册所有模块
     */
    scanAndRegisterModules(): Promise<void>;
    /**
     * 获取指定类型的模块
     */
    getModulesByType(type: ModuleType): ModuleRegistration[];
    /**
     * 获取模块实例
     */
    getModuleInstance(moduleId: string): ModuleInterface | undefined;
    /**
     * 获取所有已注册的模块
     */
    getAllRegistrations(): ModuleRegistration[];
    /**
     * 检查模块是否已注册
     */
    isModuleRegistered(moduleId: string): boolean;
    /**
     * 获取注册统计信息
     */
    getRegistryStats(): Record<string, any>;
    /**
     * 扫描目录中的模块文件
     */
    private _scanDirectory;
    /**
     * 扫描单个模块文件
     */
    private _scanModuleFile;
    /**
     * 从文件注册模块
     */
    private _registerModuleFromFile;
    /**
     * 验证模块接口
     */
    private _validateModuleInterface;
}
//# sourceMappingURL=module-registry.d.ts.map