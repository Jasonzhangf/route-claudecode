#!/usr/bin/env node

/**
 * LM Studio Tool Call Test
 * Tests tool call functionality with LM Studio
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

// Test request with tools
const testRequest = {
  model: lmstudioProvider.defaultModel,
  messages: [
    {
      role: "user",
      content: "Please use the Glob tool to find all TypeScript files in the current directory."
    }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "Glob",
        description: "Find files matching a pattern",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The glob pattern to match files"
            }
          },
          required: ["pattern"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "Read",
        description: "Read a file from the filesystem",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The path to the file to read"
            }
          },
          required: ["file_path"]
        }
      }
    }
  ],
  tool_choice: "auto",
  max_tokens: 200,
  temperature: 0.7
};

console.log('\n📤 Test Request with Tools:');
console.log('=========================');
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

console.log(`\n📡 Sending tool call request to ${url.hostname}:${url.port}${url.pathname}`);

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
        console.log('\n✅ LM Studio Tool Call Response:');
        console.log('=================================');
        console.log(JSON.stringify(response, null, 2));
        
        // Check for tool calls
        if (response.choices && response.choices[0] && response.choices[0].message) {
          const message = response.choices[0].message;
          
          if (message.content) {
            console.log(`\n💬 Response Content: ${message.content}`);
          }
          
          if (message.tool_calls) {
            console.log(`\n🛠️  Tool Calls Detected: ${message.tool_calls.length}`);
            message.tool_calls.forEach((toolCall, index) => {
              console.log(`  ${index + 1}. ${toolCall.function.name}(${JSON.stringify(toolCall.function.arguments)})`);
            });
          } else {
            console.log('\n⚠️  No tool calls detected in response');
          }
        }
        
        console.log('\n🎉 Tool call test completed!');
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
