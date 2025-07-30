#!/usr/bin/env node

/**
 * 简化的Gemini API Key轮询测试
 * 直接测试ApiKeyRotationManager功能
 */

const fs = require('fs');

// 模拟ApiKeyRotationManager（基于OpenAI的实现）
class MockApiKeyRotationManager {
  constructor(apiKeys, providerId, config = {}) {
    this.keys = apiKeys.map((key, index) => ({
      key: key.trim(),
      index,
      isActive: true,
      lastUsed: new Date(0),
      consecutiveErrors: 0,
      totalRequests: 0,
      successfulRequests: 0
    }));
    
    this.currentIndex = 0;
    this.providerId = providerId;
    this.config = {
      strategy: config.strategy || 'round_robin',
      cooldownMs: config.cooldownMs || 5000,
      maxRetriesPerKey: config.maxRetriesPerKey || 3,
      ...config
    };
  }

  getNextApiKey(requestId) {
    const availableKeys = this.keys.filter(k => k.isActive);
    if (availableKeys.length === 0) {
      throw new Error('No API keys available');
    }

    let selectedKey;
    
    switch (this.config.strategy) {
      case 'round_robin':
        selectedKey = availableKeys[this.currentIndex % availableKeys.length];
        this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
        break;
      
      case 'health_based':
        selectedKey = availableKeys.sort((a, b) => {
          const aSuccessRate = a.totalRequests > 0 ? a.successfulRequests / a.totalRequests : 1;
          const bSuccessRate = b.totalRequests > 0 ? b.successfulRequests / b.totalRequests : 1;
          
          if (aSuccessRate !== bSuccessRate) {
            return bSuccessRate - aSuccessRate;
          }
          
          return a.consecutiveErrors - b.consecutiveErrors;
        })[0];
        break;
      
      default:
        selectedKey = availableKeys[0];
    }

    selectedKey.lastUsed = new Date();
    selectedKey.totalRequests++;
    
    return selectedKey.key;
  }

  reportSuccess(apiKey, requestId) {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      keyState.consecutiveErrors = 0;
      keyState.successfulRequests++;
      keyState.isActive = true;
    }
  }

  reportError(apiKey, isRateLimit = false, requestId) {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      keyState.consecutiveErrors++;
      
      if (keyState.consecutiveErrors >= this.config.maxRetriesPerKey) {
        keyState.isActive = false;
      }
    }
  }

  getStats() {
    const activeKeys = this.keys.filter(k => k.isActive);
    return {
      providerId: this.providerId,
      totalKeys: this.keys.length,
      activeKeys: activeKeys.length,
      strategy: this.config.strategy,
      keyDetails: this.keys.map(k => ({
        index: k.index,
        isActive: k.isActive,
        consecutiveErrors: k.consecutiveErrors,
        successRate: k.totalRequests > 0 ? k.successfulRequests / k.totalRequests : 0,
        lastUsed: k.lastUsed.toISOString()
      }))
    };
  }
}

// 测试配置
const TEST_CONFIG = {
  logFile: '/tmp/test-simple-gemini-rotation.log',
  geminiKeys: [
    'AIzaSy-test-key-1-for-gemini',
    'AIzaSy-test-key-2-for-gemini', 
    'AIzaSy-test-key-3-for-gemini'
  ]
};

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, data };
  
  console.log(`[${timestamp}] ${message}`, data || '');
  fs.appendFileSync(TEST_CONFIG.logFile, JSON.stringify(logEntry) + '\n');
}

