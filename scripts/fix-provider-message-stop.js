#!/usr/bin/env node
/**
 * 🔧 修复Provider层的message_stop发送逻辑
 */

const fs = require('fs').promises;

console.log('🔧 修复Provider层的message_stop发送逻辑...');

async function fixOpenAIEnhancedClient() {
  const filePath = 'src/providers/openai/enhanced-client.ts';
  console.log(`📝 修复 ${filePath}...`);
  
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 修复1: 替换"始终发送message_stop事件"为条件发送
    const pattern1 = /\/\/ 🔧 修复：始终发送message_stop事件\s*yield \{\s*event: 'message_stop',\s*data: \{ type: 'message_stop' \}\s*\};/g;
    
    content = content.replace(pattern1, `// 🔧 修复：工具调用场景下不发送message_stop
                if (finishReason !== 'tool_use') {
                  yield {
                    event: 'message_stop',
                    data: { type: 'message_stop' }
                  };
                }`);
    
    // 修复2: 处理其他形式的message_stop发送
    const pattern2 = /yield \{ event: 'message_stop', data: \{ type: 'message_stop' \} \};/g;
    
    content = content.replace(pattern2, `// 🔧 修复：工具调用场景下不发送message_stop
    if (finishReason !== 'tool_use') {
      yield { event: 'message_stop', data: { type: 'message_stop' } };
    }`);
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`   ✅ ${filePath} 修复完成`);
    
  } catch (error) {
    console.error(`   ❌ 修复失败:`, error.message);
  }
}

async function fixOpenAISDKClient() {
  const filePath = 'src/providers/openai/sdk-client.ts';
  console.log(`📝 修复 ${filePath}...`);
  
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 查找并修复message_stop发送
    const oldPattern = `yield {
            event: 'message_stop',
            data: {
              type: 'message_stop'
            }
          };`;
    
    const newPattern = `// 🔧 修复：工具调用场景下不发送message_stop
          if (finishReason !== 'tool_use') {
            yield {
              event: 'message_stop',
              data: {
                type: 'message_stop'
              }
            };
          }`;
    
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      console.log(`   ✅ 修复了message_stop发送逻辑`);
    }
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`   ✅ ${filePath} 修复完成`);
    
  } catch (error) {
    console.error(`   ❌ 修复失败:`, error.message);
  }
}

async function main() {
  await fixOpenAIEnhancedClient();
  await fixOpenAISDKClient();
  
  console.log('\n✅ Provider层修复完成！');
  console.log('\n🔧 下一步:');
  console.log('   1. 重启服务器以应用修复');
  console.log('   2. 运行测试验证修复效果');
}

if (require.main === module) {
  main().catch(console.error);
}