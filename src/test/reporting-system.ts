/**
 * 测试报告系统
 * 
 * 负责收集、分析和展示测试结果
 * 
 * @author RCC Test Framework
 */

import { TestResult, TestReport } from './execution-engine';
import { TestData } from './data-manager';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// 报告格式类型
export type ReportFormat = 'json' | 'html' | 'markdown' | 'junit';

// 报告配置接口
export interface ReportConfig {
  format: ReportFormat;
  outputPath: string;
  includeDetails: boolean;
  includeCharts: boolean;
  theme?: string;
}

// 趋势数据接口
export interface TrendData {
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  averageDuration: number;
}

// 报告生成器接口
export interface ReportGenerator {
  generateReport(report: TestReport, config: ReportConfig): Promise<string>;
}

/**
 * JSON报告生成器
 */
class JSONReportGenerator implements ReportGenerator {
  async generateReport(report: TestReport, config: ReportConfig): Promise<string> {
    const reportData = {
      ...report,
      generatedAt: new Date().toISOString(),
      generator: 'RCC Test Framework'
    };

    const reportContent = JSON.stringify(reportData, null, 2);
    
    if (config.outputPath) {
      const filePath = path.join(config.outputPath, `test-report-${report.id}.json`);
      fs.writeFileSync(filePath, reportContent);
    }
    
    return reportContent;
  }
}

/**
 * HTML报告生成器
 */
