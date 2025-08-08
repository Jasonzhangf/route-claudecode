/**
 * Gemini格式解析器
 * 处理Google Gemini API格式
 */

import { BaseFormatParser, ParseResult, ToolCall, ParsingContext } from './base-parser';

export class GeminiFormatParser extends BaseFormatParser {
  constructor() {
    super('gemini');
  }

  /**
   * 检测是否为Gemini格式
   */
  canParse(data: any, context: ParsingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Gemini格式特征：
    // 1. 有candidates数组
    // 2. 没有choices数组（OpenAI特征）
    // 3. 没有content数组（Anthropic特征）
    
    const hasGeminiCandidates = data.candidates && Array.isArray(data.candidates);
    const hasOpenAIChoices = data.choices && Array.isArray(data.choices);
    const hasAnthropicContent = data.content && Array.isArray(data.content);

    const isGemini = hasGeminiCandidates && !hasOpenAIChoices && !hasAnthropicContent;
    
    console.log(`🔍 [GEMINI] Format detection:`, {
      hasGeminiCandidates,
      hasOpenAIChoices,
      hasAnthropicContent,
      isGemini,
      requestId: context.requestId
    });

    return isGemini;
  }

  /**
   * 解析Gemini格式的工具调用
   */
  parseToolCalls(data: any, context: ParsingContext): ParseResult {
    const toolCalls: ToolCall[] = [];
    let toolCount = 0;
    let confidence = 0.8; // Gemini格式置信度中等

    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
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

    // 解析candidates数组中的工具调用
    for (const candidate of data.candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      // 检查content中的parts
      if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (!part || typeof part !== 'object') {
            continue;
          }

          // 检查functionCall
          if (part.functionCall) {
            const parsedToolCall = this.parseGeminiFunctionCall(part.functionCall, context);
            if (parsedToolCall) {
              toolCalls.push(parsedToolCall);
              toolCount++;
            }
          }

          // 检查function_call（兼容格式）
          if (part.function_call) {
            const parsedToolCall = this.parseGeminiFunctionCall(part.function_call, context);
            if (parsedToolCall) {
              toolCalls.push(parsedToolCall);
              toolCount++;
            }
          }

          // 检查text中的工具调用
          if (part.text && typeof part.text === 'string') {
            const textToolCalls = this.parseTextToolCalls(part.text, context);
            toolCalls.push(...textToolCalls);
            toolCount += textToolCalls.length;
            
            if (textToolCalls.length > 0) {
              confidence = Math.min(confidence, 0.5); // 文本解析置信度较低
            }
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
   * 解析Gemini functionCall对象
   */
  private parseGeminiFunctionCall(functionCall: any, context: ParsingContext): ToolCall | null {
    if (!functionCall || typeof functionCall !== 'object') {
      return null;
    }

    if (!functionCall.name) {
      console.warn(`🚨 [GEMINI] Function call missing name`, { requestId: context.requestId });
      return null;
    }

    let input: any = {};
    if (functionCall.args) {
      // Gemini使用args而不是arguments
      input = typeof functionCall.args === 'object' ? functionCall.args : {};
    }

    const result: ToolCall = {
      id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: functionCall.name,
      input,
      type: 'function_call'
    };

    try {
      this.validateToolCall(result, context);
      return result;
    } catch (error) {
      console.warn(`🚨 [GEMINI] Function call validation failed`, {
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

    // Gemini特有的工具调用模式
    const patterns = [
      // Gemini函数调用格式
      /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/gi,
      // 标准JSON格式
      /\{\s*"functionCall"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}\s*\}/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const name = match[1];
          const input = JSON.parse(match[2]);

          const toolCall: ToolCall = {
            id: `gemini_text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            input,
            type: 'function_call'
          };

          this.validateToolCall(toolCall, context);
          toolCalls.push(toolCall);

        } catch (error) {
          console.warn(`🚨 [GEMINI] Failed to parse text tool call: ${match[0]}`, {
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
   * 获取Gemini格式的finish reason
   */
  getFinishReason(data: any, context: ParsingContext): string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      return undefined;
    }

    const candidate = data.candidates[0];
    
    // Gemini使用finishReason字段
    const finishReason = candidate.finishReason;
    
    if (finishReason === undefined || finishReason === null) {
      return undefined;
    }

    if (typeof finishReason !== 'string') {
      throw new Error(`Gemini finishReason must be string, got ${typeof finishReason}`);
    }

    // 检查fallback值
    if (finishReason === 'unknown' || finishReason === 'default') {
      throw new Error(`Gemini finishReason has fallback value: ${finishReason} - violates zero fallback principle`);
    }

    console.log(`🎯 [GEMINI] Finish reason: ${finishReason}`, {
      requestId: context.requestId
    });

    return finishReason;
  }

  /**
   * 修复Gemini格式的finish reason
   */
  fixFinishReason(data: any, targetReason: string, context: ParsingContext): any {
    if (!data || typeof data !== 'object') {
      throw new Error('Gemini data is null or not object - cannot fix finish reason');
    }

    if (!targetReason) {
      throw new Error('Target reason is required - violates zero fallback principle');
    }

    // 检查目标值是否为fallback
    if (targetReason === 'unknown' || targetReason === 'default') {
      throw new Error(`Target reason is fallback value: ${targetReason} - violates zero fallback principle`);
    }

    if (!data.candidates || !Array.isArray(data.candidates)) {
      throw new Error('Gemini data missing candidates array - cannot fix finish reason');
    }

    // Gemini的finish reason映射
    let mappedReason = targetReason;
    if (targetReason === 'tool_calls' || targetReason === 'tool_use') {
      mappedReason = 'STOP'; // Gemini使用STOP表示完成
    }

    // 修复所有candidates中的finishReason
    for (const candidate of data.candidates) {
      if (candidate && typeof candidate === 'object') {
        const originalReason = candidate.finishReason;
        candidate.finishReason = mappedReason;

        console.log(`🔧 [GEMINI] Fixed finish reason: ${originalReason} -> ${mappedReason}`, {
          requestId: context.requestId
        });
      }
    }

    return data;
  }
}