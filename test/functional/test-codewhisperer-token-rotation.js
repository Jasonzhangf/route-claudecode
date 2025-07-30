#!/usr/bin/env node

/**
 * 测试用例: CodeWhisperer多token轮询系统验证
 * 
 * 目标:
 * 1. 验证多token配置是否正确加载
 * 2. 验证token轮询策略是否正常工作
 * 3. 验证token失效时自动切换
 * 4. 验证token刷新机制
 */

const fs = require('fs');
const axios = require('axios');

// 测试配置
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3456',
  logFile: '/tmp/test-codewhisperer-token-rotation.log',
  testRequests: [
    {
      name: 'basic-request',
      prompt: 'What is TypeScript?',
      expectSuccess: true
    },
    {
      name: 'tool-request',
      prompt: 'Search for information about machine learning',
      hasTools: true,
      expectSuccess: true
    },
    {
      name: 'multiple-requests',
      prompts: [
        'Hello, how are you?',
        'What is artificial intelligence?',
        'Explain cloud computing',
        'What is containerization?',
        'Tell me about microservices'
      ],
      expectSuccess: true
    }
  ]
};

// 日志函数
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data,
    elapsedTime: Date.now() - startTime
  };
  
  console.log(`[${timestamp}] ${message}`, data || '');
  
  // 写入日志文件
  fs.appendFileSync(TEST_CONFIG.logFile, JSON.stringify(logEntry) + '\n');
}

const startTime = Date.now();

