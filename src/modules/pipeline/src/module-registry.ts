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
import { SERVER_CONFIG_DEFAULTS, MODULE_REGISTRY_DEFAULTS } from '../../constants/src/bootstrap-constants';

/**
 * 认证方法枚举
 */
export enum AuthMethod {
  OPENAI = 'openai',
  BEARER = 'bearer'
}

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
      // 扫描编译后的JavaScript文件目录，因为运行时无法动态导入TypeScript文件
      const distDir = path.resolve(process.cwd(), 'dist/modules/pipeline-modules');
      this.scanPaths = [
        path.join(distDir, 'transformers'),
        path.join(distDir, 'protocol'),  
        path.join(distDir, 'server-compatibility'),
        path.join(distDir, 'server')
      ];
      
      // Debug: 输出扫描路径以便调试
      console.log(`🔍 ModuleRegistry扫描路径调试:`);
      console.log(`   - distDir: ${distDir}`);
      console.log(`   - scanPaths: ${JSON.stringify(this.scanPaths, null, 2)}`);
      
      // 验证路径是否存在
      this.scanPaths.forEach((scanPath, index) => {
        const exists = fs.existsSync(scanPath);
        console.log(`   - scanPaths[${index}] 存在: ${exists} (${scanPath})`);
      });
    }
    
    const scanResults: ModuleScanResult[] = [];
    
    // 扫描每个路径
    console.log(`🔍 开始扫描 ${this.scanPaths.length} 个路径...`);
    for (const scanPath of this.scanPaths) {
      console.log(`📁 扫描路径: ${scanPath}`);
      if (fs.existsSync(scanPath)) {
        console.log(`✅ 路径存在，开始扫描文件...`);
        const results = await this._scanDirectory(scanPath);
        console.log(`📄 在路径 ${scanPath} 中找到 ${results.length} 个候选文件`);
        scanResults.push(...results);
      } else {
        console.log(`❌ 路径不存在: ${scanPath}`);
      }
    }
    
    // 注册有效的模块
    console.log(`🔧 处理扫描结果: 总共找到 ${scanResults.length} 个候选文件`);
    let validCount = 0;
    let invalidCount = 0;
    
    for (const result of scanResults) {
      console.log(`📋 处理文件: ${result.filePath}`);
      console.log(`   - 类名: ${result.className}`);
      console.log(`   - 模块类型: ${result.moduleType}`);
      console.log(`   - 是否有效: ${result.isValid}`);
      if (result.error) {
        console.log(`   - 错误: ${result.error}`);
      }
      
      if (result.isValid) {
        try {
          await this._registerModuleFromFile(result);
          validCount++;
          console.log(`✅ 成功注册模块: ${result.className}`);
        } catch (error) {
          console.error(`❌ 注册模块失败 ${result.className}:`, error.message);
          invalidCount++;
        }
      } else {
        invalidCount++;
        console.log(`⏭️ 跳过无效模块: ${result.className}`);
      }
    }
    
    const scanTime = Date.now() - startTime;
    console.log(`🏁 模块扫描完成 - 耗时: ${scanTime}ms`);
    console.log(`📊 扫描统计: 有效=${validCount}, 无效=${invalidCount}, 总计=${scanResults.length}`);
    
    // 详细的最终统计
    console.log(`📊 最终注册统计:`);
    console.log(`   - 总注册模块数: ${this.registeredModules.size}`);
    console.log(`   - 注册表内容:`, Array.from(this.registeredModules.keys()));
    
    console.log(`📊 按类型分组统计:`);
    for (const [type, modules] of this.modulesByType) {
      console.log(`   - ${type}: ${modules.length} 个模块`);
      if (modules.length > 0) {
        console.log(`     模块列表: ${modules.map(m => m.name).join(', ')}`);
      }
    }
    
    // 输出每个已注册模块的详细信息
    if (this.registeredModules.size > 0) {
      console.log(`📋 已注册模块详细信息:`);
      for (const [id, registration] of this.registeredModules) {
        console.log(`   - 模块ID: ${id}`);
        console.log(`     名称: ${registration.name}`);
        console.log(`     类型: ${registration.type}`);
        console.log(`     文件路径: ${registration.filePath}`);
        console.log(`     类名: ${registration.className}`);
        console.log(`     是否活跃: ${registration.isActive}`);
        console.log(`     注册时间: ${registration.registeredAt}`);
        console.log(`     有工厂信息: ${!!(registration as any)._factoryInfo}`);
        console.log('');
      }
    } else {
      console.log(`⚠️ 警告: 没有任何模块被成功注册！`);
    }
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
   * 创建带配置的模块实例
   */
  async createModuleInstance(registration: any, config?: any): Promise<ModuleInterface> {
    if (registration.module && typeof registration.module.getId === 'function') {
      // 已经实例化过了
      return registration.module;
    }

    const factoryInfo = (registration as any)._factoryInfo;
    if (!factoryInfo) {
      throw new Error(`No factory info for module: ${registration.id}`);
    }

    const { ModuleClass, scanResult } = factoryInfo;
    
    // 根据模块类型创建不同的实例
    let moduleInstance: ModuleInterface;
    
    if (scanResult.moduleType === ModuleType.SERVER && config) {
      // Server模块需要特殊的配置格式 - 修复API Key配置桥接问题
      const defaults = MODULE_REGISTRY_DEFAULTS.SERVER_MODULE;
      const fieldMappings = SERVER_CONFIG_DEFAULTS.FIELD_MAPPINGS;
      
      const serverConfig = {
        // 修复字段映射：pipeline配置使用'endpoint'，OpenAI SDK需要'baseURL'
        baseURL: config[fieldMappings.ENDPOINT_FIELD] || config[fieldMappings.BASE_URL_FIELD] || config[fieldMappings.API_BASE_URL_FIELD],
        // 确保API Key正确传递
        apiKey: config[fieldMappings.API_KEY_FIELD] || config[fieldMappings.API_KEY_ALT_FIELD],
        // 可选字段，支持向后兼容
        organization: config.organization,
        project: config.project,
        timeout: config.timeout || defaults.TIMEOUT,
        maxRetries: config.maxRetries || defaults.MAX_RETRIES,
        retryDelay: config.retryDelay || defaults.RETRY_DELAY,
        skipAuthentication: config.skipAuthentication || defaults.SKIP_AUTHENTICATION,
        // 支持多Key认证配置
        multiKeyAuth: config.multiKeyAuth || undefined,
        // OAuth认证支持
        authMethod: undefined as any, // 将在下面设置
        customHeaders: undefined as any, // 将在下面设置
        // 双向处理配置
        enableResponseValidation: config.enableResponseValidation !== false ? defaults.ENABLE_RESPONSE_VALIDATION : false,
        requestTimeoutMs: config.requestTimeoutMs || config.timeout || defaults.REQUEST_TIMEOUT_MS,
        maxConcurrentRequests: config.maxConcurrentRequests || defaults.MAX_CONCURRENT_REQUESTS
      };
      
      // REFACTORED: 组装阶段跳过认证方法检测，使用默认配置
      // 认证方法检测和验证延迟到运行时或SelfCheckModule处理
      console.log(`🏭 [ASSEMBLY] Server模块组装 - 跳过认证检测，使用基础配置`);
      
      // 设置基础认证方法，不进行网络验证
      serverConfig.authMethod = config.authMethod || 'openai'; // 使用配置或默认值
      
      // 组装阶段设置跳过认证标志
      serverConfig.skipAuthentication = true; // 强制跳过组装阶段的认证
      
      // REFACTORED: 组装阶段移除Provider特定配置逻辑
      // Provider特定的头部和端点配置延迟到运行时处理
      console.log(`🏭 [ASSEMBLY] 跳过Provider特定配置 - 运行时将根据需要设置`);

      // 调试日志：记录Server模块组装配置（移除认证信息）
      console.log(`🔧 [ASSEMBLY] 创建Server模块实例 (${registration.name}):`, {
        baseURL: serverConfig.baseURL || 'default',
        timeout: serverConfig.timeout,
        maxRetries: serverConfig.maxRetries,
        provider: config.provider,
        skipAuthentication: serverConfig.skipAuthentication
      });
      
      console.log(`🔍 [DEBUG] 完整serverConfig:`, JSON.stringify(serverConfig, null, 2));
      
      // 组装阶段创建轻量级服务器模块实例
      console.log(`🏭 [ASSEMBLY] Server模块组装阶段 - 轻量级实例化`);
      
      // 创建服务器模块实例，跳过认证和网络验证
      moduleInstance = new ModuleClass(serverConfig);
    } else {
      // 其他模块使用标准构造函数
      moduleInstance = new ModuleClass(
        registration.id,
        registration.name,
        scanResult.moduleType
      );
    }
    
    // 验证模块接口
    if (!this._validateModuleInterface(moduleInstance)) {
      throw new Error(`Module does not implement required interface: ${registration.name}`);
    }
    
    // 更新注册信息
    registration.module = moduleInstance;
    registration.version = moduleInstance.getVersion();
    
    return moduleInstance;
  }
  
  /**
   * 扫描目录中的模块文件
   */
  private async _scanDirectory(dirPath: string): Promise<ModuleScanResult[]> {
    const results: ModuleScanResult[] = [];
    
    console.log(`📂 开始扫描目录: ${dirPath}`);
    
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️ 目录不存在: ${dirPath}`);
      return results;
    }
    
    console.log(`✅ 目录存在，读取文件列表...`);
    
    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      console.log(`📄 目录中有 ${files.length} 个文件/子目录:`);
      
      // 列出所有文件/目录
      files.forEach((file, index) => {
        const type = file.isDirectory() ? '📁目录' : '📄文件';
        console.log(`   ${index + 1}. ${type}: ${file.name}`);
      });
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        console.log(`\n🔍 处理: ${file.name}`);
        console.log(`   完整路径: ${fullPath}`);
        console.log(`   是否为目录: ${file.isDirectory()}`);
        
        if (file.isDirectory()) {
          console.log(`📁 进入子目录: ${file.name}`);
          // 递归扫描子目录
          const subResults = await this._scanDirectory(fullPath);
          console.log(`📊 子目录 ${file.name} 返回 ${subResults.length} 个结果`);
          results.push(...subResults);
        } else {
          console.log(`📄 文件检查: ${file.name}`);
          console.log(`   - 以'.ts'结尾: ${file.name.endsWith('.ts')}`);
          console.log(`   - 不以'.test.ts'结尾: ${!file.name.endsWith('.test.ts')}`);
          console.log(`   - 不以'.d.ts'结尾: ${!file.name.endsWith('.d.ts')}`);
          
          const isTypeScriptFile = file.name.endsWith('.ts') && !file.name.endsWith('.test.ts') && !file.name.endsWith('.d.ts');
          const isJavaScriptFile = file.name.endsWith('.js') && !file.name.endsWith('.test.js');
          const isValidModuleFile = isTypeScriptFile || isJavaScriptFile;
          console.log(`   - 符合TypeScript文件条件: ${isTypeScriptFile}`);
          console.log(`   - 符合JavaScript文件条件: ${isJavaScriptFile}`);
          console.log(`   - 符合模块文件条件: ${isValidModuleFile}`);
          
          if (isValidModuleFile) {
            const fileType = isTypeScriptFile ? 'TypeScript' : 'JavaScript';
            console.log(`🔍 扫描${fileType}文件: ${file.name}`);
            // 扫描TypeScript或JavaScript文件
            const scanResult = await this._scanModuleFile(fullPath);
            if (scanResult) {
              console.log(`✅ 找到有效候选模块: ${scanResult.className} (${scanResult.moduleType})`);
              console.log(`   - 有效性: ${scanResult.isValid}`);
              console.log(`   - 错误信息: ${scanResult.error || '无'}`);
              results.push(scanResult);
            } else {
              console.log(`⏭️ 跳过文件: ${file.name} (扫描结果为null)`);
            }
          } else {
            console.log(`⏭️ 跳过文件: ${file.name} (不符合TypeScript文件条件)`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ 扫描目录失败 ${dirPath}:`, error);
      console.error(`   - 错误消息:`, error.message);
      console.error(`   - 错误堆栈:`, error.stack);
    }
    
    console.log(`\n📊 目录 ${dirPath} 扫描完成`);
    console.log(`   - 找到的候选模块数: ${results.length}`);
    if (results.length > 0) {
      console.log(`   - 候选模块列表:`);
      results.forEach((result, index) => {
        console.log(`     ${index + 1}. ${result.className} (${result.moduleType}) - 有效: ${result.isValid}`);
      });
    }
    
    return results;
  }
  
  /**
   * 扫描单个模块文件
   */
  private async _scanModuleFile(filePath: string): Promise<ModuleScanResult | null> {
    console.log(`🔎 分析文件: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${filePath}`);
      return null;
    }
    
    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log(`📄 文件大小: ${content.length} 字符`);
      console.log(`📄 文件前200字符: ${content.substring(0, 200)}...`);
      
      // 检查是否包含模块导出，查找所有导出的类
      const classMatches = content.match(/export\s+class\s+(\w+)/g);
      if (!classMatches) {
        console.log(`⏭️ 跳过文件: 没有找到导出的类`);
        console.log(`   - 查找模式: /export\\s+class\\s+(\\w+)/g`);
        return null;
      }
      
      // 提取所有类名
      const classNames = classMatches.map(match => {
        const nameMatch = match.match(/export\s+class\s+(\w+)/);
        return nameMatch ? nameMatch[1] : null;
      }).filter(name => name !== null);
      
      console.log(`🏷️ 找到类: ${classNames.join(', ')}`);
      
      // 过滤掉非模块类：错误类、工厂类、辅助类等
      const excludedClassPatterns = [
        /Error$/,           // *Error类 (如TransformerSecurityError)
        /Exception$/,       // *Exception类
        /Factory$/,         // *Factory类
        /Helper$/,          // *Helper类
        /Util$/,            // *Util类
        /Utils$/,           // *Utils类
        /Handler$/,         // *Handler类（非模块的处理器）
        /Manager$/,         // *Manager类（非模块的管理器）
        /Config$/,          // *Config类
        /Validation$/,      // *Validation类
      ];
      
      // 找到第一个不被排除的类作为模块类
      let className: string | null = null;
      for (const name of classNames) {
        const isExcluded = excludedClassPatterns.some(pattern => pattern.test(name));
        console.log(`   - 检查类 ${name}: ${isExcluded ? '排除' : '接受'}`);
        if (!isExcluded) {
          className = name;
          break;
        }
      }
      
      if (!className) {
        console.log(`⏭️ 跳过文件: 所有导出的类都被排除`);
        console.log(`   - 所有类: ${classNames.join(', ')}`);
        return null;
      }
      
      console.log(`✅ 选择模块类: ${className}`);
      const isExcluded = false; // 因为已经选择了有效的类
      const matchedExclusions: RegExp[] = []; // 没有匹配的排除模式
      if (isExcluded) {
        console.log(`⏭️ 跳过类 ${className}: 是排除的类型`);
        console.log(`   - 匹配的排除模式:`, matchedExclusions.map(p => p.toString()));
        return null;
      }
      
      // 确定模块类型
      let moduleType: ModuleType;
      console.log(`🔍 模块类型检测，文件路径: ${filePath}`);
      console.log(`   - 包含'transformer': ${filePath.includes('transformer')}`);
      console.log(`   - 包含'protocol': ${filePath.includes('protocol')}`);
      console.log(`   - 包含'server-compatibility': ${filePath.includes('server-compatibility')}`);
      console.log(`   - 包含'server': ${filePath.includes('server')}`);
      
      if (filePath.includes('transformer')) {
        moduleType = ModuleType.TRANSFORMER;
      } else if (filePath.includes('protocol')) {
        moduleType = ModuleType.PROTOCOL;
      } else if (filePath.includes('server-compatibility')) {
        moduleType = ModuleType.SERVER_COMPATIBILITY;
      } else if (filePath.includes('server')) {
        moduleType = ModuleType.SERVER;
      } else {
        console.log(`⏭️ 跳过文件: 无法确定模块类型 (路径: ${filePath})`);
        console.log(`   - 文件路径段:`, filePath.split('/'));
        return null;
      }
      
      console.log(`🏷️ 确定的模块类型: ${moduleType}`);
      
      // 检查是否实现了ModuleInterface - 详细分析
      console.log(`🔍 开始接口检查...`);
      const hasModuleInterface = content.includes('ModuleInterface');
      const hasBasePipelineModule = content.includes('BasePipelineModule');
      
      console.log(`🔍 接口关键词检查:`);
      console.log(`   - 'ModuleInterface': ${hasModuleInterface}`);
      console.log(`   - 'BasePipelineModule': ${hasBasePipelineModule}`);
      
      // 更详细的接口检查
      const importStatements = content.match(/import.*{[^}]*(?:ModuleInterface|BasePipelineModule)[^}]*}.*from/g);
      const implementsStatements = content.match(/class\s+\w+.*implements\s+[^{]*(?:ModuleInterface|BasePipelineModule)/g);
      const extendsStatements = content.match(/class\s+\w+.*extends\s+[^{]*(?:BasePipelineModule)/g);
      
      console.log(`🔍 接口实现检查:`);
      console.log(`   - Import语句:`, importStatements || ['未找到']);
      console.log(`   - Implements语句:`, implementsStatements || ['未找到']);
      console.log(`   - Extends语句:`, extendsStatements || ['未找到']);
      
      // 检查必需方法是否存在
      const requiredMethods = ['getId', 'getName', 'getType', 'getVersion', 'process'];
      const methodChecks = requiredMethods.map(method => ({
        method,
        found: content.includes(method)
      }));
      
      console.log(`🔍 必需方法检查:`);
      methodChecks.forEach(check => {
        console.log(`   - ${check.method}: ${check.found ? '✅' : '❌'}`);
      });
      
      const isValid = hasModuleInterface || hasBasePipelineModule;
      console.log(`✅ 模块有效性评估: ${isValid}`);
      console.log(`   - 基于接口检查: ${hasModuleInterface || hasBasePipelineModule}`);
      console.log(`   - 基于方法检查: ${methodChecks.filter(c => c.found).length}/${methodChecks.length} 个方法存在`);
      
      const result = {
        filePath,
        className,
        moduleType,
        isValid,
        error: isValid ? undefined : 'Module does not implement ModuleInterface or extend BasePipelineModule'
      };
      
      console.log(`📋 扫描结果:`, {
        filePath: result.filePath,
        className: result.className,
        moduleType: result.moduleType,
        isValid: result.isValid,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error(`❌ 扫描文件失败 ${filePath}:`, error.message);
      console.error(`   - 错误堆栈:`, error.stack);
      return null;
    }
  }
  
  /**
   * 从文件注册模块
   */
  private async _registerModuleFromFile(scanResult: ModuleScanResult): Promise<void> {
    console.log(`🔧 开始注册模块: ${scanResult.className}`);
    console.log(`   - 文件路径: ${scanResult.filePath}`);
    console.log(`   - 模块类型: ${scanResult.moduleType}`);
    console.log(`   - 是否有效: ${scanResult.isValid}`);
    
    try {
      // 动态导入模块
      console.log(`📥 动态导入模块文件: ${scanResult.filePath}`);
      const moduleExports = await import(scanResult.filePath);
      console.log(`✅ 成功导入模块，导出的内容:`, Object.keys(moduleExports));
      
      const ModuleClass = moduleExports[scanResult.className];
      console.log(`🏷️ 查找类 ${scanResult.className}:`, !!ModuleClass);
      console.log(`   - 类型: ${typeof ModuleClass}`);
      console.log(`   - 是否为函数: ${typeof ModuleClass === 'function'}`);
      console.log(`   - 原型链: ${ModuleClass?.prototype ? Object.getOwnPropertyNames(ModuleClass.prototype) : 'undefined'}`);
      
      if (!ModuleClass) {
        console.log(`❌ 在模块导出中找不到类 ${scanResult.className}`);
        console.log(`   可用的导出:`, Object.keys(moduleExports));
        return;
      }
      
      // 创建模块实例 - 延迟实例化以避免配置问题
      const moduleId = `${scanResult.moduleType}_${scanResult.className}_${Date.now()}`;
      console.log(`🆔 生成模块ID: ${moduleId}`);
      
      // 存储模块类和基本信息，而不是实例
      const moduleFactoryInfo = {
        ModuleClass,
        scanResult,
        moduleId
      };
      
      console.log(`🏭 创建工厂信息:`, {
        hasModuleClass: !!moduleFactoryInfo.ModuleClass,
        scanResultValid: !!moduleFactoryInfo.scanResult,
        moduleId: moduleFactoryInfo.moduleId
      });
      
      // 为延迟实例化创建临时注册信息
      const registration: ModuleRegistration = {
        id: moduleId,
        name: scanResult.className,
        type: scanResult.moduleType,
        version: '4.0.0', // 临时版本，实例化后会更新
        filePath: scanResult.filePath,
        className: scanResult.className,
        module: null as any, // 延迟实例化
        isActive: true,
        registeredAt: new Date(),
        // 添加工厂信息
        _factoryInfo: moduleFactoryInfo
      };
      
      console.log(`📋 创建注册信息:`, {
        id: registration.id,
        name: registration.name,
        type: registration.type,
        hasFactoryInfo: !!registration._factoryInfo
      });
      
      // 注册模块信息
      this.registeredModules.set(moduleId, registration);
      console.log(`✅ 模块已加入注册表，当前注册数量: ${this.registeredModules.size}`);
      
      const typeModules = this.modulesByType.get(scanResult.moduleType)!;
      typeModules.push(registration);
      console.log(`✅ 模块已加入类型分组，${scanResult.moduleType}类型当前数量: ${typeModules.length}`);
      
      console.log(`🎉 模块注册完成: ${scanResult.className} (ID: ${moduleId})`);
    } catch (error) {
      console.error(`❌ 注册模块时发生错误 ${scanResult.className}:`, error);
      console.error(`   - 错误消息:`, error.message);
      console.error(`   - 错误堆栈:`, error.stack);
      throw error;
    }
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

  /**
   * 自动检测认证方法
   * 根据API Key格式、提供商和端点URL判断使用哪种认证方法
   */
  private detectAuthMethod(apiKey?: string, provider?: string, endpoint?: string): string {
    // 如果没有API Key，默认使用OpenAI模式
    if (!apiKey) {
      return AuthMethod.OPENAI;
    }

    // 根据提供商名称判断
    if (provider) {
      const providerLower = provider.toLowerCase();
      if (['iflow', 'qwen', 'portkey'].includes(providerLower)) {
        return AuthMethod.BEARER;
      }
      if (['openai', 'azure', 'anthropic'].includes(providerLower)) {
        return AuthMethod.OPENAI;
      }
    }

    // 根据API Key格式判断 (sk-开头的通常是Bearer Token)
    if (apiKey.startsWith('sk-')) {
      return AuthMethod.BEARER;
    }

    // 根据端点URL判断
    if (endpoint) {
      const endpointLower = endpoint.toLowerCase();
      if (endpointLower.includes('qwen') || endpointLower.includes('portal.qwen')) {
        return AuthMethod.BEARER;
      }
      if (endpointLower.includes('iflow') || endpointLower.includes('apis.iflow')) {
        return AuthMethod.BEARER;
      }
      if (endpointLower.includes('portkey') || endpointLower.includes('portkey.ai')) {
        return AuthMethod.BEARER;
      }
      if (endpointLower.includes('openai') || endpointLower.includes('anthropic')) {
        return AuthMethod.OPENAI;
      }
    }

    // 默认使用OpenAI认证模式
    return AuthMethod.OPENAI;
  }

  /**
   * 创建提供商特定的请求头
   * 根据CLIProxyAPI的实现模式
   */
  private createProviderSpecificHeaders(provider: string, endpoint?: string): Record<string, string> {
    const providerLower = provider.toLowerCase();
    
    const headers: Record<string, string> = {
      'User-Agent': 'google-api-nodejs-client/9.15.1'
    };

    // iFlow 特定头部（基于CLIProxyAPI的qwen实现）
    if (providerLower === 'iflow' || endpoint?.toLowerCase().includes('iflow')) {
      headers['X-Goog-Api-Client'] = 'gl-node/22.17.0';
      headers['Client-Metadata'] = 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI';
      return headers;
    }

    // Qwen 特定头部
    if (providerLower === 'qwen' || endpoint?.toLowerCase().includes('qwen') || endpoint?.toLowerCase().includes('portal.qwen')) {
      headers['X-Goog-Api-Client'] = 'gl-node/22.17.0';
      headers['Client-Metadata'] = 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI';
      return headers;
    }

    return headers;
  }
}