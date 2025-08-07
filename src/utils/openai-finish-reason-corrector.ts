/**
 * OpenAI专用Finish Reason修正器
 * 专门处理OpenAI工具调用的finish_reason映射问题
 */

import { getLogger } from '../logging';

export interface OpenAIFinishReasonCorrectionResult {
  originalReason: string;
  correctedReason: string;
  wasCorreted: boolean;
  hasToolCalls: boolean;
  toolCallsCount: number;
}

export class OpenAIFinishReasonCorrector {
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.logger = getLogger(port);
  }

  /**
   * 修正OpenAI响应的finish_reason
   */
  correctOpenAIFinishReason(
    response: any,
    requestId: string
  ): OpenAIFinishReasonCorrectionResult {
    const choice = response.choices?.[0];
    if (!choice) {
      return {
        originalReason: 'unknown',
        correctedReason: 'unknown',
        wasCorreted: false,
        hasToolCalls: false,
        toolCallsCount: 0
      };
    }

    const originalReason = choice.finish_reason;
    const hasToolCalls = this.detectToolCallsInChoice(choice);
    const toolCallsCount = this.countToolCalls(choice);

    let correctedReason = originalReason;
    let wasCorreted = false;

    // 核心修正逻辑：如果有工具调用但finish_reason不是tool_calls，进行修正
    if (hasToolCalls && originalReason !== 'tool_calls') {
      correctedReason = 'tool_calls';
      wasCorreted = true;
      
      // 应用修正
      choice.finish_reason = correctedReason;

      this.logger.warn('OpenAI finish_reason corrected for tool calls', {
        originalReason,
        correctedReason,
        hasToolCalls,
        toolCallsCount,
        requestId
      }, requestId, 'openai-finish-reason-correction');
    }

    return {
      originalReason,
      correctedReason,
      wasCorreted,
      hasToolCalls,
      toolCallsCount
    };
  }

  /**
   * 修正流式响应的finish_reason
   */
  correctStreamingFinishReason(
    chunk: any,
    hasToolCallsInStream: boolean,
    requestId: string
  ): OpenAIFinishReasonCorrectionResult {
    const choice = chunk.choices?.[0];
    if (!choice || !choice.finish_reason) {
      return {
        originalReason: 'none',
        correctedReason: 'none',
        wasCorreted: false,
        hasToolCalls: hasToolCallsInStream,
        toolCallsCount: 0
      };
    }

    const originalReason = choice.finish_reason;
    const hasToolCallsInChunk = choice.delta?.tool_calls?.length > 0;
    const hasToolCalls = hasToolCallsInStream || hasToolCallsInChunk;

    let correctedReason = originalReason;
    let wasCorreted = false;

    // 流式修正逻辑
    if (hasToolCalls && originalReason === 'stop') {
      correctedReason = 'tool_calls';
      wasCorreted = true;
      
      // 应用修正
      choice.finish_reason = correctedReason;

      this.logger.debug('OpenAI streaming finish_reason corrected', {
        originalReason,
        correctedReason,
        hasToolCallsInStream,
        hasToolCallsInChunk,
        requestId
      }, requestId, 'openai-streaming-finish-reason-correction');
    }

    return {
      originalReason,
      correctedReason,
      wasCorreted,
      hasToolCalls,
      toolCallsCount: hasToolCallsInChunk ? choice.delta.tool_calls.length : 0
    };
  }

  /**
   * 检测choice中是否包含工具调用
   */
  private detectToolCallsInChoice(choice: any): boolean {
    // 检查message.tool_calls
    if (choice.message?.tool_calls?.length > 0) {
      return true;
    }

    // 检查delta.tool_calls（流式响应）
    if (choice.delta?.tool_calls?.length > 0) {
      return true;
    }

    // 检查文本内容中的工具调用模式
    const content = choice.message?.content || choice.delta?.content;
    if (content && typeof content === 'string') {
      return this.detectToolCallsInText(content);
    }

    return false;
  }

  /**
   * 检测文本中的工具调用模式
   */
  private detectToolCallsInText(text: string): boolean {
    const toolCallPatterns = [
      /Tool\s+call:\s*\w+\s*\(/i,
      /\{\s*"type"\s*:\s*"tool_use"/i,
      /\{\s*"name"\s*:\s*"[^"]+",\s*"input"\s*:/i,
      /function_call/i,
      /\{\s*"id"\s*:\s*"call_[^"]+"/i
    ];

    return toolCallPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 计算工具调用数量
   */
  private countToolCalls(choice: any): number {
    let count = 0;

    if (choice.message?.tool_calls?.length > 0) {
      count += choice.message.tool_calls.length;
    }

    if (choice.delta?.tool_calls?.length > 0) {
      count += choice.delta.tool_calls.length;
    }

    return count;
  }

  /**
   * 批量修正多个响应
   */
  batchCorrectFinishReasons(
    responses: any[],
    requestId: string
  ): OpenAIFinishReasonCorrectionResult[] {
    return responses.map(response => 
      this.correctOpenAIFinishReason(response, requestId)
    );
  }
}

// 导出单例
export const openaiFinishReasonCorrector = new OpenAIFinishReasonCorrector();

// 便捷函数
export function correctOpenAIFinishReason(
  response: any,
  requestId: string
): OpenAIFinishReasonCorrectionResult {
  return openaiFinishReasonCorrector.correctOpenAIFinishReason(response, requestId);
}

export function correctOpenAIStreamingFinishReason(
  chunk: any,
  hasToolCallsInStream: boolean,
  requestId: string
): OpenAIFinishReasonCorrectionResult {
  return openaiFinishReasonCorrector.correctStreamingFinishReason(chunk, hasToolCallsInStream, requestId);
}