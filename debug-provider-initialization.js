#!/usr/bin/env node

/**
 * Debug script for provider initialization issues
 * Tests initialization of custom-named CodeWhisperer providers
 */

const fs = require('fs');
const path = require('path');
const { readFileSync, existsSync } = fs;

// Simulate the environment
process.env.NODE_ENV = 'development';

console.log('🔍 Debugging Provider Initialization');
console.log('=====================================');

// Step 1: Check configuration paths
console.log('\n📁 Step 1: Configuration Path Check');
const configPaths = [
  '~/.route-claude-code/config.json',
  '~/.claude-code-router/config.json',
  '/Users/fanzhang/.route-claude-code/config.json'
];

const expandPath = (path) => path.replace('~', require('os').homedir());

let activeConfigPath = null;
for (const path of configPaths) {
  const expandedPath = expandPath(path);
  console.log(`   Checking: ${expandedPath}`);
  if (existsSync(expandedPath)) {
    console.log(`   ✅ Found: ${expandedPath}`);
    activeConfigPath = expandedPath;
    break;
  } else {
    console.log(`   ❌ Not found: ${expandedPath}`);
  }
}

if (!activeConfigPath) {
  console.log('\n❌ No configuration file found!');
  process.exit(1);
}

// Step 2: Load configuration
console.log('\n📄 Step 2: Configuration Loading');
let config;
try {
  const configData = readFileSync(activeConfigPath, 'utf8');
  config = JSON.parse(configData);
  console.log(`   ✅ Configuration loaded successfully`);
  console.log(`   📊 Found ${Object.keys(config.providers || {}).length} providers:`);
  
  for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
    console.log(`      • ${providerId} (${providerConfig.type})`);
  }
} catch (error) {
  console.log(`   ❌ Failed to load config: ${error.message}`);
  process.exit(1);
}

// Step 3: Test Provider Initialization (Simulated)
console.log('\n⚙️ Step 3: Provider Initialization Test');

async function testProviderInit() {
  for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
    console.log(`\n   Testing provider: ${providerId}`);
    console.log(`   Type: ${providerConfig.type}`);
    console.log(`   Endpoint: ${providerConfig.endpoint}`);
    
    if (providerConfig.type === 'codewhisperer') {
      // Test CodeWhisperer-specific initialization
      const tokenPath = providerConfig.authentication?.credentials?.tokenPath;
      console.log(`   Token path: ${tokenPath}`);
      
      if (tokenPath) {
        const expandedTokenPath = expandPath(tokenPath);
        console.log(`   Expanded token path: ${expandedTokenPath}`);
        
        if (existsSync(expandedTokenPath)) {
          console.log(`   ✅ Token file exists`);
          
          try {
            const tokenData = readFileSync(expandedTokenPath, 'utf8');
            const token = JSON.parse(tokenData);
            
            // Check token structure
            const requiredFields = ['accessToken', 'profileArn', 'region'];
            let validToken = true;
            
            for (const field of requiredFields) {
              if (!token[field]) {
                console.log(`   ❌ Missing token field: ${field}`);
                validToken = false;
              } else {
                console.log(`   ✅ Token field present: ${field}`);
              }
            }
            
            if (validToken) {
              console.log(`   ✅ Token structure is valid`);
              console.log(`   📍 Profile ARN: ${token.profileArn}`);
              console.log(`   🌏 Region: ${token.region}`);
              
              // Check token expiration
              if (token.expiresAt) {
                const expiresAt = new Date(token.expiresAt);
                const now = new Date();
                if (expiresAt > now) {
                  console.log(`   ✅ Token is not expired (expires: ${expiresAt.toISOString()})`);
                } else {
                  console.log(`   ⚠️ Token is expired (expired: ${expiresAt.toISOString()})`);
                }
              }
            }
            
          } catch (tokenError) {
            console.log(`   ❌ Failed to parse token file: ${tokenError.message}`);
          }
        } else {
          console.log(`   ❌ Token file not found: ${expandedTokenPath}`);
        }
      } else {
        console.log(`   ❌ No token path specified in configuration`);
      }
      
      // Test endpoint accessibility (basic check)
      console.log(`   📡 Testing endpoint accessibility...`);
      const url = new URL(providerConfig.endpoint);
      console.log(`   🌐 Host: ${url.hostname}`);
      console.log(`   🚪 Port: ${url.port || (url.protocol === 'https:' ? '443' : '80')}`);
      
    } else if (providerConfig.type === 'openai') {
      // Test OpenAI-compatible provider
      const apiKey = providerConfig.authentication?.credentials?.apiKey;
      if (apiKey) {
        console.log(`   ✅ API key present (${apiKey.substring(0, 10)}...)`);
      } else {
        console.log(`   ❌ No API key specified`);
      }
    }
    
    console.log(`   ✅ Provider ${providerId} initialization check completed`);
  }
}

