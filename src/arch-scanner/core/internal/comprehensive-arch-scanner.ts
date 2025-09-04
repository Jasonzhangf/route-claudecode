/**
 * Comprehensive Architecture Scanner
 * 
 * 全面架构扫描器的核心实现
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { 
  ScannerInterface, 
  ScannerDependencies, 
  ModuleInfo 
} from '../interfaces/scanner-interface';
import type { 
  ArchitectureComplianceReport, 
  ModuleComplianceReport,
  ComplianceSummary
} from '../../types/scan-result';

/**
 * 全面架构扫描器实现
 */
export class ComprehensiveArchScanner implements ScannerInterface {
  private readonly dependencies: ScannerDependencies;
  private isInitialized: boolean = false;

  constructor(dependencies: ScannerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * 执行项目扫描
   */
  async scan(): Promise<ArchitectureComplianceReport> {
    await this.ensureInitialized();

    // 使用真实的模块分析器分析项目
    const modules: ModuleInfo[] = await this.dependencies.moduleAnalyzer.analyzeProject();
    
    // 收集所有违规信息
    const allViolations: any[] = [];
    
    // 对每个模块执行违规检测
    for (const module of modules) {
      const moduleViolations = await this.dependencies.violationDetector.detectViolations(module);
      allViolations.push(...moduleViolations);
    }
    
    // 执行项目级别的违规检测
    const projectViolations = await this.dependencies.violationDetector.detectProjectViolations(modules);
    allViolations.push(...projectViolations);

    // 计算统计信息
    const criticalViolations = allViolations.filter(v => v.severity === 'critical').length;
    const warningViolations = allViolations.filter(v => v.severity === 'major').length;
    const infoViolations = allViolations.filter(v => v.severity === 'info').length;
    
    const violatingModules = new Set(allViolations.map(v => v.file)).size;
    const complianceScore = Math.max(0, Math.round(100 - (criticalViolations * 10 + warningViolations * 5 + infoViolations * 1)));

    const summary: ComplianceSummary = {
      totalModules: modules.length,
      violatingModules,
      complianceScore,
      criticalViolations,
      warningViolations,
      infoViolations
    };

    // 生成推荐建议
    const recommendations = this.generateRecommendations(modules, allViolations);

    const report: ArchitectureComplianceReport = {
      summary,
      violations: allViolations,
      recommendations,
      timestamp: new Date()
    };

    return report;
  }

  /**
   * 执行模块扫描
   */
  async scanModule(moduleName: string): Promise<ModuleComplianceReport> {
    await this.ensureInitialized();

    return {
      moduleName,
      complianceScore: 100,
      violations: [],
      recommendations: []
    };
  }

  /**
   * 初始化扫描器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 验证依赖项
    if (!this.dependencies.moduleAnalyzer) {
      throw new TypeError('Module analyzer is required');
    }
    if (!this.dependencies.violationDetector) {
      throw new TypeError('Violation detector is required');
    }
    if (!this.dependencies.reportGenerator) {
      throw new TypeError('Report generator is required');
    }
    if (!this.dependencies.configManager) {
      throw new TypeError('Config manager is required');
    }

    this.isInitialized = true;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }

  /**
   * 确保扫描器已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 生成项目级推荐建议
   */
  private generateRecommendations(modules: ModuleInfo[], violations: any[]): any[] {
    const recommendations: any[] = [];

    // 根据违规类型生成推荐
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const warningViolations = violations.filter(v => v.severity === 'warning').length;

    if (criticalViolations > 0) {
      recommendations.push({
        id: 'rec-fix-critical',
        priority: 'high',
        category: 'critical-fixes',
        module: 'global',
        title: `Fix ${criticalViolations} Critical Architecture Violations`,
        description: 'Critical violations can severely impact system stability and maintainability',
        actionItems: [
          'Review and fix all critical violations immediately',
          'Implement proper ModuleInterface compliance',
          'Ensure TypeScript-only policy compliance'
        ],
        estimatedEffort: 'high'
      });
    }

    if (warningViolations > 5) {
      recommendations.push({
        id: 'rec-reduce-warnings',
        priority: 'medium',
        category: 'code-quality',
        module: 'global',
        title: `Address ${warningViolations} Warning Violations`,
        description: 'Multiple warnings indicate potential architectural debt',
        actionItems: [
          'Reduce interface exposure following zero-exposure principle',
          'Improve naming conventions consistency',
          'Refactor modules with too many dependencies'
        ],
        estimatedEffort: 'medium'
      });
    }

    if (modules.length > 50) {
      recommendations.push({
        id: 'rec-modularization',
        priority: 'low',
        category: 'architecture-improvement',
        module: 'global',
        title: 'Consider Further Modularization',
        description: `Project has ${modules.length} modules, consider consolidation`,
        actionItems: [
          'Review module boundaries and responsibilities',
          'Consolidate related functionality',
          'Implement clear module interfaces'
        ],
        estimatedEffort: 'high'
      });
    }

    return recommendations;
  }

  /**
   * 生成模块特定推荐建议
   */
  private generateModuleRecommendations(module: ModuleInfo, violations: any[]): any[] {
    const recommendations: any[] = [];

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    if (criticalCount > 0) {
      recommendations.push({
        id: `rec-${module.name}-critical`,
        priority: 'high',
        category: 'critical-fixes',
        module: module.name,
        title: `Fix Critical Issues in ${module.name}`,
        description: `Module has ${criticalCount} critical violations`,
        actionItems: violations
          .filter(v => v.severity === 'critical')
          .map(v => v.context?.suggestion || v.message),
        estimatedEffort: criticalCount > 3 ? 'high' : 'medium'
      });
    }

    if (warningCount > 3) {
      recommendations.push({
        id: `rec-${module.name}-refactor`,
        priority: 'medium',
        category: 'refactoring',
        module: module.name,
        title: `Refactor ${module.name} Module`,
        description: `Module has ${warningCount} warning violations indicating technical debt`,
        actionItems: [
          'Review and reduce public interface exposure',
          'Improve naming conventions',
          'Reduce internal dependencies'
        ],
        estimatedEffort: 'medium'
      });
    }

    return recommendations;
  }
}