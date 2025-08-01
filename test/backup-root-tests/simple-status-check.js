#!/usr/bin/env node

/**
 * 简单的状态检查，确认服务运行状态
 */

const axios = require('axios');

async function checkSimpleStatus() {
  try {
    console.log('🔍 Checking server health...');
    const healthResponse = await axios.get('http://127.0.0.1:3456/health', {
      timeout: 5000
    });
    
    console.log('✅ Server is running');
    console.log(`📊 Health status: ${healthResponse.data.overall}`);
    console.log(`🔧 Healthy providers: ${healthResponse.data.healthy}/${healthResponse.data.total}`);
    
    // 运行模型名测试
    console.log('\n🧪 Running model name fix test...');
    
    const testRequest = {
      model: 'claude-3-5-haiku-20241022', // background category
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 10
    };
    
    try {
      const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      
      console.log(`📤 Requested model: ${testRequest.model}`);
      console.log(`📥 Response model: ${response.data.model}`);
      
      if (response.data.model === testRequest.model) {
        console.log('✅ SUCCESS: Model name fix is working!');
      } else {
        console.log('❌ ISSUE: Model name mismatch');
        console.log(`   Expected: ${testRequest.model}`);
        console.log(`   Got: ${response.data.model}`);
      }
      
    } catch (requestError) {
      console.log('❌ Test request failed');
      if (requestError.response) {
        console.log(`   Status: ${requestError.response.status}`);
        console.log(`   Error: ${requestError.response.data?.error?.message || 'Unknown error'}`);
      } else {
        console.log(`   Error: ${requestError.message}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Server health check failed');
    if (error.code === 'ECONNREFUSED') {
      console.log('   Server is not running or not accessible on port 3456');
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

checkSimpleStatus().catch(console.error);