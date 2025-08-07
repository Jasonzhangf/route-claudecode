#!/usr/bin/env node

/**
 * Test: Precise OpenAI Concurrency Race Condition Analysis
 * 
 * 精确测试不同会话请求的竞态表现：
 * 1. 不同会话请求 - 应该并发处理
 * 2. 同一会话同conversationID - 必须顺序处理
 * 3. 同一会话不同conversationID - 可以并发处理
 * 4. 请求有明确的sequence标号，响应有对应的顺序标号
 * 5. 测试修改前后的竞态表现对比
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration - 零硬编码原则
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5508',
  logDir: process.env.TEST_LOG_DIR || '/tmp/openai-precise-concurrency-test',
  testTimeout: parseInt(process.env.TEST_TIMEOUT || '90000'), // 90 seconds
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5'),
  testIterations: parseInt(process.env.TEST_ITERATIONS || '3'),
  requestDelay: parseInt(process.env.REQUEST_DELAY || '100'), // ms between requests
  model: process.env.TEST_MODEL || 'gpt-4o-mini'
};

// Ensure log directory exists
if (!fs.existsSync(TEST_CONFIG.logDir)) {
  fs.mkdirSync(TEST_CONFIG.logDir, { recursive: true });
}

/**
 * 生成测试场景配置
 */
function generateTestScenarios() {
  const timestamp = Date.now();
  
  return {
    // 场景1: 不同会话请求 - 应该并发处理
    differentSessions: {
      name: 'Different Sessions (Should be Concurrent)',
      expectedBehavior: 'concurrent',
      requests: Array.from({ length: TEST_CONFIG.maxConcurrentRequests }, (_, i) => ({
        sessionId: `session-${timestamp}-${i}`,
        conversationId: `conv-${timestamp}-${i}`,
        requestIndex: i,
        expectedSequence: i + 1
      }))
    },
    
    // 场景2: 同一会话同conversationID - 必须顺序处理
    sameSessionSameConversation: {
      name: 'Same Session Same Conversation (Must be Sequential)',
      expectedBehavior: 'sequential',
      requests: Array.from({ length: TEST_CONFIG.maxConcurrentRequests }, (_, i) => ({
        sessionId: `session-${timestamp}-shared`,
        conversationId: `conv-${timestamp}-shared`,
        requestIndex: i,
        expectedSequence: i + 1
      }))
    },
    
    // 场景3: 同一会话不同conversationID - 可以并发处理
    sameSessionDifferentConversations: {
      name: 'Same Session Different Conversations (Can be Concurrent)',
      expectedBehavior: 'concurrent',
      requests: Array.from({ length: TEST_CONFIG.maxConcurrentRequests }, (_, i) => ({
        sessionId: `session-${timestamp}-shared`,
        conversationId: `conv-${timestamp}-${i}`,
        requestIndex: i,
        expectedSequence: i + 1
      }))
    },
    
    // 场景4: 混合场景 - 部分顺序部分并发
    mixedScenario: {
      name: 'Mixed Scenario (Partial Sequential, Partial Concurrent)',
      expectedBehavior: 'mixed',
      requests: [
        // 两个请求使用相同的session+conversation (应该顺序)
        {
          sessionId: `session-${timestamp}-mixed`,
          conversationId: `conv-${timestamp}-sequential`,
          requestIndex: 0,
          expectedSequence: 1,
          group: 'sequential-group-1'
        },
        {
          sessionId: `session-${timestamp}-mixed`,
          conversationId: `conv-${timestamp}-sequential`,
          requestIndex: 1,
          expectedSequence: 2,
          group: 'sequential-group-1'
        },
        // 其他请求使用不同的session (应该并发)
        {
          sessionId: `session-${timestamp}-concurrent-1`,
          conversationId: `conv-${timestamp}-concurrent-1`,
          requestIndex: 2,
          expectedSequence: 1,
          group: 'concurrent-group'
        },
        {
          sessionId: `session-${timestamp}-concurrent-2`,
          conversationId: `conv-${timestamp}-concurrent-2`,
          requestIndex: 3,
          expectedSequence: 1,
          group: 'concurrent-group'
        }
      ]
    }
  };
}

