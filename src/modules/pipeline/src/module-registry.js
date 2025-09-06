"use strict";
/**
 * Module Registry
 *
 * 动态模块注册器 - 扫描和注册所有Pipeline模块
 *
 * @author Claude Code Router v4.0
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const module_interface_1 = require("./module-interface");
/**
 * 动态模块注册器
 */
class ModuleRegistry {
    constructor() {
        this.registeredModules = new Map();
        this.modulesByType = new Map();
        this.scanPaths = [];
        // 初始化模块类型映射
        Object.values(module_interface_1.ModuleType).forEach(type => {
            this.modulesByType.set(type, []);
        });
    }
    /**
     * 设置扫描路径
     */
    setScanPaths(paths) {
        this.scanPaths = paths;
    }
    /**
     * 扫描并注册所有模块
     */
    async scanAndRegisterModules() {
        const startTime = Date.now();
        // 默认扫描路径
        if (this.scanPaths.length === 0) {
            const baseDir = path.resolve(__dirname, '../../pipeline-modules');
            this.scanPaths = [
                path.join(baseDir, 'transformers'),
                path.join(baseDir, 'protocol'),
                path.join(baseDir, 'server-compatibility'),
                path.join(baseDir, 'server')
            ];
        }
        const scanResults = [];
        // 扫描每个路径
        for (const scanPath of this.scanPaths) {
            if (fs.existsSync(scanPath)) {
                const results = await this._scanDirectory(scanPath);
                scanResults.push(...results);
            }
        }
        // 注册有效的模块
        for (const result of scanResults) {
            if (result.isValid) {
                await this._registerModuleFromFile(result);
            }
        }
        const scanTime = Date.now() - startTime;
    }
    /**
     * 获取指定类型的模块
     */
    getModulesByType(type) {
        return this.modulesByType.get(type) || [];
    }
    /**
     * 获取模块实例
     */
    getModuleInstance(moduleId) {
        const registration = this.registeredModules.get(moduleId);
        return registration?.module;
    }
    /**
     * 获取所有已注册的模块
     */
    getAllRegistrations() {
        return Array.from(this.registeredModules.values());
    }
    /**
     * 检查模块是否已注册
     */
    isModuleRegistered(moduleId) {
        return this.registeredModules.has(moduleId);
    }
    /**
     * 获取注册统计信息
     */
    getRegistryStats() {
        const stats = {
            totalModules: this.registeredModules.size,
            modulesByType: {}
        };
        for (const [type, modules] of this.modulesByType) {
            stats.modulesByType[type] = modules.length;
        }
        return stats;
    }
    /**
     * 扫描目录中的模块文件
     */
    async _scanDirectory(dirPath) {
        const results = [];
        if (!fs.existsSync(dirPath)) {
            return results;
        }
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
                // 递归扫描子目录
                const subResults = await this._scanDirectory(fullPath);
                results.push(...subResults);
            }
            else if (file.name.endsWith('.ts') && !file.name.endsWith('.test.ts') && !file.name.endsWith('.d.ts')) {
                // 扫描TypeScript文件
                const scanResult = await this._scanModuleFile(fullPath);
                if (scanResult) {
                    results.push(scanResult);
                }
            }
        }
        return results;
    }
    /**
     * 扫描单个模块文件
     */
    async _scanModuleFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf-8');
        // 检查是否包含模块导出
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        if (!classMatch) {
            return null;
        }
        const className = classMatch[1];
        // 确定模块类型
        let moduleType;
        if (filePath.includes('transformer')) {
            moduleType = module_interface_1.ModuleType.TRANSFORMER;
        }
        else if (filePath.includes('protocol')) {
            moduleType = module_interface_1.ModuleType.PROTOCOL;
        }
        else if (filePath.includes('server-compatibility')) {
            moduleType = module_interface_1.ModuleType.SERVER_COMPATIBILITY;
        }
        else if (filePath.includes('server')) {
            moduleType = module_interface_1.ModuleType.SERVER;
        }
        else {
            return null;
        }
        // 检查是否实现了ModuleInterface
        const hasModuleInterface = content.includes('ModuleInterface') ||
            content.includes('BasePipelineModule');
        return {
            filePath,
            className,
            moduleType,
            isValid: hasModuleInterface,
            error: hasModuleInterface ? undefined : 'Module does not implement ModuleInterface'
        };
    }
    /**
     * 从文件注册模块
     */
    async _registerModuleFromFile(scanResult) {
        // 动态导入模块
        const moduleExports = await Promise.resolve(`${scanResult.filePath}`).then(s => __importStar(require(s)));
        const ModuleClass = moduleExports[scanResult.className];
        if (!ModuleClass) {
            return;
        }
        // 创建模块实例
        const moduleId = `${scanResult.moduleType}_${scanResult.className}_${Date.now()}`;
        const moduleInstance = new ModuleClass(moduleId, scanResult.className, scanResult.moduleType);
        // 验证模块接口
        if (!this._validateModuleInterface(moduleInstance)) {
            return;
        }
        // 创建注册信息
        const registration = {
            id: moduleId,
            name: scanResult.className,
            type: scanResult.moduleType,
            version: moduleInstance.getVersion(),
            filePath: scanResult.filePath,
            className: scanResult.className,
            module: moduleInstance,
            isActive: true,
            registeredAt: new Date()
        };
        // 注册模块
        this.registeredModules.set(moduleId, registration);
        this.modulesByType.get(scanResult.moduleType).push(registration);
    }
    /**
     * 验证模块接口
     */
    _validateModuleInterface(module) {
        const requiredMethods = [
            'getId', 'getName', 'getType', 'getVersion',
            'getStatus', 'getMetrics',
            'configure', 'start', 'stop', 'process',
            'healthCheck'
        ];
        return requiredMethods.every(method => typeof module[method] === 'function');
    }
}
exports.ModuleRegistry = ModuleRegistry;
//# sourceMappingURL=module-registry.js.map