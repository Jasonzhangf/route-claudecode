/**
 * LM Studio Integration Test
 * Tests the LM Studio provider integration with Claude Code Router
 */

const http = require('http');
const fs = require('fs');

// Load LM Studio configuration
const configPath = process.env.LM_STUDIO_CONFIG || '~/.route-claude-code/config.lmstudio.json';
const resolvedPath = configPath.replace('~', process.env.HOME);

let config;
try {
  const configContent = fs.readFileSync(resolvedPath, 'utf8');
  config = JSON.parse(configContent);
  console.log('✅ Loaded LM Studio configuration from:', resolvedPath);
} catch (error) {
  console.error('❌ Failed to load LM Studio configuration:', error.message);
  process.exit(1);
}

// Test configuration
const TEST_PORT = config.server.port || 3456;  // Use configured port or default
const TEST_HOST = config.server.host || 'localhost';

// Sample test request
const testRequest = {
  "model": "claude-sonnet-4-20250514",  // This will be routed to LM Studio
  "messages": [
    {
      "role": "user",
      "content": "Hello! This is a test message to verify LM Studio integration."
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
};

console.log('\n🧪 Testing LM Studio Integration');
console.log('📍 Target:', `http://${TEST_HOST}:${TEST_PORT}/v1/messages`);
console.log('📝 Test message:', testRequest.messages[0].content);

// Send test request
const postData = JSON.stringify(testRequest);

const options = {
  hostname: TEST_HOST,
  port: TEST_PORT,
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let responseData = '';

  console.log('\n📡 Response Status:', res.statusCode);
  console.log('📨 Response Headers:', res.headers);

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(responseData);
      console.log('\n✅ Response Body:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.model) {
        console.log('\n🎯 Model Used:', response.model);
      }
      
      if (response.content) {
        console.log('\n📝 Response Content:');
        console.log(response.content.map(c => c.text).join(''));
      }
      
      console.log('\n🎉 LM Studio Integration Test Completed Successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Failed to parse response:', error.message);
      console.error(' Raw response:', responseData);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  console.error(' Error details:', error);
  process.exit(1);
});

req.write(postData);
req.end();