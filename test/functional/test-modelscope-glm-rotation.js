/**
 * Test: ModelScope GLM Key Rotation Verification
 *
 * This script sends multiple concurrent requests to the ModelScope provider
 * using the GLM model configuration on port 5509 to verify key rotation.
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5509/v1/messages';
const NUM_REQUESTS = 10;

async function runTest() {
  console.log('--- ModelScope GLM Key Rotation Test (Port 5509) ---');
  console.log(`Sending ${NUM_REQUESTS} concurrent requests to ${SERVER_URL}...`);

  const requestPromises = [];
  const metrics = {
    success: 0,
    errors: 0,
  };

  const requestBody = {
    model: 'ZhipuAI/GLM-4.5', // Target the new default model
    messages: [{ role: 'user', content: 'GLM key rotation test' }],
    max_tokens: 20,
  };

  const sendRequest = async (reqNum) => {
    try {
      const response = await axios.post(SERVER_URL, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000, // 30-second timeout
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
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await Promise.all(requestPromises);

  console.log('\n--- Test Finished ---');
  console.log(`Total Requests: ${NUM_REQUESTS}`);
  console.log(`✅ Successes:    ${metrics.success}`);
  console.log(`❌ Errors:       ${metrics.errors}`);
  console.log('--------------------');
  console.log('\nℹ️ Please check the server logs on port 5509 to verify API key rotation.');

  if (metrics.errors > 0) {
    console.log("Test failed, exiting with error code 1.");
    process.exit(1);
  }
}

runTest();
