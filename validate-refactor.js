#!/usr/bin/env node

/**
 * Comprehensive Refactor Validation
 * Tests all key aspects of the model mapping refactor
 */

const { RoutingEngine } = require('./dist/routing/engine.js');
const fs = require('fs');

// Mock configuration that matches the expected structure
const mockConfig = {
  routing: {
    default: {
      provider: 'codewhisperer-primary',
      model: 'CLAUDE_SONNET_4_20250514_V1_0'
    },
    background: {
      provider: 'shuaihong-openai',
      model: 'gemini-2.5-flash'
    },
    thinking: {
      provider: 'codewhisperer-primary',
      model: 'CLAUDE_SONNET_4_20250514_V1_0'
    },
    longcontext: {
      provider: 'shuaihong-openai',
      model: 'gemini-2.5-pro'
    },
    search: {
      provider: 'shuaihong-openai',
      model: 'gemini-2.5-flash'
    }
  },
  defaultProvider: 'codewhisperer-primary',
  providers: {
    'codewhisperer-primary': {
      type: 'codewhisperer',
      endpoint: 'https://codewhisperer.us-east-1.amazonaws.com'
    },
    'shuaihong-openai': {
      type: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions'
    }
  }
};

async function validateRefactor() {
  console.log('🔍 Comprehensive Refactor Validation');
  console.log('=' .repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    validation: 'refactor-comprehensive',
    tests: []
  };

  // Initialize routing engine
  const routingEngine = new RoutingEngine(mockConfig);

  // Test Cases
  const testCases = [
    {
      name: 'Background Category (Haiku)',
      model: 'claude-3-5-haiku-20241022',
      expectedCategory: 'background',
      expectedProvider: 'shuaihong-openai',
      expectedTargetModel: 'gemini-2.5-flash'
    },
    {
      name: 'Default Category (Sonnet 4)',
      model: 'claude-sonnet-4-20250514',
      expectedCategory: 'default',
      expectedProvider: 'codewhisperer-primary',
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
    },
    {
      name: 'Thinking Category (Explicit)',
      model: 'claude-3-5-sonnet-20241022',
      metadata: { thinking: true },
      expectedCategory: 'thinking',
      expectedProvider: 'codewhisperer-primary',
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
    },
    {
      name: 'Long Context Category',
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'x'.repeat(70000) }], // > 60k characters
      expectedCategory: 'longcontext',
      expectedProvider: 'shuaihong-openai',
      expectedTargetModel: 'gemini-2.5-pro'
    },
    {
      name: 'Search Category (With Tools)',
      model: 'claude-sonnet-4-20250514',
      metadata: { 
        tools: [{ name: 'web_search', description: 'Search the web' }] 
      },
      expectedCategory: 'search',
      expectedProvider: 'shuaihong-openai',
      expectedTargetModel: 'gemini-2.5-flash'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      // Create base request
      const baseRequest = {
        model: testCase.model,
        messages: testCase.messages || [{ role: 'user', content: 'Test message' }],
        max_tokens: 100,
        metadata: testCase.metadata || {}
      };

      // Route the request
      const selectedProvider = await routingEngine.route(baseRequest, 'test-request-id');

      // Validate routing results
      const validation = {
        originalModel: testCase.model,
        selectedProvider: selectedProvider,
        expectedProvider: testCase.expectedProvider,
        providerMatch: selectedProvider === testCase.expectedProvider,
        
        targetModel: baseRequest.metadata?.targetModel,
        expectedTargetModel: testCase.expectedTargetModel,
        targetModelMatch: baseRequest.metadata?.targetModel === testCase.expectedTargetModel,
        
        routingCategory: baseRequest.metadata?.routingCategory,
        expectedCategory: testCase.expectedCategory,
        
        hasTargetModel: !!baseRequest.metadata?.targetModel,
        hasRoutingCategory: !!baseRequest.metadata?.routingCategory
      };

      testCase.validation = validation;
      testCase.passed = validation.providerMatch && validation.targetModelMatch;
      testCase.baseRequest = baseRequest;

      // Log results
      console.log(`✅ Model: ${validation.originalModel}`);
      console.log(`✅ Provider: ${validation.selectedProvider} (expected: ${validation.expectedProvider}) ${validation.providerMatch ? '✅' : '❌'}`);
      console.log(`✅ Target Model: ${validation.targetModel} (expected: ${validation.expectedTargetModel}) ${validation.targetModelMatch ? '✅' : '❌'}`);
      console.log(`✅ Category: ${validation.routingCategory} (expected: ${testCase.expectedCategory})`);
      console.log(`✅ Has Target Model: ${validation.hasTargetModel ? '✅' : '❌'}`);
      
      if (testCase.passed) {
        console.log('🎉 TEST PASSED!');
      } else {
        console.log('❌ TEST FAILED!');
      }

    } catch (error) {
      console.error('❌ Test failed with error:', error.message);
      testCase.passed = false;
      testCase.error = {
        message: error.message,
        stack: error.stack
      };
    }

    results.tests.push(testCase);
  }

  // Summary
  const passedTests = results.tests.filter(t => t.passed).length;
  const totalTests = results.tests.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round(passedTests / totalTests * 100)}%`);

  // Detailed analysis
  console.log('\n📋 DETAILED ANALYSIS:');
  console.log('-'.repeat(60));
  
  for (const test of results.tests) {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}:`);
    if (test.validation) {
      console.log(`    Provider: ${test.validation.providerMatch ? '✅' : '❌'} ${test.validation.selectedProvider}`);
      console.log(`    Target Model: ${test.validation.targetModelMatch ? '✅' : '❌'} ${test.validation.targetModel}`);
    }
    if (test.error) {
      console.log(`    Error: ${test.error.message}`);
    }
  }

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL VALIDATIONS PASSED! REFACTOR IS SUCCESSFUL!');
    console.log('✅ Routing engine correctly sets targetModel in metadata');
    console.log('✅ All categories route to correct providers');
    console.log('✅ Model mapping works for all test cases');
  } else {
    console.log('\n❌ SOME VALIDATIONS FAILED! REFACTOR NEEDS MORE WORK!');
    
    const failedTests = results.tests.filter(t => !t.passed);
    console.log('\n🔍 FAILED TESTS:');
    failedTests.forEach(test => {
      console.log(`❌ ${test.name}`);
      if (test.validation) {
        if (!test.validation.providerMatch) {
          console.log(`  - Expected provider: ${test.validation.expectedProvider}, got: ${test.validation.selectedProvider}`);
        }
        if (!test.validation.targetModelMatch) {
          console.log(`  - Expected target model: ${test.validation.expectedTargetModel}, got: ${test.validation.targetModel}`);
        }
      }
    });
  }

  // Save results
  const resultsFile = '/tmp/refactor-validation-results.json';
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultsFile}`);

  return results;
}

// Run validation
if (require.main === module) {
  validateRefactor()
    .then(results => {
      const allPassed = results.tests.every(t => t.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation execution failed:', error);
      process.exit(1);
    });
}

module.exports = { validateRefactor };