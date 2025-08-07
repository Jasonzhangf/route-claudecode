/**
 * 响应处理流水线
 * 模型响应 -> 预处理 -> 流式/非流式响应 -> 格式转换 -> 后处理 -> 客户端
 */

import { getLogger } from '../logging';
import { PatchManager } from '../patches/manager';
import { TransformationManager } from '../transformers/manager';
import { UnifiedToolCallDetector } from '../utils/unified-tool-call-detector';
import { Provider } from '../types';
import { Provider as PatchProvider } from '../patches/types';

export interface PipelineContext {
  requestId: string;
  provider: string;
  model: string;
  isStreaming: boolean;
  timestamp: number;
}

export interface PipelineStage {
  name: string;
  description: string;
  priority: number;
  process(data: any, context: PipelineContext): Promise<any>;
}

/**
 * 预处理阶段：工具调用检测和基础清理
 */
export class PreprocessingStage implements PipelineStage {
  name = 'preprocessing';
  description = '预处理：工具调用检测、格式清理、数据验证';
  priority = 1;

  private toolCallDetector: UnifiedToolCallDetector;
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.toolCallDetector = new UnifiedToolCallDetector(port);
    this.logger = getLogger(port);
  }

  async process(data: any, context: PipelineContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 🔍 追踪工具调用 - 处理前
      const toolCountBefore = this.countToolCalls(data);
      this.logger.debug('Preprocessing stage started', {
        dataType: typeof data,
        hasContent: !!data?.content,
        isStreaming: context.isStreaming,
        toolCallsBefore: toolCountBefore,
        contentBlocks: data?.content?.length || 0,
        contentTypes: data?.content?.map((b: any) => b.type) || []
      }, context.requestId, 'pipeline-preprocessing');

      // 🎯 统一工具调用检测 - 对所有OpenAI兼容输入都执行监测
      const processedData = await this.toolCallDetector.detectAndProcess(data, {
        provider: context.provider,
        model: context.model,
        isStreaming: context.isStreaming,
        requestId: context.requestId
      });

      // 基础数据验证和清理
      const cleanedData = this.cleanAndValidateData(processedData, context);

      const duration = Date.now() - startTime;
      const toolCountAfter = this.countToolCalls(cleanedData);
      const toolCountProcessed = this.countToolCalls(processedData);
      
      this.logger.debug('Preprocessing stage completed', {
        duration: `${duration}ms`,
        hasChanges: processedData !== data,
        toolCallsBefore: toolCountBefore,
        toolCallsAfterDetection: toolCountProcessed,
        toolCallsAfterCleaning: toolCountAfter,
        contentBlocksAfter: cleanedData?.content?.length || 0,
        contentTypesAfter: cleanedData?.content?.map((b: any) => b.type) || []
      }, context.requestId, 'pipeline-preprocessing');
      
      // 🚨 检查工具调用是否丢失
      if (toolCountProcessed > toolCountAfter) {
        this.logger.warn('🚨 Tool calls lost during cleaning stage', {
          beforeCleaning: toolCountProcessed,
          afterCleaning: toolCountAfter,
          lostCount: toolCountProcessed - toolCountAfter
        }, context.requestId, 'pipeline-tool-loss');
      }

      return cleanedData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Preprocessing stage failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'pipeline-preprocessing');
      
      // 预处理失败时返回原始数据，不中断流水线
      return data;
    }
  }

  private cleanAndValidateData(data: any, context: PipelineContext): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 清理空值和无效字段
    const cleaned = { ...data };
    
    // 移除空的content块
    if (cleaned.content && Array.isArray(cleaned.content)) {
      cleaned.content = cleaned.content.filter((block: any) => {
        if (!block || typeof block !== 'object') return false;
        if (block.type === 'text' && (!block.text || block.text.trim() === '')) return false;
        return true;
      });
    }

    return cleaned;
  }

  private countToolCalls(data: any): number {
    if (!data?.content || !Array.isArray(data.content)) {
      return 0;
    }
    return data.content.filter((block: any) => block.type === 'tool_use').length;
  }

}

