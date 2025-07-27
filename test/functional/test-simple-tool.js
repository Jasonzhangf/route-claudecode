#!/usr/bin/env node

const axios = require('axios');

async function simpleTest() {
  console.log('Testing simple tool call...');
  
  try {
    const response = await axios.post('http://127.0.0.1:3456/v1/messages?beta=true', {
      model: "claude-sonnet-4-20250514",
      max_tokens: 131072,
      stream: true,
      messages: [{ role: "user", content: "read /tmp/test.txt" }],
      tools: [{ name: "Read", description: "read file", input_schema: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] } }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': 'Bearer test-key',
        'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
      },
      responseType: 'stream',
      timeout: 10000
    });

    console.log('Response received');
    
    // Just wait for stream to complete
    await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
    
    console.log('Stream completed');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

simpleTest();