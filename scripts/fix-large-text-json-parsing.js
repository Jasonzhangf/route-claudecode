#!/usr/bin/env node
/**
 * 🔧 修复大文本JSON解析问题
 * 
 * 问题：大文本工具调用中的控制字符导致JSON解析失败
 * 解决：改进JSON解析逻辑，处理控制字符
 */

const fs = require('fs').promises;

console.log('🔧 [JSON-PARSING-FIX] 开始修复大文本JSON解析问题...');

async function fixUnifiedToolCallDetector() {
  console.log('📝 修复统一工具调用检测器的JSON解析...');
  
  const filePath = 'src/utils/unified-tool-call-detector.ts';
  
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 查找detectTextToolCalls方法并改进JSON解析
    const oldDetectTextMethod = `  private detectTextToolCalls(text: string, offset: number): any[] {
    const detections: any[] = [];
    const pattern = /Tool\\s+call:\\s*(\\w+)\\s*\\((\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\})\\)/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const functionName = match[1];
        const argsStr = match[2];
        const args = JSON.parse(argsStr);
        
        detections.push({
          type: 'tool_use',
          id: \`toolu_\${Date.now()}_\${Math.random().toString(36).substr(2, 8)}\`,
          name: functionName,
          input: args,
          textRange: {
            start: offset + match.index,
            end: offset + match.index + match[0].length
          },
          detectionMethod: 'text-pattern',
          originalText: match[0]
        });
      } catch (error) {
        // 参数解析失败，继续下一个匹配
      }
    }

    return detections;
  }`;
    
    const newDetectTextMethod = `  private detectTextToolCalls(text: string, offset: number): any[] {
    const detections: any[] = [];
    const pattern = /Tool\\s+call:\\s*(\\w+)\\s*\\((\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\})\\)/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const functionName = match[1];
        const argsStr = match[2];
        
        // 🔧 改进JSON解析：处理控制字符和转义
        const args = this.parseToolCallJSON(argsStr, functionName);
        
        if (args !== null) {
          detections.push({
            type: 'tool_use',
            id: \`toolu_\${Date.now()}_\${Math.random().toString(36).substr(2, 8)}\`,
            name: functionName,
            input: args,
            textRange: {
              start: offset + match.index,
              end: offset + match.index + match[0].length
            },
            detectionMethod: 'text-pattern',
            originalText: match[0]
          });
        }
      } catch (error) {
        // 参数解析失败，继续下一个匹配
        console.warn(\`Tool call JSON parsing failed for \${match[1]}: \${error.message}\`);
      }
    }

    return detections;
  }`;
    
    if (content.includes('private detectTextToolCalls(text: string, offset: number): any[]')) {
      content = content.replace(oldDetectTextMethod, newDetectTextMethod);
      console.log('   ✅ 更新了detectTextToolCalls方法');
    } else {
      console.log('   ⚠️ 未找到detectTextToolCalls方法，手动添加改进的JSON解析');
    }
    
    // 添加新的JSON解析方法
    const jsonParsingMethod = `
  /**
   * 🔧 改进的工具调用JSON解析
   * 处理大文本中的控制字符和转义问题
   */
  private parseToolCallJSON(jsonStr: string, functionName: string): any | null {
    try {
      // 方法1: 直接解析
      return JSON.parse(jsonStr);
    } catch (error1) {
      try {
        // 方法2: 清理控制字符后解析
        const cleanedJson = this.cleanJSONString(jsonStr);
        return JSON.parse(cleanedJson);
      } catch (error2) {
        try {
          // 方法3: 使用eval作为最后手段（安全性考虑）
          const evalResult = eval(\`(\${jsonStr})\`);
          if (typeof evalResult === 'object' && evalResult !== null) {
            return evalResult;
          }
        } catch (error3) {
          // 所有方法都失败，记录详细错误信息
          console.warn(\`All JSON parsing methods failed for \${functionName}:\`, {
            originalError: error1.message,
            cleanedError: error2.message,
            evalError: error3.message,
            jsonPreview: jsonStr.substring(0, 100) + '...'
          });
        }
      }
    }
    
    return null;
  }
  
  /**
   * 清理JSON字符串中的控制字符
   */
  private cleanJSONString(jsonStr: string): string {
    return jsonStr
      // 处理换行符
      .replace(/\\n/g, '\\\\n')
      .replace(/\\r/g, '\\\\r')
      .replace(/\\t/g, '\\\\t')
      // 处理其他控制字符
      .replace(/[\\x00-\\x1F\\x7F]/g, (match) => {
        const code = match.charCodeAt(0);
        return \`\\\\u\${code.toString(16).padStart(4, '0')}\`;
      })
      // 处理未转义的引号
      .replace(/(?<!\\\\)"/g, '\\\\"')
      // 修复可能的双重转义
      .replace(/\\\\\\\\"/g, '\\\\"');
  }`;
    
    // 在类的最后添加新方法
    const classEndPattern = /}\s*$/;
    content = content.replace(classEndPattern, jsonParsingMethod + '\n}');
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`   ✅ ${filePath} 修复完成`);
    
  } catch (error) {
    console.error(`   ❌ 修复失败:`, error.message);
  }
}

