#!/usr/bin/env node
/**
 * 🔧 修复工具调用后message_stop过早发送的问题
 */

const fs = require('fs').promises;

console.log('🔧 开始修复工具调用message_stop问题...');

async function fixServerStreamingLogic() {
  const serverPath = 'src/server.ts';
  console.log(`📝 修复 ${serverPath}...`);
  
  try {
    let content = await fs.readFile(serverPath, 'utf8');
    
    // 修复流式处理中的message_stop逻辑
    const oldLogic = `        } else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：始终发送message_stop事件，不再进行过滤
          this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
          this.logger.debug('Sent message_stop event', { requestId }, requestId, 'server');`;
    
    const newLogic = `        } else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：工具调用场景下不发送message_stop，保持对话开放
          if (hasToolUse) {
            this.logger.debug('Skipping message_stop for tool_use scenario to keep conversation open', { 
              requestId, 
              hasToolUse 
            }, requestId, 'server');
            // 不发送message_stop，让对话保持开放状态等待工具执行结果
          } else {
            // 非工具调用场景正常发送message_stop
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.debug('Sent message_stop event for non-tool scenario', { requestId }, requestId, 'server');
          }`;
    
    if (content.includes(oldLogic)) {
      content = content.replace(oldLogic, newLogic);
      console.log('   ✅ 修复了流式处理中的message_stop逻辑');
      
      await fs.writeFile(serverPath, content, 'utf8');
      console.log(`   ✅ ${serverPath} 修复完成`);
    } else {
      console.log('   ⚠️ 未找到预期的message_stop处理逻辑');
    }
    
  } catch (error) {
    console.error(`   ❌ 修复失败:`, error.message);
  }
}

async function main() {
  await fixServerStreamingLogic();
  
  console.log('\n✅ 修复完成！');
  console.log('\n🔧 下一步:');
  console.log('   1. 重启服务器');
  console.log('   2. 测试工具调用是否正常');
}

if (require.main === module) {
  main().catch(console.error);
}