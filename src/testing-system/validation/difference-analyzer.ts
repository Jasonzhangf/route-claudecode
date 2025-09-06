/**
 * 差异分析器 - 完整实现
 * 用于比较实际结果与期望结果，提供详细的差异分析和修复建议
 */

import { EventEmitter } from 'events';
import { getEnhancedErrorHandler, ValidationError } from '../../modules/error-handler/src/enhanced-error-handler';
import { secureLogger } from '../../modules/error-handler/src/utils/secure-logger';
import { createHash } from 'crypto';

// 差异类型
export enum DifferenceType {
  STRUCTURE_DIFF = 'structure_diff',
  CONTENT_DIFF = 'content_diff',
  FORMAT_DIFF = 'format_diff',
  PERFORMANCE_DIFF = 'performance_diff',
  BEHAVIOR_DIFF = 'behavior_diff',
  MISSING_FIELD = 'missing_field',
  EXTRA_FIELD = 'extra_field',
  TYPE_MISMATCH = 'type_mismatch',
  VALUE_MISMATCH = 'value_mismatch'
}

// 差异严重程度
export enum SeverityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

// 差异详情
export interface DifferenceDetail {
  type: DifferenceType;
  severity: SeverityLevel;
  path: string;
  expected: any;
  actual: any;
  message: string;
  context?: Record<string, any>;
}

