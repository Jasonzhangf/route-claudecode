#!/usr/bin/env node

/**
 * 比较我们的响应格式和demo2的响应格式
 * 用于调试多轮对话问题
 */

const axios = require('axios');

// 测试请求
const testRequest = {
  model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  max_tokens: 131072,
  messages: [
    {
      role: "user",
      content: "Hello, can you help me with a simple task?"
    }
  ]
};

async function testOurRouter() {
  console.log('🔍 Testing our router...');
  try {
    const response = await axios.post('http://localhost:3000/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ Our router response:');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Our router failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function testDemo2() {
  console.log('\n🔍 Testing demo2...');
  try {
    const response = await axios.post('http://localhost:8080/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 5000
    });
    
    console.log('✅ Demo2 response:');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Demo2 failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Demo2 server is not running on port 8080');
    }
    return null;
  }
}

function compareResponses(ourResponse, demo2Response) {
  console.log('\n📊 Response Comparison:');
  
  if (!ourResponse || !demo2Response) {
    console.log('❌ Cannot compare - one or both responses failed');
    return;
  }
  
  // 比较基本结构
  console.log('\n🔍 Basic Structure:');
  console.log('Our response keys:', Object.keys(ourResponse));
  console.log('Demo2 response keys:', Object.keys(demo2Response));
  
  // 比较关键字段
  const keyFields = ['id', 'type', 'role', 'model', 'content', 'stop_reason', 'stop_sequence', 'usage'];
  
  console.log('\n🔍 Key Fields Comparison:');
  keyFields.forEach(field => {
    const ourValue = ourResponse[field];
    const demo2Value = demo2Response[field];
    
    console.log(`\n${field}:`);
    console.log(`  Our:   ${JSON.stringify(ourValue)}`);
    console.log(`  Demo2: ${JSON.stringify(demo2Value)}`);
    console.log(`  Match: ${JSON.stringify(ourValue) === JSON.stringify(demo2Value) ? '✅' : '❌'}`);
  });
  
  // 比较content结构
  if (ourResponse.content && demo2Response.content) {
    console.log('\n🔍 Content Structure:');
    console.log('Our content type:', Array.isArray(ourResponse.content) ? 'array' : typeof ourResponse.content);
    console.log('Demo2 content type:', Array.isArray(demo2Response.content) ? 'array' : typeof demo2Response.content);
    
    if (Array.isArray(ourResponse.content) && Array.isArray(demo2Response.content)) {
      console.log('Our content length:', ourResponse.content.length);
      console.log('Demo2 content length:', demo2Response.content.length);
      
      if (ourResponse.content.length > 0 && demo2Response.content.length > 0) {
        console.log('Our first content block:', JSON.stringify(ourResponse.content[0]));
        console.log('Demo2 first content block:', JSON.stringify(demo2Response.content[0]));
      }
    }
  }
  
  // 比较usage结构
  if (ourResponse.usage && demo2Response.usage) {
    console.log('\n🔍 Usage Structure:');
    console.log('Our usage:', JSON.stringify(ourResponse.usage));
    console.log('Demo2 usage:', JSON.stringify(demo2Response.usage));
  }
}

async function main() {
  console.log('🚀 Starting response format comparison...\n');
  
  const ourResponse = await testOurRouter();
  const demo2Response = await testDemo2();
  
  compareResponses(ourResponse, demo2Response);
  
  console.log('\n✨ Comparison complete!');
}

main().catch(console.error);