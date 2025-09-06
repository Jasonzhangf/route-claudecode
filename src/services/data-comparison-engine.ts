/**
 * Data Comparison Engine
 * 
 * 用于比较和分析数据差异的引擎
 * 支持 RCC v4.0 与 Claude Code Router 的结果对比
 * 
 * @author RCC v4.0 Architecture
 * @version 1.0.0
 */

export interface Difference {
  type: 'missing' | 'extra' | 'modified' | 'type_mismatch';
  path: string;
  expected?: any;
  actual?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ComparisonResult {
  matches: boolean;
  matchPercentage: number;
  differences: Difference[];
  totalFields: number;
  matchedFields: number;
  summary: {
    missing: number;
    extra: number;
    modified: number;
    typeMismatches: number;
  };
}

export interface ComparisonOptions {
  ignoreOrder?: boolean;
  strictTypeCheck?: boolean;
  ignoredFields?: string[];
  maxDepth?: number;
}

export class DataComparisonEngine {
  constructor(private options: ComparisonOptions = {}) {
    this.options = {
      ignoreOrder: false,
      strictTypeCheck: true,
      ignoredFields: [],
      maxDepth: 10,
      ...options
    };
  }

  /**
   * 比较两个数据对象
   */
  compare(expected: any, actual: any, path: string = ''): ComparisonResult {
    const differences: Difference[] = [];
    let totalFields = 0;
    let matchedFields = 0;

    this.compareRecursive(expected, actual, path, differences, { totalFields, matchedFields }, 0);

    const finalTotalFields = totalFields || 1;
    const finalMatchedFields = matchedFields || 0;

    return {
      matches: differences.length === 0,
      matchPercentage: (finalMatchedFields / finalTotalFields) * 100,
      differences,
      totalFields: finalTotalFields,
      matchedFields: finalMatchedFields,
      summary: {
        missing: differences.filter(d => d.type === 'missing').length,
        extra: differences.filter(d => d.type === 'extra').length,
        modified: differences.filter(d => d.type === 'modified').length,
        typeMismatches: differences.filter(d => d.type === 'type_mismatch').length,
      }
    };
  }

  private compareRecursive(
    expected: any, 
    actual: any, 
    path: string, 
    differences: Difference[], 
    counters: { totalFields: number; matchedFields: number },
    depth: number
  ): void {
    if (depth > (this.options.maxDepth || 10)) {
      return;
    }

    counters.totalFields++;

    // 检查类型
    if (typeof expected !== typeof actual) {
      differences.push({
        type: 'type_mismatch',
        path,
        expected: typeof expected,
        actual: typeof actual,
        severity: 'medium',
        description: `Type mismatch: expected ${typeof expected}, got ${typeof actual}`
      });
      return;
    }

    // null/undefined 检查
    if (expected === null || expected === undefined) {
      if (expected === actual) {
        counters.matchedFields++;
      } else {
        differences.push({
          type: 'modified',
          path,
          expected,
          actual,
          severity: 'low',
          description: `Value mismatch: expected ${expected}, got ${actual}`
        });
      }
      return;
    }

    // 基本类型比较
    if (typeof expected !== 'object') {
      if (expected === actual) {
        counters.matchedFields++;
      } else {
        differences.push({
          type: 'modified',
          path,
          expected,
          actual,
          severity: 'low',
          description: `Value mismatch: expected "${expected}", got "${actual}"`
        });
      }
      return;
    }

    // 数组比较
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        differences.push({
          type: 'type_mismatch',
          path,
          expected: 'array',
          actual: typeof actual,
          severity: 'medium',
          description: `Expected array, got ${typeof actual}`
        });
        return;
      }

      if (expected.length !== actual.length) {
        differences.push({
          type: 'modified',
          path: `${path}.length`,
          expected: expected.length,
          actual: actual.length,
          severity: 'medium',
          description: `Array length mismatch: expected ${expected.length}, got ${actual.length}`
        });
      }

      const minLength = Math.min(expected.length, actual.length);
      for (let i = 0; i < minLength; i++) {
        this.compareRecursive(
          expected[i], 
          actual[i], 
          `${path}[${i}]`, 
          differences, 
          counters, 
          depth + 1
        );
      }
      return;
    }

    // 对象比较
    if (typeof expected === 'object' && expected !== null) {
      if (typeof actual !== 'object' || actual === null) {
        differences.push({
          type: 'type_mismatch',
          path,
          expected: 'object',
          actual: typeof actual,
          severity: 'medium',
          description: `Expected object, got ${typeof actual}`
        });
        return;
      }

      const expectedKeys = Object.keys(expected);
      const actualKeys = Object.keys(actual);

      // 检查缺失的字段
      for (const key of expectedKeys) {
        if (this.options.ignoredFields?.includes(key)) {
          continue;
        }

        const fieldPath = path ? `${path}.${key}` : key;
        
        if (!(key in actual)) {
          differences.push({
            type: 'missing',
            path: fieldPath,
            expected: expected[key],
            severity: 'high',
            description: `Missing field: ${key}`
          });
        } else {
          this.compareRecursive(
            expected[key], 
            actual[key], 
            fieldPath, 
            differences, 
            counters, 
            depth + 1
          );
        }
      }

      // 检查额外的字段
      for (const key of actualKeys) {
        if (this.options.ignoredFields?.includes(key)) {
          continue;
        }
        
        if (!(key in expected)) {
          const fieldPath = path ? `${path}.${key}` : key;
          differences.push({
            type: 'extra',
            path: fieldPath,
            actual: actual[key],
            severity: 'low',
            description: `Extra field: ${key}`
          });
        }
      }
    }
  }

  /**
   * 生成人类可读的比较报告
   */
  generateReport(result: ComparisonResult): string {
    const lines: string[] = [];
    
    lines.push(`=== Data Comparison Report ===`);
    lines.push(`Match: ${result.matches ? 'YES' : 'NO'}`);
    lines.push(`Match Percentage: ${result.matchPercentage.toFixed(2)}%`);
    lines.push(`Total Fields: ${result.totalFields}`);
    lines.push(`Matched Fields: ${result.matchedFields}`);
    lines.push(`Total Differences: ${result.differences.length}`);
    lines.push('');

    if (result.differences.length > 0) {
      lines.push('=== Differences ===');
      for (const diff of result.differences) {
        lines.push(`[${diff.severity.toUpperCase()}] ${diff.type}: ${diff.path}`);
        lines.push(`  Description: ${diff.description}`);
        if (diff.expected !== undefined) {
          lines.push(`  Expected: ${JSON.stringify(diff.expected)}`);
        }
        if (diff.actual !== undefined) {
          lines.push(`  Actual: ${JSON.stringify(diff.actual)}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

/**
 * 默认的数据比较引擎实例
 */
export const defaultComparisonEngine = new DataComparisonEngine({
  ignoreOrder: false,
  strictTypeCheck: true,
  ignoredFields: ['timestamp', 'requestId', 'created'],
  maxDepth: 15
});