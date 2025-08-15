/**
 * 模块隔离管理器
 * 
 * 确保模块间的正确隔离，防止违反单一职责原则和跨模块直接访问
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';

/**
 * 模块类型定义
 */
export enum ModuleType {
  CORE = 'core',
  CONFIG = 'config',
  HEALTH = 'health',
  SECURITY = 'security',
  PIPELINE = 'pipeline',
  DEBUG = 'debug',
  CLI = 'cli',
  SERVER = 'server',
  ROUTES = 'routes'
}

/**
 * 模块接口规范
 */
export interface ModuleInterface {
  readonly id: string;
  readonly name: string;
  readonly type: ModuleType;
  readonly version: string;
  readonly dependencies: string[];
  readonly exports: string[];
}

/**
 * 模块访问规则
 */
export interface ModuleAccessRule {
  from: ModuleType;
  to: ModuleType;
  allowed: boolean;
  reason?: string;
  conditions?: string[];
}

/**
 * 依赖违规记录
 */
export interface DependencyViolation {
  id: string;
  timestamp: Date;
  fromModule: string;
  toModule: string;
  violation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stackTrace?: string;
}

/**
 * 模块隔离管理器实现
 */
export class ModuleIsolationManager extends EventEmitter {
  private registeredModules = new Map<string, ModuleInterface>();
  private accessRules: ModuleAccessRule[] = [];
  private violations: DependencyViolation[] = [];
  private moduleGraph = new Map<string, Set<string>>();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认访问规则
   */
  private initializeDefaultRules(): void {
    // 定义模块间允许的访问关系
    const defaultRules: ModuleAccessRule[] = [
      // CORE 模块可以被所有模块访问
      { from: ModuleType.CONFIG, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.HEALTH, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.SECURITY, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.PIPELINE, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.DEBUG, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.CLI, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.SERVER, to: ModuleType.CORE, allowed: true },
      { from: ModuleType.ROUTES, to: ModuleType.CORE, allowed: true },

      // SECURITY 模块可以被大多数模块访问
      { from: ModuleType.CONFIG, to: ModuleType.SECURITY, allowed: true },
      { from: ModuleType.SERVER, to: ModuleType.SECURITY, allowed: true },
      { from: ModuleType.ROUTES, to: ModuleType.SECURITY, allowed: true },
      { from: ModuleType.CLI, to: ModuleType.SECURITY, allowed: true },

      // CONFIG 模块可以被需要配置的模块访问
      { from: ModuleType.HEALTH, to: ModuleType.CONFIG, allowed: true },
      { from: ModuleType.SERVER, to: ModuleType.CONFIG, allowed: true },
      { from: ModuleType.CLI, to: ModuleType.CONFIG, allowed: true },
      { from: ModuleType.DEBUG, to: ModuleType.CONFIG, allowed: true },

      // 禁止的跨模块访问
      { from: ModuleType.CONFIG, to: ModuleType.HEALTH, allowed: false, reason: 'Config should not depend on health' },
      { from: ModuleType.CONFIG, to: ModuleType.DEBUG, allowed: false, reason: 'Config should not depend on debug' },
      { from: ModuleType.HEALTH, to: ModuleType.CONFIG, allowed: false, reason: 'Health should not directly depend on config' },
      { from: ModuleType.DEBUG, to: ModuleType.HEALTH, allowed: false, reason: 'Debug should not depend on health' },
      
      // SERVER 和 ROUTES 的隔离
      { from: ModuleType.ROUTES, to: ModuleType.SERVER, allowed: false, reason: 'Routes should not access server internals' },
      
      // PIPELINE 隔离
      { from: ModuleType.CONFIG, to: ModuleType.PIPELINE, allowed: false, reason: 'Config should not depend on pipeline' }
    ];

    this.accessRules = defaultRules;
  }