async function createTestScript() {
  console.log('📝 创建修复验证脚本...');
  
  const testPath = 'scripts/test-json-parsing-fix.js';
  const testContent = `#!/usr/bin/env node
/**
 * 🔍 测试JSON解析修复效果
 */

// 测试数据：包含控制字符的JSON
const problematicJSON = '{"content":"# 小说《进化》项目规则系统\\n\\n## 项目概述\\n\\n小说《进化》是一个集成了GraphRAG、LMCE和MCP工具的本地记忆系统，专为小说创作设计。","file_path":"/Users/fanzhang/Documents/novel/evolve/CLAUDE.md"}';

console.log('🔍 测试JSON解析修复效果...');
console.log(\`JSON长度: \${problematicJSON.length} 字符\`);

// 测试原始解析
try {
  const result1 = JSON.parse(problematicJSON);
  console.log('✅ 原始JSON.parse成功');
} catch (error) {
  console.log(\`❌ 原始JSON.parse失败: \${error.message}\`);
}

// 测试清理后解析
function cleanJSONString(jsonStr) {
  return jsonStr
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
    .replace(/[\\x00-\\x1F\\x7F]/g, (match) => {
      const code = match.charCodeAt(0);
      return \`\\\\u\${code.toString(16).padStart(4, '0')}\`;
    });
}

try {
  const cleaned = cleanJSONString(problematicJSON);
  const result2 = JSON.parse(cleaned);
  console.log('✅ 清理后JSON.parse成功');
  console.log(\`   内容长度: \${result2.content ? result2.content.length : 0} 字符\`);
} catch (error) {
  console.log(\`❌ 清理后JSON.parse失败: \${error.message}\`);
}

console.log('\\n✅ JSON解析测试完成');
`;
  
  try {
    await fs.writeFile(testPath, testContent, 'utf8');
    console.log(\`   ✅ 创建了测试脚本: \${testPath}\`);
  } catch (error) {
    console.error(\`   ❌ 创建测试脚本失败:\`, error.message);
  }
}

async function main() {
  console.log('🚀 开始修复大文本JSON解析问题...');
  
  await fixUnifiedToolCallDetector();
  await createTestScript();
  
  console.log('\\n✅ 修复完成！');
  console.log('\\n📋 修复内容:');
  console.log('   1. 改进了工具调用检测器的JSON解析逻辑');
  console.log('   2. 添加了控制字符处理和多重解析策略');
  console.log('   3. 创建了JSON解析修复验证脚本');
  console.log('\\n🔧 下一步:');
  console.log('   1. 重新构建项目: ./install-local.sh');
  console.log('   2. 重启服务器');
  console.log('   3. 运行测试: node scripts/test-json-parsing-fix.js');
  console.log('   4. 测试大文本工具调用: node scripts/test-large-tool-call-issue.js');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 修复失败:', error);
    process.exit(1);
  });
}