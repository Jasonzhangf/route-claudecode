/**
 * Rule-Based Violation Detector
 * 
 * 基于规则的违规检测器实现
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ViolationDetectorInterface, ModuleInfo, ViolationInfo } from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';

export class RuleBasedViolationDetector implements ViolationDetectorInterface {
  private readonly config: ArchScannerConfig;

  constructor(config: ArchScannerConfig) {
    this.config = config;
  }

  private generateViolationId(): string {
    return `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async detectViolations(moduleInfo: ModuleInfo): Promise<ViolationInfo[]> {
    const violations: ViolationInfo[] = [];
    
    // RCC架构规则检查
    violations.push(...this.checkModuleInterfaceCompliance(moduleInfo));
    violations.push(...this.checkZeroInterfaceExposure(moduleInfo));
    violations.push(...this.checkTypeScriptCompliance(moduleInfo));
    violations.push(...this.checkNamingConventions(moduleInfo));
    violations.push(...this.checkImportRestrictions(moduleInfo));
    
    return violations;
  }

  async detectProjectViolations(modules: ModuleInfo[]): Promise<ViolationInfo[]> {
    const violations: ViolationInfo[] = [];
    
    // 项目级别的架构违规检查
    violations.push(...this.checkCrossModuleDependencies(modules));
    violations.push(...this.checkFallbackPolicyViolations(modules));
    violations.push(...this.checkModularityViolations(modules));
    violations.push(...this.checkDuplicateImplementations(modules));
    violations.push(...this.checkCrossModuleFunctionDuplication(modules));
    violations.push(...this.checkModuleInterfaceExposureViolations(modules));
    
    return violations;
  }

  private checkModuleInterfaceCompliance(moduleInfo: ModuleInfo): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 只检查RCC的12个核心模块，跳过内部实现文件
    const coreModuleTypes = [
      'client', 'router', 'pipeline', 'transformer', 'protocol', 
      'server-compatibility', 'server', 'config', 'auth', 'debug', 
      'middleware', 'types'
    ];
    
    // 只对核心模块的入口文件进行接口检查
    if (!coreModuleTypes.includes(moduleInfo.type)) {
      return violations; // 跳过非核心模块
    }
    
    // 检查是否是模块入口文件
    const fileName = moduleInfo.path.split('/').pop() || '';
    const isModuleEntry = fileName === 'index.ts' || 
                         fileName.includes('module.ts') ||
                         fileName.includes('-module.ts') ||
                         fileName.includes('manager.ts');
    
    if (!isModuleEntry) {
      return violations; // 跳过内部实现文件
    }
    
    // 检查是否实现了ModuleInterface或使用了SimpleModuleAdapter
    const hasModuleInterface = moduleInfo.implementations.some(impl => 
      impl.implements?.includes('ModuleInterface')
    );
    
    const hasModuleAdapter = moduleInfo.exports.some(exp => 
      exp.name.includes('ModuleAdapter') || exp.name.includes('moduleAdapter')
    );
    
    if (!hasModuleInterface && !hasModuleAdapter) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'MODULE_INTERFACE_REQUIRED',
        severity: 'critical',
        message: `Core module ${moduleInfo.type} entry file must implement ModuleInterface`,
        file: moduleInfo.path,
        line: 1,
        column: 1,
        context: {
          suggestion: `Add "implements ModuleInterface" to the main ${moduleInfo.type} module class or use SimpleModuleAdapter`
        }
      });
    }
    
    return violations;
  }

  private checkZeroInterfaceExposure(moduleInfo: ModuleInfo): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查是否暴露了不必要的接口
    const publicExports = moduleInfo.exports.filter(exp => 
      !exp.name.endsWith('Interface') && 
      !exp.name.endsWith('Config') &&
      !exp.name.endsWith('Types') &&
      exp.name !== 'default'
    );
    
    if (publicExports.length > 3 && moduleInfo.type !== 'types') {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'ZERO_INTERFACE_EXPOSURE',
        severity: 'major',
        message: `Module ${moduleInfo.name} exposes ${publicExports.length} public interfaces. Consider reducing exposure.`,
        file: moduleInfo.path,
        line: 1,
        column: 1,
        context: {
          suggestion: 'Follow zero interface exposure principle - only export essential interfaces'
        }
      });
    }
    
    return violations;
  }

  private checkTypeScriptCompliance(moduleInfo: ModuleInfo): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查文件扩展名
    if (!moduleInfo.path.endsWith('.ts') && !moduleInfo.path.endsWith('.tsx')) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'TYPESCRIPT_ONLY',
        severity: 'critical',
        message: `File ${moduleInfo.path} must be TypeScript (.ts/.tsx)`,
        file: moduleInfo.path,
        line: 1,
        column: 1,
        context: {
          suggestion: 'Convert to TypeScript and use .ts extension'
        }
      });
    }
    
    // 检查是否有any类型使用
    const hasAnyType = moduleInfo.implementations.some(impl =>
      impl.properties?.some((prop: any) => prop.type === 'any')
    );
    
    if (hasAnyType) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'NO_ANY_TYPE',
        severity: 'major',
        message: `Module ${moduleInfo.name} uses 'any' type. Use specific types instead.`,
        file: moduleInfo.path,
        line: 1,
        column: 1,
        context: {
          suggestion: 'Replace any types with specific interfaces or types'
        }
      });
    }
    
    return violations;
  }

  private checkNamingConventions(moduleInfo: ModuleInfo): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查类名命名规范
    for (const impl of moduleInfo.implementations) {
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(impl.name)) {
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'CLASS_NAMING_CONVENTION',
          severity: 'info',
          message: `Class ${impl.name} should use PascalCase naming`,
          file: moduleInfo.path,
          line: impl.line || 1,
          column: 1,
          context: {
            suggestion: 'Use PascalCase for class names (e.g., MyClassName)'
          }
        });
      }
    }
    
    // 检查接口名命名规范
    for (const intf of moduleInfo.interfaces) {
      if (!/^[A-Z][a-zA-Z0-9]*Interface$/.test(intf.name) && !intf.name.endsWith('Config') && !intf.name.endsWith('Types')) {
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'INTERFACE_NAMING_CONVENTION',
          severity: 'info',
          message: `Interface ${intf.name} should end with 'Interface'`,
          file: moduleInfo.path,
          line: intf.line || 1,
          column: 1,
          context: {
            suggestion: 'Add "Interface" suffix to interface names'
          }
        });
      }
    }
    
    return violations;
  }

  private checkImportRestrictions(moduleInfo: ModuleInfo): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查是否有禁止的导入
    const forbiddenImports = ['lodash', 'underscore', 'moment'];
    
    for (const importInfo of moduleInfo.imports) {
      if (forbiddenImports.includes(importInfo.source)) {
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'FORBIDDEN_IMPORT',
          severity: 'major',
          message: `Import of ${importInfo.source} is discouraged. Use native alternatives.`,
          file: moduleInfo.path,
          line: importInfo.line || 1,
          column: 1,
          context: {
            suggestion: `Replace ${importInfo.source} with native JavaScript/TypeScript alternatives`
          }
        });
      }
    }
    
    // 检查循环依赖
    const internalImports = moduleInfo.imports.filter(imp => imp.source.startsWith('.'));
    if (internalImports.length > 10) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'TOO_MANY_INTERNAL_IMPORTS',
        severity: 'major',
        message: `Module ${moduleInfo.name} has ${internalImports.length} internal imports. Consider refactoring.`,
        file: moduleInfo.path,
        line: 1,
        column: 1,
        context: {
          suggestion: 'Reduce internal dependencies by restructuring module boundaries'
        }
      });
    }
    
    return violations;
  }

  private checkCrossModuleDependencies(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 构建依赖图
    const dependencyMap = new Map<string, string[]>();
    
    for (const module of modules) {
      const dependencies = module.imports
        .filter(imp => imp.source.startsWith('.'))
        .map(imp => this.resolveModuleName(imp.source, module.path));
      dependencyMap.set(module.name, dependencies);
    }
    
    // 检查循环依赖
    for (const [moduleName, dependencies] of dependencyMap) {
      for (const dep of dependencies) {
        if (this.hasCircularDependency(moduleName, dep, dependencyMap)) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: 'CIRCULAR_DEPENDENCY',
            severity: 'critical',
            message: `Circular dependency detected between ${moduleName} and ${dep}`,
            file: modules.find(m => m.name === moduleName)?.path || '',
            line: 1,
            column: 1,
            context: {
              suggestion: 'Restructure modules to eliminate circular dependencies'
            }
          });
        }
      }
    }
    
    return violations;
  }

  private checkFallbackPolicyViolations(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查是否有跨Provider fallback代码
    for (const module of modules) {
      for (const impl of module.implementations) {
        if (impl.name.toLowerCase().includes('fallback') && 
            impl.methods?.some((method: any) => method.name.includes('crossProvider'))) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: 'ZERO_FALLBACK_POLICY',
            severity: 'critical',
            message: `Module ${module.name} contains cross-provider fallback logic, violating zero-fallback policy`,
            file: module.path,
            line: impl.line || 1,
            column: 1,
            context: {
              suggestion: 'Remove cross-provider fallback mechanisms. Use pipeline scheduling within same provider.'
            }
          });
        }
      }
    }
    
    return violations;
  }

  private checkModularityViolations(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查模块边界违规
    const coreModules = ['client', 'router', 'pipeline', 'transformer', 'protocol', 'server-compatibility', 'server', 'config', 'auth', 'debug', 'middleware'];
    
    for (const module of modules) {
      if (coreModules.includes(module.type)) {
        // 检查是否有跨边界的直接依赖
        const crossBoundaryImports = module.imports.filter(imp => {
          const targetType = this.inferModuleTypeFromPath(imp.source);
          return targetType && targetType !== module.type && coreModules.includes(targetType);
        });
        
        if (crossBoundaryImports.length > 2) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: 'MODULE_BOUNDARY_VIOLATION',
            severity: 'major',
            message: `Module ${module.name} has ${crossBoundaryImports.length} cross-boundary dependencies`,
            file: module.path,
            line: 1,
            column: 1,
            context: {
              suggestion: 'Use interfaces and dependency injection instead of direct cross-module imports'
            }
          });
        }
      }
    }
    
    return violations;
  }

  private checkDuplicateImplementations(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 检查重复的类名和接口名
    const classNames = new Map<string, ModuleInfo[]>();
    const interfaceNames = new Map<string, ModuleInfo[]>();
    
    for (const module of modules) {
      for (const impl of module.implementations) {
        if (!classNames.has(impl.name)) {
          classNames.set(impl.name, []);
        }
        classNames.get(impl.name)!.push(module);
      }
      
      for (const intf of module.interfaces) {
        if (!interfaceNames.has(intf.name)) {
          interfaceNames.set(intf.name, []);
        }
        interfaceNames.get(intf.name)!.push(module);
      }
    }
    
    // 检查重复的类
    for (const [className, moduleList] of classNames) {
      if (moduleList.length > 1) {
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'DUPLICATE_CLASS_NAME',
          severity: 'major',
          message: `Class ${className} is defined in ${moduleList.length} modules: ${moduleList.map(m => m.name).join(', ')}`,
          file: moduleList[0].path,
          line: 1,
          column: 1,
          context: {
            suggestion: 'Use unique class names or namespace them properly'
          }
        });
      }
    }
    
    return violations;
  }

  private resolveModuleName(importPath: string, currentPath: string): string {
    // 简化的模块名解析
    return importPath.replace(/^\.\.?\//, '').replace(/\.ts$/, '').replace(/[/\\]/g, '-');
  }

  private hasCircularDependency(moduleA: string, moduleB: string, dependencyMap: Map<string, string[]>): boolean {
    // 简化的循环依赖检查
    const visited = new Set<string>();
    
    const checkPath = (current: string, target: string): boolean => {
      if (visited.has(current)) return false;
      visited.add(current);
      
      const deps = dependencyMap.get(current) || [];
      if (deps.includes(target)) return true;
      
      return deps.some(dep => checkPath(dep, target));
    };
    
    return checkPath(moduleB, moduleA);
  }

  private inferModuleTypeFromPath(importPath: string): string | null {
    const pathLower = importPath.toLowerCase();
    
    if (pathLower.includes('client')) return 'client';
    if (pathLower.includes('router')) return 'router';
    if (pathLower.includes('pipeline')) return 'pipeline';
    if (pathLower.includes('transformer')) return 'transformer';
    if (pathLower.includes('protocol')) return 'protocol';
    if (pathLower.includes('server-compatibility')) return 'server-compatibility';
    if (pathLower.includes('server')) return 'server';
    if (pathLower.includes('config')) return 'config';
    if (pathLower.includes('auth')) return 'auth';
    if (pathLower.includes('debug')) return 'debug';
    if (pathLower.includes('middleware')) return 'middleware';
    
    return null;
  }

  private checkCrossModuleFunctionDuplication(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 按模块类型分组，检查同类功能是否在多个模块中重复实现
    const functionsByModule = new Map<string, Map<string, ModuleInfo[]>>();
    
    // 收集所有模块的函数和方法
    for (const module of modules) {
      if (!functionsByModule.has(module.type)) {
        functionsByModule.set(module.type, new Map());
      }
      
      const moduleFunctions = functionsByModule.get(module.type)!;
      
      // 检查导出的函数
      for (const exportInfo of module.exports) {
        if (exportInfo.type === 'function') {
          if (!moduleFunctions.has(exportInfo.name)) {
            moduleFunctions.set(exportInfo.name, []);
          }
          moduleFunctions.get(exportInfo.name)!.push(module);
        }
      }
      
      // 检查类中的方法
      for (const impl of module.implementations) {
        for (const method of impl.methods || []) {
          const methodKey = `${impl.name}.${method.name}`;
          if (!moduleFunctions.has(methodKey)) {
            moduleFunctions.set(methodKey, []);
          }
          moduleFunctions.get(methodKey)!.push(module);
        }
      }
    }
    
    // 检查跨模块的功能重复
    const allFunctions = new Map<string, ModuleInfo[]>();
    
    for (const [moduleType, functions] of functionsByModule) {
      for (const [funcName, moduleList] of functions) {
        // 检查相似功能名称（可能的重复实现）
        const normalizedName = this.normalizeFunctionName(funcName);
        
        if (!allFunctions.has(normalizedName)) {
          allFunctions.set(normalizedName, []);
        }
        allFunctions.get(normalizedName)!.push(...moduleList);
      }
    }
    
    // 检测跨模块的功能重复
    for (const [funcName, moduleList] of allFunctions) {
      const uniqueModules = new Map<string, ModuleInfo[]>();
      
      for (const module of moduleList) {
        const key = `${module.type}:${module.name}`;
        if (!uniqueModules.has(key)) {
          uniqueModules.set(key, []);
        }
        uniqueModules.get(key)!.push(module);
      }
      
      // 如果同一功能在多个不同模块类型中实现
      const moduleTypes = new Set(moduleList.map(m => m.type));
      if (moduleTypes.size > 1 && moduleList.length > 2) {
        const involvedTypes = Array.from(moduleTypes).join(', ');
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'CROSS_MODULE_FUNCTION_DUPLICATION',
          severity: 'major',
          message: `Function '${funcName}' appears to be duplicated across modules: ${involvedTypes}`,
          file: moduleList[0].path,
          line: 1,
          column: 1,
          context: {
            suggestion: 'Consolidate duplicate functionality into a single responsible module or create shared utility'
          }
        });
      }
    }
    
    return violations;
  }

  private checkModuleInterfaceExposureViolations(modules: ModuleInfo[]): ViolationInfo[] {
    const violations: ViolationInfo[] = [];
    
    // 按模块分组检查不合理的接口暴露
    const modulesByType = new Map<string, ModuleInfo[]>();
    
    for (const module of modules) {
      if (!modulesByType.has(module.type)) {
        modulesByType.set(module.type, []);
      }
      modulesByType.get(module.type)!.push(module);
    }
    
    // 检查每个模块类型的接口暴露问题
    for (const [moduleType, moduleList] of modulesByType) {
      // 跳过非核心模块
      if (moduleType === 'unknown' || moduleType === 'types') continue;
      
      // 收集该模块类型的所有导出
      const allExports = new Set<string>();
      const exportSources = new Map<string, string[]>();
      
      for (const module of moduleList) {
        for (const exportInfo of module.exports) {
          allExports.add(exportInfo.name);
          
          if (!exportSources.has(exportInfo.name)) {
            exportSources.set(exportInfo.name, []);
          }
          exportSources.get(exportInfo.name)!.push(module.path);
        }
      }
      
      // 检查是否有过多的公开接口（违反零接口暴露原则）
      const publicExports = Array.from(allExports).filter(name => 
        !name.startsWith('_') && // 私有约定
        !name.endsWith('Internal') && // 内部实现标记
        !name.endsWith('Private') && // 私有标记
        name !== 'default' // 默认导出
      );
      
      if (publicExports.length > 3) {
        violations.push({
          id: this.generateViolationId(),
          ruleId: 'EXCESSIVE_PUBLIC_INTERFACE_EXPOSURE',
          severity: 'major',
          message: `Module ${moduleType} exposes ${publicExports.length} public interfaces, violating zero-exposure principle`,
          file: moduleList[0].path,
          line: 1,
          column: 1,
          context: {
            suggestion: `Reduce public interface exposure. Consider making internal APIs private or consolidating functionality. Current exports: ${publicExports.slice(0, 5).join(', ')}${publicExports.length > 5 ? '...' : ''}`
          }
        });
      }
      
      // 检查重复导出（同一功能从多个文件导出）
      for (const [exportName, sources] of exportSources) {
        if (sources.length > 1) {
          violations.push({
            id: this.generateViolationId(),
            ruleId: 'DUPLICATE_MODULE_EXPORT',
            severity: 'major',
            message: `Export '${exportName}' is duplicated across ${sources.length} files in ${moduleType} module`,
            file: sources[0],
            line: 1,
            column: 1,
            context: {
              suggestion: `Consolidate '${exportName}' export to a single authoritative source. Currently exported from: ${sources.map(s => s.split('/').pop()).join(', ')}`
            }
          });
        }
      }
      
      // 检查是否有内部实现意外暴露
      for (const module of moduleList) {
        for (const exportInfo of module.exports) {
          // 检查是否暴露了内部实现细节
          if (exportInfo.name.includes('Internal') || 
              exportInfo.name.includes('Helper') ||
              exportInfo.name.includes('Util') ||
              exportInfo.name.startsWith('_')) {
            
            violations.push({
              id: this.generateViolationId(),
              ruleId: 'INTERNAL_IMPLEMENTATION_EXPOSED',
              severity: 'minor',
              message: `Module ${moduleType} inappropriately exposes internal implementation '${exportInfo.name}'`,
              file: module.path,
              line: exportInfo.line || 1,
              column: 1,
              context: {
                suggestion: `Make '${exportInfo.name}' private or move to internal utilities. Internal implementations should not be part of public module API.`
              }
            });
          }
        }
      }
    }
    
    return violations;
  }

  private normalizeFunctionName(funcName: string): string {
    // 标准化函数名，用于检测相似功能
    return funcName
      .toLowerCase()
      .replace(/[_-]/g, '')
      .replace(/^(get|set|create|make|build|init|setup)/, '') // 移除常见前缀
      .replace(/(manager|handler|processor|service)$/, ''); // 移除常见后缀
  }
}