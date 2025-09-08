# 数据对比功能实现

## 1. 对比引擎设计

### 1.1 对比引擎接口

```typescript
// src/services/data-comparison-engine.ts
export interface ComparisonResult {
  isEqual: boolean;
  differences: Difference[];
  summary: ComparisonSummary;
}

export interface Difference {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'type_mismatch';
  expected?: any;
  actual?: any;
  severity: 'critical' | 'warning' | 'info';
}

export interface ComparisonSummary {
  totalDifferences: number;
  criticalDifferences: number;
  warningDifferences: number;
  infoDifferences: number;
}

export interface ComparisonConfig {
  ignoreFields?: string[];
  tolerance?: {
    numeric?: number;
    string?: 'exact' | 'case_insensitive' | 'whitespace_insensitive';
  };
  customComparators?: Record<string, (a: any, b: any) => boolean>;
}

export interface DataComparisonEngine {
  compare(expected: any, actual: any, config?: ComparisonConfig): ComparisonResult;
  compareAtPath(expected: any, actual: any, path: string, config?: ComparisonConfig): ComparisonResult;
}
```

### 1.2 对比引擎实现

```typescript
// src/services/json-comparison-engine.ts
import { DataComparisonEngine, ComparisonResult, Difference, ComparisonSummary, ComparisonConfig } from './data-comparison-engine';
import { JQJsonHandler } from '../utils/jq-json-handler';

export class JSONComparisonEngine implements DataComparisonEngine {
  compare(expected: any, actual: any, config?: ComparisonConfig): ComparisonResult {
    const differences: Difference[] = [];
    this.compareRecursive(expected, actual, '', differences, config || {});
    
    const summary = this.generateSummary(differences);
    
    return {
      isEqual: differences.length === 0,
      differences,
      summary
    };
  }
  
  compareAtPath(expected: any, actual: any, path: string, config?: ComparisonConfig): ComparisonResult {
    // 获取指定路径的值
    const expectedValue = this.getValueAtPath(expected, path);
    const actualValue = this.getValueAtPath(actual, path);
    
    return this.compare(expectedValue, actualValue, config);
  }
  
  private compareRecursive(expected: any, actual: any, path: string, differences: Difference[], config: ComparisonConfig): void {
    // 检查是否应该忽略此字段
    if (config.ignoreFields && config.ignoreFields.includes(path)) {
      return;
    }
    
    // 类型检查
    if (typeof expected !== typeof actual) {
      differences.push({
        path,
        type: 'type_mismatch',
        expected,
        actual,
        severity: 'critical'
      });
      return;
    }
    
    // null检查
    if (expected === null && actual === null) {
      return;
    }
    
    if (expected === null || actual === null) {
      differences.push({
        path,
        type: expected === null ? 'added' : 'removed',
        expected,
        actual,
        severity: 'critical'
      });
      return;
    }
    
    // 根据类型进行比较
    switch (typeof expected) {
      case 'object':
        if (Array.isArray(expected) && Array.isArray(actual)) {
          this.compareArrays(expected, actual, path, differences, config);
        } else if (!Array.isArray(expected) && !Array.isArray(actual)) {
          this.compareObjects(expected, actual, path, differences, config);
        } else {
          differences.push({
            path,
            type: 'type_mismatch',
            expected,
            actual,
            severity: 'critical'
          });
        }
        break;
        
      case 'string':
        this.compareStrings(expected, actual, path, differences, config);
        break;
        
      case 'number':
        this.compareNumbers(expected, actual, path, differences, config);
        break;
        
      default:
        if (expected !== actual) {
          differences.push({
            path,
            type: 'modified',
            expected,
            actual,
            severity: 'warning'
          });
        }
        break;
    }
  }
  
  private compareObjects(expected: any, actual: any, path: string, differences: Difference[], config: ComparisonConfig): void {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    
    // 检查缺失的键
    for (const key of expectedKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!(key in actual)) {
        differences.push({
          path: currentPath,
          type: 'removed',
          expected: expected[key],
          actual: undefined,
          severity: 'critical'
        });
      } else {
        this.compareRecursive(expected[key], actual[key], currentPath, differences, config);
      }
    }
    
    // 检查额外的键
    for (const key of actualKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!(key in expected)) {
        differences.push({
          path: currentPath,
          type: 'added',
          expected: undefined,
          actual: actual[key],
          severity: 'warning'
        });
      }
    }
  }
  
  private compareArrays(expected: any[], actual: any[], path: string, differences: Difference[], config: ComparisonConfig): void {
    const maxLength = Math.max(expected.length, actual.length);
    
    for (let i = 0; i < maxLength; i++) {
      const currentPath = `${path}[${i}]`;
      
      if (i >= expected.length) {
        differences.push({
          path: currentPath,
          type: 'added',
          expected: undefined,
          actual: actual[i],
          severity: 'warning'
        });
      } else if (i >= actual.length) {
        differences.push({
          path: currentPath,
          type: 'removed',
          expected: expected[i],
          actual: undefined,
          severity: 'critical'
        });
      } else {
        this.compareRecursive(expected[i], actual[i], currentPath, differences, config);
      }
    }
  }
  
  private compareStrings(expected: string, actual: string, path: string, differences: Difference[], config: ComparisonConfig): void {
    let stringsEqual = false;
    
    if (config.tolerance?.string === 'case_insensitive') {
      stringsEqual = expected.toLowerCase() === actual.toLowerCase();
    } else if (config.tolerance?.string === 'whitespace_insensitive') {
      stringsEqual = expected.trim() === actual.trim();
    } else {
      stringsEqual = expected === actual;
    }
    
    if (!stringsEqual) {
      const severity = this.isCriticalStringField(path) ? 'critical' : 'warning';
      differences.push({
        path,
        type: 'modified',
        expected,
        actual,
        severity
      });
    }
  }
  
  private compareNumbers(expected: number, actual: number, path: string, differences: Difference[], config: ComparisonConfig): void {
    let numbersEqual = false;
    
    if (config.tolerance?.numeric) {
      numbersEqual = Math.abs(expected - actual) <= config.tolerance.numeric;
    } else {
      numbersEqual = expected === actual;
    }
    
    if (!numbersEqual) {
      const severity = this.isCriticalNumberField(path) ? 'critical' : 'warning';
      differences.push({
        path,
        type: 'modified',
        expected,
        actual,
        severity
      });
    }
  }
  
  private isCriticalStringField(path: string): boolean {
    const criticalFields = [
      'model',
      'role',
      'tool_calls.function.name',
      'finish_reason'
    ];
    
    return criticalFields.some(field => path.includes(field));
  }
  
  private isCriticalNumberField(path: string): boolean {
    const criticalFields = [
      'usage.total_tokens',
      'usage.prompt_tokens',
      'usage.completion_tokens'
    ];
    
    return criticalFields.some(field => path.includes(field));
  }
  
  private generateSummary(differences: Difference[]): ComparisonSummary {
    const criticalDifferences = differences.filter(d => d.severity === 'critical').length;
    const warningDifferences = differences.filter(d => d.severity === 'warning').length;
    const infoDifferences = differences.filter(d => d.severity === 'info').length;
    
    return {
      totalDifferences: differences.length,
      criticalDifferences,
      warningDifferences,
      infoDifferences
    };
  }
  
  private getValueAtPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // 处理数组索引
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
        current = current[arrayKey]?.[index];
      } else {
        current = current[key];
      }
    }
    
    return current;
  }
}
```

