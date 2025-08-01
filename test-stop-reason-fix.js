#!/usr/bin/env node

/**
 * Test OpenAI Streaming Stop Reason Fix
 * 
 * 测试用例：验证OpenAI流式响应的正确结束行为，确保多轮对话不会意外终止
 */

const axios = require('axios');

const ROUTER_URL = 'http://localhost:5507/v1/messages';
const TEST_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  messages: [
    {
      role: 'user', 
      content: '请简单回复"测试完成"'
    }
  ],
  max_tokens: 100,
  stream: true
};

async function testStopReasonFix() {
  console.log('🧪 Testing OpenAI Streaming Stop Reason Fix...');
  console.log('===============================================');
  
  const startTime = Date.now();
  
  try {
    console.log('📤 Sending streaming request...');
    console.log('Request:', JSON.stringify(TEST_REQUEST, null, 2));
    
    const response = await axios.post(ROUTER_URL, TEST_REQUEST, {
      headers: {
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 30000
    });
    
    console.log('✅ Response received, processing stream...');
    
    let eventCount = 0;
    let hasMessageStart = false;
    let hasMessageStop = false;
    let hasStopReason = false;
    let finalStopReason = null;
    let receivedContent = '';
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const event = JSON.parse(data);
              eventCount++;
              
              // Debug: print raw event
              console.log(`📝 Event ${eventCount}: ${event.event || 'UNKNOWN'}`, {
                rawEvent: JSON.stringify(event, null, 2)
              });
              
              // Track important events
              if (event.event === 'message_start') {
                hasMessageStart = true;
              }
              
              if (event.event === 'message_stop') {
                hasMessageStop = true;
              }
              
              if (event.data?.delta?.stop_reason) {
                hasStopReason = true;
                finalStopReason = event.data.delta.stop_reason;
              }
              
              if (event.data?.delta?.text) {
                receivedContent += event.data.delta.text;
              }
              
            } catch (parseError) {
              console.log('⚠️  Failed to parse event:', line);
            }
          }
        }
      });
      
      response.data.on('end', () => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        console.log('🏁 Stream completed');
        console.log('================');
        console.log('📊 Analysis Results:');
        console.log('- Total events:', eventCount);
        console.log('- Has message_start:', hasMessageStart);
        console.log('- Has message_stop:', hasMessageStop);
        console.log('- Has stop_reason:', hasStopReason);
        console.log('- Final stop_reason:', finalStopReason);
        console.log('- Duration:', `${duration}s`);
        console.log('- Content received:', receivedContent);
        
        console.log('\n🔍 Validation:');
        
        if (hasMessageStart) {
          console.log('✅ PASS: message_start event found');
        } else {
          console.log('❌ FAIL: message_start event missing');
        }
        
        if (hasMessageStop) {
          console.log('✅ PASS: message_stop event found - stream properly ended');
        } else {
          console.log('❌ FAIL: message_stop event missing - stream may not end properly');
        }
        
        if (hasStopReason && finalStopReason) {
          console.log(`✅ PASS: stop_reason found - ${finalStopReason}`);
        } else {
          console.log('❌ FAIL: stop_reason missing - client may not know when to stop');
        }
        
        if (receivedContent.length > 0) {
          console.log('✅ PASS: Content received');
        } else {
          console.log('❌ FAIL: No content received');
        }
        
        console.log('\n📋 Summary:');
        if (hasMessageStart && hasMessageStop && hasStopReason && receivedContent.length > 0) {
          console.log('🎉 SUCCESS: Stop reason fix is working correctly!');
          console.log('✅ Multi-turn conversations should now work properly.');
        } else {
          console.log('❌ FAILURE: Stop reason fix is not working correctly.');
          console.log('⚠️  Multi-turn conversations may still have issues.');
        }
        
        resolve();
      });
      
      response.data.on('error', (error) => {
        console.log('❌ Stream error:', error.message);
        reject(error);
      });
    });
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️  Request duration: ${duration}s`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ ERROR: Router service not running on port 5507');
      console.log('💡 Solution: Check if the service is running on the correct port');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('⏱️  Request timed out - may indicate streaming issues');
    } else {
      console.log('❌ Request failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
  }
}

// Run the test
testStopReasonFix().catch(console.error);