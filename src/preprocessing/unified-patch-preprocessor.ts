/**
 * 统一预处理器（向后兼容包装器）
 * 现在使用统一兼容性预处理器，移除了补丁系统依赖
 * 保持原有API接口以确保兼容性
 */

import { getLogger } from '../logging';
import { 
  getUnifiedCompatibilityPreprocessor,
  UnifiedCompatibilityPreprocessor,
  UnifiedCompatibilityConfig
} from './unified-compatibility-preprocessor';

interface PreprocessingContext {
  requestId: string;
  provider: string;
  model: string;
  stage: 'input' | 'response' | 'streaming';
  timestamp: number;
  metadata?: any;
}

export interface UnifiedPatchPreprocessorConfig {
  enabled: boolean;
  debugMode: boolean;
  forceAllInputs: boolean;
  bypassConditions: string[];
  performanceTracking: boolean;
  cacheResults: boolean;
  validateFinishReason: boolean;
  strictFinishReasonValidation: boolean;
}

export class UnifiedPatchPreprocessor {
  private compatibilityProcessor: UnifiedCompatibilityPreprocessor;
  private logger: ReturnType<typeof getLogger>;
  private config: UnifiedPatchPreprocessorConfig;

  constructor(port?: number, config?: Partial<UnifiedPatchPreprocessorConfig>) {
    this.config = {
      enabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
      debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
      forceAllInputs: process.env.RCC_FORCE_ALL_INPUTS === 'true',
      bypassConditions: [],
      performanceTracking: true,
      cacheResults: process.env.RCC_CACHE_PREPROCESSING === 'true',
      validateFinishReason: true,
      strictFinishReasonValidation: process.env.RCC_STRICT_FINISH_REASON === 'true',
      ...config
    };

    // 强制启用关键验证
    this.config.validateFinishReason = true;

    this.logger = getLogger(port);
    this.compatibilityProcessor = getUnifiedCompatibilityPreprocessor(port, {
      enabled: this.config.enabled,
      debugMode: this.config.debugMode,
      forceAllInputs: this.config.forceAllInputs,
      performanceTracking: this.config.performanceTracking,
      cacheResults: this.config.cacheResults,
      validateFinishReason: this.config.validateFinishReason,
      strictFinishReasonValidation: this.config.strictFinishReasonValidation
    });

    if (this.config.debugMode) {
      this.logger.info('UnifiedPatchPreprocessor initialized (now using UnifiedCompatibilityPreprocessor)', {
        config: this.config,
        port
      });
    }
  }

  /**
   * 统一预处理入口：处理输入阶段数据
   */
  async preprocessInput(
    inputData: any,
    provider: string,
    model: string,
    requestId: string
  ): Promise<any> {
    return this.compatibilityProcessor.preprocessInput(inputData, provider, model, requestId);
  }

  /**
   * 统一预处理入口：处理响应阶段数据
   */
  async preprocessResponse(
    responseData: any,
    provider: string,
    model: string,
    requestId: string
  ): Promise<any> {
    return this.compatibilityProcessor.preprocessResponse(responseData, provider, model, requestId);
  }

  /**
   * 统一预处理入口：处理流式数据块
   */
  async preprocessStreaming(
    chunkData: any,
    provider: string,
    model: string,
    requestId: string
  ): Promise<any> {
    return this.compatibilityProcessor.preprocessStreaming(chunkData, provider, model, requestId);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.compatibilityProcessor.cleanup();
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.compatibilityProcessor.getPerformanceMetrics();
  }

  /**
   * 向后兼容：滑动窗口工具检测
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private async slidingWindowToolDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
    patterns: string[];
  }> {
    console.warn('slidingWindowToolDetection is deprecated, using unified compatibility processor');
    return { hasTools: false, toolCount: 0, patterns: [] };
  }

  /**
   * 向后兼容：强制工具调用检测
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private async forceToolCallDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
  }> {
    console.warn('forceToolCallDetection is deprecated, using unified compatibility processor');
    return { hasTools: false, toolCount: 0 };
  }

  /**
   * 向后兼容：ShuaiHong格式补丁
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private async applyShuaiHongFormatPatch(
    data: any, 
    context: PreprocessingContext
  ): Promise<any> {
    console.warn('applyShuaiHongFormatPatch is deprecated, using unified compatibility processor');
    return data;
  }

  /**
   * 向后兼容：LMStudio工具调用解析
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private parseLMStudioToolCalls(content: string, context: PreprocessingContext): any[] {
    console.warn('parseLMStudioToolCalls is deprecated, using unified compatibility processor');
    return [];
  }

  /**
   * 向后兼容：强制finish reason覆盖
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private forceFinishReasonOverride(
    data: any,
    targetReason: string,
    context: PreprocessingContext
  ): any {
    console.warn('forceFinishReasonOverride is deprecated, using unified compatibility processor');
    return data;
  }

  /**
   * 向后兼容：验证finish reason
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private validateFinishReason(data: any, context: PreprocessingContext): void {
    // 现在由统一兼容性预处理器处理，不需要额外操作
  }

  /**
   * 向后兼容：检测异常响应
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private detectAbnormalResponse(data: any, context: PreprocessingContext): any {
    console.warn('detectAbnormalResponse is deprecated, using unified compatibility processor');
    return null;
  }

  /**
   * 向后兼容：生成错误信息
   * @deprecated 现在由统一兼容性预处理器处理
   */
  private generateErrorMessage(abnormalResponse: any, context: PreprocessingContext): string {
    console.warn('generateErrorMessage is deprecated, using unified compatibility processor');
    return 'Error handled by unified compatibility processor';
  }
}

// 单例模式：全局统一预处理器实例
const preprocessorInstances = new Map<number | string, UnifiedPatchPreprocessor>();

/**
 * 获取或创建统一预处理器实例
 */
export function getUnifiedPatchPreprocessor(
  port?: number, 
  config?: Partial<UnifiedPatchPreprocessorConfig>
): UnifiedPatchPreprocessor {
  const key = port || 'default';
  if (!preprocessorInstances.has(key)) {
    preprocessorInstances.set(key, new UnifiedPatchPreprocessor(port, config));
  }
  return preprocessorInstances.get(key)!;
}

/**
 * 创建新的统一预处理器实例
 */
export function createUnifiedPatchPreprocessor(
  port?: number,
  config?: Partial<UnifiedPatchPreprocessorConfig>
): UnifiedPatchPreprocessor {
  const key = port || 'default';
  const instance = new UnifiedPatchPreprocessor(port, config);
  preprocessorInstances.set(key, instance);
  return instance;
}

/**
 * 重置统一预处理器实例
 */
export function resetUnifiedPatchPreprocessor(port?: number) {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.get(key)!.cleanup();
    preprocessorInstances.delete(key);
  }
}