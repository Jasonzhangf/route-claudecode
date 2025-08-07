#!/usr/bin/env node
/**
 * 🔍 验证工具调用丢失修复效果
 */

const http = require('http');

const TEST_REQUEST = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "请帮我创建一个名为test.txt的文件，内容是'Hello World'"
    }
  ],
  tools: [
    {
      name: "Write",
      description: "Write content to a file",
      input_schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          file_path: { type: "string" }
        },
        required: ["content", "file_path"]
      }
    }
  ],
  stream: false
};

async function validateFix() {
  console.log('🔍 验证工具调用丢失修复效果...');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TEST_REQUEST);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3456,
      path: '/v1/messages?beta=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`📊 响应状态: ${res.statusCode}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log('\n📊 响应分析:');
          console.log(`Stop reason: ${response.stop_reason}`);
          console.log(`Content blocks: ${response.content?.length || 0}`);
          
          if (response.content) {
            response.content.forEach((block, index) => {
              console.log(`  ${index + 1}. ${block.type}${block.type === 'tool_use' ? ` - ${block.name}` : ''}`);
            });
          }
          
          const hasToolCalls = response.content?.some(b => b.type === 'tool_use');
          const correctStopReason = response.stop_reason === 'tool_use';
          
          console.log('\n🎯 验证结果:');
          console.log(`工具调用检测: ${hasToolCalls ? '✅' : '❌'}`);
          console.log(`Stop reason正确: ${correctStopReason ? '✅' : '❌'}`);
          
          if (hasToolCalls && correctStopReason) {
            console.log('\n✅ 修复成功！工具调用没有丢失');
          } else {
            console.log('\n❌ 仍有问题，需要进一步调试');
          }
          
          resolve();
        } catch (error) {
          console.error('解析响应失败:', error);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  validateFix().catch(console.error);
}