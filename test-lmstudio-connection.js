#!/usr/bin/env node

/**
 * Test LM Studio Connection
 * 测试LM Studio连接
 */

const fetch = require('node-fetch');

async function testDirectLMStudio() {
  console.log('🔧 Testing direct LM Studio connection...');
  
  const request = {
    model: "qwen3-30b-a3b-instruct-2507-mlx",
    messages: [
      {
        role: "user", 
        content: "Hello, please reply with a simple greeting."
      }
    ],
    max_tokens: 100,
    stream: false
  };

  try {
    console.log('📤 Direct LM Studio Request:');
    console.log(JSON.stringify(request, null, 2));
    
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ms-7af85c83-5871-43bb-9e2f-fc099ef08baf'
      },
      body: JSON.stringify(request)
    });

    console.log('\n📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LM Studio Error:', errorText);
      return;
    }

    const lmstudioResponse = await response.json();
    console.log('✅ LM Studio Response:');
    console.log(JSON.stringify(lmstudioResponse, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testLMStudioThroughRouter() {
  console.log('\n🔄 Testing LM Studio through router (need to switch config)...');
  
  // First check if we can switch to LM Studio config
  console.log('⚠️ Current router is using Gemini config (port 8888)');
  console.log('💡 To test LM Studio, need to:');
  console.log('  1. Switch to LM Studio config: cp ~/.route-claude-code/config.lmstudio.json ~/.route-claude-code/config.json');
  console.log('  2. Restart router on port 6666: ./rcc start -p 6666');
  console.log('  3. Test with router endpoint');
}

async function main() {
  console.log('=== LM Studio Connection Test ===\n');
  
  // 1. 测试直接LM Studio API调用
  await testDirectLMStudio();
  
  // 2. 说明如何通过路由器测试
  await testLMStudioThroughRouter();
}

main().catch(console.error);