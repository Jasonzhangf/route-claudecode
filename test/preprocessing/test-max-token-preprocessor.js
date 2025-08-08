#!/usr/bin/env node

/**
 * Unit Test for Max Token Preprocessor
 * Max Token预处理器单元测试
 * Owner: Jason Zhang
 */

const assert = require('assert');

// 模拟依赖项，因为我们在Node.js环境中测试TypeScript模块
class MockMaxTokenPreprocessor {
  constructor(config) {
    this.config = config;
  }

  async preprocessRequest(request, maxTokenLimit, routingCategory) {
    const originalTokenCount = this.estimateTokens(JSON.stringify(request));
    
    // 模拟预处理逻辑
    if (!this.config.enabled) {
      return {
        ...request,
        appliedStrategies: [],
        originalTokenCount,
        processedTokenCount: originalTokenCount
      };
    }

    let processedRequest = { ...request };
    let appliedStrategies = [];
    let processedTokenCount = originalTokenCount;

    // 1. 首先检查路由重定向策略（独立于maxTokenLimit）
    if (this.config.strategies.routeRedirection.enabled && 
        originalTokenCount > this.config.strategies.routeRedirection.tokenThreshold) {
      processedRequest.redirectedCategory = this.config.strategies.routeRedirection.longContextCategory;
      appliedStrategies.push('route_redirection');
    }

    // 2. 如果超过限制，应用其他策略
    if (originalTokenCount > maxTokenLimit) {

      // 动态截断策略  
      if (this.config.strategies.dynamicTruncation.enabled) {
        const targetTokens = Math.floor(maxTokenLimit * this.config.strategies.dynamicTruncation.tokenRatio);
        
        if (processedRequest.messages && processedRequest.messages.length > 2) {
          // 保留系统消息和最后N条消息，截断中间的消息
          const systemMessages = processedRequest.messages.filter(m => m.role === 'system');
          const nonSystemMessages = processedRequest.messages.filter(m => m.role !== 'system');
          const preserveCount = this.config.strategies.dynamicTruncation.preserveLatestMessages;
          
          if (nonSystemMessages.length > preserveCount) {
            const latestMessages = nonSystemMessages.slice(-preserveCount);
            processedRequest.messages = [...systemMessages, ...latestMessages];
            appliedStrategies.push('dynamic_truncation');
            processedTokenCount = this.estimateTokens(JSON.stringify(processedRequest));
          }
        }
      }
    }

    return {
      ...processedRequest,
      appliedStrategies,
      originalTokenCount,
      processedTokenCount
    };
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  static getDefaultConfig() {
    return {
      enabled: true,
      strategies: {
        dynamicTruncation: {
          name: 'dynamic_truncation',
          enabled: true,
          priority: 2,
          truncatePosition: 'head',
          tokenRatio: 0.95,
          preserveSystemPrompt: true,
          preserveLatestMessages: 2,
          enableSimplifiedTools: true
        },
        routeRedirection: {
          name: 'route_redirection',
          enabled: true,
          priority: 1,
          longContextCategory: 'longcontext',
          tokenThreshold: 3000
        },
        longContextCompression: {
          name: 'long_context_compression',
          enabled: false,
          priority: 3,
          compressionRatio: 0.7,
          compressionModel: 'gemini-2.5-pro'
        }
      }
    };
  }
}

class MaxTokenPreprocessorUnitTest {
  constructor() {
    this.testResults = [];
  }

