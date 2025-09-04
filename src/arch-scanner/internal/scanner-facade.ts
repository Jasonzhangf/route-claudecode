/**
 * Architecture Scanner Facade
 * 
 * 架构扫描器的门面实现，封装内部复杂性
 * 提供统一的外部接口，确保零接口暴露原则
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { ArchScannerInterface } from '../index';
import type { ArchScannerConfig } from '../types/config-types';
import type { 
  ArchitectureComplianceReport, 
  ModuleComplianceReport, 
  ReportFormat,
  ViolationReport,
  RecommendationReport
} from '../types/scan-result';
import type { ScannerInterface } from '../core/interfaces/scanner-interface';

/**
 * 架构扫描器门面类
 * 
 * 职责：
 * 1. 实现公共接口 ArchScannerInterface
 * 2. 封装内部核心扫描器的复杂性
 * 3. 提供统一的状态管理
 * 4. 确保内部实现完全隐藏
 */
export class ArchScannerFacade implements ArchScannerInterface {
  private readonly coreScanner: ScannerInterface;
  private readonly config: ArchScannerConfig;
  private lastScanTime?: Date;
  private lastScanResult?: ArchitectureComplianceReport;
  private isInitialized: boolean = false;

  constructor(coreScanner: ScannerInterface, config: ArchScannerConfig) {
    this.coreScanner = coreScanner;
    this.config = config;
  }

  /**
   * 扫描整个项目的架构合规性
   */
  async scanProject(): Promise<ArchitectureComplianceReport> {
    await this.ensureInitialized();
    
    const result = await this.coreScanner.scan();
    this.lastScanTime = new Date();
    this.lastScanResult = result;
    return result;
  }

  /**
   * 扫描指定模块的架构合规性
   */
  async scanModule(moduleName: string): Promise<ModuleComplianceReport> {
    await this.ensureInitialized();
    
    if (!moduleName || typeof moduleName !== 'string') {
      throw new TypeError('Module name must be a non-empty string');
    }
    
    return await this.coreScanner.scanModule(moduleName);
  }

  /**
   * 生成指定格式的报告
   */
  async generateReport(format: ReportFormat = 'json'): Promise<string> {
    if (!this.lastScanResult) {
      await this.scanProject();
    }

    switch (format) {
      case 'json':
        return JSON.stringify(this.lastScanResult, null, 2);
      
      case 'html':
        return this.generateHtmlReport(this.lastScanResult!);
      
      case 'markdown':
        return this.generateMarkdownReport(this.lastScanResult!);
      
      case 'text':
        return this.generateTextReport(this.lastScanResult!);
      
      default:
        throw new TypeError(`Unsupported report format: ${format}`);
    }
  }

  /**
   * 验证项目架构是否符合规范
   */
  async validateArchitecture(): Promise<boolean> {
    const result = await this.scanProject();
    return result.summary.criticalViolations === 0;
  }

  /**
   * 获取扫描器配置信息
   */
  getConfig(): ArchScannerConfig {
    return { ...this.config };
  }

  /**
   * 获取扫描器状态
   */
  getStatus(): {
    ready: boolean;
    lastScanTime?: Date;
    totalViolations: number;
    criticalViolations: number;
  } {
    return {
      ready: this.isInitialized,
      lastScanTime: this.lastScanTime,
      totalViolations: this.lastScanResult?.violations.length || 0,
      criticalViolations: this.lastScanResult?.summary.criticalViolations || 0
    };
  }

  /**
   * 确保扫描器已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.coreScanner.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(result: ArchitectureComplianceReport): string {
    const timestamp = result.timestamp.toISOString();
    const complianceScore = result.summary.complianceScore;
    const scoreColor = complianceScore >= 80 ? 'green' : complianceScore >= 60 ? 'orange' : 'red';

    return `<!DOCTYPE html>
<html>
<head>
    <title>Architecture Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .score { font-size: 24px; color: ${scoreColor}; font-weight: bold; }
        .section { margin: 20px 0; }
        .violation { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
        .critical { border-left-color: #dc3545; background: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Architecture Compliance Report</h1>
        <p>Generated: ${timestamp}</p>
        <p>Compliance Score: <span class="score">${complianceScore}%</span></p>
    </div>
    <div class="section">
        <h2>Summary</h2>
        <p>Total Modules: ${result.summary.totalModules}</p>
        <p>Violating Modules: ${result.summary.violatingModules}</p>
        <p>Critical Violations: ${result.summary.criticalViolations}</p>
    </div>
    <div class="section">
        <h2>Violations</h2>
        ${result.violations.map(v => `<div class="violation ${v.severity === 'critical' ? 'critical' : ''}">
                <strong>${v.module}</strong> - ${v.message}
                <br><small>${v.description}</small>
            </div>`).join('')}
    </div>
</body>
</html>`;
  }

  /**
   * 生成Markdown报告
   */
  private generateMarkdownReport(result: ArchitectureComplianceReport): string {
    return `# Architecture Compliance Report

**Generated:** ${result.timestamp.toISOString()}
**Compliance Score:** ${result.summary.complianceScore}%

## Summary

- Total Modules: ${result.summary.totalModules}
- Violating Modules: ${result.summary.violatingModules}
- Critical Violations: ${result.summary.criticalViolations}
- Warning Violations: ${result.summary.warningViolations}

## Violations

${result.violations.map(v => `### ${v.module} - ${v.severity.toUpperCase()}

**File:** ${v.file}${v.line ? `:${v.line}` : ''}
**Message:** ${v.message}
**Description:** ${v.description}
**Suggestion:** ${v.suggestion}
`).join('\n')}

## Recommendations

${result.recommendations.map(r => `### ${r.title} (${r.priority.toUpperCase()})

**Module:** ${r.module}
**Description:** ${r.description}

**Action Items:**
${r.actionItems.map(item => `- ${item}`).join('\n')}
`).join('\n')}`;
  }

  /**
   * 生成文本报告
   */
  private generateTextReport(result: ArchitectureComplianceReport): string {
    return `Architecture Compliance Report
Generated: ${result.timestamp.toISOString()}
Compliance Score: ${result.summary.complianceScore}%

SUMMARY
=======
Total Modules: ${result.summary.totalModules}
Violating Modules: ${result.summary.violatingModules}
Critical Violations: ${result.summary.criticalViolations}
Warning Violations: ${result.summary.warningViolations}

VIOLATIONS
==========
${result.violations.map(v => `[${v.severity.toUpperCase()}] ${v.module}
File: ${v.file}${v.line ? `:${v.line}` : ''}
Message: ${v.message}
Description: ${v.description}
Suggestion: ${v.suggestion}`).join('\n\n')}

RECOMMENDATIONS
===============
${result.recommendations.map(r => `[${r.priority.toUpperCase()}] ${r.title}
Module: ${r.module}
Description: ${r.description}
Action Items:
${r.actionItems.map(item => `  - ${item}`).join('\n')}`).join('\n\n')}`;
  }
}