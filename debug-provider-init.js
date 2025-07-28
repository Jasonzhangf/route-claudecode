const { CodeWhispererClient } = require('./dist/providers/codewhisperer/client.js');
const config = require('./config.json');

async function testProviderInit() {
  try {
    console.log('Testing CodeWhisperer provider initialization...');
    console.log('Config:', JSON.stringify(config.providers['codewhisperer-primary'], null, 2));
    
    const client = new CodeWhispererClient(config.providers['codewhisperer-primary']);
    console.log('✅ Provider initialized successfully');
    
    // Test token retrieval
    console.log('Testing token retrieval...');
    const isHealthy = await client.isHealthy();
    console.log('Health check result:', isHealthy);
    
  } catch (error) {
    console.error('❌ Provider initialization failed:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
  }
}

testProviderInit();