// 比较结果
export interface ComparisonResult {
  comparisonId: string;
  timestamp: string;
  isMatch: boolean;
  score: number; // 0-1, 1表示完全匹配
  differences: DifferenceDetail[];
  summary: {
    totalDifferences: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  analysis: {
    structuralSimilarity: number;
    contentSimilarity: number;
    formatConsistency: number;
    performanceComparison?: {
      timeDifference: number;
      memoryDifference: number;
    };
  };
  recommendations: string[];
}

// 比较配置
export interface ComparisonConfig {
  ignoreOrder: boolean;
  ignoreCase: boolean;
  ignorePaths: string[];
  tolerances: {
    numeric: number;
    percentage: number;
    timing: number;
  };
  customComparators: Map<string, (expected: any, actual: any) => boolean>;
  strictMode: boolean;
}

// 差异分析器错误类型
class ComparisonError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Comparison error: ${message}`, details);
  }
}

class AnalysisError extends ValidationError {
  constructor(message: string, comparisonId?: string) {
    super(`Analysis error: ${message}`, { comparisonId });
  }
}

/**
 * 差异分析器实现
 */
export class DifferenceAnalyzer extends EventEmitter {
  private errorHandler = getEnhancedErrorHandler();
  private defaultConfig: ComparisonConfig;

  constructor(config?: Partial<ComparisonConfig>) {
    super();
    
    this.defaultConfig = {
      ignoreOrder: false,
      ignoreCase: false,
      ignorePaths: [],
      tolerances: {
        numeric: 0.001,
        percentage: 0.01,
        timing: 10 // ms
      },
      customComparators: new Map(),
      strictMode: true,
      ...config
    };
  }

  /**
   * 比较两个结果
   */
  public async compareResults(
    expected: any,
    actual: any,
    context?: {
      testId?: string;
      category?: string;
      metadata?: Record<string, any>;
    },
    config?: Partial<ComparisonConfig>
  ): Promise<ComparisonResult> {
    const comparisonId = this.generateComparisonId(expected, actual, context);
    const startTime = Date.now();

    secureLogger.info('Starting result comparison', {
      comparisonId,
      testId: context?.testId,
      category: context?.category
    });

    const effectiveConfig = { ...this.defaultConfig, ...config };
    const differences: DifferenceDetail[] = [];

    // 开始深度比较
    this.deepCompare(expected, actual, '', differences, effectiveConfig);

    // 计算相似度分数
    const analysis = this.calculateSimilarity(expected, actual, differences);
    
    // 计算整体匹配分数
    const score = this.calculateOverallScore(differences, analysis);
    
    // 生成修复建议
    const recommendations = this.generateRecommendations(differences, analysis);

    // 统计差异
    const summary = this.summarizeDifferences(differences);

    const result: ComparisonResult = {
      comparisonId,
      timestamp: new Date().toISOString(),
      isMatch: differences.length === 0,
      score,
      differences,
      summary,
      analysis,
      recommendations
    };

    const processingTime = Date.now() - startTime;

    secureLogger.info('Comparison completed', {
      comparisonId,
      isMatch: result.isMatch,
      score: result.score,
      differenceCount: differences.length,
      processingTime
    });

    this.emit('comparisonCompleted', result);
    return result;
  }

  /**
   * 深度比较两个对象
   */
  private deepCompare(
    expected: any,
    actual: any,
    path: string,
    differences: DifferenceDetail[],
    config: ComparisonConfig
  ): void {
    // 检查是否应忽略此路径
    if (config.ignorePaths.includes(path)) {
      return;
    }

    // 检查类型匹配
    if (typeof expected !== typeof actual) {
      differences.push({
        type: DifferenceType.TYPE_MISMATCH,
        severity: SeverityLevel.HIGH,
        path,
        expected,
        actual,
        message: `Type mismatch: expected ${typeof expected}, got ${typeof actual}`
      });
      return;
    }

    // 处理null和undefined
    if (expected === null || actual === null || expected === undefined || actual === undefined) {
      if (expected !== actual) {
        differences.push({
          type: DifferenceType.VALUE_MISMATCH,
          severity: SeverityLevel.MEDIUM,
          path,
          expected,
          actual,
          message: `Null/undefined mismatch: expected ${expected}, got ${actual}`
        });
      }
      return;
    }

    // 处理原始类型
    if (typeof expected !== 'object') {
      this.comparePrimitives(expected, actual, path, differences, config);
      return;
    }

    // 处理数组
    if (Array.isArray(expected) && Array.isArray(actual)) {
      this.compareArrays(expected, actual, path, differences, config);
      return;
    }

    // 处理对象
    if (typeof expected === 'object' && typeof actual === 'object') {
      this.compareObjects(expected, actual, path, differences, config);
      return;
    }

    // 默认情况：直接比较
    if (expected !== actual) {
      differences.push({
        type: DifferenceType.VALUE_MISMATCH,
        severity: SeverityLevel.MEDIUM,
        path,
        expected,
        actual,
        message: `Value mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      });
    }
  }

  /**
   * 比较原始类型
   */
  private comparePrimitives(
    expected: any,
    actual: any,
    path: string,
    differences: DifferenceDetail[],
    config: ComparisonConfig
  ): void {
    // 数值比较，考虑容差
    if (typeof expected === 'number' && typeof actual === 'number') {
      const diff = Math.abs(expected - actual);
      const relativeDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
      
      if (diff > config.tolerances.numeric && relativeDiff > config.tolerances.percentage) {
        differences.push({
          type: DifferenceType.VALUE_MISMATCH,
          severity: diff > expected * 0.1 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
          path,
          expected,
          actual,
          message: `Numeric value mismatch: expected ${expected}, got ${actual} (diff: ${diff.toFixed(6)})`
        });
      }
      return;
    }

    // 字符串比较，考虑大小写设置
    if (typeof expected === 'string' && typeof actual === 'string') {
      const expectedStr = config.ignoreCase ? expected.toLowerCase() : expected;
      const actualStr = config.ignoreCase ? actual.toLowerCase() : actual;
      
      if (expectedStr !== actualStr) {
        differences.push({
          type: DifferenceType.CONTENT_DIFF,
          severity: this.calculateStringSeverity(expectedStr, actualStr),
          path,
          expected,
          actual,
          message: `String mismatch: expected "${expected}", got "${actual}"`
        });
      }
      return;
    }

    // 布尔值和其他类型直接比较
    if (expected !== actual) {
      differences.push({
        type: DifferenceType.VALUE_MISMATCH,
        severity: SeverityLevel.MEDIUM,
        path,
        expected,
        actual,
        message: `Value mismatch: expected ${expected}, got ${actual}`
      });
    }
  }

  /**
   * 比较数组
   */
  private compareArrays(
    expected: any[],
    actual: any[],
    path: string,
    differences: DifferenceDetail[],
    config: ComparisonConfig
  ): void {
    // 长度比较
    if (expected.length !== actual.length) {
      differences.push({
        type: DifferenceType.STRUCTURE_DIFF,
        severity: SeverityLevel.HIGH,
        path,
        expected: expected.length,
        actual: actual.length,
        message: `Array length mismatch: expected ${expected.length}, got ${actual.length}`
      });
    }

    // 元素比较
    const maxLength = Math.max(expected.length, actual.length);
    
    if (config.ignoreOrder) {
      // 忽略顺序的比较
      this.compareArraysIgnoreOrder(expected, actual, path, differences, config);
    } else {
      // 按顺序比较
      for (let i = 0; i < maxLength; i++) {
        const itemPath = `${path}[${i}]`;
        
        if (i >= expected.length) {
          differences.push({
            type: DifferenceType.EXTRA_FIELD,
            severity: SeverityLevel.MEDIUM,
            path: itemPath,
            expected: undefined,
            actual: actual[i],
            message: `Extra array item at index ${i}`
          });
        } else if (i >= actual.length) {
          differences.push({
            type: DifferenceType.MISSING_FIELD,
            severity: SeverityLevel.MEDIUM,
            path: itemPath,
            expected: expected[i],
            actual: undefined,
            message: `Missing array item at index ${i}`
          });
        } else {
          this.deepCompare(expected[i], actual[i], itemPath, differences, config);
        }
      }
    }
  }

  /**
   * 忽略顺序的数组比较
   */
  private compareArraysIgnoreOrder(
    expected: any[],
    actual: any[],
    path: string,
    differences: DifferenceDetail[],
    config: ComparisonConfig
  ): void {
    const expectedCopy = [...expected];
    const actualCopy = [...actual];
    
    // 尝试匹配每个元素
    for (let i = 0; i < expectedCopy.length; i++) {
      let foundMatch = false;
      
      for (let j = 0; j < actualCopy.length; j++) {
        const tempDifferences: DifferenceDetail[] = [];
        this.deepCompare(expectedCopy[i], actualCopy[j], `${path}[${i}]`, tempDifferences, config);
        
        if (tempDifferences.length === 0) {
          // 找到匹配，移除已匹配的元素
          actualCopy.splice(j, 1);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        differences.push({
          type: DifferenceType.MISSING_FIELD,
          severity: SeverityLevel.MEDIUM,
          path: `${path}[${i}]`,
          expected: expectedCopy[i],
          actual: undefined,
          message: `No matching element found in actual array`
        });
      }
    }
    
    // 剩余的actual元素都是多余的
    for (const extraItem of actualCopy) {
      differences.push({
        type: DifferenceType.EXTRA_FIELD,
        severity: SeverityLevel.MEDIUM,
        path: `${path}[extra]`,
        expected: undefined,
        actual: extraItem,
        message: `Extra element in actual array`
      });
    }
  }

  /**
   * 比较对象
   */
  private compareObjects(
    expected: any,
    actual: any,
    path: string,
    differences: DifferenceDetail[],
    config: ComparisonConfig
  ): void {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    const allKeys = new Set([...expectedKeys, ...actualKeys]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      
      if (!(key in expected)) {
        differences.push({
          type: DifferenceType.EXTRA_FIELD,
          severity: SeverityLevel.LOW,
          path: keyPath,
          expected: undefined,
          actual: actual[key],
          message: `Extra field: ${key}`
        });
      } else if (!(key in actual)) {
        differences.push({
          type: DifferenceType.MISSING_FIELD,
          severity: SeverityLevel.MEDIUM,
          path: keyPath,
          expected: expected[key],
          actual: undefined,
          message: `Missing field: ${key}`
        });
      } else {
        // 检查自定义比较器
        const customComparator = config.customComparators.get(keyPath);
        if (customComparator) {
          if (!customComparator(expected[key], actual[key])) {
            differences.push({
              type: DifferenceType.VALUE_MISMATCH,
              severity: SeverityLevel.MEDIUM,
              path: keyPath,
              expected: expected[key],
              actual: actual[key],
              message: `Custom comparison failed for field: ${key}`
            });
          }
        } else {
          this.deepCompare(expected[key], actual[key], keyPath, differences, config);
        }
      }
    }
  }

  /**
   * 计算相似度分析
   */
  private calculateSimilarity(expected: any, actual: any, differences: DifferenceDetail[]): ComparisonResult['analysis'] {
    const structuralSimilarity = this.calculateStructuralSimilarity(expected, actual);
    const contentSimilarity = this.calculateContentSimilarity(expected, actual, differences);
    const formatConsistency = this.calculateFormatConsistency(expected, actual);

    return {
      structuralSimilarity,
      contentSimilarity,
      formatConsistency
    };
  }

  /**
   * 计算结构相似度
   */
  private calculateStructuralSimilarity(expected: any, actual: any): number {
    if (typeof expected !== typeof actual) {
      return 0;
    }

    if (typeof expected !== 'object' || expected === null) {
      return expected === actual ? 1 : 0;
    }

    if (Array.isArray(expected) && Array.isArray(actual)) {
      const lengthSimilarity = 1 - Math.abs(expected.length - actual.length) / Math.max(expected.length, actual.length, 1);
      return lengthSimilarity;
    }

    if (typeof expected === 'object' && typeof actual === 'object') {
      const expectedKeys = Object.keys(expected);
      const actualKeys = Object.keys(actual);
      const commonKeys = expectedKeys.filter(key => actualKeys.includes(key));
      const totalKeys = new Set([...expectedKeys, ...actualKeys]).size;
      
      return totalKeys > 0 ? commonKeys.length / totalKeys : 1;
    }

    return 0;
  }

  /**
   * 计算内容相似度
   */
  private calculateContentSimilarity(expected: any, actual: any, differences: DifferenceDetail[]): number {
    const totalFields = this.countTotalFields(expected);
    if (totalFields === 0) return 1;

    const diffFields = differences.filter(d => 
      d.type === DifferenceType.VALUE_MISMATCH || 
      d.type === DifferenceType.CONTENT_DIFF
    ).length;

    return Math.max(0, 1 - diffFields / totalFields);
  }

  /**
   * 计算格式一致性
   */
  private calculateFormatConsistency(expected: any, actual: any): number {
    // 简化的格式一致性计算
    if (typeof expected !== typeof actual) {
      return 0;
    }
    
    if (Array.isArray(expected) !== Array.isArray(actual)) {
      return 0;
    }
    
    return 1;
  }

  /**
   * 计算字符串差异严重程度
   */
  private calculateStringSeverity(expected: string, actual: string): SeverityLevel {
    if (!expected || !actual) {
      return SeverityLevel.HIGH;
    }

    const similarity = this.calculateLevenshteinSimilarity(expected, actual);
    
    if (similarity < 0.3) return SeverityLevel.CRITICAL;
    if (similarity < 0.5) return SeverityLevel.HIGH;
    if (similarity < 0.7) return SeverityLevel.MEDIUM;
    return SeverityLevel.LOW;
  }

  /**
   * 计算Levenshtein相似度
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }

  /**
   * 计算Levenshtein距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 计算总体匹配分数
   */
  private calculateOverallScore(differences: DifferenceDetail[], analysis: ComparisonResult['analysis']): number {
    if (differences.length === 0) return 1;

    // 基于差异数量和严重程度的权重评分
    let penalty = 0;
    const weights = {
      [SeverityLevel.CRITICAL]: 1.0,
      [SeverityLevel.HIGH]: 0.7,
      [SeverityLevel.MEDIUM]: 0.4,
      [SeverityLevel.LOW]: 0.2,
      [SeverityLevel.INFO]: 0.1
    };

    for (const diff of differences) {
      penalty += weights[diff.severity];
    }

    // 结合结构和内容相似度
    const similarityScore = (analysis.structuralSimilarity + analysis.contentSimilarity) / 2;
    
    // 基础分数减去惩罚分数
    const score = Math.max(0, similarityScore - penalty / differences.length);
    
    return Math.min(1, score);
  }

  /**
   * 统计差异
   */
  private summarizeDifferences(differences: DifferenceDetail[]): ComparisonResult['summary'] {
    const summary = {
      totalDifferences: differences.length,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0
    };

    for (const diff of differences) {
      switch (diff.severity) {
        case SeverityLevel.CRITICAL:
          summary.criticalCount++;
          break;
        case SeverityLevel.HIGH:
          summary.highCount++;
          break;
        case SeverityLevel.MEDIUM:
          summary.mediumCount++;
          break;
        case SeverityLevel.LOW:
          summary.lowCount++;
          break;
      }
    }

    return summary;
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(differences: DifferenceDetail[], analysis: ComparisonResult['analysis']): string[] {
    const recommendations: string[] = [];

    if (differences.length === 0) {
      recommendations.push('Results match perfectly - no action required');
      return recommendations;
    }

    // 基于差异类型的建议
    const diffTypes = new Set(differences.map(d => d.type));
    
    if (diffTypes.has(DifferenceType.STRUCTURE_DIFF)) {
      recommendations.push('Structure differences detected - review data transformation logic');
    }
    
    if (diffTypes.has(DifferenceType.TYPE_MISMATCH)) {
      recommendations.push('Type mismatches found - verify data type conversions');
    }
    
    if (diffTypes.has(DifferenceType.MISSING_FIELD)) {
      recommendations.push('Missing fields detected - check data mapping completeness');
    }
    
    if (diffTypes.has(DifferenceType.EXTRA_FIELD)) {
      recommendations.push('Extra fields present - review output filtering logic');
    }

    // 基于严重程度的建议
    const criticalCount = differences.filter(d => d.severity === SeverityLevel.CRITICAL).length;
    if (criticalCount > 0) {
      recommendations.push(`${criticalCount} critical differences require immediate attention`);
    }

    // 基于相似度的建议
    if (analysis.structuralSimilarity < 0.8) {
      recommendations.push('Low structural similarity - consider reviewing data structure transformation');
    }
    
    if (analysis.contentSimilarity < 0.8) {
      recommendations.push('Low content similarity - verify data processing accuracy');
    }

    return recommendations;
  }

  /**
   * 计算总字段数
   */
  private countTotalFields(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return 1;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((count, item) => count + this.countTotalFields(item), 0);
    }

    let count = 0;
    for (const value of Object.values(obj)) {
      count += this.countTotalFields(value);
    }

    return count;
  }

  /**
   * 生成比较ID
   */
  private generateComparisonId(expected: any, actual: any, context?: any): string {
    const content = JSON.stringify({ expected, actual, context });
    const hash = createHash('sha256').update(content).digest('hex');
    return `comparison-${hash.substring(0, 16)}-${Date.now()}`;
  }

  /**
   * 获取差异摘要报告
   */
  public generateDifferenceReport(result: ComparisonResult): string {
    const lines: string[] = [];
    
    lines.push(`=== Comparison Report ===`);
    lines.push(`Comparison ID: ${result.comparisonId}`);
    lines.push(`Timestamp: ${result.timestamp}`);
    lines.push(`Overall Match: ${result.isMatch ? 'YES' : 'NO'}`);
    lines.push(`Similarity Score: ${(result.score * 100).toFixed(2)}%`);
    lines.push('');

    lines.push(`=== Summary ===`);
    lines.push(`Total Differences: ${result.summary.totalDifferences}`);
    lines.push(`Critical: ${result.summary.criticalCount}`);
    lines.push(`High: ${result.summary.highCount}`);
    lines.push(`Medium: ${result.summary.mediumCount}`);
    lines.push(`Low: ${result.summary.lowCount}`);
    lines.push('');

    lines.push(`=== Analysis ===`);
    lines.push(`Structural Similarity: ${(result.analysis.structuralSimilarity * 100).toFixed(2)}%`);
    lines.push(`Content Similarity: ${(result.analysis.contentSimilarity * 100).toFixed(2)}%`);
    lines.push(`Format Consistency: ${(result.analysis.formatConsistency * 100).toFixed(2)}%`);
    lines.push('');

    if (result.differences.length > 0) {
      lines.push(`=== Differences ===`);
      for (const diff of result.differences) {
        lines.push(`[${diff.severity.toUpperCase()}] ${diff.path}: ${diff.message}`);
        lines.push(`  Expected: ${JSON.stringify(diff.expected)}`);
        lines.push(`  Actual: ${JSON.stringify(diff.actual)}`);
        lines.push('');
      }
    }

    if (result.recommendations.length > 0) {
      lines.push(`=== Recommendations ===`);
      for (const rec of result.recommendations) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }
}