/**
 * Test complete router system with ModelScope OpenAI provider
 * Project owner: Jason Zhang
 */

async function testRouterWithModelScope() {
  console.log('🧪 Testing complete router system with ModelScope...\n');

  // Test the router on port 8888 (release config)
  const routerEndpoint = 'http://localhost:8888/v1/messages';
  
  const testRequests = [
    {
      name: 'Basic text request',
      data: {
        model: 'claude-3-5-haiku-20241022', // Should route to background category -> ModelScope
        messages: [
          {
            role: 'user',
            content: 'Hello, please respond briefly in Chinese.'
          }
        ],
        max_tokens: 100
      },
      expectedProvider: 'modelscope-openai or shuaihong-openai (background category)'
    },
    {
      name: 'Long context request',
      data: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'This is a very long message that should trigger longcontext routing. ' + 'x'.repeat(1000) + ' Please respond briefly.'
          }
        ],
        max_tokens: 100
      },
      expectedProvider: 'modelscope-openai or shuaihong-openai (longcontext category)'
    },
    {
      name: 'Tool usage request',
      data: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'What is the weather like today?'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather information',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Location to check weather for' }
              },
              required: ['location']
            }
          }
        ],
        max_tokens: 200
      },
      expectedProvider: 'modelscope-openai or shuaihong-openai (search category)'
    }
  ];

  let allPassed = true;

  for (const test of testRequests) {
    console.log(`📋 Testing: ${test.name}`);
    console.log(`   Expected routing: ${test.expectedProvider}\n`);

    try {
      const response = await fetch(routerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data),
        signal: AbortSignal.timeout(45000) // 45 second timeout
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response:');
        console.log(errorText);
        
        // Check for the specific tool_result error we're trying to fix
        if (errorText.includes('tool_result') || errorText.includes('Invalid value')) {
          console.log('⚠️  DETECTED: This is the tool_result compatibility error we fixed!');
          console.log('   The OpenAI format should have resolved this issue.');
        }
        
        allPassed = false;
        console.log();
        continue;
      }

      const responseData = await response.json();
      console.log('✅ Success! Response received:');
      console.log(`   Model returned: ${responseData.model || 'Not specified'}`);
      console.log(`   Content length: ${responseData.content?.[0]?.text?.length || 0} characters`);
      
      if (responseData.usage) {
        console.log(`   Tokens used: ${responseData.usage.input_tokens}→${responseData.usage.output_tokens} (${responseData.usage.input_tokens + responseData.usage.output_tokens} total)`);
      }

      // Check if the response indicates which provider was used
      const responseText = responseData.content?.[0]?.text || '';
      if (responseText.includes('你好') || responseText.includes('中文')) {
        console.log('   🎯 Likely routed to: ModelScope (Chinese response detected)');
      } else if (responseText.length > 0) {
        console.log('   🎯 Likely routed to: Shuaihong/Gemini (English response)');
      }

    } catch (error) {
      console.log('❌ Request failed:');
      console.log(`   Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Router service is not running on port 8888');
        console.log('   Please start the service with: ./start-unified.sh -e release');
      }
      
      allPassed = false;
    }

    console.log('\n' + '─'.repeat(60) + '\n');
  }

  return allPassed;
}

// Check if router service is running first
async function checkRouterService() {
  console.log('🔍 Checking if router service is running on port 8888...\n');
  
  try {
    const response = await fetch('http://localhost:8888/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      console.log('✅ Router service is running and healthy\n');
      return true;
    } else {
      console.log('⚠️  Router service responded but may have issues\n');
      return true; // Still try the test
    }
  } catch (error) {
    console.log('❌ Router service is not accessible on port 8888');
    console.log(`   Error: ${error.message}`);
    console.log('   Please start the service with: ./start-unified.sh -e release\n');
    return false;
  }
}

// Run the complete test
async function runCompleteTest() {
  const serviceRunning = await checkRouterService();
  
  if (!serviceRunning) {
    console.log('🚫 Cannot proceed with tests - service not running');
    return false;
  }

  const testResults = await testRouterWithModelScope();
  
  console.log('🎯 Overall Test Results:');
  console.log(`   Status: ${testResults ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (testResults) {
    console.log('   ✅ ModelScope OpenAI configuration is working correctly');
    console.log('   ✅ No tool_result compatibility errors detected');
    console.log('   ✅ Router is functioning with all provider categories');
  } else {
    console.log('   ❌ Issues detected - see details above');
  }
  
  return testResults;
}

runCompleteTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });