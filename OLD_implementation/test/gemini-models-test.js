const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test script for Gemini models availability
console.log('🧪 Starting Gemini Models Availability Test');

// List of all Gemini models to test
const geminiModels = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-pro-exp-03-25',
  'gemini-2.5-flash-preview-05-20',
  'gemini-pro',
  'gemini-2.5-flash-preview-04-17-thinking',
  'gemini-2.5-pro-preview-03-25',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash-lite-preview-06-17'
];

// Store results
const results = {};

// Simple test request template
const testRequestTemplate = {
  "messages": [
    {
      "role": "user",
      "content": "Hello, this is a test message. Please respond with a short greeting."
    }
  ],
  "max_tokens": 50,
  "temperature": 0.7
};

let currentModelIndex = 0;

// Function to test a single model
function testModel(modelName) {
  console.log(`\n🧪 Testing model: ${modelName}`);
  
  // Create test request for this model
  const testRequest = {...testRequestTemplate, model: modelName};
  
  // Write test request to a temporary file
  const tempRequestFile = path.join(__dirname, `temp_gemini_request_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
  fs.writeFileSync(tempRequestFile, JSON.stringify(testRequest, null, 2));
  
  // Using curl to send the request
  const curlProcess = spawn('curl', [
    '-X', 'POST',
    'http://localhost:3456/v1/chat/completions',
    '-H', 'Content-Type: application/json',
    '-H', 'Authorization: Bearer test-key',
    '-d', `@${tempRequestFile}`,
    '--max-time', '30'  // 30 second timeout
  ], {
    stdio: 'pipe'
  });
  
  let response = '';
  
  curlProcess.stdout.on('data', (data) => {
    response += data.toString();
  });
  
  curlProcess.stderr.on('data', (data) => {
    console.error(`Curl Error for ${modelName}:`, data.toString());
  });
  
  curlProcess.on('close', (code) => {
    // Clean up temporary file
    try {
      fs.unlinkSync(tempRequestFile);
    } catch (err) {
      // Ignore cleanup errors
    }
    
    console.log(`✅ Curl process for ${modelName} exited with code ${code}`);
    
    if (response) {
      try {
        const jsonResponse = JSON.parse(response);
        
        // Check if response is successful
        if (jsonResponse.choices && jsonResponse.choices.length > 0) {
          console.log(`✅ ${modelName} - SUCCESS`);
          results[modelName] = 'SUCCESS';
        } else if (jsonResponse.error) {
          console.log(`❌ ${modelName} - ERROR: ${jsonResponse.error.message || jsonResponse.error}`);
          results[modelName] = `ERROR: ${jsonResponse.error.message || jsonResponse.error}`;
        } else {
          console.log(`❌ ${modelName} - FAILED - Unexpected response format`);
          results[modelName] = 'FAILED - Unexpected response format';
        }
      } catch (parseError) {
        console.log(`❌ ${modelName} - FAILED - Could not parse response:`, response);
        results[modelName] = 'FAILED - Could not parse response';
      }
    } else {
      console.log(`❌ ${modelName} - FAILED - No response received`);
      results[modelName] = 'FAILED - No response received';
    }
    
    // Move to next model or finish
    currentModelIndex++;
    if (currentModelIndex < geminiModels.length) {
      // Add a small delay between requests
      setTimeout(() => testModel(geminiModels[currentModelIndex]), 1000);
    } else {
      finishTest();
    }
  });
}

// Function to finish the test and display results
function finishTest() {
  console.log('\n\n========== TEST RESULTS ==========');
  const workingModels = [];
  const failedModels = [];
  
  for (const [model, result] of Object.entries(results)) {
    console.log(`${model}: ${result}`);
    if (result === 'SUCCESS') {
      workingModels.push(model);
    } else {
      failedModels.push({model, error: result});
    }
  }
  
  console.log('\n✅ WORKING MODELS:');
  if (workingModels.length > 0) {
    workingModels.forEach(model => console.log(`  - ${model}`));
  } else {
    console.log('  None');
  }
  
  console.log('\n❌ FAILED MODELS:');
  if (failedModels.length > 0) {
    failedModels.forEach(({model, error}) => console.log(`  - ${model}: ${error}`));
  } else {
    console.log('  None');
  }
  
  console.log('\n========== TEST COMPLETE ==========');
  
  // Exit the process
  process.exit(0);
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted, showing partial results...');
  finishTest();
});

// Timeout to prevent hanging
setTimeout(() => {
  console.log('\n⏰ Test timeout reached, showing partial results...');
  finishTest();
}, 5 * 60 * 1000); // 5 minute timeout

// Start testing with the first model
if (geminiModels.length > 0) {
  testModel(geminiModels[currentModelIndex]);
} else {
  console.log('No models to test');
  process.exit(1);
}
