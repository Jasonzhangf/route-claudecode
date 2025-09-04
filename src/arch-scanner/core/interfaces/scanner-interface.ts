/**
 * Core Scanner Interfaces
 * 
 * 定义架构扫描器的核心内部接口
 * 这些接口仅供内部使用，不对外暴露
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ArchScannerConfig } from '../../types/config-types';
import type { ArchitectureComplianceReport, ModuleComplianceReport } from '../../types/scan-result';

/**
 * 核心扫描器接口（内部使用）
 */
export interface ScannerInterface {
  /**
   * 执行项目扫描
   */
  scan(): Promise<ArchitectureComplianceReport>;

  /**
   * 执行模块扫描
   */
  scanModule(moduleName: string): Promise<ModuleComplianceReport>;

  /**
   * 初始化扫描器
   */
  initialize(): Promise<void>;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * 扫描器依赖注入接口
 */
export interface ScannerDependencies {
  readonly moduleAnalyzer: ModuleAnalyzerInterface;
  readonly violationDetector: ViolationDetectorInterface;
  readonly reportGenerator: ReportGeneratorInterface;
  readonly configManager: ConfigManagerInterface;
}

/**
 * 模块分析器接口
 */
export interface ModuleAnalyzerInterface {
  /**
   * 分析项目中的所有模块
   */
  analyzeProject(): Promise<ModuleInfo[]>;

  /**
   * 分析指定模块
   */
  analyzeModule(modulePath: string): Promise<ModuleInfo>;
}

/**
 * 违规检测器接口
 */
export interface ViolationDetectorInterface {
  /**
   * 检测模块违规
   */
  detectViolations(moduleInfo: ModuleInfo): Promise<ViolationInfo[]>;

  /**
   * 检测项目级违规
   */
  detectProjectViolations(modules: ModuleInfo[]): Promise<ViolationInfo[]>;
}

/**
 * 报告生成器接口
 */
export interface ReportGeneratorInterface {
  /**
   * 生成HTML报告
   */
  generateHtmlReport(report: ArchitectureComplianceReport): Promise<string>;

  /**
   * 生成JSON报告
   */
  generateJsonReport(report: ArchitectureComplianceReport): Promise<string>;

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(report: ArchitectureComplianceReport): Promise<string>;
}

/**
 * 配置管理器接口
 */
export interface ConfigManagerInterface {
  /**
   * 解析配置
   */
  resolveConfig(config?: ArchScannerConfig): ArchScannerConfig;

  /**
   * 验证配置
   */
  validateConfig(config: ArchScannerConfig): ValidationResult;

  /**
   * 获取默认配置
   */
  getDefaultConfig(): ArchScannerConfig;
}

/**
 * 模块信息
 */
export interface ModuleInfo {
  readonly name: string;
  readonly path: string;
  readonly type: ModuleType;
  readonly exports: ExportInfo[];
  readonly imports: ImportInfo[];
  readonly dependencies: string[];
  readonly interfaces: InterfaceInfo[];
  readonly implementations: ImplementationInfo[];
}

/**
 * 违规信息
 */
export interface ViolationInfo {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: 'critical' | 'major' | 'minor' | 'info';
  readonly message: string;
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly context: Record<string, any>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * 模块类型
 */
export type ModuleType = 
  | 'client' | 'router' | 'pipeline' | 'transformer' 
  | 'protocol' | 'server-compatibility' | 'server'
  | 'config' | 'auth' | 'debug' | 'middleware' | 'types'
  | 'unknown';

/**
 * 导出信息
 */
export interface ExportInfo {
  readonly name: string;
  readonly type: 'function' | 'class' | 'interface' | 'type' | 'variable';
  readonly isDefault: boolean;
  readonly line?: number;
}

/**
 * 导入信息
 */
export interface ImportInfo {
  readonly source: string;
  readonly imports: string[];
  readonly isTypeOnly: boolean;
  readonly line?: number;
}

/**
 * 接口信息
 */
export interface InterfaceInfo {
  readonly name: string;
  readonly methods: MethodInfo[];
  readonly properties: PropertyInfo[];
  readonly extends?: string[];
  readonly line?: number;
}

/**
 * 实现信息
 */
export interface ImplementationInfo {
  readonly name: string;
  readonly implements?: string[];
  readonly extends?: string;
  readonly methods: MethodInfo[];
  readonly properties: PropertyInfo[];
  readonly line?: number;
}

/**
 * 方法信息
 */
export interface MethodInfo {
  readonly name: string;
  readonly parameters: ParameterInfo[];
  readonly returnType?: string;
  readonly isAsync: boolean;
  readonly isPublic: boolean;
  readonly line?: number;
}

/**
 * 属性信息
 */
export interface PropertyInfo {
  readonly name: string;
  readonly type?: string;
  readonly isReadonly: boolean;
  readonly isPublic: boolean;
  readonly line?: number;
}

/**
 * 参数信息
 */
export interface ParameterInfo {
  readonly name: string;
  readonly type?: string;
  readonly isOptional: boolean;
}