#!/usr/bin/env node

/**
 * Test: OpenAI Finish Reason Coverage Analysis
 * 
 * 专门测试所有finish reason的正确返回：
 * 1. 测试不同类型的请求场景
 * 2. 验证每种finish reason都能正确返回
 * 3. 确保没有silent failure或unknown finish reason
 * 4. 模拟覆盖测试以验证所有可能的结束条件
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration - 零硬编码原则
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5508',
  logDir: process.env.TEST_LOG_DIR || '/tmp/openai-finish-reason-test',
  testTimeout: parseInt(process.env.TEST_TIMEOUT || '60000'), // 60 seconds
  model: process.env.TEST_MODEL || 'gpt-4o-mini',
  maxTokensLimit: parseInt(process.env.MAX_TOKENS_LIMIT || '50') // Small limit to trigger max_tokens
};

// Ensure log directory exists
if (!fs.existsSync(TEST_CONFIG.logDir)) {
  fs.mkdirSync(TEST_CONFIG.logDir, { recursive: true });
}

/**
 * 定义测试场景以覆盖所有可能的finish reason
 */
function defineFinishReasonScenarios() {
  return [
    {
      name: 'Normal Completion',
      expectedFinishReason: 'stop',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Say "Hello World" and nothing else.'
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      },
      description: 'Simple request that should complete normally'
    },
    
    {
      name: 'Max Tokens Limit',
      expectedFinishReason: 'length',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Write a very long story about a magical kingdom with detailed descriptions of characters, places, and events. Include dialogue and multiple chapters.'
          }
        ],
        max_tokens: TEST_CONFIG.maxTokensLimit, // Very small limit to trigger length
        temperature: 0.1
      },
      description: 'Request with small max_tokens to trigger length limit'
    },
    
    {
      name: 'Tool Use Request',
      expectedFinishReason: 'tool_use',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'What is the current time? Please use a tool to get the accurate time.'
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_time',
              description: 'Get the current date and time',
              parameters: {
                type: 'object',
                properties: {
                  timezone: {
                    type: 'string',
                    description: 'The timezone to get time for'
                  }
                }
              }
            }
          }
        ]
      },
      description: 'Request that should trigger tool use'
    },
    
    {
      name: 'Stop Sequence Trigger',
      expectedFinishReason: 'stop',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 10, then say STOP.'
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
        stop: ['STOP']
      },
      description: 'Request with stop sequence that should be triggered'
    },
    
    {
      name: 'Content Filter Test',
      expectedFinishReason: 'content_filter',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Please provide information about safe cooking practices and food safety guidelines.'
          }
        ],
        max_tokens: 200,
        temperature: 0.1
      },
      description: 'Safe content that should not trigger content filter (expecting stop, not content_filter)'
    },
    
    {
      name: 'Multiple Tool Calls',
      expectedFinishReason: 'tool_use',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Please get the current time and also calculate 15 + 27.'
          }
        ],
        max_tokens: 300,
        temperature: 0.1,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_time',
              description: 'Get the current date and time',
              parameters: {
                type: 'object',
                properties: {}
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'calculate',
              description: 'Perform mathematical calculations',
              parameters: {
                type: 'object',
                properties: {
                  expression: {
                    type: 'string',
                    description: 'Mathematical expression to calculate'
                  }
                }
              }
            }
          }
        ]
      },
      description: 'Request that might trigger multiple tool calls'
    }
  ];
}

/**
 * 执行单个finish reason测试场景
 */
