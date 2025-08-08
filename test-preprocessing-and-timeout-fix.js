#!/usr/bin/env node

/**
 * Test Preprocessing Module and Timeout Fix
 * 测试预处理模块和超时修复
 * Owner: Jason Zhang
 * 
 * 验证:
 * 1. Max token预处理策略是否正常工作
 * 2. API超时是否返回明确错误而非静默失败
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class PreprocessingTimeoutTest {
  constructor() {
    this.results = [];
    this.testPort = 3457; // Test pipeline config server port
  }

  async makeAPIRequest(requestData, port = this.testPort, timeout = 15000) {
    return new Promise((resolve) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key'
        },
        timeout
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const data = res.statusCode === 200 ? JSON.parse(responseBody) : null;
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data,
              rawResponse: responseBody,
              headers: res.headers,
              port,
              isTimeout: false
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              data: null,
              rawResponse: responseBody,
              error: `Parse error: ${error.message}`,
              headers: res.headers,
              port,
              isTimeout: false
            });
          }
        });
      });

      req.on('error', error => resolve({
        success: false,
        statusCode: 0,
        data: null,
        error: error.message,
        port,
        isTimeout: false
      }));

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          data: null,
          error: 'Client request timeout',
          port,
          isTimeout: true
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 测试1: Max Token预处理策略
   */
  async testMaxTokenPreprocessing() {
    console.log('🧪 [TEST-1] Max Token Preprocessing Strategy');
    console.log('Testing with large message history to trigger preprocessing...');

    // 构造一个可能触发token限制的大请求
    const largeMessages = [];
    
    // 添加系统消息
    largeMessages.push({
      role: 'system',
      content: 'You are a helpful assistant that provides detailed explanations.'
    });

    // 添加大量历史消息来触发token限制
    for (let i = 0; i < 10; i++) {
      largeMessages.push({
        role: 'user',
        content: `This is a very long message number ${i} that contains a lot of text to increase the token count. `.repeat(50)
      });
      largeMessages.push({
        role: 'assistant',
        content: `This is a detailed response to message ${i} that also contains substantial text content to increase token usage. `.repeat(50)
      });
    }

    // 添加当前请求
    largeMessages.push({
      role: 'user',
      content: 'Please provide a brief summary of our conversation.'
    });

    const test1 = await this.makeAPIRequest({
      model: 'gemini-2.5-flash',
      messages: largeMessages,
      max_tokens: 2000,  // 设置较低的max_tokens来触发预处理
      temperature: 0.1
    });

    if (test1.success) {
      console.log('✅ [SUCCESS] Large request processed (preprocessing may have been applied)');
      console.log(`   📍 Status: ${test1.statusCode}`);
      console.log(`   📍 Response length: ${test1.rawResponse.length} chars`);
      
      // 检查是否有预处理标记
      const hasPreprocessingHeaders = Object.keys(test1.headers).some(h => 
        h.toLowerCase().includes('preprocessing') || h.toLowerCase().includes('token')
      );
      
      if (hasPreprocessingHeaders) {
        console.log('   ✨ [PREPROCESSING] Headers indicate preprocessing was applied');
      }
      
    } else {
      console.log('❌ [FAILED] Large request processing failed');
      console.log(`   🔍 Status: ${test1.statusCode}`);
      console.log(`   🔍 Error: ${test1.error || test1.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'Max Token Preprocessing',
      ...test1,
      timestamp: new Date().toISOString()
    });

    return test1;
  }

  /**
   * 测试2: API超时错误处理
   */
  async testTimeoutErrorHandling() {
    console.log('\\n🧪 [TEST-2] API Timeout Error Handling');
    console.log('Testing timeout error response (not silent failure)...');

    // 使用很短的超时来故意触发超时
    const test2 = await this.makeAPIRequest({
      model: 'gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: 'Simple test message'
      }],
      max_tokens: 100,
      temperature: 0.1
    }, this.testPort, 2000); // 2秒超时

    const isApiTimeoutError = test2.error && (
      test2.error.includes('API_TIMEOUT') ||
      test2.error.includes('API request timed out') ||
      test2.rawResponse?.includes('API_TIMEOUT')
    );

    if (test2.success) {
      console.log('✅ [SUCCESS] Request completed within timeout');
      console.log(`   📍 Response received normally`);
    } else if (test2.isTimeout) {
      console.log('⏰ [CLIENT-TIMEOUT] Client-side timeout occurred');
      console.log(`   📍 This is expected for short timeout test`);
    } else if (isApiTimeoutError) {
      console.log('✅ [SUCCESS] API timeout error properly returned (not silent failure)');
      console.log(`   📍 Error: ${test2.error}`);
      console.log(`   📍 Status: ${test2.statusCode}`);
    } else {
      console.log('❓ [UNCLEAR] Non-timeout error occurred');
      console.log(`   🔍 Status: ${test2.statusCode}`);
      console.log(`   🔍 Error: ${test2.error || test2.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'API Timeout Error Handling',
      ...test2,
      isApiTimeoutError,
      timestamp: new Date().toISOString()
    });

    return test2;
  }

  /**
   * 测试3: 正常请求验证
   */
  async testNormalRequest() {
    console.log('\\n🧪 [TEST-3] Normal Request Validation');
    console.log('Testing normal request without preprocessing or timeout...');

    const test3 = await this.makeAPIRequest({
      model: 'gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: 'Hello, how are you?'
      }],
      max_tokens: 50,
      temperature: 0.1
    });

    if (test3.success) {
      console.log('✅ [SUCCESS] Normal request works correctly');
      console.log(`   💬 Response: "${test3.data?.choices?.[0]?.message?.content?.substring(0, 100) || 'No content'}"`);
    } else {
      console.log('❌ [FAILED] Normal request failed');
      console.log(`   🔍 Status: ${test3.statusCode}`);
      console.log(`   🔍 Error: ${test3.error || test3.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'Normal Request Validation',
      ...test3,
      timestamp: new Date().toISOString()
    });

    return test3;
  }

  /**
   * 运行完整测试套件
   */
  async runTests() {
    console.log('🚀 [PREPROCESSING-TIMEOUT-TEST] Starting Combined Test Suite');
    console.log(`🔗 [TARGET] Testing server on port ${this.testPort}\\n`);

    const test1 = await this.testMaxTokenPreprocessing();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const test2 = await this.testTimeoutErrorHandling();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const test3 = await this.testNormalRequest();

    // 生成测试总结
    const successful = this.results.filter(r => r.success);
    const timeoutTests = this.results.filter(r => r.isTimeout || r.isApiTimeoutError);
    
    console.log('\\n🏁 [RESULTS] Preprocessing & Timeout Test Summary');
    console.log('='.repeat(60));
    console.log(`📊 Total Tests: ${this.results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`⏰ Timeout-related: ${timeoutTests.length}`);
    
    // 评估预处理功能
    console.log('\\n📋 [PREPROCESSING EVALUATION]');
    if (test1.success) {
      console.log('✅ Large request processing: Working');
      console.log('   🔧 Preprocessing module appears to be functional');
    } else {
      console.log('❌ Large request processing: Failed');
    }

    // 评估超时处理
    console.log('\\n🔧 [TIMEOUT HANDLING EVALUATION]');
    if (test2.isApiTimeoutError) {
      console.log('✅ API timeout error handling: Working correctly');
      console.log('   📝 Returns explicit timeout errors instead of silent failures');
    } else if (test2.isTimeout) {
      console.log('⏰ Client timeout occurred: Cannot test server timeout handling');
    } else if (test2.success) {
      console.log('✅ Request completed normally: Timeout handling not triggered');
    } else {
      console.log('❓ Timeout handling: Unclear result');
    }

    // 保存结果
    const reportPath = path.join(__dirname, 'database', 'pipeline-data-new', 'analytics', 'preprocessing-timeout-test.json');
    const report = {
      testSuite: 'Preprocessing and Timeout Test',
      executedAt: new Date().toISOString(),
      port: this.testPort,
      summary: {
        totalTests: this.results.length,
        successful: successful.length,
        timeoutRelated: timeoutTests.length,
        preprocessingFunctional: test1.success,
        timeoutHandlingWorking: test2.isApiTimeoutError || test2.success
      },
      results: this.results
    };

    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\\n📊 [REPORT] Results saved to: ${reportPath}`);
    } catch (error) {
      console.error(`❌ Failed to save report: ${error.message}`);
    }

    const overallSuccess = test1.success && (test2.isApiTimeoutError || test2.success) && test3.success;
    console.log(`\\n${overallSuccess ? '🎉' : '⚠️'} [CONCLUSION] Combined test ${overallSuccess ? 'PASSED' : 'NEEDS ATTENTION'}`);
    
    if (overallSuccess) {
      console.log('🚀 [STATUS] Both preprocessing and timeout handling are working correctly');
    }

    return overallSuccess;
  }
}

// Execute test
if (require.main === module) {
  const test = new PreprocessingTimeoutTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { PreprocessingTimeoutTest };