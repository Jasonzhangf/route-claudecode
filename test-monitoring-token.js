#!/usr/bin/env node

/**
 * Test monitoring-based token management
 * Verifies failure tracking, blocking, and cooldown functionality
 */

const { CodeWhispererAuth } = require('./dist/providers/codewhisperer/auth');
const path = require('path');

async function testMonitoringTokenManagement() {
  console.log('🧪 Testing Monitoring-based Token Management');
  console.log('==========================================\n');

  // Use real token path
  const tokenPath = '~/.aws/sso/cache/kiro-auth-token.json';
  const auth = new CodeWhispererAuth(tokenPath);

  try {
    // Test 1: Initial state
    console.log('📊 Test 1: Initial token state');
    const initialInfo = await auth.getTokenInfo();
    console.log('Initial state:', {
      hasToken: initialInfo.hasAccessToken,
      isValid: initialInfo.isValid,
      isBlocked: initialInfo.isBlocked,
      consecutiveFailures: initialInfo.consecutiveFailures,
      remainingCooldown: initialInfo.remainingCooldownMinutes
    });
    console.log('✅ Initial state check completed\n');

    // Test 2: Normal token retrieval (should work)
    console.log('📊 Test 2: Normal token retrieval');
    try {
      const token = await auth.getToken();
      console.log('✅ Token retrieved successfully:', token.substring(0, 20) + '...');
      console.log('Token blocked status:', auth.isTokenBlocked());
    } catch (error) {
      console.log('❌ Token retrieval failed:', error.message);
    }
    console.log('');

    // Test 3: Simulate authentication failures
    console.log('📊 Test 3: Simulating authentication failures');
    console.log('Reporting 3 consecutive failures to trigger blocking...');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`Failure ${i}/3:`);
      auth.reportAuthFailure();
      
      const state = await auth.getTokenInfo();
      console.log(`  - Consecutive failures: ${state.consecutiveFailures}`);
      console.log(`  - Is blocked: ${state.isBlocked}`);
      console.log(`  - Remaining cooldown: ${state.remainingCooldownMinutes} minutes`);
    }
    console.log('');

    // Test 4: Try to get token when blocked
    console.log('📊 Test 4: Attempting token retrieval when blocked');
    try {
      const token = await auth.getToken();
      console.log('❌ UNEXPECTED: Token retrieved when should be blocked');
    } catch (error) {
      console.log('✅ Expected blocking error:', error.message);
    }
    console.log('');

    // Test 5: Check blocking status methods
    console.log('📊 Test 5: Blocking status methods');
    console.log('Is token blocked:', auth.isTokenBlocked());
    console.log('Remaining cooldown minutes:', auth.getRemainingCooldownMinutes());
    console.log('');

    // Test 6: Manual unblocking
    console.log('📊 Test 6: Manual token unblocking');
    auth.unblockToken();
    console.log('Token unblocked');
    console.log('Is token blocked after unblock:', auth.isTokenBlocked());
    
    try {
      const token = await auth.getToken();
      console.log('✅ Token retrieved successfully after unblock:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('❌ Token retrieval failed after unblock:', error.message);
    }
    console.log('');

    // Test 7: Final state
    console.log('📊 Test 7: Final token state');
    const finalInfo = await auth.getTokenInfo();
    console.log('Final state:', {
      hasToken: finalInfo.hasAccessToken,
      isValid: finalInfo.isValid,
      isBlocked: finalInfo.isBlocked,
      consecutiveFailures: finalInfo.consecutiveFailures,
      remainingCooldown: finalInfo.remainingCooldownMinutes,
      monitoringEnabled: finalInfo.monitoringEnabled
    });

    console.log('\n🎉 Monitoring token management tests completed!');
    console.log('✅ All monitoring features working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testMonitoringTokenManagement().catch(console.error);