/**
 * 流式处理阶段：处理流式响应的特殊逻辑
 */
export class StreamingStage implements PipelineStage {
  name = 'streaming';
  description = '流式处理：滑动窗口检测、块合并、流式格式转换';
  priority = 2;

  private patchManager: PatchManager;
  private logger: ReturnType<typeof getLogger>;

  constructor(patchManager: PatchManager, port?: number) {
    this.patchManager = patchManager;
    this.logger = getLogger(port);
  }

  async process(data: any, context: PipelineContext): Promise<any> {
    if (!context.isStreaming) {
      return data; // 非流式响应跳过此阶段
    }

    const startTime = Date.now();
    
    try {
      this.logger.debug('Streaming stage started', {
        dataType: typeof data,
        dataLength: typeof data === 'string' ? data.length : 'N/A'
      }, context.requestId, 'pipeline-streaming');

      // 应用流式补丁
      const processedData = await this.patchManager.applyStreamingPatches(
        data, 
        context.provider as PatchProvider, 
        context.model, 
        context.requestId
      );

      const duration = Date.now() - startTime;
      this.logger.debug('Streaming stage completed', {
        duration: `${duration}ms`,
        hasChanges: processedData !== data
      }, context.requestId, 'pipeline-streaming');

      return processedData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Streaming stage failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'pipeline-streaming');
      
      return data;
    }
  }
}

/**
 * 格式转换阶段：统一格式转换
 */
export class TransformationStage implements PipelineStage {
  name = 'transformation';
  description = '格式转换：Provider格式到统一格式的转换';
  priority = 3;

  private transformationManager: TransformationManager;
  private logger: ReturnType<typeof getLogger>;

  constructor(transformationManager: TransformationManager, port?: number) {
    this.transformationManager = transformationManager;
    this.logger = getLogger(port);
  }

