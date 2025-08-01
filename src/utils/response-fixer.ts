/**
 * Response Fixer - 通用的响应修复机制
 * 在累积完整响应后执行全面修复，确保工具调用和其他结构的正确性
 */

import { logger } from './logger';

export interface ToolCallBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export type ContentBlock = ToolCallBlock | TextBlock;

export interface ResponseToFix {
  content: ContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface FixedResponse {
  content: ContentBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  fixes_applied: string[];
}

/**
 * 全面修复响应 - 处理各种常见问题
 */
export function fixResponse(response: ResponseToFix, requestId: string): FixedResponse {
  const fixes: string[] = [];
  const fixedContent: ContentBlock[] = [];
  
  logger.info('Starting comprehensive response fixing', {
    originalContentBlocks: response.content.length,
    contentTypes: response.content.map(c => c.type)
  }, requestId);

  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const fixedToolBlock = fixToolCallBlock(block, requestId);
      if (fixedToolBlock.fixes.length > 0) {
        fixes.push(...fixedToolBlock.fixes);
      }
      fixedContent.push(fixedToolBlock.block);
      
    } else if (block.type === 'text') {
      const fixedTextBlock = fixTextBlock(block, requestId);
      if (fixedTextBlock.fixes.length > 0) {
        fixes.push(...fixedTextBlock.fixes);
      }
      
      // 如果文本中发现工具调用，则拆分
      if (fixedTextBlock.extractedTools.length > 0) {
        // ⚠️ 关键修复：完全跳过包含工具调用的原始文本块，避免显示剩余内容
        // 不添加修复后的文本块，只添加提取的工具调用
        
        // 添加提取的工具调用块
        fixedContent.push(...fixedTextBlock.extractedTools);
        fixes.push(`extracted_${fixedTextBlock.extractedTools.length}_tools_from_text`);
        fixes.push('skipped_original_text_with_tool_calls');
      } else {
        fixedContent.push(fixedTextBlock.block);
      }
    } else {
      // 未知类型，直接保留
      fixedContent.push(block);
    }
  }

  // 验证修复结果
  const validation = validateFixedResponse(fixedContent, requestId);
  if (validation.issues.length > 0) {
    fixes.push(...validation.fixes);
    logger.warn('Response validation found issues after fixing', {
      issues: validation.issues,
      additionalFixes: validation.fixes
    }, requestId);
  }

  logger.info('Response fixing completed', {
    originalBlocks: response.content.length,
    fixedBlocks: fixedContent.length,
    fixesApplied: fixes,
    toolBlocks: fixedContent.filter(c => c.type === 'tool_use').length,
    textBlocks: fixedContent.filter(c => c.type === 'text').length
  }, requestId);

  return {
    content: fixedContent,
    usage: response.usage,
    fixes_applied: fixes
  };
}

/**
 * 修复工具调用块
 */
