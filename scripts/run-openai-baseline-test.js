#!/usr/bin/env node

/**
 * Quick OpenAI Baseline Test Runner
 * 
 * 快速执行OpenAI基准测试以了解当前并发表现：
 * 1. 检查服务器连通性
 * 2. 运行精确并发竞态测试
 * 3. 生成基准报告
 */

const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration - 零硬编码原则
const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5508',
  logDir: process.env.TEST_LOG_DIR || '/tmp/openai-baseline-test',
  testScript: path.join(__dirname, '../tests/openai/test-precise-concurrency-race-conditions.js'),
  healthCheckTimeout: 10000,
  testTimeout: 120000
};

// Ensure log directory exists
if (!fs.existsSync(CONFIG.logDir)) {
  fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

/**
 * 检查服务器健康状态
 */
async function checkServerHealth() {
  console.log('🏥 Checking server health...');
  console.log(`   URL: ${CONFIG.baseUrl}`);
  
  try {
    const response = await axios.get(`${CONFIG.baseUrl}/health`, {
      timeout: CONFIG.healthCheckTimeout
    });
    
    console.log(`   ✅ Server is healthy (status: ${response.status})`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Server health check failed: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   💡 Suggestion: Make sure the server is running on the specified port');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   💡 Suggestion: Server may be overloaded or network issues');
    }
    
    return false;
  }
}

/**
 * 运行基准测试
 */
async function runBaselineTest() {
  console.log('🧪 Running OpenAI baseline concurrency test...');
  console.log(`   Test Script: ${CONFIG.testScript}`);
  
  return new Promise((resolve, reject) => {
    // Check if test script exists
    if (!fs.existsSync(CONFIG.testScript)) {
      reject(new Error(`Test script not found: ${CONFIG.testScript}`));
      return;
    }
    
    const testProcess = spawn('node', [CONFIG.testScript], {
      env: {
        ...process.env,
        TEST_BASE_URL: CONFIG.baseUrl,
        TEST_LOG_DIR: CONFIG.logDir,
        TEST_ITERATIONS: '1', // Single iteration for baseline
        MAX_CONCURRENT_REQUESTS: '3', // Smaller number for baseline
        TEST_TIMEOUT: CONFIG.testTimeout.toString()
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    testProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });
    
    testProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
    });
    
    testProcess.on('close', (code) => {
      console.log(`   Test completed with exit code: ${code}`);
      
      resolve({
        exitCode: code,
        success: code === 0,
        stdout,
        stderr,
        timestamp: new Date().toISOString()
      });
    });
    
    testProcess.on('error', (error) => {
      console.error(`   ❌ Test process failed: ${error.message}`);
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      testProcess.kill('SIGTERM');
      reject(new Error('Baseline test timed out'));
    }, CONFIG.testTimeout);
  });
}

/**
 * 解析测试结果
 */
