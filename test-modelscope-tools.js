/**
 * Test ModelScope OpenAI API tool calling support
 * Project owner: Jason Zhang
 */

async function testModelScopeTools() {
  console.log('🧪 Testing ModelScope OpenAI API with tools...\n');

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
        content: 'What is the current weather in Beijing?'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a city',
          parameters: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'The city name'
              }
            },
            required: ['city']
          }
        }
      }
    ],
    tool_choice: 'auto',
    max_tokens: 200,
    temperature: 0.7
  };

  console.log('📤 Request configuration:');
  console.log(`   Endpoint: ${config.endpoint}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   Tools: ${requestData.tools.length} tool(s) defined`);
  console.log(`   Tool Choice: ${requestData.tool_choice}\n`);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(30000)
    });

    console.log('📥 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:');
      console.log(errorText);
      
      console.log('\n🔍 Analysis:');
      if (errorText.includes('tools') || errorText.includes('tool_choice')) {
        console.log('   - Tools are not supported by this API endpoint');
        console.log('   - This confirms we need to filter out tool_result messages');
      } else if (errorText.includes('Invalid value')) {
        console.log('   - Invalid parameter values detected');
      }
      
      return false;
    }

    const responseData = await response.json();
    console.log('✅ Response received (with tools):');
    console.log(JSON.stringify(responseData, null, 2));

    // Check if tool calls are present
    const hasToolCalls = responseData.choices?.[0]?.message?.tool_calls?.length > 0;
    console.log(`\n🔍 Tool calling support: ${hasToolCalls ? 'YES' : 'NO'}`);
    
    if (hasToolCalls) {
      console.log('   - API supports OpenAI-style tool calling');
      console.log(`   - Tool calls detected: ${responseData.choices[0].message.tool_calls.length}`);
    } else {
      console.log('   - API does not support tool calling or chose not to use tools');
      console.log('   - Response is regular text message');
    }

    return true;

  } catch (error) {
    console.log('❌ Request failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Also test without tools for comparison
async function testModelScopeWithoutTools() {
  console.log('\n🧪 Testing same request without tools (for comparison)...\n');

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
        content: 'What is the current weather in Beijing?'
      }
    ],
    max_tokens: 200,
    temperature: 0.7
  };

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(30000)
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Response without tools:');
      console.log(`   Content: "${responseData.choices?.[0]?.message?.content || 'No content'}"`);
      console.log(`   Tokens used: ${responseData.usage?.total_tokens || 'N/A'}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Even basic request failed:', errorText);
      return false;
    }

  } catch (error) {
    console.log('❌ Basic request failed:', error.message);
    return false;
  }
}

// Run both tests
async function runAllTests() {
  const toolsTest = await testModelScopeTools();
  const basicTest = await testModelScopeWithoutTools();
  
  console.log('\n🎯 Test Results Summary:');
  console.log(`   Tools support test: ${toolsTest ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Basic request test: ${basicTest ? 'SUCCESS' : 'FAILED'}`);
  
  if (!toolsTest && basicTest) {
    console.log('\n💡 Conclusion: API works but does not support tools');
    console.log('   - Safe to use with OpenAI provider format');
    console.log('   - Tool-related messages should be filtered out');
  }
  
  return toolsTest && basicTest;
}

runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });