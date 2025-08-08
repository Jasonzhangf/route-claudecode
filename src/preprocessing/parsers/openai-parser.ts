/**
 * OpenAI格式解析器
 * 处理OpenAI API格式和兼容格式
 */

import { BaseFormatParser, ParseResult, ToolCall, ParsingContext } from './base-parser';

export class OpenAIFormatParser extends BaseFormatParser {
  constructor() {
    super('openai');
  }

  /**
   * 检测是否为OpenAI格式
   */
  canParse(data: any, context: ParsingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // OpenAI格式特征：
    // 1. 有choices数组
    // 2. 有finish_reason字段
    // 3. 没有content数组（Anthropic特征）
    // 4. 没有candidates数组（Gemini特征）
    
    const hasOpenAIChoices = data.choices && Array.isArray(data.choices);
    const hasAnthropicContent = data.content && Array.isArray(data.content);
    const hasGeminiCandidates = data.candidates && Array.isArray(data.candidates);

    const isOpenAI = hasOpenAIChoices && !hasAnthropicContent && !hasGeminiCandidates;
    
    console.log(`🔍 [OPENAI] Format detection:`, {
      hasOpenAIChoices,
      hasAnthropicContent,
      hasGeminiCandidates,
      isOpenAI,
      requestId: context.requestId
    });

    return isOpenAI;
  }

  /**
   * 解析OpenAI格式的工具调用
   */
  parseToolCalls(data: any, context: ParsingContext): ParseResult {
    const toolCalls: ToolCall[] = [];
    let toolCount = 0;
    let confidence = 0.9; // OpenAI格式置信度较高

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      const result: ParseResult = {
        hasTools: false,
        toolCount: 0,
        toolCalls: [],
        confidence: 1.0
      };
      
      this.validateParseResult(result, context);
      this.logParseResult(result, context);
      return result;
    }

    // 解析choices数组中的工具调用
    for (const choice of data.choices) {
      if (!choice || typeof choice !== 'object') {
        continue;
      }

      // 检查message中的工具调用
      if (choice.message) {
        // 新格式：tool_calls数组
        if (choice.message.tool_calls && Array.isArray(choice.message.tool_calls)) {
          for (const toolCall of choice.message.tool_calls) {
            const parsedToolCall = this.parseOpenAIToolCall(toolCall, context);
            if (parsedToolCall) {
              toolCalls.push(parsedToolCall);
              toolCount++;
            }
          }
        }

        // 旧格式：function_call对象
        if (choice.message.function_call) {
          const parsedToolCall = this.parseOpenAIFunctionCall(choice.message.function_call, context);
          if (parsedToolCall) {
            toolCalls.push(parsedToolCall);
            toolCount++;
          }
        }

        // 检查content中的文本工具调用
        if (choice.message.content && typeof choice.message.content === 'string') {
          const textToolCalls = this.parseTextToolCalls(choice.message.content, context);
          toolCalls.push(...textToolCalls);
          toolCount += textToolCalls.length;
          
          if (textToolCalls.length > 0) {
            confidence = Math.min(confidence, 0.6); // 文本解析置信度更低
          }
        }
      }

      // 检查delta中的工具调用（流式响应）
      if (choice.delta) {
        if (choice.delta.tool_calls && Array.isArray(choice.delta.tool_calls)) {
          for (const toolCall of choice.delta.tool_calls) {
            const parsedToolCall = this.parseOpenAIToolCall(toolCall, context);
            if (parsedToolCall) {
              toolCalls.push(parsedToolCall);
              toolCount++;
            }
          }
        }

        if (choice.delta.function_call) {
          const parsedToolCall = this.parseOpenAIFunctionCall(choice.delta.function_call, context);
          if (parsedToolCall) {
            toolCalls.push(parsedToolCall);
            toolCount++;
          }
        }
      }
    }

    const result: ParseResult = {
      hasTools: toolCount > 0,
      toolCount,
      toolCalls,
      finishReason: this.getFinishReason(data, context),
      confidence
    };

