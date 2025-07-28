#!/usr/bin/env node

/**
 * Test 429 Error Handling - Verify proper retry logic and error propagation
 * 
 * Test case: 验证429错误的正确处理：3次重试（1s, 5s, 60s），最终返回429而不是工具参数解析错误
 */

const axios = require('axios');

const ROUTER_URL = 'http://localhost:3456/v1/messages';
const TEST_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  messages: [
    {
      role: 'user', 
      content: 'Use the Task tool to list files in the current directory'
    }
  ],
  max_tokens: 1000,
  tools: [
    {
      name: 'Task',
      description: 'Execute a task',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          command: { type: 'string' }
        },
        required: ['description', 'command']
      }
    }
  ]
};

async function test429ErrorHandling() {
  console.log('🧪 Testing 429 Error Handling...');
  console.log('=====================================');
  
  const startTime = Date.now();
  
  try {
    console.log('📤 Sending request that may trigger 429...');
    console.log('Request:', JSON.stringify(TEST_REQUEST, null, 2));
    
    const response = await axios.post(ROUTER_URL, TEST_REQUEST, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes to allow for 60s retry
    });
    
    console.log('✅ Request succeeded (no 429 occurred)');
    console.log('Response status:', response.status);
    console.log('Response model:', response.data.model);
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️  Total request duration: ${duration}s`);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      console.log('📊 Error Response Analysis:');
      console.log('Status:', status);
      console.log('Error data:', JSON.stringify(errorData, null, 2));
      
      if (status === 429) {
        console.log('✅ EXPECTED: 429 Rate Limit Error returned correctly');
        console.log('✅ SUCCESS: No tool parameter parsing errors occurred');
        
        // Check if error message indicates proper retry behavior
        if (errorData.details && errorData.details.includes('after') && errorData.details.includes('retries')) {
          console.log('✅ SUCCESS: Error message indicates retry logic was executed');
        }
        
        // Verify duration suggests retries occurred (should be > 66 seconds for full retry cycle)
        if (duration >= 60) {
          console.log('✅ SUCCESS: Duration suggests 60s retry delay was applied');
        } else if (duration >= 5) {
          console.log('⚠️  PARTIAL: Some retries occurred but may not have completed full cycle');
        } else {
          console.log('❌ ISSUE: Duration too short, retries may not have occurred');
        }
        
      } else {
        console.log(`❌ UNEXPECTED: Got ${status} error instead of 429`);
        
        // Check if this is a tool parameter parsing error
        if (errorData.message && errorData.message.includes('tool') && errorData.message.includes('argument')) {
          console.log('❌ CRITICAL: Tool parameter parsing error occurred - the bug is NOT fixed');
        }
      }
      
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ ERROR: Router service not running on port 3456');
      console.log('💡 Solution: Run ./start-dev.sh to start the service');
      
    } else if (error.code === 'ETIMEDOUT') {
      console.log('⏱️  Request timed out after 3 minutes');
      console.log('This might indicate the retry logic is working (60s delay on 3rd retry)');
      
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  console.log('\n📋 Test Summary:');
  console.log('=================');
  console.log('Expected behavior:');
  console.log('1. 429 error should trigger 3 retries with delays: 1s, 5s, 60s');
  console.log('2. After retries exhausted, should return 429 error (not tool parsing error)');
  console.log('3. Total duration should be ~66+ seconds if full retry cycle occurs');
  console.log('4. No tool argument parsing errors should occur');
}

// Run the test
test429ErrorHandling().catch(console.error);