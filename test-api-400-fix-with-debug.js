#!/usr/bin/env node

console.log('🧪 Testing API 400 error fix with debug output...\n');

const testRequest = {
  model: "ZhipuAI/GLM-4.5-Air",
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "Hello, this should work now with format fixes applied!"
      }
    }
  ],
  max_tokens: 150,
  stream: false
};

console.log('🔍 Sending request with problematic format (message content as object)');
console.log('Expected: Universal fix should convert content to proper format');
console.log();

const makeRequest = async () => {
  try {
    const response = await fetch('http://localhost:5509/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
    } else {
      const result = await response.json();
      console.log(`✅ Success! Response:`, JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.log(`🚨 Request failed: ${error.message}`);
  }
};

makeRequest();