#!/usr/bin/env node

/**
 * 测试模型名修复效果 - 使用background类别强制路由到gemini
 * 使用haiku模型名触发background路由规则，避开codewhisperer provider
 */

const axios = require('axios');

async function testBackgroundModelFix() {
  const apiUrl = 'http://127.0.0.1:3456/v1/messages';
  
  const testRequest = {
    model: 'claude-3-5-haiku-20241022', // 这会触发background路由类别
    messages: [
      {
        role: 'user',
        content: 'Hello! Please respond briefly.'
      }
    ],
    max_tokens: 50
  };

  console.log('🧪 Testing Model Name Fix with Background Category');
  console.log(`📤 Request model: ${testRequest.model}`);
  console.log(`🎯 Expected routing: background -> gemini-direct -> gemini-2.5-flash`);
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
      console.log('   🎉 Model name fix is working correctly!');
    } else {
      console.log('❌ FAILURE: Model name mismatch');
      console.log(`   Expected: ${testRequest.model}`);
      console.log(`   Actual: ${response.data.model}`);
      
      // 检查是否返回了内部映射的模型名
      if (response.data.model === 'gemini-2.5-flash') {
        console.log('   Problem: Response contains internal mapped model name instead of original');
        console.log('   🔧 This indicates the model name fix has not been fully applied');
      } else {
        console.log('   Problem: Unexpected model name returned');
      }
    }
    
    console.log('\n📊 Full Response Structure:');
    console.log(JSON.stringify({
      model: response.data.model,
      role: response.data.role,
      contentTypes: response.data.content?.map(c => c.type) || [],
      hasUsage: !!response.data.usage
    }, null, 2));
    
    console.log('\n🔍 Routing Analysis:');
    console.log(`   Original model: ${testRequest.model}`);
    console.log(`   Should trigger: background category`);
    console.log(`   Should map to: gemini-direct provider`);
    console.log(`   Internal model: gemini-2.5-flash`);
    console.log(`   Response model: ${response.data.model}`);
    
  } catch (error) {
    console.log('❌ REQUEST FAILED');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      // 如果是provider问题，建议检查配置
      if (error.response.status === 500) {
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('   1. Check if gemini-direct provider is properly configured');
        console.log('   2. Verify API key for gemini provider is valid');
        console.log('   3. Check provider health status via /status endpoint');
      }
    } else if (error.request) {
      console.log('   Network error - no response received');
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

// 运行测试
testBackgroundModelFix().catch(console.error);