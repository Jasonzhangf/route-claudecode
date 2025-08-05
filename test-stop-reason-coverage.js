#!/usr/bin/env node

/**
 * 综合测试：模拟服务器响应各种stop reason场景
 * 验证OpenAI -> Anthropic finish reason映射的完整覆盖
 */

const http = require('http');
const { mapFinishReason } = require('./dist/utils/finish-reason-handler');

// 测试配置
const TEST_CONFIG = {
  port: 5508,
  timeout: 15000
};

// 所有可能的OpenAI finish_reason值及其预期的Anthropic映射
const FINISH_REASON_TEST_CASES = [
  {
    openai: 'stop',
    expected: 'end_turn',
    description: '正常结束',
    testMessage: '简单回复：你好'
  },
  {
    openai: 'length',
    expected: 'max_tokens', 
    description: '达到最大token限制',
    testMessage: '请生成一个非常长的回复，至少1000个字符'
  },
  {
    openai: 'tool_calls',
    expected: 'tool_use',
    description: '工具调用结束',
    testMessage: '请使用Edit工具编辑文件/tmp/test.txt'
  },
  {
    openai: 'function_call',
    expected: 'tool_use', 
    description: '函数调用结束(旧格式)',
    testMessage: '请调用一个函数来帮助我'
  },
  {
    openai: 'content_filter',
    expected: 'stop_sequence',
    description: '内容过滤器触发',
    testMessage: '这是一个测试消息'
  }
];

// 特殊场景测试
const SPECIAL_CASES = [
  {
    scenario: 'missing_finish_reason',
    description: '缺失finish_reason字段',
    expected: 'end_turn',
    testMessage: '测试缺失finish_reason的情况'
  },
  {
    scenario: 'null_finish_reason', 
    description: 'null finish_reason',
    expected: 'end_turn',
    testMessage: '测试null finish_reason的情况'
  },
  {
    scenario: 'empty_finish_reason',
    description: '空字符串finish_reason',
    expected: 'end_turn', 
    testMessage: '测试空finish_reason的情况'
  },
  {
    scenario: 'unknown_finish_reason',
    description: '未知finish_reason值',
    expected: 'error', // 应该抛出错误
    testMessage: '测试未知finish_reason的情况'
  }
];

class StopReasonTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
  }

  async runAllTests() {
    console.log('🧪 开始综合stop reason覆盖测试');
    console.log('='.repeat(60));
    
    try {
      // 检查服务器可用性
      await this.checkServerHealth();
      
      // 测试finish reason映射逻辑
      console.log('\n📋 1. 测试finish reason映射逻辑');
      this.testFinishReasonMapping();
      
      // 测试各种正常场景
      console.log('\n📋 2. 测试各种finish reason场景');
      await this.testFinishReasonScenarios();
      
      // 测试特殊场景
      console.log('\n📋 3. 测试特殊场景和边界条件');
      await this.testSpecialCases();
      
      // 生成测试报告
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      this.results.errors.push(error.message);
      this.generateReport();
    }
  }

  async checkServerHealth() {
    console.log('🔍 检查服务器健康状态...');
    
    return new Promise((resolve, reject) => {
      const healthCheck = http.request({
        hostname: 'localhost',
        port: TEST_CONFIG.port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          console.log(`✅ 服务器运行正常 (端口${TEST_CONFIG.port})`);
          resolve();
        } else {
          reject(new Error(`服务器健康检查失败: ${res.statusCode}`));
        }
      });
      
      healthCheck.on('error', (error) => {
        reject(new Error(`服务器不可用: ${error.message}`));
      });
      
      healthCheck.end();
    });
  }

  testFinishReasonMapping() {
    console.log('📊 验证finish reason映射函数...');
    
    FINISH_REASON_TEST_CASES.forEach(testCase => {
      try {
        const mapped = mapFinishReason(testCase.openai);
        const passed = mapped === testCase.expected;
        
        this.results.total++;
        if (passed) {
          this.results.passed++;
          console.log(`  ✅ ${testCase.openai} -> ${mapped} (${testCase.description})`);
        } else {
          this.results.failed++;
          console.log(`  ❌ ${testCase.openai} -> ${mapped}, 期望: ${testCase.expected}`);
          this.results.errors.push(`映射错误: ${testCase.openai} -> ${mapped}, 期望: ${testCase.expected}`);
        }
        
        this.results.details.push({
          type: 'mapping',
          scenario: testCase.openai,
          expected: testCase.expected,
          actual: mapped,
          passed: passed
        });
        
      } catch (error) {
        this.results.total++;
        this.results.failed++;
        console.log(`  ❌ ${testCase.openai} -> ERROR: ${error.message}`);
        this.results.errors.push(`映射异常: ${testCase.openai} -> ${error.message}`);
      }
    });
    
    // 测试边界条件
    const borderCases = [
      { input: '', expected: 'end_turn', desc: '空字符串' },
      { input: null, expected: 'end_turn', desc: 'null值' },
      { input: undefined, expected: 'end_turn', desc: 'undefined值' }
    ];
    
    borderCases.forEach(testCase => {
      try {
        const mapped = mapFinishReason(testCase.input);
        const passed = mapped === testCase.expected;
        
        this.results.total++;
        if (passed) {
          this.results.passed++;
          console.log(`  ✅ ${testCase.desc} -> ${mapped}`);
        } else {
          this.results.failed++;
          console.log(`  ❌ ${testCase.desc} -> ${mapped}, 期望: ${testCase.expected}`);
        }
        
      } catch (error) {
        this.results.total++;
        this.results.failed++;
        console.log(`  ❌ ${testCase.desc} -> ERROR: ${error.message}`);
      }
    });
  }

  async testFinishReasonScenarios() {
    console.log('🎯 测试实际API响应中的finish reason处理...');
    
    for (const testCase of FINISH_REASON_TEST_CASES) {
      try {
        console.log(`\n  测试场景: ${testCase.description}`);
        const response = await this.sendTestRequest(testCase.testMessage);
        
        // 解析响应
        let responseData;
        try {
          responseData = JSON.parse(response);
        } catch (parseError) {
          console.log(`  ⚠️  响应解析失败: ${parseError.message}`);
          continue;
        }
        
        // 检查stop_reason字段
        const actualStopReason = responseData.stop_reason;
        const passed = actualStopReason === testCase.expected;
        
        this.results.total++;
        if (passed) {
          this.results.passed++;
          console.log(`  ✅ stop_reason: ${actualStopReason} (符合预期)`);
        } else {
          this.results.failed++;
          console.log(`  ❌ stop_reason: ${actualStopReason}, 期望: ${testCase.expected}`);
          this.results.errors.push(`API响应错误: 期望 ${testCase.expected}, 实际 ${actualStopReason}`);
        }
        
        this.results.details.push({
          type: 'api_response',
          scenario: testCase.description,
          expected: testCase.expected,
          actual: actualStopReason,
          passed: passed,
          responsePreview: response.substring(0, 200)
        });
        
        // 额外检查响应完整性
        this.validateResponseStructure(responseData, testCase);
        
      } catch (error) {
        console.log(`  ❌ 测试失败: ${error.message}`);
        this.results.total++;
        this.results.failed++;
        this.results.errors.push(`API测试失败 (${testCase.description}): ${error.message}`);
      }
    }
  }

  async testSpecialCases() {
    console.log('🔬 测试特殊场景和边界条件...');
    
    // 测试空消息
    try {
      console.log('\n  测试空消息响应...');
      const emptyResponse = await this.sendTestRequest('');
      const data = JSON.parse(emptyResponse);
      
      this.results.total++;
      if (data.stop_reason) {
        this.results.passed++;
        console.log(`  ✅ 空消息有stop_reason: ${data.stop_reason}`);
      } else {
        this.results.failed++;
        console.log(`  ❌ 空消息缺少stop_reason字段`);
        this.results.errors.push('空消息响应缺少stop_reason字段');
      }
      
    } catch (error) {
      console.log(`  ❌ 空消息测试失败: ${error.message}`);
    }
    
    // 测试长消息 (可能触发max_tokens)
    try {
      console.log('\n  测试长消息响应 (可能触发max_tokens)...');
      const longMessage = '请生成一个详细的技术文档，包含至少20个章节，每个章节至少500字。' + '内容要求丰富详细。'.repeat(50);
      const longResponse = await this.sendTestRequest(longMessage);
      const data = JSON.parse(longResponse);
      
      this.results.total++;
      console.log(`  📊 长消息stop_reason: ${data.stop_reason}`);
      
      if (data.stop_reason === 'max_tokens' || data.stop_reason === 'end_turn') {
        this.results.passed++;
        console.log(`  ✅ 长消息响应正常`);
      } else {
        this.results.failed++;
        console.log(`  ⚠️  长消息unexpected stop_reason: ${data.stop_reason}`);
      }
      
    } catch (error) {
      console.log(`  ❌ 长消息测试失败: ${error.message}`);
    }
    
    // 测试工具调用场景
    try {
      console.log('\n  测试工具调用场景...');
      const toolResponse = await this.sendTestRequestWithTools('请编辑文件/tmp/test.txt，添加hello world内容');
      const data = JSON.parse(toolResponse);
      
      this.results.total++;
      console.log(`  🔧 工具调用stop_reason: ${data.stop_reason}`);
      
      if (data.stop_reason === 'tool_use') {
        this.results.passed++;
        console.log(`  ✅ 工具调用响应正常`);
      } else {
        this.results.failed++;
        console.log(`  ❌ 工具调用期望tool_use，实际: ${data.stop_reason}`);
        this.results.errors.push(`工具调用响应错误: 期望tool_use, 实际${data.stop_reason}`);
      }
      
    } catch (error) {
      console.log(`  ❌ 工具调用测试失败: ${error.message}`);
    }
  }

  async sendTestRequest(message) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        model: 'qwen3-coder',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        ],
        stream: false,
        max_tokens: 100 // 限制token数量便于测试
      });

      const options = {
        hostname: 'localhost',
        port: TEST_CONFIG.port,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'Authorization': 'Bearer test-key'
        },
        timeout: TEST_CONFIG.timeout
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve(responseData);
        });
      });

      req.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });

      req.on('timeout', () => {
        reject(new Error('请求超时'));
      });

      req.write(requestData);
      req.end();
    });
  }

  async sendTestRequestWithTools(message) {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        model: 'qwen3-coder',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        ],
        tools: [
          {
            name: 'Edit',
            description: 'Edit a file',
            input_schema: {
              type: 'object',
              properties: {
                file_path: { type: 'string' },
                old_string: { type: 'string' },
                new_string: { type: 'string' }
              },
              required: ['file_path', 'old_string', 'new_string']
            }
          }
        ],
        stream: false,
        max_tokens: 200
      });

      const options = {
        hostname: 'localhost',
        port: TEST_CONFIG.port,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'Authorization': 'Bearer test-key'
        },
        timeout: TEST_CONFIG.timeout
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve(responseData);
        });
      });

      req.on('error', (error) => {
        reject(new Error(`工具调用请求失败: ${error.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  validateResponseStructure(responseData, testCase) {
    const requiredFields = ['content', 'id', 'model', 'role', 'type', 'usage'];
    const missingFields = requiredFields.filter(field => !(field in responseData));
    
    if (missingFields.length > 0) {
      console.log(`  ⚠️  响应缺少字段: ${missingFields.join(', ')}`);
      this.results.errors.push(`响应结构不完整 (${testCase.description}): 缺少${missingFields.join(', ')}`);
    }
    
    // 检查usage字段
    if (responseData.usage) {
      if (!responseData.usage.input_tokens || !responseData.usage.output_tokens) {
        console.log(`  ⚠️  usage字段不完整`);
      }
    }
    
    // 检查content结构
    if (responseData.content && Array.isArray(responseData.content)) {
      const hasValidContent = responseData.content.some(block => 
        block.type === 'text' && block.text || 
        block.type === 'tool_use' && block.name
      );
      
      if (!hasValidContent) {
        console.log(`  ⚠️  content结构异常`);
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 综合测试报告');
    console.log('='.repeat(60));
    
    const successRate = this.results.total > 0 ? 
      Math.round((this.results.passed / this.results.total) * 100) : 0;
    
    console.log(`\n📈 总体统计:`);
    console.log(`  总测试数: ${this.results.total}`);
    console.log(`  通过: ${this.results.passed} ✅`);
    console.log(`  失败: ${this.results.failed} ❌`);
    console.log(`  成功率: ${successRate}%`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ 错误详情:`);
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log(`\n🔍 详细结果:`);
    
    // 按类型分组显示
    const mappingTests = this.results.details.filter(d => d.type === 'mapping');
    const apiTests = this.results.details.filter(d => d.type === 'api_response');
    
    if (mappingTests.length > 0) {
      console.log(`\n  📋 映射逻辑测试 (${mappingTests.length}个):`);
      mappingTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`    ${status} ${test.scenario}: ${test.actual} ${test.passed ? '' : `(期望: ${test.expected})`}`);
      });
    }
    
    if (apiTests.length > 0) {
      console.log(`\n  🌐 API响应测试 (${apiTests.length}个):`);
      apiTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`    ${status} ${test.scenario}: stop_reason=${test.actual} ${test.passed ? '' : `(期望: ${test.expected})`}`);
      });
    }
    
    console.log(`\n💡 建议:`);
    if (successRate >= 90) {
      console.log(`  🎉 测试通过率很高！系统运行良好。`);
    } else if (successRate >= 70) {
      console.log(`  ⚠️  部分测试失败，建议检查失败的具体场景。`);
    } else {
      console.log(`  🚨 多个测试失败，建议进行系统性修复。`);
    }
    
    if (this.results.failed > 0) {
      console.log(`  🔧 优先修复: finish reason映射和API响应结构问题`);
    }
    
    console.log(`\n🏁 测试完成!`);
  }
}

// 运行测试
const tester = new StopReasonTester();
tester.runAllTests().catch(console.error);