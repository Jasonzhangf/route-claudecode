#!/usr/bin/env node

/**
 * Token Logic Test
 * Test CodeWhisperer token management without starting server
 */

const fs = require('fs');
const path = require('path');

// Mock logger to avoid import issues
const logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args)
};

// Simple auth class for testing (based on our auth.ts logic)
class TestTokenManager {
  constructor(tokenPath) {
    this.tokenPath = tokenPath;
    this.MIN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
  }

  // Read token from file
  readTokenFromFile() {
    if (!fs.existsSync(this.tokenPath)) {
      throw new Error(`Token file not found at ${this.tokenPath}`);
    }

    const data = fs.readFileSync(this.tokenPath, 'utf8');
    const tokenData = JSON.parse(data);
    
    if (!tokenData.accessToken || !tokenData.refreshToken) {
      throw new Error('Invalid token file format');
    }

    return tokenData;
  }

  // Check if token is valid (not expired)
  isTokenValid(token) {
    if (!token.expiresAt) {
      console.log('⚠️  Token has no expiry date, assuming valid for 1 hour');
      return true;
    }

    const expiryTime = new Date(token.expiresAt);
    const now = new Date();
    
    // Add 5 minute buffer before expiry
    const isValid = expiryTime.getTime() - now.getTime() > 5 * 60 * 1000;
    
    console.log(`Token expiry check:`);
    console.log(`  Expires at: ${expiryTime.toISOString()}`);
    console.log(`  Current time: ${now.toISOString()}`);
    console.log(`  Valid: ${isValid}`);
    console.log(`  Minutes until expiry: ${Math.floor((expiryTime.getTime() - now.getTime()) / (60 * 1000))}`);
    
    return isValid;
  }

  // Check if this specific token can be refreshed
  canRefreshToken(tokenData) {
    if (!tokenData.lastRefreshTime) {
      console.log('✅ Token has no refresh history, allowing refresh');
      return true;
    }
    
    const lastRefreshTime = new Date(tokenData.lastRefreshTime);
    const timeSinceLastRefresh = Date.now() - lastRefreshTime.getTime();
    const canRefresh = timeSinceLastRefresh >= this.MIN_REFRESH_INTERVAL;
    
    console.log(`Token refresh interval check:`);
    console.log(`  Last refresh: ${lastRefreshTime.toISOString()}`);
    console.log(`  Time since last refresh: ${Math.floor(timeSinceLastRefresh / (60 * 1000))} minutes`);
    console.log(`  Minimum interval: ${this.MIN_REFRESH_INTERVAL / (60 * 1000)} minutes`);
    console.log(`  Can refresh: ${canRefresh}`);
    
    if (!canRefresh) {
      const remainingTime = Math.ceil((this.MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000));
      console.log(`  ⚠️  Refresh blocked - ${remainingTime} minutes remaining`);
    }
    
    return canRefresh;
  }

  // Test the complete logic flow
  testTokenLogic() {
    console.log('🧪 Testing Token Management Logic\n');
    
    try {
      // Step 1: Read token
      console.log('1️⃣ Reading token from file...');
      const tokenData = this.readTokenFromFile();
      console.log(`✅ Token loaded successfully`);
      console.log(`   Access token prefix: ${tokenData.accessToken.substring(0, 30)}...`);
      console.log(`   Has refresh token: ${!!tokenData.refreshToken}`);
      console.log(`   Profile ARN: ${tokenData.profileArn || 'N/A'}`);
      console.log(`   Last refreshed by: ${tokenData.lastRefreshedBy || 'N/A'}`);
      console.log(`   Last refresh time: ${tokenData.lastRefreshTime || 'N/A'}`);
      console.log('');

      // Step 2: Check token validity
      console.log('2️⃣ Checking token validity...');
      const isValid = this.isTokenValid(tokenData);
      console.log('');

      // Step 3: Check refresh capability
      console.log('3️⃣ Checking refresh capability...');
      const canRefresh = this.canRefreshToken(tokenData);
      console.log('');

      // Step 4: Determine action
      console.log('4️⃣ Action determination:');
      if (isValid) {
        console.log('✅ Token is valid - would use current token');
        if (canRefresh) {
          console.log('🔄 Would trigger background refresh');
        } else {
          console.log('⏳ Background refresh blocked by interval');
        }
      } else {
        console.log('❌ Token is expired');
        if (canRefresh) {
          console.log('🔄 Would perform immediate refresh');
        } else {
          console.log('⚠️  Immediate refresh blocked by interval - this is problematic!');
        }
      }

      return {
        isValid,
        canRefresh,
        tokenData,
        success: true
      };
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Run the test
console.log('='.repeat(60));
console.log('CodeWhisperer Token Management Logic Test');
console.log('='.repeat(60));

const tokenPath = path.join(process.env.HOME, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
console.log(`Token file: ${tokenPath}\n`);

const tokenManager = new TestTokenManager(tokenPath);
const result = tokenManager.testTokenLogic();

console.log('\n' + '='.repeat(60));
console.log('Test Summary:');
console.log('='.repeat(60));

if (result.success) {
  console.log(`✅ Test completed successfully`);
  console.log(`📊 Results:`);
  console.log(`   Token valid: ${result.isValid}`);
  console.log(`   Can refresh: ${result.canRefresh}`);
  console.log(`   Has expiry: ${!!result.tokenData.expiresAt}`);
  console.log(`   Has refresh history: ${!!result.tokenData.lastRefreshTime}`);
} else {
  console.log(`❌ Test failed: ${result.error}`);
}

console.log('');