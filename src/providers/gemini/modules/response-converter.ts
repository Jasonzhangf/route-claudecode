/**
 * Gemini Response Converter Module
 * 响应格式转换器，负责Gemini到Anthropic的响应转换
 * Project owner: Jason Zhang
 */

import { BaseResponse } from '@/types';
import { GeminiApiResponse, GeminiTransformer } from '@/transformers/gemini';
import { logger } from '@/utils/logger';

/**
 * Gemini响应转换器
 * 职责：GeminiApiResponse -> BaseResponse转换
 * 🔧 Critical Fix: Use content-driven stop_reason determination (OpenAI success pattern)
 */
export class GeminiResponseConverter {
  private static transformer = new GeminiTransformer();

  /**
   * 转换Gemini响应为Anthropic格式
   * 🔧 Critical Fix: Content-driven stop_reason determination
   */
  static convertToAnthropicFormat(
    response: GeminiApiResponse, 
    originalModel: string, 
    requestId: string = 'unknown'
  ): BaseResponse {
    if (!response) {
      throw new Error('GeminiResponseConverter: response is required');
    }

    if (!originalModel) {
      throw new Error('GeminiResponseConverter: originalModel is required');
    }

    logger.debug('Converting Gemini response to Anthropic format', {
      candidatesCount: response.candidates?.length || 0,
      hasUsageMetadata: !!response.usageMetadata,
      originalModel
    }, requestId, 'gemini-response-converter');

    try {
      // 验证响应基本结构
      this.validateGeminiResponse(response, requestId);
      
      const firstCandidate = response.candidates[0];
      
      // 使用transformer转换内容
      const content = this.transformer['convertGeminiPartsToAnthropic'](
        firstCandidate.content.parts, 
        requestId
      );

      // 🔧 Critical Fix: Use content-driven stop_reason determination
      const hasToolCalls = content.some(block => block.type === 'tool_use');

      let stopReason: string;
      if (hasToolCalls) {
        // Force tool_use if we have tool calls in content
        stopReason = 'tool_use';
        logger.debug('Content-driven stop_reason: detected tool calls', {
          toolCallCount: content.filter(block => block.type === 'tool_use').length,
          stopReason
        }, requestId, 'gemini-response-converter');
      } else {
        // Use finish reason mapping only for non-tool scenarios  
        stopReason = this.transformer['mapGeminiFinishReason'](
          firstCandidate.finishReason
        ) || 'end_turn';
        logger.debug('Finish reason mapping applied', {
          geminiFinishReason: firstCandidate.finishReason,
          stopReason
        }, requestId, 'gemini-response-converter');
      }

      // 转换使用统计
      const usage = response.usageMetadata ? {
        input_tokens: response.usageMetadata.promptTokenCount || 0,
        output_tokens: response.usageMetadata.candidatesTokenCount || 0
      } : { input_tokens: 0, output_tokens: 0 };

      const anthropicResponse: BaseResponse = {
        id: `msg_${Date.now()}`,
        content,
        model: originalModel,
        role: 'assistant',
        stop_reason: stopReason,
        stop_sequence: null,
        usage
      };

      // 验证转换结果
      this.validateAnthropicResponse(anthropicResponse, requestId);

      logger.debug('Gemini to Anthropic conversion completed', {
        contentBlocks: content.length,
        stopReason,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        hasToolCalls
      }, requestId, 'gemini-response-converter');

      return anthropicResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to convert Gemini response to Anthropic format', {
        error: errorMessage,
        candidatesCount: response.candidates?.length || 0,
        originalModel
      }, requestId, 'gemini-response-converter');
      
      throw error;
    }
  }

  /**
   * 验证Gemini响应格式
   * 🔧 Critical: Strict validation, no fallback
   */
  private static validateGeminiResponse(response: GeminiApiResponse, requestId: string): void {
    if (!response.candidates || !Array.isArray(response.candidates)) {
      throw new Error('GeminiResponseConverter: response must have candidates array');
    }

    if (response.candidates.length === 0) {
      throw new Error('GeminiResponseConverter: response must have at least one candidate');
    }

    const firstCandidate = response.candidates[0];
    
    if (!firstCandidate.content) {
      throw new Error('GeminiResponseConverter: candidate must have content');
    }

    if (!firstCandidate.content.parts || !Array.isArray(firstCandidate.content.parts)) {
      throw new Error('GeminiResponseConverter: candidate content must have parts array');
    }

    if (firstCandidate.content.parts.length === 0) {
      throw new Error('GeminiResponseConverter: candidate content parts cannot be empty');
    }

    if (!firstCandidate.finishReason) {
      throw new Error('GeminiResponseConverter: candidate must have finishReason');
    }

    logger.debug('Gemini response validation passed', {
      candidatesCount: response.candidates.length,
      partsCount: firstCandidate.content.parts.length,
      finishReason: firstCandidate.finishReason
    }, requestId, 'gemini-response-converter');
  }

  /**
   * 验证Anthropic响应格式
   * 🔧 Critical: Strict validation, no fallback  
   */
  private static validateAnthropicResponse(response: BaseResponse, requestId: string): void {
    if (!response.id) {
      throw new Error('GeminiResponseConverter: converted response must have id');
    }

    if (!response.content || !Array.isArray(response.content)) {
      throw new Error('GeminiResponseConverter: converted response must have content array');
    }

    if (response.content.length === 0) {
      throw new Error('GeminiResponseConverter: converted response content cannot be empty');
    }

    if (!response.model) {
      throw new Error('GeminiResponseConverter: converted response must have model');
    }

    if (!response.stop_reason) {
      throw new Error('GeminiResponseConverter: converted response must have stop_reason');
    }

    if (!response.usage) {
      throw new Error('GeminiResponseConverter: converted response must have usage');
    }

    logger.debug('Anthropic response validation passed', {
      id: response.id,
      contentBlocks: response.content.length,
      model: response.model,
      stopReason: response.stop_reason
    }, requestId, 'gemini-response-converter');
  }
}