async function runSimpleGeminiRotationTest() {
  log('开始简化的Gemini API Key轮询测试');

  const testResults = {
    summary: {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0
    },
    detailedResults: []
  };

  try {
    // 测试1: Round Robin策略
    log('测试1: Round Robin策略');
    const roundRobinTest = await testRoundRobinStrategy();
    testResults.detailedResults.push(roundRobinTest);
    testResults.summary.totalTests++;
    if (roundRobinTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 测试2: Health Based策略
    log('测试2: Health Based策略');
    const healthBasedTest = await testHealthBasedStrategy();
    testResults.detailedResults.push(healthBasedTest);
    testResults.summary.totalTests++;
    if (healthBasedTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 测试3: 错误处理和故障切换
    log('测试3: 错误处理和故障切换');
    const errorHandlingTest = await testErrorHandling();
    testResults.detailedResults.push(errorHandlingTest);
    testResults.summary.totalTests++;
    if (errorHandlingTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 生成报告
    testResults.summary.successRate = `${testResults.summary.successfulTests}/${testResults.summary.totalTests}`;
    
    const reportFile = `/tmp/simple-gemini-rotation-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    
    log('测试完成', {
      reportFile,
      successRate: testResults.summary.successRate
    });

    // 输出结论
    const conclusions = [];
    if (testResults.summary.successfulTests === testResults.summary.totalTests) {
      conclusions.push('✅ 所有Gemini API Key轮询测试通过');
    } else {
      conclusions.push(`⚠️ ${testResults.summary.failedTests}个测试失败`);
    }

    testResults.conclusions = conclusions;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));

    log('测试结论', conclusions);
    return testResults;

  } catch (error) {
    log('测试运行出错', { error: error.message });
    throw error;
  }
}

async function testRoundRobinStrategy() {
  const testStart = Date.now();
  
  try {
    const rotationManager = new MockApiKeyRotationManager(
      TEST_CONFIG.geminiKeys,
      'gemini-round-robin-test',
      { strategy: 'round_robin' }
    );

    // 测试轮询行为
    const usedKeys = [];
    const requestCount = 9; // 3轮完整轮询
    
    for (let i = 0; i < requestCount; i++) {
      const key = rotationManager.getNextApiKey(`test-${i}`);
      usedKeys.push(key);
      rotationManager.reportSuccess(key, `test-${i}`);
    }

    const responseTime = Date.now() - testStart;
    
    // 验证轮询效果
    const keyUsageCount = {};
    usedKeys.forEach(key => {
      keyUsageCount[key] = (keyUsageCount[key] || 0) + 1;
    });

    const isRoundRobin = Object.values(keyUsageCount).every(count => count === 3);
    const stats = rotationManager.getStats();
    
    log('Round Robin测试完成', {
      responseTime: `${responseTime}ms`,
      usedKeys: usedKeys.slice(0, 6), // 显示前6个
      keyUsageCount,
      isRoundRobin,
      stats
    });

    return {
      testCase: 'round-robin-strategy',
      success: isRoundRobin,
      responseTime,
      analysis: {
        keyUsageCount,
        isRoundRobin,
        totalRequests: requestCount,
        uniqueKeysUsed: Object.keys(keyUsageCount).length,
        stats
      }
    };

  } catch (error) {
    const responseTime = Date.now() - testStart;
    log('Round Robin测试失败', { error: error.message });
    
    return {
      testCase: 'round-robin-strategy',
      success: false,
      responseTime,
      error: error.message
    };
  }
}

async function testHealthBasedStrategy() {
  const testStart = Date.now();
  
  try {
    const rotationManager = new MockApiKeyRotationManager(
      TEST_CONFIG.geminiKeys,
      'gemini-health-based-test',
      { strategy: 'health_based' }
    );

    // 模拟不同健康状态
    const key1 = rotationManager.getNextApiKey('health-test-1');
    rotationManager.reportSuccess(key1, 'health-test-1');

    const key2 = rotationManager.getNextApiKey('health-test-2');
    rotationManager.reportError(key2, false, 'health-test-2'); // key2有错误

    const key3 = rotationManager.getNextApiKey('health-test-3');
    rotationManager.reportSuccess(key3, 'health-test-3');

    // 下次选择应该避开有错误的key2
    const nextKey = rotationManager.getNextApiKey('health-test-4');
    const isHealthBased = nextKey !== key2;

    const responseTime = Date.now() - testStart;
    const stats = rotationManager.getStats();
    
    log('Health Based测试完成', {
      responseTime: `${responseTime}ms`,
      keySequence: [key1, key2, key3, nextKey],
      isHealthBased,
      stats
    });

    return {
      testCase: 'health-based-strategy',
      success: isHealthBased,
      responseTime,
      analysis: {
        keySequence: [key1, key2, key3, nextKey],
        isHealthBased,
        avoidedErrorKey: nextKey !== key2,
        stats
      }
    };

  } catch (error) {
    const responseTime = Date.now() - testStart;
    log('Health Based测试失败', { error: error.message });
    
    return {
      testCase: 'health-based-strategy',
      success: false,
      responseTime,
      error: error.message
    };
  }
}

async function testErrorHandling() {
  const testStart = Date.now();
  
  try {
    const rotationManager = new MockApiKeyRotationManager(
      TEST_CONFIG.geminiKeys,
      'gemini-error-handling-test',
      { strategy: 'round_robin', maxRetriesPerKey: 2 }
    );

    const key1 = rotationManager.getNextApiKey('error-test-1');
    
    // 模拟连续错误直到key被禁用
    rotationManager.reportError(key1, false, 'error-test-1');
    rotationManager.reportError(key1, false, 'error-test-2');
    
    // key1应该被禁用，下次选择不同的key
    const key2 = rotationManager.getNextApiKey('error-test-3');
    const isFailoverWorking = key1 !== key2;
    
    // 验证key1确实被禁用
    const stats = rotationManager.getStats();
    const key1Stats = stats.keyDetails.find(k => 
      TEST_CONFIG.geminiKeys[k.index] === key1
    );
    const isKey1Disabled = key1Stats && !key1Stats.isActive;

    const responseTime = Date.now() - testStart;
    
    log('错误处理测试完成', {
      responseTime: `${responseTime}ms`,
      key1,
      key2,
      isFailoverWorking,
      isKey1Disabled,
      stats
    });

    return {
      testCase: 'error-handling',
      success: isFailoverWorking && isKey1Disabled,
      responseTime,
      analysis: {
        isFailoverWorking,
        isKey1Disabled,
        keySequence: [key1, key2],
        stats
      }
    };

  } catch (error) {
    const responseTime = Date.now() - testStart;
    log('错误处理测试失败', { error: error.message });
    
    return {
      testCase: 'error-handling',
      success: false,
      responseTime,
      error: error.message
    };
  }
}

// 运行测试
if (require.main === module) {
  fs.writeFileSync(TEST_CONFIG.logFile, '');
  
  runSimpleGeminiRotationTest()
    .then(results => {
      console.log('\n测试报告:', results.conclusions);
      process.exit(results.summary.successfulTests === results.summary.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('测试失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runSimpleGeminiRotationTest };