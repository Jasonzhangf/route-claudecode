#!/usr/bin/env node
/**
 * Debug script to test CodeWhisperer streaming response
 * Tests the streaming issue where requests complete but no content is returned
 */

const axios = require('axios');
const { setTimeout } = require('timers/promises');

const BASE_URL = 'http://127.0.0.1:3456';

/**
 * Test streaming request to identify the issue
 */
async function testStreamingIssue() {
  console.log('🔍 Debugging CodeWhisperer streaming issue...\n');

  const testPayload = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    stream: true,
    messages: [
      {
        role: "user",
        content: "Hello, can you say 'test response' back to me?"
      }
    ]
  };

  try {
    console.log('📤 Sending streaming request...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/v1/messages`,
      data: testPayload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 30000
    });

    console.log(`✅ Response status: ${response.status}`);
    console.log('Response headers:', response.headers);
    console.log('\n📨 SSE Events received:');

    let eventCount = 0;
    let dataReceived = '';

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      console.log(`Chunk ${++eventCount}:`, JSON.stringify(chunkStr));
      dataReceived += chunkStr;
    });

    response.data.on('end', () => {
      console.log('\n🏁 Stream ended');
      console.log(`📊 Total events: ${eventCount}`);
      console.log('📄 Full response data:');
      console.log(dataReceived);
      
      if (!dataReceived.trim()) {
        console.log('❌ No data received - this is the issue!');
      } else {
        console.log('✅ Data received successfully');
      }
    });

    response.data.on('error', (error) => {
      console.error('❌ Stream error:', error.message);
    });

    // Wait for stream to complete
    await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
      setTimeout(30000).then(() => reject(new Error('Stream timeout')));
    });

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Test non-streaming request for comparison
 */
async function testNonStreamingRequest() {
  console.log('\n🔍 Testing non-streaming request for comparison...\n');

  const testPayload = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    stream: false,
    messages: [
      {
        role: "user",
        content: "Hello, can you say 'test response' back to me?"
      }
    ]
  };

  try {
    console.log('📤 Sending non-streaming request...');

    const response = await axios.post(`${BASE_URL}/v1/messages`, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`✅ Response status: ${response.status}`);
    console.log('📄 Response data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Non-streaming request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Check server status
 */
async function checkServerStatus() {
  console.log('🔍 Checking server status...\n');

  try {
    const response = await axios.get(`${BASE_URL}/status`);
    console.log('✅ Server status:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Server status check failed:', error.message);
    return false;
  }

  return true;
}

/**
 * Main debug function
 */
async function main() {
  console.log('🚀 Starting CodeWhisperer streaming debug...\n');

  // Check if server is running
  const serverOk = await checkServerStatus();
  if (!serverOk) {
    console.log('💡 Please start the server with: ccr start');
    process.exit(1);
  }

  // Test non-streaming first
  await testNonStreamingRequest();

  // Wait a bit
  await setTimeout(2000);

  // Test streaming (the problematic case)
  await testStreamingIssue();

  console.log('\n🏁 Debug complete');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}