#!/usr/bin/env node
/**
 * Clean Gemini Transformer Script
 * 完全清理Gemini Transformer中的服务特定逻辑
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

const geminiTransformerPath = path.join(__dirname, 'src/transformers/gemini.ts');

if (!fs.existsSync(geminiTransformerPath)) {
  console.error('Gemini transformer file not found');
  process.exit(1);
}

let content = fs.readFileSync(geminiTransformerPath, 'utf8');

console.log('🧹 Cleaning Gemini Transformer...\n');

// 1. 移除UNEXPECTED_TOOL_CALL处理逻辑
console.log('📝 Removing UNEXPECTED_TOOL_CALL logic...');

// 替换finish reason检查
content = content.replace(
  /if \(candidate\.finishReason === 'UNEXPECTED_TOOL_CALL'\) \{[\s\S]*?\}/g,
  '// Special finish reasons handled by patches system'
);

// 移除工具调用相关的特殊处理
content = content.replace(
  /\/\/ 检查是否是工具调用相关的特殊finish reason[\s\S]*?return this\.createUnexpectedToolCallResponse[\s\S]*?\);/g,
  `// Tool-related empty content handling moved to patches system
      logger.debug('Empty content detected, will be handled by patches system', {
        finishReason: candidate.finishReason
      }, requestId, 'gemini-transformer');
      
      // Zero Fallback Principle: throw error for empty content
      throw new Error(\`GeminiTransformer: Empty content for finish reason: \${candidate.finishReason}\`);`
);

// 2. 清理finish reason映射
console.log('📝 Cleaning finish reason mapping...');

content = content.replace(
  /'UNEXPECTED_TOOL_CALL': 'tool_use'[^}]*\/\/ [^}]*特殊工具调用状态映射/g,
  '// UNEXPECTED_TOOL_CALL handling moved to patches system'
);

// 3. 移除接口中的UNEXPECTED_TOOL_CALL
console.log('📝 Removing UNEXPECTED_TOOL_CALL from interface...');

content = content.replace(
  /finishReason: '[^']*' \| '[^']*' \| '[^']*' \| '[^']*' \| '[^']*' \| 'UNEXPECTED_TOOL_CALL';/g,
  "finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';"
);

// 4. 清理注释中的UNEXPECTED_TOOL_CALL引用
console.log('📝 Cleaning comments...');

content = content.replace(
  /Special cases like UNEXPECTED_TOOL_CALL are handled by:/g,
  'Special cases are handled by:'
);

content = content.replace(
  /在非UNEXPECTED_TOOL_CALL情况下进行内容验证/g,
  '进行内容验证'
);

// 5. 移除demo3相关注释
content = content.replace(
  /基于demo3的转换模式，增加UNEXPECTED_TOOL_CALL支持/g,
  '标准Gemini finish reason映射'
);

content = content.replace(
  /参考demo3模式：特殊工具调用状态映射/g,
  'Standard finish reason mapping'
);

// 6. 移除createUnexpectedToolCallResponse方法引用的注释
content = content.replace(
  /\/\*\*[\s\S]*?移除的方法：createUnexpectedToolCallResponse[\s\S]*?\*\//g,
  `/**
   * Pure format conversion - no service-specific logic
   * All special cases handled by patches system
   */`
);

// 写入清理后的内容
fs.writeFileSync(geminiTransformerPath, content);

console.log('✅ Gemini Transformer cleaned successfully!');
console.log('\nChanges made:');
console.log('- Removed UNEXPECTED_TOOL_CALL handling logic');
console.log('- Cleaned finish reason interface and mapping');
console.log('- Removed service-specific comments and references');
console.log('- Simplified to pure format conversion only');

console.log('\n🎯 Next: Run validation script to verify clean architecture');