  async process(data: any, context: PipelineContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Transformation stage started', {
        provider: context.provider,
        model: context.model
      }, context.requestId, 'pipeline-transformation');

      // 根据provider类型进行格式转换
      let transformedData = data;
      
      if (context.provider === 'openai') {
        // OpenAI格式转换为统一格式
        transformedData = this.transformationManager.transformResponse(data, {
          sourceProvider: 'openai',
          targetProvider: 'anthropic' // 转换为Anthropic格式作为统一格式
        }, context.requestId);
      } else if (context.provider.includes('gemini')) {
        // 🔧 修复：Gemini格式转换到Anthropic格式
        transformedData = this.convertGeminiToAnthropic(data, context);
      }
      // Anthropic格式保持不变

      const duration = Date.now() - startTime;
      this.logger.debug('Transformation stage completed', {
        duration: `${duration}ms`,
        hasChanges: transformedData !== data
      }, context.requestId, 'pipeline-transformation');

      return transformedData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Transformation stage failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'pipeline-transformation');
      
      return data;
    }
  }

  /**
   * 转换Gemini响应到Anthropic格式
   * 🔧 修复：确保工具调用正确转换和stop_reason设置
   */
  private convertGeminiToAnthropic(data: any, context: PipelineContext): any {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Converting Gemini response to Anthropic format', {
        hasContent: !!data?.content,
        stopReason: data?.stop_reason,
        hasChoices: !!data?.choices
      }, context.requestId, 'pipeline-gemini-conversion');

      // 如果已经是Anthropic格式，直接返回
      if (data && Array.isArray(data.content) && data.role === 'assistant' && data.type === 'message') {
        return data;
      }

      // 如果有choices字段(类似OpenAI格式)，提取message
      let sourceData = data;
      if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
        sourceData = {
          ...data,
          ...data.choices[0].message,
          stop_reason: this.mapGeminiStopReason(data.choices[0].finish_reason),
          usage: data.usage
        };
      }

      // 确保content是数组格式
      let content: any[] = [];
      if (Array.isArray(sourceData.content)) {
        content = sourceData.content;
      } else if (typeof sourceData.content === 'string' && sourceData.content.trim()) {
        content = [{ type: 'text', text: sourceData.content }];
      } else if (sourceData.content && typeof sourceData.content === 'object') {
        content = [{ type: 'text', text: JSON.stringify(sourceData.content) }];
      }

      // 🎯 关键修复：检查并修正工具调用的stop_reason
      const hasToolCalls = content.some(block => block.type === 'tool_use');
      let finalStopReason = sourceData.stop_reason;
      
      if (hasToolCalls && (finalStopReason === 'end_turn' || finalStopReason === 'stop' || !finalStopReason)) {
        finalStopReason = 'tool_use';
        this.logger.debug('🔧 Fixed stop_reason for tool calls', {
          originalStopReason: sourceData.stop_reason,
          correctedStopReason: finalStopReason,
          toolCallCount: content.filter(b => b.type === 'tool_use').length
        }, context.requestId, 'pipeline-gemini-conversion');
      }

      const anthropicData = {
        id: sourceData.id || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: content,
        stop_reason: finalStopReason,
        stop_sequence: sourceData.stop_sequence || null,
        usage: {
          input_tokens: sourceData.usage?.input_tokens || sourceData.usage?.prompt_tokens || 0,
          output_tokens: sourceData.usage?.output_tokens || sourceData.usage?.completion_tokens || 0
        },
        model: context.model
      };

      const duration = Date.now() - startTime;
      this.logger.debug('Gemini to Anthropic conversion completed', {
        duration: `${duration}ms`,
        contentBlocks: anthropicData.content.length,
        textBlocks: anthropicData.content.filter(b => b.type === 'text').length,
        toolBlocks: anthropicData.content.filter(b => b.type === 'tool_use').length,
        finalStopReason: anthropicData.stop_reason,
        originalStopReason: sourceData.stop_reason
      }, context.requestId, 'pipeline-gemini-conversion');

      return anthropicData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Gemini to Anthropic conversion failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'pipeline-gemini-conversion');
      
      // 转换失败时返回原始数据
      return data;
    }
  }

  /**
   * 映射Gemini停止原因到Anthropic格式
   */
  private mapGeminiStopReason(geminiReason?: string): string {
    if (!geminiReason) return 'end_turn';
    
    const mapping: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn',
      'stop': 'end_turn',
      'length': 'max_tokens',
      'content_filter': 'stop_sequence'
    };

    return mapping[geminiReason] || 'end_turn';
  }
}

/**
 * 后处理阶段：最终清理和优化
 */
export class PostprocessingStage implements PipelineStage {
  name = 'postprocessing';
  description = '后处理：最终清理、优化、统计记录';
  priority = 4;

  private patchManager: PatchManager;
  private logger: ReturnType<typeof getLogger>;

  constructor(patchManager: PatchManager, port?: number) {
    this.patchManager = patchManager;
    this.logger = getLogger(port);
  }

  async process(data: any, context: PipelineContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Postprocessing stage started', {
        dataType: typeof data,
        hasContent: !!data?.content
      }, context.requestId, 'pipeline-postprocessing');

      // 应用响应补丁
      const processedData = await this.patchManager.applyResponsePatches(
        data, 
        context.provider as PatchProvider, 
        context.model, 
        context.requestId
      );

      // 最终数据清理
      const finalData = this.finalCleanup(processedData, context);

      const duration = Date.now() - startTime;
      this.logger.debug('Postprocessing stage completed', {
        duration: `${duration}ms`,
        hasChanges: finalData !== data
      }, context.requestId, 'pipeline-postprocessing');

      return finalData;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Postprocessing stage failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'pipeline-postprocessing');
      
      return data;
    }
  }

  private finalCleanup(data: any, context: PipelineContext): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const cleaned = { ...data };

    // 确保必要字段存在
    if (!cleaned.id) {
      cleaned.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }

    if (!cleaned.type) {
      cleaned.type = 'message';
    }

    if (!cleaned.role) {
      cleaned.role = 'assistant';
    }

    return cleaned;
  }
}