async function executeFinishReasonScenario(scenario) {
  console.log(`🧪 Testing: ${scenario.name}`);
  console.log(`   Expected Finish Reason: ${scenario.expectedFinishReason}`);
  console.log(`   Description: ${scenario.description}`);
  
  const testStart = performance.now();
  const requestTimestamp = Date.now();
  
  // Add test metadata to request
  const requestData = {
    ...scenario.request,
    metadata: {
      testScenario: scenario.name,
      expectedFinishReason: scenario.expectedFinishReason,
      testTimestamp: requestTimestamp
    }
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'x-test-scenario': scenario.name,
    'x-expected-finish-reason': scenario.expectedFinishReason,
    'x-test-timestamp': requestTimestamp.toString()
  };
  
  try {
    const response = await axios.post(
      `${TEST_CONFIG.baseUrl}/v1/messages`,
      requestData,
      { 
        headers,
        timeout: TEST_CONFIG.testTimeout
      }
    );
    
    const testEnd = performance.now();
    const processingTime = testEnd - testStart;
    
    // Extract finish reason from response
    const actualFinishReason = response.data.stop_reason || 
                              response.data.choices?.[0]?.finish_reason || 
                              'unknown';
    
    // Analyze result
    const finishReasonMatches = actualFinishReason === scenario.expectedFinishReason;
    const isValidFinishReason = actualFinishReason && 
                               actualFinishReason !== 'unknown' && 
                               actualFinishReason !== 'null' &&
                               actualFinishReason !== '';
    
    console.log(`   ✅ Request completed in ${processingTime.toFixed(2)}ms`);
    console.log(`   Actual Finish Reason: ${actualFinishReason}`);
    console.log(`   Finish Reason Match: ${finishReasonMatches ? '✅ YES' : '❌ NO'}`);
    console.log(`   Valid Finish Reason: ${isValidFinishReason ? '✅ YES' : '❌ NO'}`);
    
    // Check for content in response
    const hasContent = response.data.content || 
                      response.data.choices?.[0]?.message?.content ||
                      response.data.choices?.[0]?.message?.tool_calls;
    
    return {
      scenario: scenario.name,
      expectedFinishReason: scenario.expectedFinishReason,
      actualFinishReason,
      finishReasonMatches,
      isValidFinishReason,
      processingTime,
      hasContent: !!hasContent,
      response: {
        status: response.status,
        headers: response.headers,
        data: response.data
      },
      success: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const testEnd = performance.now();
    const processingTime = testEnd - testStart;
    
    console.error(`   ❌ Request failed after ${processingTime.toFixed(2)}ms:`, error.message);
    
    return {
      scenario: scenario.name,
      expectedFinishReason: scenario.expectedFinishReason,
      actualFinishReason: 'error',
      finishReasonMatches: false,
      isValidFinishReason: false,
      processingTime,
      hasContent: false,
      error: {
        message: error.message,
        status: error.response?.status || 'network_error',
        data: error.response?.data
      },
      success: false,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 测试流式请求的finish reason
 */
async function testStreamingFinishReasons() {
  console.log('\n🌊 Testing Streaming Finish Reasons...');
  
  const streamingScenarios = [
    {
      name: 'Streaming Normal Completion',
      expectedFinishReason: 'stop',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 5 slowly.'
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
        stream: true
      }
    },
    
    {
      name: 'Streaming Tool Use',
      expectedFinishReason: 'tool_use',
      request: {
        model: TEST_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: 'What time is it?'
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
        stream: true,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_time',
              description: 'Get current time',
              parameters: {
                type: 'object',
                properties: {}
              }
            }
          }
        ]
      }
    }
  ];
  
  const streamingResults = [];
  
  for (const scenario of streamingScenarios) {
    console.log(`\n🌊 Testing Streaming: ${scenario.name}`);
    
    try {
      const result = await testStreamingScenario(scenario);
      streamingResults.push(result);
    } catch (error) {
      console.error(`❌ Streaming test failed: ${error.message}`);
      streamingResults.push({
        scenario: scenario.name,
        success: false,
        error: error.message
      });
    }
  }
  
  return streamingResults;
}

/**
 * 执行单个流式测试场景
 */
