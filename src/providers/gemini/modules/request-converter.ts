/**
 * Gemini Request Converter Module
 * 请求格式转换器，负责Anthropic到Gemini的请求转换
 * Project owner: Jason Zhang
 */

import { BaseRequest, GeminiApiRequest } from '@/types';
import { logger } from '@/utils/logger';
import { transformAnthropicToGemini } from '@/transformers/gemini';

/**
 * Gemini请求转换器类
 */
export class GeminiRequestConverter {
  private requestId: string;

  constructor(requestId: string = 'unknown') {
    this.requestId = requestId;
  }

  /**
   * 转换Anthropic请求为Gemini API格式
   */
  convertRequest(request: BaseRequest, model: string): GeminiApiRequest {
    try {
      logger.debug('Converting Anthropic request to Gemini format', {
        requestId: this.requestId,
        model,
        messageCount: request.messages?.length,
        hasTools: !!request.tools?.length,
        hasSystem: !!request.metadata?.system
      });

      // 使用统一的转换器
      const { geminiRequest } = transformAnthropicToGemini(request);
      
      // 添加模型信息到转换结果
      const requestWithModel: GeminiApiRequest = {
        model,
        ...geminiRequest
      };

      logger.debug('Successfully converted to Gemini format', {
        requestId: this.requestId,
        model: requestWithModel.model,
        hasContents: !!requestWithModel.contents?.length,
        hasTools: !!requestWithModel.tools?.length,
        hasToolConfig: !!requestWithModel.toolConfig,
        generationConfig: requestWithModel.generationConfig
      });

      return requestWithModel;

    } catch (error) {
      logger.error('Failed to convert request to Gemini format', {
        requestId: this.requestId,
        error: (error as Error).message,
        model,
        originalModel: request.model
      });
      throw error;
    }
  }

  /**
   * 验证转换后的请求格式
   */
  validateConvertedRequest(request: GeminiApiRequest): boolean {
    try {
      const isValid = (
        request &&
        typeof request.model === 'string' &&
        Array.isArray(request.contents) &&
        request.contents.length > 0 &&
        request.contents.every(content => 
          content && 
          ['user', 'model'].includes(content.role) &&
          Array.isArray(content.parts) &&
          content.parts.length > 0
        )
      );

      if (!isValid) {
        logger.warn('Converted Gemini request validation failed', {
          requestId: this.requestId,
          hasModel: !!request?.model,
          hasContents: !!request?.contents,
          contentsLength: request?.contents?.length
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating converted request', {
        requestId: this.requestId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 创建包含调试信息的转换结果
   */
  createConversionResult(geminiRequest: GeminiApiRequest): {
    request: GeminiApiRequest;
    debug: {
      requestId: string;
      timestamp: number;
      hasTools: boolean;
      hasSystem: boolean;
      contentCount: number;
    };
  } {
    return {
      request: geminiRequest,
      debug: {
        requestId: this.requestId,
        timestamp: Date.now(),
        hasTools: !!geminiRequest.tools?.length,
        hasSystem: geminiRequest.contents?.some(c => 
          c.parts?.some(p => p.text?.startsWith('System:'))
        ) || false,
        contentCount: geminiRequest.contents?.length || 0
      }
    };
  }
}

/**
 * 便捷函数：转换请求并返回验证结果
 */
export function convertAnthropicToGeminiRequest(
  request: BaseRequest, 
  model: string, 
  requestId: string = 'unknown'
): GeminiApiRequest {
  const converter = new GeminiRequestConverter(requestId);
  const geminiRequest = converter.convertRequest(request, model);
  
  if (!converter.validateConvertedRequest(geminiRequest)) {
    throw new Error('Converted Gemini request failed validation');
  }
  
  return geminiRequest;
}