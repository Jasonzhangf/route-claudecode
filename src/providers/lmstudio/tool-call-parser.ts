/**
 * LM Studio工具调用解析器
 * 处理LM Studio将工具调用作为文本返回的情况
 * Project Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { toolParsingFailureLogger } from '@/utils/tool-parsing-failure-logger';

export interface ParsedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallParseResult {
  success: boolean;
  toolCalls: ParsedToolCall[];
  remainingContent: string;
  parseMethod: 'structured' | 'text_extraction' | 'pattern_matching' | 'natural_language' | 'none';
  confidence: number; // 0-1, 解析置信度
}

export class LMStudioToolCallParser {
  private requestId: string;
  private originalTools: any[];

  constructor(requestId: string, originalTools: any[] = []) {
    this.requestId = requestId;
    this.originalTools = originalTools;
  }

  /**
   * 解析LM Studio响应中的工具调用
   */
  async parseResponse(response: any): Promise<ToolCallParseResult> {
    try {
      // 首先检查是否已经是标准格式
      if (this.hasStructuredToolCalls(response)) {
        logger.debug('🔧 [LMSTUDIO-PARSER] Found structured tool calls', {
          toolCallCount: response.choices[0].message.tool_calls.length,
          requestId: this.requestId
        });
        
        return {
          success: true,
          toolCalls: response.choices[0].message.tool_calls,
          remainingContent: response.choices[0].message.content || '',
          parseMethod: 'structured',
          confidence: 1.0
        };
      }

      // 检查是否有文本内容需要解析
      const content = this.extractContent(response);
      if (!content) {
        return {
          success: false,
          toolCalls: [],
          remainingContent: '',
          parseMethod: 'none',
          confidence: 0
        };
      }

      logger.debug('🔧 [LMSTUDIO-PARSER] Attempting text-based tool call extraction', {
        contentLength: content.length,
        hasKnownTools: this.originalTools.length > 0,
        requestId: this.requestId
      });

      // 尝试不同的解析策略
      const strategies = [
        () => this.parseJsonFormatToolCalls(content),
        () => this.parseFunctionCallFormat(content),
        () => this.parseActionFormat(content),
        () => this.parseNaturalLanguageToolCalls(content)
      ];

      for (const strategy of strategies) {
        const result = await strategy();
        if (result.success && result.toolCalls.length > 0) {
          logger.info('🎯 [LMSTUDIO-PARSER] Successfully extracted tool calls', {
            method: result.parseMethod,
            toolCallCount: result.toolCalls.length,
            confidence: result.confidence,
            requestId: this.requestId
          });
          return result;
        }
      }

      // 所有策略都失败了，记录到数据库
      await this.logParsingFailure(response, content, 'All parsing strategies failed');

      return {
        success: false,
        toolCalls: [],
        remainingContent: content,
        parseMethod: 'none',
        confidence: 0
      };

    } catch (error) {
      logger.error('🚨 [LMSTUDIO-PARSER] Tool call parsing error', error, this.requestId);
      
      await toolParsingFailureLogger.logFailure(
        this.requestId,
        'lmstudio',
        'unknown',
        'localhost:1234',
        response,
        {
          failureType: 'parsing_error',
          errorMessage: error instanceof Error ? error.message : String(error),
          expectedFormat: 'openai',
          requestTools: this.originalTools,
          parsingAttempts: ['json_format', 'function_call', 'action_format', 'natural_language']
        }
      );

      return {
        success: false,
        toolCalls: [],
        remainingContent: this.extractContent(response) || '',
        parseMethod: 'none',
        confidence: 0
      };
    }
  }

  /**
   * 检查是否已经有结构化的工具调用
   */
  private hasStructuredToolCalls(response: any): boolean {
    return !!(response?.choices?.[0]?.message?.tool_calls?.length > 0);
  }

  /**
   * 提取响应内容
   */
  private extractContent(response: any): string {
    if (response?.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    if (response?.content && typeof response.content === 'string') {
      return response.content;
    }
    return '';
  }

  /**
   * 解析JSON格式的工具调用
   */
  private async parseJsonFormatToolCalls(content: string): Promise<ToolCallParseResult> {
    const jsonPattern = /\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*"arguments"\s*:\s*(\{[^}]*\})[^{}]*\}/g;
    const toolCalls: ParsedToolCall[] = [];
    let match;
    let remainingContent = content;
    
    while ((match = jsonPattern.exec(content)) !== null) {
      const functionName = match[1];
      const argumentsText = match[2];
      
      // 验证函数名是否在原始工具列表中
      if (!this.isValidToolName(functionName)) {
        continue;
      }
      
      try {
        // 验证参数是否为有效JSON
        JSON.parse(argumentsText);
        
        const toolCall: ParsedToolCall = {
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          type: 'function',
          function: {
            name: functionName,
            arguments: argumentsText
          }
        };
        
        toolCalls.push(toolCall);
        remainingContent = remainingContent.replace(match[0], '').trim();
        
      } catch (error) {
        logger.debug('Invalid JSON in tool call arguments', {
          functionName,
          argumentsText,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent,
      parseMethod: 'text_extraction',
      confidence: toolCalls.length > 0 ? 0.8 : 0
    };
  }

  /**
   * 解析function_call格式
   */
  private async parseFunctionCallFormat(content: string): Promise<ToolCallParseResult> {
    const functionCallPattern = /(?:function_call|tool_call)\s*\(\s*([^,\)]+)\s*,?\s*([^)]*)\s*\)/gi;
    const toolCalls: ParsedToolCall[] = [];
    let match;
    let remainingContent = content;
    
    while ((match = functionCallPattern.exec(content)) !== null) {
      const functionName = match[1].replace(/['"]/g, '').trim();
      const argumentsText = match[2].trim();
      
      if (!this.isValidToolName(functionName)) {
        continue;
      }
      
      // 尝试解析参数
      let parsedArguments = '{}';
      if (argumentsText) {
        try {
          // 如果看起来像JSON，直接使用
          if (argumentsText.startsWith('{')) {
            JSON.parse(argumentsText); // 验证
            parsedArguments = argumentsText;
          } else {
            // 尝试将参数转换为JSON格式
            parsedArguments = this.convertArgsToJson(argumentsText);
          }
        } catch (error) {
          logger.debug('Failed to parse function call arguments', {
            functionName,
            argumentsText,
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }
      
      const toolCall: ParsedToolCall = {
        id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type: 'function',
        function: {
          name: functionName,
          arguments: parsedArguments
        }
      };
      
      toolCalls.push(toolCall);
      remainingContent = remainingContent.replace(match[0], '').trim();
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent,
      parseMethod: 'pattern_matching',
      confidence: toolCalls.length > 0 ? 0.7 : 0
    };
  }

  /**
   * 解析Action格式
   */
  private async parseActionFormat(content: string): Promise<ToolCallParseResult> {
    const actionPattern = /Action:\s*([^\n]+)(?:\nAction Input:\s*([^\n]+))?/gi;
    const toolCalls: ParsedToolCall[] = [];
    let match;
    let remainingContent = content;
    
    while ((match = actionPattern.exec(content)) !== null) {
      const actionName = match[1].trim();
      const actionInput = match[2]?.trim() || '{}';
      
      if (!this.isValidToolName(actionName)) {
        continue;
      }
      
      // 尝试解析输入
      let parsedInput = '{}';
      try {
        if (actionInput.startsWith('{')) {
          JSON.parse(actionInput); // 验证
          parsedInput = actionInput;
        } else {
          parsedInput = JSON.stringify({ input: actionInput });
        }
      } catch (error) {
        parsedInput = JSON.stringify({ input: actionInput });
      }
      
      const toolCall: ParsedToolCall = {
        id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type: 'function',
        function: {
          name: actionName,
          arguments: parsedInput
        }
      };
      
      toolCalls.push(toolCall);
      remainingContent = remainingContent.replace(match[0], '').trim();
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent,
      parseMethod: 'pattern_matching',
      confidence: toolCalls.length > 0 ? 0.6 : 0
    };
  }

  /**
   * 解析自然语言工具调用
   */
  private async parseNaturalLanguageToolCalls(content: string): Promise<ToolCallParseResult> {
    const toolCalls: ParsedToolCall[] = [];
    
    // 为每个已知工具搜索自然语言模式
    for (const tool of this.originalTools) {
      if (!tool.function?.name) continue;
      
      const toolName = tool.function.name;
      const patterns = this.generateNaturalLanguagePatterns(toolName);
      
      for (const pattern of patterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
          const extractedData = this.extractDataFromMatch(matches, pattern, tool);
          if (extractedData) {
            toolCalls.push(extractedData);
            break; // 找到一个匹配就够了
          }
        }
      }
    }
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      remainingContent: content, // 保持原内容，因为可能包含其他有用信息
      parseMethod: 'natural_language',
      confidence: toolCalls.length > 0 ? 0.5 : 0
    };
  }

  /**
   * 生成自然语言模式
   */
  private generateNaturalLanguagePatterns(toolName: string): Array<{ regex: RegExp; type: string }> {
    const patterns: Array<{ regex: RegExp; type: string }> = [];
    
    if (toolName.includes('search') || toolName === 'web_search') {
      patterns.push({
        regex: /(?:search|searching|look up|find)(?:\s+for)?\s+["\']?([^"'\n]+)["\']?/gi,
        type: 'search'
      });
    }
    
    if (toolName.includes('generate') || toolName.includes('create')) {
      patterns.push({
        regex: /(?:generate|create|make|build)\s+(?:a\s+)?([^.\n]+)/gi,
        type: 'generate'
      });
    }
    
    if (toolName.includes('get') || toolName.includes('fetch')) {
      patterns.push({
        regex: /(?:get|fetch|retrieve)\s+([^.\n]+)/gi,
        type: 'get'
      });
    }
    
    return patterns;
  }

  /**
   * 从匹配中提取数据
   */
  private extractDataFromMatch(matches: RegExpMatchArray, pattern: any, tool: any): ParsedToolCall | null {
    try {
      const matchText = matches[1]?.trim();
      if (!matchText) return null;
      
      // 根据工具类型生成合适的参数
      let arguments_json = '{}';
      
      if (pattern.type === 'search') {
        arguments_json = JSON.stringify({ query: matchText });
      } else if (pattern.type === 'generate') {
        arguments_json = JSON.stringify({ task: matchText });
      } else if (pattern.type === 'get') {
        arguments_json = JSON.stringify({ resource: matchText });
      } else {
        // 通用格式
        const firstParam = Object.keys(tool.function?.parameters?.properties || {})[0];
        if (firstParam) {
          arguments_json = JSON.stringify({ [firstParam]: matchText });
        }
      }
      
      return {
        id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        type: 'function',
        function: {
          name: tool.function.name,
          arguments: arguments_json
        }
      };
    } catch (error) {
      logger.debug('Failed to extract data from natural language match', {
        matches,
        pattern,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 验证工具名称是否有效
   */
  private isValidToolName(name: string): boolean {
    if (this.originalTools.length === 0) {
      return true; // 如果没有原始工具列表，接受任何名称
    }
    
    return this.originalTools.some(tool => 
      tool.function?.name === name || 
      tool.name === name
    );
  }

  /**
   * 将参数转换为JSON格式
   */
  private convertArgsToJson(argsText: string): string {
    // 尝试解析key=value格式
    if (argsText.includes('=')) {
      const obj: Record<string, string> = {};
      const pairs = argsText.split(',');
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) {
          obj[key.replace(/['"]/g, '')] = value.replace(/['"]/g, '');
        }
      }
      
      return JSON.stringify(obj);
    }
    
    // 如果是单个值，使用第一个参数名
    const firstParam = Object.keys(this.originalTools[0]?.function?.parameters?.properties || {})[0];
    if (firstParam) {
      return JSON.stringify({ [firstParam]: argsText.replace(/['"]/g, '') });
    }
    
    return JSON.stringify({ input: argsText.replace(/['"]/g, '') });
  }

  /**
   * 记录解析失败
   */
  private async logParsingFailure(response: any, content: string, reason: string): Promise<void> {
    await toolParsingFailureLogger.logFailure(
      this.requestId,
      'lmstudio',
      'gpt-oss-20b-mlx', // 从配置中获取的默认模型
      'localhost:1234',
      response,
      {
        failureType: 'text_instead_of_tools',
        errorMessage: reason,
        expectedFormat: 'openai',
        requestTools: this.originalTools,
        parsingAttempts: ['json_format', 'function_call', 'action_format', 'natural_language']
      }
    );
  }
}

export default LMStudioToolCallParser;