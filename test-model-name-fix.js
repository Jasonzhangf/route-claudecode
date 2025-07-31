#!/usr/bin/env node

/**
 * 测试模型名修复效果
 * 验证API响应中返回的是原始模型名而不是内部映射的模型名
 */

const axios = require('axios');

async function testModelNameFix() {
  const apiUrl = 'http://127.0.0.1:3456/v1/messages';
  
  const testRequest = {
    model: 'claude-sonnet-4-20250514', // 原始模型名
    messages: [
      {
        role: 'user',
        content: 'Hello! Please respond briefly.'
      }
    ],
    max_tokens: 50
  };

  console.log('🧪 Testing Model Name Fix');
  console.log(`📤 Request model: ${testRequest.model}`);
  console.log(`🌐 API URL: ${apiUrl}`);
  
  try {
    const startTime = Date.now();
    const response = await axios.post(apiUrl, testRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📥 Response model: ${response.data.model}`);
    console.log(`📝 Response content: ${JSON.stringify(response.data.content?.[0]?.text || 'No content', null, 2)}`);
    
    // 验证结果
    if (response.data.model === testRequest.model) {
      console.log('✅ SUCCESS: Model name correctly returned as original request model');
      console.log(`   Expected: ${testRequest.model}`);
      console.log(`   Actual: ${response.data.model}`);
    } else {
      console.log('❌ FAILURE: Model name mismatch');
      console.log(`   Expected: ${testRequest.model}`);
      console.log(`   Actual: ${response.data.model}`);
      console.log('   Problem: Response still contains internal mapped model name');
    }
    
    console.log('\n📊 Full Response Structure:');
    console.log(JSON.stringify({
      model: response.data.model,
      role: response.data.role,
      contentTypes: response.data.content?.map(c => c.type) || [],
      hasUsage: !!response.data.usage
    }, null, 2));
    
  } catch (error) {
    console.log('❌ REQUEST FAILED');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.log('   Network error - no response received');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

// 运行测试
testModelNameFix().catch(console.error);