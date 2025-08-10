/**
 * Gemini Transformer - 完整实现
 * 基于项目记忆中的最佳实践，包含工具调用和内容驱动的stop_reason判断
 * Project owner: Jason Zhang
 */

import { BaseRequest, BaseResponse, GeminiApiRequest, GeminiApiResponse } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Gemini Transformer - 处理Anthropic与Gemini API格式转换
 */
export class GeminiTransformer {
  /**
   * 转换Anthropic请求为Gemini格式
   */
  transformAnthropicToGemini(request: BaseRequest): { geminiRequest: GeminiApiRequest; metadata: any } {
    const requestId = request.metadata?.requestId || 'unknown';
    
    try {
      logger.debug('Starting Anthropic to Gemini transformation', {
        requestId,
        model: request.model,
        messageCount: request.messages?.length,
        hasTools: !!request.tools?.length,
        hasSystem: !!request.metadata?.system
      });

      // 构建基础请求
      const geminiRequest: GeminiApiRequest = {
        contents: this.convertMessages(request.messages, request.metadata?.system),
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.max_tokens || 131072
        }
      };

      // 处理工具
      if (request.tools && request.tools.length > 0) {
        const { tools, toolConfig } = this.buildToolsAndConfig(request.tools, request.metadata?.tool_choice);
        geminiRequest.tools = tools;
        geminiRequest.toolConfig = toolConfig;

        logger.debug('Added tools to Gemini request with dynamic toolConfig', {
          requestId,
          toolCount: tools.length,
          functionCount: tools[0]?.functionDeclarations?.length,
          toolConfig: toolConfig.functionCallingConfig
        });
      }

      // 添加安全设置
      geminiRequest.safetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ];

      const metadata = {
        requestId,
        originalFormat: 'anthropic',
        transformed: true,
        toolsEnabled: !!geminiRequest.tools?.length,
        timestamp: Date.now()
      };

      logger.debug('Completed Anthropic to Gemini transformation', {
        requestId,
        hasContents: !!geminiRequest.contents?.length,
        hasTools: !!geminiRequest.tools?.length,
        hasToolConfig: !!geminiRequest.toolConfig,
        generationConfig: geminiRequest.generationConfig
      });

