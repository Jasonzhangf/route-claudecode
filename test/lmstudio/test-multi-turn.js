#!/usr/bin/env node

/**
 * LM Studio Multi-turn Conversation Test
 * Tests multi-turn conversation functionality with LM Studio
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

// Conversation history
let conversationHistory = [
  {
    role: "user",
    content: "Hello! What's the capital of France?"
  }
];

// Function to send a message and get response
function sendLMStudioMessage(messages) {
  return new Promise((resolve, reject) => {
    const testRequest = {
      model: lmstudioProvider.defaultModel,
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    };

    console.log('\n📤 Request:');
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

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = JSON.parse(responseData);
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(testRequest));
    req.end();
  });
}

// Run multi-turn conversation test
async function runMultiTurnTest() {
  console.log('\n🔄 Multi-turn Conversation Test');
  console.log('===============================');

  try {
    // Turn 1
    console.log('\n--- Turn 1 ---');
    const response1 = await sendLMStudioMessage(conversationHistory);
    const assistantMessage1 = response1.choices[0].message;
    console.log(`🤖 Assistant: ${assistantMessage1.content}`);
    
    // Add assistant response to history
    conversationHistory.push(assistantMessage1);
    
    // Add next user message
    conversationHistory.push({
      role: "user",
      content: "What's the population of that city?"
    });

    // Turn 2
    console.log('\n--- Turn 2 ---');
    const response2 = await sendLMStudioMessage(conversationHistory);
    const assistantMessage2 = response2.choices[0].message;
    console.log(`🤖 Assistant: ${assistantMessage2.content}`);
    
    // Add assistant response to history
    conversationHistory.push(assistantMessage2);
    
    // Add next user message
    conversationHistory.push({
      role: "user",
      content: "Thanks for the information!"
    });

    // Turn 3
    console.log('\n--- Turn 3 ---');
    const response3 = await sendLMStudioMessage(conversationHistory);
    const assistantMessage3 = response3.choices[0].message;
    console.log(`🤖 Assistant: ${assistantMessage3.content}`);
    
    console.log('\n📋 Complete Conversation History:');
    console.log('===============================');
    conversationHistory.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
    });
    
    console.log('\n🎉 Multi-turn conversation test PASSED!');
    
  } catch (error) {
    console.error('\n❌ Multi-turn conversation test FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
runMultiTurnTest();
