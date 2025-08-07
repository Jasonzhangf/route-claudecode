#!/usr/bin/env node

/**
 * 完整的工具调用恢复修复脚本
 */

const fs = require('fs');

console.log('🔧 应用工具调用恢复修复...');

// 1. 修复enhanced-client.ts
function fixEnhancedClient() {
  const filePath = 'src/providers/openai/enhanced-client.ts';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 添加工具调用检测方法
  if (!content.includes('detectToolCallInBuffer')) {
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
`;

    // 在类的末尾添加方法
    const classEndPattern = /}\s*$/;
    content = content.replace(classEndPattern, methodsToAdd + '\n}');
    console.log('✅ 添加了工具调用检测方法');
  }
  
  fs.writeFileSync(filePath, content);
  console.log('✅ enhanced-client.ts修复完成');
}

// 2. 修复finish-reason-handler.ts
function fixFinishReasonHandler() {
  const filePath = 'src/utils/finish-reason-handler.ts';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 修改mapFinishReason函数签名
  if (!content.includes('hasToolCall?: boolean')) {
    content = content.replace(
      'export function mapFinishReason(finishReason: string, requestId?: string): string {',
      'export function mapFinishReason(finishReason: string, requestId?: string, hasToolCall?: boolean): string {'
    );
    
    // 在函数开头添加工具调用检测逻辑
    const functionBodyPattern = /if \(!finishReason\) \{\s*return 'end_turn';\s*}/;
    const functionBodyMatch = content.match(functionBodyPattern);
    
    if (functionBodyMatch) {
      const newFunctionBody = `if (!finishReason) {
    return 'end_turn';
  }

  // 🚨 紧急修复：如果检测到工具调用，优先返回tool_use
  if (hasToolCall && (finishReason === 'length' || finishReason === 'max_tokens')) {
    console.warn(\`⚠️  Tool call detected with \${finishReason} finish_reason, mapping to tool_use\`, { requestId });
    return 'tool_use';
  }`;
      
      content = content.replace(functionBodyMatch[0], newFunctionBody);
      console.log('✅ 修复了mapFinishReason函数');
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log('✅ finish-reason-handler.ts修复完成');
}

// 执行修复
try {
  fixEnhancedClient();
  fixFinishReasonHandler();
  console.log('✅ 所有修复完成');
} catch (error) {
  console.error('❌ 修复失败:', error.message);
  process.exit(1);
}