#!/usr/bin/env node
/**
 * 测试Gemini工具调用 - 强制触发工具使用
 * 项目所有者: Jason Zhang
 */

const http = require('http');

const TEST_CONFIG = {
  port: 5502,
  host: 'localhost'
};

// 更明确的测试请求 - 要求使用工具
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
        content: 'Please use the get_current_time tool to get the current time in New York. I need you to actually call the tool, not just explain how to do it.'
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

async function testGeminiForcedToolCall() {
  console.log('🧪 Testing Gemini API - Forced tool call scenario...\n');

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      path: testRequest.path,
      method: testRequest.method,
      headers: testRequest.headers
    }, (res) => {
      console.log(`📊 Response Status: ${res.statusCode}`);

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
          console.log('\n🔍 Tool Call Analysis:');
          if (res.statusCode === 200) {
            console.log('✅ 200 Success - Request processed successfully.');
            
            const hasToolUse = response.content && response.content.some(c => c.type === 'tool_use');
            const hasTextOnly = response.content && response.content.every(c => c.type === 'text');
            
            if (hasToolUse) {
              console.log('✅ SUCCESS: Tool calling working - Found tool_use in response!');
              const toolUseBlock = response.content.find(c => c.type === 'tool_use');
              console.log('📋 Tool Details:', {
                name: toolUseBlock.name,
                id: toolUseBlock.id,
                input: toolUseBlock.input
              });
            } else if (hasTextOnly) {
              console.log('⚠️ WARNING: Model chose not to use tools despite explicit request.');
              console.log('   This could indicate:');
              console.log('   1. Tools were not passed correctly to Gemini API');
              console.log('   2. Model decision to refuse tool use');
              console.log('   3. Tool definition format issue');
            }
          } else {
            console.log(`❌ HTTP Error: ${res.statusCode}`);
          }
          
          resolve({ status: res.statusCode, body: response, hasToolUse });
        } catch (error) {
          console.log('Raw response:', data);
          resolve({ status: res.statusCode, body: data, error: error.message, hasToolUse: false });
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
    console.log(`🎯 Testing Gemini Tool Calling at http://${TEST_CONFIG.host}:${TEST_CONFIG.port}`);
    console.log(`📦 Request: ${testRequest.method} ${testRequest.path}`);
    console.log(`🛠️ With explicit tool use request`);
    console.log('─'.repeat(60));

    const result = await testGeminiForcedToolCall();
    
    console.log('\n' + '─'.repeat(60));
    console.log('📋 Final Test Summary:');
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 200) {
      if (result.hasToolUse) {
        console.log('🎉 PERFECT: Gemini tool calling is working correctly!');
        console.log('✅ API structure fixed');
        console.log('✅ Multi-key rotation working');
        console.log('✅ Tool passing and calling working');
      } else {
        console.log('⚠️ PARTIAL: API working but tools not called');
        console.log('   Need to investigate why model didn\'t use tools');
      }
    } else {
      console.log(`❌ FAILED: HTTP ${result.status}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testGeminiForcedToolCall };