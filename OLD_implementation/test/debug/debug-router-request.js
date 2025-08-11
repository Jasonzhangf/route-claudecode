#!/usr/bin/env node

/**
 * Debug script to test the exact request format our router is sending
 */

const axios = require('axios');

// Simulate the same request format our router uses
function convertToOpenAI(request) {
  const openaiRequest = {
    model: request.model,
    messages: convertMessages(request.messages),
    max_tokens: request.max_tokens || 4096,
    temperature: request.temperature,
    stream: false
  };

  // Add system message if present
  if (request.metadata?.system && Array.isArray(request.metadata.system)) {
    const systemContent = request.metadata.system.map((s) => s.text || s).join('\n');
    openaiRequest.messages.unshift({
      role: 'system',
      content: systemContent
    });
  }

  return openaiRequest;
}

function convertMessages(messages) {
  return messages.map(msg => ({
    role: msg.role,
    content: convertContent(msg.content)
  }));
}

function convertContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(block => {
      if (block.type === 'text') {
        return block.text;
      } else if (block.type === 'tool_result') {
        return typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
      }
      return JSON.stringify(block);
    }).join('\n');
  }

  return JSON.stringify(content);
}

async function testRouterFormat() {
  console.log('🔍 Testing Router Request Format...\n');

  // This is the format our router receives from Claude Code
  const anthropicRequest = {
    model: 'claude-sonnet-4-20250514', 
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '测试一下路由功能'
          }
        ]
      }
    ],
    max_tokens: 4096,
    temperature: undefined,
    metadata: {
      system: [
        { text: 'You are Claude, an AI assistant created by Anthropic.' }
      ]
    }
  };

  console.log('📋 Original Anthropic Request:');
  console.log(JSON.stringify(anthropicRequest, null, 2));

  // Convert to OpenAI format like our router does
  const openaiRequest = convertToOpenAI(anthropicRequest);
  openaiRequest.model = 'gemini-2.5-pro'; // Map to shuaihong model

  console.log('\n📋 Converted OpenAI Request:');
  console.log(JSON.stringify(openaiRequest, null, 2));

  // Test with the converted request
  const config = {
    endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
    apiKey: '${SHUAIHONG_API_KEY}'
  };

  try {
    console.log('\n⏳ Sending converted request...\n');

    const response = await axios.post(config.endpoint, openaiRequest, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Success!');
    console.log(`📊 Status: ${response.status}`);
    console.log(`📝 Response:`, JSON.stringify(response.data, null, 2));

    // Check if content is empty
    const content = response.data.choices?.[0]?.message?.content;
    if (!content || content.trim() === '') {
      console.log('\n⚠️  WARNING: Response content is empty!');
      console.log('🔍 This suggests the API hit token limits or has other issues.');
      
      // Try with lower max_tokens
      console.log('\n🔧 Trying with lower max_tokens...');
      const lowTokenRequest = { ...openaiRequest, max_tokens: 100 };
      
      const retryResponse = await axios.post(config.endpoint, lowTokenRequest, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`📝 Retry Response:`, JSON.stringify(retryResponse.data, null, 2));
    }

  } catch (error) {
    console.log('❌ Request failed');
    
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📝 Response:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`💥 Error: ${error.message}`);
    }
  }
}

async function testDifferentConfigurations() {
  console.log('\n🧪 Testing Different Configurations...\n');

  const baseRequest = {
    model: 'gemini-2.5-pro',
    messages: [
      {
        role: 'user',
        content: '简单回复：你好'
      }
    ]
  };

  const configs = [
    { ...baseRequest, max_tokens: 50, name: 'Low tokens (50)' },
    { ...baseRequest, max_tokens: 100, name: 'Medium tokens (100)' },
    { ...baseRequest, max_tokens: 1000, name: 'High tokens (1000)' },
    { ...baseRequest, temperature: 0.7, max_tokens: 100, name: 'With temperature' },
    { ...baseRequest, max_tokens: 100, name: 'Without max_tokens' }
  ];

  // Remove max_tokens from last config
  delete configs[configs.length - 1].max_tokens;

  const apiConfig = {
    endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
    apiKey: '${SHUAIHONG_API_KEY}'
  };

  for (const testConfig of configs) {
    console.log(`\n🧪 Testing: ${testConfig.name}`);
    console.log(`📋 Request: ${JSON.stringify(testConfig, null, 2)}`);

    try {
      const response = await axios.post(apiConfig.endpoint, testConfig, {
        headers: {
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      const content = response.data.choices?.[0]?.message?.content || '';
      const finishReason = response.data.choices?.[0]?.finish_reason;
      
      console.log(`✅ ${testConfig.name}: "${content}" (${finishReason})`);
      
    } catch (error) {
      console.log(`❌ ${testConfig.name}: Failed`);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run tests
async function main() {
  console.log('🚀 Router Request Format Debug Tool\n');
  console.log('=' .repeat(60));
  
  await testRouterFormat();
  await testDifferentConfigurations();
  
  console.log('\n🏁 Debug session completed');
}

main().catch(console.error);