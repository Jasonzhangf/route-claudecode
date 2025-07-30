#!/usr/bin/env node
/**
 * 测试修复后的OpenAI client路径问题
 */

const axios = require('axios');

async function testFixedClient() {
  console.log('🔍 Testing Fixed OpenAI Client Path Issue');
  console.log('==========================================');
  
  // 模拟修复后的逻辑
  const testEndpoints = [
    'https://ai.shuaihong.fun/v1/chat/completions',  // 完整URL格式
    'https://ai.shuaihong.fun'                       // 基础URL格式
  ];
  
  for (const endpoint of testEndpoints) {
    console.log(`\n🧪 Testing endpoint: ${endpoint}`);
    
    // 模拟修复后的baseURL提取逻辑
    let baseURL = endpoint;
    if (endpoint.includes('/v1/chat/completions')) {
      baseURL = endpoint.replace('/v1/chat/completions', '');
      console.log(`   📝 Extracted baseURL: ${baseURL}`);
    }
    
    const finalURL = baseURL + '/v1/chat/completions';
    console.log(`   🎯 Final request URL: ${finalURL}`);
    
    // 实际测试请求
    try {
      const httpClient = axios.create({
        baseURL: baseURL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${SHUAIHONG_API_KEY}'
        }
      });
      
      const response = await httpClient.post('/v1/chat/completions', {
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 131072,
        temperature: 0
      });
      
      const content = response.data.choices?.[0]?.message?.content || '';
      console.log(`   ✅ Success: "${content}" (${content.length} chars)`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status || error.code} - ${error.response?.data?.error?.message || error.message}`);
    }
  }
  
  console.log('\n🎯 Test Complete');
}

testFixedClient();