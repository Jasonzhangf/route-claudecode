/**
 * Test script for intelligent endpoint detection
 * Verifies that chat/completions path completion works correctly
 */

const { EnhancedOpenAIClient } = require('../dist/providers/openai/enhanced-client');
const { logger } = require('../dist/utils/logger');

// Test cases for endpoint detection
const testCases = [
  {
    name: 'Base URL - should add /v1/chat/completions',
    input: 'https://ai.shuaihong.fun',
    expected: 'https://ai.shuaihong.fun/v1/chat/completions'
  },
  {
    name: 'URL with trailing slash - should add /v1/chat/completions',
    input: 'https://ai.shuaihong.fun/',
    expected: 'https://ai.shuaihong.fun/v1/chat/completions'
  },
  {
    name: 'URL with /v1 - should add /chat/completions',
    input: 'https://ai.shuaihong.fun/v1',
    expected: 'https://ai.shuaihong.fun/v1/chat/completions'
  },
  {
    name: 'URL with /v1/ - should add chat/completions',
    input: 'https://ai.shuaihong.fun/v1/',
    expected: 'https://ai.shuaihong.fun/v1/chat/completions'
  },
  {
    name: 'URL with existing chat/completions - should remain unchanged',
    input: 'https://ai.shuaihong.fun/v1/chat/completions',
    expected: 'https://ai.shuaihong.fun/v1/chat/completions'
  },
  {
    name: 'URL with custom path - should append /chat/completions',
    input: 'https://ai.shuaihong.fun/api',
    expected: 'https://ai.shuaihong.fun/api/chat/completions'
  },
  {
    name: 'URL with custom path and trailing slash - should append chat/completions',
    input: 'https://ai.shuaihong.fun/api/',
    expected: 'https://ai.shuaihong.fun/api/chat/completions'
  }
];

// Mock provider config for testing
const mockConfig = {
  endpoint: '',
  authentication: {
    type: 'bearer',
    credentials: {
      apiKey: ['test-key']
    }
  }
};

async function testEndpointDetection() {
  console.log('🧪 Testing Intelligent Endpoint Detection\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    try {
      console.log(`📋 Testing: ${testCase.name}`);
      console.log(`   Input: ${testCase.input}`);
      console.log(`   Expected: ${testCase.expected}`);
      
      // Create a mock config with the test input
      const testConfig = {
        ...mockConfig,
        endpoint: testCase.input
      };
      
      // Create a temporary client to test endpoint detection
      // We'll access the private method through prototype
      const client = new EnhancedOpenAIClient(testConfig, 'test-provider');
      
      // Check if endpoint detection worked correctly
      const actualEndpoint = client.endpoint;
      
      console.log(`   Actual: ${actualEndpoint}`);
      
      if (actualEndpoint === testCase.expected) {
        console.log('   ✅ PASSED\n');
        passedTests++;
      } else {
        console.log('   ❌ FAILED\n');
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }
  }
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All endpoint detection tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run the tests
testEndpointDetection().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});