#!/usr/bin/env node

/**
 * Test different models available on shuaihong API
 */

const axios = require('axios');

async function testModel(modelName, testName) {
  console.log(`\n🧪 Testing ${testName} (${modelName})`);

  const request = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: 'Hello, please respond with "Hi there!"'
      }
    ],
    max_tokens: 50,
    temperature: 0.3
  };

  const config = {
    endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
    apiKey: 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
  };

  try {
    const response = await axios.post(config.endpoint, request, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const content = response.data.choices?.[0]?.message?.content || '';
    const finishReason = response.data.choices?.[0]?.finish_reason;
    const status = content.trim() ? '✅' : '⚠️ ';
    
    console.log(`${status} ${testName}: "${content}" (${finishReason})`);
    
    return { success: true, content, finishReason };
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏱️  ${testName}: Timeout`);
    } else if (error.response) {
      console.log(`❌ ${testName}: HTTP ${error.response.status}`);
    } else {
      console.log(`❌ ${testName}: ${error.message}`);
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Shuaihong Model Testing\n');
  console.log('=' .repeat(50));

  // Based on the config, these models should be available
  const models = [
    { name: 'gemini-2.5-pro', display: 'Gemini 2.5 Pro' },
    { name: 'gpt-4o', display: 'GPT-4o' },
    { name: 'gemini-2.5-flash', display: 'Gemini 2.5 Flash' },
    { name: 'gemini-2.5-pro-preview-05-06', display: 'Gemini 2.5 Pro Preview (May)' },
    { name: 'gemini-2.5-pro-preview-06-05', display: 'Gemini 2.5 Pro Preview (June)' },
    { name: 'qwen3-coder', display: 'Qwen3 Coder' }
  ];

  const results = [];

  for (const model of models) {
    const result = await testModel(model.name, model.display);
    results.push({ model: model.display, ...result });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Summary:');
  console.log('=' .repeat(50));
  
  const workingModels = results.filter(r => r.success && r.content?.trim());
  const emptyModels = results.filter(r => r.success && !r.content?.trim());
  const failedModels = results.filter(r => !r.success);
  
  console.log(`✅ Working models (${workingModels.length}):`);
  workingModels.forEach(m => console.log(`   - ${m.model}`));
  
  console.log(`⚠️  Empty response models (${emptyModels.length}):`);
  emptyModels.forEach(m => console.log(`   - ${m.model} (${m.finishReason})`));
  
  console.log(`❌ Failed models (${failedModels.length}):`);
  failedModels.forEach(m => console.log(`   - ${m.model}`));

  if (workingModels.length > 0) {
    console.log(`\n💡 Recommendation: Use ${workingModels[0].model} for routing`);
  } else {
    console.log('\n⚠️  No models are working properly - API might have issues');
  }
}

main().catch(console.error);