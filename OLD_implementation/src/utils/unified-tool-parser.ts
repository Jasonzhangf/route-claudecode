/**
 * 统一工具调用解析模块
 * 为流式和非流式响应提供一致的工具调用解析和ID标准化
 * 
 * 设计目标:
 * 1. 统一工具ID格式 (toolu_前缀)
 * 2. 统一参数解析逻辑
 * 3. 统一错误处理
 * 4. 消除流式/非流式差异
 */

import { logger } from './logger';

export interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments?: string;
  input?: any;
  index?: number;
}

/**
 * 统一工具ID格式标准化
 */
export function standardizeToolId(originalId?: string): string {
  if (!originalId) {
    return generateTooluId();
  }

  // 如果已经是正确的toolu_格式，直接返回
  if (originalId.startsWith('toolu_')) {
    return originalId;
  }

  // 如果是其他格式(call_, tool_等)，生成新的toolu_格式ID
  logger.debug('Standardizing tool ID format', {
    originalId,
    action: 'id_format_standardization'
  });
  
  return generateTooluId();
}

/**
 * 生成标准的toolu_格式ID
 */
export function generateTooluId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 8);
  return `toolu_${timestamp}_${random}`;
}

/**
 * 统一工具调用解析器 - 处理OpenAI SDK格式，增强容错性
 */
