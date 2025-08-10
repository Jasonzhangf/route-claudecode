/**
 * Gemini标准流水线端到端测试
 * 基于OpenAI标准设计规则的完整流水线验证
 * 项目所有者: Jason Zhang
 * 
 * 测试范围:
 * - 完整11模块流水线处理
 * - 真实API调用验证
 * - 错误恢复和重试机制
 * - 性能和稳定性测试
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 端到端测试配置
const E2E_TEST_CONFIG = {
  testTimeout: 60000, // 60秒超时
  retryAttempts: 3,
  logFile: `/tmp/gemini-e2e-test-${Date.now()}.log`,
  
  // 测试端点配置
  endpoints: {
    local: 'http://localhost:3456',
    geminiDirect: 'http://localhost:5502' // Gemini单provider端口
  },
  
  // 测试用例集
  testSuites: {
    basic: {
      name: 'basic-text-generation',
      description: '基础文本生成测试',
      request: {
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: 'Please respond with exactly: "Gemini Standard Pipeline Test Successful"'
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      },
      validation: {
        expectedContent: 'Gemini Standard Pipeline Test Successful',
        maxResponseTime: 5000,
        minTokens: 5
      }
    },
    
    toolCalling: {
      name: 'tool-calling-workflow',
      description: '工具调用流程测试',
      request: {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: 'Please get the current weather for Tokyo using the weather tool.'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather information for a city',
            input_schema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'The city name'
                },
                units: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'Temperature units'
                }
              },
              required: ['city']
            }
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      },
      validation: {
        expectToolCall: true,
        expectedToolName: 'get_weather',
        expectedToolArgs: { city: 'Tokyo' },
        maxResponseTime: 10000
      }
    },
    
    multiTurn: {
      name: 'multi-turn-conversation',
      description: '多轮对话测试',
      requests: [
        {
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: 'Please remember this number: 42. What is it?'
            }
          ],
          max_tokens: 100
        },
        {
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: 'Please remember this number: 42. What is it?'
            },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'The number you asked me to remember is 42.' }]
            },
            {
              role: 'user',
              content: 'Now multiply it by 2.'
            }
          ],
          max_tokens: 100
        }
      ],
      validation: {
        expectSequential: true,
        expectedFinalResult: '84',
        maxTotalTime: 15000
      }
    },
    
    errorRecovery: {
      name: 'error-recovery-resilience',
      description: '错误恢复和容错测试',
      requests: [
        {
          model: 'invalid-model-name',
          messages: [{ role: 'user', content: 'Test invalid model' }]
        },
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: '' }] // 空内容
        },
        {
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Test after errors' }],
          max_tokens: 1 // 极小token限制
        }
      ],
      validation: {
        expectErrors: true,
        errorRecoveryRequired: true,
        maxErrorCount: 2
      }
    },
    
    performance: {
      name: 'performance-stress-test',
      description: '性能压力测试',
      request: {
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: 'Generate a short story about AI in exactly 100 words.'
          }
        ],
        max_tokens: 150,
        temperature: 0.5
      },
      validation: {
        concurrentRequests: 5,
        totalRequests: 20,
        maxAverageResponseTime: 8000,
        minSuccessRate: 90
      }
    }
  }
};

class GeminiE2ETestRunner {
  constructor() {
    this.results = {
      startTime: Date.now(),
      suites: {},
      overall: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
      },
      performance: {},
      coverage: {
        modules: [],
        endpoints: [],
        errorCases: []
      }
    };
    
    this.axiosClient = axios.create({
      timeout: E2E_TEST_CONFIG.testTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Gemini-E2E-Test/1.0'
      }
    });
  }

  async runAllTests() {
    console.log('\n🚀 开始Gemini标准流水线端到端测试...\n');
    this.logToFile(`=== Gemini Standard Pipeline E2E Tests Started at ${new Date().toISOString()} ===`);

    try {
      // 1. 环境检查
      await this.checkTestEnvironment();
      
      // 2. 运行所有测试套件
      for (const [suiteKey, suite] of Object.entries(E2E_TEST_CONFIG.testSuites)) {
        await this.runTestSuite(suiteKey, suite);
      }
      
      // 3. 数据收集和性能分析
      await this.collectMetricsAndAnalyze();
      
    } catch (error) {
      this.results.overall.errors.push({
        type: 'test-runner-error',
        message: error.message,
        stack: error.stack
      });
    }

    this.generateE2EReport();
    return this.results;
  }

  async checkTestEnvironment() {
    console.log('🔍 环境检查中...');
    
    const checks = [
      {
        name: 'local-server',
        url: E2E_TEST_CONFIG.endpoints.local + '/health',
        required: false
      },
      {
        name: 'gemini-direct',
        url: E2E_TEST_CONFIG.endpoints.geminiDirect + '/health',
        required: true
      }
    ];

    for (const check of checks) {
      try {
        const response = await this.axiosClient.get(check.url, { timeout: 5000 });
        console.log(`   ✅ ${check.name}: 可用 (${response.status})`);
        this.results.coverage.endpoints.push(check.name);
      } catch (error) {
        if (check.required) {
          console.log(`   ❌ ${check.name}: 不可用 - ${error.message}`);
          throw new Error(`Required endpoint ${check.name} is not available: ${error.message}`);
        } else {
          console.log(`   ⚠️  ${check.name}: 不可用，将跳过相关测试`);
        }
      }
    }
    
    console.log('');
  }

  async runTestSuite(suiteKey, suite) {
    console.log(`📋 运行测试套件: ${suite.name}`);
    console.log(`   ${suite.description}`);
    
    const suiteResults = {
      name: suite.name,
      startTime: Date.now(),
      tests: [],
      metrics: {},
      passed: 0,
      failed: 0
    };

    try {
      switch (suiteKey) {
        case 'basic':
          await this.runBasicTest(suite, suiteResults);
          break;
        case 'toolCalling':
          await this.runToolCallingTest(suite, suiteResults);
          break;
        case 'multiTurn':
          await this.runMultiTurnTest(suite, suiteResults);
          break;
        case 'errorRecovery':
          await this.runErrorRecoveryTest(suite, suiteResults);
          break;
        case 'performance':
          await this.runPerformanceTest(suite, suiteResults);
          break;
        default:
          console.log(`   ⚠️  未知测试套件: ${suiteKey}`);
      }

    } catch (error) {
      suiteResults.failed++;
      suiteResults.tests.push({
        name: `${suiteKey}-suite-error`,
        passed: false,
        error: error.message,
        duration: Date.now() - suiteResults.startTime
      });
    }

    suiteResults.endTime = Date.now();
    suiteResults.duration = suiteResults.endTime - suiteResults.startTime;
    this.results.suites[suiteKey] = suiteResults;
    
    // 更新总体统计
    this.results.overall.total += suiteResults.tests.length;
    this.results.overall.passed += suiteResults.passed;
    this.results.overall.failed += suiteResults.failed;
    
    const passRate = suiteResults.tests.length > 0 ? 
      (suiteResults.passed / suiteResults.tests.length * 100).toFixed(1) : '0.0';
    
    console.log(`   📊 套件结果: ${suiteResults.passed}通过/${suiteResults.failed}失败 (${passRate}%) - ${suiteResults.duration}ms\n`);
  }

  async runBasicTest(suite, suiteResults) {
    const testName = 'basic-text-generation';
    console.log(`     执行: ${testName}`);
    
    const startTime = Date.now();
    
    try {
      // 发送请求到Gemini直连端口
      const response = await this.sendRequest(
        E2E_TEST_CONFIG.endpoints.geminiDirect + '/v1/messages',
        suite.request
      );
      
      const duration = Date.now() - startTime;
      
      // 验证响应
      const validation = this.validateBasicResponse(response, suite.validation, duration);
      
      suiteResults.tests.push({
        name: testName,
        passed: validation.passed,
        duration,
        response: response.data,
        validation: validation,
        error: validation.passed ? null : validation.errors.join(', ')
      });
      
      if (validation.passed) {
        suiteResults.passed++;
        console.log(`       ✅ ${testName}: 通过 (${duration}ms)`);
      } else {
        suiteResults.failed++;
        console.log(`       ❌ ${testName}: 失败 - ${validation.errors.join(', ')}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      suiteResults.failed++;
      suiteResults.tests.push({
        name: testName,
        passed: false,
        duration,
        error: error.message
      });
      console.log(`       ❌ ${testName}: 异常 - ${error.message}`);
    }
  }

  async runToolCallingTest(suite, suiteResults) {
    const testName = 'tool-calling-workflow';
    console.log(`     执行: ${testName}`);
    
    const startTime = Date.now();
    
    try {
      const response = await this.sendRequest(
        E2E_TEST_CONFIG.endpoints.geminiDirect + '/v1/messages',
        suite.request
      );
      
      const duration = Date.now() - startTime;
      
      // 验证工具调用
      const validation = this.validateToolCallingResponse(response, suite.validation, duration);
      
      suiteResults.tests.push({
        name: testName,
        passed: validation.passed,
        duration,
        response: response.data,
        validation: validation,
        error: validation.passed ? null : validation.errors.join(', ')
      });
      
      if (validation.passed) {
        suiteResults.passed++;
        console.log(`       ✅ ${testName}: 通过 (${duration}ms)`);
        console.log(`         🔧 工具调用检测成功: ${validation.toolCallDetails.name}`);
      } else {
        suiteResults.failed++;
        console.log(`       ❌ ${testName}: 失败 - ${validation.errors.join(', ')}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      suiteResults.failed++;
      suiteResults.tests.push({
        name: testName,
        passed: false,
        duration,
        error: error.message
      });
      console.log(`       ❌ ${testName}: 异常 - ${error.message}`);
    }
  }

  async runMultiTurnTest(suite, suiteResults) {
    const testName = 'multi-turn-conversation';
    console.log(`     执行: ${testName}`);
    
    const overallStartTime = Date.now();
    let allPassed = true;
    const responses = [];
    
    try {
      for (let i = 0; i < suite.requests.length; i++) {
        const request = suite.requests[i];
        const turnStartTime = Date.now();
        
        console.log(`       第 ${i + 1} 轮对话...`);
        
        const response = await this.sendRequest(
          E2E_TEST_CONFIG.endpoints.geminiDirect + '/v1/messages',
          request
        );
        
        const turnDuration = Date.now() - turnStartTime;
        responses.push({
          turn: i + 1,
          duration: turnDuration,
          response: response.data
        });
        
        console.log(`         ⏱️  第 ${i + 1} 轮: ${turnDuration}ms`);
      }
      
      const totalDuration = Date.now() - overallStartTime;
      
      // 验证多轮对话结果
      const validation = this.validateMultiTurnResponse(responses, suite.validation, totalDuration);
      
      suiteResults.tests.push({
        name: testName,
        passed: validation.passed,
        duration: totalDuration,
        responses: responses,
        validation: validation,
        error: validation.passed ? null : validation.errors.join(', ')
      });
      
      if (validation.passed) {
        suiteResults.passed++;
        console.log(`       ✅ ${testName}: 通过 (总计 ${totalDuration}ms)`);
      } else {
        suiteResults.failed++;
        console.log(`       ❌ ${testName}: 失败 - ${validation.errors.join(', ')}`);
      }
      
    } catch (error) {
      const totalDuration = Date.now() - overallStartTime;
      suiteResults.failed++;
      suiteResults.tests.push({
        name: testName,
        passed: false,
        duration: totalDuration,
        error: error.message
      });
      console.log(`       ❌ ${testName}: 异常 - ${error.message}`);
    }
  }

  async runErrorRecoveryTest(suite, suiteResults) {
    const testName = 'error-recovery-resilience';
    console.log(`     执行: ${testName}`);
    
    const startTime = Date.now();
    const errorResults = [];
    
    for (let i = 0; i < suite.requests.length; i++) {
      const request = suite.requests[i];
      console.log(`       错误测试 ${i + 1}: ${request.model || 'unknown-model'}`);
      
      try {
        const response = await this.sendRequest(
          E2E_TEST_CONFIG.endpoints.geminiDirect + '/v1/messages',
          request
        );
        
        errorResults.push({
          requestIndex: i,
          success: true,
          response: response.data
        });
        console.log(`         ✅ 意外成功 (可能是错误恢复)`);
        
      } catch (error) {
        errorResults.push({
          requestIndex: i,
          success: false,
          error: error.message,
          status: error.response?.status
        });
        console.log(`         ❌ 预期错误: ${error.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // 验证错误恢复
    const validation = this.validateErrorRecovery(errorResults, suite.validation);
    
    suiteResults.tests.push({
      name: testName,
      passed: validation.passed,
      duration,
      errorResults: errorResults,
      validation: validation,
      error: validation.passed ? null : validation.errors.join(', ')
    });
    
    if (validation.passed) {
      suiteResults.passed++;
      console.log(`       ✅ ${testName}: 通过 - 错误处理正常`);
    } else {
      suiteResults.failed++;
      console.log(`       ❌ ${testName}: 失败 - ${validation.errors.join(', ')}`);
    }
  }

  async runPerformanceTest(suite, suiteResults) {
    const testName = 'performance-stress-test';
    console.log(`     执行: ${testName}`);
    console.log(`       并发数: ${suite.validation.concurrentRequests}, 总请求数: ${suite.validation.totalRequests}`);
    
    const startTime = Date.now();
    const results = [];
    
    try {
      // 分批执行并发请求
      const batchSize = suite.validation.concurrentRequests;
      const totalRequests = suite.validation.totalRequests;
      
      for (let batchStart = 0; batchStart < totalRequests; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalRequests);
        const batchRequests = [];
        
        console.log(`       执行批次: ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(totalRequests / batchSize)}`);
        
        // 创建并发请求
        for (let i = batchStart; i < batchEnd; i++) {
          batchRequests.push(
            this.sendRequest(
              E2E_TEST_CONFIG.endpoints.geminiDirect + '/v1/messages',
              suite.request
            ).then(response => ({
              index: i,
              success: true,
              duration: Date.now(),
              response: response.data
            })).catch(error => ({
              index: i,
              success: false,
              duration: Date.now(),
              error: error.message
            }))
          );
        }
        
        // 等待批次完成
        const batchResults = await Promise.all(batchRequests);
        results.push(...batchResults);
        
        // 批次间短暂延迟
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const totalDuration = Date.now() - startTime;
      
      // 计算性能指标
      const validation = this.validatePerformanceResults(results, suite.validation, totalDuration);
      
      suiteResults.tests.push({
        name: testName,
        passed: validation.passed,
        duration: totalDuration,
        results: results,
        validation: validation,
        metrics: validation.metrics,
        error: validation.passed ? null : validation.errors.join(', ')
      });
      
      if (validation.passed) {
        suiteResults.passed++;
        console.log(`       ✅ ${testName}: 通过`);
        console.log(`         📊 成功率: ${validation.metrics.successRate}%`);
        console.log(`         ⏱️  平均响应: ${validation.metrics.averageResponseTime}ms`);
      } else {
        suiteResults.failed++;
        console.log(`       ❌ ${testName}: 失败 - ${validation.errors.join(', ')}`);
      }
      
      // 保存性能数据
      this.results.performance[testName] = validation.metrics;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      suiteResults.failed++;
      suiteResults.tests.push({
        name: testName,
        passed: false,
        duration,
        error: error.message
      });
      console.log(`       ❌ ${testName}: 异常 - ${error.message}`);
    }
  }

  // ==================== 验证方法 ====================

  validateBasicResponse(response, validation, duration) {
    const errors = [];
    let passed = true;
    
    // 检查响应时间
    if (duration > validation.maxResponseTime) {
      errors.push(`Response time ${duration}ms exceeds limit ${validation.maxResponseTime}ms`);
      passed = false;
    }
    
    // 检查响应结构
    if (!response.data || !response.data.content) {
      errors.push('Missing content in response');
      passed = false;
    }
    
    // 检查内容匹配
    if (response.data.content && validation.expectedContent) {
      const contentText = this.extractTextFromContent(response.data.content);
      if (!contentText.includes(validation.expectedContent)) {
        errors.push(`Content does not include expected text: "${validation.expectedContent}"`);
        passed = false;
      }
    }
    
    // 检查最小token数
    if (response.data.usage && response.data.usage.output_tokens < validation.minTokens) {
      errors.push(`Output tokens ${response.data.usage.output_tokens} below minimum ${validation.minTokens}`);
      passed = false;
    }
    
    return {
      passed,
      errors,
      contentText: response.data.content ? this.extractTextFromContent(response.data.content) : '',
      responseTime: duration
    };
  }

  validateToolCallingResponse(response, validation, duration) {
    const errors = [];
    let passed = true;
    let toolCallDetails = null;
    
    // 检查响应时间
    if (duration > validation.maxResponseTime) {
      errors.push(`Response time ${duration}ms exceeds limit ${validation.maxResponseTime}ms`);
      passed = false;
    }
    
    // 检查工具调用
    if (validation.expectToolCall) {
      const toolCalls = this.extractToolCallsFromContent(response.data.content);
      
      if (toolCalls.length === 0) {
        errors.push('Expected tool call but none found');
        passed = false;
      } else {
        const toolCall = toolCalls[0];
        toolCallDetails = {
          name: toolCall.name,
          input: toolCall.input
        };
        
        // 验证工具名称
        if (validation.expectedToolName && toolCall.name !== validation.expectedToolName) {
          errors.push(`Expected tool ${validation.expectedToolName}, got ${toolCall.name}`);
          passed = false;
        }
        
        // 验证工具参数
        if (validation.expectedToolArgs) {
          for (const [key, expectedValue] of Object.entries(validation.expectedToolArgs)) {
            if (!toolCall.input || toolCall.input[key] !== expectedValue) {
              errors.push(`Expected tool arg ${key}=${expectedValue}, got ${toolCall.input?.[key]}`);
              passed = false;
            }
          }
        }
      }
    }
    
    return {
      passed,
      errors,
      toolCallDetails,
      responseTime: duration
    };
  }

  validateMultiTurnResponse(responses, validation, totalDuration) {
    const errors = [];
    let passed = true;
    
    // 检查总时间
    if (totalDuration > validation.maxTotalTime) {
      errors.push(`Total time ${totalDuration}ms exceeds limit ${validation.maxTotalTime}ms`);
      passed = false;
    }
    
    // 检查序列响应
    if (validation.expectSequential && responses.length < 2) {
      errors.push('Expected at least 2 responses for sequential test');
      passed = false;
    }
    
    // 检查最终结果
    if (validation.expectedFinalResult && responses.length > 0) {
      const lastResponse = responses[responses.length - 1];
      const finalText = this.extractTextFromContent(lastResponse.response.content);
      
      if (!finalText.includes(validation.expectedFinalResult)) {
        errors.push(`Final result does not include expected "${validation.expectedFinalResult}"`);
        passed = false;
      }
    }
    
    return {
      passed,
      errors,
      totalTime: totalDuration,
      turnCount: responses.length
    };
  }

  validateErrorRecovery(errorResults, validation) {
    const errors = [];
    let passed = true;
    
    const errorCount = errorResults.filter(r => !r.success).length;
    const successCount = errorResults.filter(r => r.success).length;
    
    // 检查是否有预期的错误
    if (validation.expectErrors && errorCount === 0) {
      errors.push('Expected errors but all requests succeeded');
      passed = false;
    }
    
    // 检查错误恢复
    if (validation.errorRecoveryRequired && successCount === 0) {
      errors.push('Expected some requests to succeed after errors');
      passed = false;
    }
    
    // 检查错误数量限制
    if (validation.maxErrorCount && errorCount > validation.maxErrorCount) {
      errors.push(`Error count ${errorCount} exceeds limit ${validation.maxErrorCount}`);
      passed = false;
    }
    
    return {
      passed,
      errors,
      errorCount,
      successCount,
      totalRequests: errorResults.length
    };
  }

  validatePerformanceResults(results, validation, totalDuration) {
    const errors = [];
    let passed = true;
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const successRate = (successCount / results.length) * 100;
    
    // 计算平均响应时间
    const successResults = results.filter(r => r.success);
    const averageResponseTime = successResults.length > 0 ?
      successResults.reduce((sum, r) => sum + (r.duration || 0), 0) / successResults.length : 0;
    
    // 检查成功率
    if (successRate < validation.minSuccessRate) {
      errors.push(`Success rate ${successRate.toFixed(1)}% below minimum ${validation.minSuccessRate}%`);
      passed = false;
    }
    
    // 检查平均响应时间
    if (averageResponseTime > validation.maxAverageResponseTime) {
      errors.push(`Average response time ${averageResponseTime.toFixed(0)}ms exceeds limit ${validation.maxAverageResponseTime}ms`);
      passed = false;
    }
    
    const metrics = {
      totalRequests: results.length,
      successCount,
      failureCount,
      successRate: parseFloat(successRate.toFixed(1)),
      averageResponseTime: parseFloat(averageResponseTime.toFixed(1)),
      totalDuration,
      throughput: parseFloat((results.length / totalDuration * 1000).toFixed(2)) // requests per second
    };
    
    return {
      passed,
      errors,
      metrics
    };
  }

  // ==================== 工具方法 ====================

  async sendRequest(url, requestData) {
    const requestConfig = {
      method: 'POST',
      url: url,
      data: requestData,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    return await this.axiosClient.request(requestConfig);
  }

  extractTextFromContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(' ');
    }
    
    return '';
  }

  extractToolCallsFromContent(content) {
    if (!Array.isArray(content)) return [];
    
    return content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name,
        input: block.input
      }));
  }

  async collectMetricsAndAnalyze() {
    console.log('📊 收集测试数据和性能指标...');
    
    // 收集模块覆盖率
    this.results.coverage.modules = [
      'GeminiClientRouter',
      'GeminiInputTransformer',
      'GeminiRequestPreprocessor', 
      'GeminiProviderInterface',
      'GeminiThirdPartyServer'
    ];
    
    // 收集错误类型
    const errorTypes = new Set();
    Object.values(this.results.suites).forEach(suite => {
      suite.tests.forEach(test => {
        if (test.error) {
          errorTypes.add(test.error.split(' ')[0]);
        }
      });
    });
    this.results.coverage.errorCases = Array.from(errorTypes);
    
    // 计算总体性能
    const allDurations = [];
    Object.values(this.results.suites).forEach(suite => {
      suite.tests.forEach(test => {
        if (test.duration && test.passed) {
          allDurations.push(test.duration);
        }
      });
    });
    
    if (allDurations.length > 0) {
      this.results.performance.overall = {
        averageResponseTime: allDurations.reduce((a, b) => a + b, 0) / allDurations.length,
        minResponseTime: Math.min(...allDurations),
        maxResponseTime: Math.max(...allDurations),
        totalTests: allDurations.length
      };
    }
    
    console.log('   ✅ 数据收集完成');
  }

  generateE2EReport() {
    const totalDuration = Date.now() - this.results.startTime;
    const successRate = this.results.overall.total > 0 ? 
      (this.results.overall.passed / this.results.overall.total * 100).toFixed(1) : '0.0';
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Gemini标准流水线端到端测试报告');
    console.log('='.repeat(80));
    
    console.log(`📊 总体结果:`);
    console.log(`   • 测试套件: ${Object.keys(this.results.suites).length}`);
    console.log(`   • 总测试数: ${this.results.overall.total}`);
    console.log(`   • 通过: ${this.results.overall.passed} (${successRate}%)`);
    console.log(`   • 失败: ${this.results.overall.failed}`);
    console.log(`   • 总耗时: ${totalDuration}ms`);
    
    console.log(`\n📋 套件详情:`);
    Object.entries(this.results.suites).forEach(([key, suite]) => {
      const suiteSuccessRate = suite.tests.length > 0 ? 
        (suite.passed / suite.tests.length * 100).toFixed(1) : '0.0';
      console.log(`   • ${suite.name}: ${suite.passed}通过/${suite.failed}失败 (${suiteSuccessRate}%) - ${suite.duration}ms`);
    });
    
    if (this.results.performance.overall) {
      console.log(`\n⚡ 整体性能:`);
      const perf = this.results.performance.overall;
      console.log(`   • 平均响应时间: ${perf.averageResponseTime.toFixed(1)}ms`);
      console.log(`   • 响应时间范围: ${perf.minResponseTime}-${perf.maxResponseTime}ms`);
      console.log(`   • 有效测试数: ${perf.totalTests}`);
    }
    
    if (Object.keys(this.results.performance).length > 1) {
      console.log(`\n📈 专项性能:`);
      Object.entries(this.results.performance).forEach(([test, metrics]) => {
        if (test !== 'overall' && typeof metrics === 'object' && 'successRate' in metrics) {
          console.log(`   • ${test}:`);
          console.log(`     - 成功率: ${metrics.successRate}%`);
          console.log(`     - 平均响应: ${metrics.averageResponseTime}ms`);
          console.log(`     - 吞吐量: ${metrics.throughput} req/s`);
        }
      });
    }
    
    console.log(`\n🧪 测试覆盖:`);
    console.log(`   • 模块数: ${this.results.coverage.modules.length}`);
    console.log(`   • 端点数: ${this.results.coverage.endpoints.length}`);
    console.log(`   • 错误场景: ${this.results.coverage.errorCases.length}`);
    
    if (this.results.overall.errors.length > 0) {
      console.log(`\n❌ 关键错误:`);
      this.results.overall.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    console.log(`\n🎯 结论:`);
    if (parseFloat(successRate) >= 95) {
      console.log('   ✅ 端到端测试表现优秀，流水线架构稳定可靠');
    } else if (parseFloat(successRate) >= 80) {
      console.log('   ⚠️  端到端测试表现良好，部分功能需要优化');
    } else {
      console.log('   ❌ 端到端测试表现不佳，架构需要重大改进');
    }
    
    if (this.results.performance.overall && this.results.performance.overall.averageResponseTime < 3000) {
      console.log('   ⚡ 响应性能优秀');
    } else if (this.results.performance.overall && this.results.performance.overall.averageResponseTime < 8000) {
      console.log('   ⚡ 响应性能良好');
    } else {
      console.log('   ⚠️  响应性能需要优化');
    }
    
    console.log(`\n📝 详细日志: ${E2E_TEST_CONFIG.logFile}`);
    console.log('='.repeat(80));
    
    // 保存详细报告到日志
    this.logToFile('\n=== E2E Test Report ===');
    this.logToFile(`Total: ${this.results.overall.total}, Passed: ${this.results.overall.passed}, Failed: ${this.results.overall.failed}`);
    this.logToFile(`Success Rate: ${successRate}%, Duration: ${totalDuration}ms`);
    
    if (this.results.performance.overall) {
      this.logToFile(`Average Response Time: ${this.results.performance.overall.averageResponseTime.toFixed(1)}ms`);
    }
    
    this.logToFile('\n=== Suite Details ===');
    Object.entries(this.results.suites).forEach(([key, suite]) => {
      this.logToFile(`${key}: ${suite.passed} passed, ${suite.failed} failed, ${suite.duration}ms`);
      suite.tests.forEach(test => {
        this.logToFile(`  - ${test.name}: ${test.passed ? 'PASS' : 'FAIL'} (${test.duration}ms)${test.error ? ' - ' + test.error : ''}`);
      });
    });
  }

  logToFile(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(E2E_TEST_CONFIG.logFile, logEntry);
    } catch (error) {
      console.warn(`Failed to write to log file: ${error.message}`);
    }
  }
}

// 执行端到端测试
async function runGeminiE2ETests() {
  const runner = new GeminiE2ETestRunner();
  
  try {
    const results = await runner.runAllTests();
    return results;
  } catch (error) {
    console.error('E2E测试执行失败:', error);
    return {
      overall: { total: 0, passed: 0, failed: 1 },
      error: error.message
    };
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runGeminiE2ETests()
    .then(results => {
      const success = results.overall.passed > 0 && results.overall.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('E2E test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runGeminiE2ETests,
  GeminiE2ETestRunner,
  E2E_TEST_CONFIG
};