## 2. 差异分析器设计

### 2.1 差异分析器接口

```typescript
// src/services/difference-analyzer.ts
import { Difference, ComparisonResult } from './data-comparison-engine';

export interface DifferenceAnalysis {
  category: 'field_missing' | 'field_extra' | 'value_mismatch' | 'type_mismatch' | 'structure_mismatch';
  fieldPath: string;
  description: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DifferenceAnalyzer {
  analyze(differences: Difference[]): DifferenceAnalysis[];
  generateFixSuggestions(differences: Difference[], system: string): string[];
}
```

### 2.2 差异分析器实现

```typescript
// src/services/difference-analyzer.ts
import { Difference, ComparisonResult } from './data-comparison-engine';
import { DifferenceAnalysis, DifferenceAnalyzer } from './difference-analyzer';

export class DefaultDifferenceAnalyzer implements DifferenceAnalyzer {
  analyze(differences: Difference[]): DifferenceAnalysis[] {
    return differences.map(diff => this.analyzeDifference(diff));
  }
  
  generateFixSuggestions(differences: Difference[], system: string): string[] {
    const analyses = this.analyze(differences);
    return analyses.map(analysis => analysis.suggestion);
  }
  
  private analyzeDifference(diff: Difference): DifferenceAnalysis {
    switch (diff.type) {
      case 'added':
        return {
          category: 'field_extra',
          fieldPath: diff.path,
          description: `字段 ${diff.path} 在实际结果中存在但在预期结果中不存在`,
          suggestion: `检查是否需要在${this.getSystemName()}中移除字段 ${diff.path} 或在预期结果中添加该字段`,
          priority: 'medium'
        };
        
      case 'removed':
        return {
          category: 'field_missing',
          fieldPath: diff.path,
          description: `字段 ${diff.path} 在预期结果中存在但在实际结果中不存在`,
          suggestion: `检查是否需要在${this.getSystemName()}中添加字段 ${diff.path} 或从预期结果中移除该字段`,
          priority: 'high'
        };
        
      case 'modified':
        return {
          category: 'value_mismatch',
          fieldPath: diff.path,
          description: `字段 ${diff.path} 的值不匹配。预期: ${this.formatValue(diff.expected)}, 实际: ${this.formatValue(diff.actual)}`,
          suggestion: `检查${this.getSystemName()}中字段 ${diff.path} 的值转换逻辑`,
          priority: diff.severity === 'critical' ? 'high' : 'medium'
        };
        
      case 'type_mismatch':
        return {
          category: 'type_mismatch',
          fieldPath: diff.path,
          description: `字段 ${diff.path} 的类型不匹配。预期类型: ${typeof diff.expected}, 实际类型: ${typeof diff.actual}`,
          suggestion: `检查${this.getSystemName()}中字段 ${diff.path} 的类型转换逻辑`,
          priority: 'high'
        };
        
      default:
        return {
          category: 'structure_mismatch',
          fieldPath: diff.path,
          description: `字段 ${diff.path} 结构不匹配`,
          suggestion: `检查${this.getSystemName()}中字段 ${diff.path} 的结构处理逻辑`,
          priority: 'medium'
        };
    }
  }
  
  private getSystemName(): string {
    // 这里应该根据上下文确定是Claude Code Router还是我们的实现
    return '目标系统';
  }
  
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
```

