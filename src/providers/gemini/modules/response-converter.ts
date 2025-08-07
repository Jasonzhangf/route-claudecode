/**
 * Gemini响应格式转换器
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 将Gemini API响应转换为统一格式
 * - 处理工具调用响应
 * - 严格验证响应格式
 * - 检测并报告异常响应
 */

import { BaseResponse, AnthropicResponse } from '../../../types';
import { logger } from '../../../utils/logger';

export interface GeminiApiRequest {
  model: string;
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{
      text?: string;
      functionCall?: {
        name: string;
        args: any;
      };
      functionResponse?: {
        name: string;
        response: any;
      };
    }>;
  }>;
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: any;
    }>;
  }>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
  functionCallingConfig?: {
    mode: 'AUTO' | 'ANY' | 'NONE';
  };
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: any;
        };
      }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiResponseConverter {
  /**
   * 将Gemini API响应转换为Anthropic格式
   */
  static convertToAnthropicFormat(
    geminiResponse: GeminiApiResponse,
    originalModel: string,
    requestId: string
  ): AnthropicResponse {
    if (!geminiResponse) {
      throw new Error('GeminiResponseConverter: geminiResponse is required');
    }

    // 检测流式响应（这应该是错误）
    if (this.isStreamingResponse(geminiResponse)) {
      throw new Error('GeminiResponseConverter: Streaming response detected - this is not allowed. All responses must be non-streaming.');
    }

    logger.debug('Converting Gemini response to Anthropic format', {
      candidateCount: geminiResponse.candidates?.length || 0,
      hasUsage: !!geminiResponse.usageMetadata
    }, requestId, 'gemini-response-converter');

    const candidates = geminiResponse.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('GeminiResponseConverter: No candidates in Gemini response');
    }

    const firstCandidate = candidates[0];
    if (!firstCandidate) {
      throw new Error('GeminiResponseConverter: First candidate is null or undefined');
    }

    // 转换内容
    const content = this.convertContent(firstCandidate, requestId);
    
    // 🔧 Critical Fix: Use content-driven stop_reason determination (OpenAI success pattern)
    // Check if there are any tool_use blocks in the converted content
    const hasToolCalls = content.some(block => block.type === 'tool_use');
    
    let stopReason: string;
    if (hasToolCalls) {
      // Force tool_use if we have tool calls in content
      stopReason = 'tool_use';
      logger.debug('Stop reason determined by content analysis: tool_use', {
        contentBlocks: content.length,
        toolCallCount: content.filter(b => b.type === 'tool_use').length
      }, requestId, 'gemini-response-converter');
    } else {
      // Use finish reason mapping only for non-tool scenarios
      stopReason = this.convertFinishReason(firstCandidate.finishReason, requestId) || 'end_turn';
      logger.debug('Stop reason determined by finish reason mapping', {
        originalFinishReason: firstCandidate.finishReason,
        mappedStopReason: stopReason
      }, requestId, 'gemini-response-converter');
    }

    // 处理使用统计
    const usage = this.convertUsage(geminiResponse.usageMetadata);

    const anthropicResponse: AnthropicResponse = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
      type: 'message',
      role: 'assistant',
      model: originalModel,
      content: content,
      stop_sequence: undefined,
      usage: usage
    };

    // Always set stop_reason (guaranteed to be valid from content-driven logic above)
    anthropicResponse.stop_reason = stopReason;

    logger.debug('Converted Gemini response successfully', {
      contentBlocks: content.length,
      stopReason: stopReason || 'undefined',
      usage: usage
    }, requestId, 'gemini-response-converter');

    return anthropicResponse;
  }

  /**
   * 检测是否为流式响应
   */
  private static isStreamingResponse(response: any): boolean {
    // 检测常见的流式响应标识
    if (response && typeof response === 'object') {
      // 检查是否有流式响应的特征
      if (response.stream === true || 
          response.streaming === true ||
          typeof response.read === 'function' ||
          typeof response.pipe === 'function' ||
          response.constructor?.name === 'ReadableStream') {
        return true;
      }
    }

    return false;
  }

  /**
   * 转换候选响应的内容
   */
  private static convertContent(candidate: any, requestId: string): any[] {
    const content: any[] = [];

    if (!candidate.content?.parts || !Array.isArray(candidate.content.parts)) {
      throw new Error('GeminiResponseConverter: No content parts in candidate response - this indicates an API error');
    }

    for (const part of candidate.content.parts) {
      if (part.text !== undefined) {
        // 文本内容
        content.push({
          type: 'text',
          text: part.text || ''
        });
      } else if (part.functionCall) {
        // 工具调用
        const toolCall = this.convertFunctionCallToToolUse(part.functionCall, requestId);
        if (toolCall) {
          content.push(toolCall);
        }
      } else {
        logger.warn('Unknown part type in Gemini response', { part }, requestId, 'gemini-response-converter');
      }
    }

    // 严格要求必须有内容，不允许空响应
    if (content.length === 0) {
      throw new Error('GeminiResponseConverter: No content generated by API - this should never happen');
    }

    return content;
  }

  /**
   * 转换函数调用为工具使用格式
   */
  private static convertFunctionCallToToolUse(functionCall: any, requestId: string): any | null {
    if (!functionCall?.name) {
      logger.warn('Invalid function call: missing name', { functionCall }, requestId, 'gemini-response-converter');
      return null;
    }

    logger.debug('Converting Gemini functionCall to tool_use', {
      functionName: functionCall.name,
      hasArgs: !!functionCall.args
    }, requestId, 'gemini-response-converter');

    return {
      type: 'tool_use',
      id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      name: functionCall.name,
      input: functionCall.args || {}
    };
  }

  /**
   * 转换finish reason
   */
  private static convertFinishReason(finishReason?: string, requestId?: string): string | undefined {
    if (!finishReason) {
      logger.debug('No finish reason provided', {}, requestId, 'gemini-response-converter');
      return undefined;
    }

    // Gemini finish reason映射
    const reasonMapping: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn'
    };

    const mappedReason = reasonMapping[finishReason];
    if (!mappedReason) {
      const error = new Error(`Unknown Gemini finish reason '${finishReason}'. Supported reasons: ${Object.keys(reasonMapping).join(', ')}`);
      logger.error('Unknown Gemini finish reason - no fallback allowed', { 
        finishReason,
        supportedReasons: Object.keys(reasonMapping),
        error: error.message
      }, requestId, 'gemini-response-converter');
      
      // Zero fallback principle: throw error instead of returning fallback
      throw error;
    }

    logger.debug('Converted finish reason', {
      original: finishReason,
      mapped: mappedReason
    }, requestId, 'gemini-response-converter');

    return mappedReason;
  }

  /**
   * 转换使用统计
   */
  private static convertUsage(usageMetadata: any): { input_tokens: number; output_tokens: number } {
    const usage = {
      input_tokens: 0,
      output_tokens: 0
    };

    if (usageMetadata) {
      usage.input_tokens = usageMetadata.promptTokenCount || 0;
      usage.output_tokens = usageMetadata.candidatesTokenCount || 0;
    }

    return usage;
  }

  /**
   * 验证响应完整性
   */
  static validateResponse(response: GeminiApiResponse, requestId: string): void {
    if (!response) {
      throw new Error('GeminiResponseConverter: Response is null or undefined');
    }

    if (!response.candidates) {
      throw new Error('GeminiResponseConverter: Response missing candidates array');
    }

    if (response.candidates.length === 0) {
      throw new Error('GeminiResponseConverter: Response candidates array is empty');
    }

    const firstCandidate = response.candidates[0];
    if (!firstCandidate) {
      throw new Error('GeminiResponseConverter: First candidate is null');
    }

    // 检查是否有内容或工具调用
    const hasContent = firstCandidate.content?.parts && firstCandidate.content.parts.length > 0;
    if (!hasContent) {
      logger.warn('Gemini response candidate has no content parts', {
        candidate: firstCandidate
      }, requestId, 'gemini-response-converter');
    }

    logger.debug('Gemini response validation passed', {
      candidateCount: response.candidates.length,
      hasUsage: !!response.usageMetadata,
      hasContent
    }, requestId, 'gemini-response-converter');
  }
}