#!/usr/bin/env node
/**
 * 测试新的 ModelScope API key 是否能正常访问
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testModelScopeNewKey() {
  console.log('🔍 Testing all ModelScope API keys...\n');

  const endpoint = 'https://api-inference.modelscope.cn/v1/chat/completions';
  const apiKeys = [
    { name: 'Key 1 (Original)', key: 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67' },
    { name: 'Key 2 (New)', key: 'ms-7d6c4fdb-4bf1-40b3-9ec6-ddea16f6702b' },
    { name: 'Key 3 (Latest)', key: 'ms-7af85c83-5871-43bb-9e2f-fc099ef08baf' }
  ];
  
  const testRequest = {
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    messages: [
      {
        role: 'user',
        content: 'Hello, this is a test message.'
      }
    ],
    max_tokens: 100,
    temperature: 0.7,
    stream: false
  };

  console.log('🔧 Test Configuration:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Model: ${testRequest.model}`);
  console.log(`   Testing ${apiKeys.length} API keys\n`);

  const results = [];

  // 测试所有 API keys
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKeyInfo = apiKeys[i];
    console.log(`📤 Testing ${apiKeyInfo.name} (${apiKeyInfo.key}):`);
    console.log('─'.repeat(60));
    
    try {
      const response = await axios.post(endpoint, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyInfo.key}`
        },
        timeout: 30000
      });

      const result = {
        name: apiKeyInfo.name,
        key: apiKeyInfo.key,
        status: 'SUCCESS',
        statusCode: response.status,
        responseModel: response.data.model || 'N/A',
        contentLength: response.data.choices?.[0]?.message?.content?.length || 0,
        content: response.data.choices?.[0]?.message?.content?.substring(0, 100) || ''
      };
      
      results.push(result);
      console.log(`✅ ${apiKeyInfo.name} SUCCESS: Status ${response.status}`);
      console.log(`   Response model: ${result.responseModel}`);
      console.log(`   Content length: ${result.contentLength} chars`);
      console.log(`   Content: "${result.content}..."`);
      
    } catch (error) {
      const result = {
        name: apiKeyInfo.name,
        key: apiKeyInfo.key,
        status: 'FAILED',
        statusCode: error.response?.status,
        error: error.response?.data?.errors?.message || error.response?.data?.error?.message || error.message,
        responseData: error.response?.data
      };
      
      results.push(result);
      console.log(`❌ ${apiKeyInfo.name} FAILED: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`   Error: ${result.error}`);
      if (error.response?.data) {
        console.log(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }

    if (i < apiKeys.length - 1) {
      console.log('\n' + '='.repeat(60) + '\n');
    }
  }

  // 总结报告
  console.log('\n' + '🔍 API Keys Test Summary:');
  console.log('═'.repeat(80));
  
  const workingKeys = results.filter(r => r.status === 'SUCCESS');
  const failedKeys = results.filter(r => r.status === 'FAILED');
  
  console.log(`✅ Working Keys: ${workingKeys.length}/${results.length}`);
  workingKeys.forEach(key => {
    console.log(`   ✓ ${key.name}: ${key.key.substring(0, 20)}... (${key.contentLength} chars response)`);
  });
  
  console.log(`❌ Failed Keys: ${failedKeys.length}/${results.length}`);
  failedKeys.forEach(key => {
    console.log(`   ✗ ${key.name}: ${key.key.substring(0, 20)}... (${key.statusCode}: ${key.error})`);
  });
  
  console.log('═'.repeat(80));
}

// 运行测试
if (require.main === module) {
  testModelScopeNewKey().catch(console.error);
}

module.exports = { testModelScopeNewKey };