    this.validateParseResult(result, context);
    this.logParseResult(result, context);
    return result;
  }

  /**
   * 解析OpenAI tool_call对象
   */
  private parseOpenAIToolCall(toolCall: any, context: ParsingContext): ToolCall | null {
    if (!toolCall || typeof toolCall !== 'object') {
      return null;
    }

    if (!toolCall.id) {
      console.warn(`🚨 [OPENAI] Tool call missing id`, { requestId: context.requestId });
      return null;
    }

    if (!toolCall.function || !toolCall.function.name) {
      console.warn(`🚨 [OPENAI] Tool call missing function name`, { 
        id: toolCall.id, 
        requestId: context.requestId 
      });
      return null;
    }

    let input: any = {};
    if (toolCall.function.arguments) {
      try {
        input = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch (error) {
        console.warn(`🚨 [OPENAI] Failed to parse tool call arguments`, {
          id: toolCall.id,
          arguments: toolCall.function.arguments,
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
        input = {}; // 不使用fallback，使用空对象
      }
    }

    const result: ToolCall = {
      id: toolCall.id,
      name: toolCall.function.name,
      input,
      type: 'function_call'
    };

    try {
      this.validateToolCall(result, context);
      return result;
    } catch (error) {
      console.warn(`🚨 [OPENAI] Tool call validation failed`, {
        toolCall: result,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      return null;
    }
  }

  /**
   * 解析OpenAI function_call对象（旧格式）
   */
  private parseOpenAIFunctionCall(functionCall: any, context: ParsingContext): ToolCall | null {
    if (!functionCall || typeof functionCall !== 'object') {
      return null;
    }

    if (!functionCall.name) {
      console.warn(`🚨 [OPENAI] Function call missing name`, { requestId: context.requestId });
      return null;
    }

    let input: any = {};
    if (functionCall.arguments) {
      try {
        input = typeof functionCall.arguments === 'string' 
          ? JSON.parse(functionCall.arguments)
          : functionCall.arguments;
      } catch (error) {
        console.warn(`🚨 [OPENAI] Failed to parse function call arguments`, {
          name: functionCall.name,
          arguments: functionCall.arguments,
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
        input = {}; // 不使用fallback，使用空对象
      }
    }

    const result: ToolCall = {
      id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: functionCall.name,
      input,
      type: 'function_call'
    };

    try {
      this.validateToolCall(result, context);
      return result;
    } catch (error) {
      console.warn(`🚨 [OPENAI] Function call validation failed`, {
        functionCall: result,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      return null;
    }
  }

  /**
   * 从文本中解析工具调用（处理不规范格式）
   */
  private parseTextToolCalls(text: string, context: ParsingContext): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    
    if (!text || typeof text !== 'string') {
      return toolCalls;
    }

    // 匹配各种工具调用模式
    const patterns = [
      // Tool call: FunctionName({...}) 格式
      /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi,
      // 函数调用格式 functionName({...})
      /(\w+)\s*\(\s*(\{[^}]*\})\s*\)/gi,
      // JSON格式的函数调用
      /\{\s*"function"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"([^"]+)"\s*\}\s*\}/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          let name: string;
          let input: any;

          if (pattern.source.includes('Tool\\s+call')) {
            // Tool call格式
            name = match[1];
            input = JSON.parse(match[2]);
          } else if (pattern.source.includes('"function"')) {
            // JSON格式
            name = match[1];
            input = JSON.parse(match[2]);
          } else {
            // 函数调用格式
            name = match[1];
            // 排除常见的非工具调用
            if (['console', 'json', 'object', 'array', 'string', 'math', 'date'].includes(name.toLowerCase())) {
              continue;
            }
            input = JSON.parse(match[2]);
          }

          const toolCall: ToolCall = {
            id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            input,
            type: 'function_call'
          };

          this.validateToolCall(toolCall, context);
          toolCalls.push(toolCall);

        } catch (error) {
          console.warn(`🚨 [OPENAI] Failed to parse text tool call: ${match[0]}`, {
            error: error instanceof Error ? error.message : String(error),
            requestId: context.requestId
          });
          // 不抛出错误，继续解析其他工具调用
        }
      }
    }

    return toolCalls;
  }

  /**
   * 获取OpenAI格式的finish reason
   */
  getFinishReason(data: any, context: ParsingContext): string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      return undefined;
    }

    const choice = data.choices[0];
    const finishReason = choice.finish_reason;
    
    if (finishReason === undefined || finishReason === null) {
      return undefined;
    }

    if (typeof finishReason !== 'string') {
      throw new Error(`OpenAI finish_reason must be string, got ${typeof finishReason}`);
    }

    // 检查fallback值
    if (finishReason === 'unknown' || finishReason === 'default') {
      throw new Error(`OpenAI finish_reason has fallback value: ${finishReason} - violates zero fallback principle`);
    }

    console.log(`🎯 [OPENAI] Finish reason: ${finishReason}`, {
      requestId: context.requestId
    });

    return finishReason;
  }

  /**
   * 修复OpenAI格式的finish reason
   */
  fixFinishReason(data: any, targetReason: string, context: ParsingContext): any {
    if (!data || typeof data !== 'object') {
      throw new Error('OpenAI data is null or not object - cannot fix finish reason');
    }

    if (!targetReason) {
      throw new Error('Target reason is required - violates zero fallback principle');
    }

    // 检查目标值是否为fallback
    if (targetReason === 'unknown' || targetReason === 'default') {
      throw new Error(`Target reason is fallback value: ${targetReason} - violates zero fallback principle`);
    }

    if (!data.choices || !Array.isArray(data.choices)) {
      throw new Error('OpenAI data missing choices array - cannot fix finish reason');
    }

    // 修复所有choices中的finish_reason
    for (const choice of data.choices) {
      if (choice && typeof choice === 'object') {
        const originalReason = choice.finish_reason;
        choice.finish_reason = targetReason;

        console.log(`🔧 [OPENAI] Fixed finish reason: ${originalReason} -> ${targetReason}`, {
          requestId: context.requestId
        });
      }
    }

    return data;
  }
}