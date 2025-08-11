/**
 * Provider Comparison Analysis Engine
 * 对比分析 CodeWhisperer 与 OpenAI 响应差异
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

export interface ComparisonResult {
  requestId: string;
  timestamp: Date;
  request: BaseRequest;
  responses: {
    codewhisperer: ProviderResponse;
    openai: ProviderResponse;
  };
  analysis: ResponseAnalysis;
  differences: ResponseDifference[];
  qualityScore: QualityScore;
  recommendations: CorrectionRecommendation[];
}

export interface ProviderResponse {
  response: BaseResponse;
  metadata: {
    responseTime: number;
    tokenCount: {
      input: number;
      output: number;
    };
    errors: string[];
    warnings: string[];
  };
}

export interface ResponseAnalysis {
  contentComparison: {
    similarity: number; // 0-1, content similarity score
    lengthDifference: number; // percentage difference in content length
    structuralDifference: number; // 0-1, structure difference score
  };
  qualityComparison: {
    completeness: {
      codewhisperer: number; // 0-1, response completeness score
      openai: number;
    };
    accuracy: {
      codewhisperer: number; // 0-1, response accuracy score
      openai: number;
    };
    coherence: {
      codewhisperer: number; // 0-1, response coherence score
      openai: number;
    };
  };
  performanceComparison: {
    responseTime: {
      codewhisperer: number;
      openai: number;
      difference: number; // milliseconds
    };
    tokenEfficiency: {
      codewhisperer: number; // tokens per useful content unit
      openai: number;
    };
  };
}

export interface ResponseDifference {
  type: 'content' | 'structure' | 'metadata' | 'tools' | 'formatting';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  codewhispererValue: any;
  openaiValue: any;
  impact: string;
  fixable: boolean;
}

export interface QualityScore {
  overall: number; // 0-100, overall quality score
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    performance: number;
  };
  recommendation: 'use_codewhisperer' | 'use_openai' | 'needs_correction' | 'equivalent';
}

export interface CorrectionRecommendation {
  type: 'content' | 'structure' | 'metadata' | 'tools' | 'formatting';
  priority: 'high' | 'medium' | 'low';
  action: string;
  implementation: string;
  expectedImpact: string;
}

export class ComparisonAnalysisEngine {
  private analysisHistory: ComparisonResult[] = [];
  private readonly maxHistorySize = 1000;

  constructor(
    private config: {
      enableContentAnalysis: boolean;
      enablePerformanceAnalysis: boolean;
      enableStructuralAnalysis: boolean;
      qualityThresholds: {
        critical: number;
        major: number;
        minor: number;
      };
    }
  ) {}

  /**
   * 对比分析两个 provider 的响应
   */
  async analyzeProviderResponses(
    request: BaseRequest,
    codewhispererResponse: ProviderResponse,
    openaiResponse: ProviderResponse
  ): Promise<ComparisonResult> {
    const requestId = request.metadata?.requestId || `analysis_${Date.now()}`;
    
    logger.info(`Starting provider comparison analysis`, {
      requestId,
      model: request.model,
      codewhispererTokens: codewhispererResponse.metadata.tokenCount.output,
      openaiTokens: openaiResponse.metadata.tokenCount.output
    });

    try {
      // 执行各维度分析
      const contentAnalysis = await this.analyzeContentDifferences(
        codewhispererResponse.response,
        openaiResponse.response
      );

      const qualityAnalysis = await this.analyzeQualityDifferences(
        codewhispererResponse,
        openaiResponse
      );

      const performanceAnalysis = await this.analyzePerformanceDifferences(
        codewhispererResponse,
        openaiResponse
      );

      // 识别具体差异
      const differences = await this.identifyDifferences(
        codewhispererResponse.response,
        openaiResponse.response
      );

      // 计算综合质量分数
      const qualityScore = await this.calculateQualityScore(
        contentAnalysis,
        qualityAnalysis,
        performanceAnalysis,
        differences
      );

      // 生成修正建议
      const recommendations = await this.generateRecommendations(
        differences,
        qualityScore
      );

      const result: ComparisonResult = {
        requestId,
        timestamp: new Date(),
        request,
        responses: {
          codewhisperer: codewhispererResponse,
          openai: openaiResponse
        },
        analysis: {
          contentComparison: contentAnalysis,
          qualityComparison: qualityAnalysis,
          performanceComparison: performanceAnalysis
        },
        differences,
        qualityScore,
        recommendations
      };

      // 存储到历史记录
      this.addToHistory(result);

      logger.info(`Comparison analysis completed`, {
        requestId,
        overallScore: qualityScore.overall,
        differenceCount: differences.length,
        recommendation: qualityScore.recommendation
      });

      return result;

    } catch (error) {
      logger.error(`Comparison analysis failed`, error, requestId);
      throw error;
    }
  }

  /**
   * 分析内容差异
   */
  private async analyzeContentDifferences(
    cwResponse: BaseResponse,
    oaiResponse: BaseResponse
  ): Promise<ResponseAnalysis['contentComparison']> {
    const cwContent = this.extractTextContent(cwResponse);
    const oaiContent = this.extractTextContent(oaiResponse);

    // 计算内容相似度（简化算法）
    const similarity = this.calculateContentSimilarity(cwContent, oaiContent);
    
    // 计算长度差异
    const lengthDifference = Math.abs(cwContent.length - oaiContent.length) / 
                            Math.max(cwContent.length, oaiContent.length);
    
    // 计算结构差异
    const structuralDifference = this.calculateStructuralDifference(cwResponse, oaiResponse);

    return {
      similarity,
      lengthDifference,
      structuralDifference
    };
  }

  /**
   * 分析质量差异
   */
  private async analyzeQualityDifferences(
    cwResponse: ProviderResponse,
    oaiResponse: ProviderResponse
  ): Promise<ResponseAnalysis['qualityComparison']> {
    return {
      completeness: {
        codewhisperer: this.assessCompleteness(cwResponse.response),
        openai: this.assessCompleteness(oaiResponse.response)
      },
      accuracy: {
        codewhisperer: this.assessAccuracy(cwResponse.response),
        openai: this.assessAccuracy(oaiResponse.response)
      },
      coherence: {
        codewhisperer: this.assessCoherence(cwResponse.response),
        openai: this.assessCoherence(oaiResponse.response)
      }
    };
  }

  /**
   * 分析性能差异
   */
  private async analyzePerformanceDifferences(
    cwResponse: ProviderResponse,
    oaiResponse: ProviderResponse
  ): Promise<ResponseAnalysis['performanceComparison']> {
    const cwTokens = cwResponse.metadata.tokenCount.output;
    const oaiTokens = oaiResponse.metadata.tokenCount.output;
    const cwContent = this.extractTextContent(cwResponse.response);
    const oaiContent = this.extractTextContent(oaiResponse.response);

    return {
      responseTime: {
        codewhisperer: cwResponse.metadata.responseTime,
        openai: oaiResponse.metadata.responseTime,
        difference: cwResponse.metadata.responseTime - oaiResponse.metadata.responseTime
      },
      tokenEfficiency: {
        codewhisperer: cwTokens / Math.max(cwContent.length, 1),
        openai: oaiTokens / Math.max(oaiContent.length, 1)
      }
    };
  }

  /**
   * 识别具体差异
   */
  private async identifyDifferences(
    cwResponse: BaseResponse,
    oaiResponse: BaseResponse
  ): Promise<ResponseDifference[]> {
    const differences: ResponseDifference[] = [];

    // 检查内容差异
    const cwContent = this.extractTextContent(cwResponse);
    const oaiContent = this.extractTextContent(oaiResponse);
    
    if (cwContent !== oaiContent) {
      differences.push({
        type: 'content',
        severity: this.assessContentDifferenceSeverity(cwContent, oaiContent),
        description: 'Response content differs between providers',
        codewhispererValue: cwContent.substring(0, 200) + '...',
        openaiValue: oaiContent.substring(0, 200) + '...',
        impact: 'User experience may vary depending on provider',
        fixable: true
      });
    }

    // 检查结构差异
    const cwStructure = this.analyzeResponseStructure(cwResponse);
    const oaiStructure = this.analyzeResponseStructure(oaiResponse);
    
    if (JSON.stringify(cwStructure) !== JSON.stringify(oaiStructure)) {
      differences.push({
        type: 'structure',
        severity: 'major',
        description: 'Response structure differs between providers',
        codewhispererValue: cwStructure,
        openaiValue: oaiStructure,
        impact: 'Response parsing may behave differently',
        fixable: true
      });
    }

    // 检查工具调用差异
    const cwTools = this.extractToolCalls(cwResponse);
    const oaiTools = this.extractToolCalls(oaiResponse);
    
    if (JSON.stringify(cwTools) !== JSON.stringify(oaiTools)) {
      differences.push({
        type: 'tools',
        severity: 'critical',
        description: 'Tool calls differ between providers',
        codewhispererValue: cwTools,
        openaiValue: oaiTools,
        impact: 'Tool execution results will differ',
        fixable: true
      });
    }

    // 检查元数据差异
    const cwUsage = cwResponse.usage;
    const oaiUsage = oaiResponse.usage;
    
    if (cwUsage && oaiUsage && 
        (cwUsage.input_tokens !== oaiUsage.input_tokens || 
         cwUsage.output_tokens !== oaiUsage.output_tokens)) {
      differences.push({
        type: 'metadata',
        severity: 'minor',
        description: 'Token usage differs between providers',
        codewhispererValue: cwUsage,
        openaiValue: oaiUsage,
        impact: 'Cost calculation may differ',
        fixable: false
      });
    }

    return differences;
  }

  /**
   * 计算综合质量分数
   */
  private async calculateQualityScore(
    contentAnalysis: ResponseAnalysis['contentComparison'],
    qualityAnalysis: ResponseAnalysis['qualityComparison'],
    performanceAnalysis: ResponseAnalysis['performanceComparison'],
    differences: ResponseDifference[]
  ): Promise<QualityScore> {
    const completeness = (qualityAnalysis.completeness.codewhisperer + 
                         qualityAnalysis.completeness.openai) / 2 * 100;
    
    const accuracy = (qualityAnalysis.accuracy.codewhisperer + 
                     qualityAnalysis.accuracy.openai) / 2 * 100;
    
    const consistency = (1 - contentAnalysis.structuralDifference) * 100;
    
    const performance = this.calculatePerformanceScore(performanceAnalysis);
    
    const overall = (completeness + accuracy + consistency + performance) / 4;

    const criticalDifferences = differences.filter(d => d.severity === 'critical').length;
    const majorDifferences = differences.filter(d => d.severity === 'major').length;

    let recommendation: QualityScore['recommendation'];
    if (criticalDifferences > 0 || majorDifferences > 2) {
      recommendation = 'needs_correction';
    } else if (qualityAnalysis.completeness.openai > qualityAnalysis.completeness.codewhisperer + 0.1) {
      recommendation = 'use_openai';
    } else if (qualityAnalysis.completeness.codewhisperer > qualityAnalysis.completeness.openai + 0.1) {
      recommendation = 'use_codewhisperer';
    } else {
      recommendation = 'equivalent';
    }

    return {
      overall,
      dimensions: {
        completeness,
        accuracy,
        consistency,
        performance
      },
      recommendation
    };
  }

  /**
   * 生成修正建议
   */
  private async generateRecommendations(
    differences: ResponseDifference[],
    qualityScore: QualityScore
  ): Promise<CorrectionRecommendation[]> {
    const recommendations: CorrectionRecommendation[] = [];

    for (const diff of differences) {
      if (!diff.fixable) continue;

      switch (diff.type) {
        case 'content':
          if (diff.severity === 'critical' || diff.severity === 'major') {
            recommendations.push({
              type: 'content',
              priority: diff.severity === 'critical' ? 'high' : 'medium',
              action: 'Apply content correction',
              implementation: 'Use OpenAI response as reference to correct CodeWhisperer content',
              expectedImpact: 'Improved response quality and consistency'
            });
          }
          break;

        case 'structure':
          recommendations.push({
            type: 'structure',
            priority: 'high',
            action: 'Normalize response structure',
            implementation: 'Transform CodeWhisperer response to match OpenAI structure',
            expectedImpact: 'Consistent response parsing and handling'
          });
          break;

        case 'tools':
          recommendations.push({
            type: 'tools',
            priority: 'high',
            action: 'Fix tool call formatting',
            implementation: 'Convert CodeWhisperer tool calls to match OpenAI format',
            expectedImpact: 'Proper tool execution and result handling'
          });
          break;
      }
    }

    return recommendations;
  }

  // 辅助方法

  private extractTextContent(response: BaseResponse): string {
    if (!response.content || !Array.isArray(response.content)) {
      return '';
    }

    return response.content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join(' ');
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // 简化的相似度计算（实际项目中可以使用更复杂的算法）
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])];
    
    return commonWords.length / totalWords.length;
  }

  private calculateStructuralDifference(response1: BaseResponse, response2: BaseResponse): number {
    const structure1 = this.analyzeResponseStructure(response1);
    const structure2 = this.analyzeResponseStructure(response2);
    
    // 简化的结构差异计算
    const keys1 = Object.keys(structure1);
    const keys2 = Object.keys(structure2);
    const allKeys = [...new Set([...keys1, ...keys2])];
    const commonKeys = keys1.filter(key => keys2.includes(key));
    
    return 1 - (commonKeys.length / allKeys.length);
  }

  private analyzeResponseStructure(response: BaseResponse): Record<string, any> {
    return {
      hasId: !!response.id,
      hasType: !!response.type,
      hasModel: !!response.model,
      hasRole: !!response.role,
      contentLength: response.content?.length || 0,
      contentTypes: response.content?.map(item => item.type) || [],
      hasUsage: !!response.usage,
      hasStopReason: !!response.stop_reason
    };
  }

  private extractToolCalls(response: BaseResponse): any[] {
    if (!response.content || !Array.isArray(response.content)) {
      return [];
    }

    return response.content.filter(item => item.type === 'tool_use');
  }

  private assessCompleteness(response: BaseResponse): number {
    let score = 0.5; // Base score

    if (response.content && response.content.length > 0) score += 0.3;
    if (response.usage) score += 0.1;
    if (response.stop_reason) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessAccuracy(response: BaseResponse): number {
    // 简化的准确性评估 - 实际项目中需要更复杂的逻辑
    let score = 0.7; // Base score

    const content = this.extractTextContent(response);
    if (content.length > 50) score += 0.1;
    if (content.length > 200) score += 0.1;
    if (response.usage && response.usage.output_tokens > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessCoherence(response: BaseResponse): number {
    // 简化的连贯性评估
    const content = this.extractTextContent(response);
    let score = 0.6; // Base score

    // 检查内容是否有明显的结构
    if (content.includes('\n') || content.includes('.')) score += 0.2;
    if (content.length > 100) score += 0.1;
    if (response.content && response.content.length > 1) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessContentDifferenceSeverity(content1: string, content2: string): ResponseDifference['severity'] {
    const similarity = this.calculateContentSimilarity(content1, content2);
    
    if (similarity < 0.3) return 'critical';
    if (similarity < 0.6) return 'major';
    return 'minor';
  }

  private calculatePerformanceScore(analysis: ResponseAnalysis['performanceComparison']): number {
    // 基于响应时间和token效率的性能分数
    const timeScore = analysis.responseTime.codewhisperer < analysis.responseTime.openai ? 60 : 40;
    const efficiencyScore = analysis.tokenEfficiency.codewhisperer < analysis.tokenEfficiency.openai ? 60 : 40;
    
    return (timeScore + efficiencyScore) / 2;
  }

  private addToHistory(result: ComparisonResult): void {
    this.analysisHistory.push(result);
    
    // 限制历史记录大小
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory = this.analysisHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取分析历史
   */
  public getAnalysisHistory(limit?: number): ComparisonResult[] {
    if (limit) {
      return this.analysisHistory.slice(-limit);
    }
    return [...this.analysisHistory];
  }

  /**
   * 获取质量统计
   */
  public getQualityStatistics(): {
    averageScore: number;
    totalComparisons: number;
    recommendationDistribution: Record<string, number>;
    commonIssues: string[];
  } {
    if (this.analysisHistory.length === 0) {
      return {
        averageScore: 0,
        totalComparisons: 0,
        recommendationDistribution: {},
        commonIssues: []
      };
    }

    const scores = this.analysisHistory.map(r => r.qualityScore.overall);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const recommendations = this.analysisHistory.map(r => r.qualityScore.recommendation);
    const recommendationDistribution = recommendations.reduce((acc, rec) => {
      acc[rec] = (acc[rec] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const allDifferences = this.analysisHistory.flatMap(r => r.differences);
    const issueFrequency = allDifferences.reduce((acc, diff) => {
      acc[diff.description] = (acc[diff.description] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonIssues = Object.entries(issueFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);

    return {
      averageScore,
      totalComparisons: this.analysisHistory.length,
      recommendationDistribution,
      commonIssues
    };
  }
}