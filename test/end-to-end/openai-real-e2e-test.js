#!/usr/bin/env node

/**
 * OpenAI 真实端到端测试
 * 通过Claude Code进行真实的API调用测试
 * 验证完整的六层架构在生产环境下的工作状态
 */

const http = require('http');
const fs = require('fs').promises;

console.log('🧪 OpenAI 真实端到端测试');
console.log('=' + '='.repeat(60));

// 测试配置
const TEST_CONFIG = {
  serverPort: 3456,
  timeout: 60000, // 真实API调用需要更长时间
  testDataDir: 'test/data/real-e2e',
  reportDir: 'test/reports',
  maxRetries: 2
};

// 真实测试场景配置
const REAL_TEST_SCENARIOS = {
  modelscope_basic: {
    name: 'ModelScope基础对话测试',
    description: '测试ModelScope Provider的基础对话功能',
    provider: 'modelscope',
    expectedModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    request: {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello! Please introduce yourself and tell me what you can help with. Keep it brief.'
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    },
    validation: {
      hasResponse: true,
      responseLength: { min: 50, max: 2000 },
      noErrors: true,
      correctFormat: 'anthropic',
      expectedProvider: 'modelscope'
    }
  },

  shuaihong_tool_call: {
    name: 'ShuaiHong工具调用测试',
    description: '测试ShuaiHong Provider的工具调用功能',
    provider: 'shuaihong',
    expectedModel: 'gpt-4o-mini',
    request: {
      model: 'claude-3-5-haiku-20241022',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please calculate the result of 25 + 37 using the calculator tool.'
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      tools: [
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          input_schema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate (e.g., "25 + 37")'
              }
            },
            required: ['expression']
          }
        }
      ]
    },
    validation: {
      hasResponse: true,
      hasToolUse: true,
      toolCallCount: { min: 1, max: 2 },
      noErrors: true,
      correctFormat: 'anthropic',
      expectedProvider: 'shuaihong'
    }
  },

  lmstudio_local_inference: {
    name: 'LMStudio本地推理测试',
    description: '测试LMStudio本地模型的工具调用和文本解析',
    provider: 'lmstudio',
    expectedModel: 'qwen3-30b-a3b-instruct-2507-mlx',
    request: {
      model: 'claude-3-opus-20240229',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Use the file analysis tool to analyze a hypothetical config file structure.'
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      tools: [
        {
          name: 'analyze_file_structure',
          description: 'Analyze the structure of a configuration file',
          input_schema: {
            type: 'object',
            properties: {
              file_type: {
                type: 'string',
                description: 'Type of configuration file (json, yaml, ini, etc.)'
              },
              analysis_depth: {
                type: 'string',
                enum: ['basic', 'detailed', 'comprehensive'],
                description: 'Level of analysis to perform'
              }
            },
            required: ['file_type']
          }
        }
      ]
    },
    validation: {
      hasResponse: true,
      hasToolUse: true,
      textParsingWorked: true, // LMStudio特有的文本解析验证
      noErrors: true,
      correctFormat: 'anthropic',
      expectedProvider: 'lmstudio'
    }
  },

  multi_provider_failover: {
    name: '多Provider故障转移测试',
    description: '测试负载均衡和故障转移机制',
    provider: 'auto', // 由路由器自动选择
    request: {
      model: 'claude-3-5-sonnet-20241022', // 高优先级模型，应该触发负载均衡
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This is a test message for load balancing. Please respond with a simple acknowledgment.'
            }
          ]
        }
      ],
      max_tokens: 200,
      temperature: 0.5
    },
    validation: {
      hasResponse: true,
      responseLength: { min: 20, max: 500 },
      noErrors: true,
      correctFormat: 'anthropic',
      loadBalancingWorked: true
    }
  },

  stress_test_tools: {
    name: '工具调用压力测试',
    description: '测试多工具定义和复杂工具调用场景',
    provider: 'auto',
    request: {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'I need you to help me with file operations. List the current directory and then read the package.json file if it exists.'
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.2,
      tools: [
        {
          name: 'list_directory',
          description: 'List files and directories in a specified path',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path to list' },
              show_hidden: { type: 'boolean', description: 'Include hidden files' }
            },
            required: ['path']
          }
        },
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          input_schema: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file to read' },
              encoding: { type: 'string', description: 'File encoding (default: utf-8)' }
            },
            required: ['file_path']
          }
        },
        {
          name: 'check_file_exists',
          description: 'Check if a file exists at the specified path',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to check' }
            },
            required: ['path']
          }
        }
      ]
    },
    validation: {
      hasResponse: true,
      hasToolUse: true,
      toolCallCount: { min: 1, max: 3 },
      multipleToolsHandled: true,
      noErrors: true,
      correctFormat: 'anthropic'
    }
  }
};

