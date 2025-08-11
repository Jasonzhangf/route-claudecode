const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test script for Gemini integration
console.log('🧪 Starting Gemini Integration Test');

// Simple test request
const testRequest = {
  "model": "gemini-1.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "Hello, this is a test message for Gemini integration. Please respond with a short greeting."
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
};

// Write test request to a temporary file
const tempRequestFile = path.join(__dirname, 'temp_gemini_request.json');
fs.writeFileSync(tempRequestFile, JSON.stringify(testRequest, null, 2));

console.log('📝 Test request written to:', tempRequestFile);

// Start the router server as a child process
const serverProcess = spawn('node', ['dist/index.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'pipe'
});

let serverStarted = false;

// Handle server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Check if server has started
  if (output.includes('Server listening') || output.includes('Router server started')) {
    serverStarted = true;
    console.log('\n🚀 Router server started, sending test request...');
    sendTestRequest();
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Handle server exit
serverProcess.on('close', (code) => {
  console.log(`\n🚪 Router server process exited with code ${code}`);
});

// Function to send test request
function sendTestRequest() {
  console.log('📨 Sending request to router...');
  
  // Using curl to send the request
  const curlProcess = spawn('curl', [
    '-X', 'POST',
    'http://localhost:3456/v1/chat/completions',
    '-H', 'Content-Type: application/json',
    '-H', 'Authorization: Bearer test-key',
    '-d', `@${tempRequestFile}`
  ], {
    stdio: 'pipe'
  });
  
  let response = '';
  
  curlProcess.stdout.on('data', (data) => {
    response += data.toString();
  });
  
  curlProcess.stderr.on('data', (data) => {
    console.error('Curl Error:', data.toString());
  });
  
  curlProcess.on('close', (code) => {
    console.log(`\n✅ Curl process exited with code ${code}`);
    
    if (response) {
      console.log('\n📬 Response from router:');
      try {
        const jsonResponse = JSON.parse(response);
        console.log(JSON.stringify(jsonResponse, null, 2));
        
        // Check if response is successful
        if (jsonResponse.choices && jsonResponse.choices.length > 0) {
          console.log('\n✅ Gemini integration test PASSED');
        } else {
          console.log('\n❌ Gemini integration test FAILED - No choices in response');
        }
      } catch (parseError) {
        console.log('\n📬 Raw response:', response);
        console.log('\n⚠️  Could not parse response as JSON');
      }
    } else {
      console.log('\n❌ No response received');
    }
    
    // Clean up temporary file
    fs.unlinkSync(tempRequestFile);
    console.log('\n🧹 Cleaned up temporary files');
    
    // Kill server process
    console.log('\n🛑 Shutting down router server...');
    serverProcess.kill();
  });
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted, shutting down...');
  serverProcess.kill();
  process.exit();
});

// Timeout to prevent hanging
setTimeout(() => {
  if (!serverStarted) {
    console.log('\n⏰ Server failed to start within timeout period');
    serverProcess.kill();
    process.exit(1);
  }
}, 30000); // 30 second timeout
