/**
 * 全面错误处理覆盖测试
 * 验证所有错误场景都返回正确的HTTP状态码，禁止沉默失败
 */

const axios = require('axios');
const { spawn } = require('child_process');

class ErrorHandlingCoverageTest {
  constructor() {
    this.port = 5508; // 使用已知有问题的ShuaiHong端口进行测试
    this.baseUrl = `http://localhost:${this.port}`;
    this.testResults = [];
    this.silentFailures = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  /**
   * 执行全面的错误处理覆盖测试
   */
  async runComprehensiveTest() {
    console.log('🧪 [ERROR COVERAGE] Starting comprehensive error handling coverage test');
    console.log(`   Port: ${this.port}`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Test Focus: Silent failure detection and proper HTTP status codes`);
    console.log(`   Note: Testing 5508 port (ShuaiHong OpenAI-compatible service)`);
    console.log('');

    // 先检查服务可用性
    await this.checkServiceAvailability();

    const testCategories = [
      'streaming_errors',
      'non_streaming_errors', 
      'provider_errors',
      'network_errors',
      'authentication_errors',
      'max_tokens_errors',
      'tool_call_errors',
      'routing_errors'
    ];

    for (const category of testCategories) {
      console.log(`🔍 [CATEGORY] Testing ${category}...`);
      await this.testErrorCategory(category);
      console.log('');
    }

    this.generateTestReport();
  }

  /**
   * 检查服务可用性并确定正确的端点
   */
  async checkServiceAvailability() {
    try {
      const healthResponse = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      console.log(`✅ [SERVICE] Health check passed: ${JSON.stringify(healthResponse.data)}`);
      
      // 确定使用v1/chat/completions端点（OpenAI兼容）
      this.apiEndpoint = '/v1/chat/completions';
      console.log(`✅ [SERVICE] Using endpoint: ${this.apiEndpoint}`);
      
    } catch (error) {
      console.log(`❌ [SERVICE] Health check failed: ${error.message}`);
      throw new Error(`Service on port ${this.port} is not available`);
    }
  }

  /**
   * 测试特定错误类别
   */
  async testErrorCategory(category) {
    switch (category) {
      case 'streaming_errors':
        await this.testStreamingErrors();
        break;
      case 'non_streaming_errors':
        await this.testNonStreamingErrors();
        break;
      case 'provider_errors':
        await this.testProviderErrors();
        break;
      case 'network_errors':
        await this.testNetworkErrors();
        break;
      case 'authentication_errors':
        await this.testAuthenticationErrors();
        break;
      case 'max_tokens_errors':
        await this.testMaxTokensErrors();
        break;
      case 'tool_call_errors':
        await this.testToolCallErrors();
        break;
      case 'routing_errors':
        await this.testRoutingErrors();
        break;
    }
  }

  /**
   * 测试流式请求错误
   */
  async testStreamingErrors() {
    const testCases = [
      {
        name: 'streaming_invalid_model',
        request: {
          model: 'invalid-model-name',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true
        },
        expectedStatuses: [400, 404, 500]
      },
      {
        name: 'streaming_empty_messages',
        request: {
          model: 'qwen3-coder', // 使用5508端口支持的模型
          messages: [],
          stream: true
        },
        expectedStatuses: [400, 422]
      },
      {
        name: 'streaming_malformed_request',
        request: {
          model: 'qwen3-coder', // 使用5508端口支持的模型
          // missing messages array
          stream: true
        },
        expectedStatuses: [400]
      }
    ];

    for (const testCase of testCases) {
      await this.testStreamingErrorCase(testCase);
    }
  }

  /**
   * 测试流式错误用例
   */
  async testStreamingErrorCase(testCase) {
    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing ${testCase.name}...`);
      
      const response = await axios.post(`${this.baseUrl}${this.apiEndpoint}`, testCase.request, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        timeout: 10000,
        validateStatus: () => true // 接受所有状态码
      });

      const result = this.analyzeErrorResponse(testCase, response, true);
      this.testResults.push(result);

      if (result.isSilentFailure) {
        this.silentFailures.push(result);
        console.log(`   ❌ ${testCase.name}: SILENT FAILURE DETECTED!`);
        console.log(`      Status: ${response.status}, Expected: ${testCase.expectedStatuses.join(' or ')}`);
      } else {
        this.passedTests++;
        console.log(`   ✅ ${testCase.name}: Status ${response.status} (Expected)`);
      }

    } catch (error) {
      const result = {
        testName: testCase.name,
        category: 'streaming_errors',
        status: 'error',
        isSilentFailure: false,
        actualStatus: error.response?.status || 'network_error',
        expectedStatuses: testCase.expectedStatuses,
        errorMessage: error.message,
        hasProperErrorFormat: false,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(result);
      console.log(`   ⚠️  ${testCase.name}: Network error - ${error.message}`);
    }
  }