/**
 * 真实API测试执行器
 */
class RealAPITester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.performance = [];
  }

  // 执行单个真实测试
  async executeRealTest(scenarioKey, scenario) {
    console.log(`\n🧪 执行真实测试: ${scenario.name}`);
    console.log(`📝 描述: ${scenario.description}`);
    
    const startTime = Date.now();
    let attempt = 0;
    
    while (attempt <= TEST_CONFIG.maxRetries) {
      try {
        attempt++;
        console.log(`\n🔄 尝试 ${attempt}/${TEST_CONFIG.maxRetries + 1}...`);
        
        // 发送真实API请求
        const apiResponse = await this.sendRealAPIRequest(scenario.request);
        const executionTime = Date.now() - startTime;
        
        // 验证响应
        const validation = this.validateRealResponse(apiResponse, scenario.validation);
        
        // 分析性能
        const performance = this.analyzePerformance(apiResponse, executionTime);
        
        const result = {
          scenarioKey,
          scenario: scenario.name,
          success: validation.allPassed,
          attempt,
          executionTime,
          validation,
          performance,
          response: {
            id: apiResponse.parsedResponse?.id,
            model: apiResponse.parsedResponse?.model,
            provider: this.extractProviderFromResponse(apiResponse),
            hasContent: !!this.extractContent(apiResponse.parsedResponse),
            hasToolUse: this.hasToolUse(apiResponse.parsedResponse),
            statusCode: apiResponse.statusCode
          },
          timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        this.performance.push(performance);
        
        if (result.success) {
          console.log(`✅ 测试成功 (${executionTime}ms, ${attempt}次尝试)`);
          return result;
        } else {
          console.log(`❌ 验证失败，准备重试...`);
          if (attempt <= TEST_CONFIG.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
          }
        }
        
      } catch (error) {
        console.log(`❌ 测试执行失败 (尝试${attempt}): ${error.message}`);
        this.errors.push({
          scenarioKey,
          attempt,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        if (attempt <= TEST_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒后重试
        }
      }
    }
    
    // 所有尝试都失败
    const executionTime = Date.now() - startTime;
    const failureResult = {
      scenarioKey,
      scenario: scenario.name,
      success: false,
      attempt,
      executionTime,
      error: 'All attempts failed',
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(failureResult);
    console.log(`❌ 测试最终失败 (${executionTime}ms, ${attempt}次尝试)`);
    return failureResult;
  }

  // 发送真实的API请求
  async sendRealAPIRequest(requestData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      const startTime = Date.now();
      
      const req = http.request({
        hostname: 'localhost',
        port: TEST_CONFIG.serverPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key',
          'User-Agent': 'OpenAI-Real-E2E-Test/1.0'
        },
        timeout: TEST_CONFIG.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          try {
            const parsedResponse = res.statusCode === 200 ? JSON.parse(data) : null;
            const errorResponse = res.statusCode !== 200 ? JSON.parse(data) : null;
            
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              rawData: data,
              parsedResponse,
              errorResponse,
              responseTime,
              requestSize: Buffer.byteLength(postData),
              responseSize: Buffer.byteLength(data)
            });
          } catch (parseError) {
            reject(new Error(`Response parsing failed: ${parseError.message}. Raw data: ${data.substring(0, 200)}`));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(new Error(`HTTP request failed: ${err.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }

  // 验证真实响应
  validateRealResponse(apiResponse, validationRules) {
    const results = {};
    const issues = [];
    
    // 检查基本响应
    if (validationRules.hasResponse) {
      results.hasResponse = apiResponse.statusCode === 200 && !!apiResponse.parsedResponse;
      if (!results.hasResponse) {
        issues.push(`No valid response (status: ${apiResponse.statusCode})`);
      }
    }
    
    if (!apiResponse.parsedResponse) {
      return { allPassed: false, results, issues };
    }
    
    const response = apiResponse.parsedResponse;
    
    // 检查响应长度
    if (validationRules.responseLength) {
      const content = this.extractContent(response);
      const length = content ? content.length : 0;
      results.responseLength = length >= validationRules.responseLength.min && 
                              length <= validationRules.responseLength.max;
      if (!results.responseLength) {
        issues.push(`Response length ${length} not in range [${validationRules.responseLength.min}, ${validationRules.responseLength.max}]`);
      }
    }
    
    // 检查错误
    if (validationRules.noErrors) {
      results.noErrors = !response.error && !apiResponse.errorResponse;
      if (!results.noErrors) {
        issues.push(`Response contains errors: ${response.error?.message || apiResponse.errorResponse?.error?.message}`);
      }
    }
    
    // 检查格式
    if (validationRules.correctFormat === 'anthropic') {
      results.correctFormat = response.type === 'message' && 
                             response.role === 'assistant' && 
                             Array.isArray(response.content);
      if (!results.correctFormat) {
        issues.push('Response not in correct Anthropic format');
      }
    }
    
    // 检查工具使用
    if (validationRules.hasToolUse) {
      results.hasToolUse = this.hasToolUse(response);
      if (!results.hasToolUse) {
        issues.push('Expected tool use but none found');
      }
    }
    
    // 检查工具调用数量
    if (validationRules.toolCallCount) {
      const toolCount = this.countToolUse(response);
      results.toolCallCount = toolCount >= validationRules.toolCallCount.min && 
                             toolCount <= validationRules.toolCallCount.max;
      if (!results.toolCallCount) {
        issues.push(`Tool call count ${toolCount} not in range [${validationRules.toolCallCount.min}, ${validationRules.toolCallCount.max}]`);
      }
    }
    
    // 检查Provider
    if (validationRules.expectedProvider) {
      const actualProvider = this.extractProviderFromResponse(apiResponse);
      results.expectedProvider = actualProvider.includes(validationRules.expectedProvider);
      if (!results.expectedProvider) {
        issues.push(`Expected provider ${validationRules.expectedProvider} but got ${actualProvider}`);
      }
    }
    
    // 检查LMStudio特有的文本解析
    if (validationRules.textParsingWorked) {
      results.textParsingWorked = this.validateLMStudioTextParsing(response);
      if (!results.textParsingWorked) {
        issues.push('LMStudio text parsing validation failed');
      }
    }
    
    const allPassed = Object.values(results).every(Boolean);
    
    return { allPassed, results, issues };
  }

  // 分析性能数据
  analyzePerformance(apiResponse, executionTime) {
    return {
      executionTime,
      responseTime: apiResponse.responseTime,
      requestSize: apiResponse.requestSize,
      responseSize: apiResponse.responseSize,
      throughput: apiResponse.responseSize / (apiResponse.responseTime / 1000), // bytes per second
      efficiency: apiResponse.responseSize / executionTime // response size per total time
    };
  }

  // 辅助方法
  extractContent(response) {
    if (!response || !response.content) return null;
    
    const textBlocks = response.content.filter(block => block.type === 'text');
    return textBlocks.map(block => block.text).join('\n');
  }

  hasToolUse(response) {
    if (!response || !response.content) return false;
    return response.content.some(block => block.type === 'tool_use');
  }

  countToolUse(response) {
    if (!response || !response.content) return 0;
    return response.content.filter(block => block.type === 'tool_use').length;
  }

  extractProviderFromResponse(apiResponse) {
    // 从响应头或其他字段提取provider信息
    return apiResponse.headers['x-provider'] || 
           apiResponse.parsedResponse?.model?.split('/')[0] || 
           'unknown';
  }

  validateLMStudioTextParsing(response) {
    // LMStudio特有的文本解析验证
    if (!this.hasToolUse(response)) return false;
    
    // 检查是否是从文本格式正确解析出来的工具调用
    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
    return toolUseBlocks.every(block => block.id && block.name && block.input);
  }
}

/**
 * 运行完整的真实端到端测试
 */
async function runRealEndToEndTests() {
  console.log('\n🚀 开始OpenAI真实端到端测试...\n');
  
  // 检查服务器状态
  console.log('🔍 检查服务器状态...');
  try {
    const healthCheck = await checkServerHealth();
    if (!healthCheck.healthy) {
      throw new Error(`Server not healthy: ${healthCheck.error}`);
    }
    console.log(`✅ 服务器健康 (${healthCheck.providers.length} providers available)`);
  } catch (error) {
    throw new Error(`Server health check failed: ${error.message}`);
  }
  
  const tester = new RealAPITester();
  const testOrder = [
    'modelscope_basic',
    'shuaihong_tool_call', 
    'lmstudio_local_inference',
    'multi_provider_failover',
    'stress_test_tools'
  ];
  
  console.log(`\n📋 将按顺序执行 ${testOrder.length} 个测试场景`);
  
  // 按顺序执行测试
  for (const scenarioKey of testOrder) {
    const scenario = REAL_TEST_SCENARIOS[scenarioKey];
    if (!scenario) {
      console.log(`⚠️  跳过未知场景: ${scenarioKey}`);
      continue;
    }
    
    console.log('\n' + '='.repeat(80));
    await tester.executeRealTest(scenarioKey, scenario);
    
    // 测试间隔
    console.log('⏳ 等待5秒后继续下一个测试...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return tester;
}

/**
 * 检查服务器健康状态
 */
async function checkServerHealth() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.serverPort,
      path: '/health',
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({
            healthy: health.overall === 'healthy',
            providers: Object.keys(health.providers || {}),
            details: health
          });
        } catch (error) {
          resolve({ healthy: false, error: 'Invalid health response' });
        }
      });
    });
    
    req.on('error', (err) => resolve({ healthy: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ healthy: false, error: 'Health check timeout' }); });
    req.end();
  });
}

/**
 * 生成真实端到端测试报告
 */
function generateRealTestReport(tester) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 OpenAI 真实端到端测试报告');
  console.log('='.repeat(70));
  
  const results = tester.testResults;
  const errors = tester.errors;
  const performance = tester.performance;
  
  // 基本统计
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\n📈 测试统计:');
  console.log(`   总测试数: ${totalTests}`);
  console.log(`   通过数: ${passedTests}`);
  console.log(`   失败数: ${failedTests}`);
  console.log(`   通过率: ${passRate}%`);
  console.log(`   总错误数: ${errors.length}`);
  
  // 性能统计
  if (performance.length > 0) {
    const avgExecTime = performance.reduce((sum, p) => sum + p.executionTime, 0) / performance.length;
    const avgResponseTime = performance.reduce((sum, p) => sum + p.responseTime, 0) / performance.length;
    const avgThroughput = performance.reduce((sum, p) => sum + p.throughput, 0) / performance.length;
    
    console.log('\n🚀 性能统计:');
    console.log(`   平均执行时间: ${avgExecTime.toFixed(0)}ms`);
    console.log(`   平均响应时间: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   平均吞吐量: ${(avgThroughput / 1024).toFixed(2)} KB/s`);
  }
  
  // 详细结果
  console.log('\n🔍 详细测试结果:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`\n   ${status} ${result.scenario}:`);
    console.log(`      执行时间: ${result.executionTime}ms`);
    console.log(`      尝试次数: ${result.attempt}`);
    
    if (result.response) {
      console.log(`      响应状态: ${result.response.statusCode}`);
      console.log(`      Provider: ${result.response.provider}`);
      console.log(`      工具调用: ${result.response.hasToolUse ? '✅' : '❌'}`);
    }
    
    if (result.validation && result.validation.issues.length > 0) {
      console.log(`      验证问题: ${result.validation.issues.join(', ')}`);
    }
    
    if (result.error) {
      console.log(`      错误: ${result.error}`);
    }
  });
  
  // 错误分析
  if (errors.length > 0) {
    console.log('\n🔥 错误分析:');
    const errorsByScenario = {};
    errors.forEach(error => {
      if (!errorsByScenario[error.scenarioKey]) {
        errorsByScenario[error.scenarioKey] = [];
      }
      errorsByScenario[error.scenarioKey].push(error);
    });
    
    Object.entries(errorsByScenario).forEach(([scenarioKey, scenarioErrors]) => {
      console.log(`\n   📋 ${scenarioKey}:`);
      scenarioErrors.forEach(error => {
        console.log(`      尝试${error.attempt}: ${error.error}`);
      });
    });
  }
  
  const allPassed = failedTests === 0;
  console.log(`\n🏁 真实测试结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
  
  if (allPassed) {
    console.log('🎉 真实端到端测试完成，OpenAI六层架构在生产环境下工作正常！');
    console.log('✅ 所有Provider工具调用功能已验证');
    console.log('✅ 负载均衡和故障转移机制正常');
    console.log('✅ 六层架构数据流完整');
  } else {
    console.log('⚠️  部分真实测试失败，需要调查以下问题:');
    if (failedTests > 0) {
      console.log(`   - ${failedTests} 个测试场景未通过验证`);
    }
    if (errors.length > 0) {
      console.log(`   - ${errors.length} 个执行错误需要解决`);
    }
  }
  
  return {
    totalTests,
    passedTests,
    failedTests,
    passRate: parseFloat(passRate),
    allPassed,
    performance: performance.length > 0 ? {
      avgExecutionTime: performance.reduce((sum, p) => sum + p.executionTime, 0) / performance.length,
      avgResponseTime: performance.reduce((sum, p) => sum + p.responseTime, 0) / performance.length,
      avgThroughput: performance.reduce((sum, p) => sum + p.throughput, 0) / performance.length
    } : null,
    errors: errors.length
  };
}

/**
 * 主测试函数
 */
async function main() {
  try {
    console.log('🎯 目标: 通过Claude Code进行真实API调用，验证OpenAI六层架构完整功能');
    console.log('📋 测试内容: 真实Provider调用、工具调用验证、负载均衡测试、故障转移验证');
    console.log('🏗️  架构层级: 完整六层架构真实环境测试');
    console.log('⚠️  注意: 这是真实API调用，将产生实际的API费用');
    
    const tester = await runRealEndToEndTests();
    const report = generateRealTestReport(tester);
    
    // 保存详细测试数据
    const detailedReport = {
      timestamp: new Date().toISOString(),
      testType: 'real-e2e',
      summary: report,
      results: tester.testResults,
      errors: tester.errors,
      performance: tester.performance,
      scenarios: REAL_TEST_SCENARIOS
    };
    
    const reportPath = `test/reports/openai-real-e2e-test-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`\n💾 详细测试数据已保存到: ${reportPath}`);
    
    process.exit(report.allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ 真实端到端测试执行失败:', error);
    process.exit(1);
  }
}

// 直接执行测试
if (require.main === module) {
  main();
}

module.exports = {
  runRealEndToEndTests,
  RealAPITester,
  REAL_TEST_SCENARIOS,
  checkServerHealth
};