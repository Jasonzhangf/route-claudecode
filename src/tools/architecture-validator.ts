/**
 * 架构合规性验证工具
 *
 * 自动检查RCC v4.0项目的模块化架构合规性
 * 验证模块间依赖关系是否符合设计规范
 *
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { MODULE_DEPENDENCY_GRAPH, validateModuleDependency, detectCircularDependencies } from '../interfaces/core';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 违规类型枚举
 */
export enum ViolationType {
  CROSS_MODULE_IMPORT = 'cross_module_import',
  UNAUTHORIZED_DEPENDENCY = 'unauthorized_dependency',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  MISSING_INTERFACE = 'missing_interface',
  DIRECT_IMPLEMENTATION_ACCESS = 'direct_implementation_access',
  LAYER_VIOLATION = 'layer_violation',
}

/**
 * 架构违规记录
 */
export interface ArchitectureViolation {
  readonly type: ViolationType;
  readonly severity: 'error' | 'warning' | 'info';
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly sourceModule: string;
  readonly targetModule?: string;
  readonly suggestion?: string;
}

/**
 * 模块信息
 */
export interface ModuleInfo {
  readonly name: string;
  readonly type: string;
  readonly path: string;
  readonly files: string[];
  readonly imports: ImportInfo[];
  readonly exports: string[];
}

/**
 * 导入信息
 */
export interface ImportInfo {
  readonly source: string;
  readonly imports: string[];
  readonly isRelative: boolean;
  readonly targetModule?: string;
  readonly file: string;
  readonly line: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  readonly success: boolean;
  readonly violations: ArchitectureViolation[];
  readonly summary: {
    totalFiles: number;
    totalModules: number;
    totalViolations: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  readonly modules: ModuleInfo[];
}

/**
 * 架构验证器类
 */
export class ArchitectureValidator {
  private readonly srcDir: string;
  private readonly violations: ArchitectureViolation[] = [];
  private readonly modules: Map<string, ModuleInfo> = new Map();

  constructor(srcDir: string = './src') {
    this.srcDir = path.resolve(srcDir);
  }

  /**
   * 执行完整的架构验证
   */
  async validate(): Promise<ValidationResult> {
    console.log('🔍 开始架构合规性验证...');

    this.violations.length = 0;
    this.modules.clear();

    // 1. 扫描所有模块
    await this.scanModules();

    // 2. 分析导入关系
    await this.analyzeImports();

    // 3. 验证模块依赖
    this.validateModuleDependencies();

    // 4. 检查循环依赖
    this.checkCircularDependencies();

    // 5. 验证接口使用
    this.validateInterfaceUsage();

    // 6. 检查层级违规
    this.checkLayerViolations();

    const result = this.generateResult();
    this.printSummary(result);

    return result;
  }

  /**
   * 扫描所有模块
   */
  private async scanModules(): Promise<void> {
    const moduleDirectories = [
      'client',
      'router',
      'pipeline',
      'debug',
      'server',
      'interfaces',
      'middleware',
      'modules',
      'routes',
      'cli',
      'types',
      'utils',
    ];

    for (const dir of moduleDirectories) {
      const modulePath = path.join(this.srcDir, dir);
      if (fs.existsSync(modulePath)) {
        await this.scanModuleDirectory(dir, modulePath);
      }
    }
  }

