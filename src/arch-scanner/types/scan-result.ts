/**
 * Architecture Scanner Result Types
 * 
 * 定义架构扫描结果的标准数据结构
 * 
 * @author RCC v4.0 Architecture Scanner
 */

/**
 * 架构合规性报告
 */
export interface ArchitectureComplianceReport {
  readonly summary: ComplianceSummary;
  readonly violations: ViolationReport[];
  readonly recommendations: RecommendationReport[];
  readonly timestamp: Date;
}

/**
 * 合规性摘要
 */
export interface ComplianceSummary {
  readonly totalModules: number;
  readonly violatingModules: number;
  readonly complianceScore: number; // 0-100
  readonly criticalViolations: number;
  readonly warningViolations: number;
  readonly infoViolations: number;
}

/**
 * 违规报告
 */
export interface ViolationReport {
  readonly id: string;
  readonly severity: ViolationSeverity;
  readonly category: ViolationCategory;
  readonly module: string;
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly message: string;
  readonly description: string;
  readonly suggestion: string;
  readonly ruleId: string;
}

/**
 * 推荐报告
 */
export interface RecommendationReport {
  readonly id: string;
  readonly priority: RecommendationPriority;
  readonly category: RecommendationCategory;
  readonly module: string;
  readonly title: string;
  readonly description: string;
  readonly actionItems: string[];
  readonly estimatedEffort: EffortEstimate;
}

/**
 * 模块合规性报告
 */
export interface ModuleComplianceReport {
  readonly moduleName: string;
  readonly complianceScore: number;
  readonly violations: ViolationReport[];
  readonly recommendations: RecommendationReport[];
}

/**
 * 违规严重程度
 */
export type ViolationSeverity = 'critical' | 'major' | 'minor' | 'info';

/**
 * 违规分类
 */
export type ViolationCategory = 
  | 'module-responsibility' 
  | 'interface-exposure' 
  | 'dependency-violation' 
  | 'naming-convention' 
  | 'code-pattern';

/**
 * 推荐优先级
 */
export type RecommendationPriority = 'high' | 'medium' | 'low';

/**
 * 推荐分类
 */
export type RecommendationCategory = 
  | 'architecture-improvement' 
  | 'code-quality' 
  | 'performance' 
  | 'maintainability' 
  | 'documentation';

/**
 * 工作量估算
 */
export type EffortEstimate = 'low' | 'medium' | 'high' | 'very-high';

/**
 * 报告格式
 */
export type ReportFormat = 'html' | 'json' | 'markdown' | 'text';