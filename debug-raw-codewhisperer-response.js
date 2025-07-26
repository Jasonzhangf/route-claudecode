#!/usr/bin/env node

/**
 * 测试CodeWhisperer的原始响应，绕过输出处理器
 */

const axios = require('axios');

// 测试请求
const testRequest = {
  model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "Hello, can you help me with a simple task?"
    }
  ]
};

async function testWithBypassProcessor() {
  console.log('🔍 Testing with bypassed output processor...');
  
  // 临时修改server.ts来绕过输出处理器
  const serverCode = `
// 在server.ts的handleMessagesRequest方法中，找到这行：
// const finalResponse = await this.outputProcessor.process(providerResponse, baseRequest);
// 临时替换为：
// const finalResponse = providerResponse; // 直接返回provider响应
`;

  console.log('📝 To test raw CodeWhisperer response, temporarily modify server.ts:');
  console.log(serverCode);
  
  try {
    const response = await axios.post('http://localhost:3000/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ Raw CodeWhisperer response:');
    console.log('Status:', response.status);
    console.log('Data structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function main() {
  console.log('🚀 Testing raw CodeWhisperer response...\n');
  
  await testWithBypassProcessor();
  
  console.log('\n✨ Test complete!');
}

main().catch(console.error);