function parseBaselineResults(testOutput) {
  const results = {
    scenarios: {
      total: 0,
      passed: 0,
      failed: 0
    },
    metrics: {
      raceConditionsDetected: 0,
      averageConcurrencyRatio: 0,
      averageSequenceAccuracy: 0,
      averageFinishReasonCoverage: 0
    },
    issues: [],
    rawOutput: testOutput.stdout
  };
  
  try {
    // Extract scenario counts
    const scenarioMatches = testOutput.stdout.match(/🧪 Executing: (.+)/g) || [];
    results.scenarios.total = scenarioMatches.length;
    
    const passedMatches = testOutput.stdout.match(/✅ Scenario completed/g) || [];
    results.scenarios.passed = passedMatches.length;
    results.scenarios.failed = results.scenarios.total - results.scenarios.passed;
    
    // Extract race conditions
    const raceConditionMatches = testOutput.stdout.match(/Race Condition Detected: ⚠️  YES/g) || [];
    results.metrics.raceConditionsDetected = raceConditionMatches.length;
    
    // Extract metrics
    const concurrencyMatches = testOutput.stdout.match(/Concurrency Ratio: (\d+)%/g) || [];
    const concurrencyRatios = concurrencyMatches.map(match => parseInt(match.match(/(\d+)%/)[1]));
    results.metrics.averageConcurrencyRatio = concurrencyRatios.length > 0 
      ? Math.round(concurrencyRatios.reduce((sum, r) => sum + r, 0) / concurrencyRatios.length)
      : 0;
    
    const sequenceMatches = testOutput.stdout.match(/Sequence Accuracy: (\d+)%/g) || [];
    const sequenceAccuracies = sequenceMatches.map(match => parseInt(match.match(/(\d+)%/)[1]));
    results.metrics.averageSequenceAccuracy = sequenceAccuracies.length > 0
      ? Math.round(sequenceAccuracies.reduce((sum, a) => sum + a, 0) / sequenceAccuracies.length)
      : 0;
    
    const finishReasonMatches = testOutput.stdout.match(/Finish Reason Coverage: (\d+)%/g) || [];
    const finishReasonCoverages = finishReasonMatches.map(match => parseInt(match.match(/(\d+)%/)[1]));
    results.metrics.averageFinishReasonCoverage = finishReasonCoverages.length > 0
      ? Math.round(finishReasonCoverages.reduce((sum, c) => sum + c, 0) / finishReasonCoverages.length)
      : 0;
    
    // Extract issues
    const issuePatterns = [
      /❌.*race condition/gi,
      /Low.*accuracy/gi,
      /Low.*coverage/gi,
      /⚠️.*YES/gi
    ];
    
    issuePatterns.forEach(pattern => {
      const matches = testOutput.stdout.match(pattern) || [];
      results.issues.push(...matches);
    });
    
  } catch (parseError) {
    console.warn(`⚠️  Failed to parse test results: ${parseError.message}`);
  }
  
  return results;
}

/**
 * 生成基准报告
 */
function generateBaselineReport(healthCheck, testResult, parsedResults) {
  const report = {
    testSuite: 'OpenAI Baseline Concurrency Test',
    timestamp: new Date().toISOString(),
    configuration: CONFIG,
    
    serverHealth: {
      isHealthy: healthCheck,
      baseUrl: CONFIG.baseUrl
    },
    
    testExecution: {
      success: testResult.success,
      exitCode: testResult.exitCode,
      duration: 'N/A' // Would need to track this
    },
    
    baselineMetrics: parsedResults.metrics,
    scenarioResults: parsedResults.scenarios,
    detectedIssues: parsedResults.issues,
    
    assessment: {
      overallStatus: 'unknown',
      criticalIssues: [],
      recommendations: []
    }
  };
  
  // Generate assessment
  if (!healthCheck) {
    report.assessment.overallStatus = 'server_unavailable';
    report.assessment.criticalIssues.push('Server is not responding to health checks');
    report.assessment.recommendations.push('🚨 CRITICAL: Start the server before running tests');
  } else if (!testResult.success) {
    report.assessment.overallStatus = 'test_failed';
    report.assessment.criticalIssues.push(`Test failed with exit code ${testResult.exitCode}`);
    report.assessment.recommendations.push('🔧 HIGH: Review test logs for failure details');
  } else {
    // Analyze baseline metrics
    const metrics = parsedResults.metrics;
    
    if (metrics.raceConditionsDetected > 0) {
      report.assessment.criticalIssues.push(`${metrics.raceConditionsDetected} race conditions detected`);
      report.assessment.recommendations.push('🚨 URGENT: Implement conversation queue manager to fix race conditions');
    }
    
    if (metrics.averageSequenceAccuracy < 80) {
      report.assessment.criticalIssues.push(`Low sequence accuracy: ${metrics.averageSequenceAccuracy}%`);
      report.assessment.recommendations.push('🔧 HIGH: Review requestId generation logic');
    }
    
    if (metrics.averageFinishReasonCoverage < 90) {
      report.assessment.criticalIssues.push(`Low finish reason coverage: ${metrics.averageFinishReasonCoverage}%`);
      report.assessment.recommendations.push('⚠️  MEDIUM: Check for silent failures in finish reason handling');
    }
    
    // Overall status
    if (report.assessment.criticalIssues.length === 0) {
      report.assessment.overallStatus = 'good';
      report.assessment.recommendations.push('✅ GOOD: Baseline metrics look healthy');
    } else if (metrics.raceConditionsDetected === 0) {
      report.assessment.overallStatus = 'needs_improvement';
      report.assessment.recommendations.push('📊 MODERATE: Some issues detected but no race conditions');
    } else {
      report.assessment.overallStatus = 'critical';
      report.assessment.recommendations.push('🚨 CRITICAL: Race conditions detected, immediate action required');
    }
  }
  
  return report;
}