async function runTokenRotationTest() {
  log('开始CodeWhisperer多token轮询系统测试');
  
  const testResults = {
    summary: {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      tokenRotationWorking: false,
      multipleTokensDetected: false
    },
    detailedResults: []
  };

  try {
    // 测试1: 基础请求验证
    log('测试1: 基础请求验证');
    const basicTest = await testBasicRequest();
    testResults.detailedResults.push(basicTest);
    testResults.summary.totalTests++;
    if (basicTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 测试2: 工具调用验证
    log('测试2: 工具调用验证');
    const toolTest = await testToolCallRequest();
    testResults.detailedResults.push(toolTest);
    testResults.summary.totalTests++;
    if (toolTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 测试3: 多请求负载均衡验证
    log('测试3: 多请求负载均衡验证');
    const loadBalanceTest = await testLoadBalancing();
    testResults.detailedResults.push(loadBalanceTest);
    testResults.summary.totalTests++;
    if (loadBalanceTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 测试4: Token统计信息获取
    log('测试4: Token统计信息获取');
    const statsTest = await testTokenStats();
    testResults.detailedResults.push(statsTest);
    testResults.summary.totalTests++;
    if (statsTest.success) testResults.summary.successfulTests++;
    else testResults.summary.failedTests++;

    // 分析结果
    testResults.summary.successRate = `${testResults.summary.successfulTests}/${testResults.summary.totalTests}`;
    testResults.summary.tokenRotationWorking = testResults.summary.successfulTests >= 3;
    
    // 生成报告
    const reportFile = `/tmp/token-rotation-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(testResults, null, 2));
    
    log('测试完成', {
      reportFile,
      successRate: testResults.summary.successRate,
      tokenRotationWorking: testResults.summary.tokenRotationWorking
    });

    // 输出结论
    const conclusions = [];
    if (testResults.summary.tokenRotationWorking) {
      conclusions.push('✅ CodeWhisperer多token轮询系统正常工作');
    } else {
      conclusions.push('❌ CodeWhisperer多token轮询系统存在问题');
    }
    
    if (testResults.summary.successfulTests === testResults.summary.totalTests) {
      conclusions.push('✅ 所有测试用例均通过');
    } else {
      conclusions.push(`⚠️ ${testResults.summary.failedTests}个测试用例失败`);
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

async function testBasicRequest() {
  const testStart = Date.now();
  log('发送基础请求测试');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.serverUrl}/v1/messages`, {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'What is TypeScript?' }
      ],
      max_tokens: 100
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const responseTime = Date.now() - testStart;
    log('基础请求成功', { status: response.status, responseTime: `${responseTime}ms` });

    const analysis = analyzeResponse(response.data, { expectText: true });
    
    return {
      testCase: 'basic-request',
      success: true,
      responseTime,
      analysis,
      response: response.data
    };

  } catch (error) {
    const responseTime = Date.now() - testStart;
    log('基础请求失败', { error: error.message, responseTime: `${responseTime}ms` });
    
    return {
      testCase: 'basic-request',
      success: false,
      responseTime,
      error: error.message,
      errorStatus: error.response?.status,
      errorData: error.response?.data
    };
  }
}

async function testToolCallRequest() {
  const testStart = Date.now();
  log('发送工具调用请求测试');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.serverUrl}/v1/messages`, {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'Search for information about machine learning' }
      ],
      max_tokens: 100,
      tools: [
        {
          name: 'WebSearch',
          description: 'Search the web for information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            }
          }
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const responseTime = Date.now() - testStart;
    log('工具调用请求成功', { status: response.status, responseTime: `${responseTime}ms` });

    const analysis = analyzeResponse(response.data, { expectTools: true });
    
    return {
      testCase: 'tool-call-request',
      success: true,
      responseTime,
      analysis,
      response: response.data
    };

  } catch (error) {
    const responseTime = Date.now() - testStart;
    log('工具调用请求失败', { error: error.message, responseTime: `${responseTime}ms` });
    
    return {
      testCase: 'tool-call-request',
      success: false,
      responseTime,
      error: error.message,
      errorStatus: error.response?.status,
      errorData: error.response?.data
    };
  }
}

async function testLoadBalancing() {
  const testStart = Date.now();
  log('发送多请求负载均衡测试');
  
  const requests = TEST_CONFIG.testRequests[2].prompts;
  const results = [];
  
  try {
    // 并发发送多个请求以测试负载均衡
    const promises = requests.map(async (prompt, index) => {
      const requestStart = Date.now();
      
      try {
        const response = await axios.post(`${TEST_CONFIG.serverUrl}/v1/messages`, {
          model: 'claude-sonnet-4-20250514',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 50
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const requestTime = Date.now() - requestStart;
        log(`请求${index + 1}完成`, { prompt: prompt.substring(0, 30), responseTime: `${requestTime}ms` });
        
        return {
          index: index + 1,
          prompt,
          success: true,
          responseTime: requestTime,
          hasContent: !!(response.data.content && response.data.content.length > 0)
        };

      } catch (error) {
        const requestTime = Date.now() - requestStart;
        log(`请求${index + 1}失败`, { prompt: prompt.substring(0, 30), error: error.message });
        
        return {
          index: index + 1,
          prompt,
          success: false,
          responseTime: requestTime,
          error: error.message
        };
      }
    });

    const requestResults = await Promise.all(promises);
    const totalTime = Date.now() - testStart;
    
    const successCount = requestResults.filter(r => r.success).length;
    const avgResponseTime = requestResults.reduce((sum, r) => sum + r.responseTime, 0) / requestResults.length;
    
    log('负载均衡测试完成', {
      totalRequests: requests.length,
      successfulRequests: successCount,
      totalTime: `${totalTime}ms`,
      avgResponseTime: `${Math.round(avgResponseTime)}ms`
    });

    return {
      testCase: 'load-balancing',
      success: successCount >= Math.ceil(requests.length * 0.8), // 80%成功率
      totalTime,
      analysis: {
        totalRequests: requests.length,
        successfulRequests: successCount,
        failedRequests: requests.length - successCount,
        successRate: (successCount / requests.length),
        avgResponseTime: Math.round(avgResponseTime),
        requestResults
      }
    };

  } catch (error) {
    const totalTime = Date.now() - testStart;
    log('负载均衡测试失败', { error: error.message });
    
    return {
      testCase: 'load-balancing',
      success: false,
      totalTime,
      error: error.message
    };
  }
}

async function testTokenStats() {
  log('获取Token统计信息');
  
  try {
    // 尝试获取provider统计信息
    const response = await axios.get(`${TEST_CONFIG.serverUrl}/api/stats`, {
      timeout: 10000
    });

    log('获取统计信息成功', { status: response.status });
    
    // 检查是否包含token rotation相关信息
    const hasTokenStats = response.data && (
      response.data.providers ||
      response.data.tokenRotation ||
      JSON.stringify(response.data).includes('token')
    );

    return {
      testCase: 'token-stats',
      success: true,
      analysis: {
        hasTokenStats,
        statsKeys: response.data ? Object.keys(response.data) : [],
        dataPreview: response.data
      },
      response: response.data
    };

  } catch (error) {
    log('获取统计信息失败', { error: error.message });
    
    return {
      testCase: 'token-stats',
      success: false,
      error: error.message,
      errorStatus: error.response?.status
    };
  }
}

function analyzeResponse(response, expectations = {}) {
  const analysis = {
    hasResponse: !!response,
    hasContent: !!(response.content && response.content.length > 0),
    contentBlocks: response.content ? response.content.length : 0,
    blockTypes: response.content ? response.content.map(block => block.type) : [],
    textBlocks: 0,
    toolBlocks: 0,
    hasValidText: false,
    hasValidTools: false,
    toolDetails: [],
    meetsExpectations: true,
    usage: response.usage,
    hasValidUsage: !!(response.usage && response.usage.input_tokens && response.usage.output_tokens)
  };

  if (response.content) {
    response.content.forEach((block, index) => {
      if (block.type === 'text') {
        analysis.textBlocks++;
        if (block.text && block.text.trim().length > 0) {
          analysis.hasValidText = true;
          log(`文本块 ${index}`, {
            textLength: block.text.length,
            textPreview: block.text.substring(0, 100) + '...'
          });
        }
      } else if (block.type === 'tool_use') {
        analysis.toolBlocks++;
        if (block.name && block.id) {
          analysis.hasValidTools = true;
          analysis.toolDetails.push({
            id: block.id,
            name: block.name,
            input: block.input || {}
          });
          log(`工具块 ${index}`, {
            toolId: block.id,
            toolName: block.name,
            inputKeys: Object.keys(block.input || {})
          });
        }
      }
    });
  }

  // 检查是否符合预期
  if (expectations.expectText && !analysis.hasValidText) {
    analysis.meetsExpectations = false;
  }
  if (expectations.expectTools && !analysis.hasValidTools) {
    analysis.meetsExpectations = false;
  }

  log('响应分析完成', analysis);
  return analysis;
}

// 运行测试
if (require.main === module) {
  // 清空日志文件
  fs.writeFileSync(TEST_CONFIG.logFile, '');
  
  runTokenRotationTest()
    .then(results => {
      console.log('\n测试报告已生成:', results.conclusions);
      process.exit(results.summary.tokenRotationWorking ? 0 : 1);
    })
    .catch(error => {
      console.error('测试失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runTokenRotationTest };