## 3. 报告生成器设计

### 3.1 报告生成器接口

```typescript
// src/services/report-generator.ts
import { ComparisonResult } from './data-comparison-engine';
import { DifferenceAnalysis } from './difference-analyzer';

export interface ComparisonReport {
  timestamp: string;
  systems: {
    expected: string;
    actual: string;
  };
  summary: {
    totalDifferences: number;
    criticalDifferences: number;
    warningDifferences: number;
    isEqual: boolean;
  };
  differences: DifferenceReport[];
  analysis: DifferenceAnalysis[];
  recommendations: string[];
}

export interface DifferenceReport {
  path: string;
  type: string;
  expected: any;
  actual: any;
  severity: string;
  description: string;
}

export interface ReportGenerator {
  generateReport(comparisonResult: ComparisonResult, analysis: DifferenceAnalysis[]): ComparisonReport;
  generateDetailedReport(comparisonResult: ComparisonResult, analysis: DifferenceAnalysis[]): string;
}
```

### 3.2 报告生成器实现

```typescript
// src/services/report-generator.ts
import { ComparisonResult } from './data-comparison-engine';
import { DifferenceAnalysis, DifferenceAnalyzer } from './difference-analyzer';
import { ComparisonReport, DifferenceReport, ReportGenerator } from './report-generator';
import { JQJsonHandler } from '../utils/jq-json-handler';

export class DefaultReportGenerator implements ReportGenerator {
  generateReport(comparisonResult: ComparisonResult, analysis: DifferenceAnalysis[]): ComparisonReport {
    const differences: DifferenceReport[] = comparisonResult.differences.map(diff => ({
      path: diff.path,
      type: diff.type,
      expected: diff.expected,
      actual: diff.actual,
      severity: diff.severity,
      description: this.getDifferenceDescription(diff)
    }));
    
    const recommendations = analysis
      .filter(a => a.priority === 'high')
      .map(a => a.suggestion);
    
    return {
      timestamp: new Date().toISOString(),
      systems: {
        expected: 'Claude Code Router',
        actual: 'Our Implementation'
      },
      summary: {
        totalDifferences: comparisonResult.summary.totalDifferences,
        criticalDifferences: comparisonResult.summary.criticalDifferences,
        warningDifferences: comparisonResult.summary.warningDifferences,
        isEqual: comparisonResult.isEqual
      },
      differences,
      analysis,
      recommendations
    };
  }
  
  generateDetailedReport(comparisonResult: ComparisonResult, analysis: DifferenceAnalysis[]): string {
    const report = this.generateReport(comparisonResult, analysis);
    
    let output = `# 数据对比报告\n\n`;
    output += `## 基本信息\n`;
    output += `- 生成时间: ${report.timestamp}\n`;
    output += `- 对比系统: ${report.systems.expected} vs ${report.systems.actual}\n\n`;
    
    output += `## 概要\n`;
    output += `- 总差异数: ${report.summary.totalDifferences}\n`;
    output += `- 严重差异数: ${report.summary.criticalDifferences}\n`;
    output += `- 警告差异数: ${report.summary.warningDifferences}\n`;
    output += `- 数据是否相等: ${report.summary.isEqual ? '是' : '否'}\n\n`;
    
    if (report.recommendations.length > 0) {
      output += `## 修复建议\n`;
      report.recommendations.forEach((rec, index) => {
        output += `${index + 1}. ${rec}\n`;
      });
      output += `\n`;
    }
    
    if (report.differences.length > 0) {
      output += `## 详细差异\n`;
      report.differences.forEach((diff, index) => {
        output += `${index + 1}. [${diff.severity.toUpperCase()}] ${diff.path}\n`;
        output += `   类型: ${diff.type}\n`;
        output += `   描述: ${diff.description}\n`;
        output += `   预期: ${this.formatValueForReport(diff.expected)}\n`;
        output += `   实际: ${this.formatValueForReport(diff.actual)}\n\n`;
      });
    }
    
    if (report.analysis.length > 0) {
      output += `## 差异分析\n`;
      report.analysis.forEach((analysis, index) => {
        output += `${index + 1}. [${analysis.priority.toUpperCase()}] ${analysis.fieldPath}\n`;
        output += `   分类: ${analysis.category}\n`;
        output += `   描述: ${analysis.description}\n`;
        output += `   建议: ${analysis.suggestion}\n\n`;
      });
    }
    
    return output;
  }
  
  private getDifferenceDescription(diff: any): string {
    switch (diff.type) {
      case 'added':
        return `字段 ${diff.path} 在实际结果中存在但在预期结果中不存在`;
      case 'removed':
        return `字段 ${diff.path} 在预期结果中存在但在实际结果中不存在`;
      case 'modified':
        return `字段 ${diff.path} 的值不匹配`;
      case 'type_mismatch':
        return `字段 ${diff.path} 的类型不匹配`;
      default:
        return `字段 ${diff.path} 结构不匹配`;
    }
  }
  
  private formatValueForReport(value: any): string {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      if (value.length > 100) {
        return `"${value.substring(0, 100)}..."`;
      }
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      const jsonString = JQJsonHandler.stringifyJson(value);
      if (jsonString.length > 100) {
        return `${jsonString.substring(0, 100)}...}`;
      }
      return jsonString;
    }
    return String(value);
  }
}
```

## 4. 集成到测试系统

### 4.1 测试服务集成

```typescript
// src/services/test-comparison-service.ts
import { DataCaptureService, DataCaptureEntry } from './data-capture-service';
import { DataComparisonEngine } from './data-comparison-engine';
import { DifferenceAnalyzer } from './difference-analyzer';
import { ReportGenerator } from './report-generator';
import { ComparisonConfig } from './data-comparison-engine';