async function testStreamingScenario(scenario) {
  const testStart = performance.now();
  let lastFinishReason = null;
  let chunkCount = 0;
  let hasContent = false;
  
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-test-scenario': scenario.name,
      'x-expected-finish-reason': scenario.expectedFinishReason
    };
    
    axios.post(
      `${TEST_CONFIG.baseUrl}/v1/messages`,
      scenario.request,
      { 
        headers,
        responseType: 'stream',
        timeout: TEST_CONFIG.testTimeout
      }
    ).then(response => {
      response.data.on('data', (chunk) => {
        chunkCount++;
        const chunkStr = chunk.toString();
        
        // Parse SSE chunks
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              const testEnd = performance.now();
              const processingTime = testEnd - testStart;
              
              console.log(`   ✅ Streaming completed in ${processingTime.toFixed(2)}ms`);
              console.log(`   Chunks received: ${chunkCount}`);
              console.log(`   Final finish reason: ${lastFinishReason || 'none'}`);
              console.log(`   Has content: ${hasContent ? '✅ YES' : '❌ NO'}`);
              
              resolve({
                scenario: scenario.name,
                expectedFinishReason: scenario.expectedFinishReason,
                actualFinishReason: lastFinishReason || 'unknown',
                finishReasonMatches: lastFinishReason === scenario.expectedFinishReason,
                isValidFinishReason: lastFinishReason && lastFinishReason !== 'unknown',
                processingTime,
                chunkCount,
                hasContent,
                success: true,
                timestamp: new Date().toISOString()
              });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Check for content
              if (parsed.choices?.[0]?.delta?.content) {
                hasContent = true;
              }
              
              // Check for finish reason
              if (parsed.choices?.[0]?.finish_reason) {
                lastFinishReason = parsed.choices[0].finish_reason;
              }
              
              // Check for Anthropic-style events
              if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
                lastFinishReason = parsed.delta.stop_reason;
              }
              
            } catch (parseError) {
              // Ignore parse errors for non-JSON chunks
            }
          }
        }
      });
      
      response.data.on('end', () => {
        if (!lastFinishReason) {
          const testEnd = performance.now();
          const processingTime = testEnd - testStart;
          
          resolve({
            scenario: scenario.name,
            expectedFinishReason: scenario.expectedFinishReason,
            actualFinishReason: 'stream_ended_without_finish_reason',
            finishReasonMatches: false,
            isValidFinishReason: false,
            processingTime,
            chunkCount,
            hasContent,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      response.data.on('error', (error) => {
        reject(error);
      });
      
    }).catch(error => {
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      reject(new Error('Streaming test timed out'));
    }, TEST_CONFIG.testTimeout);
  });
}

/**
 * 分析finish reason覆盖率结果
 */
function analyzeFinishReasonCoverage(results, streamingResults = []) {
  const allResults = [...results, ...streamingResults];
  
  const analysis = {
    totalTests: allResults.length,
    successfulTests: allResults.filter(r => r.success).length,
    failedTests: allResults.filter(r => !r.success).length,
    
    finishReasonAnalysis: {
      validFinishReasons: allResults.filter(r => r.isValidFinishReason).length,
      invalidFinishReasons: allResults.filter(r => !r.isValidFinishReason).length,
      unknownFinishReasons: allResults.filter(r => r.actualFinishReason === 'unknown').length,
      errorFinishReasons: allResults.filter(r => r.actualFinishReason === 'error').length,
      
      finishReasonDistribution: {},
      expectedVsActual: {}
    },
    
    scenarioAnalysis: {},
    
    coverageScore: 0,
    issues: []
  };
  
  // Analyze finish reason distribution
  allResults.forEach(result => {
    const actual = result.actualFinishReason;
    analysis.finishReasonAnalysis.finishReasonDistribution[actual] = 
      (analysis.finishReasonAnalysis.finishReasonDistribution[actual] || 0) + 1;
    
    const expected = result.expectedFinishReason;
    const key = `${expected} -> ${actual}`;
    analysis.finishReasonAnalysis.expectedVsActual[key] = 
      (analysis.finishReasonAnalysis.expectedVsActual[key] || 0) + 1;
  });
  
  // Analyze by scenario
  const scenarioGroups = {};
  allResults.forEach(result => {
    if (!scenarioGroups[result.scenario]) {
      scenarioGroups[result.scenario] = [];
    }
    scenarioGroups[result.scenario].push(result);
  });
  
  for (const [scenario, scenarioResults] of Object.entries(scenarioGroups)) {
    const successful = scenarioResults.filter(r => r.success).length;
    const validFinishReasons = scenarioResults.filter(r => r.isValidFinishReason).length;
    const matchingFinishReasons = scenarioResults.filter(r => r.finishReasonMatches).length;
    
    analysis.scenarioAnalysis[scenario] = {
      totalTests: scenarioResults.length,
      successRate: Math.round((successful / scenarioResults.length) * 100),
      validFinishReasonRate: Math.round((validFinishReasons / scenarioResults.length) * 100),
      finishReasonMatchRate: Math.round((matchingFinishReasons / scenarioResults.length) * 100)
    };
  }
  
  // Calculate overall coverage score
  const validRate = analysis.finishReasonAnalysis.validFinishReasons / analysis.totalTests;
  const successRate = analysis.successfulTests / analysis.totalTests;
  analysis.coverageScore = Math.round((validRate * 0.7 + successRate * 0.3) * 100);
  
  // Identify issues
  if (analysis.finishReasonAnalysis.unknownFinishReasons > 0) {
    analysis.issues.push(`${analysis.finishReasonAnalysis.unknownFinishReasons} tests returned 'unknown' finish reason`);
  }
  
  if (analysis.finishReasonAnalysis.errorFinishReasons > 0) {
    analysis.issues.push(`${analysis.finishReasonAnalysis.errorFinishReasons} tests failed with errors`);
  }
  
  if (analysis.coverageScore < 80) {
    analysis.issues.push(`Low coverage score: ${analysis.coverageScore}% (target: 80%+)`);
  }
  
  const expectedFinishReasons = ['stop', 'length', 'tool_use'];
  const actualFinishReasons = Object.keys(analysis.finishReasonAnalysis.finishReasonDistribution);
  const missingFinishReasons = expectedFinishReasons.filter(fr => !actualFinishReasons.includes(fr));
  
  if (missingFinishReasons.length > 0) {
    analysis.issues.push(`Missing finish reasons: ${missingFinishReasons.join(', ')}`);
  }
  
  return analysis;
}