/**
 * 响应处理流水线管理器
 */
export class ResponsePipeline {
  private stages: PipelineStage[] = [];
  private logger: ReturnType<typeof getLogger>;

  constructor(
    patchManager: PatchManager,
    transformationManager: TransformationManager,
    port?: number
  ) {
    this.logger = getLogger(port);
    
    // 初始化流水线阶段
    this.stages = [
      new PreprocessingStage(port),
      new StreamingStage(patchManager, port),
      new TransformationStage(transformationManager, port),
      new PostprocessingStage(patchManager, port)
    ].sort((a, b) => a.priority - b.priority);

    this.logger.info('Response pipeline initialized', {
      stages: this.stages.map(s => s.name),
      totalStages: this.stages.length
    });
  }

  /**
   * 处理响应数据通过完整流水线
   */
  async process(data: any, context: PipelineContext): Promise<any> {
    const pipelineStartTime = Date.now();
    
    this.logger.debug('Pipeline processing started', {
      stages: this.stages.length,
      isStreaming: context.isStreaming,
      provider: context.provider,
      model: context.model
    }, context.requestId, 'pipeline-start');

    let currentData = data;
    const stageResults: Array<{stage: string, duration: number, hasChanges: boolean}> = [];

    for (const stage of this.stages) {
      const stageStartTime = Date.now();
      const originalData = currentData;
      
      try {
        currentData = await stage.process(currentData, context);
        
        const stageDuration = Date.now() - stageStartTime;
        const hasChanges = currentData !== originalData;
        
        stageResults.push({
          stage: stage.name,
          duration: stageDuration,
          hasChanges
        });

        this.logger.debug(`Pipeline stage ${stage.name} completed`, {
          duration: `${stageDuration}ms`,
          hasChanges
        }, context.requestId, `pipeline-${stage.name}`);

      } catch (error) {
        const stageDuration = Date.now() - stageStartTime;
        
        this.logger.error(`Pipeline stage ${stage.name} failed`, {
          error: error instanceof Error ? error.message : String(error),
          duration: `${stageDuration}ms`
        }, context.requestId, `pipeline-${stage.name}`);
        
        // 阶段失败时继续使用原始数据
        stageResults.push({
          stage: stage.name,
          duration: stageDuration,
          hasChanges: false
        });
      }
    }

    const totalDuration = Date.now() - pipelineStartTime;
    
    this.logger.info('Pipeline processing completed', {
      totalDuration: `${totalDuration}ms`,
      stageResults,
      hasOverallChanges: currentData !== data
    }, context.requestId, 'pipeline-complete');

    return currentData;
  }

  /**
   * 获取流水线统计信息
   */
  getStats(): {
    stages: Array<{name: string, description: string, priority: number}>,
    totalStages: number
  } {
    return {
      stages: this.stages.map(s => ({
        name: s.name,
        description: s.description,
        priority: s.priority
      })),
      totalStages: this.stages.length
    };
  }

  /**
   * 添加自定义阶段
   */
  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
    this.stages.sort((a, b) => a.priority - b.priority);
    
    this.logger.info(`Added custom pipeline stage: ${stage.name}`, {
      priority: stage.priority,
      totalStages: this.stages.length
    });
  }

  /**
   * 移除阶段
   */
  removeStage(stageName: string): boolean {
    const initialLength = this.stages.length;
    this.stages = this.stages.filter(s => s.name !== stageName);
    
    const removed = this.stages.length < initialLength;
    if (removed) {
      this.logger.info(`Removed pipeline stage: ${stageName}`, {
        totalStages: this.stages.length
      });
    }
    
    return removed;
  }
}