/**
 * Auto-Correction Tool
 * 根据历史对比数据自动学习修正规则
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { ComparisonAnalysisEngine, ComparisonResult, ResponseDifference } from './analysis-engine';
import { CorrectionEngine, CorrectionResult, CorrectionStrategy } from './correction-engine';
import fs from 'fs/promises';
import path from 'path';

export interface LearningData {
  patterns: CorrectionPattern[];
  statistics: LearningStatistics;
  rules: LearnedRule[];
  confidence: number;
  lastUpdated: Date;
}

export interface CorrectionPattern {
  id: string;
  type: 'content' | 'structure' | 'tools' | 'metadata' | 'formatting';
  triggerConditions: PatternCondition[];
  correctionAction: CorrectionAction;
  successRate: number;
  frequency: number;
  confidence: number;
  examples: PatternExample[];
}

export interface PatternCondition {
  field: string;
  operator: 'equals' | 'contains' | 'length_gt' | 'length_lt' | 'missing' | 'differs';
  value: any;
  weight: number;
}

export interface CorrectionAction {
  method: string;
  parameters: Record<string, any>;
  expectedImpact: number; // 0-1, expected improvement score
}

export interface PatternExample {
  originalValue: any;
  correctedValue: any;
  context: string;
  success: boolean;
  confidence: number;
}

export interface LearnedRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  confidence: number;
  applicableScenarios: string[];
  performance: RulePerformance;
}

export interface RuleCondition {
  type: 'content_similarity' | 'length_ratio' | 'structure_diff' | 'token_ratio' | 'tool_presence';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'between';
  value: number | [number, number];
}

export interface RuleAction {
  type: 'replace_content' | 'merge_content' | 'fix_structure' | 'correct_tools' | 'normalize_metadata';
  strategy: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface RulePerformance {
  totalApplications: number;
  successfulApplications: number;
  averageImprovement: number;
  averageConfidence: number;
  lastUsed: Date;
}

export interface LearningStatistics {
  totalComparisons: number;
  totalCorrections: number;
  averageSuccessRate: number;
  patternCount: number;
  ruleCount: number;
  mostCommonIssues: Array<{ issue: string; frequency: number }>;
  improvementTrends: Array<{ date: Date; score: number }>;
}

export interface AutoCorrectionConfig {
  learningEnabled: boolean;
  minimumDataPoints: number;
  confidenceThreshold: number;
  patternDetectionThreshold: number;
  ruleGenerationThreshold: number;
  maxPatternsPerType: number;
  maxRules: number;
  dataStoragePath: string;
  autoSaveInterval: number; // milliseconds
}

export class AutoCorrectionTool {
  private analysisEngine: ComparisonAnalysisEngine;
  private correctionEngine: CorrectionEngine;
  private learningData: LearningData;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(
    analysisEngine: ComparisonAnalysisEngine,
    correctionEngine: CorrectionEngine,
    private config: AutoCorrectionConfig
  ) {
    this.analysisEngine = analysisEngine;
    this.correctionEngine = correctionEngine;
    
    this.learningData = {
      patterns: [],
      statistics: this.initializeStatistics(),
      rules: [],
      confidence: 0,
      lastUpdated: new Date()
    };

    this.startAutoSave();
  }

  /**
   * 从历史数据学习并生成修正规则
   */
  async learnFromHistory(): Promise<void> {
    logger.info('Starting auto-correction learning process');

    try {
      // 获取分析历史数据
      const analysisHistory = this.analysisEngine.getAnalysisHistory();
      const correctionHistory = this.correctionEngine.getCorrectionHistory();

      if (analysisHistory.length < this.config.minimumDataPoints) {
        logger.warn(`Insufficient data for learning: ${analysisHistory.length} < ${this.config.minimumDataPoints}`);
        return;
      }

      // Step 1: 检测修正模式
      await this.detectCorrectionPatterns(analysisHistory, correctionHistory);

      // Step 2: 生成学习规则
      await this.generateLearnedRules(analysisHistory, correctionHistory);

      // Step 3: 更新统计数据
      await this.updateLearningStatistics(analysisHistory, correctionHistory);

      // Step 4: 计算整体置信度
      this.calculateOverallConfidence();

      // Step 5: 保存学习数据
      await this.saveLearningData();

      logger.info('Auto-correction learning completed', {
        patterns: this.learningData.patterns.length,
        rules: this.learningData.rules.length,
        confidence: this.learningData.confidence
      });

    } catch (error) {
      logger.error('Auto-correction learning failed', error);
      throw error;
    }
  }

  /**
   * 应用学习到的规则进行自动修正
   */
  async applyAutomaticCorrection(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse
  ): Promise<{
    correctedResponse: BaseResponse;
    appliedRules: string[];
    confidence: number;
    improvements: string[];
  }> {
    logger.debug('Applying automatic correction', {
      rulesAvailable: this.learningData.rules.length,
      patternsAvailable: this.learningData.patterns.length
    });

    const result = {
      correctedResponse: { ...codewhispererResponse },
      appliedRules: [] as string[],
      confidence: 0,
      improvements: [] as string[]
    };

    try {
      // 先进行快速分析识别问题
      const quickAnalysis = await this.performQuickAnalysis(codewhispererResponse, openaiReference);

      // 根据分析结果应用合适的规则
      for (const rule of this.learningData.rules) {
        if (await this.shouldApplyRule(rule, quickAnalysis, codewhispererResponse, openaiReference)) {
          const applied = await this.applyRule(rule, result.correctedResponse, openaiReference);
          
          if (applied.success) {
            result.appliedRules.push(rule.name);
            result.improvements.push(applied.improvement);
            result.confidence = Math.max(result.confidence, applied.confidence);
          }
        }
      }

      // 应用检测到的模式
      for (const pattern of this.learningData.patterns) {
        if (await this.shouldApplyPattern(pattern, result.correctedResponse, openaiReference)) {
          const applied = await this.applyPattern(pattern, result.correctedResponse, openaiReference);
          
          if (applied.success) {
            result.improvements.push(applied.improvement);
            result.confidence = Math.max(result.confidence, applied.confidence);
          }
        }
      }

      logger.debug('Automatic correction applied', {
        rulesApplied: result.appliedRules.length,
        confidence: result.confidence,
        improvements: result.improvements.length
      });

      return result;

    } catch (error) {
      logger.error('Automatic correction failed', error);
      return result; // 返回原始响应作为fallback
    }
  }

  /**
   * 评估修正效果并更新学习数据
   */
  async evaluateAndUpdateLearning(
    correctionResult: CorrectionResult,
    actualPerformance: {
      userSatisfaction?: number;
      correctnessScore?: number;
      usabilityScore?: number;
    }
  ): Promise<void> {
    logger.debug('Evaluating correction performance for learning update');

    try {
      // 更新规则性能
      for (const correction of correctionResult.appliedCorrections) {
        const rule = this.learningData.rules.find(r => r.name === correction.method);
        if (rule) {
          rule.performance.totalApplications++;
          
          if (actualPerformance.correctnessScore && actualPerformance.correctnessScore > 0.7) {
            rule.performance.successfulApplications++;
          }
          
          rule.performance.averageImprovement = (
            rule.performance.averageImprovement * (rule.performance.totalApplications - 1) + 
            (actualPerformance.correctnessScore || 0)
          ) / rule.performance.totalApplications;

          rule.performance.lastUsed = new Date();
        }
      }

      // 更新模式置信度
      const performanceScore = Object.values(actualPerformance).reduce((sum, score) => sum + (score || 0), 0) / 
                             Object.keys(actualPerformance).length;

      for (const pattern of this.learningData.patterns) {
        // 根据实际性能调整模式置信度
        if (performanceScore > 0.8) {
          pattern.confidence = Math.min(1, pattern.confidence + 0.05);
        } else if (performanceScore < 0.5) {
          pattern.confidence = Math.max(0, pattern.confidence - 0.1);
        }
      }

      await this.saveLearningData();

    } catch (error) {
      logger.error('Failed to update learning from evaluation', error);
    }
  }

  /**
   * 获取修正建议
   */
  async getRecommendations(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse
  ): Promise<{
    urgentRecommendations: string[];
    improvementSuggestions: string[];
    preventiveMeasures: string[];
    confidence: number;
  }> {
    const recommendations = {
      urgentRecommendations: [] as string[],
      improvementSuggestions: [] as string[],
      preventiveMeasures: [] as string[],
      confidence: 0
    };

    try {
      const analysis = await this.performQuickAnalysis(codewhispererResponse, openaiReference);

      // 基于学习到的模式生成建议
      for (const pattern of this.learningData.patterns) {
        if (pattern.confidence > 0.8 && await this.patternMatches(pattern, analysis)) {
          switch (pattern.type) {
            case 'content':
              if (analysis.contentSimilarity < 0.5) {
                recommendations.urgentRecommendations.push(
                  `Content differs significantly from reference - consider using ${pattern.correctionAction.method}`
                );
              }
              break;
              
            case 'structure':
              recommendations.improvementSuggestions.push(
                'Response structure inconsistencies detected - automatic normalization recommended'
              );
              break;
              
            case 'tools':
              recommendations.urgentRecommendations.push(
                'Tool call format issues detected - automatic correction available'
              );
              break;
          }
        }
      }

      // 基于统计数据生成预防性建议
      for (const issue of this.learningData.statistics.mostCommonIssues) {
        if (issue.frequency > this.learningData.statistics.totalComparisons * 0.3) {
          recommendations.preventiveMeasures.push(
            `Common issue detected: ${issue.issue} - occurs in ${((issue.frequency / this.learningData.statistics.totalComparisons) * 100).toFixed(1)}% of cases`
          );
        }
      }

      recommendations.confidence = this.learningData.confidence;

      return recommendations;

    } catch (error) {
      logger.error('Failed to generate recommendations', error);
      return recommendations;
    }
  }

  // 私有方法

  private async detectCorrectionPatterns(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<void> {
    logger.debug('Detecting correction patterns from history');

    const patternCandidates = new Map<string, CorrectionPattern>();

    for (const analysis of analysisHistory) {
      for (const difference of analysis.differences) {
        const patternKey = `${difference.type}_${difference.severity}`;
        
        if (!patternCandidates.has(patternKey)) {
          patternCandidates.set(patternKey, {
            id: patternKey,
            type: difference.type,
            triggerConditions: [],
            correctionAction: {
              method: 'auto_detected',
              parameters: {},
              expectedImpact: 0
            },
            successRate: 0,
            frequency: 0,
            confidence: 0,
            examples: []
          });
        }

        const pattern = patternCandidates.get(patternKey)!;
        pattern.frequency++;
        
        // 添加示例
        pattern.examples.push({
          originalValue: difference.codewhispererValue,
          correctedValue: difference.openaiValue,
          context: difference.description,
          success: true, // 假设参考值是正确的
          confidence: 0.8
        });
      }
    }

    // 计算模式成功率和置信度
    for (const [key, pattern] of patternCandidates) {
      if (pattern.frequency >= this.config.patternDetectionThreshold) {
        pattern.successRate = pattern.examples.filter(e => e.success).length / pattern.examples.length;
        pattern.confidence = Math.min(pattern.successRate, pattern.frequency / analysisHistory.length);
        
        if (pattern.confidence >= this.config.confidenceThreshold) {
          this.learningData.patterns.push(pattern);
        }
      }
    }

    // 限制模式数量
    this.learningData.patterns = this.learningData.patterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPatternsPerType * 4); // 4 types maximum
  }

  private async generateLearnedRules(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<void> {
    logger.debug('Generating learned rules from patterns');

    const ruleGenerators = [
      this.generateContentRules,
      this.generateStructureRules,
      this.generateToolRules,
      this.generateMetadataRules
    ];

    for (const generator of ruleGenerators) {
      const rules = await generator.call(this, analysisHistory, correctionHistory);
      this.learningData.rules.push(...rules);
    }

    // 限制规则数量
    this.learningData.rules = this.learningData.rules
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxRules);
  }

  private async generateContentRules(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<LearnedRule[]> {
    const rules: LearnedRule[] = [];

    // 内容长度差异规则
    const lengthDiffCases = analysisHistory.filter(a => 
      a.analysis.contentComparison.lengthDifference > 0.5
    );

    if (lengthDiffCases.length >= this.config.ruleGenerationThreshold) {
      rules.push({
        id: 'content_length_correction',
        name: 'Content Length Correction',
        description: 'Correct content when reference is significantly longer',
        conditions: [
          {
            type: 'length_ratio',
            threshold: 1.5,
            operator: 'gt',
            value: 1.5
          }
        ],
        actions: [
          {
            type: 'replace_content',
            strategy: 'use_reference_when_longer',
            parameters: { minimumRatio: 1.5 },
            confidence: 0.8
          }
        ],
        priority: 1,
        confidence: lengthDiffCases.length / analysisHistory.length,
        applicableScenarios: ['content_generation', 'explanation_tasks'],
        performance: {
          totalApplications: 0,
          successfulApplications: 0,
          averageImprovement: 0,
          averageConfidence: 0.8,
          lastUsed: new Date()
        }
      });
    }

    return rules;
  }

  private async generateStructureRules(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<LearnedRule[]> {
    const rules: LearnedRule[] = [];

    // 结构标准化规则
    const structureDiffCases = analysisHistory.filter(a => 
      a.analysis.contentComparison.structuralDifference > 0.3
    );

    if (structureDiffCases.length >= this.config.ruleGenerationThreshold) {
      rules.push({
        id: 'structure_normalization',
        name: 'Structure Normalization',
        description: 'Normalize response structure to match reference format',
        conditions: [
          {
            type: 'structure_diff',
            threshold: 0.3,
            operator: 'gt',
            value: 0.3
          }
        ],
        actions: [
          {
            type: 'fix_structure',
            strategy: 'normalize_to_reference',
            parameters: { preserveOriginalData: true },
            confidence: 0.9
          }
        ],
        priority: 2,
        confidence: structureDiffCases.length / analysisHistory.length,
        applicableScenarios: ['all'],
        performance: {
          totalApplications: 0,
          successfulApplications: 0,
          averageImprovement: 0,
          averageConfidence: 0.9,
          lastUsed: new Date()
        }
      });
    }

    return rules;
  }

  private async generateToolRules(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<LearnedRule[]> {
    const rules: LearnedRule[] = [];

    // 工具调用修正规则
    const toolDiffCases = analysisHistory.filter(a => 
      a.differences.some(d => d.type === 'tools')
    );

    if (toolDiffCases.length >= this.config.ruleGenerationThreshold) {
      rules.push({
        id: 'tool_format_correction',
        name: 'Tool Format Correction',
        description: 'Correct tool call format to match reference',
        conditions: [
          {
            type: 'tool_presence',
            threshold: 1,
            operator: 'eq',
            value: 1
          }
        ],
        actions: [
          {
            type: 'correct_tools',
            strategy: 'adopt_reference_format',
            parameters: { validateParameters: true },
            confidence: 0.85
          }
        ],
        priority: 1,
        confidence: toolDiffCases.length / analysisHistory.length,
        applicableScenarios: ['tool_calling'],
        performance: {
          totalApplications: 0,
          successfulApplications: 0,
          averageImprovement: 0,
          averageConfidence: 0.85,
          lastUsed: new Date()
        }
      });
    }

    return rules;
  }

  private async generateMetadataRules(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<LearnedRule[]> {
    const rules: LearnedRule[] = [];

    // 元数据标准化规则
    const metadataDiffCases = analysisHistory.filter(a => 
      a.differences.some(d => d.type === 'metadata')
    );

    if (metadataDiffCases.length >= this.config.ruleGenerationThreshold) {
      rules.push({
        id: 'metadata_standardization',
        name: 'Metadata Standardization',
        description: 'Standardize metadata format while preserving original data',
        conditions: [
          {
            type: 'token_ratio',
            threshold: 0.1,
            operator: 'gt',
            value: 0.1
          }
        ],
        actions: [
          {
            type: 'normalize_metadata',
            strategy: 'standardize_format',
            parameters: { preserveOriginalValues: true },
            confidence: 0.7
          }
        ],
        priority: 3,
        confidence: metadataDiffCases.length / analysisHistory.length,
        applicableScenarios: ['all'],
        performance: {
          totalApplications: 0,
          successfulApplications: 0,
          averageImprovement: 0,
          averageConfidence: 0.7,
          lastUsed: new Date()
        }
      });
    }

    return rules;
  }

  private async performQuickAnalysis(
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse
  ): Promise<{
    contentSimilarity: number;
    lengthRatio: number;
    structureDifference: number;
    hasToolDifferences: boolean;
    hasMetadataDifferences: boolean;
  }> {
    const cwContent = this.extractTextContent(codewhispererResponse);
    const oaiContent = this.extractTextContent(openaiReference);

    return {
      contentSimilarity: this.calculateContentSimilarity(cwContent, oaiContent),
      lengthRatio: oaiContent.length / Math.max(cwContent.length, 1),
      structureDifference: this.calculateStructuralDifference(codewhispererResponse, openaiReference),
      hasToolDifferences: JSON.stringify(this.extractToolCalls(codewhispererResponse)) !== 
                         JSON.stringify(this.extractToolCalls(openaiReference)),
      hasMetadataDifferences: JSON.stringify(codewhispererResponse.usage) !== 
                             JSON.stringify(openaiReference.usage)
    };
  }

  // 其他辅助方法...
  private extractTextContent(response: BaseResponse): string {
    if (!response.content || !Array.isArray(response.content)) return '';
    return response.content.filter(item => item.type === 'text').map(item => item.text || '').join(' ');
  }

  private extractToolCalls(response: BaseResponse): any[] {
    if (!response.content || !Array.isArray(response.content)) return [];
    return response.content.filter(item => item.type === 'tool_use');
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])];
    return commonWords.length / Math.max(totalWords.length, 1);
  }

  private calculateStructuralDifference(response1: BaseResponse, response2: BaseResponse): number {
    const keys1 = Object.keys(response1);
    const keys2 = Object.keys(response2);
    const allKeys = [...new Set([...keys1, ...keys2])];
    const commonKeys = keys1.filter(key => keys2.includes(key));
    return 1 - (commonKeys.length / allKeys.length);
  }

  private async shouldApplyRule(rule: LearnedRule, analysis: any, cw: BaseResponse, oai: BaseResponse): Promise<boolean> {
    for (const condition of rule.conditions) {
      const value = this.getAnalysisValue(analysis, condition.type);
      if (!this.evaluateCondition(value, condition)) return false;
    }
    return rule.confidence >= this.config.confidenceThreshold;
  }

  private async shouldApplyPattern(pattern: CorrectionPattern, cw: BaseResponse, oai: BaseResponse): Promise<boolean> {
    return pattern.confidence >= this.config.confidenceThreshold;
  }

  private async applyRule(rule: LearnedRule, response: BaseResponse, reference: BaseResponse): Promise<{
    success: boolean;
    confidence: number;
    improvement: string;
  }> {
    // 简化的规则应用逻辑
    try {
      for (const action of rule.actions) {
        switch (action.type) {
          case 'replace_content':
            if (action.strategy === 'use_reference_when_longer') {
              const refContent = this.extractTextContent(reference);
              const respContent = this.extractTextContent(response);
              if (refContent.length > respContent.length * action.parameters.minimumRatio) {
                response.content = reference.content;
                return {
                  success: true,
                  confidence: action.confidence,
                  improvement: 'Content replaced with more complete reference'
                };
              }
            }
            break;
        }
      }
      return { success: false, confidence: 0, improvement: '' };
    } catch (error) {
      return { success: false, confidence: 0, improvement: '' };
    }
  }

  private async applyPattern(pattern: CorrectionPattern, response: BaseResponse, reference: BaseResponse): Promise<{
    success: boolean;
    confidence: number;
    improvement: string;
  }> {
    // 简化的模式应用逻辑
    return { success: false, confidence: 0, improvement: '' };
  }

  private async patternMatches(pattern: CorrectionPattern, analysis: any): Promise<boolean> {
    // 简化的模式匹配逻辑
    return pattern.confidence > 0.7;
  }

  private getAnalysisValue(analysis: any, type: string): number {
    switch (type) {
      case 'content_similarity': return analysis.contentSimilarity;
      case 'length_ratio': return analysis.lengthRatio;
      case 'structure_diff': return analysis.structureDifference;
      case 'token_ratio': return 1; // 简化
      case 'tool_presence': return analysis.hasToolDifferences ? 1 : 0;
      default: return 0;
    }
  }

  private evaluateCondition(value: number, condition: RuleCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'eq': return Math.abs(value - condition.threshold) < 0.01;
      case 'between':
        const [min, max] = Array.isArray(condition.value) ? condition.value : [0, 1];
        return value >= min && value <= max;
      default: return false;
    }
  }

  private initializeStatistics(): LearningStatistics {
    return {
      totalComparisons: 0,
      totalCorrections: 0,
      averageSuccessRate: 0,
      patternCount: 0,
      ruleCount: 0,
      mostCommonIssues: [],
      improvementTrends: []
    };
  }

  private async updateLearningStatistics(
    analysisHistory: ComparisonResult[],
    correctionHistory: CorrectionResult[]
  ): Promise<void> {
    this.learningData.statistics.totalComparisons = analysisHistory.length;
    this.learningData.statistics.totalCorrections = correctionHistory.length;
    this.learningData.statistics.patternCount = this.learningData.patterns.length;
    this.learningData.statistics.ruleCount = this.learningData.rules.length;

    // 计算平均成功率
    const successfulCorrections = correctionHistory.filter(c => c.success).length;
    this.learningData.statistics.averageSuccessRate = correctionHistory.length > 0 
      ? successfulCorrections / correctionHistory.length 
      : 0;

    // 识别最常见问题
    const allDifferences = analysisHistory.flatMap(a => a.differences);
    const issueFrequency = allDifferences.reduce((acc, diff) => {
      acc[diff.description] = (acc[diff.description] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.learningData.statistics.mostCommonIssues = Object.entries(issueFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue, frequency]) => ({ issue, frequency }));
  }

  private calculateOverallConfidence(): void {
    const patternConfidence = this.learningData.patterns.length > 0
      ? this.learningData.patterns.reduce((sum, p) => sum + p.confidence, 0) / this.learningData.patterns.length
      : 0;

    const ruleConfidence = this.learningData.rules.length > 0
      ? this.learningData.rules.reduce((sum, r) => sum + r.confidence, 0) / this.learningData.rules.length
      : 0;

    this.learningData.confidence = (patternConfidence + ruleConfidence) / 2;
  }

  private async saveLearningData(): Promise<void> {
    try {
      const dataPath = path.join(this.config.dataStoragePath, 'learning-data.json');
      await fs.writeFile(dataPath, JSON.stringify(this.learningData, null, 2));
      this.learningData.lastUpdated = new Date();
    } catch (error) {
      logger.error('Failed to save learning data', error);
    }
  }

  private async loadLearningData(): Promise<void> {
    try {
      const dataPath = path.join(this.config.dataStoragePath, 'learning-data.json');
      const data = await fs.readFile(dataPath, 'utf8');
      this.learningData = JSON.parse(data);
    } catch (error) {
      logger.debug('No existing learning data found, starting fresh');
    }
  }

  private startAutoSave(): void {
    if (this.config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.saveLearningData().catch(error => {
          logger.error('Auto-save failed', error);
        });
      }, this.config.autoSaveInterval);
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * 获取学习数据统计
   */
  public getLearningStatistics(): LearningStatistics {
    return { ...this.learningData.statistics };
  }

  /**
   * 获取学习到的模式
   */
  public getLearnedPatterns(): CorrectionPattern[] {
    return [...this.learningData.patterns];
  }

  /**
   * 获取学习到的规则
   */
  public getLearnedRules(): LearnedRule[] {
    return [...this.learningData.rules];
  }
}