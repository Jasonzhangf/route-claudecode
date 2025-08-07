#!/usr/bin/env node
const axios = require('axios');

async function testTimeout() {
  console.log('🧪 测试超时修复...');
  
  const requests = [];
  for (let i = 0; i < 3; i++) {
    requests.push(
      axios.post('http://localhost:3456/v1/messages', {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: `测试请求 ${i}` }],
        stream: true
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': 'timeout-test',
          'conversation_id': 'timeout-conversation'
        },
        timeout: 25000,
        responseType: 'stream'
      }).then(response => {
        return new Promise((resolve) => {
          response.data.on('end', () => resolve(`请求 ${i} 完成`));
        });
      }).catch(error => `请求 ${i} 失败: ${error.message}`)
    );
  }
  
  try {
    const results = await Promise.all(requests);
    console.log('✅ 超时测试结果:', results);
  } catch (error) {
    console.log('❌ 超时测试失败:', error.message);
  }
}

testTimeout().catch(console.error);
