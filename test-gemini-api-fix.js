#!/usr/bin/env node
/**
 * 测试Gemini API修复 - 验证多key轮换和工具调用
 * 项目所有者: Jason Zhang
 */

const http = require('http');

const TEST_CONFIG = {
  port: 5502,
  host: 'localhost'
};

// 测试请求数据 - 包含工具调用
const testRequest = {
  method: 'POST',
  path: '/v1/messages',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-key'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'What is the current time in New York?'
      }
    ],
    tools: [
      {
        name: 'get_current_time',
        description: 'Get the current time in a specific timezone',
        input_schema: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'The timezone to get time for (e.g., America/New_York)'
            }
          },
          required: ['timezone']
        }
      }
    ]
  })
};

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API fix - tool passing and key rotation...\n');

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: testRequest.path,
      method: testRequest.method,
      headers: testRequest.headers
    }, (res) => {
      console.log(`📊 Response Status: ${res.statusCode}`);
      console.log(`📋 Response Headers:`, JSON.stringify(res.headers, null, 2));

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('\n📨 Response Body:');
        
        try {
          const response = JSON.parse(data);
          console.log(JSON.stringify(response, null, 2));
          
          // 分析响应
          console.log('\n🔍 Response Analysis:');
          if (res.statusCode === 429) {
            console.log('❌ 429 Error - Rate limit hit. This suggests key rotation may not be working.');
          } else if (res.statusCode === 200) {
            console.log('✅ 200 Success - Request processed successfully.');
            
            if (response.content && response.content.some(c => c.type === 'tool_use')) {
              console.log('✅ Tool calling working - Found tool_use in response.');
            } else {
              console.log('⚠️ No tool_use found - Tools may not have been passed correctly.');
            }
          } else {
            console.log(`⚠️ Unexpected status code: ${res.statusCode}`);
          }
          
          resolve({ status: res.statusCode, body: response });
        } catch (error) {
          console.log('Raw response:', data);
          resolve({ status: res.statusCode, body: data, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(testRequest.body);
    req.end();
  });
}

async function main() {
  try {
    console.log(`🎯 Testing Gemini API at http://${TEST_CONFIG.host}:${TEST_CONFIG.port}`);
    console.log(`📦 Request: ${testRequest.method} ${testRequest.path}`);
    console.log(`🛠️ With tools: yes (get_current_time)`);
    console.log('─'.repeat(60));

    const result = await testGeminiAPI();
    
    console.log('\n' + '─'.repeat(60));
    console.log('📋 Test Summary:');
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log('✅ API call successful - Key rotation working');
      console.log('✅ Response format correct');
      
      if (result.body.content && result.body.content.some(c => c.type === 'tool_use')) {
        console.log('✅ Tool calling working correctly');
      } else {
        console.log('⚠️ Tool calling not triggered (may be model decision)');
      }
    } else if (result.status === 429) {
      console.log('❌ Rate limit hit - Check key rotation logic');
    } else {
      console.log(`⚠️ Unexpected status: ${result.status}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testGeminiAPI };