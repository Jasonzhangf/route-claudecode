#!/usr/bin/env node
const axios = require('axios');

async function testFix() {
  console.log('🧪 测试修复效果...');
  
  // 测试大文本工具调用
  const largeRequest = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 50,
    messages: [{ 
      role: "user", 
      content: "请详细解释JavaScript。".repeat(100) + "\n现在请使用listDirectory工具查看目录。"
    }],
    tools: [{
      name: "listDirectory",
      description: "List directory",
      input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
    }],
    stream: true
  };
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', largeRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
      responseType: 'stream'
    });
    
    let hasToolUse = false;
    let finishReason = null;
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
              hasToolUse = true;
            }
            if (data.delta?.stop_reason) {
              finishReason = data.delta.stop_reason;
            }
          } catch (e) {}
        }
      }
    });
    
    response.data.on('end', () => {
      console.log(`结果: 工具调用=${hasToolUse}, finish_reason=${finishReason}`);
      if (hasToolUse && finishReason === 'tool_use') {
        console.log('✅ 大文本工具调用修复成功');
      } else {
        console.log('❌ 大文本工具调用仍有问题');
      }
    });
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('❌ 请求超时，可能仍有死锁问题');
    } else {
      console.log(`❌ 测试失败: ${error.message}`);
    }
  }
}

testFix().catch(console.error);