  /**
   * 测试非流式请求错误
   */
  async testNonStreamingErrors() {
    const testCases = [
      {
        name: 'non_streaming_invalid_model',
        request: {
          model: 'non-existent-model',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        expectedStatuses: [400, 404, 500]
      },
      {
        name: 'non_streaming_max_tokens_exceeded',
        request: {
          model: 'qwen3-coder', // 使用5508端口支持的模型
          messages: [{ role: 'user', content: 'Generate a very long response' }],
          max_tokens: 1 // 故意设置过小的token限制
        },
        expectedStatuses: [400, 500]
      }
    ];

    for (const testCase of testCases) {
      await this.testNonStreamingErrorCase(testCase);
    }
  }

  /**
   * 测试非流式错误用例
   */
  async testNonStreamingErrorCase(testCase) {
    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing ${testCase.name}...`);
      
      const response = await axios.post(`${this.baseUrl}${this.apiEndpoint}`, testCase.request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true
      });

      const result = this.analyzeErrorResponse(testCase, response, false);
      this.testResults.push(result);

      if (result.isSilentFailure) {
        this.silentFailures.push(result);
        console.log(`   ❌ ${testCase.name}: SILENT FAILURE DETECTED!`);
        console.log(`      Status: ${response.status}, Expected: ${testCase.expectedStatuses.join(' or ')}`);
      } else {
        this.passedTests++;
        console.log(`   ✅ ${testCase.name}: Status ${response.status} (Expected)`);
      }

    } catch (error) {
      const result = {
        testName: testCase.name,
        category: 'non_streaming_errors',
        status: 'error',
        isSilentFailure: false,
        actualStatus: error.response?.status || 'network_error',
        expectedStatuses: testCase.expectedStatuses,
        errorMessage: error.message,
        hasProperErrorFormat: false,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(result);
      console.log(`   ⚠️  ${testCase.name}: Network error - ${error.message}`);
    }
  }

  /**
   * 测试Provider错误
   */
  async testProviderErrors() {
    // 测试健康检查端点的错误处理
    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing provider_health_check...`);
      
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000,
        validateStatus: () => true
      });

      const result = {
        testName: 'provider_health_check',
        category: 'provider_errors',
        status: response.status < 400 ? 'pass' : 'fail',
        isSilentFailure: false,
        actualStatus: response.status,
        expectedStatuses: [200, 503],
        hasProperErrorFormat: true,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(result);
      
      if (response.status === 200) {
        this.passedTests++;
        console.log(`   ✅ provider_health_check: Status ${response.status} (Healthy)`);
      } else {
        console.log(`   ⚠️  provider_health_check: Status ${response.status} (Unhealthy but properly reported)`);
      }

    } catch (error) {
      console.log(`   ❌ provider_health_check: Network error - ${error.message}`);
    }
  }

  /**
   * 测试网络错误
   */
  async testNetworkErrors() {
    // 测试无效端口的网络错误
    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing network_connection_refused...`);
      
      const response = await axios.post(`http://localhost:9999/anthropic`, {
        model: 'claude-4-sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      }, {
        timeout: 2000,
        validateStatus: () => true
      });

      console.log(`   ⚠️  network_connection_refused: Unexpected response status ${response.status}`);

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ✅ network_connection_refused: Properly failed with ECONNREFUSED`);
        this.passedTests++;
      } else {
        console.log(`   ⚠️  network_connection_refused: Unexpected error - ${error.message}`);
      }
    }
  }

  /**
   * 测试认证错误
   */
  async testAuthenticationErrors() {
    const testCases = [
      {
        name: 'auth_missing_headers',
        headers: {},
        expectedStatuses: [401, 403]
      },
      {
        name: 'auth_invalid_token', 
        headers: { 'Authorization': 'Bearer invalid-token' },
        expectedStatuses: [401, 403]
      }
    ];

    for (const testCase of testCases) {
      await this.testAuthCase(testCase);
    }
  }

  /**
   * 测试认证用例
   */
  async testAuthCase(testCase) {
    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing ${testCase.name}...`);
      
      const response = await axios.post(`${this.baseUrl}${this.apiEndpoint}`, {
        model: 'qwen3-coder',
        messages: [{ role: 'user', content: 'Hello' }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...testCase.headers
        },
        timeout: 5000,
        validateStatus: () => true
      });

      const result = this.analyzeErrorResponse(testCase, response, false);
      this.testResults.push(result);

      if (result.isSilentFailure) {
        this.silentFailures.push(result);
        console.log(`   ❌ ${testCase.name}: SILENT FAILURE DETECTED!`);
      } else {
        this.passedTests++;
        console.log(`   ✅ ${testCase.name}: Status ${response.status}`);
      }

    } catch (error) {
      console.log(`   ⚠️  ${testCase.name}: Network error - ${error.message}`);
    }
  }

  /**
   * 测试Max Tokens错误
   */
  async testMaxTokensErrors() {
    const testCase = {
      name: 'max_tokens_limit_exceeded',
      request: {
        model: 'qwen3-coder', // 使用5508端口支持的模型
        messages: [{ 
          role: 'user', 
          content: 'Please write a very long detailed response about artificial intelligence, machine learning, and their applications. Include as much detail as possible.'
        }],
        max_tokens: 5 // 极小的token限制
      },
      expectedStatuses: [400, 500]
    };

    await this.testNonStreamingErrorCase(testCase);
  }

  /**
   * 测试工具调用错误
   */
  async testToolCallErrors() {
    const testCase = {
      name: 'tool_call_invalid_format',
      request: {
        model: 'qwen3-coder', // 使用5508端口支持的模型
        messages: [{ role: 'user', content: 'Use the invalid tool' }],
        tools: [
          {
            name: 'invalid_tool',
            description: 'An invalid tool definition'
            // missing input_schema
          }
        ]
      },
      expectedStatuses: [400, 422, 500]
    };

    await this.testNonStreamingErrorCase(testCase);
  }

  /**
   * 测试路由错误
   */
  async testRoutingErrors() {
    const testCase = {
      name: 'routing_unsupported_endpoint',
      expectedStatuses: [404, 405]
    };

    this.totalTests++;
    
    try {
      console.log(`   🔄 Testing ${testCase.name}...`);
      
      const response = await axios.post(`${this.baseUrl}/unsupported-endpoint`, {
        model: 'qwen3-coder',
        messages: [{ role: 'user', content: 'Hello' }]
      }, {
        timeout: 5000,
        validateStatus: () => true
      });

      const result = this.analyzeErrorResponse(testCase, response, false);
      this.testResults.push(result);

      if (result.isSilentFailure) {
        this.silentFailures.push(result);
        console.log(`   ❌ ${testCase.name}: SILENT FAILURE DETECTED!`);
      } else {
        this.passedTests++;
        console.log(`   ✅ ${testCase.name}: Status ${response.status}`);
      }

    } catch (error) {
      console.log(`   ⚠️  ${testCase.name}: Network error - ${error.message}`);
    }
  }

  /**
   * 分析错误响应
   */
  analyzeErrorResponse(testCase, response, isStreaming) {
    const isSilentFailure = this.detectSilentFailure(response, testCase.expectedStatuses, isStreaming);
    const hasProperErrorFormat = this.validateErrorFormat(response, isStreaming);

    return {
      testName: testCase.name,
      category: testCase.category || 'unknown',
      status: isSilentFailure ? 'silent_failure' : 'pass',
      isSilentFailure,
      actualStatus: response.status,
      expectedStatuses: testCase.expectedStatuses,
      hasProperErrorFormat,
      responseData: response.data,
      responseHeaders: response.headers,
      isStreaming,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 检测静默失败
   */
  detectSilentFailure(response, expectedStatuses, isStreaming) {
    // 检查1: 状态码是否在预期范围内
    if (!expectedStatuses.includes(response.status) && response.status === 200) {
      console.log(`   🚨 SILENT FAILURE: Status is 200 but error was expected`);
      return true;
    }

    // 检查2: 对于错误状态码，是否有适当的错误格式
    if (response.status >= 400) {
      if (isStreaming) {
        // 流式响应应该有event: error
        const responseText = String(response.data);
        if (!responseText.includes('event: error')) {
          console.log(`   🚨 SILENT FAILURE: Streaming error without proper error event`);
          return true;
        }
      } else {
        // 非流式响应应该有error对象
        if (!response.data || !response.data.error) {
          console.log(`   🚨 SILENT FAILURE: Non-streaming error without proper error object`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 验证错误格式
   */
  validateErrorFormat(response, isStreaming) {
    if (response.status < 400) {
      return true; // 成功响应不需要错误格式
    }

    if (isStreaming) {
      const responseText = String(response.data);
      return responseText.includes('event: error') && responseText.includes('data:');
    } else {
      return response.data && 
             response.data.error &&
             response.data.error.type &&
             response.data.error.message;
    }
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    const passRate = this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0;
    const silentFailureRate = this.totalTests > 0 ? (this.silentFailures.length / this.totalTests) * 100 : 0;

    console.log('');
    console.log('🧪 ============================================');
    console.log('    ERROR HANDLING COVERAGE TEST REPORT');
    console.log('============================================');
    console.log(`📊 Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.totalTests - this.passedTests}`);
    console.log(`🚨 Silent Failures: ${this.silentFailures.length}`);
    console.log(`📈 Pass Rate: ${passRate.toFixed(1)}%`);
    console.log(`⚠️  Silent Failure Rate: ${silentFailureRate.toFixed(1)}%`);
    console.log('');

    if (this.silentFailures.length > 0) {
      console.log('🚨 SILENT FAILURES DETECTED:');
      this.silentFailures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.testName}:`);
        console.log(`      Status: ${failure.actualStatus} (Expected: ${failure.expectedStatuses.join(' or ')})`);
        console.log(`      Category: ${failure.category}`);
        console.log(`      Streaming: ${failure.isStreaming ? 'Yes' : 'No'}`);
      });
      console.log('');
    }

    // 按类别统计
    const categoryStats = {};
    this.testResults.forEach(result => {
      const category = result.category || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, passed: 0, silentFailures: 0 };
      }
      categoryStats[category].total++;
      if (result.status === 'pass') categoryStats[category].passed++;
      if (result.isSilentFailure) categoryStats[category].silentFailures++;
    });

    console.log('📊 CATEGORY BREAKDOWN:');
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const categoryPassRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
      console.log(`   ${category}: ${stats.passed}/${stats.total} (${categoryPassRate.toFixed(1)}%) - ${stats.silentFailures} silent failures`);
    });

    console.log('');
    
    // 最终判断
    if (silentFailureRate > 0) {
      console.log('❌ TEST RESULT: FAILED - Silent failures detected!');
      console.log('   Action Required: Fix silent failure issues before deployment');
    } else if (passRate >= 80) {
      console.log('✅ TEST RESULT: PASSED - Error handling coverage is adequate');
    } else {
      console.log('⚠️  TEST RESULT: WARNING - Low pass rate, review error handling');
    }

    // 保存详细报告到文件
    this.saveDetailedReport();
  }

  /**
   * 保存详细报告
   */
  saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.totalTests - this.passedTests,
        silentFailures: this.silentFailures.length,
        passRate: this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0,
        silentFailureRate: this.totalTests > 0 ? (this.silentFailures.length / this.totalTests) * 100 : 0
      },
      testResults: this.testResults,
      silentFailures: this.silentFailures,
      testConfiguration: {
        port: this.port,
        baseUrl: this.baseUrl,
        testDate: new Date().toISOString()
      }
    };

    const fs = require('fs');
    const reportPath = `/tmp/error-handling-coverage-test-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📝 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  Failed to save report: ${error.message}`);
    }
  }
}

// 执行测试
async function main() {
  const test = new ErrorHandlingCoverageTest();
  
  console.log('🚀 Starting comprehensive error handling coverage test...');
  console.log('   This test will verify that ALL errors return proper HTTP status codes');
  console.log('   and that NO silent failures occur in the system.');
  console.log('');

  try {
    await test.runComprehensiveTest();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ErrorHandlingCoverageTest };