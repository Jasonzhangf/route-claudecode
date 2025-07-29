/**
 * Test ModelScope OpenAI API compatibility
 * Project owner: Jason Zhang
 */

const https = require('https');

async function testModelScopeOpenAI() {
  console.log('🧪 Testing ModelScope OpenAI API...\n');

  const config = {
    endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions',
    apiKey: 'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
  };

  const requestData = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: 'Hello, please respond with a simple greeting in Chinese.'
      }
    ],
    max_tokens: 100,
    temperature: 0.7
  };

  console.log('📤 Request configuration:');
  console.log(`   Endpoint: ${config.endpoint}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   API Key: ${config.apiKey.substring(0, 10)}...`);
  console.log(`   Messages: ${requestData.messages.length} message(s)\n`);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`   ${key}: ${value}`);
    }
    console.log();

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response body:');
      console.log(errorText);
      console.log('\n🔍 Analysis:');
      
      if (response.status === 401) {
        console.log('   - Authentication failed. Check API key validity.');
      } else if (response.status === 400) {
        console.log('   - Bad request. Check request format and parameters.');
      } else if (response.status === 403) {
        console.log('   - Forbidden. Check API permissions and quotas.');
      } else if (response.status === 404) {
        console.log('   - Not found. Check endpoint URL and model name.');
      } else if (response.status >= 500) {
        console.log('   - Server error. ModelScope service may be temporarily unavailable.');
      }
      
      return false;
    }

    const responseData = await response.json();
    console.log('✅ Successful response received!');
    console.log('📄 Response structure:');
    console.log(JSON.stringify(responseData, null, 2));

    // Validate OpenAI format
    console.log('\n🔍 OpenAI format validation:');
    const isValidOpenAI = validateOpenAIFormat(responseData);
    
    if (isValidOpenAI) {
      console.log('✅ Response follows OpenAI chat completion format');
      console.log(`   - Model: ${responseData.model || 'Not specified'}`);
      console.log(`   - Choices: ${responseData.choices?.length || 0}`);
      if (responseData.choices?.[0]?.message?.content) {
        console.log(`   - Content: "${responseData.choices[0].message.content.substring(0, 100)}${responseData.choices[0].message.content.length > 100 ? '...' : ''}"`);
      }
      if (responseData.usage) {
        console.log(`   - Usage: ${responseData.usage.total_tokens || 'N/A'} total tokens`);
      }
    } else {
      console.log('⚠️  Response does not fully follow OpenAI format');
    }

    return true;

  } catch (error) {
    console.log('❌ Request failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('   - DNS resolution failed. Check network connection and endpoint URL.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   - Connection refused. Service may be down.');
    } else if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
      console.log('   - Request timeout. Service may be slow or overloaded.');
    } else if (error.name === 'AbortError') {
      console.log('   - Request aborted due to timeout.');
    }
    
    return false;
  }
}

function validateOpenAIFormat(response) {
  const required = [
    'id',
    'object', 
    'created',
    'model',
    'choices'
  ];
  
  const missing = required.filter(field => !(field in response));
  if (missing.length > 0) {
    console.log(`   Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (!Array.isArray(response.choices) || response.choices.length === 0) {
    console.log('   Invalid choices array');
    return false;
  }

  const choice = response.choices[0];
  if (!choice.message || typeof choice.message.content !== 'string') {
    console.log('   Invalid message content structure');
    return false;
  }

  return true;
}

// Run the test
testModelScopeOpenAI()
  .then(success => {
    console.log(`\n🎯 Test result: ${success ? 'SUCCESS' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });