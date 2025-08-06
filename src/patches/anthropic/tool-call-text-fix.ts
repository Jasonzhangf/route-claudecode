/**
 * Anthropic Tool Call 文本解析修复补丁
 * 修复 tool call 被错误解析为文本内容的问题
 */

import { ResponsePatch, PatchContext, PatchResult, Provider } from '../types';

export class AnthropicToolCallTextFixPatch implements ResponsePatch {
  name = 'anthropic-tool-call-text-fix';
  description = 'Fix tool calls being parsed as text content in Anthropic responses';
  type = 'response' as const;
  priority = 10;
  
  condition = {
    provider: ['anthropic', 'openai'] as Provider[],
    model: (model: string) => {
      // 支持Claude模型和返回Anthropic格式的OpenAI兼容模型
      const modelLower = model.toLowerCase();
      return modelLower.includes('claude') || 
             modelLower.includes('glm') || 
             modelLower.includes('zhipu') ||
             modelLower.includes('qwen') ||  // 添加qwen模型支持
             modelLower.includes('deepseek') || // 添加deepseek模型支持
             modelLower.includes('gemini') ||   // 添加gemini模型支持
             modelLower.includes('claude-4-sonnet'); // 保留旧的ShuaiHong服务模型名
    },
    enabled: () => process.env.RCC_PATCHES_ANTHROPIC_TOOL_CALL_FIX !== 'false'
  };

  shouldApply(context: PatchContext, data: any): boolean {
    // 对所有OpenAI兼容输入都执行监测，避免准入条件太严格
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 🎯 宽松准入策略：只要有文本内容就检测，不要求缺少tool_use
    // 这确保滑动窗口检测覆盖所有可能的样本
    const hasTextContent = this.hasTextContentWithToolCall(data);
    
    // 即使已经有tool_use块，也可能需要从文本中提取更多工具调用
    // 因为某些模型可能混合返回格式
    return hasTextContent;
  }

