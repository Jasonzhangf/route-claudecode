#!/usr/bin/env node

/**
 * Step 1: Test complete API request chain accessibility
 * Goal: Test complete API request chain and tool definitions
 * Input: Raw Anthropic API request (model, messages, max_tokens, tools)
 * Output: Complete API response data → save to step1-output.json
 */

const fs = require('fs');
const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3456';

const testRequest = {
  model: "claude-3-5-haiku-20241022",
  max_tokens: 100,
  messages: [
    {
      role: "user",
      content: "Could you help me read the file /tmp/test-single.json and tell me what's in it?"
    }
  ],
  tools: [
    {
      name: "Read",
      description: "Reads a file from the local filesystem",
      input_schema: {
        type: "object",
        properties: {
          file_path: {
            description: "The absolute path to the file to read",
            type: "string"
          }
        },
        required: ["file_path"]
      }
    }
  ]
};

async function testStep1() {
  console.log('🔍 Step 1: Testing complete API request chain with tools');
  console.log('Request details:', {
    model: testRequest.model,
    messageCount: testRequest.messages.length,
    toolCount: testRequest.tools.length,
    toolNames: testRequest.tools.map(t => t.name)
  });

  try {
    console.log('📤 Sending request to router...');
    const response = await axios.post(`${BASE_URL}/v1/messages`, testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test'
      }
    });

    const output = {
      request: testRequest,
      response: response.data,
      status: response.status,
      headers: response.headers,
      timestamp: new Date().toISOString()
    };

    // Save output for step 2
    fs.writeFileSync('step1-output.json', JSON.stringify(output, null, 2));
    
    console.log('✅ Step 1 Success:');
    console.log('  - Request sent successfully');
    console.log('  - Response received:', response.status);
    console.log('  - Response type:', typeof response.data);
    console.log('  - Has content:', !!response.data.content);
    console.log('  - Content length:', response.data.content?.length || 0);
    console.log('  - Tool usage:', response.data.usage?.input_tokens, 'input tokens');
    console.log('  - Output saved to step1-output.json');

    return true;
  } catch (error) {
    console.error('❌ Step 1 Failed:');
    console.error('  - Error:', error.message);
    console.error('  - Status:', error.response?.status);
    console.error('  - Data:', error.response?.data);
    return false;
  }
}

if (require.main === module) {
  testStep1().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testStep1 };