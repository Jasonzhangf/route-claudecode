/**
 * Provider Comparison System - Main Entry Point
 * 整合对比分析、修正机制和自动化工具
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { ComparisonAnalysisEngine, ComparisonResult, ProviderResponse } from './analysis-engine';
import { CorrectionEngine, CorrectionResult, CorrectionConfig } from './correction-engine';
import { AutoCorrectionTool, AutoCorrectionConfig } from './auto-correction';
import fs from 'fs/promises';
import path from 'path';

export interface ComparisonSystemConfig {
  analysis: {
    enableContentAnalysis: boolean;
    enablePerformanceAnalysis: boolean;
    enableStructuralAnalysis: boolean;
    qualityThresholds: {
      critical: number;
      major: number;
      minor: number;
    };
  };
  correction: CorrectionConfig;
  autoCorrection: AutoCorrectionConfig;
  system: {
    enableRealTimeCorrection: boolean;
    enableLearning: boolean;
    autoSaveResults: boolean;
    resultStoragePath: string;
    maxConcurrentComparisons: number;
  };
}

export interface ComparisonSystemResult {
  comparisonAnalysis: ComparisonResult;
  correctionResult?: CorrectionResult;
  autoCorrection?: {
    correctedResponse: BaseResponse;
    appliedRules: string[];
    confidence: number;
    improvements: string[];
  };
  systemMetrics: {
    totalProcessingTime: number;
    analysisTime: number;
    correctionTime: number;
    autoLearningTime: number;
  };
  recommendations: {
    immediate: string[];
    longTerm: string[];
    technical: string[];
  };
}

export class ProviderComparisonSystem {
  private analysisEngine: ComparisonAnalysisEngine;
  private correctionEngine: CorrectionEngine;
  private autoCorrection: AutoCorrectionTool;
  private activeComparisons = new Map<string, Promise<ComparisonSystemResult>>();

  constructor(private config: ComparisonSystemConfig) {
    // 初始化分析引擎
    this.analysisEngine = new ComparisonAnalysisEngine({
      enableContentAnalysis: config.analysis.enableContentAnalysis,
      enablePerformanceAnalysis: config.analysis.enablePerformanceAnalysis,
      enableStructuralAnalysis: config.analysis.enableStructuralAnalysis,
      qualityThresholds: config.analysis.qualityThresholds
    });

    // 初始化修正引擎
    this.correctionEngine = new CorrectionEngine(config.correction);

    // 初始化自动修正工具
    this.autoCorrection = new AutoCorrectionTool(
      this.analysisEngine,
      this.correctionEngine,
      config.autoCorrection
    );

    // 确保存储目录存在
    this.ensureStorageDirectories();

    logger.info('Provider Comparison System initialized', {
      analysisEnabled: config.analysis.enableContentAnalysis,
      correctionEnabled: config.correction.enableContentCorrection,
      autoLearningEnabled: config.autoCorrection.learningEnabled
    });
  }

  /**
   * 执行完整的提供商对比分析
   */
  async compareProviders(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiResponse: BaseResponse,
    options: {
      enableCorrection?: boolean;
      enableAutoCorrection?: boolean;
      saveResults?: boolean;
    } = {}
  ): Promise<ComparisonSystemResult> {
    const requestId = request.metadata?.requestId || `comparison_${Date.now()}`;
    const startTime = Date.now();

    // 检查并发限制
    if (this.activeComparisons.size >= this.config.system.maxConcurrentComparisons) {
      throw new Error(`Maximum concurrent comparisons limit reached: ${this.config.system.maxConcurrentComparisons}`);
    }

    logger.info('Starting comprehensive provider comparison', {
      requestId,
      enableCorrection: options.enableCorrection !== false,
      enableAutoCorrection: options.enableAutoCorrection !== false,
      codewhispererTokens: codewhispererResponse.usage?.output_tokens || 0,
      openaiTokens: openaiResponse.usage?.output_tokens || 0
    });

    const comparisonPromise = this.executeComparison(
      request,
      codewhispererResponse,
      openaiResponse,
      options,
      startTime
    );

    this.activeComparisons.set(requestId, comparisonPromise);

    try {
      const result = await comparisonPromise;
      return result;
    } finally {
      this.activeComparisons.delete(requestId);
    }
  }

  /**
   * 批量对比多个响应对
   */
  async batchCompareProviders(
    comparisons: Array<{
      request: BaseRequest;
      codewhispererResponse: BaseResponse;
      openaiResponse: BaseResponse;
    }>,
    options: {
      enableCorrection?: boolean;
      enableAutoCorrection?: boolean;
      saveResults?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<ComparisonSystemResult[]> {
    const maxConcurrency = options.maxConcurrency || 3;
    const results: ComparisonSystemResult[] = [];

    logger.info('Starting batch provider comparison', {
      batchSize: comparisons.length,
      maxConcurrency
    });

    // 分批处理以控制并发
    for (let i = 0; i < comparisons.length; i += maxConcurrency) {
      const batch = comparisons.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(({ request, codewhispererResponse, openaiResponse }) =>
        this.compareProviders(request, codewhispererResponse, openaiResponse, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Batch comparison item failed', result.reason);
        }
      }

      logger.debug(`Batch comparison progress: ${results.length}/${comparisons.length}`);
    }

    logger.info('Batch provider comparison completed', {
      total: comparisons.length,
      successful: results.length,
      failed: comparisons.length - results.length
    });

    return results;
  }

  /**
   * 获取实时修正建议
   */
  async getRealtimeRecommendations(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse
  ): Promise<{
    urgentRecommendations: string[];
    improvementSuggestions: string[];
    preventiveMeasures: string[];
    confidence: number;
  }> {
    try {
      return await this.autoCorrection.getRecommendations(
        request,
        codewhispererResponse,
        openaiReference
      );
    } catch (error) {
      logger.error('Failed to get realtime recommendations', error);
      return {
        urgentRecommendations: [],
        improvementSuggestions: [],
        preventiveMeasures: [],
        confidence: 0
      };
    }
  }

  /**
   * 应用快速自动修正
   */
  async applyQuickCorrection(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse
  ): Promise<{
    correctedResponse: BaseResponse;
    appliedRules: string[];
    confidence: number;
    improvements: string[];
  }> {
    try {
      return await this.autoCorrection.applyAutomaticCorrection(
        request,
        codewhispererResponse,
        openaiReference
      );
    } catch (error) {
      logger.error('Quick correction failed', error);
      return {
        correctedResponse: codewhispererResponse,
        appliedRules: [],
        confidence: 0,
        improvements: []
      };
    }
  }

  /**
   * 学习和更新修正规则
   */
  async learnAndUpdate(): Promise<void> {
    if (!this.config.autoCorrection.learningEnabled) {
      logger.debug('Auto-learning is disabled');
      return;
    }

    try {
      logger.info('Starting system learning update');
      
      // 学习分析引擎的历史数据
      await this.autoCorrection.learnFromHistory();
      
      // 学习修正引擎的历史数据
      await this.correctionEngine.learnFromHistory();
      
      logger.info('System learning update completed');
    } catch (error) {
      logger.error('System learning update failed', error);
      throw error;
    }
  }

  /**
   * 获取系统统计信息
   */
  getSystemStatistics(): {
    analysis: ReturnType<ComparisonAnalysisEngine['getQualityStatistics']>;
    correction: ReturnType<CorrectionEngine['getCorrectionStatistics']>;
    learning: ReturnType<AutoCorrectionTool['getLearningStatistics']>;
    system: {
      activeComparisons: number;
      totalProcessed: number;
      averageProcessingTime: number;
    };
  } {
    const analysisStats = this.analysisEngine.getQualityStatistics();
    const correctionStats = this.correctionEngine.getCorrectionStatistics();
    const learningStats = this.autoCorrection.getLearningStatistics();

    return {
      analysis: analysisStats,
      correction: correctionStats,
      learning: learningStats,
      system: {
        activeComparisons: this.activeComparisons.size,
        totalProcessed: analysisStats.totalComparisons,
        averageProcessingTime: correctionStats.performanceMetrics.averageProcessingTime
      }
    };
  }

  /**
   * 导出学习数据
   */
  async exportLearningData(): Promise<{
    patterns: ReturnType<AutoCorrectionTool['getLearnedPatterns']>;
    rules: ReturnType<AutoCorrectionTool['getLearnedRules']>;
    statistics: ReturnType<AutoCorrectionTool['getLearningStatistics']>;
    exportTime: Date;
  }> {
    return {
      patterns: this.autoCorrection.getLearnedPatterns(),
      rules: this.autoCorrection.getLearnedRules(),
      statistics: this.autoCorrection.getLearningStatistics(),
      exportTime: new Date()
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.autoCorrection.destroy();
    this.activeComparisons.clear();
    
    logger.info('Provider Comparison System destroyed');
  }

  // 私有方法

  private async executeComparison(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiResponse: BaseResponse,
    options: {
      enableCorrection?: boolean;
      enableAutoCorrection?: boolean;
      saveResults?: boolean;
    },
    startTime: number
  ): Promise<ComparisonSystemResult> {
    const requestId = request.metadata?.requestId || 'unknown';

    try {
      // Step 1: 执行对比分析
      const analysisStartTime = Date.now();
      
      const cwProviderResponse: ProviderResponse = {
        response: codewhispererResponse,
        metadata: {
          responseTime: 0, // 实际项目中应该从请求指标中获取
          tokenCount: {
            input: codewhispererResponse.usage?.input_tokens || 0,
            output: codewhispererResponse.usage?.output_tokens || 0
          },
          errors: [],
          warnings: []
        }
      };

      const oaiProviderResponse: ProviderResponse = {
        response: openaiResponse,
        metadata: {
          responseTime: 0,
          tokenCount: {
            input: openaiResponse.usage?.input_tokens || 0,
            output: openaiResponse.usage?.output_tokens || 0
          },
          errors: [],
          warnings: []
        }
      };

      const comparisonAnalysis = await this.analysisEngine.analyzeProviderResponses(
        request,
        cwProviderResponse,
        oaiProviderResponse
      );

      const analysisTime = Date.now() - analysisStartTime;

      // Step 2: 应用修正（如果启用）
      let correctionResult: CorrectionResult | undefined;
      let correctionTime = 0;

      if (options.enableCorrection !== false && comparisonAnalysis.differences.length > 0) {
        const correctionStartTime = Date.now();
        
        correctionResult = await this.correctionEngine.correctResponse(
          request,
          codewhispererResponse,
          openaiResponse,
          comparisonAnalysis
        );
        
        correctionTime = Date.now() - correctionStartTime;
      }

      // Step 3: 应用自动修正（如果启用）
      let autoCorrection: ComparisonSystemResult['autoCorrection'];
      let autoLearningTime = 0;

      if (options.enableAutoCorrection !== false) {
        const autoStartTime = Date.now();
        
        autoCorrection = await this.autoCorrection.applyAutomaticCorrection(
          request,
          codewhispererResponse,
          openaiResponse
        );
        
        autoLearningTime = Date.now() - autoStartTime;
      }

      // Step 4: 生成建议
      const recommendations = this.generateSystemRecommendations(
        comparisonAnalysis,
        correctionResult,
        autoCorrection
      );

      const totalProcessingTime = Date.now() - startTime;

      const result: ComparisonSystemResult = {
        comparisonAnalysis,
        correctionResult,
        autoCorrection,
        systemMetrics: {
          totalProcessingTime,
          analysisTime,
          correctionTime,
          autoLearningTime
        },
        recommendations
      };

      // Step 5: 保存结果（如果启用）
      if (options.saveResults !== false && this.config.system.autoSaveResults) {
        await this.saveComparisonResult(requestId, result);
      }

      logger.info('Provider comparison completed successfully', {
        requestId,
        totalTime: totalProcessingTime,
        qualityScore: comparisonAnalysis.qualityScore.overall,
        differencesFound: comparisonAnalysis.differences.length,
        correctionsApplied: correctionResult?.appliedCorrections.length || 0,
        autoRulesApplied: autoCorrection?.appliedRules.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Provider comparison failed', error, requestId);
      throw error;
    }
  }

  private generateSystemRecommendations(
    analysis: ComparisonResult,
    correction?: CorrectionResult,
    autoCorrection?: ComparisonSystemResult['autoCorrection']
  ): ComparisonSystemResult['recommendations'] {
    const recommendations: ComparisonSystemResult['recommendations'] = {
      immediate: [],
      longTerm: [],
      technical: []
    };

    // 基于分析结果的建议
    if (analysis.qualityScore.overall < 50) {
      recommendations.immediate.push('Critical quality issues detected - immediate correction required');
    }

    const criticalDifferences = analysis.differences.filter(d => d.severity === 'critical').length;
    if (criticalDifferences > 0) {
      recommendations.immediate.push(`${criticalDifferences} critical differences found - requires manual review`);
    }

    // 基于修正结果的建议
    if (correction && correction.correctionMetrics.confidenceScore < 0.7) {
      recommendations.technical.push('Low correction confidence - consider improving correction strategies');
    }

    if (correction && correction.correctionMetrics.successfulCorrections === 0) {
      recommendations.longTerm.push('No corrections were successfully applied - review correction engine configuration');
    }

    // 基于自动修正的建议
    if (autoCorrection && autoCorrection.appliedRules.length > 0) {
      recommendations.immediate.push(`${autoCorrection.appliedRules.length} automatic rules applied successfully`);
    }

    if (autoCorrection && autoCorrection.confidence < 0.6) {
      recommendations.longTerm.push('Auto-correction confidence is low - more training data needed');
    }

    // 通用建议
    if (analysis.qualityScore.recommendation === 'needs_correction') {
      recommendations.immediate.push('Response quality below threshold - correction strongly recommended');
    }

    if (analysis.analysis.performanceComparison.responseTime.difference > 5000) {
      recommendations.technical.push('Significant response time difference detected - investigate performance issues');
    }

    return recommendations;
  }

  private async saveComparisonResult(requestId: string, result: ComparisonSystemResult): Promise<void> {
    try {
      const filename = `comparison-${requestId}-${Date.now()}.json`;
      const filepath = path.join(this.config.system.resultStoragePath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf8');
      
      logger.debug('Comparison result saved', { filepath });
    } catch (error) {
      logger.error('Failed to save comparison result', error);
      // Don't throw - saving is not critical
    }
  }

  private async ensureStorageDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.system.resultStoragePath, { recursive: true });
      await fs.mkdir(this.config.autoCorrection.dataStoragePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directories', error);
    }
  }
}

// 导出工厂函数
export function createComparisonSystem(config: ComparisonSystemConfig): ProviderComparisonSystem {
  return new ProviderComparisonSystem(config);
}

// 导出默认配置
export const defaultComparisonConfig: ComparisonSystemConfig = {
  analysis: {
    enableContentAnalysis: true,
    enablePerformanceAnalysis: true,
    enableStructuralAnalysis: true,
    qualityThresholds: {
      critical: 0.3,
      major: 0.6,
      minor: 0.8
    }
  },
  correction: {
    enableContentCorrection: true,
    enableStructuralCorrection: true,
    enableToolCorrection: true,
    enableMetadataCorrection: false,
    confidenceThreshold: 0.7,
    maxCorrections: 10,
    strategies: {
      content: {
        useReferenceLength: true,
        preserveOriginalStyle: false,
        similarityThreshold: 0.5
      },
      structure: {
        normalizeFields: true,
        preserveOriginalData: true
      },
      tools: {
        fixFormat: true,
        validateParameters: true
      }
    }
  },
  autoCorrection: {
    learningEnabled: true,
    minimumDataPoints: 10,
    confidenceThreshold: 0.6,
    patternDetectionThreshold: 3,
    ruleGenerationThreshold: 5,
    maxPatternsPerType: 10,
    maxRules: 50,
    dataStoragePath: path.join(process.env.HOME || '/tmp', '.claude-code-router', 'learning'),
    autoSaveInterval: 300000
  },
  system: {
    enableRealTimeCorrection: true,
    enableLearning: true,
    autoSaveResults: true,
    resultStoragePath: path.join(process.env.HOME || '/tmp', '.claude-code-router', 'comparisons'),
    maxConcurrentComparisons: 5
  }
};

// 重新导出类型
export type {
  ComparisonResult,
  ResponseDifference,
  CorrectionRecommendation
} from './analysis-engine';

export type {
  CorrectionResult,
  AppliedCorrection,
  CorrectionMetrics
} from './correction-engine';