  async apply(context: PatchContext, data: any): Promise<PatchResult> {
    const startTime = Date.now();
    
    try {
      const fixedData = this.fixToolCallInText(data);
      
      return {
        success: true,
        data: fixedData,
        applied: true,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: {
          originalContentBlocks: data.content?.length || 0,
          fixedContentBlocks: fixedData.content?.length || 0,
          toolCallsExtracted: this.countToolCalls(fixedData)
        }
      };
    } catch (error) {
      return {
        success: false,
        data,
        applied: false,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }

  /**
   * 检查文本内容中是否包含 tool call 结构
   */
  private hasTextContentWithToolCall(data: any): boolean {
    if (!data.content || !Array.isArray(data.content)) {
      return false;
    }

    return data.content.some((block: any) => {
      if (block.type !== 'text' || !block.text) {
        return false;
      }

      // 检查是否包含 tool call 的 JSON 结构
      const toolCallPatterns = [
        /\{\s*"type"\s*:\s*"tool_use"\s*,/i,
        /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i,
        /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i,
        // 增强模式：匹配 "Tool call: FunctionName({...})" 格式
        /Tool\s+call:\s*\w+\s*\(\s*\{[^}]*"[^"]*":[^}]*\}/i,
        // 匹配直接的工具调用格式："Edit({"file_path": ..."
        /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i
      ];

      return toolCallPatterns.some(pattern => pattern.test(block.text));
    });
  }

  /**
   * 检查是否已经有正确的 tool_use 块
   */
  private hasProperToolUse(data: any): boolean {
    if (!data.content || !Array.isArray(data.content)) {
      return false;
    }

    return data.content.some((block: any) => block.type === 'tool_use');
  }

  /**
   * 修复文本中的 tool call
   */
  private fixToolCallInText(data: any): any {
    if (!data.content || !Array.isArray(data.content)) {
      return data;
    }

    const fixedContent: any[] = [];
    
    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        const { textParts, toolCalls } = this.extractToolCallsFromText(block.text);
        
        // 添加清理后的文本（如果有）
        if (textParts.length > 0) {
          const cleanText = textParts.join('\n').trim();
          if (cleanText) {
            fixedContent.push({
              type: 'text',
              text: cleanText
            });
          }
        }
        
        // 添加提取的 tool calls
        fixedContent.push(...toolCalls);
      } else {
        // 保持其他类型的块不变
        fixedContent.push(block);
      }
    }

    return {
      ...data,
      content: fixedContent
    };
  }

  /**
   * 从文本中提取 tool calls
   */
  private extractToolCallsFromText(text: string): { textParts: string[], toolCalls: any[] } {
    const textParts: string[] = [];
    const toolCalls: any[] = [];
    
    // 处理GLM-4.5特有的 "Tool call: FunctionName({...})" 格式
    // 使用更精确的方法来提取完整的JSON对象
    const toolCallPattern = /Tool\s+call:\s*(\w+)\s*\(/gi;
    let match;
    let processedRanges: Array<{start: number, end: number}> = [];
    
    while ((match = toolCallPattern.exec(text)) !== null) {
      const toolName = match[1];
      const openParenIndex = match.index + match[0].length - 1; // 获取开括号位置
      
      // 从开括号后查找JSON对象
      let braceCount = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      let inString = false;
      let escaped = false;
      
      for (let i = openParenIndex + 1; i < text.length; i++) {
        const char = text[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            if (jsonStart === -1) {
              jsonStart = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && jsonStart !== -1) {
              jsonEnd = i + 1;
              break;
            }
          } else if (char === ')' && braceCount === 0 && jsonStart !== -1) {
            // 找到闭括号，结束搜索
            break;
          }
        }
      }
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = text.slice(jsonStart, jsonEnd);
        
        try {
          const args = JSON.parse(jsonStr);
          const toolCall = {
            type: 'tool_use',
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            name: toolName,
            input: args
          };
          toolCalls.push(toolCall);
          
          // 记录已处理的范围（从Tool call开始到闭括号结束）
          let endIndex = jsonEnd;
          while (endIndex < text.length && text[endIndex] !== ')') {
            endIndex++;
          }
          if (endIndex < text.length) {
            endIndex++; // 包含闭括号
          }
          
          processedRanges.push({
            start: match.index,
            end: endIndex
          });
          
          console.log('✅ GLM-4.5 Tool call extracted:', { name: toolName, inputKeys: Object.keys(args) });
        } catch (error) {
          console.warn('❌ Failed to parse GLM-4.5 tool call JSON:', jsonStr.substring(0, 100) + '...');
        }
      }
    }
    
    // 提取未被处理的文本部分
    let lastEnd = 0;
    processedRanges.sort((a, b) => a.start - b.start);
    
    for (const range of processedRanges) {
      const beforeText = text.slice(lastEnd, range.start).trim();
      if (beforeText) {
        textParts.push(beforeText);
      }
      lastEnd = range.end;
    }
    
    // 添加最后剩余的文本
    const remainingText = text.slice(lastEnd).trim();
    if (remainingText) {
      textParts.push(remainingText);
    }
    
    // 如果找到了Tool call格式，直接返回结果
    if (toolCalls.length > 0) {
      return { textParts, toolCalls };
    }
    
    // 使用更智能的方法来查找JSON对象
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      // 查找 "type": "tool_use" 的位置
      const toolUseIndex = text.indexOf('"type": "tool_use"', currentIndex);
      if (toolUseIndex === -1) {
        // 没有更多的tool_use，添加剩余文本
        const remainingText = text.slice(currentIndex).trim();
        if (remainingText) {
          textParts.push(remainingText);
        }
        break;
      }

      // 添加tool_use之前的文本
      if (toolUseIndex > currentIndex) {
        const beforeText = text.slice(currentIndex, toolUseIndex).trim();
        if (beforeText && !beforeText.endsWith('{')) {
          textParts.push(beforeText);
        }
      }

      // 向前查找JSON对象的开始
      let jsonStart = toolUseIndex;
      while (jsonStart > 0 && text[jsonStart] !== '{') {
        jsonStart--;
      }

      // 向后查找JSON对象的结束
      let braceCount = 0;
      let jsonEnd = jsonStart;
      let inString = false;
      let escaped = false;

      for (let i = jsonStart; i < text.length; i++) {
        const char = text[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
      }

      // 提取JSON字符串并尝试解析
      const jsonStr = text.slice(jsonStart, jsonEnd);
      
      try {
        const toolCallJson = JSON.parse(jsonStr);
        if (this.isValidToolCall(toolCallJson)) {
          toolCalls.push({
            type: 'tool_use',
            id: toolCallJson.id,
            name: toolCallJson.name,
            input: toolCallJson.input
          });
          
          // console.log('✅ Extracted tool call:', { id: toolCallJson.id, name: toolCallJson.name });
        } else {
          // 不是有效的 tool call，作为文本处理
          textParts.push(jsonStr);
        }
      } catch (error) {
        // console.log('❌ JSON parse failed for:', jsonStr.substring(0, 100) + '...');
        // 如果解析失败，将其作为普通文本处理
        textParts.push(jsonStr);
      }

      currentIndex = jsonEnd;
    }

    // console.log('📊 Extraction result:', { textParts: textParts.length, toolCalls: toolCalls.length });

    return { textParts, toolCalls };
  }

  /**
   * 验证是否是有效的 tool call
   */
  private isValidToolCall(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'tool_use' &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      obj.input !== undefined
    );
  }

  /**
   * 计算 tool calls 数量
   */
  private countToolCalls(data: any): number {
    if (!data.content || !Array.isArray(data.content)) {
      return 0;
    }

    return data.content.filter((block: any) => block.type === 'tool_use').length;
  }
}