function fixToolCallBlock(block: ToolCallBlock, requestId: string): { block: ToolCallBlock; fixes: string[] } {
  const fixes: string[] = [];
  const fixedBlock: ToolCallBlock = { ...block };

  // 修复1: 空的工具输入
  if (!fixedBlock.input || (typeof fixedBlock.input === 'object' && Object.keys(fixedBlock.input).length === 0)) {
    // 尝试从ID或其他地方推断参数
    if (fixedBlock.name && typeof block.input === 'string') {
      try {
        fixedBlock.input = JSON.parse(block.input as any);
        fixes.push('parsed_string_input_to_object');
      } catch (error) {
        logger.debug('Failed to parse string input as JSON', {
          toolName: fixedBlock.name,
          input: block.input
        }, requestId);
        fixedBlock.input = {};
        fixes.push('set_empty_input_object');
      }
    } else {
      fixedBlock.input = {};
      fixes.push('ensured_input_object');
    }
  }

  // 修复2: 确保ID存在
  if (!fixedBlock.id) {
    fixedBlock.id = `fixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    fixes.push('generated_tool_id');
  }

  // 修复3: 确保名称存在
  if (!fixedBlock.name) {
    fixedBlock.name = 'UnknownTool';
    fixes.push('set_default_tool_name');
  }

  logger.debug('Tool call block fixed', {
    toolName: fixedBlock.name,
    hasInput: Object.keys(fixedBlock.input).length > 0,
    inputKeys: Object.keys(fixedBlock.input),
    fixesApplied: fixes
  }, requestId);

  return { block: fixedBlock, fixes };
}

/**
 * 修复文本块并提取嵌入的工具调用
 */
function fixTextBlock(block: TextBlock, requestId: string): { 
  block: TextBlock; 
  fixes: string[]; 
  extractedTools: ToolCallBlock[] 
} {
  const fixes: string[] = [];
  const extractedTools: ToolCallBlock[] = [];
  let fixedText = block.text || '';

  // 修复1: 提取嵌入的工具调用
  // 使用更复杂的匹配来处理嵌套的JSON对象
  const toolCallMatches = extractToolCallsWithBalancedBraces(fixedText);
  
  for (const match of toolCallMatches) {
    const toolName = match[1];
    const toolArgsStr = match[2];
    
    try {
      // CRITICAL FIX: Properly escape control characters in JSON string before parsing
      // Handle common control characters that break JSON parsing
      let sanitizedArgsStr = toolArgsStr
        .replace(/\n/g, '\\n')      // Escape newlines
        .replace(/\r/g, '\\r')      // Escape carriage returns  
        .replace(/\t/g, '\\t')      // Escape tabs
        .replace(/\f/g, '\\f')      // Escape form feeds
        .replace(/\x08/g, '\\b')    // Escape backspaces (correct pattern)
        .replace(/\v/g, '\\v')      // Escape vertical tabs
        .replace(/\0/g, '\\0')      // Escape null characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (match) => {
          // Escape any remaining control characters
          return '\\u' + ('0000' + match.charCodeAt(0).toString(16)).slice(-4);
        });
      
      logger.debug('Sanitized tool arguments for JSON parsing', {
        toolName,
        originalLength: toolArgsStr.length,
        sanitizedLength: sanitizedArgsStr.length,
        hasControlChars: toolArgsStr !== sanitizedArgsStr,
        originalPreview: toolArgsStr.slice(0, 100),
        sanitizedPreview: sanitizedArgsStr.slice(0, 100)
      }, requestId);
      
      const toolInput = JSON.parse(sanitizedArgsStr);
      const extractedTool: ToolCallBlock = {
        type: 'tool_use',
        id: `extracted_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: toolName,
        input: toolInput
      };
      
      extractedTools.push(extractedTool);
      
      // 从文本中移除这个工具调用
      fixedText = fixedText.replace(match[0], '').trim();
      fixes.push(`extracted_tool_${toolName}`);
      
      logger.info('Extracted tool call from text', {
        toolName,
        toolInput,
        originalMatch: match[0]
      }, requestId);
      
    } catch (error) {
      logger.warn('Failed to parse extracted tool arguments', {
        toolName,
        argsString: toolArgsStr,
        error: error instanceof Error ? error.message : String(error)
      }, requestId);
    }
  }

  // 修复2: 清理多余的空白和换行
  if (fixedText !== block.text) {
    fixedText = fixedText.replace(/\n{3,}/g, '\n\n').trim();
    fixes.push('cleaned_whitespace');
  }

  return {
    block: { type: 'text', text: fixedText },
    fixes,
    extractedTools
  };
}

/**
 * 验证修复后的响应
 */
