#!/usr/bin/env node

/**
 * Test: OpenAI Provider Conversation Concurrency Control
 * 
 * Validates Anthropic-compliant sequential processing within conversations:
 * 1. Same session + conversationID requests are processed sequentially
 * 2. RequestID has clear numeric ordering
 * 3. Finish reasons are correctly handled
 * 4. Input blocks until previous request completes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5508', // ShuaiHong OpenAI provider
  logDir: '/tmp/openai-concurrency-test',
  testTimeout: 60000, // 60 seconds
  concurrentRequests: 3,
  sessionId: `test-session-${Date.now()}`,
  conversationId: `test-conv-${Date.now()}`
};

// Ensure log directory exists
if (!fs.existsSync(TEST_CONFIG.logDir)) {
  fs.mkdirSync(TEST_CONFIG.logDir, { recursive: true });
}

/**
 * Test concurrent requests within same conversation
 */
async function testConversationConcurrency() {
  console.log('🔄 Testing conversation-level concurrency control...');
  
  const results = [];
  const startTime = Date.now();
  
  // Create multiple concurrent requests for the same conversation
  const requests = Array.from({ length: TEST_CONFIG.concurrentRequests }, (_, index) => {
    return sendTestRequest({
      sessionId: TEST_CONFIG.sessionId,
      conversationId: TEST_CONFIG.conversationId,
      requestIndex: index,
      message: `Test message ${index + 1} - should be processed sequentially`
    });
  });
  
  try {
    // Send all requests concurrently
    console.log(`📤 Sending ${TEST_CONFIG.concurrentRequests} concurrent requests...`);
    const responses = await Promise.all(requests);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Analyze results
    const analysis = analyzeSequentialProcessing(responses, totalTime);
    
    // Save detailed results
    const reportPath = path.join(TEST_CONFIG.logDir, `concurrency-test-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      testConfig: TEST_CONFIG,
      responses,
      analysis,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('📊 Concurrency Test Results:');
    console.log(`   Sequential Processing: ${analysis.isSequential ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Request ID Ordering: ${analysis.hasCorrectOrdering ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Finish Reason Coverage: ${analysis.finishReasonCoverage}%`);
    console.log(`   Total Processing Time: ${totalTime}ms`);
    console.log(`   Average Request Time: ${Math.round(totalTime / TEST_CONFIG.concurrentRequests)}ms`);
    console.log(`   Detailed Report: ${reportPath}`);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Concurrency test failed:', error.message);
    
    // Save error details
    const errorPath = path.join(TEST_CONFIG.logDir, `concurrency-error-${Date.now()}.json`);
    fs.writeFileSync(errorPath, JSON.stringify({
      error: error.message,
      stack: error.stack,
      testConfig: TEST_CONFIG,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    throw error;
  }
}

/**
 * Send a test request with session and conversation metadata
 */
async function sendTestRequest({ sessionId, conversationId, requestIndex, message }) {
  const requestStart = Date.now();
  
  const requestData = {
    model: 'glm-4.5',
    messages: [
      {
        role: 'user',
        content: message
      }
    ],
    max_tokens: 100,
    temperature: 0.1
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    'x-conversation-id': conversationId,
    'x-request-index': requestIndex.toString()
  };
  
  try {
    console.log(`📤 Sending request ${requestIndex + 1}...`);
    
    const response = await axios.post(
      `${TEST_CONFIG.baseUrl}/v1/messages`,
      requestData,
      { 
        headers,
        timeout: TEST_CONFIG.testTimeout
      }
    );
    
    const requestEnd = Date.now();
    const processingTime = requestEnd - requestStart;
    
    console.log(`✅ Request ${requestIndex + 1} completed in ${processingTime}ms`);
    
    return {
      requestIndex,
      sessionId,
      conversationId,
      requestStart,
      requestEnd,
      processingTime,
      response: response.data,
      headers: response.headers,
      status: response.status
    };
    
  } catch (error) {
    const requestEnd = Date.now();
    const processingTime = requestEnd - requestStart;
    
    console.error(`❌ Request ${requestIndex + 1} failed after ${processingTime}ms:`, error.message);
    
    return {
      requestIndex,
      sessionId,
      conversationId,
      requestStart,
      requestEnd,
      processingTime,
      error: error.message,
      status: error.response?.status || 'network_error'
    };
  }
}

/**
 * Analyze if requests were processed sequentially
 */
function analyzeSequentialProcessing(responses, totalTime) {
  const analysis = {
    isSequential: true,
    hasCorrectOrdering: true,
    finishReasonCoverage: 0,
    sequentialityScore: 0,
    orderingScore: 0,
    issues: []
  };
  
  // Sort responses by request index for analysis
  const sortedResponses = responses.sort((a, b) => a.requestIndex - b.requestIndex);
  
  // Check if requests were processed sequentially (no overlap)
  let previousEnd = 0;
  let sequentialCount = 0;
  
  for (const response of sortedResponses) {
    if (response.requestStart >= previousEnd) {
      sequentialCount++;
    } else {
      analysis.issues.push(`Request ${response.requestIndex + 1} started before previous request completed`);
    }
    previousEnd = response.requestEnd;
  }
  
  analysis.sequentialityScore = Math.round((sequentialCount / responses.length) * 100);
  analysis.isSequential = analysis.sequentialityScore >= 90; // Allow some timing tolerance
  
  // Check request ID ordering (if available in response headers)
  let orderingCount = 0;
  let finishReasonCount = 0;
  
  for (const response of sortedResponses) {
    // Check for sequential request ID in response headers
    const requestId = response.headers?.['x-request-id'] || response.response?.id;
    if (requestId && requestId.includes('seq')) {
      const seqMatch = requestId.match(/seq(\d+)/);
      if (seqMatch) {
        const seqNumber = parseInt(seqMatch[1], 10);
        if (seqNumber === response.requestIndex + 1) {
          orderingCount++;
        } else {
          analysis.issues.push(`Request ${response.requestIndex + 1} has incorrect sequence number: ${seqNumber}`);
        }
      }
    }
    
    // Check for finish reason
    const finishReason = response.response?.stop_reason || 
                        response.response?.choices?.[0]?.finish_reason;
    if (finishReason && finishReason !== 'unknown') {
      finishReasonCount++;
    }
  }
  
  analysis.orderingScore = Math.round((orderingCount / responses.length) * 100);
  analysis.hasCorrectOrdering = analysis.orderingScore >= 80; // Allow some tolerance
  analysis.finishReasonCoverage = Math.round((finishReasonCount / responses.length) * 100);
  
  // Overall assessment
  if (analysis.issues.length === 0) {
    analysis.overallStatus = 'PASS';
  } else if (analysis.isSequential && analysis.hasCorrectOrdering) {
    analysis.overallStatus = 'PASS_WITH_WARNINGS';
  } else {
    analysis.overallStatus = 'FAIL';
  }
  
  return analysis;
}

/**
 * Test different conversation scenarios
 */
async function testMultipleConversationScenarios() {
  console.log('🔄 Testing multiple conversation scenarios...');
  
  const scenarios = [
    {
      name: 'Same Session, Same Conversation',
      sessionId: `session-1-${Date.now()}`,
      conversationId: `conv-1-${Date.now()}`,
      expectedSequential: true
    },
    {
      name: 'Same Session, Different Conversation',
      sessionId: `session-1-${Date.now()}`,
      conversationId: `conv-2-${Date.now()}`,
      expectedSequential: false
    },
    {
      name: 'Different Session, Same Conversation ID',
      sessionId: `session-2-${Date.now()}`,
      conversationId: `conv-1-${Date.now()}`,
      expectedSequential: false
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    
    const requests = Array.from({ length: 2 }, (_, index) => {
      return sendTestRequest({
        sessionId: scenario.sessionId,
        conversationId: scenario.conversationId,
        requestIndex: index,
        message: `${scenario.name} - Message ${index + 1}`
      });
    });
    
    try {
      const responses = await Promise.all(requests);
      const analysis = analyzeSequentialProcessing(responses, 0);
      
      const scenarioResult = {
        scenario: scenario.name,
        expected: scenario.expectedSequential ? 'Sequential' : 'Concurrent',
        actual: analysis.isSequential ? 'Sequential' : 'Concurrent',
        passed: analysis.isSequential === scenario.expectedSequential,
        analysis
      };
      
      results.push(scenarioResult);
      
      console.log(`   Result: ${scenarioResult.passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Expected: ${scenarioResult.expected}, Actual: ${scenarioResult.actual}`);
      
    } catch (error) {
      console.error(`   ❌ Scenario failed: ${error.message}`);
      results.push({
        scenario: scenario.name,
        error: error.message,
        passed: false
      });
    }
  }
  
  return results;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 OpenAI Provider Conversation Concurrency Control Test');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Basic concurrency control
    console.log('\n📋 Test 1: Basic Conversation Concurrency Control');
    const basicTest = await testConversationConcurrency();
    
    // Test 2: Multiple conversation scenarios
    console.log('\n📋 Test 2: Multiple Conversation Scenarios');
    const scenarioTests = await testMultipleConversationScenarios();
    
    // Generate final report
    const finalReport = {
      testSuite: 'OpenAI Conversation Concurrency Control',
      timestamp: new Date().toISOString(),
      basicConcurrencyTest: basicTest,
      scenarioTests,
      overallStatus: (basicTest.overallStatus === 'PASS' && 
                     scenarioTests.every(s => s.passed)) ? 'PASS' : 'FAIL'
    };
    
    const reportPath = path.join(TEST_CONFIG.logDir, `final-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    
    console.log('\n🎯 Final Test Results:');
    console.log(`   Overall Status: ${finalReport.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Basic Concurrency: ${basicTest.overallStatus}`);
    console.log(`   Scenario Tests: ${scenarioTests.filter(s => s.passed).length}/${scenarioTests.length} passed`);
    console.log(`   Final Report: ${reportPath}`);
    
    if (finalReport.overallStatus === 'FAIL') {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  testConversationConcurrency,
  testMultipleConversationScenarios,
  TEST_CONFIG
};