/**
 * Module Registry
 * 
 * 动态模块注册器 - 扫描和注册所有Pipeline模块
 * 
 * @author Claude Code Router v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModuleInterface, ModuleType, ModuleRegistration } from './module-interface';

/**
 * 模块扫描结果
 */
interface ModuleScanResult {
  filePath: string;
  className: string;
  moduleType: ModuleType;
  isValid: boolean;
  error?: string;
}

/**
 * 动态模块注册器
 */
export class ModuleRegistry {
  private registeredModules: Map<string, ModuleRegistration> = new Map();
  private modulesByType: Map<ModuleType, ModuleRegistration[]> = new Map();
  private scanPaths: string[] = [];
  
  constructor() {
    // 初始化模块类型映射
    Object.values(ModuleType).forEach(type => {
      this.modulesByType.set(type, []);
    });
  }
  
  /**
   * 设置扫描路径
   */
  setScanPaths(paths: string[]): void {
    this.scanPaths = paths;
  }
  
  /**
   * 扫描并注册所有模块
   */
  async scanAndRegisterModules(): Promise<void> {
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
    
    const scanResults: ModuleScanResult[] = [];
    
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
  getModulesByType(type: ModuleType): ModuleRegistration[] {
    return this.modulesByType.get(type) || [];
  }
  
  /**
   * 获取模块实例
   */
  getModuleInstance(moduleId: string): ModuleInterface | undefined {
    const registration = this.registeredModules.get(moduleId);
    return registration?.module;
  }
  
  /**
   * 获取所有已注册的模块
   */
  getAllRegistrations(): ModuleRegistration[] {
    return Array.from(this.registeredModules.values());
  }
  
  /**
   * 检查模块是否已注册
   */
  isModuleRegistered(moduleId: string): boolean {
    return this.registeredModules.has(moduleId);
  }
  
  /**
   * 获取注册统计信息
   */
  getRegistryStats(): Record<string, any> {
    const stats: Record<string, any> = {
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
  private async _scanDirectory(dirPath: string): Promise<ModuleScanResult[]> {
    const results: ModuleScanResult[] = [];
    
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
      } else if (file.name.endsWith('.ts') && !file.name.endsWith('.test.ts') && !file.name.endsWith('.d.ts')) {
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
  private async _scanModuleFile(filePath: string): Promise<ModuleScanResult | null> {
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
    let moduleType: ModuleType;
    if (filePath.includes('transformer')) {
      moduleType = ModuleType.TRANSFORMER;
    } else if (filePath.includes('protocol')) {
      moduleType = ModuleType.PROTOCOL;
    } else if (filePath.includes('server-compatibility')) {
      moduleType = ModuleType.SERVER_COMPATIBILITY;
    } else if (filePath.includes('server')) {
      moduleType = ModuleType.SERVER;
    } else {
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
  private async _registerModuleFromFile(scanResult: ModuleScanResult): Promise<void> {
    // 动态导入模块
    const moduleExports = await import(scanResult.filePath);
    const ModuleClass = moduleExports[scanResult.className];
    
    if (!ModuleClass) {
      return;
    }
    
    // 创建模块实例
    const moduleId = `${scanResult.moduleType}_${scanResult.className}_${Date.now()}`;
    const moduleInstance: ModuleInterface = new ModuleClass(
      moduleId,
      scanResult.className,
      scanResult.moduleType
    );
    
    // 验证模块接口
    if (!this._validateModuleInterface(moduleInstance)) {
      return;
    }
    
    // 创建注册信息
    const registration: ModuleRegistration = {
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
    this.modulesByType.get(scanResult.moduleType)!.push(registration);
  }
  
  /**
   * 验证模块接口
   */
  private _validateModuleInterface(module: any): boolean {
    const requiredMethods = [
      'getId', 'getName', 'getType', 'getVersion',
      'getStatus', 'getMetrics',
      'configure', 'start', 'stop', 'process',
      'healthCheck'
    ];
    
    return requiredMethods.every(method => typeof module[method] === 'function');
  }
}