export interface TestComparisonResult {
  sessionId: string;
  isEqual: boolean;
  report: string;
  differences: number;
  criticalDifferences: number;
}

export class TestComparisonService {
  constructor(
    private dataCaptureService: DataCaptureService,
    private comparisonEngine: DataComparisonEngine,
    private differenceAnalyzer: DifferenceAnalyzer,
    private reportGenerator: ReportGenerator
  ) {}
  
  async compareSession(sessionId: string, config?: ComparisonConfig): Promise<TestComparisonResult> {
    // 获取会话的所有数据条目
    const entries = await this.dataCaptureService.query({
      sessionId: sessionId
    });
    
    // 分别获取Claude Code Router和我们实现的数据
    const claudeData = this.filterDataBySystem(entries, 'claude-code-router');
    const ourData = this.filterDataBySystem(entries, 'our-implementation');
    
    // 按阶段和方向进行对比
    const comparisonResults = [];
    for (const claudeEntry of claudeData) {
      const ourEntry = this.findMatchingEntry(ourData, claudeEntry);
      if (ourEntry) {
        const result = this.comparisonEngine.compare(claudeEntry.data, ourEntry.data, config);
        comparisonResults.push({
          stage: claudeEntry.stage,
          direction: claudeEntry.direction,
          result
        });
      }
    }
    
    // 生成综合报告
    const overallResult = this.combineComparisonResults(comparisonResults);
    const analysis = this.differenceAnalyzer.analyze(
      comparisonResults.flatMap(cr => cr.result.differences)
    );
    const report = this.reportGenerator.generateDetailedReport(overallResult, analysis);
    
    return {
      sessionId,
      isEqual: overallResult.isEqual,
      report,
      differences: overallResult.summary.totalDifferences,
      criticalDifferences: overallResult.summary.criticalDifferences
    };
  }
  