export function parseOpenAIToolCalls(toolCalls: any[]): ToolCall[] {
  if (!Array.isArray(toolCalls)) {
    if (toolCalls === null || toolCalls === undefined) {
      return [];
    }
    // 尝试将单个工具调用转换为数组
    toolCalls = [toolCalls];
  }
  
  if (toolCalls.length === 0) {
    return [];
  }

  const results = toolCalls.map((toolCall, index) => {
    // 增强容错：处理各种可能的工具调用格式
    if (!toolCall || typeof toolCall !== 'object') {
      logger.warn('Invalid tool call object', { toolCall, index });
      return null;
    }

    const standardId = standardizeToolId(toolCall.id);
    
    // 多种名称获取方式
    const toolName = toolCall.function?.name || 
                     toolCall.name || 
                     toolCall.tool_name ||
                     `tool_${index}`;
    
    let parsedInput = {};
    
    // 处理不同格式的参数 - 增强容错性
    if (toolCall.function?.arguments) {
      // OpenAI SDK格式: function.arguments
      const args = toolCall.function.arguments;
      if (typeof args === 'string') {
        try {
          parsedInput = JSON.parse(args);
        } catch (e) {
          logger.debug('Failed to parse JSON arguments, trying fallback', {
            toolName,
            arguments: args,
            error: e instanceof Error ? e.message : String(e)
          });
          
          // 尝试修复常见的JSON问题
          try {
            const fixedArgs = args.replace(/'/g, '"').replace(/([{,]\s*)(\w+):/g, '$1"$2":');
            parsedInput = JSON.parse(fixedArgs);
            logger.debug('Successfully fixed and parsed arguments', { toolName });
          } catch (e2) {
            // 最后的降级处理：尝试提取键值对
            parsedInput = extractKeyValuePairs(args) || {};
            if (Object.keys(parsedInput).length === 0) {
              // 完全无法解析，作为单个字符串参数
              parsedInput = { content: args };
            }
          }
        }
      } else if (typeof args === 'object' && args !== null) {
        parsedInput = args;
      }
    } else if (toolCall.input) {
      // 直接input格式
      if (typeof toolCall.input === 'object' && toolCall.input !== null) {
        parsedInput = toolCall.input;
      } else if (typeof toolCall.input === 'string') {
        try {
          parsedInput = JSON.parse(toolCall.input);
        } catch (e) {
          parsedInput = { content: toolCall.input };
        }
      }
    } else if (toolCall.arguments) {
      // 直接arguments格式
      if (typeof toolCall.arguments === 'string') {
        try {
          parsedInput = JSON.parse(toolCall.arguments);
        } catch (e) {
          parsedInput = extractKeyValuePairs(toolCall.arguments) || { content: toolCall.arguments };
        }
      } else if (typeof toolCall.arguments === 'object' && toolCall.arguments !== null) {
        parsedInput = toolCall.arguments;
      }
    } else if (toolCall.parameters) {
      // parameters格式（某些API可能使用）
      parsedInput = typeof toolCall.parameters === 'object' ? toolCall.parameters : {};
    }

    const result: ToolCall = {
      type: 'tool_use',
      id: standardId,
      name: toolName,
      input: parsedInput
    };

    logger.debug('Parsed tool call with enhanced fallback', {
      originalId: toolCall.id,
      standardizedId: standardId,
      toolName,
      hasInput: Object.keys(parsedInput).length > 0,
      inputKeys: Object.keys(parsedInput),
      fallbackUsed: toolCall.function?.arguments && 'content' in parsedInput
    });

    return result;
  });

  // 过滤掉null值并返回
  return results.filter((result): result is ToolCall => result !== null);
}

/**
 * 提取键值对的降级解析方法
 */
function extractKeyValuePairs(str: string): Record<string, any> | null {
  if (!str || typeof str !== 'string') return null;
  
  try {
    const pairs: Record<string, any> = {};
    
    // 尝试匹配 key: value 模式
    const keyValuePattern = /["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = keyValuePattern.exec(str)) !== null) {
      const [, key, value] = match;
      pairs[key] = value;
    }
    
    if (Object.keys(pairs).length > 0) {
      return pairs;
    }
    
    // 尝试提取路径参数 (常见场景)
    const pathMatch = str.match(/["']?([^"'\s]+\.[^"'\s]+)["']?/);
    if (pathMatch) {
      return { path: pathMatch[1] };
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 统一流式工具调用处理器
 */
export class StreamingToolCallParser {
  private toolCalls: Map<number, ParsedToolCall> = new Map();
  private argumentBuffers: Map<number, string> = new Map();

  /**
   * 处理工具调用开始事件
   */
  handleToolCallStart(index: number, toolCall: any): ToolCall | null {
    const standardId = standardizeToolId(toolCall.id);
    const toolName = toolCall.function?.name || toolCall.name;
    
    if (!toolName) {
      logger.warn('Tool call missing name', { index, toolCall });
      return null;
    }

    const parsedCall: ParsedToolCall = {
      id: standardId,
      name: toolName,
      index,
      input: {}
    };

    this.toolCalls.set(index, parsedCall);
    this.argumentBuffers.set(index, ''); // 初始化参数缓冲区

    logger.debug('Started streaming tool call', {
      index,
      toolName,
      standardizedId: standardId,
      originalId: toolCall.id
    });

    return {
      type: 'tool_use',
      id: standardId,
      name: toolName,
      input: {} // 流式开始时为空，通过delta更新
    };
  }

  /**
   * 处理工具参数增量
   */
  handleToolArgumentsDelta(index: number, argumentsDelta: string): void {
    const currentBuffer = this.argumentBuffers.get(index) || '';
    const newBuffer = currentBuffer + argumentsDelta;
    this.argumentBuffers.set(index, newBuffer);

    logger.debug('Received tool arguments delta', {
      index,
      deltaLength: argumentsDelta.length,
      totalLength: newBuffer.length,
      delta: argumentsDelta
    });
  }

  /**
   * 完成工具调用解析并返回最终结果
   */
  finalizeToolCalls(): ToolCall[] {
    const results: ToolCall[] = [];

    for (const [index, toolCall] of this.toolCalls.entries()) {
      const argumentsBuffer = this.argumentBuffers.get(index) || '';
      
      let parsedInput = {};
      if (argumentsBuffer.trim()) {
        try {
          parsedInput = JSON.parse(argumentsBuffer);
          logger.debug('Successfully parsed streaming tool arguments', {
            index,
            toolName: toolCall.name,
            argumentsLength: argumentsBuffer.length,
            parsedKeys: Object.keys(parsedInput)
          });
        } catch (e) {
          logger.warn('Failed to parse streaming tool arguments', {
            index,
            toolName: toolCall.name,
            argumentsBuffer,
            error: e instanceof Error ? e.message : String(e)
          });
          parsedInput = {};
        }
      }

      results.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: parsedInput
      });
    }

    // 清理状态
    this.toolCalls.clear();
    this.argumentBuffers.clear();

    logger.debug('Finalized streaming tool calls', {
      count: results.length,
      tools: results.map(t => ({ id: t.id, name: t.name, hasInput: Object.keys(t.input).length > 0 }))
    });

    return results;
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.toolCalls.clear();
    this.argumentBuffers.clear();
  }
}

/**
 * 验证工具调用完整性 - 优化为更宽松的验证
 */
export function validateToolCall(toolCall: ToolCall): boolean {
  // 宽松的ID验证 - 只要有ID即可，格式在其他地方标准化
  if (!toolCall.id || typeof toolCall.id !== 'string' || toolCall.id.trim() === '') {
    logger.debug('Tool call missing or invalid ID, will generate new one', { 
      id: toolCall.id,
      name: toolCall.name 
    });
    // 不拒绝，而是允许后续修复
  }

  // 必须有工具名称
  if (!toolCall.name || typeof toolCall.name !== 'string' || toolCall.name.trim() === '') {
    logger.warn('Tool call missing valid name', { toolCall });
    return false;
  }

  // 宽松的输入验证 - 允许各种格式
  if (toolCall.input !== undefined && toolCall.input !== null) {
    if (typeof toolCall.input !== 'object') {
      logger.debug('Tool call input is not object, will attempt conversion', { 
        name: toolCall.name,
        inputType: typeof toolCall.input 
      });
      // 允许通过，在使用时进行转换
    }
  }

  return true;
}

/**
 * 工具调用转换为Anthropic格式
 */
export function convertToAnthropicToolCall(toolCall: ToolCall): any {
  return {
    type: 'tool_use',
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.input || {}
  };
}

/**
 * 从文本内容中提取工具调用 (fallback方法)
 */
export function extractToolCallsFromText(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // 匹配工具调用模式
  const toolCallPattern = /<tool_use>\s*<name>([^<]+)<\/name>\s*<parameters>([^<]*)<\/parameters>\s*<\/tool_use>/g;
  let match;

  while ((match = toolCallPattern.exec(content)) !== null) {
    const [, name, parametersStr] = match;
    
    let parameters = {};
    if (parametersStr.trim()) {
      try {
        parameters = JSON.parse(parametersStr);
      } catch (e) {
        logger.warn('Failed to parse tool parameters from text', {
          name,
          parametersStr,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    toolCalls.push({
      type: 'tool_use',
      id: generateTooluId(),
      name: name.trim(),
      input: parameters
    });
  }

  if (toolCalls.length > 0) {
    logger.debug('Extracted tool calls from text content', {
      count: toolCalls.length,
      tools: toolCalls.map(t => ({ name: t.name, hasInput: Object.keys(t.input).length > 0 }))
    });
  }

  return toolCalls;
}