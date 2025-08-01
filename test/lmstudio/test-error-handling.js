#!/usr/bin/env node

/**
 * LM Studio Error Handling Test
 * Tests error handling scenarios with LM Studio
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

// Test scenarios
const testScenarios = [
  {
    name: 'Invalid Model Name',
    request: {
      model: 'invalid-model-name',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100
    }
  },
  {
    name: 'Missing Messages',
    request: {
      model: lmstudioProvider.defaultModel,
      max_tokens: 100
      // messages is missing
    }
  },
  {
    name: 'Excessive Max Tokens',
    request: {
      model: lmstudioProvider.defaultModel,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1000000  // Excessive tokens
    }
  },
  {
    name: 'Empty Content',
    request: {
      model: lmstudioProvider.defaultModel,
      messages: [{ role: 'user', content: '' }],
      max_tokens: 100
    }
  }
];

// Function to send a request and handle errors
function sendLMStudioRequest(request) {
  return new Promise((resolve, reject) => {
    console.log('\n📤 Request:');
    console.log(JSON.stringify(request, null, 2));

    // Parse endpoint URL
    const url = new URL(lmstudioProvider.endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': JSON.stringify(request).length
      }
    };

    // Add authentication if needed
    if (lmstudioProvider.authentication.type === 'bearer' && lmstudioProvider.authentication.credentials) {
      const apiKey = lmstudioProvider.authentication.credentials.apiKey || lmstudioProvider.authentication.credentials.api_key;
      if (apiKey) {
        options.headers['Authorization'] = `Bearer ${Array.isArray(apiKey) ? apiKey[0] : apiKey}`;
      }
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          };
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, response });
          } else {
            resolve({ success: false, response, error: `HTTP ${res.statusCode}` });
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.write(JSON.stringify(request));
    req.end();
  });
}

// Run error handling tests
async function runErrorHandlingTests() {
  console.log('\n🧪 Error Handling Tests');
  console.log('=====================');

  let passedTests = 0;
  let totalTests = testScenarios.length;

  for (const scenario of testScenarios) {
    console.log(`\n--- Test: ${scenario.name} ---`);
    
    try {
      const result = await sendLMStudioRequest(scenario.request);
      
      if (result.success) {
        console.log('✅ Request succeeded (unexpected for error test)');
        console.log('Response:', result.response.body);
      } else {
        console.log('✅ Error handled properly');
        console.log('Error:', result.error || result.response.statusCode);
        if (result.response) {
          console.log('Response body:', result.response.body);
        }
        passedTests++;
      }
    } catch (error) {
      console.log('✅ Error caught:', error.message);
      passedTests++;
    }
  }

  console.log('\n📊 Error Handling Test Summary:');
  console.log('===============================');
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${Math.round((passedTests/totalTests)*100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All error handling tests completed!');
  } else {
    console.log('\n⚠️  Some error handling tests need attention.');
  }
}

// Run the tests
runErrorHandlingTests();