/**
 * 发送带有精确时间戳和序列号的测试请求
 */
async function sendPreciseTestRequest(requestConfig, scenarioName) {
  const requestStart = performance.now();
  const requestTimestamp = Date.now();
  
  const requestData = {
    model: TEST_CONFIG.model,
    messages: [
      {
        role: 'user',
        content: `Test request for ${scenarioName} - Index: ${requestConfig.requestIndex}, Expected Sequence: ${requestConfig.expectedSequence}, Timestamp: ${requestTimestamp}`
      }
    ],
    max_tokens: 150,
    temperature: 0.1,
    // 添加测试元数据
    metadata: {
      testScenario: scenarioName,
      requestIndex: requestConfig.requestIndex,
      expectedSequence: requestConfig.expectedSequence,
      group: requestConfig.group || 'default'
    }
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': requestConfig.sessionId,
    'x-conversation-id': requestConfig.conversationId,
    'x-request-index': requestConfig.requestIndex.toString(),
    'x-expected-sequence': requestConfig.expectedSequence.toString(),
    'x-test-scenario': scenarioName,
    'x-request-timestamp': requestTimestamp.toString()
  };
  
  try {
    console.log(`📤 [${scenarioName}] Sending request ${requestConfig.requestIndex + 1} (seq: ${requestConfig.expectedSequence})`);
    
    const response = await axios.post(
      `${TEST_CONFIG.baseUrl}/v1/messages`,
      requestData,
      { 
        headers,
        timeout: TEST_CONFIG.testTimeout
      }
    );
    
    const requestEnd = performance.now();
    const processingTime = requestEnd - requestStart;
    
    // 提取响应中的序列信息
    const responseRequestId = response.headers['x-request-id'] || response.data.id || 'unknown';
    const responseSequence = extractSequenceFromRequestId(responseRequestId);
    const finishReason = response.data.stop_reason || response.data.choices?.[0]?.finish_reason || 'unknown';
    
    console.log(`✅ [${scenarioName}] Request ${requestConfig.requestIndex + 1} completed in ${processingTime.toFixed(2)}ms`);
    console.log(`   Response ID: ${responseRequestId}`);
    console.log(`   Extracted Sequence: ${responseSequence}`);
    console.log(`   Finish Reason: ${finishReason}`);
    
    return {
      scenario: scenarioName,
      requestConfig,
      requestStart,
      requestEnd,
      processingTime,
      requestTimestamp,
      response: {
        id: responseRequestId,
        extractedSequence: responseSequence,
        finishReason,
        status: response.status,
        headers: response.headers,
        content: response.data.content || response.data.choices?.[0]?.message?.content || 'No content'
      },
      success: true
    };
    
  } catch (error) {
    const requestEnd = performance.now();
    const processingTime = requestEnd - requestStart;
    
    console.error(`❌ [${scenarioName}] Request ${requestConfig.requestIndex + 1} failed after ${processingTime.toFixed(2)}ms:`, error.message);
    
    return {
      scenario: scenarioName,
      requestConfig,
      requestStart,
      requestEnd,
      processingTime,
      requestTimestamp,
      error: {
        message: error.message,
        status: error.response?.status || 'network_error',
        code: error.code || 'unknown'
      },
      success: false
    };
  }
}

/**
 * 从requestId中提取序列号
 */
