/**
 * Architecture Scanner Configuration Types
 * 
 * 定义架构扫描器的配置类型和选项
 * 
 * @author RCC v4.0 Architecture Scanner
 */

/**
 * 架构扫描器配置
 */
export interface ArchScannerConfig {
  readonly projectRoot: string;
  readonly outputDir?: string;
  readonly strictMode?: boolean;
  readonly customRules?: string[];
  readonly excludePatterns?: string[];
  readonly includePatterns?: string[];
  readonly reportFormats?: ('html' | 'json' | 'markdown')[];
  readonly enableCache?: boolean;
  readonly cacheDir?: string;
  readonly parallel?: boolean;
  readonly maxWorkers?: number;
}

/**
 * 规则集配置
 */
export interface RuleSetConfig {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly rules: RuleConfig[];
}

/**
 * 单个规则配置
 */
export interface RuleConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly severity: 'critical' | 'major' | 'minor' | 'info';
  readonly enabled: boolean;
  readonly parameters?: Record<string, any>;
}

/**
 * 分析器配置
 */
export interface AnalyzerConfig {
  readonly typescript: TypeScriptAnalyzerConfig;
  readonly module: ModuleAnalyzerConfig;
  readonly dependency: DependencyAnalyzerConfig;
}

/**
 * TypeScript分析器配置
 */
export interface TypeScriptAnalyzerConfig {
  readonly tsconfigPath?: string;
  readonly includeDeclarations?: boolean;
  readonly followImports?: boolean;
  readonly maxDepth?: number;
}

/**
 * 模块分析器配置
 */
export interface ModuleAnalyzerConfig {
  readonly modulePattern: string;
  readonly interfacePattern: string;
  readonly implementationPattern: string;
  readonly testPattern: string;
}

/**
 * 依赖分析器配置
 */
export interface DependencyAnalyzerConfig {
  readonly allowCircularDependencies?: boolean;
  readonly maxDependencyDepth?: number;
  readonly excludeExternal?: boolean;
}