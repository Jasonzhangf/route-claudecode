/**
 * Gemini Transformer
 * 统一的Gemini格式转换器，遵循transformer架构模式
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse } from '../types';
import { logger } from '../utils/logger';
import { MessageTransformer, UnifiedRequest, UnifiedResponse, StreamChunk } from './types';

// Gemini API请求格式接口
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

// Gemini API响应格式接口
export interface GeminiApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: any;
        };
      }>;
    };
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Gemini消息转换器
 * 实现统一的Gemini ↔ Anthropic格式转换
 */
export class GeminiTransformer implements MessageTransformer {
  public readonly name = 'gemini';

  /**
   * 将Anthropic格式转换为Gemini格式
   */
  transformAnthropicToGemini(request: BaseRequest): GeminiApiRequest {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Converting Anthropic request to Gemini format', {
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    }, requestId, 'gemini-transformer');

    if (!request.messages || !Array.isArray(request.messages)) {
      throw new Error('GeminiTransformer: request.messages must be a non-empty array');
    }

    const geminiRequest: GeminiApiRequest = {
      model: this.extractModelName(request.model),
      contents: this.convertAnthropicMessagesToGemini(request.messages, requestId),
    };

    // 添加生成配置
    if (request.max_tokens || request.temperature !== undefined) {
      geminiRequest.generationConfig = {};
      
      if (request.max_tokens) {
        geminiRequest.generationConfig.maxOutputTokens = request.max_tokens;
      }
      
      if (request.temperature !== undefined) {
        geminiRequest.generationConfig.temperature = request.temperature;
      }
    }

    // 处理工具调用
    if (request.tools && request.tools.length > 0) {
      geminiRequest.tools = this.convertAnthropicToolsToGemini(request.tools, requestId);
      geminiRequest.functionCallingConfig = { mode: 'AUTO' };
      
      logger.debug('Added tools to Gemini request', {
        toolCount: request.tools.length,
        toolNames: request.tools.map(t => t.function?.name).filter(Boolean)
      }, requestId, 'gemini-transformer');
    }

    return geminiRequest;
  }

  /**
   * 将Gemini响应转换为Anthropic格式
   */
  transformGeminiToAnthropic(
    geminiResponse: GeminiApiResponse, 
    originalModel: string, 
    requestId: string = 'unknown'
  ): BaseResponse {
    logger.debug('Converting Gemini response to Anthropic format', {
      candidatesCount: geminiResponse.candidates?.length || 0,
      hasUsageMetadata: !!geminiResponse.usageMetadata
    }, requestId, 'gemini-transformer');

    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('GeminiTransformer: Gemini response has no candidates');
    }

    const candidate = geminiResponse.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('GeminiTransformer: Gemini candidate has no content parts');
    }

    // 转换内容块
    const content = this.convertGeminiPartsToAnthropic(candidate.content.parts, requestId);
    
    // 转换停止原因
    const stopReason = this.mapGeminiFinishReason(candidate.finishReason);
    
    // 转换使用统计
    const usage = geminiResponse.usageMetadata ? {
      input_tokens: geminiResponse.usageMetadata.promptTokenCount || 0,
      output_tokens: geminiResponse.usageMetadata.candidatesTokenCount || 0
    } : { input_tokens: 0, output_tokens: 0 };

    const response: BaseResponse = {
      id: `msg_${Date.now()}`,
      content,
      model: originalModel,
      role: 'assistant',
      stop_reason: stopReason,
      stop_sequence: null,
      usage
    };

    logger.debug('Converted Gemini response to Anthropic format', {
      contentBlocks: content.length,
      stopReason,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens
    }, requestId, 'gemini-transformer');

    return response;
  }

  /**
   * 提取模型名称
   */
  private extractModelName(model: string): string {
    if (!model) {
      throw new Error('GeminiTransformer: model is required');
    }

    const allowedPatterns = [
      /^gemini-1\./,
      /^gemini-2\./,
      /^gemini-pro/,
      /^gemini-ultra/,
      /^gemini-nano/,
      /^gemini-flash/
    ];
    
    const isValidModel = allowedPatterns.some(pattern => pattern.test(model));
    if (!isValidModel) {
      throw new Error(`GeminiTransformer: Unsupported model '${model}'. Expected patterns: gemini-1.x, gemini-2.x, gemini-pro, gemini-ultra, gemini-nano, gemini-flash`);
    }

    // 移除google/前缀（如果存在）
    return model.replace(/^google\//, '');
  }

  /**
   * 转换Anthropic消息为Gemini格式
   */
  private convertAnthropicMessagesToGemini(messages: any[], requestId: string): GeminiApiRequest['contents'] {
    const contents: GeminiApiRequest['contents'] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (!message || typeof message !== 'object') {
        throw new Error(`GeminiTransformer: Invalid message at index ${i}`);
      }

      // 跳过系统消息（Gemini在contents中不支持system角色）
      if (message.role === 'system') {
        logger.debug('Skipping system message in Gemini contents', { index: i }, requestId, 'gemini-transformer');
        continue;
      }

      // 转换角色映射
      const role = this.mapAnthropicRoleToGemini(message.role);
      const parts = this.convertAnthropicContentToGeminiParts(message, i, requestId);

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    if (contents.length === 0) {
      throw new Error('GeminiTransformer: No valid messages to convert');
    }

    return contents;
  }

  /**
   * 映射Anthropic角色到Gemini角色
   */
  private mapAnthropicRoleToGemini(role: string): 'user' | 'model' {
    switch (role) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'model';
      default:
        throw new Error(`GeminiTransformer: Unsupported role: ${role}`);
    }
  }

  /**
   * 转换Anthropic消息内容为Gemini parts
   */
  private convertAnthropicContentToGeminiParts(message: any, index: number, requestId: string): any[] {
    const parts: any[] = [];

    // 处理字符串内容
    if (typeof message.content === 'string') {
      if (message.content.trim()) {
        parts.push({ text: message.content });
      }
    }
    // 处理数组内容
    else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text' && block.text) {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          // 转换工具调用
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input || {}
            }
          });
        } else if (block.type === 'tool_result') {
          // 处理工具结果 - 转换为Gemini functionResponse格式
          parts.push({
            functionResponse: {
              name: block.tool_use_id || 'unknown_tool',
              response: {
                name: block.tool_use_id || 'unknown_tool',
                content: block.content || block.result || 'Tool execution completed'
              }
            }
          });
        }
      }
    }

    // 处理OpenAI风格的工具调用（向后兼容）
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall: any, toolIndex: number) => {
        if (!toolCall.function?.name) {
          throw new Error(`GeminiTransformer: Invalid tool call at message ${index}, tool ${toolIndex}: missing function name`);
        }

        let args = {};
        if (toolCall.function.arguments) {
          try {
            args = typeof toolCall.function.arguments === 'string' 
              ? JSON.parse(toolCall.function.arguments) 
              : toolCall.function.arguments;
          } catch (error) {
            throw new Error(`GeminiTransformer: Invalid tool call arguments for '${toolCall.function.name}': ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: args
          }
        });
      });
    }

    return parts;
  }

  /**
   * 转换Anthropic工具定义为Gemini格式
   */
  private convertAnthropicToolsToGemini(tools: any[], requestId: string): GeminiApiRequest['tools'] {
    if (!Array.isArray(tools)) {
      throw new Error('GeminiTransformer: tools must be an array');
    }

    const functionDeclarations = tools.map((tool, index) => {
      // 支持多种工具定义格式
      let func: any;
      
      if (tool.function) {
        // 标准格式: { type: "function", function: { name, description, parameters } }
        func = tool.function;
      } else if (tool.name) {
        // 简化格式: { name, description, parameters }
        func = tool;
      } else {
        throw new Error(`GeminiTransformer: Invalid tool at index ${index}: missing function or name`);
      }

      if (!func.name) {
        throw new Error(`GeminiTransformer: Invalid tool at index ${index}: missing function name`);
      }

      return {
        name: func.name,
        description: func.description || '',
        parameters: func.parameters || {}
      };
    });

    logger.debug('Converted tools to Gemini format', {
      originalCount: tools.length,
      convertedCount: functionDeclarations.length,
      toolNames: functionDeclarations.map(f => f.name)
    }, requestId, 'gemini-transformer');

    return [{ functionDeclarations }];
  }

  /**
   * 转换Gemini parts为Anthropic内容块
   */
  private convertGeminiPartsToAnthropic(parts: any[], requestId: string): any[] {
    const content: any[] = [];
    let textParts: string[] = [];

    for (const part of parts) {
      if (part.text) {
        textParts.push(part.text);
      } else if (part.functionCall) {
        // 如果有累积的文本，先添加文本块
        if (textParts.length > 0) {
          content.push({
            type: 'text',
            text: textParts.join('').trim()
          });
          textParts = [];
        }

        // 添加工具调用块
        content.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }

    // 添加剩余的文本
    if (textParts.length > 0) {
      content.push({
        type: 'text',
        text: textParts.join('').trim()
      });
    }

    if (content.length === 0) {
      throw new Error('GeminiTransformer: No valid content parts to convert');
    }

    return content;
  }

  /**
   * 映射Gemini结束原因到Anthropic格式
   */
  private mapGeminiFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn'
    };

    const mapped = mapping[finishReason];
    if (!mapped) {
      throw new Error(`GeminiTransformer: Unknown finish reason: ${finishReason}`);
    }

    return mapped;
  }

  // MessageTransformer接口实现
  transformRequestToUnified(request: any): UnifiedRequest {
    throw new Error('GeminiTransformer: transformRequestToUnified not implemented - use direct methods');
  }

  transformRequestFromUnified(request: UnifiedRequest): any {
    throw new Error('GeminiTransformer: transformRequestFromUnified not implemented - use direct methods');
  }

  transformResponseToUnified(response: any): UnifiedResponse {
    throw new Error('GeminiTransformer: transformResponseToUnified not implemented - use direct methods');
  }

  transformResponseFromUnified(response: UnifiedResponse): any {
    throw new Error('GeminiTransformer: transformResponseFromUnified not implemented - use direct methods');
  }

  transformStreamChunk(chunk: any): StreamChunk | null {
    // Gemini流式处理通过模拟方式实现，这里暂时不需要实现
    return null;
  }
}

/**
 * 便捷函数：转换Anthropic请求为Gemini格式
 */
export function transformAnthropicToGemini(request: BaseRequest): GeminiApiRequest {
  const transformer = new GeminiTransformer();
  return transformer.transformAnthropicToGemini(request);
}

/**
 * 便捷函数：转换Gemini响应为Anthropic格式
 */
export function transformGeminiToAnthropic(
  response: GeminiApiResponse, 
  originalModel: string, 
  requestId?: string
): BaseResponse {
  const transformer = new GeminiTransformer();
  return transformer.transformGeminiToAnthropic(response, originalModel, requestId);
}