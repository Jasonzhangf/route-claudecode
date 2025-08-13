#!/usr/bin/env node

/**
 * Zero-Hardcoding Configuration Compliance Test
 * 
 * Tests Requirements 4.1-4.3 and 10.1-10.4 compliance:
 * - ZERO hardcoded values (all values from external configuration)
 * - ZERO fallback mechanisms (explicit errors instead of fallbacks)
 * - Environment-based configuration separation
 * - Configuration-driven error responses
 * 
 * @author Jason Zhang
 * @version v3.0-zero-hardcoding-test
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test Zero-Hardcoding Configuration System
 */
async function testZeroHardcodingCompliance() {
  console.log('🧪 Testing Zero-Hardcoding Configuration Compliance');
  console.log('📋 Requirements: 4.1, 4.2, 4.3, 10.1, 10.2, 10.3, 10.4');
  
  const testResults = {
    testName: 'Zero-Hardcoding Configuration Compliance',
    startTime: new Date().toISOString(),
    tests: [],
    passed: 0,
    failed: 0,
    summary: {}
  };
  
  try {
    // Test 1: Environment Variable Configuration Loading
    console.log('\n🔧 Test 1: Environment Variable Configuration Loading');
    
    // Set required environment variable
    process.env.ROUTE_CLAUDE_CONFIG_PATH = path.resolve(process.cwd(), 'src/v3/config/environments');
    process.env.SHUAIHONG_API_KEY_JSON = JSON.stringify(['test-api-key-1', 'test-api-key-2']);
    process.env.GOOGLE_GEMINI_API_KEY_JSON = JSON.stringify(['test-gemini-key']);
    
    const testResult1 = await testEnvironmentVariableLoading();
    testResults.tests.push(testResult1);
    
    if (testResult1.status === 'passed') {
      testResults.passed++;
      console.log('   ✅ Environment variable loading: PASSED');
    } else {
      testResults.failed++;
      console.log('   ❌ Environment variable loading: FAILED');
      console.log(`   Error: ${testResult1.error}`);
    }
    
    // Test 2: Explicit Error Handling (NO Fallbacks)
    console.log('\n🚫 Test 2: Explicit Error Handling (NO Fallbacks)');
    
    const testResult2 = await testExplicitErrorHandling();
    testResults.tests.push(testResult2);
    
    if (testResult2.status === 'passed') {
      testResults.passed++;
      console.log('   ✅ Explicit error handling: PASSED');
    } else {
      testResults.failed++;
      console.log('   ❌ Explicit error handling: FAILED');
      console.log(`   Error: ${testResult2.error}`);
    }
    
    // Test 3: Environment-Based Configuration Separation
    console.log('\n🏗️ Test 3: Environment-Based Configuration Separation');
    
    const testResult3 = await testEnvironmentSeparation();
    testResults.tests.push(testResult3);
    
    if (testResult3.status === 'passed') {
      testResults.passed++;
      console.log('   ✅ Environment separation: PASSED');
    } else {
      testResults.failed++;
      console.log('   ❌ Environment separation: FAILED');
      console.log(`   Error: ${testResult3.error}`);
    }
    
    // Test 4: Configuration-Driven Error Messages
    console.log('\n💬 Test 4: Configuration-Driven Error Messages');
    
    const testResult4 = await testConfigurationDrivenErrors();
    testResults.tests.push(testResult4);
    
    if (testResult4.status === 'passed') {
      testResults.passed++;
      console.log('   ✅ Configuration-driven errors: PASSED');
    } else {
      testResults.failed++;
      console.log('   ❌ Configuration-driven errors: FAILED');
      console.log(`   Error: ${testResult4.error}`);
    }
    
    // Test 5: Configuration Validation System
    console.log('\n✅ Test 5: Configuration Validation System');
    
    const testResult5 = await testConfigurationValidation();
    testResults.tests.push(testResult5);
    
    if (testResult5.status === 'passed') {
      testResults.passed++;
      console.log('   ✅ Configuration validation: PASSED');
    } else {
      testResults.failed++;
      console.log('   ❌ Configuration validation: FAILED');
      console.log(`   Error: ${testResult5.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    testResults.tests.push({
      name: 'Test Execution',
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    testResults.failed++;
  }
  
  testResults.endTime = new Date().toISOString();
  testResults.summary = {
    total: testResults.tests.length,
    passed: testResults.passed,
    failed: testResults.failed,
    compliance: testResults.failed === 0 ? 'COMPLIANT' : 'NON-COMPLIANT'
  };
  
  // Save test results
  const outputDir = path.join(process.cwd(), 'test', 'output', 'functional');
  await fs.mkdir(outputDir, { recursive: true });
  
  const reportFile = path.join(outputDir, `zero-hardcoding-compliance-${Date.now()}.json`);
  await fs.writeFile(reportFile, JSON.stringify(testResults, null, 2));
  
  console.log(`\n📊 Zero-Hardcoding Compliance Test Summary:`);
  console.log(`   Total Tests: ${testResults.summary.total}`);
  console.log(`   ✅ Passed: ${testResults.summary.passed}`);
  console.log(`   ❌ Failed: ${testResults.summary.failed}`);
  console.log(`   🎯 Compliance Status: ${testResults.summary.compliance}`);
  console.log(`   📄 Report: ${reportFile}`);
  
  return testResults;
}

/**
 * Test environment variable configuration loading
 */
async function testEnvironmentVariableLoading() {
  const test = {
    name: 'Environment Variable Configuration Loading',
    status: 'unknown',
    details: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // Import the Zero-Hardcoding Configuration Manager
    const { ZeroHardcodingConfigManager } = await import('../../src/v3/config/zero-hardcoding-config-manager.ts');
    
    // Test loading development configuration
    const configManager = new ZeroHardcodingConfigManager('development');
    const config = await configManager.loadConfiguration();
    
    // Validate that configuration was loaded from external sources
    test.details.push('✅ Configuration loaded from external files');
    
    // Validate that environment variables were processed
    const sources = configManager.getConfigurationSources();
    const envSources = Array.from(sources.keys()).filter(key => key.startsWith('env-'));
    
    if (envSources.length > 0) {
      test.details.push(`✅ Environment variables loaded: ${envSources.length}`);
    } else {
      throw new Error('No environment variables were loaded');
    }
    
    // Validate configuration completeness
    if (!config.server || !config.providers || !config.routing) {
      throw new Error('Configuration is incomplete');
    }
    
    test.details.push('✅ Configuration structure is complete');
    test.details.push(`✅ Providers loaded: ${Object.keys(config.providers).length}`);
    test.details.push(`✅ Routing categories: ${Object.keys(config.routing.categories).length}`);
    
    test.status = 'passed';
    
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
  }
  
  return test;
}

/**
 * Test explicit error handling (NO fallbacks)
 */
async function testExplicitErrorHandling() {
  const test = {
    name: 'Explicit Error Handling (NO Fallbacks)',
    status: 'unknown',
    details: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    const { ZeroHardcodingConfigManager } = await import('../../src/v3/config/zero-hardcoding-config-manager.ts');
    
    // Test 1: Missing environment variable should throw explicit error
    const originalEnvVar = process.env.ROUTE_CLAUDE_CONFIG_PATH;
    delete process.env.ROUTE_CLAUDE_CONFIG_PATH;
    
    try {
      const configManager = new ZeroHardcodingConfigManager('development');
      throw new Error('Should have thrown error for missing environment variable');
    } catch (error) {
      if (error.message.includes('ROUTE_CLAUDE_CONFIG_PATH environment variable not set')) {
        test.details.push('✅ Explicit error for missing environment variable');
      } else {
        throw error;
      }
    }
    
    // Restore environment variable
    process.env.ROUTE_CLAUDE_CONFIG_PATH = originalEnvVar;
    
    // Test 2: Invalid environment should throw explicit error
    try {
      const configManager = new ZeroHardcodingConfigManager('invalid-environment');
      await configManager.loadConfiguration(); // This should throw the error
      throw new Error('Should have thrown error for invalid environment');
    } catch (error) {
      if (error.message.includes('config file not found') || error.message.includes('CONFIGURATION FILE MISSING') || error.message.includes('REQUIRED CONFIGURATION FILE MISSING')) {
        test.details.push('✅ Explicit error for invalid environment');
      } else {
        throw error;
      }
    }
    
    // Test 3: Missing configuration value should throw explicit error
    const configManager = new ZeroHardcodingConfigManager('testing');
    const config = await configManager.loadConfiguration();
    
    try {
      const nonExistentValue = configManager.getConfigValue('nonexistent.config.path');
      throw new Error('Should have thrown error for missing config value');
    } catch (error) {
      if (error.message.includes('CONFIGURATION VALUE NOT FOUND')) {
        test.details.push('✅ Explicit error for missing configuration value');
      } else {
        throw error;
      }
    }
    
    test.status = 'passed';
    
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
  }
  
  return test;
}

/**
 * Test environment-based configuration separation
 */
async function testEnvironmentSeparation() {
  const test = {
    name: 'Environment-Based Configuration Separation',
    status: 'unknown',
    details: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    const { ZeroHardcodingConfigManager } = await import('../../src/v3/config/zero-hardcoding-config-manager.ts');
    
    // Test development environment
    const devConfigManager = new ZeroHardcodingConfigManager('development');
    const devConfig = await devConfigManager.loadConfiguration();
    
    // Test testing environment
    const testConfigManager = new ZeroHardcodingConfigManager('testing');
    const testConfig = await testConfigManager.loadConfiguration();
    
    // Validate that configurations are different
    if (devConfig.server.port === testConfig.server.port) {
      throw new Error('Development and testing configurations should have different ports');
    }
    
    test.details.push(`✅ Development port: ${devConfig.server.port}`);
    test.details.push(`✅ Testing port: ${testConfig.server.port}`);
    
    // Validate environment-specific values
    if (devConfig.server.environment !== 'development') {
      throw new Error('Development config should have environment=development');
    }
    
    if (testConfig.server.environment !== 'testing') {
      throw new Error('Testing config should have environment=testing');
    }
    
    test.details.push('✅ Environment-specific configurations loaded correctly');
    
    // Validate different provider configurations
    const devProviders = Object.keys(devConfig.providers);
    const testProviders = Object.keys(testConfig.providers);
    
    test.details.push(`✅ Development providers: ${devProviders.join(', ')}`);
    test.details.push(`✅ Testing providers: ${testProviders.join(', ')}`);
    
    test.status = 'passed';
    
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
  }
  
  return test;
}

/**
 * Test configuration-driven error messages
 */
async function testConfigurationDrivenErrors() {
  const test = {
    name: 'Configuration-Driven Error Messages',
    status: 'unknown',
    details: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    const { ZeroHardcodingConfigManager } = await import('../../src/v3/config/zero-hardcoding-config-manager.ts');
    
    const configManager = new ZeroHardcodingConfigManager('development');
    const config = await configManager.loadConfiguration();
    
    // Test error message retrieval
    const errorMessage = configManager.getErrorMessage('provider_unavailable', { 
      provider: 'test-provider' 
    });
    
    if (!errorMessage || errorMessage.includes('{provider}')) {
      throw new Error('Error message template not properly processed');
    }
    
    test.details.push(`✅ Error message template processed: ${errorMessage}`);
    
    // Test HTTP error code retrieval
    const errorCode = configManager.getErrorCode('authentication_failed');
    
    if (errorCode !== 401) {
      throw new Error('Expected HTTP 401 for authentication_failed error');
    }
    
    test.details.push(`✅ HTTP error code retrieved: ${errorCode}`);
    
    // Test that all required error templates exist
    const requiredErrorKeys = ['configuration_missing', 'provider_unavailable', 'model_not_found', 'authentication_failed', 'request_timeout', 'validation_error'];
    
    for (const errorKey of requiredErrorKeys) {
      const message = configManager.getErrorMessage(errorKey);
      const code = configManager.getErrorCode(errorKey);
      
      if (!message || !code) {
        throw new Error(`Missing error configuration for: ${errorKey}`);
      }
    }
    
    test.details.push(`✅ All ${requiredErrorKeys.length} required error configurations present`);
    
    test.status = 'passed';
    
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
  }
  
  return test;
}

/**
 * Test configuration validation system
 */
async function testConfigurationValidation() {
  const test = {
    name: 'Configuration Validation System',
    status: 'unknown',
    details: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    const { ZeroHardcodingConfigManager } = await import('../../src/v3/config/zero-hardcoding-config-manager.ts');
    
    const configManager = new ZeroHardcodingConfigManager('testing');
    const config = await configManager.loadConfiguration();
    
    // Test configuration validation
    const compliance = configManager.validateZeroHardcodingCompliance();
    
    if (!compliance.compliant) {
      throw new Error(`Configuration not compliant: ${compliance.violations.join(', ')}`);
    }
    
    test.details.push('✅ Zero-hardcoding compliance validated');
    
    // Test required configuration validation
    const requiredPaths = config.validation.required;
    
    for (const requiredPath of requiredPaths) {
      try {
        const value = configManager.getConfigValue(requiredPath);
        if (value === undefined || value === null) {
          throw new Error(`Required configuration missing: ${requiredPath}`);
        }
      } catch (error) {
        throw new Error(`Required configuration validation failed for ${requiredPath}: ${error.message}`);
      }
    }
    
    test.details.push(`✅ All ${requiredPaths.length} required configurations validated`);
    
    // Test configuration structure validation
    const requiredSections = ['server', 'providers', 'routing', 'debug', 'errors', 'validation'];
    for (const section of requiredSections) {
      if (!config[section]) {
        throw new Error(`Required configuration section missing: ${section}`);
      }
    }
    
    test.details.push(`✅ All ${requiredSections.length} required sections present`);
    
    test.status = 'passed';
    
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
  }
  
  return test;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const results = await testZeroHardcodingCompliance();
    process.exit(results.summary.compliance === 'COMPLIANT' ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

export { testZeroHardcodingCompliance };