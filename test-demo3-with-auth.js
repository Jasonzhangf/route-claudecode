#!/usr/bin/env node
/**
 * 用正确的API Key测试Demo3，获取成功响应对比数据
 */

const axios = require('axios');

async function testDemo3WithAuth() {
  console.log('🔍 使用正确的API Key测试Demo3');
  
  const testRequest = {
    model: 'claude-3-sonnet-20240229', 
    messages: [
      { role: 'user', content: 'What is the weather like in New York?' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city name'
              }
            },
            required: ['location']
          }
        }
      }
    ],
    max_tokens: 1000,
    stream: false
  };

  try {
    // 使用Demo3要求的API Key (123456)
    const response = await axios.post('http://localhost:3000/v1/chat/completions', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 123456'
      },
      timeout: 30000,
      validateStatus: () => true
    });

    console.log('Demo3响应状态:', response.status);
    console.log('Demo3响应数据:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Demo3测试失败:', error.message);
  }
}

testDemo3WithAuth();