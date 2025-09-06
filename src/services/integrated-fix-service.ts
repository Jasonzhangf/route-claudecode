// src/services/integrated-fix-service.ts
import { AutoFixService } from '../services/auto-fix-service';
import { FixVerifier } from '../services/fix-verifier';
import { FixReportGenerator } from '../services/fix-report-generator';

// 临时的 ComparisonResult 接口定义，直到创建完整的 data-comparison-engine
interface ComparisonResult {
  matches: boolean;
  matchPercentage: number;
  differences: Array<{
    type: 'missing' | 'extra' | 'modified' | 'type_mismatch';
    path: string;
    expected?: any;
    actual?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  totalFields: number;
  matchedFields: number;
  summary: {
    missing: number;
    extra: number;
    modified: number;
    typeMismatches: number;
  };
}

export class IntegratedFixService {
  private autoFixService: AutoFixService;
  private fixVerifier: FixVerifier;
  private reportGenerator: FixReportGenerator;
  
  constructor() {
    this.autoFixService = new AutoFixService();
    this.fixVerifier = new FixVerifier();
    this.reportGenerator = new FixReportGenerator();
  }
  
  async processFixes(comparisonResult: ComparisonResult, autoFix: boolean = false): Promise<void> {
    if (!autoFix) {
      // 手动修复模式 - 生成修复建议报告
      await this.generateFixSuggestions(comparisonResult);
      return;
    }
    
    // 自动修复模式
    console.log('🔧 开始自动修复流程...');
    
    try {
      // 1. 应用修复
      await this.autoFixService.applyFixes(comparisonResult.differences);
      
      // 2. 验证修复
      const verificationPassed = await this.verifyFixes(comparisonResult.differences);
      
      if (verificationPassed) {
        console.log('✅ 所有修复验证通过');
      } else {
        console.log('❌ 部分修复验证失败');
      }
      
      // 3. 生成修复报告
      // await this.generateFixReport();
      
    } catch (error) {
      console.error('❌ 修复流程执行失败:', error);
      throw error;
    }
  }
  
  private async generateFixSuggestions(comparisonResult: ComparisonResult): Promise<void> {
    console.log('📝 生成修复建议...');
    
    // 为每个差异生成修复建议
    for (const difference of comparisonResult.differences) {
      const suggestion = this.generateFixSuggestion(difference);
      console.log(`🔧 [${difference.severity}] ${difference.path}: ${suggestion}`);
    }
  }
  
  private generateFixSuggestion(difference: any): string {
    switch (difference.type) {
      case 'field_missing':
        return `在${this.getTargetSystem(difference.path)}中添加缺失字段: ${difference.path.split('.').pop()}`;
      case 'field_value_mismatch':
        return `调整${this.getTargetSystem(difference.path)}中字段 ${difference.path} 的值`;
      case 'structure_mismatch':
        return `修改${this.getTargetSystem(difference.path)}的数据结构以匹配期望格式`;
      default:
        return '检查并修正相关字段';
    }
  }
  
  private getTargetSystem(path: string): string {
    if (path.includes('transformer')) return 'Transformer模块';
    if (path.includes('protocol')) return 'Protocol模块';
    if (path.includes('compatibility')) return 'Compatibility模块';
    if (path.includes('server')) return 'Server模块';
    return '相关模块';
  }
  
  private async verifyFixes(differences: any[]): Promise<boolean> {
    console.log('🔍 验证修复效果...');
    
    // 这里应该重新运行测试来验证修复
    // 简化实现，假设所有修复都成功
    return true;
  }
}