testProviderInit().then(() => {
  // Continue with remaining steps
  
  // Step 4: Test Routing Configuration
  console.log('\n🗺️ Step 4: Routing Configuration Test');

  if (config.routing) {
    const categories = Object.keys(config.routing);
    console.log(`   📋 Found ${categories.length} routing categories: ${categories.join(', ')}`);
    
    for (const [category, categoryConfig] of Object.entries(config.routing)) {
      console.log(`\n   Category: ${category}`);
      
      if (categoryConfig.providers && Array.isArray(categoryConfig.providers)) {
        console.log(`   📊 ${categoryConfig.providers.length} provider(s) configured:`);
        
        for (const providerMapping of categoryConfig.providers) {
          const providerId = providerMapping.provider;
          const model = providerMapping.model;
          const weight = providerMapping.weight;
          
          console.log(`      • ${providerId} -> ${model} (weight: ${weight})`);
          
          // Check if provider exists in providers section
          if (config.providers[providerId]) {
            console.log(`        ✅ Provider ${providerId} is defined`);
          } else {
            console.log(`        ❌ Provider ${providerId} is NOT defined in providers section`);
          }
        }
      } else {
        console.log(`   ❌ No providers configured for category ${category}`);
      }
    }
  } else {
    console.log('   ❌ No routing configuration found');
  }

  // Step 5: Test Environment Variables
  console.log('\n🌍 Step 5: Environment Variables Check');

  const envVars = [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_API_KEY',
    'NODE_ENV'
  ];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}=${value}`);
    } else {
      console.log(`   ❌ ${envVar} not set`);
    }
  }

  // Step 6: Summary and Recommendations
  console.log('\n📋 Step 6: Summary and Recommendations');
  console.log('=====================================');

  let issues = [];
  let successes = [];

  // Check for common issues
  if (!config.providers || Object.keys(config.providers).length === 0) {
    issues.push('No providers configured');
  } else {
    successes.push(`${Object.keys(config.providers).length} providers configured`);
  }

  if (!config.routing || Object.keys(config.routing).length === 0) {
    issues.push('No routing rules configured');
  } else {
    successes.push(`${Object.keys(config.routing).length} routing categories configured`);
  }

  // Check for CodeWhisperer providers specifically
  const codewhispererProviders = Object.entries(config.providers || {})
    .filter(([id, cfg]) => cfg.type === 'codewhisperer');

  if (codewhispererProviders.length > 0) {
    successes.push(`${codewhispererProviders.length} CodeWhisperer provider(s) found`);
    
    for (const [providerId, providerConfig] of codewhispererProviders) {
      const tokenPath = providerConfig.authentication?.credentials?.tokenPath;
      if (tokenPath && existsSync(expandPath(tokenPath))) {
        successes.push(`Token file exists for ${providerId}`);
      } else {
        issues.push(`Token file missing for ${providerId}: ${tokenPath}`);
      }
    }
  }

  console.log('\n✅ Successes:');
  for (const success of successes) {
    console.log(`   • ${success}`);
  }

  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    for (const issue of issues) {
      console.log(`   • ${issue}`);
    }
    
    console.log('\n🔧 Recommendations:');
    if (issues.some(i => i.includes('Token file missing'))) {
      console.log('   1. Ensure your AWS SSO token files exist and are not expired');
      console.log('   2. Run `aws sso login` to refresh your tokens');
      console.log('   3. Check that token paths in config.json match actual file locations');
    }
    
    if (issues.some(i => i.includes('Provider') && i.includes('NOT defined'))) {
      console.log('   4. Ensure all providers referenced in routing are defined in providers section');
    }
    
  } else {
    console.log('\n🎉 All checks passed! Configuration appears to be valid.');
  }

  console.log('\n🚀 Next Steps:');
  console.log('   1. Try starting the router: rcc start --debug');
  console.log('   2. Check logs for detailed error messages');
  console.log('   3. Test with a simple request once router is running');
}).catch(console.error);