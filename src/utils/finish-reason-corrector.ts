/**
 * Finish Reason修正器
 * 专门修复OpenAI工具调用的finish_reason映射问题
 * 确保工具调用返回正确的finish_reason
 */

import { getLogger } from '../logging';

export interface FinishReasonCorrectionContext {
  provider: string;
  model: string;
  requestId: string;
  hasToolsInRequest: boolean;
  isStreaming: boolean;
}

export interface FinishReasonCorrectionResult {
  originalReason: string;
  correctedReason: string;
  wasCorreted: boolean;
  confidence: number;
  detectionMethod: string;
}

export class FinishReasonCorrector {
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.logger = getLogger(port);
  }

  /**
   * 修正finish_reason - 核心方法
   */
  correctFinishReason(
    originalReason: string,
    responseData: any,
    context: FinishReasonCorrectionContext
  ): FinishReasonCorrectionResult {
    const startTime = Date.now();
    
    try {
      // 检测响应中是否真的包含工具调用
      const toolCallDetection = this.detectToolCallsInResponse(responseData, context);
      
      // 确定正确的finish_reason
      const correctedReason = this.determineCorrectedReason(
        originalReason,
        toolCallDetection,
        context
      );
      
      const wasCorreted = originalReason !== correctedReason;
      
      const result: FinishReasonCorrectionResult = {
        originalReason,
        correctedReason,
        wasCorreted,
        confidence: toolCallDetection.confidence,
        detectionMethod: toolCallDetection.method
      };

      if (wasCorreted) {
        this.logger.warn('Finish reason corrected due to tool call detection', {
          originalReason,
          correctedReason,
          provider: context.provider,
          model: context.model,
          hasToolsInRequest: context.hasToolsInRequest,
          detectionMethod: toolCallDetection.method,
          confidence: toolCallDetection.confidence,
          duration: Date.now() - startTime
        }, context.requestId, 'finish-reason-correction');
      } else {
        this.logger.debug('Finish reason validation passed', {
          finishReason: originalReason,
          hasToolCalls: toolCallDetection.hasToolCalls,
          confidence: toolCallDetection.confidence
        }, context.requestId, 'finish-reason-validation');
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to correct finish_reason', {
        error: error instanceof Error ? error.message : String(error),
        originalReason,
        provider: context.provider
      }, context.requestId, 'finish-reason-correction');

      // 错误时返回原始值
      return {
        originalReason,
        correctedReason: originalReason,
        wasCorreted: false,
        confidence: 0,
        detectionMethod: 'error_fallback'
      };
    }
  }

  /**
   * 检测响应中的工具调用
   */
  private detectToolCallsInResponse(responseData: any, context: FinishReasonCorrectionContext): {
    hasToolCalls: boolean;
    confidence: number;
    method: string;
    toolCallsCount: number;
  } {
    let hasToolCalls = false;
    let confidence = 0;
    let method = 'none';
    let toolCallsCount = 0;

    if (!responseData) {
      return { hasToolCalls, confidence, method, toolCallsCount };
    }

    // 方法1: 检查OpenAI格式的tool_calls字段
    if (responseData.choices?.[0]?.message?.tool_calls?.length > 0) {
      hasToolCalls = true;
      confidence = 1.0;
      method = 'openai_tool_calls_field';
      toolCallsCount = responseData.choices[0].message.tool_calls.length;
      return { hasToolCalls, confidence, method, toolCallsCount };
    }

    // 方法2: 检查流式响应中的tool_calls
    if (responseData.choices?.[0]?.delta?.tool_calls?.length > 0) {
      hasToolCalls = true;
      confidence = 1.0;
      method = 'openai_delta_tool_calls';
      toolCallsCount = responseData.choices[0].delta.tool_calls.length;
      return { hasToolCalls, confidence, method, toolCallsCount };
    }

    // 方法3: 检查Anthropic格式的content数组
    if (responseData.content && Array.isArray(responseData.content)) {
      const toolUseBlocks = responseData.content.filter((block: any) => block.type === 'tool_use');
      if (toolUseBlocks.length > 0) {
        hasToolCalls = true;
        confidence = 1.0;
        method = 'anthropic_tool_use_blocks';
        toolCallsCount = toolUseBlocks.length;
        return { hasToolCalls, confidence, method, toolCallsCount };
      }
    }

    // 方法4: 检查文本内容中的工具调用模式
    const textContent = this.extractTextContent(responseData);
    if (textContent) {
      const textDetection = this.detectToolCallsInText(textContent);
      if (textDetection.hasToolCalls) {
        hasToolCalls = true;
        confidence = textDetection.confidence;
        method = textDetection.method;
        toolCallsCount = textDetection.count;
        return { hasToolCalls, confidence, method, toolCallsCount };
      }
    }

    // 方法5: 基于请求上下文的推断
    if (context.hasToolsInRequest && this.shouldInferToolCall(responseData, context)) {
      hasToolCalls = true;
      confidence = 0.3;
      method = 'context_inference';
      toolCallsCount = 1;
      return { hasToolCalls, confidence, method, toolCallsCount };
    }

    return { hasToolCalls, confidence, method, toolCallsCount };
  }

  /**
   * 从响应中提取文本内容
   */
  private extractTextContent(responseData: any): string {
    let textContent = '';

    // OpenAI格式
    if (responseData.choices?.[0]?.message?.content) {
      textContent = responseData.choices[0].message.content;
    } else if (responseData.choices?.[0]?.delta?.content) {
      textContent = responseData.choices[0].delta.content;
    }
    // Anthropic格式
    else if (responseData.content && Array.isArray(responseData.content)) {
      textContent = responseData.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join(' ');
    }
    // 直接字符串
    else if (typeof responseData === 'string') {
      textContent = responseData;
    }

    return textContent;
  }

  /**
   * 检测文本中的工具调用
   */
  private detectToolCallsInText(text: string): {
    hasToolCalls: boolean;
    confidence: number;
    method: string;
    count: number;
  } {
    if (!text || typeof text !== 'string') {
      return { hasToolCalls: false, confidence: 0, method: 'no_text', count: 0 };
    }

    // 高置信度模式
    const highConfidencePatterns = [
      { pattern: /Tool\s+call:\s*\w+\s*\(/gi, name: 'text_tool_call_format', confidence: 0.95 },
      { pattern: /\{\s*"type"\s*:\s*"tool_use"/gi, name: 'anthropic_json_tool_use', confidence: 0.95 },
      { pattern: /\{\s*"name"\s*:\s*"[^"]+",\s*"input"\s*:\s*\{/gi, name: 'anthropic_name_input', confidence: 0.9 },
      { pattern: /工具调用\s*:\s*[\u4e00-\u9fff\w]+\s*\(/gi, name: 'chinese_tool_call', confidence: 0.9 }
    ];

    for (const patternInfo of highConfidencePatterns) {
      const matches = text.match(patternInfo.pattern);
      if (matches && matches.length > 0) {
        return {
          hasToolCalls: true,
          confidence: patternInfo.confidence,
          method: `text_detection_${patternInfo.name}`,
          count: matches.length
        };
      }
    }

    // 中等置信度模式
    const mediumConfidencePatterns = [
      { pattern: /\w+\s*\(\s*\{[^}]*"[^"]+"\s*:/gi, name: 'function_with_json_args', confidence: 0.7 },
      { pattern: /\{\s*"id"\s*:\s*"call_[^"]+"/gi, name: 'openai_call_id', confidence: 0.8 },
      { pattern: /\{\s*"function"\s*:\s*\{[^}]*"name"\s*:/gi, name: 'openai_function_object', confidence: 0.8 }
    ];

    for (const patternInfo of mediumConfidencePatterns) {
      const matches = text.match(patternInfo.pattern);
      if (matches && matches.length > 0) {
        return {
          hasToolCalls: true,
          confidence: patternInfo.confidence,
          method: `text_detection_${patternInfo.name}`,
          count: matches.length
        };
      }
    }

    // 低置信度模式 - 仅在有工具定义的上下文中使用
    const lowConfidencePatterns = [
      { pattern: /function_call/gi, name: 'function_call_keyword', confidence: 0.5 },
      { pattern: /tool_calls/gi, name: 'tool_calls_keyword', confidence: 0.5 }
    ];

    for (const patternInfo of lowConfidencePatterns) {
      const matches = text.match(patternInfo.pattern);
      if (matches && matches.length > 0) {
        return {
          hasToolCalls: true,
          confidence: patternInfo.confidence,
          method: `text_detection_${patternInfo.name}`,
          count: matches.length
        };
      }
    }

    return { hasToolCalls: false, confidence: 0, method: 'no_patterns_matched', count: 0 };
  }

  /**
   * 基于上下文推断是否应该有工具调用
   */
  private shouldInferToolCall(responseData: any, context: FinishReasonCorrectionContext): boolean {
    // 如果请求中有工具定义，但响应很短或为空，可能是工具调用被错误处理
    const textContent = this.extractTextContent(responseData);
    
    // 响应为空或很短，但请求中有工具
    if (context.hasToolsInRequest && (!textContent || textContent.trim().length < 10)) {
      return true;
    }

    // 响应中包含明显的工具调用意图但没有正确格式化
    if (textContent) {
      const intentPatterns = [
        /I'll\s+(use|call|invoke)\s+the\s+\w+\s+(tool|function)/i,
        /Let\s+me\s+(use|call|invoke)\s+the\s+\w+/i,
        /I\s+need\s+to\s+(use|call|invoke)\s+/i,
        /我将使用\s*[\u4e00-\u9fff]+\s*工具/i,
        /让我调用\s*[\u4e00-\u9fff]+/i
      ];

      return intentPatterns.some(pattern => pattern.test(textContent));
    }

    return false;
  }

  /**
   * 确定修正后的finish_reason
   */
  private determineCorrectedReason(
    originalReason: string,
    toolCallDetection: { hasToolCalls: boolean; confidence: number; method: string },
    context: FinishReasonCorrectionContext
  ): string {
    // 如果没有检测到工具调用，保持原始reason
    if (!toolCallDetection.hasToolCalls) {
      return originalReason;
    }

    // 如果检测到工具调用，根据provider确定正确的finish_reason
    if (toolCallDetection.confidence >= 0.7) {
      // 高置信度检测，强制修正
      if (context.provider === 'openai' || context.provider.includes('openai')) {
        return 'tool_calls';
      } else if (context.provider === 'anthropic' || context.provider.includes('anthropic')) {
        return 'tool_use';
      } else if (context.provider.includes('gemini')) {
        return 'tool_calls'; // Gemini使用OpenAI兼容格式
      }
    } else if (toolCallDetection.confidence >= 0.3) {
      // 中等置信度，仅在原始reason明显错误时修正
      if (originalReason === 'stop' || originalReason === 'end_turn') {
        if (context.provider === 'openai' || context.provider.includes('openai')) {
          return 'tool_calls';
        } else if (context.provider === 'anthropic' || context.provider.includes('anthropic')) {
          return 'tool_use';
        } else if (context.provider.includes('gemini')) {
          return 'tool_calls';
        }
      }
    }

    // 低置信度或未知provider，保持原始reason
    return originalReason;
  }

  /**
   * 批量修正多个响应的finish_reason
   */
  batchCorrectFinishReasons(
    responses: Array<{ reason: string; data: any; context: FinishReasonCorrectionContext }>
  ): Array<FinishReasonCorrectionResult> {
    return responses.map(({ reason, data, context }) => 
      this.correctFinishReason(reason, data, context)
    );
  }

  /**
   * 验证finish_reason是否需要修正
   */
  needsCorrection(
    finishReason: string,
    responseData: any,
    context: FinishReasonCorrectionContext
  ): boolean {
    const detection = this.detectToolCallsInResponse(responseData, context);
    
    // 如果检测到工具调用但finish_reason不正确
    if (detection.hasToolCalls && detection.confidence >= 0.7) {
      const expectedReason = context.provider === 'openai' ? 'tool_calls' : 'tool_use';
      return finishReason !== expectedReason;
    }

    return false;
  }

  /**
   * 获取修正统计信息
   */
  getStats(): {
    supportedProviders: string[];
    detectionMethods: string[];
    confidenceThresholds: { high: number; medium: number; low: number };
  } {
    return {
      supportedProviders: ['openai', 'anthropic', 'gemini'],
      detectionMethods: [
        'openai_tool_calls_field',
        'openai_delta_tool_calls',
        'anthropic_tool_use_blocks',
        'text_detection_*',
        'context_inference'
      ],
      confidenceThresholds: {
        high: 0.7,
        medium: 0.3,
        low: 0.1
      }
    };
  }
}

// 导出单例实例
export const finishReasonCorrector = new FinishReasonCorrector();

// 便捷函数
export function correctFinishReason(
  originalReason: string,
  responseData: any,
  context: FinishReasonCorrectionContext
): FinishReasonCorrectionResult {
  return finishReasonCorrector.correctFinishReason(originalReason, responseData, context);
}

export function needsFinishReasonCorrection(
  finishReason: string,
  responseData: any,
  context: FinishReasonCorrectionContext
): boolean {
  return finishReasonCorrector.needsCorrection(finishReason, responseData, context);
}