  /**
   * 扫描模块目录
   */
  private async scanModuleDirectory(moduleName: string, modulePath: string): Promise<void> {
    const files: string[] = [];
    const imports: ImportInfo[] = [];

    const scanDir = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(path.relative(this.srcDir, fullPath));

          // 分析文件中的导入语句
          const fileImports = this.analyzeFileImports(fullPath);
          imports.push(...fileImports);
        }
      }
    };

    scanDir(modulePath);

    const moduleInfo: ModuleInfo = {
      name: moduleName,
      type: this.getModuleType(moduleName),
      path: path.relative(process.cwd(), modulePath),
      files,
      imports,
      exports: [], // TODO: 分析导出
    };

    this.modules.set(moduleName, moduleInfo);
  }

  /**
   * 分析文件中的导入语句
   */
  private analyzeFileImports(filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const importMatch = line.match(/^import\s+.*\s+from\s+['"]([^'"]+)['"]/);

        if (importMatch && importMatch[1]) {
          const source = importMatch[1];
          const isRelative = source.startsWith('.') || source.startsWith('/');

          const importInfo: ImportInfo = {
            source,
            imports: this.extractImportNames(line),
            isRelative,
            targetModule: this.resolveTargetModule(source, filePath),
            file: path.relative(this.srcDir, filePath),
            line: i + 1,
          };

          imports.push(importInfo);
        }
      }
    } catch (error) {
      console.warn(`⚠️  无法分析文件 ${filePath}: ${error}`);
    }

    return imports;
  }

  /**
   * 提取导入名称
   */
  private extractImportNames(importLine: string): string[] {
    const matches = importLine.match(/import\s+\{([^}]+)\}|import\s+([^,\s]+)|import\s+\*\s+as\s+([^,\s]+)/);

    if (matches) {
      if (matches[1]) {
        // 命名导入: import { a, b, c }
        return matches[1].split(',').map(name => name.trim());
      } else if (matches[2]) {
        // 默认导入: import Something
        return [matches[2].trim()];
      } else if (matches[3]) {
        // 命名空间导入: import * as Something
        return [matches[3].trim()];
      }
    }

    return [];
  }

  /**
   * 解析目标模块
   */
  private resolveTargetModule(source: string, filePath: string): string | undefined {
    if (!source || !source.startsWith('.')) {
      return undefined; // 外部依赖
    }

    const currentDir = path.dirname(filePath);
    const targetPath = path.resolve(currentDir, source);
    const relativePath = path.relative(this.srcDir, targetPath);

    // 找到目标模块
    for (const [moduleName, moduleInfo] of this.modules) {
      if (relativePath.startsWith(moduleInfo.path) || relativePath.startsWith(moduleName)) {
        return moduleName;
      }
    }

    // 根据路径推断模块
    const pathParts = relativePath.split('/');
    if (pathParts.length > 0) {
      return pathParts[0];
    }

    return undefined;
  }

  /**
   * 获取模块类型
   */
  private getModuleType(moduleName: string): string {
    const typeMapping: Record<string, string> = {
      client: 'client',
      router: 'router',
      pipeline: 'pipeline',
      debug: 'debug',
      server: 'server',
      interfaces: 'interface',
      middleware: 'infrastructure',
      modules: 'infrastructure',
      routes: 'infrastructure',
      cli: 'infrastructure',
      types: 'infrastructure',
      utils: 'infrastructure',
    };

    return typeMapping[moduleName] || 'unknown';
  }

  /**
   * 分析导入关系
   */
  private async analyzeImports(): Promise<void> {
    // 重新扫描，现在所有模块都已识别
    for (const [moduleName, moduleInfo] of this.modules) {
      for (const file of moduleInfo.files) {
        const filePath = path.join(this.srcDir, file);
        const fileImports = this.analyzeFileImports(filePath);

        // 更新导入信息的目标模块
        for (const importInfo of fileImports) {
          if (importInfo.isRelative && !importInfo.targetModule) {
            const resolvedTarget = this.resolveTargetModule(importInfo.source, filePath);
            if (resolvedTarget) {
              (importInfo as any).targetModule = resolvedTarget;
            }
          }
        }
      }
    }
  }

  /**
   * 验证模块依赖关系
   */
  private validateModuleDependencies(): void {
    for (const [moduleName, moduleInfo] of this.modules) {
      for (const importInfo of moduleInfo.imports) {
        if (importInfo.targetModule && importInfo.targetModule !== moduleName) {
          // 检查是否允许该依赖
          if (!validateModuleDependency(moduleName, importInfo.targetModule)) {
            this.addViolation({
              type: ViolationType.UNAUTHORIZED_DEPENDENCY,
              severity: 'error',
              file: importInfo.file,
              line: importInfo.line,
              message: `模块 '${moduleName}' 不允许依赖模块 '${importInfo.targetModule}'`,
              sourceModule: moduleName,
              targetModule: importInfo.targetModule,
              suggestion: `请通过允许的接口访问该模块功能，或重新设计模块依赖关系`,
            });
          }

          // 检查是否直接导入具体实现
          if (this.isDirectImplementationAccess(importInfo)) {
            this.addViolation({
              type: ViolationType.DIRECT_IMPLEMENTATION_ACCESS,
              severity: 'error',
              file: importInfo.file,
              line: importInfo.line,
              message: `直接导入具体实现类，应使用接口: ${importInfo.source}`,
              sourceModule: moduleName,
              targetModule: importInfo.targetModule,
              suggestion: `请导入 'src/interfaces/core' 中的对应接口`,
            });
          }
        }
      }
    }
  }

  /**
   * 检查循环依赖
   */
  private checkCircularDependencies(): void {
    const dependencies: Record<string, string[]> = {};

    // 构建依赖图
    for (const [moduleName, moduleInfo] of this.modules) {
      dependencies[moduleName] = [];

      for (const importInfo of moduleInfo.imports) {
        if (importInfo.targetModule && importInfo.targetModule !== moduleName) {
          if (!dependencies[moduleName].includes(importInfo.targetModule)) {
            dependencies[moduleName].push(importInfo.targetModule);
          }
        }
      }
    }

    // 检测循环依赖
    const circularPath = detectCircularDependencies(dependencies);
    if (circularPath.length > 0) {
      this.addViolation({
        type: ViolationType.CIRCULAR_DEPENDENCY,
        severity: 'error',
        file: 'global',
        line: 0,
        message: `检测到循环依赖: ${circularPath.join(' → ')}`,
        sourceModule: circularPath[0],
        suggestion: '请重新设计模块依赖关系以消除循环依赖',
      });
    }
  }

  /**
   * 验证接口使用
   */
  private validateInterfaceUsage(): void {
    const interfaceModule = this.modules.get('interfaces');
    if (!interfaceModule) {
      this.addViolation({
        type: ViolationType.MISSING_INTERFACE,
        severity: 'error',
        file: 'global',
        line: 0,
        message: '缺少接口模块定义',
        sourceModule: 'global',
        suggestion: '请创建 src/interfaces 目录并定义标准接口',
      });
      return;
    }

    // 检查模块是否使用了标准接口
    for (const [moduleName, moduleInfo] of this.modules) {
      if (moduleName === 'interfaces' || moduleInfo.type === 'infrastructure') {
        continue; // 跳过接口模块和基础设施模块
      }

      const hasInterfaceImport = moduleInfo.imports.some(importInfo => importInfo.targetModule === 'interfaces');

      if (!hasInterfaceImport && moduleInfo.files.length > 0) {
        this.addViolation({
          type: ViolationType.MISSING_INTERFACE,
          severity: 'warning',
          file: moduleInfo.files[0],
          line: 1,
          message: `模块 '${moduleName}' 未导入标准接口`,
          sourceModule: moduleName,
          suggestion: `请导入 'src/interfaces/core' 中的对应接口`,
        });
      }
    }
  }

  /**
   * 检查层级违规
   */
  private checkLayerViolations(): void {
    const layerHierarchy: Record<string, number> = {
      interface: 0, // 接口层 - 最高层
      client: 1, // 表示层
      router: 1, // 业务逻辑层
      debug: 1, // 业务逻辑层
      pipeline: 2, // 数据处理层
      server: 2, // 服务层
      infrastructure: 3, // 基础设施层 - 最底层
    };

    for (const [moduleName, moduleInfo] of this.modules) {
      const sourceLayer = layerHierarchy[moduleInfo.type] ?? 999;

      for (const importInfo of moduleInfo.imports) {
        if (importInfo.targetModule) {
          const targetModule = this.modules.get(importInfo.targetModule);
          if (targetModule) {
            const targetLayer = layerHierarchy[targetModule.type] ?? 999;

            // 高层模块不应该依赖同层或更低层的模块（除了接口）
            if (sourceLayer <= targetLayer && targetModule.type !== 'interface') {
              this.addViolation({
                type: ViolationType.LAYER_VIOLATION,
                severity: 'warning',
                file: importInfo.file,
                line: importInfo.line,
                message: `层级违规: ${moduleInfo.type}层(${moduleName})不应依赖${targetModule.type}层(${importInfo.targetModule})`,
                sourceModule: moduleName,
                targetModule: importInfo.targetModule,
                suggestion: '请通过接口层进行通信，或重新设计分层架构',
              });
            }
          }
        }
      }
    }
  }

  /**
   * 检查是否直接访问具体实现
   */
  private isDirectImplementationAccess(importInfo: ImportInfo): boolean {
    // 检查是否导入具体实现类而非接口
    const implementationPatterns = [
      /server\/.*\.ts$/, // 服务器具体实现
      /middleware\/.*\.ts$/, // 中间件具体实现
      /modules\/.*\.ts$/, // 模块具体实现
      /pipeline\/.*\.ts$/, // 流水线具体实现
      /routes\/.*\.ts$/, // 路由具体实现
    ];

    return implementationPatterns.some(pattern => pattern.test(importInfo.source));
  }

  /**
   * 添加违规记录
   */
  private addViolation(violation: ArchitectureViolation): void {
    this.violations.push(violation);
  }

  /**
   * 生成验证结果
   */
  private generateResult(): ValidationResult {
    const summary = {
      totalFiles: Array.from(this.modules.values()).reduce((sum, module) => sum + module.files.length, 0),
      totalModules: this.modules.size,
      totalViolations: this.violations.length,
      errorCount: this.violations.filter(v => v.severity === 'error').length,
      warningCount: this.violations.filter(v => v.severity === 'warning').length,
      infoCount: this.violations.filter(v => v.severity === 'info').length,
    };

    return {
      success: summary.errorCount === 0,
      violations: [...this.violations],
      summary,
      modules: Array.from(this.modules.values()),
    };
  }

  /**
   * 打印验证摘要
   */
  private printSummary(result: ValidationResult): void {
    console.log('\n📊 架构验证摘要:');
    console.log(`   总文件数: ${result.summary.totalFiles}`);
    console.log(`   总模块数: ${result.summary.totalModules}`);
    console.log(`   总违规数: ${result.summary.totalViolations}`);
    console.log(`   错误: ${result.summary.errorCount}`);
    console.log(`   警告: ${result.summary.warningCount}`);
    console.log(`   信息: ${result.summary.infoCount}`);

    if (result.violations.length > 0) {
      console.log('\n❌ 发现的违规问题:');
      for (const violation of result.violations.slice(0, 10)) {
        // 只显示前10个
        const severity = violation.severity === 'error' ? '🚫' : violation.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${severity} ${violation.file}:${violation.line} - ${violation.message}`);
        if (violation.suggestion) {
          console.log(`      💡 建议: ${violation.suggestion}`);
        }
      }

      if (result.violations.length > 10) {
        console.log(`   ... 还有 ${result.violations.length - 10} 个问题`);
      }
    } else {
      console.log('\n✅ 架构合规性验证通过！');
    }
  }

  /**
   * 生成详细报告
   */
  generateDetailedReport(result: ValidationResult, outputPath: string): void {
    const report = {
      timestamp: new Date().toISOString(),
      version: '4.0.0-alpha.1',
      summary: result.summary,
      modules: result.modules.map(module => ({
        name: module.name,
        type: module.type,
        path: module.path,
        fileCount: module.files.length,
        importCount: module.imports.length,
        dependencies: [...new Set(module.imports.map(imp => imp.targetModule).filter(Boolean))],
      })),
      violations: result.violations.map(violation => ({
        type: violation.type,
        severity: violation.severity,
        location: `${violation.file}:${violation.line}`,
        message: violation.message,
        sourceModule: violation.sourceModule,
        targetModule: violation.targetModule,
        suggestion: violation.suggestion,
      })),
      recommendations: this.generateRecommendations(result),
    };

    fs.writeFileSync(outputPath, JQJsonHandler.stringifyJson(report, false), 'utf-8');
    console.log(`📄 详细报告已生成: ${outputPath}`);
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(result: ValidationResult): string[] {
    const recommendations: string[] = [];

    if (result.summary.errorCount > 0) {
      recommendations.push('立即修复所有错误级别的架构违规问题');
    }

    const crossModuleViolations = result.violations.filter(v => v.type === ViolationType.CROSS_MODULE_IMPORT);
    if (crossModuleViolations.length > 0) {
      recommendations.push('重构跨模块导入，改为使用标准接口');
    }

    const missingInterfaces = result.violations.filter(v => v.type === ViolationType.MISSING_INTERFACE);
    if (missingInterfaces.length > 0) {
      recommendations.push('为所有模块定义并使用标准接口');
    }

    if (result.violations.some(v => v.type === ViolationType.CIRCULAR_DEPENDENCY)) {
      recommendations.push('重新设计模块依赖关系以消除循环依赖');
    }

    const layerViolations = result.violations.filter(v => v.type === ViolationType.LAYER_VIOLATION);
    if (layerViolations.length > 0) {
      recommendations.push('调整模块分层架构，确保依赖方向正确');
    }

    return recommendations;
  }
}

/**
 * CLI工具函数
 */
export async function runArchitectureValidation(srcDir?: string, outputPath?: string): Promise<void> {
  const validator = new ArchitectureValidator(srcDir);
  const result = await validator.validate();

  if (outputPath) {
    validator.generateDetailedReport(result, outputPath);
  }

  // 以适当的退出码退出
  process.exit(result.success ? 0 : 1);
}

// 如果直接运行该文件，执行验证
if (require.main === module) {
  const srcDir = process.argv[2] || './src';
  const outputPath = process.argv[3] || './architecture-report.json';

  runArchitectureValidation(srcDir, outputPath).catch(error => {
    console.error('❌ 架构验证失败:', error);
    process.exit(1);
  });
}
