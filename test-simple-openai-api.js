#!/usr/bin/env node
/**
 * 最简单的OpenAI API测试
 * 使用shuaihong endpoint和API key
 */

const axios = require('axios');

async function testModelAPI(model) {
  console.log(`\n🧪 Testing model: ${model}`);
  
  // Shuaihong配置
  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  const request = {
    model: model,
    messages: [
      {
        role: 'user',
        content: 'Hello'
      }
    ],
    max_tokens: 50,
    temperature: 0.1,
    stream: false
  };
  
  console.log('📤 Request:', JSON.stringify(request, null, 2));
  
  try {
    const response = await axios.post(endpoint, request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
    
    console.log('✅ Status:', response.status);
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    
    // 分析响应
    const hasChoices = response.data.choices && response.data.choices.length > 0;
    const hasContent = hasChoices && response.data.choices[0].message && response.data.choices[0].message.content;
    const content = hasContent ? response.data.choices[0].message.content : null;
    
    console.log('📊 Analysis:', {
      hasChoices,
      hasContent,
      content,
      contentLength: content ? content.length : 0,
      isEmpty: !content || content.trim() === ''
    });
    
    return {
      model,
      success: hasContent && content.trim() !== '',
      data: response.data,
      content
    };
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return {
      model,
      success: false,
      error: error.response?.data || error.message
    };
  }
}

async function testSimpleOpenAI() {
  console.log('🔍 Simple OpenAI API Test - Multiple Models');
  console.log('🔗 Endpoint: https://ai.shuaihong.fun/v1/chat/completions');
  
  // 测试多个模型 - 包括gemini-2.5-pro
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'qwen3-coder'];
  const results = [];
  
  for (const model of models) {
    const result = await testModelAPI(model);
    results.push(result);
  }
  
  console.log('\n📊 Summary:');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.model}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.content) {
      console.log(`   Content: "${result.content}"`);
    }
  });
  
  const anySuccess = results.some(r => r.success);
  return {
    success: anySuccess,
    results
  };
}

// 运行测试
if (require.main === module) {
  testSimpleOpenAI().then(result => {
    console.log(result.success ? '\n✅ At least one model works' : '\n❌ All models failed');
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testSimpleOpenAI };