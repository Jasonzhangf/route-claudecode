#!/usr/bin/env node

/**
 * Test 5508 port finish reason fix
 * Verify that proper OpenAI -> Anthropic finish reason mapping is applied
 */

const http = require('http');

const TEST_CONFIG = {
  port: 5508,
  timeout: 15000,
  testData: {
    model: 'qwen3-coder',
    messages: [
      {
        role: 'user',
        content: 'Hello, please just say "Hi back!" and nothing more.'
      }
    ]
  }
};

async function testFinishReasonFix() {
  console.log('🔧 Testing 5508 port finish reason fix');
  console.log('=====================================');
  
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(TEST_CONFIG.testData);
    
    const options = {
      hostname: 'localhost',
      port: TEST_CONFIG.port,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        'Authorization': 'Bearer test-key'
      },
      timeout: TEST_CONFIG.timeout
    };

    console.log(`📤 Sending simple test request to port ${TEST_CONFIG.port}...`);
    
    const req = http.request(options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
        process.stdout.write('.');
      });
      
      res.on('end', () => {
        console.log('\n✅ Response received');
        
        try {
          // Check for finish reason in response
          console.log('📊 Response analysis:');
          console.log('- Response length:', responseData.length);
          
          // Look for stop_reason in response
          if (responseData.includes('stop_reason')) {
            const stopReasonMatch = responseData.match(/"stop_reason":\s*"([^"]+)"/);
            if (stopReasonMatch) {
              const stopReason = stopReasonMatch[1];
              console.log('- Stop reason found:', stopReason);
              
              if (stopReason === 'end_turn') {
                console.log('✅ SUCCESS: Proper Anthropic stop_reason "end_turn" found');
                console.log('✅ Fix is working - OpenAI "stop" properly mapped to Anthropic "end_turn"');
              } else {
                console.log('⚠️  Unexpected stop reason:', stopReason);
              }
            } else {
              console.log('❌ No stop_reason field found in response');
            }
          } else {
            console.log('⚠️  No stop_reason found in response data');
          }
          
          // Check for "Hi back!" in response to confirm it's working
          if (responseData.includes('Hi back')) {
            console.log('✅ Content verification: Response contains expected text');
          }
          
          resolve(responseData);
        } catch (parseError) {
          console.log('⚠️  Response analysis error:', parseError.message);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      reject(new Error('Request timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

// Check if server is running first
async function checkServer() {
  return new Promise((resolve, reject) => {
    const healthCheck = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.port,
      path: '/health',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Server is running on port ${TEST_CONFIG.port}`);
        resolve(true);
      } else {
        reject(new Error(`Server health check failed: ${res.statusCode}`));
      }
    });
    
    healthCheck.on('error', (error) => {
      reject(new Error(`Server not available on port ${TEST_CONFIG.port}: ${error.message}`));
    });
    
    healthCheck.end();
  });
}

async function runTest() {
  try {
    console.log('🔍 Checking server availability...');
    await checkServer();
    
    console.log('\n🧪 Running finish reason test...');
    const response = await testFinishReasonFix();
    
    console.log('\n📋 Next steps:');
    console.log('1. Check logs for finish_reason.log files');
    console.log('2. Verify no automatic session termination occurs');
    console.log('3. Test multi-turn conversation capability');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log(`1. Start server: rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug`);
    console.log('2. Wait for server to start completely');
    console.log('3. Run this test again');
  }
}

runTest();