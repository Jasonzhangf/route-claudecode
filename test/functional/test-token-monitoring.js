#!/usr/bin/env node

/**
 * Test monitoring-based token management through API calls
 * Tests the new failure tracking and blocking system
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3456';

async function testTokenMonitoring() {
  console.log('🧪 Testing Token Monitoring via API');
  console.log('==================================\n');

  try {
    // Test 1: Health check
    console.log('📊 Test 1: Server health check');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('Server health:', healthResponse.data.overall);
    console.log('Providers:', Object.keys(healthResponse.data.providers));
    console.log('');

    // Test 2: Status check
    console.log('📊 Test 2: Server status');
    const statusResponse = await axios.get(`${BASE_URL}/status`);
    console.log('Server version:', statusResponse.data.version);
    console.log('Available providers:', statusResponse.data.providers);
    console.log('');

    // Test 3: Send a normal request that should route to CodeWhisperer
    console.log('📊 Test 3: Normal request (should work)');
    try {
      const normalRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user',
            content: 'Hello! This is a test message to verify token monitoring.'
          }
        ],
        max_tokens: 100,
        stream: false
      };

      const response = await axios.post(`${BASE_URL}/v1/messages`, normalRequest, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Request successful');
      console.log('Response model:', response.data.model);
      console.log('Content length:', response.data.content?.length || 0);
      
    } catch (error) {
      if (error.response) {
        console.log('❌ Request failed with status:', error.response.status);
        console.log('Error message:', error.response.data?.error?.message || 'Unknown error');
        
        if (error.response.status === 500 && 
            error.response.data?.error?.message?.includes('blocked due to consecutive')) {
          console.log('🎯 Detected token blocking behavior - monitoring system working!');
        }
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    console.log('');

    // Test 4: Test with a background routing request
    console.log('📊 Test 4: Background routing request (haiku model)');
    try {
      const backgroundRequest = {
        model: 'claude-3-5-haiku-20241022',
        messages: [
          {
            role: 'user', 
            content: 'This should route to background category.'
          }
        ],
        max_tokens: 50,
        stream: false
      };

      const response = await axios.post(`${BASE_URL}/v1/messages`, backgroundRequest, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Background request successful');
      console.log('Response model:', response.data.model);
      
    } catch (error) {
      if (error.response) {
        console.log('❌ Background request failed with status:', error.response.status);
        console.log('Error message:', error.response.data?.error?.message || 'Unknown error');
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    console.log('');

    console.log('🎉 Token monitoring test completed!');
    console.log('ℹ️  Check server logs for detailed monitoring behavior');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTokenMonitoring().catch(console.error);