function validateFixedResponse(content: ContentBlock[], requestId: string): { 
  issues: string[]; 
  fixes: string[] 
} {
  const issues: string[] = [];
  const fixes: string[] = [];

  // 验证1: 检查重复的工具ID
  const toolIds = new Set<string>();
  const duplicateIds: string[] = [];
  
  content.forEach(block => {
    if (block.type === 'tool_use') {
      if (toolIds.has(block.id)) {
        duplicateIds.push(block.id);
      } else {
        toolIds.add(block.id);
      }
    }
  });

  if (duplicateIds.length > 0) {
    issues.push(`duplicate_tool_ids: ${duplicateIds.join(', ')}`);
    fixes.push('detected_duplicate_tool_ids');
  }

  // 验证2: 检查空的工具输入
  const emptyToolInputs = content.filter(block => 
    block.type === 'tool_use' && 
    (!block.input || Object.keys(block.input).length === 0)
  ).length;

  if (emptyToolInputs > 0) {
    issues.push(`empty_tool_inputs: ${emptyToolInputs} tools`);
    fixes.push('detected_empty_tool_inputs');
  }

  // 验证3: 检查空的文本块
  const emptyTextBlocks = content.filter(block => 
    block.type === 'text' && 
    (!block.text || block.text.trim().length === 0)
  ).length;

  if (emptyTextBlocks > 0) {
    fixes.push('detected_empty_text_blocks');
  }

  return { issues, fixes };
}

/**
 * 使用平衡括号匹配提取工具调用
 * 正确处理嵌套的JSON对象
 */
function extractToolCallsWithBalancedBraces(text: string): Array<[string, string, string]> {
  const matches: Array<[string, string, string]> = [];
  const toolCallRegex = /Tool call:\s*(\w+)\s*\(/g;
  
  let match;
  while ((match = toolCallRegex.exec(text)) !== null) {
    const toolName = match[1];
    const startPos = match.index;
    const openParenPos = match.index + match[0].length - 1; // Position of the opening '('
    
    // Find the matching closing parenthesis using bracket counting
    let braceCount = 0;
    let currentPos = openParenPos + 1; // Start after the opening '('
    let jsonStart = -1;
    let jsonEnd = -1;
    
    // Skip whitespace to find the opening brace
    while (currentPos < text.length && /\s/.test(text[currentPos])) {
      currentPos++;
    }
    
    if (currentPos >= text.length || text[currentPos] !== '{') {
      continue; // No JSON object found
    }
    
    jsonStart = currentPos;
    braceCount = 1; // We found the opening brace
    currentPos++;
    
    // Find the matching closing brace
    while (currentPos < text.length && braceCount > 0) {
      const char = text[currentPos];
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      } else if (char === '"') {
        // Skip string content to avoid counting braces inside strings
        currentPos++; // Move past the opening quote
        while (currentPos < text.length) {
          if (text[currentPos] === '"' && text[currentPos - 1] !== '\\') {
            break; // Found closing quote (not escaped)
          }
          currentPos++;
        }
      }
      currentPos++;
    }
    
    if (braceCount === 0) {
      jsonEnd = currentPos - 1; // Position of the closing brace
      
      // Find the closing parenthesis
      let parenPos = jsonEnd + 1;
      while (parenPos < text.length && /\s/.test(text[parenPos])) {
        parenPos++;
      }
      
      if (parenPos < text.length && text[parenPos] === ')') {
        const fullMatch = text.substring(startPos, parenPos + 1);
        const jsonString = text.substring(jsonStart, jsonEnd + 1);
        matches.push([fullMatch, toolName, jsonString]);
      }
    }
  }
  
  return matches;
}

/**
 * 简化版修复 - 只处理最关键的问题
 */
export function quickFixResponse(response: ResponseToFix, requestId: string): FixedResponse {
  const fixes: string[] = [];
  const fixedContent = response.content.map(block => {
    if (block.type === 'tool_use') {
      const fixedBlock = { ...block };
      
      // 只修复空的输入对象
      if (!fixedBlock.input || Object.keys(fixedBlock.input).length === 0) {
        fixedBlock.input = {};
        fixes.push('ensured_tool_input_object');
      }
      
      return fixedBlock;
    }
    return block;
  });

  return {
    content: fixedContent,
    usage: response.usage,
    fixes_applied: fixes
  };
}