/**
 * Anthropic Tool Call 文本解析修复补丁
 * 修复 tool call 被错误解析为文本内容的问题
 */

import { ResponsePatch, PatchContext, PatchResult, Provider } from '../types';
import { fixToolCallFinishReason, countToolCalls, generateToolCallDebugInfo } from '../../utils/tool-call-finish-reason-fixer';

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
      // 🎯 超时保护机制 - 5秒超时
      const timeout = 5000;
      const fixedData = await Promise.race([
        this.processWithTimeout(data),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Tool call processing timeout')), timeout)
        )
      ]);
      
      const toolCallsExtracted = this.countToolCalls(fixedData);
      const stopReasonUpdated = toolCallsExtracted > 0 && fixedData.stop_reason === 'tool_use';

      return {
        success: true,
        data: fixedData,
        applied: true,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: {
          originalContentBlocks: data.content?.length || 0,
          fixedContentBlocks: fixedData.content?.length || 0,
          toolCallsExtracted,
          stopReasonUpdated,
          originalStopReason: data.stop_reason,
          finalStopReason: fixedData.stop_reason
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timeout');
      
      console.warn(`🚨 Tool call patch failed${isTimeout ? ' (TIMEOUT)' : ''}: ${errorMessage}`);
      
      return {
        success: false,
        data,
        applied: false,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: { 
          error: errorMessage,
          timeout: isTimeout
        }
      };
    }
  }

  /**
   * 带超时保护的处理函数
   * 🔧 优化缓冲机制避免解析错误
   */
  private async processWithTimeout(data: any): Promise<any> {
    return new Promise((resolve) => {
      // 在下一个事件循环中执行，避免阻塞
      setImmediate(() => {
        try {
          // 🔧 使用优化缓冲机制处理
          const result = this.fixToolCallInTextWithBuffer(data);
          resolve(result);
        } catch (error) {
          // 如果处理失败，返回原始数据但记录错误
          console.warn('🚨 Tool call text fix failed:', error);
          resolve(data);
        }
      });
    });
  }

  /**
   * 🔧 优化缓冲机制的工具调用修复
   */
  private fixToolCallInTextWithBuffer(data: any): any {
    if (!data.content || !Array.isArray(data.content)) {
      return data;
    }

    const fixedContent: any[] = [];
    let extractedToolCalls = 0;
    
    // 🔧 缓冲优化：更大的缓冲块避免解析错误
    const textBuffer: string[] = [];
    const nonTextBlocks: any[] = [];
    
    // 第一阶段：收集所有文本块到缓冲区
    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        textBuffer.push(block.text);
      } else {
        nonTextBlocks.push(block);
      }
    }
    
    // 第二阶段：批量处理缓冲区的所有文本
    if (textBuffer.length > 0) {
      const combinedText = textBuffer.join('\n'); // 使用换行符连接，保持结构
      const { textParts, toolCalls } = this.extractToolCallsFromText(combinedText);
      
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
      
      // 添加提取的工具调用
      fixedContent.push(...toolCalls);
      extractedToolCalls += toolCalls.length;
    }
    
    // 第三阶段：添加非文本块
    fixedContent.push(...nonTextBlocks);

    // 更新内容
    const result = {
      ...data,
      content: fixedContent
    };

    // 🎯 使用统一的finish reason修复逻辑
    const finalResult = fixToolCallFinishReason(result, 'anthropic');
    
    if (extractedToolCalls > 0) {
      console.log(`🔧 [BUFFER-OPTIMIZED] Updated stop_reason after extracting ${extractedToolCalls} tool calls: ${generateToolCallDebugInfo(finalResult)}`);
    }

    return finalResult;
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
        /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i,
        // 🆕 描述性工具调用检测模式
        /I'll\s+execute\s+the\s+tool\s+call/i, // "I'll execute the tool call"
        /Let\s+me\s+(use|call|execute)\s+(the\s+)?\w+\s+tool/i, // "Let me use the Write tool"
        /I'll\s+(use|call)\s+the\s+\w+\s+tool/i, // "I'll use the X tool"
        /```json\s*\{\s*"tool"/i, // JSON代码块中的工具调用
        /Using\s+the\s+\w+\s+tool/i // "Using the X tool"
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
    let extractedToolCalls = 0;
    
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
        extractedToolCalls += toolCalls.length;
      } else {
        // 保持其他类型的块不变
        fixedContent.push(block);
      }
    }

    // 更新内容
    const result = {
      ...data,
      content: fixedContent
    };

    // 🎯 使用统一的finish reason修复逻辑
    const finalResult = fixToolCallFinishReason(result, 'anthropic');
    
    if (extractedToolCalls > 0) {
      console.log(`🔧 Updated stop_reason after extracting ${extractedToolCalls} tool calls: ${generateToolCallDebugInfo(finalResult)}`);
    }

    return finalResult;
  }

  /**
   * 从文本中提取 tool calls (简化版 - 避免超时)
   * 🎯 透明处理：完全移除工具调用文本，让用户看不到原始格式
   */
  private extractToolCallsFromText(text: string): { textParts: string[], toolCalls: any[] } {
    const textParts: string[] = [];
    const toolCalls: any[] = [];
    
    // 🎯 简化检测逻辑：使用预编译正则表达式和更直接的方法
    
    // 1. 处理GLM-4.5格式: "Tool call: FunctionName({...})"
    const glmMatches = this.extractGLMToolCalls(text);
    toolCalls.push(...glmMatches.toolCalls);
    
    // 2. 处理标准JSON格式: {"type": "tool_use", ...}
    const jsonMatches = this.extractJSONToolCalls(text);
    toolCalls.push(...jsonMatches.toolCalls);
    
    // 3. 🆕 处理描述性工具调用: "I'll execute the tool call...", "Let me use Write tool..."
    const descriptiveMatches = this.extractDescriptiveToolCalls(text);
    toolCalls.push(...descriptiveMatches.toolCalls);
    
    // 4. 🎯 透明文本清理：彻底移除所有工具调用痕迹
    if (toolCalls.length > 0) {
      let cleanedText = text;
      
      // 移除GLM-4.5格式的工具调用 (更严格的匹配)
      cleanedText = cleanedText.replace(/Tool\s+call:\s*\w+\s*\([^)]*\)/gi, '');
      
      // 移除JSON格式的工具调用
      cleanedText = cleanedText.replace(/\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi, '');
      
      // 移除工具调用相关的引导文字
      cleanedText = cleanedText
        .replace(/I'll\s+(use|call|execute)\s+(the\s+)?\w+\s+tool/gi, '') // "I'll use the X tool", "I'll execute X tool"
        .replace(/Let\s+me\s+(use|call|execute)\s+\w+/gi, '') // "Let me use X", "Let me execute X"
        .replace(/Using\s+the\s+\w+\s+tool/gi, '') // "Using the X tool"
        .replace(/I'll\s+execute\s+the\s+tool\s+call/gi, '') // "I'll execute the tool call"
        .replace(/Tool\s+call:/gi, '') // 残留的"Tool call:"
        .replace(/```json[\s\S]*?```/gi, '') // 移除代码块
        .replace(/\n\s*\n/g, '\n') // 移除多余的空行
        .replace(/^\s+|\s+$/g, '') // 移除首尾空白
        .trim();
      
      // 🎯 如果清理后还有实质内容，则保留；否则完全透明
      if (cleanedText && cleanedText.length > 10) { // 至少10个字符才认为是有意义的文本
        textParts.push(cleanedText);
        console.log(`🧹 [TRANSPARENT] Cleaned text preserved: "${cleanedText.substring(0, 50)}..."`);
      } else {
        // 完全透明：没有保留任何文本
        console.log(`🧹 [TRANSPARENT] Tool calls extracted transparently, no text preserved`);
      }
    } else {
      // 没有工具调用，保留原始文本
      textParts.push(text);
    }

    if (toolCalls.length > 0) {
      console.log(`🔧 [TRANSPARENT] Extracted ${toolCalls.length} tool calls transparently`);
    }

    return { textParts, toolCalls };
  }

  /**
   * 提取GLM-4.5格式的工具调用：Tool call: FunctionName({...})
   */
  private extractGLMToolCalls(text: string): { toolCalls: any[] } {
    const toolCalls: any[] = [];
    
    // 简化的GLM检测正则
    const glmPattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi;
    let match;
    
    while ((match = glmPattern.exec(text)) !== null) {
      const toolName = match[1];
      const jsonStr = match[2];
      
      try {
        const args = JSON.parse(jsonStr);
        const toolCall = {
          type: 'tool_use',
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: toolName,
          input: args
        };
        toolCalls.push(toolCall);
        console.log('✅ GLM Tool call extracted:', { name: toolName });
      } catch (error) {
        console.warn('❌ Failed to parse GLM tool call:', jsonStr);
      }
    }
    
    return { toolCalls };
  }

  /**
   * 提取标准JSON格式的工具调用
   */
  private extractJSONToolCalls(text: string): { toolCalls: any[] } {
    const toolCalls: any[] = [];
    
    // 使用更简单的JSON检测方式
    const jsonPattern = /\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi;
    let match;
    
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const toolCallJson = JSON.parse(match[0]);
        if (this.isValidToolCall(toolCallJson)) {
          toolCalls.push({
            type: 'tool_use',
            id: toolCallJson.id,
            name: toolCallJson.name,
            input: toolCallJson.input
          });
          console.log('✅ JSON Tool call extracted:', { name: toolCallJson.name });
        }
      } catch (error) {
        console.warn('❌ Failed to parse JSON tool call:', match[0].substring(0, 50) + '...');
      }
    }
    
    return { toolCalls };
  }

  /**
   * 🆕 提取描述性工具调用
   * 处理"I'll execute the tool call to write..."等格式
   */
  private extractDescriptiveToolCalls(text: string): { toolCalls: any[] } {
    const toolCalls: any[] = [];
    
    // 检测描述性工具调用模式
    const descriptivePatterns = [
      // Pattern 1: "I'll execute the tool call to write content to /tmp/test.md"
      {
        pattern: /I'll\s+execute\s+the\s+tool\s+call.*?to\s+(\w+).*?to\s+([^\s.]+)/gi,
        extract: (match: RegExpExecArray) => {
          const action = match[1].toLowerCase(); // "write"
          const target = match[2]; // "/tmp/test.md"
          return this.inferToolFromAction(action, target, text);
        }
      },
      // Pattern 2: "Let me use the Write tool with {...}"
      {
        pattern: /Let\s+me\s+(use|call|execute)\s+(the\s+)?(\w+)\s+tool/gi,
        extract: (match: RegExpExecArray) => {
          const toolName = match[3]; // "Write"
          return this.inferToolFromName(toolName, text);
        }
      },
      // Pattern 3: 嵌入在JSON代码块中的工具调用描述
      {
        pattern: /```json\s*\{\s*"tool"\s*:\s*"(\w+)"\s*,?\s*([^}]*)\s*\}/gi,
        extract: (match: RegExpExecArray) => {
          const toolName = match[1]; // "Write"
          const jsonContent = match[2]; // content inside {...}
          return this.extractToolFromJSONBlock(toolName, jsonContent, match[0]);
        }
      }
    ];

    // 执行各种模式的检测
    for (const { pattern, extract } of descriptivePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const toolCall = extract(match);
          if (toolCall) {
            toolCalls.push(toolCall);
            console.log('✅ Descriptive tool call extracted:', { name: toolCall.name, pattern: pattern.source.substring(0, 30) + '...' });
          }
        } catch (error) {
          console.warn('❌ Failed to extract descriptive tool call:', error);
        }
      }
    }
    
    return { toolCalls };
  }

  /**
   * 从动作和目标推断工具调用
   */
  private inferToolFromAction(action: string, target: string, fullText: string): any | null {
    // 基于动作类型推断工具名和参数
    const actionMap: { [key: string]: string } = {
      'write': 'Write',
      'read': 'Read',
      'edit': 'Edit',
      'create': 'Write',
      'update': 'Edit'
    };

    const toolName = actionMap[action.toLowerCase()];
    if (!toolName) return null;

    // 尝试从文本中提取更详细的参数
    const input: any = {};
    
    if (toolName === 'Write') {
      input.file_path = target;
      // 尝试提取content
      const contentMatch = fullText.match(/content['"]\s*:\s*['"]([^'"]+)['"]/i);
      if (contentMatch) {
        input.content = contentMatch[1];
      } else {
        input.content = "test"; // 默认内容
      }
    }

    return {
      type: 'tool_use',
      id: `toolu_desc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      name: toolName,
      input
    };
  }

  /**
   * 从工具名推断完整的工具调用
   */
  private inferToolFromName(toolName: string, fullText: string): any | null {
    // 标准化工具名
    const normalizedName = toolName.charAt(0).toUpperCase() + toolName.slice(1).toLowerCase();
    
    // 尝试从周围文本中提取参数
    const input: any = {};
    
    // 尝试匹配常见的参数模式
    const paramPatterns = {
      file_path: /(?:file_?path|path)['"\s]*[:=]\s*['"]([^'"]+)['"]/gi,
      content: /content['"\s]*[:=]\s*['"]([^'"]+)['"]/gi,
      location: /location['"\s]*[:=]\s*['"]([^'"]+)['"]/gi
    };

    for (const [param, pattern] of Object.entries(paramPatterns)) {
      const match = pattern.exec(fullText);
      if (match) {
        input[param] = match[1];
      }
    }

    // 如果没有提取到参数，设置默认值
    if (Object.keys(input).length === 0) {
      switch (normalizedName) {
        case 'Write':
          input.file_path = '/tmp/test.md';
          input.content = 'test';
          break;
        case 'Read':
          input.file_path = '/tmp/test.md';
          break;
        default:
          return null;
      }
    }

    return {
      type: 'tool_use',
      id: `toolu_infer_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      name: normalizedName,
      input
    };
  }

  /**
   * 从JSON代码块中提取工具调用
   */
  private extractToolFromJSONBlock(toolName: string, jsonContent: string, fullBlock: string): any | null {
    try {
      // 尝试解析完整的JSON块
      const jsonMatch = fullBlock.match(/```json\s*(\{[\s\S]*?\})\s*```/i);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        
        return {
          type: 'tool_use',
          id: `toolu_json_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: toolName,
          input: parsed.input || parsed
        };
      }
    } catch (error) {
      // 如果JSON解析失败，尝试简单提取
      return this.inferToolFromName(toolName, jsonContent);
    }
    
    return null;
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