/**
 * 主测试执行函数
 */
async function main() {
  console.log('🧪 OpenAI Finish Reason Coverage Analysis');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`Model: ${TEST_CONFIG.model}`);
  console.log(`Max Tokens Limit: ${TEST_CONFIG.maxTokensLimit}`);
  console.log(`Log Directory: ${TEST_CONFIG.logDir}`);
  
  try {
    // Test 1: Non-streaming finish reasons
    console.log('\n📋 Test 1: Non-Streaming Finish Reason Coverage');
    console.log('-' .repeat(50));
    
    const scenarios = defineFinishReasonScenarios();
    const results = [];
    
    for (const scenario of scenarios) {
      const result = await executeFinishReasonScenario(scenario);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 2: Streaming finish reasons
    console.log('\n📋 Test 2: Streaming Finish Reason Coverage');
    console.log('-' .repeat(50));
    
    const streamingResults = await testStreamingFinishReasons();
    
    // Analyze results
    console.log('\n📋 Test 3: Coverage Analysis');
    console.log('-' .repeat(50));
    
    const analysis = analyzeFinishReasonCoverage(results, streamingResults);
    
    // Save detailed results
    const reportPath = path.join(TEST_CONFIG.logDir, `finish-reason-coverage-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      testSuite: 'OpenAI Finish Reason Coverage Analysis',
      timestamp: new Date().toISOString(),
      testConfiguration: TEST_CONFIG,
      nonStreamingResults: results,
      streamingResults,
      analysis
    }, null, 2));
    
    // Output results
    console.log('\n🎯 Finish Reason Coverage Results');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${analysis.totalTests}`);
    console.log(`Successful Tests: ${analysis.successfulTests}/${analysis.totalTests}`);
    console.log(`Valid Finish Reasons: ${analysis.finishReasonAnalysis.validFinishReasons}/${analysis.totalTests}`);
    console.log(`Coverage Score: ${analysis.coverageScore}%`);
    
    console.log('\n📊 Finish Reason Distribution:');
    for (const [reason, count] of Object.entries(analysis.finishReasonAnalysis.finishReasonDistribution)) {
      console.log(`   ${reason}: ${count}`);
    }
    
    console.log('\n📋 Expected vs Actual:');
    for (const [mapping, count] of Object.entries(analysis.finishReasonAnalysis.expectedVsActual)) {
      console.log(`   ${mapping}: ${count}`);
    }
    
    if (analysis.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      analysis.issues.forEach(issue => console.log(`   • ${issue}`));
    } else {
      console.log('\n✅ No issues found - all finish reasons are properly handled');
    }
    
    console.log(`\n📄 Detailed Report: ${reportPath}`);
    
    // Set exit code based on results
    if (analysis.coverageScore >= 80 && analysis.issues.length === 0) {
      console.log('\n✅ Finish reason coverage test passed');
      process.exit(0);
    } else {
      console.log('\n❌ Finish reason coverage test failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    
    // Save error information
    const errorPath = path.join(TEST_CONFIG.logDir, `test-error-${Date.now()}.json`);
    fs.writeFileSync(errorPath, JSON.stringify({
      error: error.message,
      stack: error.stack,
      testConfig: TEST_CONFIG,
      timestamp: new Date().toISOString()
    }, null, 2));
    
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
  defineFinishReasonScenarios,
  executeFinishReasonScenario,
  testStreamingFinishReasons,
  analyzeFinishReasonCoverage,
  TEST_CONFIG
};