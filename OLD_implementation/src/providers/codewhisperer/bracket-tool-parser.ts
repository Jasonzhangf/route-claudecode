/**
 * CodeWhisperer Bracket Tool Call Parser
 * 基于 demo3 AIClient-2-API 的 bracket 工具调用解析逻辑
 * 处理 [Called function_name with args: {...}] 格式的工具调用
 * 项目所有者: Jason Zhang
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

export interface BracketToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 查找匹配的括号位置
 */
function findMatchingBracket(text: string, startPos: number): number {
  if (!text || startPos >= text.length || text[startPos] !== '[') {
    return -1;
  }

  let bracketCount = 1;
  let inString = false;
  let escapeNext = false;

  for (let i = startPos + 1; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          return i;
        }
      }
    }
  }
  return -1;
}

/**
 * 解析单个工具调用参数
 */
function parseToolCallArgument(jsonCandidate: string, functionName: string): BracketToolCall | null {
  try {
    const parsedJson = JSON.parse(jsonCandidate);
    let argumentsObj = parsedJson;

    if (typeof argumentsObj !== 'object' || argumentsObj === null) {
      return null;
    }

    const toolCallId = `call_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
    return {
      id: toolCallId,
      type: "function",
      function: {
        name: functionName,
        arguments: JSON.stringify(argumentsObj)
      }
    };
  } catch (e) {
    logger.error(`Failed to parse tool call arguments: ${(e as Error).message}`, {
      jsonCandidate,
      functionName
    });
    return null;
  }
}

/**
 * 解析 bracket 格式的工具调用
 * 处理 [Called function_name with args: {...}] 格式
 */
export function parseBracketToolCalls(responseText: string): BracketToolCall[] {
  if (!responseText || !responseText.includes("[Called")) {
    return [];
  }

  const toolCalls: BracketToolCall[] = [];
  let searchIndex = 0;

  logger.debug('开始解析 bracket 工具调用', {
    responseLength: responseText.length,
    containsPattern: responseText.includes("[Called")
  });

  while (true) {
    const startIndex = responseText.indexOf("[Called", searchIndex);
    if (startIndex === -1) break;

    const endIndex = findMatchingBracket(responseText, startIndex);
    if (endIndex === -1) {
      logger.warn('无法找到匹配的括号', { startIndex });
      break;
    }

    const bracketContent = responseText.substring(startIndex + 1, endIndex);
    
    // 使用正则表达式匹配工具调用格式
    const match = bracketContent.match(/^Called\s+(\w+)\s+with\s+args:\s*(.+)$/);
    if (match) {
      const functionName = match[1];
      const argsString = match[2].trim();
      
      logger.debug('发现 bracket 工具调用', {
        functionName,
        argsLength: argsString.length,
        argsPreview: argsString.substring(0, 100)
      });

      const toolCall = parseToolCallArgument(argsString, functionName);
      if (toolCall) {
        toolCalls.push(toolCall);
        logger.debug('成功解析 bracket 工具调用', {
          toolId: toolCall.id,
          functionName: toolCall.function.name
        });
      }
    } else {
      logger.warn('Bracket 内容格式不匹配', {
        bracketContent: bracketContent.substring(0, 100)
      });
    }

    searchIndex = endIndex + 1;
  }

  logger.debug('Bracket 工具调用解析完成', {
    totalFound: toolCalls.length,
    toolNames: toolCalls.map(tc => tc.function.name)
  });

  return toolCalls;
}

/**
 * 去重工具调用
 */
export function deduplicateToolCalls(toolCalls: BracketToolCall[]): BracketToolCall[] {
  const seen = new Set<string>();
  const uniqueToolCalls: BracketToolCall[] = [];

  for (const tc of toolCalls) {
    const key = `${tc.function.name}-${tc.function.arguments}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueToolCalls.push(tc);
    } else {
      logger.debug('跳过重复的工具调用', {
        functionName: tc.function.name
      });
    }
  }

  return uniqueToolCalls;
}

/**
 * 清理响应文本中的工具调用语法
 */
export function cleanToolCallSyntax(responseText: string, toolCalls: BracketToolCall[]): string {
  let cleanedText = responseText;

  if (toolCalls.length > 0) {
    for (const tc of toolCalls) {
      const funcName = tc.function.name;
      const escapedName = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\[Called\\s+${escapedName}\\s+with\\s+args:\\s*\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\}\\]`, 'gs');
      cleanedText = cleanedText.replace(pattern, '');
    }
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  }

  return cleanedText;
}