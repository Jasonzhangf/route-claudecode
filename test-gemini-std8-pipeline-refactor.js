#!/usr/bin/env node

/**
 * Gemini STD-8-STEP-PIPELINE 重构验证测试
 * 验证Gemini Provider模块化重构和运行时流水线注册
 * 
 * 测试目标:
 * 1. 模块化组件功能验证
 * 2. 内容驱动stop_reason修复验证  
 * 3. 运行时流水线步骤注册验证
 * 4. 工具调用支持验证
 * 5. OpenAI成功模式采用验证
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5502',
  timeout: 30000,
  outputDir: '/tmp',
  testId: `gemini-std8-pipeline-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
};

// 日志工具
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    testId: TEST_CONFIG.testId,
    ...data
  };
  
  console.log(`[${level.toUpperCase()}] ${message}`, Object.keys(data).length > 0 ? data : '');
  
  // 保存到文件
  const logFile = path.join(TEST_CONFIG.outputDir, `${TEST_CONFIG.testId}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

// HTTP请求工具
async function makeRequest(endpoint, data, options = {}) {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  const requestId = `req-${Date.now()}`;
  
  log('debug', `Making request to ${endpoint}`, {
    requestId,
    method: 'POST',
    hasData: !!data
  });

  try {
    const response = await axios.post(url, data, {
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...options.headers
      },
      ...options
    });

    log('debug', `Request completed successfully`, {
      requestId,
      status: response.status,
      dataLength: JSON.stringify(response.data).length
    });

    return {
      success: true,
      data: response.data,
      status: response.status,
      requestId
    };

  } catch (error) {
    const errorInfo = {
      requestId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };

    log('error', `Request failed`, errorInfo);

    return {
      success: false,
      error: errorInfo,
      requestId
    };
  }
}

// 测试用例
const TEST_CASES = [
  {
    name: 'test-1-basic-text-response',
    description: '基础文本响应测试 - 验证模块化架构基本功能',
    request: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a simple greeting.'
        }
      ],
      max_tokens: 100
    },
    expectations: {
      responseType: 'text_only',
      stopReason: 'end_turn',
      hasContent: true,
      contentType: 'text'
    }
  },

  {
    name: 'test-2-openai-format-tool-call',
    description: 'OpenAI格式工具调用测试 - 验证内容驱动stop_reason修复',
    request: {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'What is the weather like in Tokyo today?'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather information for a city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'The city name'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'Temperature unit'
                }
              },
              required: ['city']
            }
          }
        }
      ],
      max_tokens: 200
    },
    expectations: {
      responseType: 'tool_call',
      stopReason: 'tool_use',
      hasContent: true,
      hasToolUse: true,
      toolName: 'get_weather'
    }
  },

  {
    name: 'test-3-anthropic-format-tool-call', 
    description: 'Anthropic格式工具调用测试 - 验证双格式工具支持',
    request: {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'Please search for information about artificial intelligence trends.'
        }
      ],
      tools: [
        {
          name: 'web_search',
          description: 'Search for information on the web',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of results',
                default: 5
              }
            },
            required: ['query']
          }
        }
      ],
      max_tokens: 300
    },
    expectations: {
      responseType: 'tool_call',
      stopReason: 'tool_use',
      hasContent: true,
      hasToolUse: true,
      toolName: 'web_search'
    }
  },

  {
    name: 'test-4-streaming-response',
    description: '流式响应测试 - 验证模块化流式模拟器',
    request: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Please write a short paragraph about machine learning.'
        }
      ],
      max_tokens: 150,
      stream: true
    },
    expectations: {
      isStreaming: true,
      hasMessageStart: true,
      hasContentBlocks: true,
      hasMessageStop: true,
      finalStopReason: 'end_turn'
    },
    streaming: true
  }
];

// 验证响应格式
function validateResponse(response, expectations, testName) {
  const results = [];
  
  try {
    // 基础响应验证
    if (expectations.hasContent) {
      const hasContent = response.content && Array.isArray(response.content) && response.content.length > 0;
      results.push({
        check: 'has_content',
        expected: true,
        actual: hasContent,
        passed: hasContent
      });
    }

    // stop_reason验证
    if (expectations.stopReason) {
      const stopReasonMatch = response.stop_reason === expectations.stopReason;
      results.push({
        check: 'stop_reason',
        expected: expectations.stopReason,
        actual: response.stop_reason,
        passed: stopReasonMatch
      });
    }

    // 工具调用验证
    if (expectations.hasToolUse) {
      const hasToolUse = response.content.some(block => block.type === 'tool_use');
      results.push({
        check: 'has_tool_use',
        expected: true,
        actual: hasToolUse,
        passed: hasToolUse
      });

      if (hasToolUse && expectations.toolName) {
        const toolBlock = response.content.find(block => block.type === 'tool_use');
        const correctToolName = toolBlock && toolBlock.name === expectations.toolName;
        results.push({
          check: 'tool_name',
          expected: expectations.toolName,
          actual: toolBlock?.name || 'none',
          passed: correctToolName
        });
      }
    }

    // 响应类型验证
    if (expectations.responseType === 'text_only') {
      const isTextOnly = response.content.every(block => block.type === 'text');
      results.push({
        check: 'text_only_response',
        expected: true,
        actual: isTextOnly,
        passed: isTextOnly
      });
    }

    if (expectations.responseType === 'tool_call') {
      const hasToolCall = response.content.some(block => block.type === 'tool_use');
      results.push({
        check: 'tool_call_response',
        expected: true,
        actual: hasToolCall,
        passed: hasToolCall
      });
    }

  } catch (error) {
    results.push({
      check: 'validation_error',
      expected: 'no_error',
      actual: error.message,
      passed: false
    });
  }

  return results;
}

// 验证流式响应
async function validateStreamingResponse(response, expectations, testName) {
  return new Promise((resolve) => {
    const results = [];
    const events = [];
    let hasMessageStart = false;
    let hasContentBlocks = false;  
    let hasMessageStop = false;
    let finalStopReason = null;

    // 处理流式数据
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            events.push(data);
            
            if (data.type === 'message_start') {
              hasMessageStart = true;
            } else if (data.type === 'content_block_start' || data.type === 'content_block_delta') {
              hasContentBlocks = true;
            } else if (data.type === 'message_stop') {
              hasMessageStop = true;
              finalStopReason = data.stop_reason;
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }
    });

    response.data.on('end', () => {
      // 验证流式事件
      results.push({
        check: 'has_message_start',
        expected: expectations.hasMessageStart,
        actual: hasMessageStart,
        passed: hasMessageStart === expectations.hasMessageStart
      });

      results.push({
        check: 'has_content_blocks', 
        expected: expectations.hasContentBlocks,
        actual: hasContentBlocks,
        passed: hasContentBlocks === expectations.hasContentBlocks
      });

      results.push({
        check: 'has_message_stop',
        expected: expectations.hasMessageStop, 
        actual: hasMessageStop,
        passed: hasMessageStop === expectations.hasMessageStop
      });

      if (expectations.finalStopReason) {
        results.push({
          check: 'final_stop_reason',
          expected: expectations.finalStopReason,
          actual: finalStopReason,
          passed: finalStopReason === expectations.finalStopReason
        });
      }

      resolve({
        results,
        events,
        eventCount: events.length
      });
    });

    response.data.on('error', (error) => {
      results.push({
        check: 'streaming_error',
        expected: 'no_error',
        actual: error.message,
        passed: false
      });
      resolve({ results, events: [] });
    });
  });
}

// 执行单个测试
async function runTest(testCase) {
  log('info', `Starting test: ${testCase.name}`, {
    description: testCase.description
  });

  const startTime = Date.now();
  
  try {
    let result;
    
    if (testCase.streaming) {
      // 流式请求
      result = await makeRequest('/v1/messages', testCase.request, {
        responseType: 'stream'
      });
    } else {
      // 普通请求
      result = await makeRequest('/v1/messages', testCase.request);
    }

    if (!result.success) {
      return {
        testName: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        error: result.error,
        validationResults: []
      };
    }

    let validationResults;
    let additionalData = {};

    if (testCase.streaming) {
      const streamingValidation = await validateStreamingResponse(result, testCase.expectations, testCase.name);
      validationResults = streamingValidation.results;
      additionalData = {
        eventCount: streamingValidation.eventCount,
        events: streamingValidation.events.slice(0, 5) // 只记录前5个事件
      };
    } else {
      validationResults = validateResponse(result.data, testCase.expectations, testCase.name);
    }

    const allPassed = validationResults.every(r => r.passed);
    const duration = Date.now() - startTime;

    log('info', `Test ${testCase.name} ${allPassed ? 'PASSED' : 'FAILED'}`, {
      duration,
      validationCount: validationResults.length,
      passedCount: validationResults.filter(r => r.passed).length,
      ...additionalData
    });

    // 保存详细结果
    const detailFile = path.join(TEST_CONFIG.outputDir, `${testCase.name}-${TEST_CONFIG.testId}.json`);
    fs.writeFileSync(detailFile, JSON.stringify({
      testName: testCase.name,
      passed: allPassed,
      duration,
      request: testCase.request,
      response: testCase.streaming ? { type: 'streaming', ...additionalData } : result.data,
      validationResults,
      expectations: testCase.expectations
    }, null, 2));

    return {
      testName: testCase.name,
      passed: allPassed,
      duration,
      validationResults,
      additionalData
    };

  } catch (error) {
    log('error', `Test ${testCase.name} encountered unexpected error`, {
      error: error.message,
      duration: Date.now() - startTime
    });

    return {
      testName: testCase.name,
      passed: false,
      duration: Date.now() - startTime,
      error: error.message,
      validationResults: []
    };
  }
}

// 主测试执行
async function runAllTests() {
  log('info', 'Starting Gemini STD-8-STEP-PIPELINE Refactor Validation', {
    testCount: TEST_CASES.length,
    baseUrl: TEST_CONFIG.baseUrl,
    testId: TEST_CONFIG.testId
  });

  // 检查服务健康状态
  log('info', 'Checking service health...');
  const healthResult = await makeRequest('/health');
  
  if (!healthResult.success) {
    log('error', 'Service health check failed', healthResult.error);
    process.exit(1);
  }

  log('info', 'Service health check passed', healthResult.data);

  const results = [];
  let passed = 0;
  let failed = 0;

  // 执行所有测试
  for (const testCase of TEST_CASES) {
    const result = await runTest(testCase);
    results.push(result);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }

    // 测试间延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 生成总结报告
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const summary = {
    testId: TEST_CONFIG.testId,
    timestamp: new Date().toISOString(),
    summary: {
      total: TEST_CASES.length,
      passed,
      failed,
      successRate: `${(passed / TEST_CASES.length * 100).toFixed(1)}%`,
      totalDuration: `${totalDuration}ms`,
      averageDuration: `${Math.round(totalDuration / TEST_CASES.length)}ms`
    },
    results: results.map(r => ({
      testName: r.testName,
      passed: r.passed,
      duration: r.duration,
      validationCount: r.validationResults?.length || 0,
      error: r.error || null
    }))
  };

  // 保存总结报告
  const summaryFile = path.join(TEST_CONFIG.outputDir, `${TEST_CONFIG.testId}-summary.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  // 打印最终结果
  console.log('\\n' + '='.repeat(80));
  console.log('🧪 GEMINI STD-8-STEP-PIPELINE REFACTOR VALIDATION RESULTS');
  console.log('='.repeat(80));
  console.log(`📊 Total Tests: ${summary.summary.total}`);
  console.log(`✅ Passed: ${summary.summary.passed}`);
  console.log(`❌ Failed: ${summary.summary.failed}`);
  console.log(`📈 Success Rate: ${summary.summary.successRate}`);
  console.log(`⏱️  Total Duration: ${summary.summary.totalDuration}`);
  console.log(`📁 Test ID: ${TEST_CONFIG.testId}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.log('\\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testName}: ${r.error || 'Validation failed'}`);
    });
  }

  console.log(`\\n📋 Detailed logs: ${TEST_CONFIG.outputDir}/${TEST_CONFIG.testId}*`);
  console.log(`📄 Summary report: ${summaryFile}`);

  // 返回适当的退出码
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});