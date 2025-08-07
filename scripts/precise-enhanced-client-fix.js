#!/usr/bin/env node

/**
 * 精确修复enhanced-client.ts
 */

const fs = require('fs');

console.log('🔧 精确修复enhanced-client.ts...');

const filePath = 'src/providers/openai/enhanced-client.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 查找类的结束位置（在export function之前）
const exportFunctionPattern = /export function createEnhancedOpenAIClient/;
const exportFunctionMatch = content.search(exportFunctionPattern);

if (exportFunctionMatch !== -1) {
  // 在export function之前添加方法
  const methodsToAdd = `
  /**
   * 检测缓冲区中是否包含工具调用
   */
  private detectToolCallInBuffer(content: string): boolean {
    const toolCallPatterns = [
      /<function_calls>/i,
      /<invoke\\s+name=/i,
      /{"type":\\s*"function"/i,
      /{"name":\\s*"[^"]+"/i
    ];
    
    return toolCallPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * 尝试从截断的内容中恢复工具调用
   */
  private recoverTruncatedToolCall(content: string): { name: string; id?: string; input?: any } | null {
    try {
      // 检测XML格式的工具调用
      const xmlMatch = content.match(/<invoke\\s+name="([^"]+)"/i);
      if (xmlMatch) {
        return { name: xmlMatch[1], input: {} };
      }
      
      // 检测JSON格式的工具调用
      const jsonMatch = content.match(/"name":\\s*"([^"]+)"/i);
      if (jsonMatch) {
        return { name: jsonMatch[1], input: {} };
      }
      
      // 基于常见工具名称的模式匹配
      const commonTools = ['listDirectory', 'readFile', 'writeFile'];
      for (const tool of commonTools) {
        if (content.toLowerCase().includes(tool.toLowerCase())) {
          return { name: tool, input: {} };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

`;
  
  content = content.slice(0, exportFunctionMatch) + methodsToAdd + content.slice(exportFunctionMatch);
  console.log('✅ 添加了工具调用检测方法');
} else {
  console.log('⚠️  未找到export function，跳过方法添加');
}

fs.writeFileSync(filePath, content);
console.log('✅ enhanced-client.ts修复完成');