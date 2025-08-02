/**
 * Test: Direct ModelScope API Connectivity
 *
 * This script makes a single, direct request to the ModelScope API endpoint
 * to verify basic connectivity and authentication, bypassing the router.
 */

const axios = require('axios');

const ENDPOINT = 'https://api-inference.modelscope.cn/v1/chat/completions';
const API_KEYS = [
  'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
  'ms-7d6c4fdb-4bf1-40b3-9ec6-ddea16f6702b',
  'ms-7af85c83-5871-43bb-9e2f-fc099ef08baf'
];
const MODEL = 'Qwen/Qwen3-Coder-480B-A35B-Instruct';

async function runTest() {
  console.log('--- Direct ModelScope Connectivity Test (All Keys) ---');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Model: ${MODEL}`);

  const requestBody = {
    model: MODEL,
    messages: [{ role: 'user', content: 'Connectivity test' }],
    max_tokens: 10,
  };

  let anySuccess = false;

  for (const apiKey of API_KEYS) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    
    console.log(`\n--- Testing Key: ***${apiKey.slice(-4)} ---`);

    try {
      console.log('Sending request...');
      const startTime = Date.now();
      const response = await axios.post(ENDPOINT, requestBody, {
        headers: headers,
        timeout: 30000, // 30-second timeout
      });
      const duration = Date.now() - startTime;

      console.log(`✅ Success! (took ${duration}ms)`);
      console.log(`Status: ${response.status}`);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      anySuccess = true;

    } catch (error) {
      console.error('❌ Test Failed for this key!');
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Error message:', error.message);
      }
    }
  }

  console.log('\n--- Test Summary ---');
  if (anySuccess) {
    console.log('✅ At least one API key was successful.');
    process.exit(0);
  } else {
    console.error('❌ All API keys failed.');
    process.exit(1);
  }
}

runTest();
