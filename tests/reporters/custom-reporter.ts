// 自定义测试报告器
import { TestReport, TestResult } from '../utils/test-types';

export class CustomTestReporter {
  private report: TestReport;
  
  constructor() {
    this.report = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        pending: 0,
        duration: 0
      },
      results: [],
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'test'
    };
  }
  
  // 添加测试结果
  addResult(result: TestResult): void {
    this.report.results.push(result);
    this.updateSummary(result);
  }
  
  // 更新汇总信息
  private updateSummary(result: TestResult): void {
    this.report.summary.total++;
    this.report.summary.duration += result.duration;
    
    switch (result.status) {
      case 'passed':
        this.report.summary.passed++;
        break;
      case 'failed':
        this.report.summary.failed++;
        break;
      case 'skipped':
        this.report.summary.skipped++;
        break;
      case 'pending':
        this.report.summary.pending++;
        break;
    }
  }
  
  // 生成控制台报告
  generateConsoleReport(): string {
    const summary = this.report.summary;
    const total = summary.total;
    const passed = summary.passed;
    const failed = summary.failed;
    const skipped = summary.skipped;
    const pending = summary.pending;
    const duration = summary.duration;
    
    let report = '\n=== 测试执行报告 ===\n';
    report += `执行时间: ${this.report.timestamp.toISOString()}\n`;
    report += `环境: ${this.report.environment}\n`;
    report += `总用例数: ${total}\n`;
    report += `通过: ${passed} ((${passed} / ${total}) * 100).toFixed(2)}%)\n`;
    report += `失败: ${failed} ((${failed} / ${total}) * 100).toFixed(2)}%)\n`;
    report += `跳过: ${skipped}\n`;
    report += `待处理: ${pending}\n`;
    report += `总耗时: ${duration}ms\n`;
    
    if (failed > 0) {
      report += '\n--- 失败的测试用例 ---\n';
      this.report.results
        .filter(result => result.status === 'failed')
        .forEach(result => {
          report += `  ❌ ${result.name} (${result.duration}ms)\n`;
          if (result.error) {
            report += `     错误: ${result.error.message}\n`;
          }
        });
    }
    
    if (pending > 0) {
      report += '\n--- 待处理的测试用例 ---\n';
      this.report.results
        .filter(result => result.status === 'pending')
        .forEach(result => {
          report += `  ⏳ ${result.name}\n`;
        });
    }
    
    return report;
  }
  
  // 生成 JSON 报告
  generateJsonReport(): string {
    return JSON.stringify(this.report, null, 2);
  }
  
  // 生成 HTML 报告
  generateHtmlReport(): string {
    const summary = this.report.summary;
    const passedPercentage = ((summary.passed / summary.total) * 100).toFixed(2);
    const failedPercentage = ((summary.failed / summary.total) * 100).toFixed(2);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>测试执行报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary-item { display: inline-block; margin-right: 20px; }
        .passed { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        .pending { color: blue; }
        .test-results { width: 100%; border-collapse: collapse; }
        .test-results th, .test-results td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .test-results th { background-color: #f2f2f2; }
        .status-passed { color: green; }
        .status-failed { color: red; }
        .status-skipped { color: orange; }
        .status-pending { color: blue; }
    </style>
</head>
<body>
    <h1>测试执行报告</h1>
    
    <div class="summary">
        <h2>汇总信息</h2>
        <div class="summary-item"><strong>执行时间:</strong> ${this.report.timestamp.toISOString()}</div>
        <div class="summary-item"><strong>环境:</strong> ${this.report.environment}</div>
        <div class="summary-item"><strong>总用例数:</strong> ${summary.total}</div>
        <div class="summary-item passed"><strong>通过:</strong> ${summary.passed} (${passedPercentage}%)</div>
        <div class="summary-item failed"><strong>失败:</strong> ${summary.failed} (${failedPercentage}%)</div>
        <div class="summary-item skipped"><strong>跳过:</strong> ${summary.skipped}</div>
        <div class="summary-item pending"><strong>待处理:</strong> ${summary.pending}</div>
        <div class="summary-item"><strong>总耗时:</strong> ${summary.duration}ms</div>
    </div>
    
    <h2>详细结果</h2>
    <table class="test-results">
        <thead>
            <tr>
                <th>测试用例</th>
                <th>状态</th>
                <th>耗时(ms)</th>
                <th>执行时间</th>
                <th>错误信息</th>
            </tr>
        </thead>
        <tbody>
            ${this.report.results.map(result => `
            <tr>
                <td>${result.name}</td>
                <td class="status-${result.status}">${result.status}</td>
                <td>${result.duration}</td>
                <td>${result.timestamp.toISOString()}</td>
                <td>${result.error ? result.error.message : ''}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>
    `;
  }
  
  // 保存报告到文件
  saveReportToFile(format: 'json' | 'html' = 'json', filePath: string): void {
    const fs = require('fs');
    const path = require('path');
    
    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let content: string;
    switch (format) {
      case 'json':
        content = this.generateJsonReport();
        break;
      case 'html':
        content = this.generateHtmlReport();
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    fs.writeFileSync(filePath, content);
  }
}