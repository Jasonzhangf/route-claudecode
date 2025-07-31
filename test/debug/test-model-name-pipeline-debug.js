#!/usr/bin/env node

/**
 * Model Name Pipeline Debug Test
 * Comprehensive test to trace model name transformations through entire pipeline
 * and identify where the model name conversion issue occurs
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const SERVER_URL = 'http://127.0.0.1:3456';
const DEBUG_OUTPUT_DIR = path.join(process.env.HOME, '.route-claude-code', 'database', 'test-sessions');
const LOG_FILE = '/tmp/test-model-name-debug.log';

// Ensure output directory exists
if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
  fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
}

// Logging utility
function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message} ${JSON.stringify(data)}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Test scenarios covering all routing categories
const TEST_SCENARIOS = [
  {
    name: 'default-routing-sonnet4',
    description: 'Default category routing with claude-sonnet-4-20250514',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello, what model are you?' }],
      max_tokens: 100,
      stream: false
    },
    expectedCategory: 'default',
    expectedProvider: 'codewhisperer-primary',
    expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
    expectedFinalModel: 'claude-sonnet-4-20250514'
  },
  {
    name: 'background-routing-haiku',
    description: 'Background category routing with claude-3-5-haiku-20241022',
    request: {
      model: 'claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: 'Quick question: what model are you?' }],
      max_tokens: 50,
      stream: false
    },
    expectedCategory: 'background',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-flash',
    expectedFinalModel: 'claude-3-5-haiku-20241022'
  },
  {
    name: 'search-tools-routing',
    description: 'Search category routing with WebSearch tool',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Search for latest AI news and tell me about it' }],
      max_tokens: 200,
      stream: false,
      tools: [
        {
          name: 'WebSearch',
          description: 'Search the web for information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            }
          }
        }
      ]
    },
    expectedCategory: 'search',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-flash',
    expectedFinalModel: 'claude-sonnet-4-20250514'
  },
  {
    name: 'longcontext-routing',
    description: 'Long context routing with high token count',
    request: {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { 
          role: 'user', 
          content: 'Analyze this very long document: ' + 'Lorem ipsum dolor sit amet, '.repeat(2000) + 'What model are you using?'
        }
      ],
      max_tokens: 300,
      stream: false
    },
    expectedCategory: 'longcontext',
    expectedProvider: 'shuaihong-openai', 
    expectedTargetModel: 'gemini-2.5-pro',
    expectedFinalModel: 'claude-3-5-sonnet-20241022'
  },
  {
    name: 'streaming-response-test',
    description: 'Streaming response model name preservation',
    request: {
      model: 'claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: 'Stream response: what model are you?' }],
      max_tokens: 100,
      stream: true
    },
    expectedCategory: 'background',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-flash',
    expectedFinalModel: 'claude-3-5-haiku-20241022',
    testType: 'streaming'
  }
];

// Model name extraction utilities
function extractModelFromResponse(response, testType = 'non-streaming') {
  if (testType === 'streaming') {
    // For streaming, look for message_start event
    const lines = response.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.type === 'message_start' && data.message && data.message.model) {
            return data.message.model;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return 'unknown-streaming';
  } else {
    // For non-streaming, look in response.model
    if (response && typeof response === 'object' && response.model) {
      return response.model;
    }
    return 'unknown-non-streaming';
  }
}

// Pipeline debug data capture
async function captureDebugData(testName, requestData, responseData, extractedModel) {
  const debugData = {
    testName,
    timestamp: new Date().toISOString(),
    pipeline: {
      input: {
        originalModel: requestData.model,
        request: requestData
      },
      output: {
        extractedModel,
        response: responseData
      }
    },
    analysis: {
      modelNameMatch: requestData.model === extractedModel,
      expectedModel: requestData.model,
      actualModel: extractedModel,
      issue: requestData.model !== extractedModel ? 'MODEL_NAME_MISMATCH' : null
    }
  };

  const filename = `${testName}-${Date.now()}.json`;
  const filepath = path.join(DEBUG_OUTPUT_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(debugData, null, 2));
    log(`Debug data captured: ${filepath}`);
    return debugData;
  } catch (error) {
    log(`Failed to capture debug data: ${error.message}`);
    return null;
  }
}

// Execute single test scenario
async function executeTestScenario(scenario) {
  log(`\n=== Starting Test: ${scenario.name} ===`);
  log(`Description: ${scenario.description}`);
  log(`Input Model: ${scenario.request.model}`);
  log(`Expected Final Model: ${scenario.expectedFinalModel}`);

  const startTime = Date.now();
  let testResult = {
    testName: scenario.name,
    success: false,
    actualModel: null,
    expectedModel: scenario.expectedFinalModel,
    issue: null,
    duration: 0,
    debugDataPath: null
  };

  try {
    // Make API request
    const requestConfig = {
      method: 'POST',
      url: `${SERVER_URL}/v1/messages?beta=true`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': scenario.testType === 'streaming' ? 'text/event-stream' : 'application/json'
      },
      data: scenario.request,
      timeout: 30000
    };

    log(`Making request to ${requestConfig.url}`);
    const response = await axios(requestConfig);
    
    // Extract model name from response
    const extractedModel = extractModelFromResponse(
      scenario.testType === 'streaming' ? response.data : response.data,
      scenario.testType
    );

    testResult.actualModel = extractedModel;
    testResult.duration = Date.now() - startTime;
    
    log(`Response received - Status: ${response.status}`);
    log(`Extracted Model: ${extractedModel}`);
    log(`Expected Model: ${scenario.expectedFinalModel}`);

    // Capture debug data
    const debugData = await captureDebugData(
      scenario.name,
      scenario.request,
      response.data,
      extractedModel
    );
    
    if (debugData) {
      testResult.debugDataPath = path.join(DEBUG_OUTPUT_DIR, `${scenario.name}-${Date.now()}.json`);
    }

    // Validate model name consistency
    if (extractedModel === scenario.expectedFinalModel) {
      testResult.success = true;
      log(`✅ SUCCESS: Model name preserved correctly`);
    } else {
      testResult.success = false;
      testResult.issue = 'MODEL_NAME_MISMATCH';
      log(`❌ FAILURE: Model name mismatch`);
      log(`  Expected: ${scenario.expectedFinalModel}`);
      log(`  Actual: ${extractedModel}`);
    }

  } catch (error) {
    testResult.duration = Date.now() - startTime;
    testResult.issue = error.response ? `HTTP_${error.response.status}` : error.code || 'UNKNOWN_ERROR';
    
    log(`❌ ERROR: ${error.message}`);
    if (error.response) {
      log(`HTTP Status: ${error.response.status}`);
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }

  log(`Test Duration: ${testResult.duration}ms`);
  log(`=== End Test: ${scenario.name} ===\n`);
  
  return testResult;
}

// Generate comprehensive test report
function generateTestReport(results) {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  const report = {
    summary: {
      totalTests,
      passedTests,
      failedTests,
      successRate: `${Math.round((passedTests / totalTests) * 100)}%`,
      timestamp: new Date().toISOString()
    },
    results,
    issues: {
      modelNameMismatches: results.filter(r => r.issue === 'MODEL_NAME_MISMATCH'),
      httpErrors: results.filter(r => r.issue && r.issue.startsWith('HTTP_')),
      unknownErrors: results.filter(r => r.issue && !r.issue.startsWith('HTTP_') && r.issue !== 'MODEL_NAME_MISMATCH')
    },
    recommendations: []
  };

  // Generate recommendations based on issues found
  if (report.issues.modelNameMismatches.length > 0) {
    report.recommendations.push({
      priority: 'HIGH',
      issue: 'Model Name Conversion Issue',
      description: 'Original model names are being replaced with internal mapped names in final responses',
      affectedTests: report.issues.modelNameMismatches.map(r => r.testName),
      suggestedFix: 'Check streaming response model name handling in server.ts handleStreamingRequest method'
    });
  }

  if (report.issues.httpErrors.length > 0) {
    report.recommendations.push({
      priority: 'MEDIUM',
      issue: 'HTTP API Errors',
      description: 'Some API requests are failing with HTTP errors',
      affectedTests: report.issues.httpErrors.map(r => r.testName),
      suggestedFix: 'Check provider authentication and API endpoint configuration'
    });
  }

  return report;
}

// Main test execution
async function runModelNameDebugTests() {
  log('🔍 Starting Model Name Pipeline Debug Tests');
  log(`Server URL: ${SERVER_URL}`);
  log(`Debug Output Directory: ${DEBUG_OUTPUT_DIR}`);
  log(`Total Test Scenarios: ${TEST_SCENARIOS.length}`);

  // Clear previous log
  if (fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }

  const results = [];

  // Execute all test scenarios
  for (const scenario of TEST_SCENARIOS) {
    const result = await executeTestScenario(scenario);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate and save comprehensive report
  const report = generateTestReport(results);
  const reportPath = path.join(DEBUG_OUTPUT_DIR, `model-name-debug-report-${Date.now()}.json`);
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📊 Test Report Generated: ${reportPath}`);
  } catch (error) {
    log(`Failed to save test report: ${error.message}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('🔍 MODEL NAME PIPELINE DEBUG TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Passed: ${report.summary.passedTests}`);
  console.log(`Failed: ${report.summary.failedTests}`);
  console.log(`Success Rate: ${report.summary.successRate}`);
  console.log('');

  if (report.issues.modelNameMismatches.length > 0) {
    console.log('❌ MODEL NAME CONVERSION ISSUES DETECTED:');
    report.issues.modelNameMismatches.forEach(issue => {
      console.log(`  - ${issue.testName}: Expected "${issue.expectedModel}", Got "${issue.actualModel}"`);
    });
    console.log('');
  }

  if (report.recommendations.length > 0) {
    console.log('🔧 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   ${rec.description}`);
      console.log(`   Fix: ${rec.suggestedFix}`);
      console.log('');
    });
  }

  console.log(`📁 Debug data saved to: ${DEBUG_OUTPUT_DIR}`);
  console.log(`📋 Full log: ${LOG_FILE}`);
  console.log('='.repeat(80));

  // Exit with appropriate code
  process.exit(report.summary.failedTests > 0 ? 1 : 0);
}

// Run the tests
if (require.main === module) {
  runModelNameDebugTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runModelNameDebugTests,
  TEST_SCENARIOS,
  extractModelFromResponse
};