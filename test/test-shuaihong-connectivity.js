#!/usr/bin/env node

/**
 * ShuaiHong Provider Connectivity Test
 * Tests API endpoint connectivity and model availability
 */

const https = require('https');
const http = require('http');

// ShuaiHong configuration
const SHUAIHONG_CONFIG = {
  endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
  apiKey: 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl',
  models: [
    'gpt-4o-mini',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'qwen3-coder'
  ],
  defaultModel: 'gpt-4o-mini'
};

// Test timeout
const TIMEOUT = 30000;

/**
 * Make HTTP request with proper headers
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router-test/1.0.0',
      ...options.headers
    };

    if (SHUAIHONG_CONFIG.apiKey) {
      headers['Authorization'] = `Bearer ${SHUAIHONG_CONFIG.apiKey}`;
    }

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: headers,
      timeout: TIMEOUT
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Test basic connectivity
 */
async function testConnectivity() {
  console.log('🧪 Testing ShuaiHong Provider Connectivity\\n');
  
  try {
    console.log('📋 Test Configuration:');
    console.log(`   Endpoint: ${SHUAIHONG_CONFIG.endpoint}`);
    console.log(`   Models: ${SHUAIHONG_CONFIG.models.join(', ')}`);
    console.log(`   Default Model: ${SHUAIHONG_CONFIG.defaultModel}`);
    console.log('');
    
    // Test 1: Basic endpoint connectivity
    console.log('🔍 Test 1: Basic Endpoint Connectivity');
    try {
      const response = await makeRequest(SHUAIHONG_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          model: SHUAIHONG_CONFIG.defaultModel,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1
        })
      });
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Response Size: ${response.data.length} bytes`);
      
      if (response.status === 200) {
        console.log('   ✅ Basic connectivity test PASSED');
        
        // Try to parse response
        try {
          const jsonResponse = JSON.parse(response.data);
          console.log(`   Response ID: ${jsonResponse.id || 'N/A'}`);
          console.log(`   Response Model: ${jsonResponse.model || 'N/A'}`);
          if (jsonResponse.choices && jsonResponse.choices[0]) {
            console.log(`   Response Content: ${jsonResponse.choices[0].message?.content?.substring(0, 50) || 'N/A'}...`);
          }
        } catch (parseError) {
          console.log(`   ⚠️  Could not parse JSON response: ${parseError.message}`);
        }
      } else {
        console.log(`   ❌ Basic connectivity test FAILED - Status: ${response.status}`);
        console.log(`   Error Response: ${response.data.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ Basic connectivity test FAILED: ${error.message}`);
    }
    
    console.log('');
    
    // Test 2: Model availability check
    console.log('🔍 Test 2: Model Availability Check');
    
    for (const model of SHUAIHONG_CONFIG.models) {
      try {
        const response = await makeRequest(SHUAIHONG_CONFIG.endpoint, {
          method: 'POST',
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        });
        
        if (response.status === 200) {
          console.log(`   ✅ ${model} - Available`);
        } else if (response.status === 400 || response.status === 404) {
          console.log(`   ❌ ${model} - Not available (${response.status})`);
        } else {
          console.log(`   ⚠️  ${model} - Unexpected status (${response.status})`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ ${model} - Connection error: ${error.message}`);
      }
    }
    
    console.log('');
    
    // Test 3: Actual API call with real request
    console.log('🔍 Test 3: Actual API Call');
    
    try {
      const testRequest = {
        model: SHUAIHONG_CONFIG.defaultModel,
        messages: [
          { role: 'user', content: 'What is 2+2? Answer with just the number.' }
        ],
        max_tokens: 10,
        temperature: 0.1
      };
      
      const response = await makeRequest(SHUAIHONG_CONFIG.endpoint, {
        method: 'POST',
        body: JSON.stringify(testRequest)
      });
      
      if (response.status === 200) {
        const jsonResponse = JSON.parse(response.data);
        console.log('   ✅ Real API call test PASSED');
        console.log(`   Response: ${jsonResponse.choices?.[0]?.message?.content || 'No content'}`);
        
        if (jsonResponse.usage) {
          console.log(`   Usage: ${jsonResponse.usage.input_tokens || 0} input, ${jsonResponse.usage.output_tokens || 0} output tokens`);
        }
      } else {
        console.log(`   ❌ Real API call test FAILED - Status: ${response.status}`);
        console.log(`   Error: ${response.data.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ Real API call test FAILED: ${error.message}`);
    }
    
    console.log('');
    console.log('🎯 ShuaiHong Connectivity Test Complete');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
testConnectivity().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});