function extractSequenceFromRequestId(requestId) {
  if (!requestId || typeof requestId !== 'string') {
    return null;
  }
  
  // 尝试匹配不同的序列号格式
  const patterns = [
    /seq(\d+)/i,           // seq0001 格式
    /:(\d+):/,             // :1: 格式
    /sequence[_-]?(\d+)/i, // sequence_1 或 sequence-1 格式
    /_(\d+)_/,             // _1_ 格式
    /(\d+)$/               // 结尾数字
  ];
  
  for (const pattern of patterns) {
    const match = requestId.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

/**
 * 分析并发竞态结果
 */
function analyzeConcurrencyRaceResults(results, scenario) {
  const analysis = {
    scenarioName: scenario.name,
    expectedBehavior: scenario.expectedBehavior,
    totalRequests: results.length,
    successfulRequests: results.filter(r => r.success).length,
    failedRequests: results.filter(r => !r.success).length,
    concurrencyAnalysis: {},
    sequenceAnalysis: {},
    finishReasonAnalysis: {},
    raceConditionDetected: false,
    issues: []
  };
  
  // 按成功的请求进行分析
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    analysis.issues.push('No successful requests to analyze');
    return analysis;
  }
  
  // 1. 并发性分析 - 检查请求是否按预期并发或顺序执行
  const sortedByStart = successfulResults.sort((a, b) => a.requestStart - b.requestStart);
  const sortedByEnd = successfulResults.sort((a, b) => a.requestEnd - b.requestEnd);
  
  // 计算重叠时间
  let overlappingRequests = 0;
  for (let i = 0; i < sortedByStart.length - 1; i++) {
    const current = sortedByStart[i];
    const next = sortedByStart[i + 1];
    
    if (next.requestStart < current.requestEnd) {
      overlappingRequests++;
    }
  }
  
  const concurrencyRatio = overlappingRequests / Math.max(1, successfulResults.length - 1);
  analysis.concurrencyAnalysis = {
    overlappingRequests,
    totalPairs: successfulResults.length - 1,
    concurrencyRatio: Math.round(concurrencyRatio * 100),
    actualBehavior: concurrencyRatio > 0.5 ? 'concurrent' : 'sequential',
    expectedBehavior: scenario.expectedBehavior,
    behaviorMatches: (concurrencyRatio > 0.5) === (scenario.expectedBehavior === 'concurrent' || scenario.expectedBehavior === 'mixed')
  };
  
  // 2. 序列号分析 - 检查requestId中的序列号是否正确
  const sequenceResults = successfulResults.map(r => ({
    requestIndex: r.requestConfig.requestIndex,
    expectedSequence: r.requestConfig.expectedSequence,
    extractedSequence: r.response.extractedSequence,
    sequenceMatches: r.response.extractedSequence === r.requestConfig.expectedSequence
  }));
  
  const correctSequences = sequenceResults.filter(s => s.sequenceMatches).length;
  analysis.sequenceAnalysis = {
    totalWithSequence: sequenceResults.filter(s => s.extractedSequence !== null).length,
    correctSequences,
    sequenceAccuracy: Math.round((correctSequences / successfulResults.length) * 100),
    sequenceDetails: sequenceResults
  };
  
  // 3. Finish Reason分析 - 确保所有请求都有正确的finish reason
  const finishReasons = successfulResults.map(r => r.response.finishReason);
  const validFinishReasons = finishReasons.filter(fr => fr && fr !== 'unknown' && fr !== 'null').length;
  
  analysis.finishReasonAnalysis = {
    totalResponses: successfulResults.length,
    validFinishReasons,
    finishReasonCoverage: Math.round((validFinishReasons / successfulResults.length) * 100),
    finishReasonDistribution: finishReasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {})
  };
  
  // 4. 竞态条件检测
  if (scenario.expectedBehavior === 'sequential') {
    // 对于应该顺序执行的场景，检查是否有重叠
    if (concurrencyRatio > 0.1) { // 允许10%的时间误差
      analysis.raceConditionDetected = true;
      analysis.issues.push(`Sequential scenario showed ${Math.round(concurrencyRatio * 100)}% concurrency - possible race condition`);
    }
  } else if (scenario.expectedBehavior === 'concurrent') {
    // 对于应该并发执行的场景，检查是否过于顺序
    if (concurrencyRatio < 0.3) { // 期望至少30%的并发
      analysis.raceConditionDetected = true;
      analysis.issues.push(`Concurrent scenario showed only ${Math.round(concurrencyRatio * 100)}% concurrency - possible blocking issue`);
    }
  }
  
  // 5. 序列号问题检测
  if (analysis.sequenceAnalysis.sequenceAccuracy < 80) {
    analysis.issues.push(`Low sequence accuracy: ${analysis.sequenceAnalysis.sequenceAccuracy}% - requestId generation may be incorrect`);
  }
  
  // 6. Finish Reason问题检测
  if (analysis.finishReasonAnalysis.finishReasonCoverage < 90) {
    analysis.issues.push(`Low finish reason coverage: ${analysis.finishReasonAnalysis.finishReasonCoverage}% - possible silent failures`);
  }
  
  return analysis;
}

