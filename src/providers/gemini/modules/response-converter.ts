/**
 * Gemini Response Converter Module
 * 响应格式转换器，负责Gemini到Anthropic的响应转换
 * Project owner: Jason Zhang
 */

import { BaseResponse, GeminiApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { transformGeminiToAnthropic } from '@/transformers/gemini';

/**
 * Gemini响应转换器类
 */
export class GeminiResponseConverter {
  private requestId: string;

  constructor(requestId: string = 'unknown') {
    this.requestId = requestId;
  }

  /**
   * 转换Gemini响应为Anthropic格式
   */
  convertResponse(response: GeminiApiResponse, originalModel: string): BaseResponse {
    try {
      logger.debug('Converting Gemini response to Anthropic format', {
        requestId: this.requestId,
        originalModel,
        candidateCount: response.candidates?.length,
        hasUsage: !!response.usageMetadata
      });

      // 使用统一的转换器
      const anthropicResponse = transformGeminiToAnthropic(response, originalModel, this.requestId);

      logger.debug('Successfully converted to Anthropic format', {
        requestId: this.requestId,
        stopReason: anthropicResponse.stop_reason,
        contentBlockCount: anthropicResponse.content?.length,
        hasToolUse: Array.isArray(anthropicResponse.content) && 
                   anthropicResponse.content.some(block => block.type === 'tool_use'),
        hasUsage: !!anthropicResponse.usage
      });

      return anthropicResponse;

    } catch (error) {
      logger.error('Failed to convert Gemini response to Anthropic format', {
        requestId: this.requestId,
        error: (error as Error).message,
        originalModel,
        candidateCount: response.candidates?.length
      });
      throw error;
    }
  }

  /**
   * 验证转换后的响应格式
   */
  validateConvertedResponse(response: BaseResponse): boolean {
    try {
      const isValid = (
        response &&
        typeof response.id === 'string' &&
        response.type === 'message' &&
        response.role === 'assistant' &&
        Array.isArray(response.content) &&
        typeof response.stop_reason === 'string' &&
        typeof response.model === 'string'
      );

      if (!isValid) {
        logger.warn('Converted Anthropic response validation failed', {
          requestId: this.requestId,
          hasId: !!response?.id,
          hasType: response?.type === 'message',
          hasRole: response?.role === 'assistant',
          hasContent: Array.isArray(response?.content),
          hasStopReason: !!response?.stop_reason,
          hasModel: !!response?.model
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating converted response', {
        requestId: this.requestId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 创建包含调试信息的转换结果
   */
  createConversionResult(anthropicResponse: BaseResponse): {
    response: BaseResponse;
    debug: {
      requestId: string;
      timestamp: number;
      stopReason: string;
      hasToolUse: boolean;
      contentBlocks: number;
      hasUsage: boolean;
    };
  } {
    const content = Array.isArray(anthropicResponse.content) ? anthropicResponse.content : [];
    
    return {
      response: anthropicResponse,
      debug: {
        requestId: this.requestId,
        timestamp: Date.now(),
        stopReason: anthropicResponse.stop_reason || 'unknown',
        hasToolUse: content.some(block => block.type === 'tool_use'),
        contentBlocks: content.length,
        hasUsage: !!anthropicResponse.usage
      }
    };
  }
}

/**
 * 便捷函数：转换响应并返回验证结果
 */
export function convertGeminiToAnthropicResponse(
  response: GeminiApiResponse,
  originalModel: string,
  requestId: string = 'unknown'
): BaseResponse {
  const converter = new GeminiResponseConverter(requestId);
  const anthropicResponse = converter.convertResponse(response, originalModel);
  
  if (!converter.validateConvertedResponse(anthropicResponse)) {
    throw new Error('Converted Anthropic response failed validation');
  }
  
  return anthropicResponse;
}