      return { geminiRequest, metadata };

    } catch (error) {
      logger.error('Error transforming Anthropic to Gemini', {
        requestId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * 转换Gemini响应为Anthropic格式
   */
  transformGeminiToAnthropic(response: GeminiApiResponse, originalModel: string, requestId: string): BaseResponse {
    try {
      logger.debug('Starting Gemini to Anthropic response transformation', {
        requestId,
        candidateCount: response.candidates?.length,
        hasUsage: !!response.usageMetadata
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const candidate = response.candidates[0];
      const content = this.convertResponseContent(candidate.content, requestId);
      
      // 🎯 关键修复：内容驱动的stop_reason判断（基于OpenAI成功模式）
      const stopReason = this.determineStopReason(content, candidate.finishReason);

      const anthropicResponse: BaseResponse = {
        id: requestId,
        type: 'message',
        role: 'assistant',
        content: content,
        model: originalModel,
        stop_reason: stopReason,
        usage: response.usageMetadata ? {
          input_tokens: response.usageMetadata.promptTokenCount,
          output_tokens: response.usageMetadata.candidatesTokenCount
        } : undefined
      };

      logger.debug('Completed Gemini to Anthropic transformation', {
        requestId,
        contentBlockCount: content.length,
        stopReason,
        hasToolUse: content.some(block => block.type === 'tool_use'),
        hasUsage: !!anthropicResponse.usage
      });

      return anthropicResponse;

    } catch (error) {
      logger.error('Error transforming Gemini to Anthropic', {
        requestId,
        error: (error as Error).message,
        candidateCount: response.candidates?.length
      });
      throw error;
    }
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: any[], systemMessage?: any): GeminiApiRequest['contents'] {
    const contents: GeminiApiRequest['contents'] = [];
    
    // 添加系统消息（转换为第一个用户消息）
    if (systemMessage) {
      const systemText = Array.isArray(systemMessage) 
        ? systemMessage.map(s => s.text || JSON.stringify(s)).join('\n')
        : systemMessage;
      
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemText}` }]
      });
    }

    // 转换对话消息
    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts = this.convertMessageContent(message.content);
      
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return contents;
  }

  /**
   * 转换消息内容
   */
  private convertMessageContent(content: any): Array<any> {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    if (Array.isArray(content)) {
      const parts = [];
      
      for (const block of content) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input || {}
            }
          });
        } else if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: block.tool_use_id,
              response: {
                name: block.tool_use_id,
                content: block.content
              }
            }
          });
        }
      }
      
      return parts;
    }

    return [{ text: JSON.stringify(content) }];
  }

  /**
   * 构建工具和配置
   */
  private buildToolsAndConfig(tools: any[], toolChoice?: any): { tools: any[]; toolConfig: any } {
    // 转换工具定义
    const functionDeclarations = tools.map(tool => {
      // 🔧 修复：支持双格式工具（OpenAI和Anthropic）
      const name = tool.name || tool.function?.name;
      const description = tool.description || tool.function?.description;
      const parameters = tool.input_schema || tool.parameters || tool.function?.parameters || {};

      if (!name || !description) {
        throw new Error(`Invalid tool format: missing name or description in ${JSON.stringify(tool)}`);
      }

      return {
        name,
        description,
        parameters
      };
    });

    const geminiTools = [{
      functionDeclarations
    }];

    // 构建工具配置
    const allowedFunctionNames = functionDeclarations.map(func => func.name);
    const toolConfig = this.buildToolConfig(toolChoice, allowedFunctionNames);

    return { tools: geminiTools, toolConfig };
  }

  /**
   * 构建工具配置（基于demo3的智能模式选择）
   */
  private buildToolConfig(toolChoice: any, allowedFunctionNames: string[]): any {
    if (!toolChoice) {
      return {
        functionCallingConfig: {
          mode: 'AUTO',
          allowedFunctionNames: allowedFunctionNames
        }
      };
    }

    // 处理字符串格式的tool_choice
    if (typeof toolChoice === 'string') {
      if (toolChoice === 'auto') {
        return {
          functionCallingConfig: {
            mode: 'AUTO',
            allowedFunctionNames: allowedFunctionNames
          }
        };
      } else if (toolChoice === 'none') {
        return {
          functionCallingConfig: {
            mode: 'NONE'
          }
        };
      } else {
        // 指定特定工具名
        return {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [toolChoice]
          }
        };
      }
    }

    // 处理对象格式的tool_choice
    if (typeof toolChoice === 'object') {
      if (toolChoice.type === 'auto') {
        return {
          functionCallingConfig: {
            mode: 'AUTO',
            allowedFunctionNames: allowedFunctionNames
          }
        };
      } else if (toolChoice.type === 'tool' && toolChoice.name) {
        return {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [toolChoice.name]
          }
        };
      }
    }

    // 默认使用AUTO模式
    return {
      functionCallingConfig: {
        mode: 'AUTO',
        allowedFunctionNames: allowedFunctionNames
      }
    };
  }

  /**
   * 转换响应内容
   */
  private convertResponseContent(content: any, requestId: string): Array<any> {
    const blocks = [];

    if (!content || !content.parts) {
      return [{ type: 'text', text: '' }];
    }

    for (const part of content.parts) {
      if (part.text) {
        blocks.push({
          type: 'text',
          text: part.text
        });
      } else if (part.functionCall) {
        blocks.push({
          type: 'tool_use',
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', text: '' }];
  }

  /**
   * 🎯 关键方法：内容驱动的stop_reason判断（基于OpenAI成功模式）
   */
  private determineStopReason(content: Array<any>, finishReason: string): string {
    // 优先基于转换后的content判断，而非原始finishReason
    const hasToolUse = content.some(block => block.type === 'tool_use');
    
    if (hasToolUse) {
      return 'tool_use';
    }

    // 根据Gemini的finishReason映射
    switch (finishReason) {
      case 'STOP':
        return 'end_turn';
      case 'MAX_TOKENS':
        return 'max_tokens';
      case 'SAFETY':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}

/**
 * 便捷函数：转换Anthropic请求为Gemini格式
 */
export function transformAnthropicToGemini(request: BaseRequest): { geminiRequest: GeminiApiRequest; metadata: any } {
  const transformer = new GeminiTransformer();
  return transformer.transformAnthropicToGemini(request);
}

/**
 * 便捷函数：转换Gemini响应为Anthropic格式
 */
export function transformGeminiToAnthropic(
  response: GeminiApiResponse, 
  originalModel: string, 
  requestId: string
): BaseResponse {
  const transformer = new GeminiTransformer();
  return transformer.transformGeminiToAnthropic(response, originalModel, requestId);
}

// Types are exported from @/types