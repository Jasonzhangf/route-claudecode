#!/usr/bin/env node

/**
 * 测试LMStudio响应格式修复
 * 验证choices字段缺失问题是否已解决
 */

const axios = require('axios');

async function testLMStudioFormatFix() {
  console.log('🧪 Testing LMStudio format fix...');
  
  const testRequest = {
    model: "gpt-oss-20b-mlx",
    messages: [
      {
        role: "user", 
        content: "Hello! Please respond with a simple greeting."
      }
    ],
    max_tokens: 100,
    temperature: 0.7,
    stream: false
  };

  try {
    console.log('📡 Sending test request to LMStudio (5506)...');
    
    const response = await axios.post('http://localhost:5506/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer any-key-works',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    console.log('✅ Request successful!');
    console.log('📋 Response status:', response.status);
    console.log('📋 Response data keys:', Object.keys(response.data));
    
    if (response.data.content && Array.isArray(response.data.content)) {
      console.log('✅ Response has proper Anthropic format');
      console.log('📄 Content blocks:', response.data.content.length);
      console.log('📄 Response content:', response.data.content[0]?.text?.substring(0, 100) + '...');
    } else {
      console.log('❌ Response format issue');
      console.log('📄 Full response:', JSON.stringify(response.data, null, 2));
    }

    if (response.data.stop_reason) {
      console.log('✅ Stop reason:', response.data.stop_reason);
    }

  } catch (error) {
    console.log('❌ Test failed');
    console.log('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('📄 Error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function checkServiceStatus() {
  try {
    const response = await axios.get('http://localhost:5506/health', { timeout: 5000 });
    console.log('✅ LMStudio service (5506) is running');
    return true;
  } catch (error) {
    console.log('❌ LMStudio service (5506) is not running');
    console.log('💡 Please start the service with: rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
    return false;
  }
}

async function main() {
  console.log('🔍 Checking service status...');
  const isRunning = await checkServiceStatus();
  
  if (isRunning) {
    await testLMStudioFormatFix();
  }
  
  console.log('🏁 Test completed');
}

main().catch(console.error);