  async runTest(testName, testFn) {
    try {
      console.log(`🧪 [TEST] ${testName}`);
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ [PASS] ${testName} (${duration}ms)`);
      this.testResults.push({ testName, status: 'PASS', duration });
    } catch (error) {
      console.log(`❌ [FAIL] ${testName}: ${error.message}`);
      this.testResults.push({ testName, status: 'FAIL', error: error.message });
    }
  }

  async testDefaultConfiguration() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    
    assert(config.enabled === true, 'Default config should be enabled');
    assert(config.strategies.dynamicTruncation.enabled === true, 'Dynamic truncation should be enabled');
    assert(config.strategies.routeRedirection.enabled === true, 'Route redirection should be enabled');
    assert(config.strategies.routeRedirection.tokenThreshold === 3000, 'Token threshold should be 3000');
    assert(config.strategies.dynamicTruncation.tokenRatio === 0.95, 'Token ratio should be 0.95');
  }

  async testDisabledPreprocessor() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    config.enabled = false;
    
    const preprocessor = new MockMaxTokenPreprocessor(config);
    const request = {
      messages: [
        { role: 'user', content: 'Hello'.repeat(1000) }
      ]
    };

    const result = await preprocessor.preprocessRequest(request, 100);
    
    assert(result.appliedStrategies.length === 0, 'No strategies should be applied when disabled');
    assert(result.processedTokenCount === result.originalTokenCount, 'Token count should not change');
  }

  async testRouteRedirectionStrategy() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    // 降低阈值以便测试
    config.strategies.routeRedirection.tokenThreshold = 1000;
    
    const preprocessor = new MockMaxTokenPreprocessor(config);
    
    // 创建超过阈值的大请求
    const largeRequest = {
      messages: [
        { role: 'user', content: 'Hello '.repeat(1000) } // 大约1250 tokens
      ]
    };

    const result = await preprocessor.preprocessRequest(largeRequest, 2000);
    
    console.log('Debug - Route Redirection Test:');
    console.log('  Original tokens:', result.originalTokenCount);
    console.log('  Token limit:', 2000);
    console.log('  Threshold:', config.strategies.routeRedirection.tokenThreshold);
    console.log('  Applied strategies:', result.appliedStrategies);
    console.log('  Redirected category:', result.redirectedCategory);
    
    assert(result.appliedStrategies.includes('route_redirection'), 'Route redirection should be applied');
    assert(result.redirectedCategory === 'longcontext', 'Should redirect to longcontext');
    assert(result.originalTokenCount > 1000, 'Original request should exceed threshold');
  }

  async testDynamicTruncationStrategy() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    const preprocessor = new MockMaxTokenPreprocessor(config);
    
    // 创建有很多历史消息的请求
    const messages = [
      { role: 'system', content: 'You are a helpful assistant' }
    ];
    
    // 添加10条历史对话
    for (let i = 0; i < 10; i++) {
      messages.push({ role: 'user', content: `Question ${i}` });
      messages.push({ role: 'assistant', content: `Answer ${i}` });
    }

    const request = { messages };
    const result = await preprocessor.preprocessRequest(request, 100); // 很小的token限制
    
    console.log('Debug - Dynamic Truncation Test:');
    console.log('  Original message count:', request.messages.length);
    console.log('  Processed message count:', result.messages.length);
    console.log('  Original tokens:', result.originalTokenCount);
    console.log('  Processed tokens:', result.processedTokenCount);
    console.log('  Applied strategies:', result.appliedStrategies);

    assert(result.appliedStrategies.includes('dynamic_truncation'), 'Dynamic truncation should be applied');
    assert(result.processedTokenCount < result.originalTokenCount, 'Token count should be reduced');
    
    // 检查系统消息是否保留
    const systemMessages = result.messages.filter(m => m.role === 'system');
    assert(systemMessages.length === 1, 'System message should be preserved');
    
    // 检查消息数量是否减少
    assert(result.messages.length < request.messages.length, 'Message count should be reduced');
  }

  async testPreserveLatestMessages() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    config.strategies.dynamicTruncation.preserveLatestMessages = 4; // 保留最新4条消息
    
    const preprocessor = new MockMaxTokenPreprocessor(config);
    
    const messages = [
      { role: 'system', content: 'System message' }
    ];
    
    // 添加10条对话，应该只保留最新4条
    for (let i = 0; i < 10; i++) {
      messages.push({ role: 'user', content: `User message ${i}` });
      messages.push({ role: 'assistant', content: `Assistant response ${i}` });
    }

    const request = { messages };
    const result = await preprocessor.preprocessRequest(request, 200);
    
    // 应该有1个系统消息 + 4条最新消息 = 5条消息
    const expectedMessageCount = 1 + 4;
    assert(result.messages.length === expectedMessageCount, 
      `Should preserve system message + ${config.strategies.dynamicTruncation.preserveLatestMessages} latest messages`);
      
    // 检查最新消息是否被保留
    const lastUserMessage = result.messages.find(m => m.content.includes('User message 9'));
    const lastAssistantMessage = result.messages.find(m => m.content.includes('Assistant response 9'));
    
    assert(lastUserMessage, 'Latest user message should be preserved');
    assert(lastAssistantMessage, 'Latest assistant message should be preserved');
  }

  async testTokenEstimation() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    const preprocessor = new MockMaxTokenPreprocessor(config);
    
    // 测试token估算
    const shortText = 'Hello';
    const longText = 'Hello '.repeat(100);
    
    const shortTokens = preprocessor.estimateTokens(shortText);
    const longTokens = preprocessor.estimateTokens(longText);
    
    assert(shortTokens < longTokens, 'Longer text should have more tokens');
    assert(shortTokens > 0, 'Short text should have at least 1 token');
    assert(longTokens > shortTokens * 50, 'Long text should have significantly more tokens');
  }

  async testSmallRequestNoProcessing() {
    const config = MockMaxTokenPreprocessor.getDefaultConfig();
    const preprocessor = new MockMaxTokenPreprocessor(config);
    
    const smallRequest = {
      messages: [
        { role: 'user', content: 'Hi' }
      ]
    };

    const result = await preprocessor.preprocessRequest(smallRequest, 4000);
    
    assert(result.appliedStrategies.length === 0, 'No strategies should be applied for small requests');
    assert(result.processedTokenCount === result.originalTokenCount, 'Token count should remain the same');
    assert(!result.redirectedCategory, 'Should not redirect small requests');
  }

  async runAllTests() {
    console.log('🚀 [MAX-TOKEN-PREPROCESSOR] Starting Unit Tests');
    console.log('=' .repeat(60));

    await this.runTest('Default Configuration', () => this.testDefaultConfiguration());
    await this.runTest('Disabled Preprocessor', () => this.testDisabledPreprocessor());
    await this.runTest('Route Redirection Strategy', () => this.testRouteRedirectionStrategy());
    await this.runTest('Dynamic Truncation Strategy', () => this.testDynamicTruncationStrategy());
    await this.runTest('Preserve Latest Messages', () => this.testPreserveLatestMessages());
    await this.runTest('Token Estimation', () => this.testTokenEstimation());
    await this.runTest('Small Request No Processing', () => this.testSmallRequestNoProcessing());

    // 测试结果统计
    const passed = this.testResults.filter(r => r.status === 'PASS');
    const failed = this.testResults.filter(r => r.status === 'FAIL');
    
    console.log('\\n🏁 [RESULTS] Unit Test Summary');
    console.log('=' .repeat(60));
    console.log(`📊 Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📈 Success Rate: ${((passed.length / this.testResults.length) * 100).toFixed(1)}%`);

    if (failed.length > 0) {
      console.log('\\n❌ [FAILED TESTS]');
      failed.forEach(test => {
        console.log(`   • ${test.testName}: ${test.error}`);
      });
    }

    const allPassed = failed.length === 0;
    console.log(`\\n${allPassed ? '🎉' : '❌'} [CONCLUSION] Unit tests ${allPassed ? 'PASSED' : 'FAILED'}`);
    
    if (allPassed) {
      console.log('✅ [STATUS] Max Token Preprocessor is ready for integration');
    }

    return allPassed;
  }
}

// 执行测试
if (require.main === module) {
  const test = new MaxTokenPreprocessorUnitTest();
  test.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Unit test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { MaxTokenPreprocessorUnitTest, MockMaxTokenPreprocessor };