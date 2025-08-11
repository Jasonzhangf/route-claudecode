/**
 * Provider Response Correction Engine
 * 基于 OpenAI 响应修正 CodeWhisperer 输出
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { ComparisonResult, ResponseDifference, CorrectionRecommendation } from './analysis-engine';

export interface CorrectionResult {
  requestId: string;
  timestamp: Date;
  originalResponse: BaseResponse;
  referenceResponse: BaseResponse;
  correctedResponse: BaseResponse;
  appliedCorrections: AppliedCorrection[];
  correctionMetrics: CorrectionMetrics;
  success: boolean;
  errors: string[];
}

export interface AppliedCorrection {
  type: 'content' | 'structure' | 'metadata' | 'tools' | 'formatting';
  description: string;
  originalValue: any;
  correctedValue: any;
  confidence: number; // 0-1, correction confidence score
  method: string; // correction method used
}

export interface CorrectionMetrics {
  totalCorrections: number;
  successfulCorrections: number;
  failedCorrections: number;
  confidenceScore: number; // average confidence of all corrections
  improvementScore: number; // 0-1, estimated improvement
  processingTime: number; // milliseconds
}

export interface CorrectionStrategy {
  name: string;
  priority: number;
  canCorrect: (difference: ResponseDifference) => boolean;
  apply: (
    original: BaseResponse,
    reference: BaseResponse,
    difference: ResponseDifference
  ) => Promise<CorrectionOperation>;
}

export interface CorrectionOperation {
  success: boolean;
  correctedValue: any;
  confidence: number;
  method: string;
  error?: string;
}

export interface CorrectionConfig {
  enableContentCorrection: boolean;
  enableStructuralCorrection: boolean;
  enableToolCorrection: boolean;
  enableMetadataCorrection: boolean;
  confidenceThreshold: number; // minimum confidence to apply correction
  maxCorrections: number; // maximum corrections per response
  strategies: {
    content: {
      useReferenceLength: boolean;
      preserveOriginalStyle: boolean;
      similarityThreshold: number;
    };
    structure: {
      normalizeFields: boolean;
      preserveOriginalData: boolean;
    };
    tools: {
      fixFormat: boolean;
      validateParameters: boolean;
    };
  };
}

export class CorrectionEngine {
  private correctionHistory: CorrectionResult[] = [];
  private strategies: CorrectionStrategy[] = [];
  private readonly maxHistorySize = 500;

  constructor(private config: CorrectionConfig) {
    this.initializeStrategies();
  }

  /**
   * 应用修正到 CodeWhisperer 响应
   */
  async correctResponse(
    request: BaseRequest,
    codewhispererResponse: BaseResponse,
    openaiReference: BaseResponse,
    comparisonResult: ComparisonResult
  ): Promise<CorrectionResult> {
    const requestId = request.metadata?.requestId || `correction_${Date.now()}`;
    const startTime = Date.now();

    logger.info(`Starting response correction`, {
      requestId,
      differencesCount: comparisonResult.differences.length,
      recommendationsCount: comparisonResult.recommendations.length
    });

    const result: CorrectionResult = {
      requestId,
      timestamp: new Date(),
      originalResponse: { ...codewhispererResponse },
      referenceResponse: { ...openaiReference },
      correctedResponse: { ...codewhispererResponse },
      appliedCorrections: [],
      correctionMetrics: {
        totalCorrections: 0,
        successfulCorrections: 0,
        failedCorrections: 0,
        confidenceScore: 0,
        improvementScore: 0,
        processingTime: 0
      },
      success: false,
      errors: []
    };

    try {
      // 按优先级处理差异
      const sortedDifferences = comparisonResult.differences
        .sort((a, b) => this.getDifferencePriority(a) - this.getDifferencePriority(b));

      for (const difference of sortedDifferences) {
        if (result.appliedCorrections.length >= this.config.maxCorrections) {
          logger.warn(`Maximum corrections limit reached`, { requestId, limit: this.config.maxCorrections });
          break;
        }

        await this.applyCorrection(result, difference);
      }

      // 计算修正指标
      const endTime = Date.now();
      result.correctionMetrics.processingTime = endTime - startTime;
      result.correctionMetrics.totalCorrections = result.appliedCorrections.length;
      result.correctionMetrics.successfulCorrections = result.appliedCorrections.filter(c => c.confidence >= this.config.confidenceThreshold).length;
      result.correctionMetrics.failedCorrections = result.correctionMetrics.totalCorrections - result.correctionMetrics.successfulCorrections;
      
      if (result.appliedCorrections.length > 0) {
        result.correctionMetrics.confidenceScore = result.appliedCorrections
          .reduce((sum, c) => sum + c.confidence, 0) / result.appliedCorrections.length;
      }

      result.correctionMetrics.improvementScore = this.calculateImprovementScore(
        result.originalResponse,
        result.correctedResponse,
        result.referenceResponse
      );

      result.success = result.errors.length === 0 && result.appliedCorrections.length > 0;

      // 存储到历史记录
      this.addToHistory(result);

      logger.info(`Response correction completed`, {
        requestId,
        success: result.success,
        correctionsApplied: result.correctionMetrics.successfulCorrections,
        averageConfidence: result.correctionMetrics.confidenceScore,
        improvementScore: result.correctionMetrics.improvementScore
      });

      return result;

    } catch (error) {
      logger.error(`Response correction failed`, error, requestId);
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.success = false;
      return result;
    }
  }

  /**
   * 批量修正模式
   */
  async correctResponseBatch(
    corrections: Array<{
      request: BaseRequest;
      codewhispererResponse: BaseResponse;
      openaiReference: BaseResponse;
      comparisonResult: ComparisonResult;
    }>
  ): Promise<CorrectionResult[]> {
    logger.info(`Starting batch correction`, { batchSize: corrections.length });

    const results: CorrectionResult[] = [];
    
    for (let i = 0; i < corrections.length; i++) {
      const { request, codewhispererResponse, openaiReference, comparisonResult } = corrections[i];
      
      try {
        const result = await this.correctResponse(
          request,
          codewhispererResponse,
          openaiReference,
          comparisonResult
        );
        results.push(result);
        
        logger.debug(`Batch correction progress: ${i + 1}/${corrections.length}`);
      } catch (error) {
        logger.error(`Batch correction item ${i} failed`, error);
        // Continue with next item
      }
    }

    logger.info(`Batch correction completed`, {
      total: corrections.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * 应用单个修正
   */
  private async applyCorrection(
    result: CorrectionResult,
    difference: ResponseDifference
  ): Promise<void> {
    // 找到适用的策略
    const strategy = this.strategies.find(s => s.canCorrect(difference));
    
    if (!strategy) {
      logger.debug(`No strategy found for difference type: ${difference.type}`);
      return;
    }

    try {
      const operation = await strategy.apply(
        result.correctedResponse,
        result.referenceResponse,
        difference
      );

      if (operation.success && operation.confidence >= this.config.confidenceThreshold) {
        // 应用修正
        this.applyOperationToResponse(result.correctedResponse, difference, operation);

        result.appliedCorrections.push({
          type: difference.type,
          description: difference.description,
          originalValue: difference.codewhispererValue,
          correctedValue: operation.correctedValue,
          confidence: operation.confidence,
          method: operation.method
        });

        logger.debug(`Correction applied successfully`, {
          type: difference.type,
          confidence: operation.confidence,
          method: operation.method
        });
      } else {
        logger.debug(`Correction skipped due to low confidence or failure`, {
          type: difference.type,
          confidence: operation.confidence,
          threshold: this.config.confidenceThreshold,
          error: operation.error
        });
      }

    } catch (error) {
      result.errors.push(`Failed to apply correction for ${difference.type}: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`Correction application failed`, error);
    }
  }

  /**
   * 将操作应用到响应对象
   */
  private applyOperationToResponse(
    response: BaseResponse,
    difference: ResponseDifference,
    operation: CorrectionOperation
  ): void {
    switch (difference.type) {
      case 'content':
        if (response.content && Array.isArray(response.content)) {
          response.content = operation.correctedValue;
        }
        break;

      case 'structure':
        // 应用结构修正
        Object.assign(response, operation.correctedValue);
        break;

      case 'tools':
        if (response.content && Array.isArray(response.content)) {
          // 查找并替换工具调用
          const toolIndex = response.content.findIndex(item => item.type === 'tool_use');
          if (toolIndex !== -1) {
            response.content[toolIndex] = operation.correctedValue;
          }
        }
        break;

      case 'metadata':
        if (operation.correctedValue.usage) {
          response.usage = operation.correctedValue.usage;
        }
        break;
    }
  }

  /**
   * 初始化修正策略
   */
  private initializeStrategies(): void {
    // 内容修正策略
    this.strategies.push({
      name: 'content-length-correction',
      priority: 1,
      canCorrect: (diff) => diff.type === 'content' && diff.severity !== 'minor',
      apply: async (original, reference, difference) => {
        try {
          const originalContent = this.extractTextContent(original);
          const referenceContent = this.extractTextContent(reference);
          
          if (referenceContent.length > originalContent.length * 1.5) {
            // 参考响应明显更完整，使用参考内容
            const correctedContent = this.normalizeContent(reference.content);
            
            return {
              success: true,
              correctedValue: correctedContent,
              confidence: 0.8,
              method: 'reference-content-adoption'
            };
          }
          
          return {
            success: false,
            correctedValue: null,
            confidence: 0,
            method: 'content-length-check',
            error: 'Reference content not significantly better'
          };
        } catch (error) {
          return {
            success: false,
            correctedValue: null,
            confidence: 0,
            method: 'content-correction',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });

    // 结构修正策略
    this.strategies.push({
      name: 'structure-normalization',
      priority: 2,
      canCorrect: (diff) => diff.type === 'structure',
      apply: async (original, reference, difference) => {
        try {
          const correctedStructure = {
            ...original,
            // 添加缺失的字段
            ...(reference.type && !original.type && { type: reference.type }),
            ...(reference.id && !original.id && { id: reference.id }),
            // 保持原有数据
          };

          return {
            success: true,
            correctedValue: correctedStructure,
            confidence: 0.9,
            method: 'structure-field-normalization'
          };
        } catch (error) {
          return {
            success: false,
            correctedValue: null,
            confidence: 0,
            method: 'structure-normalization',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });

    // 工具调用修正策略
    this.strategies.push({
      name: 'tool-format-correction',
      priority: 3,
      canCorrect: (diff) => diff.type === 'tools',
      apply: async (original, reference, difference) => {
        try {
          const referenceTools = this.extractToolCalls(reference);
          if (referenceTools.length === 0) {
            return {
              success: false,
              correctedValue: null,
              confidence: 0,
              method: 'tool-format-correction',
              error: 'No reference tools to correct against'
            };
          }

          // 使用参考工具调用格式
          const correctedTool = {
            ...referenceTools[0],
            // 保持原有ID如果存在
            ...(difference.codewhispererValue.id && { id: difference.codewhispererValue.id })
          };

          return {
            success: true,
            correctedValue: correctedTool,
            confidence: 0.85,
            method: 'reference-tool-format-adoption'
          };
        } catch (error) {
          return {
            success: false,
            correctedValue: null,
            confidence: 0,
            method: 'tool-format-correction',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });

    // 元数据修正策略
    this.strategies.push({
      name: 'metadata-correction',
      priority: 4,
      canCorrect: (diff) => diff.type === 'metadata',
      apply: async (original, reference, difference) => {
        try {
          // 保持原始数据，但标准化格式
          const correctedMetadata = {
            usage: original.usage || reference.usage
          };

          return {
            success: true,
            correctedValue: correctedMetadata,
            confidence: 0.7,
            method: 'metadata-standardization'
          };
        } catch (error) {
          return {
            success: false,
            correctedValue: null,
            confidence: 0,
            method: 'metadata-correction',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    });
  }

  // 辅助方法

  private getDifferencePriority(difference: ResponseDifference): number {
    switch (difference.severity) {
      case 'critical': return 1;
      case 'major': return 2;
      case 'minor': return 3;
      default: return 4;
    }
  }

  private extractTextContent(response: BaseResponse): string {
    if (!response.content || !Array.isArray(response.content)) {
      return '';
    }

    return response.content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join(' ');
  }

  private extractToolCalls(response: BaseResponse): any[] {
    if (!response.content || !Array.isArray(response.content)) {
      return [];
    }

    return response.content.filter(item => item.type === 'tool_use');
  }

  private normalizeContent(content: any[]): any[] {
    if (!Array.isArray(content)) return [];
    
    return content.map(item => ({
      ...item,
      // 标准化字段
      type: item.type || 'text',
      ...(item.text && { text: item.text.trim() })
    }));
  }

  private calculateImprovementScore(
    original: BaseResponse,
    corrected: BaseResponse,
    reference: BaseResponse
  ): number {
    try {
      const originalSimilarity = this.calculateResponseSimilarity(original, reference);
      const correctedSimilarity = this.calculateResponseSimilarity(corrected, reference);
      
      return Math.max(0, correctedSimilarity - originalSimilarity);
    } catch (error) {
      logger.debug('Failed to calculate improvement score', error);
      return 0;
    }
  }

  private calculateResponseSimilarity(response1: BaseResponse, response2: BaseResponse): number {
    const content1 = this.extractTextContent(response1);
    const content2 = this.extractTextContent(response2);
    
    if (!content1 || !content2) return 0;
    
    // 简化的相似度计算
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])];
    
    return commonWords.length / totalWords.length;
  }

  private addToHistory(result: CorrectionResult): void {
    this.correctionHistory.push(result);
    
    // 限制历史记录大小
    if (this.correctionHistory.length > this.maxHistorySize) {
      this.correctionHistory = this.correctionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 获取修正历史
   */
  public getCorrectionHistory(limit?: number): CorrectionResult[] {
    if (limit) {
      return this.correctionHistory.slice(-limit);
    }
    return [...this.correctionHistory];
  }

  /**
   * 获取修正统计
   */
  public getCorrectionStatistics(): {
    totalCorrections: number;
    averageConfidence: number;
    averageImprovement: number;
    successRate: number;
    commonCorrectionTypes: Record<string, number>;
    performanceMetrics: {
      averageProcessingTime: number;
      correctionsPerSecond: number;
    };
  } {
    if (this.correctionHistory.length === 0) {
      return {
        totalCorrections: 0,
        averageConfidence: 0,
        averageImprovement: 0,
        successRate: 0,
        commonCorrectionTypes: {},
        performanceMetrics: {
          averageProcessingTime: 0,
          correctionsPerSecond: 0
        }
      };
    }

    const allCorrections = this.correctionHistory.flatMap(r => r.appliedCorrections);
    const successfulResults = this.correctionHistory.filter(r => r.success);

    const averageConfidence = allCorrections.length > 0 
      ? allCorrections.reduce((sum, c) => sum + c.confidence, 0) / allCorrections.length
      : 0;

    const averageImprovement = this.correctionHistory.length > 0
      ? this.correctionHistory.reduce((sum, r) => sum + r.correctionMetrics.improvementScore, 0) / this.correctionHistory.length
      : 0;

    const successRate = this.correctionHistory.length > 0
      ? successfulResults.length / this.correctionHistory.length
      : 0;

    const correctionTypes = allCorrections.reduce((acc, correction) => {
      acc[correction.type] = (acc[correction.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const processingTimes = this.correctionHistory.map(r => r.correctionMetrics.processingTime);
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    const totalProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0);
    const correctionsPerSecond = totalProcessingTime > 0
      ? (allCorrections.length * 1000) / totalProcessingTime
      : 0;

    return {
      totalCorrections: allCorrections.length,
      averageConfidence,
      averageImprovement,
      successRate,
      commonCorrectionTypes: correctionTypes,
      performanceMetrics: {
        averageProcessingTime,
        correctionsPerSecond
      }
    };
  }

  /**
   * 学习并更新策略（简化版机器学习）
   */
  public async learnFromHistory(): Promise<void> {
    if (this.correctionHistory.length < 10) {
      logger.info('Insufficient history data for learning');
      return;
    }

    logger.info('Starting correction strategy learning from history');

    // 分析成功率最高的策略
    const strategySuccessRates = new Map<string, { success: number; total: number }>();

    for (const result of this.correctionHistory) {
      for (const correction of result.appliedCorrections) {
        const method = correction.method;
        const stats = strategySuccessRates.get(method) || { success: 0, total: 0 };
        
        stats.total++;
        if (correction.confidence >= this.config.confidenceThreshold) {
          stats.success++;
        }
        
        strategySuccessRates.set(method, stats);
      }
    }

    // 更新策略优先级（简化版）
    for (const strategy of this.strategies) {
      const stats = strategySuccessRates.get(strategy.name);
      if (stats && stats.total >= 5) {
        const successRate = stats.success / stats.total;
        // 根据成功率调整优先级
        strategy.priority = Math.round(strategy.priority * (2 - successRate));
      }
    }

    logger.info('Strategy learning completed', {
      strategiesAnalyzed: strategySuccessRates.size,
      totalHistory: this.correctionHistory.length
    });
  }
}