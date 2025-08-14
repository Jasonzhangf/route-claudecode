#!/usr/bin/env node

/**
 * OpenAI Provider层简化单元测试
 * 测试ModelScope、ShuaiHong、LMStudio的工具调用功能
 * 六层架构单元测试 - Provider层（简化版，避免模块引用问题）
 */

const http = require('http');
const fs = require('fs').promises;

console.log('🧪 OpenAI Provider层简化单元测试');
console.log('=' + '='.repeat(60));

// 测试配置 - 使用主服务端口3456，测试不同的Provider通过模型路由
const PROVIDER_CONFIGS = {
  modelscope: {
    name: 'ModelScope Provider Test (via Load Balancer)',
    port: 3456,
    expectedProvider: 'modelscope',
    testRequest: {
      model: 'claude-4-sonnet', // 会路由到modelscope provider
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello! Please introduce yourself briefly and tell me what you can help with.' }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    }
  },
  shuaihong: {
    name: 'ShuaiHong Provider Test (via Load Balancer)',
    port: 3456,
    expectedProvider: 'shuaihong',
    testRequest: {
      model: 'claude-3-5-haiku-20241022', // 会路由到shuaihong provider
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please calculate 25 + 37 using the calculator tool.' }
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
                description: 'Mathematical expression to evaluate'
              }
            },
            required: ['expression']
          }
        }
      ]
    }
  },
  lmstudio: {
    name: 'LMStudio Provider Test (via Load Balancer)', 
    port: 3456,
    expectedProvider: 'lmstudio',
    testRequest: {
      model: 'claude-3-opus-20240229', // 会路由到lmstudio provider
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Use the file analysis tool to analyze a JSON configuration structure.' }
          ]
        }
      ],
      max_tokens: 1200,
      temperature: 0.2,
      tools: [
        {
          name: 'analyze_file',
          description: 'Analyze file structure and content',
          input_schema: {
            type: 'object',
            properties: {
              file_type: { type: 'string', description: 'Type of file to analyze' },
              analysis_depth: { type: 'string', enum: ['basic', 'detailed'], description: 'Analysis depth' }
            },
            required: ['file_type']
          }
        }
      ]
    }
  }
};

/**
 * Provider连接和API调用测试器
 */
class SimplifiedProviderTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
  }

  // 执行对指定Provider的API调用测试
  async testProviderAPICall(providerName, config) {
    console.log(`\n🧪 测试Provider: ${config.name}`);
    console.log(`📡 端口: ${config.port}`);
    console.log(`🤖 预期模型: ${config.expectedModel}`);
    
    try {
      console.log(`🔗 尝试直接API调用测试 (跳过健康检查)`);

      // 直接执行API调用测试，跳过健康检查
      const apiResponse = await this.sendProviderRequest(config.port, config.testRequest);
      
      // 验证响应
      const validation = this.validateProviderResponse(apiResponse, config);
      
      const result = {
        providerName,
        success: validation.passed,
        port: config.port,
        responseTime: apiResponse.responseTime,
        validation,
        response: {
          id: apiResponse.parsedResponse?.id,
          model: apiResponse.parsedResponse?.model,
          hasContent: this.hasContent(apiResponse.parsedResponse),
          hasToolUse: this.hasToolUse(apiResponse.parsedResponse),
          statusCode: apiResponse.statusCode
        },
        timestamp: new Date().toISOString()
      };

      this.testResults.push(result);

      if (result.success) {
        console.log(`✅ ${providerName} 测试成功 (${apiResponse.responseTime}ms)`);
        console.log(`📊 响应状态: ${apiResponse.statusCode}`);
        console.log(`🔧 工具调用: ${result.response.hasToolUse ? '✅' : '❌'}`);
      } else {
        console.log(`❌ ${providerName} 测试失败`);
        console.log(`📊 验证问题: ${validation.issues.join(', ')}`);
        
        // 显示错误响应详情
        if (apiResponse.errorResponse) {
          console.log(`🔍 错误响应: ${JSON.stringify(apiResponse.errorResponse, null, 2)}`);
        } else if (apiResponse.rawData && apiResponse.rawData.length < 500) {
          console.log(`🔍 原始响应: ${apiResponse.rawData}`);
        }
      }

      return result;

    } catch (error) {
      console.log(`❌ ${providerName} 测试执行失败: ${error.message}`);
      
      const errorResult = {
        providerName,
        success: false,
        port: config.port,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(errorResult);
      this.errors.push({ providerName, error: error.message });
      
      return errorResult;
    }
  }

  // 检查Provider服务健康状态
  async checkProviderHealth(port) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = res.statusCode === 200 ? JSON.parse(data) : null;
            resolve({
              healthy: res.statusCode === 200 && health,
              data: health
            });
          } catch (error) {
            resolve({ healthy: false, error: 'Invalid health response' });
          }
        });
      });
      
      req.on('error', (err) => resolve({ healthy: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ healthy: false, error: 'Health check timeout' });
      });
      req.end();
    });
  }

  // 发送Provider API请求
  async sendProviderRequest(port, requestData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      const startTime = Date.now();

      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
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
            reject(new Error(`Response parsing failed: ${parseError.message}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  // 验证Provider响应
  validateProviderResponse(apiResponse, config) {
    const issues = [];
    let passed = true;

    // 检查响应状态
    if (apiResponse.statusCode !== 200) {
      issues.push(`HTTP status ${apiResponse.statusCode}, expected 200`);
      passed = false;
    }

    if (!apiResponse.parsedResponse) {
      issues.push('No valid parsed response');
      passed = false;
      return { passed, issues };
    }

    const response = apiResponse.parsedResponse;

    // 检查Anthropic格式
    if (!response.type || response.type !== 'message') {
      issues.push('Response not in Anthropic message format');
      passed = false;
    }

    if (!response.role || response.role !== 'assistant') {
      issues.push('Response role not assistant');
      passed = false;
    }

    if (!Array.isArray(response.content)) {
      issues.push('Response content not array format');
      passed = false;
    }

    // 检查内容 - 如果有工具调用，则不强制要求文本内容
    if (!this.hasContent(response) && !this.hasToolUse(response)) {
      issues.push('Response has neither text content nor tool use');
      passed = false;
    }

    // 对于有工具定义的请求，检查工具调用
    if (config.testRequest.tools && config.testRequest.tools.length > 0) {
      if (!this.hasToolUse(response)) {
        issues.push('Expected tool use but none found');
        passed = false;
      }
    }

    // 检查响应长度
    const content = this.extractTextContent(response);
    if (content && content.length < 10) {
      issues.push('Response content too short');
      passed = false;
    }

    return { passed, issues };
  }

  // 辅助方法
  hasContent(response) {
    return response?.content?.some(block => block.type === 'text' && block.text);
  }

  hasToolUse(response) {
    return response?.content?.some(block => block.type === 'tool_use');
  }

  extractTextContent(response) {
    if (!response?.content) return null;
    return response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
}

/**
 * 运行完整的简化Provider层测试
 */
async function runSimplifiedProviderTests() {
  console.log('\n🚀 开始OpenAI Provider层简化测试...\n');

  const tester = new SimplifiedProviderTester();

  // 按顺序测试每个Provider
  for (const [providerName, config] of Object.entries(PROVIDER_CONFIGS)) {
    console.log('\n' + '='.repeat(80));
    await tester.testProviderAPICall(providerName, config);
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return tester;
}

/**
 * 生成测试报告
 */
function generateSimplifiedTestReport(tester) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 OpenAI Provider层简化测试报告');
  console.log('='.repeat(70));

  const results = tester.testResults;
  const errors = tester.errors;

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('\n📈 测试统计:');
  console.log(`   总测试数: ${totalTests}`);
  console.log(`   通过数: ${passedTests}`);
  console.log(`   失败数: ${failedTests}`);
  console.log(`   通过率: ${passRate}%`);

  console.log('\n🔍 详细结果:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`\n   ${status} ${result.providerName}:`);
    console.log(`      端口: ${result.port}`);
    
    if (result.responseTime) {
      console.log(`      响应时间: ${result.responseTime}ms`);
    }
    
    if (result.response) {
      console.log(`      状态码: ${result.response.statusCode}`);
      console.log(`      内容: ${result.response.hasContent ? '✅' : '❌'}`);
      console.log(`      工具调用: ${result.response.hasToolUse ? '✅' : '❌'}`);
    }
    
    if (result.validation && result.validation.issues.length > 0) {
      console.log(`      问题: ${result.validation.issues.join(', ')}`);
    }
    
    if (result.error) {
      console.log(`      错误: ${result.error}`);
    }
  });

  const allPassed = failedTests === 0;
  console.log(`\n🏁 测试结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);

  if (allPassed) {
    console.log('🎉 OpenAI Provider层简化测试完成！');
    console.log('✅ 所有Provider的API调用功能正常');
    console.log('✅ 工具调用格式转换正确');
    console.log('✅ Anthropic格式响应验证通过');
  } else {
    console.log('⚠️  部分Provider测试失败，需要调查:');
    errors.forEach(error => {
      console.log(`   - ${error.providerName}: ${error.error}`);
    });
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    passRate: parseFloat(passRate),
    allPassed,
    results
  };
}

/**
 * 主测试函数
 */
async function main() {
  try {
    console.log('🎯 目标: 测试ModelScope、ShuaiHong、LMStudio Provider的API调用功能');
    console.log('📋 测试内容: API连接、工具调用、格式验证');
    console.log('🏗️  架构层级: Provider层 (六层架构第五层)');
    console.log('💡 测试方式: 简化版本，绕过模块引用问题');

    const tester = await runSimplifiedProviderTests();
    const report = generateSimplifiedTestReport(tester);

    // 保存测试结果
    const reportData = {
      timestamp: new Date().toISOString(),
      testType: 'openai-provider-layer-simplified',
      summary: report,
      results: tester.testResults,
      errors: tester.errors,
      providerConfigs: PROVIDER_CONFIGS
    };

    const reportPath = `test/reports/openai-provider-layer-simplified-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 测试报告已保存到: ${reportPath}`);

    process.exit(report.allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Provider层简化测试执行失败:', error);
    process.exit(1);
  }
}

// 直接执行测试
if (require.main === module) {
  main();
}

module.exports = {
  runSimplifiedProviderTests,
  SimplifiedProviderTester,
  PROVIDER_CONFIGS
};