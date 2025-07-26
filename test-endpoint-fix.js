#!/usr/bin/env node
/**
 * 测试修复后的endpoint处理
 */

const axios = require('axios');

async function testEndpointFix() {
  console.log('🔍 Testing Fixed Endpoint Handling');
  console.log('==================================');
  
  const fullEndpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  console.log(`🎯 Full endpoint: ${fullEndpoint}`);
  console.log(`📡 Making request to: POST ${fullEndpoint}`);
  
  // 模拟修复后的client行为
  const httpClient = axios.create({
    baseURL: fullEndpoint,  // 完整URL作为baseURL
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  try {
    const response = await httpClient.post('', {  // 空路径，因为baseURL已经是完整URL
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Hello'
        }
      ],
      max_tokens: 20,
      temperature: 0
    });
    
    const content = response.data.choices?.[0]?.message?.content || '';
    console.log(`✅ Success! Response: "${content}" (${content.length} chars)`);
    console.log(`📊 Status: ${response.status}`);
    
    return { success: true, content };
    
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || error.code}`);
    console.log(`📝 Message: ${error.response?.data?.error?.message || error.message}`);
    console.log(`🔗 URL attempted: ${error.config?.url || 'unknown'}`);
    
    return { success: false, error: error.message };
  }
}

// 同时测试gemini-2.5-pro
async function testBothModels() {
  const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
  
  for (const model of models) {
    console.log(`\n🧪 Testing ${model}:`);
    console.log('─'.repeat(30));
    
    try {
      const httpClient = axios.create({
        baseURL: 'https://ai.shuaihong.fun/v1/chat/completions',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
        }
      });
      
      const response = await httpClient.post('', {
        model: model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 20,
        temperature: 0
      });
      
      const content = response.data.choices?.[0]?.message?.content || '';
      console.log(`${content ? '✅' : '⚠️ '} Content: "${content}"`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

if (require.main === module) {
  testEndpointFix().then(() => {
    console.log('\n🔄 Testing both models:');
    return testBothModels();
  });
}