  /**
   * 注册模块
   */
  registerModule(module: ModuleInterface): void {
    if (this.registeredModules.has(module.id)) {
      throw new Error(`Module ${module.id} is already registered`);
    }

    // 验证模块依赖
    this.validateModuleDependencies(module);

    this.registeredModules.set(module.id, module);
    this.updateModuleGraph(module);

    this.emit('module-registered', module);
    console.log(`✅ Module registered: ${module.id} (${module.type})`);
  }

  /**
   * 检查模块访问权限
   */
  checkModuleAccess(fromModuleId: string, toModuleId: string): boolean {
    const fromModule = this.registeredModules.get(fromModuleId);
    const toModule = this.registeredModules.get(toModuleId);

    if (!fromModule || !toModule) {
      this.recordViolation({
        fromModule: fromModuleId,
        toModule: toModuleId,
        violation: 'Access to unregistered module',
        severity: 'high'
      });
      return false;
    }

    // 检查访问规则
    const rule = this.findAccessRule(fromModule.type, toModule.type);
    
    if (rule && !rule.allowed) {
      this.recordViolation({
        fromModule: fromModuleId,
        toModule: toModuleId,
        violation: `Access denied: ${rule.reason || 'Violates module isolation'}`,
        severity: 'high'
      });
      return false;
    }

    // 如果没有明确规则，默认检查是否形成循环依赖
    if (!rule) {
      const wouldCreateCycle = this.wouldCreateCycle(fromModuleId, toModuleId);
      if (wouldCreateCycle) {
        this.recordViolation({
          fromModule: fromModuleId,
          toModule: toModuleId,
          violation: 'Would create circular dependency',
          severity: 'critical'
        });
        return false;
      }
    }

    return true;
  }

  /**
   * 验证模块依赖
   */
  private validateModuleDependencies(module: ModuleInterface): void {
    for (const depId of module.dependencies) {
      const dependency = this.registeredModules.get(depId);
      
      if (!dependency) {
        console.warn(`⚠️ Module ${module.id} depends on unregistered module: ${depId}`);
        continue;
      }

      // 检查是否违反访问规则
      if (!this.checkModuleAccess(module.id, depId)) {
        throw new Error(`Module ${module.id} cannot depend on ${depId}: violates access rules`);
      }
    }
  }

  /**
   * 更新模块依赖图
   */
  private updateModuleGraph(module: ModuleInterface): void {
    if (!this.moduleGraph.has(module.id)) {
      this.moduleGraph.set(module.id, new Set());
    }

    const dependencies = this.moduleGraph.get(module.id)!;
    for (const depId of module.dependencies) {
      dependencies.add(depId);
    }
  }

  /**
   * 检查是否会创建循环依赖
   */
  private wouldCreateCycle(fromId: string, toId: string): boolean {
    if (fromId === toId) {
      return true;
    }

    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);

      if (current === fromId) {
        return true;
      }

      const dependencies = this.moduleGraph.get(current);
      if (dependencies) {
        for (const dep of dependencies) {
          stack.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * 查找访问规则
   */
  private findAccessRule(fromType: ModuleType, toType: ModuleType): ModuleAccessRule | undefined {
    return this.accessRules.find(rule => rule.from === fromType && rule.to === toType);
  }

  /**
   * 记录违规
   */
  private recordViolation(violation: Omit<DependencyViolation, 'id' | 'timestamp'>): void {
    const fullViolation: DependencyViolation = {
      id: this.generateViolationId(),
      timestamp: new Date(),
      stackTrace: this.captureStackTrace(),
      ...violation
    };

    this.violations.push(fullViolation);

    // 保持违规记录在合理范围内
    if (this.violations.length > 1000) {
      this.violations.splice(0, this.violations.length - 1000);
    }

    this.emit('dependency-violation', fullViolation);

    // 输出高严重性违规的警告
    if (violation.severity === 'high' || violation.severity === 'critical') {
      console.error(`🚨 Module Isolation Violation [${violation.severity.toUpperCase()}]:`, {
        from: violation.fromModule,
        to: violation.toModule,
        violation: violation.violation
      });
    }
  }

  /**
   * 添加访问规则
   */
  addAccessRule(rule: ModuleAccessRule): void {
    // 检查是否已存在相同规则
    const existingRule = this.findAccessRule(rule.from, rule.to);
    if (existingRule) {
      // 更新现有规则
      Object.assign(existingRule, rule);
    } else {
      this.accessRules.push(rule);
    }

    this.emit('access-rule-added', rule);
  }

  /**
   * 获取违规报告
   */
  getViolationReport(): {
    totalViolations: number;
    severityBreakdown: Record<string, number>;
    moduleViolations: Record<string, number>;
    recentViolations: DependencyViolation[];
  } {
    const severityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
    const moduleViolations: Record<string, number> = {};

    for (const violation of this.violations) {
      severityBreakdown[violation.severity]++;
      
      const key = `${violation.fromModule} -> ${violation.toModule}`;
      moduleViolations[key] = (moduleViolations[key] || 0) + 1;
    }

    return {
      totalViolations: this.violations.length,
      severityBreakdown,
      moduleViolations,
      recentViolations: this.violations.slice(-10)
    };
  }

  /**
   * 获取模块依赖图
   */
  getModuleDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [moduleId, dependencies] of this.moduleGraph) {
      graph[moduleId] = Array.from(dependencies);
    }

    return graph;
  }

