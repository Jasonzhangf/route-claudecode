// src/services/fix-report-generator.ts
import { FixStrategy } from '../types/fix-types';

export interface FixReport {
  timestamp: string;
  totalFixes: number;
  successfulFixes: number;
  failedFixes: number;
  fixes: FixExecutionReport[];
  summary: string;
}

export interface FixExecutionReport {
  strategy: FixStrategy;
  status: 'success' | 'failed';
  errorMessage?: string;
  executionTime: number;
}

export class FixReportGenerator {
  generateReport(fixExecutions: FixExecutionReport[]): FixReport {
    const successfulFixes = fixExecutions.filter(f => f.status === 'success').length;
    const failedFixes = fixExecutions.filter(f => f.status === 'failed').length;
    
    const summary = this.generateSummary(successfulFixes, failedFixes, fixExecutions.length);
    
    return {
      timestamp: new Date().toISOString(),
      totalFixes: fixExecutions.length,
      successfulFixes,
      failedFixes,
      fixes: fixExecutions,
      summary
    };
  }
  
  private generateSummary(successful: number, failed: number, total: number): string {
    if (failed === 0) {
      return `所有修复都已成功应用 (${successful}/${total})`;
    } else if (successful === 0) {
      return `所有修复都失败了 (${failed}/${total})`;
    } else {
      return `部分修复成功: ${successful} 成功, ${failed} 失败 (${total} 总计)`;
    }
  }
  
  async saveReport(report: FixReport, outputPath: string): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  }
}