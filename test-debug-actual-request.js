#!/usr/bin/env node
/**
 * 调试CCR实际发送的请求内容
 */

const axios = require('axios');

async function debugActualRequest() {
  console.log('🔍 Debugging Actual CCR Request vs Working Request');
  console.log('================================================');
  
  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  // 1. 测试标准工作请求
  console.log('\n📡 Testing Working Request (like other apps):');
  console.log('─'.repeat(50));
  
  const workingRequest = {
    model: 'gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: 'hello test'
      }
    ],
    max_tokens: 10,
    temperature: 0.7,
    stream: false
  };
  
  console.log('📤 Working Request:', JSON.stringify(workingRequest, null, 2));
  
  try {
    const response = await axios.post(endpoint, workingRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    const content = response.data.choices?.[0]?.message?.content || '';
    console.log(`✅ Working Result: "${content}" (${content.length} chars)`);
    
  } catch (error) {
    console.log(`❌ Working Request Failed: ${error.response?.data?.error?.message || error.message}`);
  }
  
  // 2. 模拟CCR的请求构建过程
  console.log('\n📡 Testing CCR-style Request:');
  console.log('─'.repeat(50));
  
  // 模拟transformer的转换
  const anthropicStyleRequest = {
    model: 'claude-3-5-haiku-20241022',
    messages: [
      {
        role: 'user',
        content: 'hello test'
      }
    ],
    max_tokens: 10,
    temperature: undefined,  // 可能undefined
    stream: false,
    system: undefined,       // 可能undefined  
    tools: undefined         // 可能undefined
  };
  
  // 模拟transformAnthropicToOpenAI的过程
  const ccrRequest = {
    model: 'gemini-2.5-flash',  // 被路由替换的模型
    messages: anthropicStyleRequest.messages,
    max_tokens: anthropicStyleRequest.max_tokens || 131072,  // 默认值很大
    stream: false
  };
  
  // 只添加非undefined的字段
  if (anthropicStyleRequest.temperature !== undefined) {
    ccrRequest.temperature = anthropicStyleRequest.temperature;
  }
  
  console.log('📤 CCR Request:', JSON.stringify(ccrRequest, null, 2));
  
  try {
    const response = await axios.post(endpoint, ccrRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    const content = response.data.choices?.[0]?.message?.content || '';
    console.log(`${content ? '✅' : '❌'} CCR Result: "${content}" (${content.length} chars)`);
    
    // 分析区别
    console.log('\n🔍 Key Differences:');
    console.log(`   max_tokens: working=${workingRequest.max_tokens} vs ccr=${ccrRequest.max_tokens}`);
    console.log(`   temperature: working=${workingRequest.temperature} vs ccr=${ccrRequest.temperature}`);
    console.log(`   model: working=${workingRequest.model} vs ccr=${ccrRequest.model}`);
    
  } catch (error) {
    console.log(`❌ CCR Request Failed: ${error.response?.data?.error?.message || error.message}`);
  }
  
  // 3. 测试不同参数组合
  console.log('\n🧪 Testing Parameter Variations:');
  console.log('─'.repeat(50));
  
  const testCases = [
    { name: 'No temperature', req: { ...workingRequest, temperature: undefined } },
    { name: 'High max_tokens', req: { ...workingRequest, max_tokens: 131072 } },
    { name: 'Low temperature', req: { ...workingRequest, temperature: 0.1 } },
    { name: 'No stream field', req: { ...workingRequest, stream: undefined } }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}:`);
    const cleanReq = Object.fromEntries(
      Object.entries(testCase.req).filter(([_, v]) => v !== undefined)
    );
    
    try {
      const response = await axios.post(endpoint, cleanReq, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const content = response.data.choices?.[0]?.message?.content || '';
      console.log(`   ${content ? '✅' : '❌'} "${content}" (${content.length} chars)`);
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

debugActualRequest();