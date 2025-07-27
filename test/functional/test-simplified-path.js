#!/usr/bin/env node

const axios = require('axios');

async function testMinimalRequest() {
  const request = {
  "model": "claude-3-5-haiku-20241022",
  "messages": [
    {
      "role": "user",
      "content": "test"
    }
  ],
  "max_tokens": 131072
};
  
  try {
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer any-string-is-ok',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ Minimal request succeeded');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Minimal request failed');
    console.error('Error:', error.response?.data || error.message);
  }
}

async function testToolCallRequest() {
  const request = {
  "model": "claude-3-5-haiku-20241022",
  "messages": [
    {
      "role": "user",
      "content": "Call test tool"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "I will call the test tool."
        },
        {
          "type": "tool_use",
          "id": "test_123",
          "name": "test_tool",
          "input": {
            "param": "value"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "test_123",
          "content": "Tool result"
        }
      ]
    }
  ],
  "max_tokens": 131072,
  "tools": [
    {
      "name": "test_tool",
      "description": "A test tool",
      "input_schema": {
        "type": "object",
        "properties": {
          "param": {
            "type": "string"
          }
        }
      }
    }
  ]
};
  
  try {
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer any-string-is-ok',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ Tool call request succeeded');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Tool call request failed');
    console.error('Error:', error.response?.data || error.message);
  }
}

// 运行测试
async function runTests() {
  console.log('🚀 Running simplified test path...');
  await testMinimalRequest();
  await testToolCallRequest();
}

runTests().catch(console.error);
