#!/usr/bin/env node

/**
 * LM Studio Basic Connectivity Test
 * Tests basic connectivity to LM Studio server
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Load test configuration
const configPath = path.join(__dirname, 'config-lmstudio-test.json');
let config;

try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
  console.log('✅ Loaded LM Studio test configuration');
} catch (error) {
  console.error('❌ Failed to load configuration:', error.message);
  process.exit(1);
}

// Get LM Studio provider configuration
const lmstudioProvider = config.providers['lmstudio-glm'];
if (!lmstudioProvider) {
  console.error('❌ LM Studio provider not found in configuration');
  process.exit(1);
}

console.log('\n📋 LM Studio Configuration:');
console.log('=========================');
console.log(`Endpoint: ${lmstudioProvider.endpoint}`);
console.log(`Model: ${lmstudioProvider.defaultModel}`);
console.log(`Authentication: ${lmstudioProvider.authentication.type}`);

// Test request
const testRequest = {
  model: lmstudioProvider.defaultModel,
  messages: [
    {
      role: "user",
      content: "Hello! Please respond with a brief greeting."
    }
  ],
  max_tokens: 100,
  temperature: 0.7
};

console.log('\n📤 Test Request:');
console.log('===============');
console.log(JSON.stringify(testRequest, null, 2));

// Parse endpoint URL
const url = new URL(lmstudioProvider.endpoint);
const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': JSON.stringify(testRequest).length
  }
};

// Add authentication if needed
if (lmstudioProvider.authentication.type === 'bearer' && lmstudioProvider.authentication.credentials) {
  const apiKey = lmstudioProvider.authentication.credentials.apiKey || lmstudioProvider.authentication.credentials.api_key;
  if (apiKey) {
    options.headers['Authorization'] = `Bearer ${Array.isArray(apiKey) ? apiKey[0] : apiKey}`;
  }
}

console.log(`\n📡 Sending request to ${url.hostname}:${url.port}${url.pathname}`);

// Send request
const req = http.request(options, (res) => {
  let responseData = '';

  console.log(`\n📥 Response Status: ${res.statusCode}`);
  console.log('📨 Response Headers:', res.headers);

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Parse and display response
        const response = JSON.parse(responseData);
        console.log('\n✅ LM Studio Response:');
        console.log('=====================');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.choices && response.choices[0]) {
          const message = response.choices[0].message;
          console.log(`\n💬 Response Content: ${message.content}`);
        }
        
        console.log('\n🎉 Basic connectivity test PASSED!');
        process.exit(0);
      } else {
        console.error(`\n❌ LM Studio returned error status: ${res.statusCode}`);
        console.error('Response:', responseData);
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Failed to parse response:', error.message);
      console.error('Raw response:', responseData);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  console.error('Error details:', error);
  process.exit(1);
});

req.write(JSON.stringify(testRequest));
req.end();
