#!/usr/bin/env node

/**
 * Debug script to test shuaihong-openai provider separately
 */

const axios = require('axios');

async function testShuaihongAPI() {
  console.log('🔍 Testing Shuaihong API directly...\n');

  const config = {
    endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
    apiKey: '${SHUAIHONG_API_KEY}'
  };

  const testRequest = {
    model: 'gemini-2.5-pro',
    messages: [
      {
        role: 'user',
        content: '测试一下API连接'
      }
    ],
    stream: false,  // Start with non-streaming to debug
    max_tokens: 100
  };

  try {
    console.log(`📡 Endpoint: ${config.endpoint}`);
    console.log(`🔑 API Key: ${config.apiKey.substring(0, 10)}...`);
    console.log(`📋 Request:`, JSON.stringify(testRequest, null, 2));
    console.log('\n⏳ Sending request...\n');

    const response = await axios.post(config.endpoint, testRequest, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Success!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📝 Response:`, JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Request failed');
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📋 Headers:`, error.response.headers);
      console.log(`📝 Response:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('🌐 No response received');
      console.log(`📋 Request:`, error.request);
    } else {
      console.log(`💥 Error: ${error.message}`);
    }
    
    console.log(`🔍 Full error:`, error);
  }
}

async function testStreamingRequest() {
  console.log('\n🌊 Testing streaming request...\n');

  const config = {
    endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
    apiKey: '${SHUAIHONG_API_KEY}'
  };

  const testRequest = {
    model: 'gemini-2.5-pro',
    messages: [
      {
        role: 'user',
        content: '简单回复一句话'
      }
    ],
    stream: true,
    max_tokens: 50
  };

  try {
    console.log(`📡 Endpoint: ${config.endpoint}`);
    console.log(`🌊 Streaming: enabled`);
    console.log('\n⏳ Sending streaming request...\n');

    const response = await axios.post(config.endpoint, testRequest, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 15000
    });

    console.log('✅ Stream started!');
    console.log(`📊 Status: ${response.status}`);

    let chunks = 0;
    response.data.on('data', (chunk) => {
      chunks++;
      console.log(`📦 Chunk ${chunks}:`, chunk.toString());
    });

    response.data.on('end', () => {
      console.log(`🏁 Stream ended after ${chunks} chunks`);
    });

    response.data.on('error', (error) => {
      console.log('❌ Stream error:', error);
    });

  } catch (error) {
    console.log('❌ Streaming request failed');
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📝 Response:`, error.response.data);
    } else {
      console.log(`💥 Error: ${error.message}`);
    }
  }
}

// Run tests
async function main() {
  console.log('🚀 Shuaihong API Debug Tool\n');
  console.log('=' .repeat(50));
  
  // Test non-streaming first
  await testShuaihongAPI();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test streaming
  await testStreamingRequest();
  
  // Keep process alive for streaming test
  setTimeout(() => {
    console.log('\n🏁 Debug session completed');
    process.exit(0);
  }, 10000);
}

main().catch(console.error);