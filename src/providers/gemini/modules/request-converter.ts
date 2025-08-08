/**
 * Gemini Request Converter Module
 * 请求格式转换器，负责Anthropic到Gemini的请求转换
 * Project owner: Jason Zhang
 */

import { BaseRequest } from '@/types';
import { GeminiApiRequest, GeminiTransformer } from '@/transformers/gemini';
import { logger } from '@/utils/logger';

/**
 * Gemini请求转换器
 * 职责：BaseRequest -> GeminiApiRequest转换
 */
export class GeminiRequestConverter {
  private static transformer = new GeminiTransformer();

  /**
   * 转换BaseRequest为Gemini格式
   * 🔧 Critical Fix: Add toolConfig to enable tool calling
   */
  static convertToGeminiFormat(request: BaseRequest): GeminiApiRequest {
    const requestId = request.metadata?.requestId || 'unknown';
    
    if (!request) {
      throw new Error('GeminiRequestConverter: request is required');
    }

    logger.debug('Converting request to Gemini format', {
      model: request.model,
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools,
      toolCount: request.tools?.length || 0
    }, requestId, 'gemini-request-converter');

    try {
      // 使用transformer进行基础转换
      const geminiRequest = this.transformer.transformAnthropicToGemini(request);
      
      // 🔧 Critical Fix: Ensure tool configuration is properly set
      if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
        // 确保工具配置正确设置
        geminiRequest.tools = this.transformer['convertAnthropicToolsToGemini'](request.tools, requestId);
        geminiRequest.functionCallingConfig = {
          mode: 'AUTO'  // 让Gemini自动决定何时调用工具
        };

        logger.debug('Tool configuration applied to Gemini request', {
          toolCount: request.tools.length,
          functionCallingMode: geminiRequest.functionCallingConfig.mode,
          toolNames: request.tools.map(t => t.function?.name || t.name).filter(Boolean)
        }, requestId, 'gemini-request-converter');
      }

      // 验证转换结果
      this.validateGeminiRequest(geminiRequest, requestId);

      logger.debug('Request conversion to Gemini format completed', {
        model: geminiRequest.model,
        contentCount: geminiRequest.contents?.length || 0,
        hasTools: !!geminiRequest.tools,
        hasGenerationConfig: !!geminiRequest.generationConfig
      }, requestId, 'gemini-request-converter');

      return geminiRequest;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to convert request to Gemini format', {
        error: errorMessage,
        model: request.model,
        messageCount: request.messages?.length || 0
      }, requestId, 'gemini-request-converter');
      
      throw error;
    }
  }

  /**
   * 验证Gemini请求格式
   * 🔧 Critical: Strict validation, no fallback
   */
  private static validateGeminiRequest(request: GeminiApiRequest, requestId: string): void {
    if (!request.model) {
      throw new Error('GeminiRequestConverter: model is required in converted request');
    }

    if (!request.contents || !Array.isArray(request.contents) || request.contents.length === 0) {
      throw new Error('GeminiRequestConverter: contents must be a non-empty array');
    }

    // 验证每个content的格式
    for (let i = 0; i < request.contents.length; i++) {
      const content = request.contents[i];
      
      if (!content.role || !['user', 'model'].includes(content.role)) {
        throw new Error(`GeminiRequestConverter: Invalid role '${content.role}' at content index ${i}`);
      }

      if (!content.parts || !Array.isArray(content.parts) || content.parts.length === 0) {
        throw new Error(`GeminiRequestConverter: Invalid parts at content index ${i}`);
      }
    }

    // 验证工具配置
    if (request.tools) {
      if (!Array.isArray(request.tools)) {
        throw new Error('GeminiRequestConverter: tools must be an array');
      }

      for (let i = 0; i < request.tools.length; i++) {
        const tool = request.tools[i];
        if (!tool.functionDeclarations || !Array.isArray(tool.functionDeclarations)) {
          throw new Error(`GeminiRequestConverter: Invalid tool structure at index ${i}`);
        }
      }
    }

    logger.debug('Gemini request validation passed', {
      model: request.model,
      contentCount: request.contents.length,
      toolCount: request.tools?.length || 0
    }, requestId, 'gemini-request-converter');
  }
}