/**
 * Test: ModelScope Key Rotation Verification
 *
 * This script sends multiple concurrent requests to the ModelScope provider
 * to verify that the API keys are being rotated correctly in a round-robin fashion
 * as per the configuration.
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5507/v1/messages';
const NUM_REQUESTS = 10; // Send 10 requests to observe rotation over 3 keys

async function runTest() {
  console.log('--- ModelScope Key Rotation Test ---');
  console.log(`Sending ${NUM_REQUESTS} concurrent requests to ${SERVER_URL}...`);

  const requestPromises = [];
  const metrics = {
    success: 0,
    errors: 0,
  };

  const requestBody = {
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    messages: [{ role: 'user', content: 'Key rotation test' }],
    max_tokens: 20,
  };

  const sendRequest = async (reqNum) => {
    try {
      const response = await axios.post(SERVER_URL, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000, // 20-second timeout
      });
      if (response.status === 200) {
        metrics.success++;
        console.log(`Request ${reqNum}: ✅ Success`);
      } else {
        metrics.errors++;
        console.log(`Request ${reqNum}: ❌ Failed with status ${response.status}`);
      }
    } catch (error) {
      metrics.errors++;
      const status = error.response?.status || 'N/A';
      console.log(`Request ${reqNum}: ❌ Error (Status: ${status}) - ${error.message}`);
    }
  };

  for (let i = 1; i <= NUM_REQUESTS; i++) {
    requestPromises.push(sendRequest(i));
    // Small delay between starting each request to avoid thundering herd
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await Promise.all(requestPromises);

  console.log('\n--- Test Finished ---');
  console.log(`Total Requests: ${NUM_REQUESTS}`);
  console.log(`✅ Successes:    ${metrics.success}`);
  console.log(`❌ Errors:       ${metrics.errors}`);
  console.log('--------------------');
  console.log('\nℹ️ Please check the server logs to verify API key rotation.');
  console.log("   Look for logs like: 'API key selected for use' with incrementing 'keyIndex'.");

  if (metrics.errors > 0) {
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('An unexpected error occurred during the test:', err);
  process.exit(1);
});