/**
 * 执行单个测试场景
 */
async function executeTestScenario(scenario) {
  console.log(`\n🧪 Executing: ${scenario.name}`);
  console.log(`   Expected Behavior: ${scenario.expectedBehavior}`);
  console.log(`   Request Count: ${scenario.requests.length}`);
  
  const startTime = performance.now();
  
  // 创建所有请求的Promise，但添加小延迟以模拟真实情况
  const requestPromises = scenario.requests.map((requestConfig, index) => {
    return new Promise(resolve => {
      setTimeout(async () => {
        const result = await sendPreciseTestRequest(requestConfig, scenario.name);
        resolve(result);
      }, index * TEST_CONFIG.requestDelay);
    });
  });
  
  try {
    // 并发发送所有请求
    const results = await Promise.all(requestPromises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // 分析结果
    const analysis = analyzeConcurrencyRaceResults(results, scenario);
    
    console.log(`✅ Scenario completed in ${totalTime.toFixed(2)}ms`);
    console.log(`   Success Rate: ${analysis.successfulRequests}/${analysis.totalRequests}`);
    console.log(`   Concurrency Ratio: ${analysis.concurrencyAnalysis.concurrencyRatio}%`);
    console.log(`   Sequence Accuracy: ${analysis.sequenceAnalysis.sequenceAccuracy}%`);
    console.log(`   Finish Reason Coverage: ${analysis.finishReasonAnalysis.finishReasonCoverage}%`);
    console.log(`   Race Condition Detected: ${analysis.raceConditionDetected ? '⚠️  YES' : '✅ NO'}`);
    
    if (analysis.issues.length > 0) {
      console.log(`   Issues Found:`);
      analysis.issues.forEach(issue => console.log(`     - ${issue}`));
    }
    
    return {
      scenario: scenario.name,
      results,
      analysis,
      totalTime,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Scenario failed: ${error.message}`);
    return {
      scenario: scenario.name,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 生成详细的测试报告
 */
function generateDetailedReport(testResults, testConfig) {
  const report = {
    testSuite: 'Precise OpenAI Concurrency Race Condition Analysis',
    timestamp: new Date().toISOString(),
    testConfiguration: testConfig,
    summary: {
      totalScenarios: testResults.length,
      successfulScenarios: testResults.filter(r => !r.error).length,
      failedScenarios: testResults.filter(r => r.error).length,
      raceConditionsDetected: testResults.filter(r => r.analysis?.raceConditionDetected).length
    },
    scenarios: testResults,
    recommendations: []
  };
  
  // 生成建议
  const successfulResults = testResults.filter(r => !r.error);
  
  if (successfulResults.length === 0) {
    report.recommendations.push('CRITICAL: All test scenarios failed. Check server connectivity and configuration.');
    return report;
  }
  
  // 分析整体模式
  const avgConcurrencyRatio = successfulResults.reduce((sum, r) => 
    sum + (r.analysis?.concurrencyAnalysis?.concurrencyRatio || 0), 0) / successfulResults.length;
  
  const avgSequenceAccuracy = successfulResults.reduce((sum, r) => 
    sum + (r.analysis?.sequenceAnalysis?.sequenceAccuracy || 0), 0) / successfulResults.length;
  
  const avgFinishReasonCoverage = successfulResults.reduce((sum, r) => 
    sum + (r.analysis?.finishReasonAnalysis?.finishReasonCoverage || 0), 0) / successfulResults.length;
  
  // 生成具体建议
  if (report.summary.raceConditionsDetected > 0) {
    report.recommendations.push(`URGENT: ${report.summary.raceConditionsDetected} race conditions detected. Implement conversation queue manager.`);
  }
  
  if (avgSequenceAccuracy < 80) {
    report.recommendations.push(`MEDIUM: Low average sequence accuracy (${avgSequenceAccuracy.toFixed(1)}%). Review requestId generation logic.`);
  }
  
  if (avgFinishReasonCoverage < 90) {
    report.recommendations.push(`HIGH: Low finish reason coverage (${avgFinishReasonCoverage.toFixed(1)}%). Check for silent failures.`);
  }
  
  if (avgConcurrencyRatio < 30) {
    report.recommendations.push(`INFO: Low overall concurrency (${avgConcurrencyRatio.toFixed(1)}%). System may be over-serialized.`);
  }
  
  if (report.recommendations.length === 0) {
    report.recommendations.push('GOOD: No major issues detected. System appears to handle concurrency correctly.');
  }
  
  return report;
}

/**
 * 主测试执行函数
 */
async function main() {
  console.log('🧪 Precise OpenAI Concurrency Race Condition Analysis');
  console.log('=' .repeat(70));
  console.log(`Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`Model: ${TEST_CONFIG.model}`);
  console.log(`Max Concurrent Requests: ${TEST_CONFIG.maxConcurrentRequests}`);
  console.log(`Test Iterations: ${TEST_CONFIG.testIterations}`);
  console.log(`Log Directory: ${TEST_CONFIG.logDir}`);
  
  const allTestResults = [];
  
  try {
    // 执行多次迭代以获得更可靠的结果
    for (let iteration = 1; iteration <= TEST_CONFIG.testIterations; iteration++) {
      console.log(`\n🔄 Test Iteration ${iteration}/${TEST_CONFIG.testIterations}`);
      console.log('-' .repeat(50));
      
      const scenarios = generateTestScenarios();
      const iterationResults = [];
      
      // 执行所有测试场景
      for (const [scenarioKey, scenario] of Object.entries(scenarios)) {
        const result = await executeTestScenario(scenario);
        iterationResults.push(result);
        
        // 在场景之间添加短暂延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      allTestResults.push({
        iteration,
        results: iterationResults,
        timestamp: new Date().toISOString()
      });
    }
    
    // 生成最终报告
    const flatResults = allTestResults.flatMap(iter => iter.results);
    const finalReport = generateDetailedReport(flatResults, TEST_CONFIG);
    
    // 保存详细报告
    const reportPath = path.join(TEST_CONFIG.logDir, `precise-concurrency-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    
    // 保存原始数据
    const rawDataPath = path.join(TEST_CONFIG.logDir, `raw-test-data-${Date.now()}.json`);
    fs.writeFileSync(rawDataPath, JSON.stringify(allTestResults, null, 2));
    
    // 输出最终结果
    console.log('\n🎯 Final Test Results');
    console.log('=' .repeat(70));
    console.log(`Total Scenarios Tested: ${finalReport.summary.totalScenarios}`);
    console.log(`Successful Scenarios: ${finalReport.summary.successfulScenarios}`);
    console.log(`Failed Scenarios: ${finalReport.summary.failedScenarios}`);
    console.log(`Race Conditions Detected: ${finalReport.summary.raceConditionsDetected}`);
    
    console.log('\n📋 Recommendations:');
    finalReport.recommendations.forEach(rec => console.log(`   • ${rec}`));
    
    console.log(`\n📄 Detailed Report: ${reportPath}`);
    console.log(`📄 Raw Data: ${rawDataPath}`);
    
    // 根据结果设置退出码
    if (finalReport.summary.raceConditionsDetected > 0 || finalReport.summary.failedScenarios > 0) {
      console.log('\n❌ Test suite completed with issues detected');
      process.exit(1);
    } else {
      console.log('\n✅ Test suite completed successfully');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed with unexpected error:', error.message);
    console.error(error.stack);
    
    // 保存错误信息
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

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  generateTestScenarios,
  sendPreciseTestRequest,
  analyzeConcurrencyRaceResults,
  executeTestScenario,
  generateDetailedReport,
  TEST_CONFIG
};