/**
 * 主执行函数
 */
async function main() {
  console.log('🧪 OpenAI Baseline Concurrency Test Runner');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Log Directory: ${CONFIG.logDir}`);
  
  let healthCheck = false;
  let testResult = null;
  let parsedResults = null;
  
  try {
    // Step 1: Health check
    console.log('\n📋 Step 1: Server Health Check');
    console.log('-' .repeat(40));
    healthCheck = await checkServerHealth();
    
    if (!healthCheck) {
      console.log('\n❌ Cannot proceed with tests - server is not healthy');
      process.exit(1);
    }
    
    // Step 2: Run baseline test
    console.log('\n📋 Step 2: Baseline Concurrency Test');
    console.log('-' .repeat(40));
    testResult = await runBaselineTest();
    
    // Step 3: Parse results
    console.log('\n📋 Step 3: Analyzing Results');
    console.log('-' .repeat(40));
    parsedResults = parseBaselineResults(testResult);
    
    // Step 4: Generate report
    const report = generateBaselineReport(healthCheck, testResult, parsedResults);
    
    // Save report
    const reportPath = path.join(CONFIG.logDir, `baseline-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Output summary
    console.log('\n🎯 Baseline Test Summary');
    console.log('=' .repeat(60));
    console.log(`Overall Status: ${report.assessment.overallStatus.toUpperCase()}`);
    console.log(`Server Health: ${healthCheck ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`Test Success: ${testResult.success ? '✅ Passed' : '❌ Failed'}`);
    
    console.log('\n📊 Baseline Metrics:');
    console.log(`   Race Conditions Detected: ${parsedResults.metrics.raceConditionsDetected}`);
    console.log(`   Average Concurrency Ratio: ${parsedResults.metrics.averageConcurrencyRatio}%`);
    console.log(`   Average Sequence Accuracy: ${parsedResults.metrics.averageSequenceAccuracy}%`);
    console.log(`   Average Finish Reason Coverage: ${parsedResults.metrics.averageFinishReasonCoverage}%`);
    
    console.log('\n📋 Scenario Results:');
    console.log(`   Total Scenarios: ${parsedResults.scenarios.total}`);
    console.log(`   Passed: ${parsedResults.scenarios.passed}`);
    console.log(`   Failed: ${parsedResults.scenarios.failed}`);
    
    if (report.assessment.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.assessment.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
    }
    
    console.log('\n💡 Recommendations:');
    report.assessment.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log(`\n📄 Detailed Report: ${reportPath}`);
    
    // Set exit code
    if (report.assessment.overallStatus === 'critical' || !testResult.success) {
      console.log('\n❌ Baseline test completed with critical issues');
      process.exit(1);
    } else {
      console.log('\n✅ Baseline test completed successfully');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Baseline test failed:', error.message);
    console.error(error.stack);
    
    // Save error report
    const errorPath = path.join(CONFIG.logDir, `baseline-error-${Date.now()}.json`);
    fs.writeFileSync(errorPath, JSON.stringify({
      error: error.message,
      stack: error.stack,
      healthCheck,
      testResult,
      parsedResults,
      config: CONFIG,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`📄 Error Report: ${errorPath}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  checkServerHealth,
  runBaselineTest,
  parseBaselineResults,
  generateBaselineReport,
  CONFIG
};