/**
 * Test: ModelScope Basic Connectivity
 *
 * This script performs a single, direct API call to the ModelScope endpoint
 * to verify basic network connectivity and authentication, bypassing the router.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function runConnectivityTest() {
  console.log('--- ModelScope Basic Connectivity Test ---');

  const configPath = path.join(os.homedir(), '.route-claude-code', 'config', 'single-provider', 'config-openai-modelscope-5507.json');

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found at: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const providerConfig = config.providers['modelscope-openai'];
  const endpoint = providerConfig.endpoint;
  const apiKey = providerConfig.authentication.credentials.apiKey[2]; // Use the third key

  if (!endpoint || !apiKey) {
    console.error('❌ Endpoint or API key is missing from the configuration.');
    process.exit(1);
  }

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Using API Key: ***${apiKey.slice(-4)}`);

  const requestBody = {
    model: providerConfig.defaultModel,
    messages: [{ role: 'user', content: 'Connectivity test' }],
    max_tokens: 10,
  };

  try {
    console.log('\nSending request...');
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000, // 30-second timeout
    });

    if (response.status === 200) {
      console.log('✅ Connectivity Test Successful!');
      console.log('Response Status:', response.status);
      console.log('Response Body:', JSON.stringify(response.data, null, 2));
    } else {
      console.error(`❌ Test Failed with status: ${response.status}`);
      console.error('Response Body:', response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connectivity Test Failed:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Headers: ${JSON.stringify(error.response.headers)}`);
      console.error(`  Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`  Error: ${error.message}`);
    }
    process.exit(1);
  }
}

runConnectivityTest();
