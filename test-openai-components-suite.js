#!/usr/bin/env node

/**
 * OpenAI Components Comprehensive Test Suite
 * 运行所有OpenAI相关组件的综合测试
 * Owner: Jason Zhang
 */

const path = require('path');
const { spawn } = require('child_process');

// 设置环境变量
process.env.RCC_PORT = '3456';

async function runTest(testScript, testName) {
  console.log(`\n🧪 [TEST-SUITE] Running ${testName}...`);
  console.log('='.repeat(60));
  
  return new Promise((resolve) => {
    const childProcess = spawn('node', [testScript], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    childProcess.on('close', (code) => {
      console.log('='.repeat(60));
      if (code === 0) {
        console.log(`✅ [SUCCESS] ${testName} completed successfully`);
        resolve(true);
      } else {
        console.log(`❌ [FAILED] ${testName} failed with code ${code}`);
        resolve(false);
      }
    });

    childProcess.on('error', (error) => {
      console.log(`💥 [ERROR] ${testName} failed to start: ${error.message}`);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('🚀 [TEST-SUITE] Starting OpenAI Components Comprehensive Test Suite');
  console.log(`📅 Test started at: ${new Date().toISOString()}`);
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: Date.now()
  };

  const tests = [
    {
      script: 'test-openai-transformer-comprehensive.js',
      name: 'OpenAI Transformer Test'
    },
    {
      script: 'test-openai-preprocess-comprehensive.js', 
      name: 'OpenAI Preprocess Test'
    }
  ];

  for (const test of tests) {
    testResults.total++;
    const success = await runTest(test.script, test.name);
    
    if (success) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
    
    // 短暂暂停避免进程冲突
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const endTime = Date.now();
  const totalTime = endTime - testResults.startTime;
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);

  console.log('\n📊 [FINAL RESULTS] OpenAI Components Test Suite Summary');
  console.log('='.repeat(60));
  console.log(`📅 Test completed at: ${new Date().toISOString()}`);
  console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`📋 Total test suites: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success rate: ${successRate}%`);

  const overallSuccess = testResults.failed === 0;
  console.log(`\n${overallSuccess ? '🎉' : '⚠️'} [OVERALL] Test suite ${overallSuccess ? 'PASSED' : 'FAILED'}`);
  
  if (overallSuccess) {
    console.log('🔥 All OpenAI components are working correctly!');
    console.log('✨ Ready for production use!');
  } else {
    console.log('🔧 Some tests failed. Please review and fix issues.');
  }

  return overallSuccess;
}

// 主测试执行
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test suite execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };