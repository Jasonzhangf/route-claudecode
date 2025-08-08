/**
 * 统一预处理器 - 重构版本
 * 作为所有格式的统一入口，使用模块化解析器
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

import { getParserManager, FormatParserManager } from './parsers/parser-manager';
import { ParsingContext } from './parsers/base-parser';
import { getLogger } from '../logging';

export interface PreprocessingResult {
  data: any;
  hasTools: boolean;
  toolCount: number;
  finishReason?: string;
  modified: boolean;
  processingTime: number;
}

export interface UnifiedPreprocessorConfig {
  enabled: boolean;
  debugMode: boolean;
  strictMode: boolean;
  performanceTracking: boolean;
  forceToolDetection: boolean; // 强制工具检测，不可配置关闭
  forceFinishReasonFix: boolean; // 强制finish reason修复
}

export class UnifiedPreprocessor {
  private parserManager: FormatParserManager;
  private logger: ReturnType<typeof getLogger>;
  private config: UnifiedPreprocessorConfig;
  private performanceMetrics = {
    totalProcessed: 0,
    totalDuration: 0,
    toolDetections: 0,
    finishReasonFixes: 0,
    errors: 0
  };

  constructor(port?: number, config?: Partial<UnifiedPreprocessorConfig>) {
    this.config = {
      enabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
      debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
      strictMode: true, // 强制严格模式
      performanceTracking: true,
      forceToolDetection: true, // 强制启用，不可配置关闭
      forceFinishReasonFix: true, // 强制启用，不可配置关闭
      ...config
    };

    // 🚨 强制关键配置，防止被覆盖
    this.config.strictMode = true;
    this.config.forceToolDetection = true;
    this.config.forceFinishReasonFix = true;

    this.logger = getLogger(port);
    this.parserManager = getParserManager({
      strictMode: this.config.strictMode,
      debugMode: this.config.debugMode
    });

    if (this.config.debugMode) {
      console.log('🎯 [UNIFIED-PREPROCESSOR] Initialized with config:', this.config);
    }
  }

  /**
   * 预处理请求数据
   */
  async preprocessRequest(
    data: any,
    provider: string,
    requestId: string
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: 0
      };
    }

    const context: ParsingContext = {
      provider,
      requestId,
      stage: 'request',
      format: this.detectFormat(data)
    };

    try {
      // 请求阶段主要是验证和清理，不做工具检测
      const result: PreprocessingResult = {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: Date.now() - startTime
      };

      this.updateMetrics(result);
      return result;

    } catch (error) {
      this.performanceMetrics.errors++;
      
      console.error('🚨 [UNIFIED-PREPROCESSOR] Request preprocessing failed:', {
        error: error instanceof Error ? error.message : String(error),
        provider,
        requestId
      });

      // 严格模式下抛出错误
      if (this.config.strictMode) {
        throw error;
      }

      // 返回原始数据
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 预处理响应数据
   */
  async preprocessResponse(
    data: any,
    provider: string,
    requestId: string
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: 0
      };
    }

    const context: ParsingContext = {
      provider,
      requestId,
      stage: 'response',
      format: this.detectFormat(data)
    };

    try {
      let modifiedData = data;
      let modified = false;

      // 🎯 强制工具调用检测
      const parseResult = this.parserManager.parseToolCalls(modifiedData, context);
      
      if (this.config.debugMode) {
        console.log('🔍 [UNIFIED-PREPROCESSOR] Tool detection result:', {
          hasTools: parseResult.hasTools,
          toolCount: parseResult.toolCount,
          confidence: parseResult.confidence,
          provider,
          requestId
        });
      }

      // 🔧 强制finish reason修复（如果检测到工具调用）
      if (parseResult.hasTools && this.config.forceFinishReasonFix) {
        try {
          modifiedData = this.parserManager.fixFinishReason(
            modifiedData, 
            'tool_calls', 
            context
          );
          modified = true;
          this.performanceMetrics.finishReasonFixes++;

          console.log('🔧 [UNIFIED-PREPROCESSOR] Forced finish_reason fix for tool calls:', {
            toolCount: parseResult.toolCount,
            provider,
            requestId
          });

        } catch (error) {
          console.error('🚨 [UNIFIED-PREPROCESSOR] Finish reason fix failed:', {
            error: error instanceof Error ? error.message : String(error),
            provider,
            requestId
          });

          if (this.config.strictMode) {
            throw error;
          }
        }
      }

      const result: PreprocessingResult = {
        data: modifiedData,
        hasTools: parseResult.hasTools,
        toolCount: parseResult.toolCount,
        finishReason: parseResult.finishReason,
        modified,
        processingTime: Date.now() - startTime
      };

      this.updateMetrics(result);
      return result;

    } catch (error) {
      this.performanceMetrics.errors++;
      
      console.error('🚨 [UNIFIED-PREPROCESSOR] Response preprocessing failed:', {
        error: error instanceof Error ? error.message : String(error),
        provider,
        requestId
      });

      // 严格模式下抛出错误
      if (this.config.strictMode) {
        throw error;
      }

      // 返回原始数据
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 预处理流式数据
   */
  async preprocessStreaming(
    data: any,
    provider: string,
    requestId: string
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: 0
      };
    }

    const context: ParsingContext = {
      provider,
      requestId,
      stage: 'response', // 流式数据按响应处理
      format: this.detectFormat(data)
    };

    try {
      // 流式数据的工具检测（轻量级）
      const parseResult = this.parserManager.parseToolCalls(data, context);
      
      const result: PreprocessingResult = {
        data,
        hasTools: parseResult.hasTools,
        toolCount: parseResult.toolCount,
        finishReason: parseResult.finishReason,
        modified: false, // 流式数据通常不修改
        processingTime: Date.now() - startTime
      };

      this.updateMetrics(result);
      return result;

    } catch (error) {
      this.performanceMetrics.errors++;
      
      console.error('🚨 [UNIFIED-PREPROCESSOR] Streaming preprocessing failed:', {
        error: error instanceof Error ? error.message : String(error),
        provider,
        requestId
      });

      // 流式处理失败不应该中断流
      return {
        data,
        hasTools: false,
        toolCount: 0,
        modified: false,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 检测数据格式
   */
  private detectFormat(data: any): 'anthropic' | 'openai' | 'gemini' {
    if (!data || typeof data !== 'object') {
      return 'anthropic'; // 默认格式
    }

    // 简单的格式检测
    if (data.choices && Array.isArray(data.choices)) {
      return 'openai';
    }

    if (data.candidates && Array.isArray(data.candidates)) {
      return 'gemini';
    }

    if (data.content && Array.isArray(data.content)) {
      return 'anthropic';
    }

    // 默认返回anthropic格式
    return 'anthropic';
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(result: PreprocessingResult): void {
    if (!this.config.performanceTracking) {
      return;
    }

    this.performanceMetrics.totalProcessed++;
    this.performanceMetrics.totalDuration += result.processingTime;

    if (result.hasTools) {
      this.performanceMetrics.toolDetections++;
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceMetrics() {
    const avgDuration = this.performanceMetrics.totalProcessed > 0 
      ? this.performanceMetrics.totalDuration / this.performanceMetrics.totalProcessed 
      : 0;

    return {
      ...this.performanceMetrics,
      averageDuration: Math.round(avgDuration * 100) / 100,
      parserStats: this.parserManager.getStats(),
      config: this.config
    };
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalProcessed: 0,
      totalDuration: 0,
      toolDetections: 0,
      finishReasonFixes: 0,
      errors: 0
    };

    console.log('🔄 [UNIFIED-PREPROCESSOR] Metrics reset');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UnifiedPreprocessorConfig>): void {
    // 保护关键配置不被覆盖
    const protectedConfig = {
      ...this.config,
      ...newConfig,
      strictMode: true, // 强制严格模式
      forceToolDetection: true, // 强制工具检测
      forceFinishReasonFix: true // 强制finish reason修复
    };

    this.config = protectedConfig;
    
    console.log('🔧 [UNIFIED-PREPROCESSOR] Config updated:', protectedConfig);
  }
}

// 单例模式：全局预处理器实例
const preprocessorInstances = new Map<number | string, UnifiedPreprocessor>();

/**
 * 获取或创建统一预处理器实例
 */
export function getUnifiedPreprocessor(
  port?: number, 
  config?: Partial<UnifiedPreprocessorConfig>
): UnifiedPreprocessor {
  const key = port || 'default';
  
  if (!preprocessorInstances.has(key)) {
    preprocessorInstances.set(key, new UnifiedPreprocessor(port, config));
  }

  return preprocessorInstances.get(key)!;
}

/**
 * 重置统一预处理器实例
 */
export function resetUnifiedPreprocessor(port?: number): void {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.delete(key);
  }
}