/**
 * Gemini请求格式转换器
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 将统一格式请求转换为Gemini API格式
 * - 处理工具调用配置
 * - 严格验证请求格式
 */

import { BaseRequest } from '../../../types';
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

export class GeminiRequestConverter {
  /**
   * 将BaseRequest转换为Gemini API格式
   */
  static convertToGeminiFormat(request: BaseRequest): GeminiApiRequest {
    if (!request) {
      throw new Error('GeminiRequestConverter: request is required');
    }

    if (!request.messages || !Array.isArray(request.messages)) {
      throw new Error('GeminiRequestConverter: request.messages must be a non-empty array');
    }

    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Converting request to Gemini format', {
      messageCount: request.messages.length,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    }, requestId, 'gemini-request-converter');

    const geminiRequest: GeminiApiRequest = {
      model: this.extractModelName(request.model),
      contents: this.convertMessages(request.messages, requestId),
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
      geminiRequest.tools = this.convertTools(request.tools, requestId);
      geminiRequest.functionCallingConfig = {
        mode: 'AUTO'
      };
      
      logger.debug('Added tools to Gemini request', {
        toolCount: request.tools.length,
        toolNames: request.tools.map(t => t.function?.name).filter(Boolean)
      }, requestId, 'gemini-request-converter');
    }

    return geminiRequest;
  }

  /**
   * 提取模型名称
   */
  private static extractModelName(model: string): string {
    if (!model) {
      throw new Error('GeminiRequestConverter: model is required');
    }

    // 🔧 修复：正确处理Gemini模型名验证
    // 先检查原始模型名，再进行清理
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
      throw new Error(`GeminiRequestConverter: Unsupported model '${model}'. Expected patterns: gemini-1.x, gemini-2.x, gemini-pro, gemini-ultra, gemini-nano, gemini-flash`);
    }

    // 移除可能的前缀，保留Gemini原生模型名 (但只移除google/前缀)
    const cleanModel = model.replace(/^google\//, '');
    
    return cleanModel;
  }

  /**
   * 转换消息格式
   */
  private static convertMessages(messages: any[], requestId: string): GeminiApiRequest['contents'] {
    const contents: GeminiApiRequest['contents'] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (!message || typeof message !== 'object') {
        throw new Error(`GeminiRequestConverter: Invalid message at index ${i}`);
      }

      // 跳过系统消息（Gemini在contents中不支持system角色）
      if (message.role === 'system') {
        logger.debug('Skipping system message in Gemini contents', { index: i }, requestId, 'gemini-request-converter');
        continue;
      }

      // 转换角色映射
      const role = this.mapRole(message.role);
      const parts = this.convertMessageContent(message, i, requestId);

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    if (contents.length === 0) {
      throw new Error('GeminiRequestConverter: No valid messages to convert');
    }

    return contents;
  }

  /**
   * 映射角色
   */
  private static mapRole(role: string): 'user' | 'model' {
    switch (role) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'model';
      default:
        throw new Error(`GeminiRequestConverter: Unsupported role: ${role}`);
    }
  }

  /**
   * 转换消息内容
   */
  private static convertMessageContent(message: any, index: number, requestId: string): any[] {
    const parts: any[] = [];

    // 处理文本内容
    if (message.content) {
      if (typeof message.content === 'string') {
        if (message.content.trim()) {
          parts.push({ text: message.content });
        }
      } else if (Array.isArray(message.content)) {
        message.content.forEach((block: any) => {
          if (block.type === 'text' && block.text) {
            parts.push({ text: block.text });
          }
        });
      }
    }

    // 处理工具调用
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall: any, toolIndex: number) => {
        if (!toolCall.function?.name) {
          throw new Error(`GeminiRequestConverter: Invalid tool call at message ${index}, tool ${toolIndex}: missing function name`);
        }

        let args = {};
        if (toolCall.function.arguments) {
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            throw new Error(`GeminiRequestConverter: Invalid tool call arguments for '${toolCall.function.name}': ${error instanceof Error ? error.message : String(error)}`);
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
   * 转换工具定义
   */
  private static convertTools(tools: any[], requestId: string): GeminiApiRequest['tools'] {
    if (!Array.isArray(tools)) {
      throw new Error('GeminiRequestConverter: tools must be an array');
    }

    const functionDeclarations = tools.map((tool, index) => {
      if (!tool.function) {
        throw new Error(`GeminiRequestConverter: Invalid tool at index ${index}: missing function`);
      }

      const func = tool.function;
      if (!func.name) {
        throw new Error(`GeminiRequestConverter: Invalid tool at index ${index}: missing function name`);
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
    }, requestId, 'gemini-request-converter');

    return [{
      functionDeclarations
    }];
  }
}