class HTMLReportGenerator implements ReportGenerator {
  async generateReport(report: TestReport, config: ReportConfig): Promise<string> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background-color: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-card.passed { background-color: #d4edda; border-left: 4px solid #28a745; }
        .summary-card.failed { background-color: #f8d7da; border-left: 4px solid #dc3545; }
        .summary-card.total { background-color: #d1ecf1; border-left: 4px solid #17a2b8; }
        .summary-card.skipped { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .summary-number { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .summary-label { color: #6c757d; font-size: 0.9em; }
        .results { margin-top: 30px; }
        .result-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .result-table th, .result-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        .result-table th { background-color: #f8f9fa; font-weight: 600; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
        .status-skipped { color: #ffc107; font-weight: bold; }
        .error-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 10px; font-family: monospace; font-size: 0.9em; }
        .chart-container { margin: 30px 0; }
        .chart { height: 300px; display: flex; align-items: flex-end; gap: 2px; }
        .chart-bar { flex: 1; background-color: #007bff; text-align: center; color: white; font-size: 12px; }
        .chart-label { text-align: center; margin-top: 5px; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report: ${report.name}</h1>
            <p>Generated at: ${new Date().toISOString()}</p>
            <p>Environment: ${report.environment}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <div class="summary-number">${report.summary.total}</div>
                <div class="summary-label">Total Tests</div>
            </div>
            <div class="summary-card passed">
                <div class="summary-number">${report.summary.passed}</div>
                <div class="summary-label">Passed</div>
            </div>
            <div class="summary-card failed">
                <div class="summary-number">${report.summary.failed}</div>
                <div class="summary-label">Failed</div>
            </div>
            <div class="summary-card skipped">
                <div class="summary-number">${report.summary.skipped}</div>
                <div class="summary-label">Skipped</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>Test Results Distribution</h3>
            <div class="chart">
                <div class="chart-bar" style="height: ${report.summary.passed / report.summary.total * 100}%; background-color: #28a745;">
                    ${report.summary.passed}
                </div>
                <div class="chart-bar" style="height: ${report.summary.failed / report.summary.total * 100}%; background-color: #dc3545;">
                    ${report.summary.failed}
                </div>
                <div class="chart-bar" style="height: ${report.summary.skipped / report.summary.total * 100}%; background-color: #ffc107;">
                    ${report.summary.skipped}
                </div>
            </div>
            <div style="display: flex; justify-content: space-around;">
                <div class="chart-label" style="color: #28a745;">Passed</div>
                <div class="chart-label" style="color: #dc3545;">Failed</div>
                <div class="chart-label" style="color: #ffc107;">Skipped</div>
            </div>
        </div>
        
        <div class="results">
            <h3>Detailed Results</h3>
            <table class="result-table">
                <thead>
                    <tr>
                        <th>Test Case</th>
                        <th>Status</th>
                        <th>Duration (ms)</th>
                        <th>Module</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.results.map(result => `
                        <tr>
                            <td>${result.testCaseId}</td>
                            <td class="status-${result.status}">${result.status.toUpperCase()}</td>
                            <td>${result.duration}</td>
                            <td>${result.metadata.tags.join(', ') || 'N/A'}</td>
                            <td>
                                ${result.error ? `
                                    <div class="error-details">
                                        <strong>Error:</strong> ${result.error.message}<br>
                                        ${result.error.code ? `<strong>Code:</strong> ${result.error.code}<br>` : ''}
                                    </div>
                                ` : 'Success'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;

    if (config.outputPath) {
      const filePath = path.join(config.outputPath, `test-report-${report.id}.html`);
      fs.writeFileSync(filePath, htmlContent);
    }
    
    return htmlContent;
  }
}

/**
 * Markdown报告生成器
 */
class MarkdownReportGenerator implements ReportGenerator {
  async generateReport(report: TestReport, config: ReportConfig): Promise<string> {
    const markdownContent = `# Test Report: ${report.name}

## Summary
- **Generated at:** ${new Date().toISOString()}
- **Environment:** ${report.environment}
- **Total Tests:** ${report.summary.total}
- **Passed:** ${report.summary.passed}
- **Failed:** ${report.summary.failed}
- **Skipped:** ${report.summary.skipped}
- **Pass Rate:** ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%

## Detailed Results

| Test Case | Status | Duration (ms) | Module | Details |
|-----------|--------|---------------|--------|---------|
${report.results.map(result => `| ${result.testCaseId} | ${result.status.toUpperCase()} | ${result.duration} | ${result.metadata.tags.join(', ') || 'N/A'} | ${result.error ? `ERROR: ${result.error.message}` : 'Success'} |`).join('\n')}

## Report Metadata
- **Report ID:** ${report.id}
- **Plan ID:** ${report.planId}
- **Generator:** RCC Test Framework
`;

    if (config.outputPath) {
      const filePath = path.join(config.outputPath, `test-report-${report.id}.md`);
      fs.writeFileSync(filePath, markdownContent);
    }
    
    return markdownContent;
  }
}

/**
 * JUnit报告生成器
 */
class JUnitReportGenerator implements ReportGenerator {
  async generateReport(report: TestReport, config: ReportConfig): Promise<string> {
    const junitContent = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${report.name}" tests="${report.summary.total}" failures="${report.summary.failed}" skipped="${report.summary.skipped}" time="${report.duration / 1000}">
    <testsuite name="RCC Test Suite" tests="${report.summary.total}" failures="${report.summary.failed}" skipped="${report.summary.skipped}" time="${report.duration / 1000}" timestamp="${report.startTime}">
        ${report.results.map(result => `
        <testcase name="${result.testCaseId}" classname="${result.metadata.tags.join('.') || 'Unknown'}" time="${result.duration / 1000}">
            ${result.status === 'failed' ? `
            <failure message="${result.error?.message || 'Test failed'}" type="${result.error?.code || 'FAILURE'}">
                <![CDATA[
                ${result.error?.stack || result.error?.message || 'No error details'}
                ]]>
            </failure>` : ''}
            ${result.status === 'skipped' ? `<skipped/>` : ''}
        </testcase>`).join('')}
    </testsuite>
</testsuites>`;

    if (config.outputPath) {
      const filePath = path.join(config.outputPath, `test-report-${report.id}.xml`);
      fs.writeFileSync(filePath, junitContent);
    }
    
    return junitContent;
  }
}

/**
 * 测试报告系统类
 */
export class TestReportingSystem {
  private generators: Map<ReportFormat, ReportGenerator>;
  private reportHistory: TestReport[];
  private trendData: TrendData[];

  constructor() {
    this.generators = new Map();
    this.reportHistory = [];
    this.trendData = [];
    
    // 注册报告生成器
    this.generators.set('json', new JSONReportGenerator());
    this.generators.set('html', new HTMLReportGenerator());
    this.generators.set('markdown', new MarkdownReportGenerator());
    this.generators.set('junit', new JUnitReportGenerator());
  }

  /**
   * 生成测试报告
   * @param report 测试报告数据
   * @param config 报告配置
   * @returns 生成的报告内容
   */
  async generateReport(report: TestReport, config: ReportConfig): Promise<string> {
    const generator = this.generators.get(config.format);
    
    if (!generator) {
      throw new Error(`Unsupported report format: ${config.format}`);
    }
    
    // 保存报告到历史记录
    this.reportHistory.push(report);
    
    // 更新趋势数据
    this.updateTrendData(report);
    
    // 生成报告
    return await generator.generateReport(report, config);
  }

  /**
   * 更新趋势数据
   * @param report 测试报告
   */
  private updateTrendData(report: TestReport): void {
    const trend: TrendData = {
      date: new Date().toISOString().split('T')[0],
      totalTests: report.summary.total,
      passedTests: report.summary.passed,
      failedTests: report.summary.failed,
      passRate: report.summary.total > 0 ? (report.summary.passed / report.summary.total) * 100 : 0,
      averageDuration: report.duration
    };
    
    this.trendData.push(trend);
    
    // 保持最近30天的数据
    if (this.trendData.length > 30) {
      this.trendData = this.trendData.slice(-30);
    }
  }

  /**
   * 获取报告历史
   * @returns 报告历史数组
   */
  getReportHistory(): TestReport[] {
    return [...this.reportHistory];
  }

  /**
   * 获取趋势数据
   * @returns 趋势数据数组
   */
  getTrendData(): TrendData[] {
    return [...this.trendData];
  }

  /**
   * 获取报告统计
   * @returns 报告统计信息
   */
  getReportStats(): {
    totalReports: number;
    averagePassRate: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
  } {
    const totalReports = this.reportHistory.length;
    let totalPassRate = 0;
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    
    this.reportHistory.forEach(report => {
      totalTests += report.summary.total;
      totalPassed += report.summary.passed;
      totalFailed += report.summary.failed;
      totalPassRate += report.summary.total > 0 ? (report.summary.passed / report.summary.total) * 100 : 0;
    });
    
    const averagePassRate = totalReports > 0 ? totalPassRate / totalReports : 0;
    
    return {
      totalReports,
      averagePassRate,
      totalTests,
      totalPassed,
      totalFailed
    };
  }

  /**
   * 导出报告历史
   * @param format 导出格式
   * @param outputPath 输出路径
   */
  async exportReportHistory(format: ReportFormat, outputPath: string): Promise<void> {
    const exportData = {
      reports: this.reportHistory,
      trends: this.trendData,
      stats: this.getReportStats(),
      exportedAt: new Date().toISOString()
    };
    
    let content: string;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        break;
      case 'markdown':
        content = `# Test Report History Export
        
## Statistics
- Total Reports: ${exportData.stats.totalReports}
- Average Pass Rate: ${exportData.stats.averagePassRate.toFixed(2)}%
- Total Tests: ${exportData.stats.totalTests}
- Total Passed: ${exportData.stats.totalPassed}
- Total Failed: ${exportData.stats.totalFailed}

## Exported At
${exportData.exportedAt}
`;
        break;
      default:
        content = JSON.stringify(exportData, null, 2);
    }
    
    const filePath = path.join(outputPath, `report-history-export.${format}`);
    fs.writeFileSync(filePath, content);
  }

  /**
   * 清理报告历史
   * @param olderThan 只保留此日期之后的报告
   */
  cleanupReportHistory(olderThan?: string): void {
    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      this.reportHistory = this.reportHistory.filter(report => 
        new Date(report.startTime) >= cutoffDate
      );
      this.trendData = this.trendData.filter(trend => 
        new Date(trend.date) >= cutoffDate
      );
    } else {
      this.reportHistory = [];
      this.trendData = [];
    }
  }
}

// 导出类型定义
export default TestReportingSystem;