  private filterDataBySystem(entries: DataCaptureEntry[], system: string): DataCaptureEntry[] {
    return entries.filter(entry => entry.system === system);
  }
  
  private findMatchingEntry(entries: DataCaptureEntry[], target: DataCaptureEntry): DataCaptureEntry | undefined {
    return entries.find(entry => 
      entry.stage === target.stage && 
      entry.direction === target.direction &&
      entry.sessionId === target.sessionId
    );
  }
  
  private combineComparisonResults(results: any[]): any {
    const allDifferences = results.flatMap(r => r.result.differences);
    const summary = {
      totalDifferences: allDifferences.length,
      criticalDifferences: allDifferences.filter(d => d.severity === 'critical').length,
      warningDifferences: allDifferences.filter(d => d.severity === 'warning').length,
      infoDifferences: allDifferences.filter(d => d.severity === 'info').length
    };
    
    return {
      isEqual: allDifferences.length === 0,
      differences: allDifferences,
      summary
    };
  }
}
```

### 4.2 命令行接口

```typescript
// src/cli/compare-command.ts
import { TestComparisonService } from '../services/test-comparison-service';
import { ComparisonConfig } from '../services/data-comparison-engine';

export class CompareCommand {
  constructor(private comparisonService: TestComparisonService) {}
  
  async execute(sessionId: string, options: any): Promise<void> {
    try {
      const config: ComparisonConfig = {
        ignoreFields: options.ignoreFields ? options.ignoreFields.split(',') : [],
        tolerance: {
          numeric: options.numericTolerance ? parseFloat(options.numericTolerance) : undefined,
          string: options.stringTolerance
        }
      };
      
      const result = await this.comparisonService.compareSession(sessionId, config);
      
      console.log(`会话 ${sessionId} 对比结果:`);
      console.log(`数据是否相等: ${result.isEqual ? '是' : '否'}`);
      console.log(`总差异数: ${result.differences}`);
      console.log(`严重差异数: ${result.criticalDifferences}`);
      
      if (!result.isEqual) {
        console.log('\n详细报告:');
        console.log(result.report);
      }
      
      // 如果指定了输出文件，保存报告
      if (options.output) {
        await this.saveReport(result.report, options.output);
        console.log(`报告已保存到: ${options.output}`);
      }
    } catch (error) {
      console.error('对比执行失败:', error.message);
      process.exit(1);
    }
  }
  
  private async saveReport(report: string, filePath: string): Promise<void> {
    const { writeFile } = require('fs').promises;
    await writeFile(filePath, report);
  }
}
```