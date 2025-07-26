#!/usr/bin/env node
/**
 * 直接API对比测试 - 确认最简单请求的响应差异
 */

const axios = require('axios');

async function testDirectAPI() {
  console.log('🔍 Direct API Comparison Test');
  console.log('================================');
  
  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  // 测试案例：相同的简单请求，不同模型
  const testCases = [
    {
      name: 'gemini-2.5-pro (问题模型)',
      model: 'gemini-2.5-pro'
    },
    {
      name: 'gemini-2.5-flash (正常模型)',
      model: 'gemini-2.5-flash'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('━'.repeat(40));
    
    const request = {
      model: testCase.model,
      messages: [
        {
          role: 'user',
          content: 'Say hello'
        }
      ],
      max_tokens: 20,
      temperature: 0,
      stream: false
    };
    
    try {
      const response = await axios.post(endpoint, request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000
      });
      
      const choice = response.data.choices?.[0];
      const content = choice?.message?.content || '';
      
      console.log('📊 Result:');
      console.log(`  Status: ${response.status}`);
      console.log(`  Content: "${content}"`);
      console.log(`  Content Length: ${content.length}`);
      console.log(`  Finish Reason: ${choice?.finish_reason}`);
      
      console.log('\n📈 Token Usage:');
      if (response.data.usage) {
        console.log(`  Input Tokens: ${response.data.usage.prompt_tokens || 0}`);
        console.log(`  Output Tokens: ${response.data.usage.completion_tokens || 0}`);
        console.log(`  Text Tokens: ${response.data.usage.completion_tokens_details?.text_tokens || 0}`);
        console.log(`  Reasoning Tokens: ${response.data.usage.completion_tokens_details?.reasoning_tokens || 0}`);
      }
      
      console.log(`\n${content ? '✅' : '❌'} ${testCase.name}: ${content ? 'SUCCESS' : 'EMPTY RESPONSE'}`);
      
    } catch (error) {
      console.error('❌ Error:', error.response?.data || error.message);
    }
  }
  
  console.log('\n================================');
  console.log('🎯 Key Findings:');
  console.log('- 如果两个模型都返回空内容，问题在服务器端');
  console.log('- 如果只有特定模型返回空内容，问题在模型配置');
  console.log('- reasoning_tokens > 0 但 text_tokens = 0 说明模型在思考但不输出');
}

// 运行测试
if (require.main === module) {
  testDirectAPI();
}

module.exports = { testDirectAPI };