  /**
   * 验证整个模块图的完整性
   */
  validateModuleGraph(): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 检查循环依赖
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      issues.push(`Found ${cycles.length} circular dependencies`);
      suggestions.push('Break circular dependencies by introducing interfaces or dependency injection');
    }

    // 检查孤立模块
    const orphanedModules = this.findOrphanedModules();
    if (orphanedModules.length > 0) {
      issues.push(`Found ${orphanedModules.length} orphaned modules`);
      suggestions.push('Consider removing unused modules or integrating them properly');
    }

    // 检查过度依赖
    const overDependentModules = this.findOverDependentModules();
    if (overDependentModules.length > 0) {
      issues.push(`Found ${overDependentModules.length} modules with too many dependencies`);
      suggestions.push('Consider breaking down large modules into smaller, focused modules');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * 检测循环依赖
   */
  private detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (moduleId: string, path: string[]): void => {
      if (visiting.has(moduleId)) {
        // 找到循环
        const cycleStart = path.indexOf(moduleId);
        cycles.push(path.slice(cycleStart).concat(moduleId));
        return;
      }

      if (visited.has(moduleId)) {
        return;
      }

      visiting.add(moduleId);
      const dependencies = this.moduleGraph.get(moduleId);
      
      if (dependencies) {
        for (const dep of dependencies) {
          dfs(dep, path.concat(moduleId));
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
    };

    for (const moduleId of this.moduleGraph.keys()) {
      if (!visited.has(moduleId)) {
        dfs(moduleId, []);
      }
    }

    return cycles;
  }

  /**
   * 查找孤立模块
   */
  private findOrphanedModules(): string[] {
    const referenced = new Set<string>();
    
    for (const dependencies of this.moduleGraph.values()) {
      for (const dep of dependencies) {
        referenced.add(dep);
      }
    }

    const orphaned: string[] = [];
    for (const moduleId of this.registeredModules.keys()) {
      if (!referenced.has(moduleId) && this.moduleGraph.get(moduleId)?.size === 0) {
        orphaned.push(moduleId);
      }
    }

    return orphaned;
  }

  /**
   * 查找过度依赖的模块
   */
  private findOverDependentModules(): string[] {
    const overDependent: string[] = [];
    
    for (const [moduleId, dependencies] of this.moduleGraph) {
      if (dependencies.size > 5) { // 超过5个依赖被认为是过度依赖
        overDependent.push(moduleId);
      }
    }

    return overDependent;
  }

  /**
   * 捕获堆栈跟踪
   */
  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 6).join('\n') : 'Stack trace not available';
  }

  /**
   * 生成违规ID
   */
  private generateViolationId(): string {
    return `violation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    // 清理30天前的违规记录
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.violations = this.violations.filter(v => v.timestamp.getTime() > thirtyDaysAgo);
  }
}