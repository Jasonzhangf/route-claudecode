#!/usr/bin/env node

/**
 * Gemini Provider工具调用覆盖测试
 * 测试完整的tool use和response传递翻译流程
 * 验证是否存在静默失败和stop_reason错误处理
 */

const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
  port: 5502, // Gemini provider端口
  endpoint: 'http://localhost:5502',
  testCases: [
    {
      name: '天气查询工具调用',
      description: '测试基本工具调用的完整传递',
      request: {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: '今天北京的天气怎么样？'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: '获取指定城市的天气信息',
              parameters: {
                type: 'object',
                properties: {
                  city: {
                    type: 'string',
                    description: '城市名称'
                  }
                },
                required: ['city']
              }
            }
          }
        ]
      }
    },
    {
      name: '多工具调用场景',
      description: '测试多个工具调用的处理能力',
      request: {
        model: 'gemini-2.5-pro', 
        messages: [
          {
            role: 'user',
            content: '帮我查看当前时间，然后搜索今天的新闻'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_time',
              description: '获取当前时间',
              parameters: {
                type: 'object',
                properties: {}
              }
            }
          },
          {
            type: 'function', 
            function: {
              name: 'search_news',
              description: '搜索新闻',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: '搜索关键词'
                  }
                },
                required: ['query']
              }
            }
          }
        ]
      }
    }
  ]
};

class GeminiToolCallTester {
  constructor(config) {
    this.config = config;
    this.results = {
      passed: 0,
      failed: 0,
      issues: [],
      details: []
    };
  }

  async runAllTests() {
    console.log('🔍 开始Gemini工具调用覆盖测试...\n');

    // 检查服务可用性
    if (!(await this.checkServiceHealth())) {
      console.error('❌ Gemini服务不可用，请先启动服务');
      return false;
    }

    // 运行每个测试用例
    for (let i = 0; i < this.config.testCases.length; i++) {
      const testCase = this.config.testCases[i];
      console.log(`📋 测试 ${i + 1}/${this.config.testCases.length}: ${testCase.name}`);
      console.log(`   描述: ${testCase.description}`);
      
      await this.runTestCase(testCase, i + 1);
      console.log(''); // 空行分隔
    }

    // 输出测试结果
    this.printResults();
    
    // 保存详细报告
    await this.saveReport();
    
    return this.results.failed === 0;
  }

  async checkServiceHealth() {
    try {
      const response = await fetch(`${this.config.endpoint}/health`);
      return response.ok;
    } catch (error) {
      console.error(`健康检查失败: ${error.message}`);
      return false;
    }
  }

  async runTestCase(testCase, index) {
    const testId = `test-${index}`;
    const result = {
      name: testCase.name,
      testId,
      status: 'unknown',
      issues: [],
      timing: {},
      response: null,
      logs: []
    };

    try {
      const startTime = Date.now();

      // 发送请求
      result.logs.push(`⏱️  发送请求到 ${this.config.endpoint}/v1/messages`);
      
      const response = await fetch(`${this.config.endpoint}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(testCase.request)
      });

      result.timing.requestTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const responseData = await response.json();
      result.response = responseData;

      // 验证响应格式
      await this.validateResponse(responseData, result, testCase);

      const totalTime = Date.now() - startTime;
      result.timing.totalTime = totalTime;
      
      result.logs.push(`✅ 测试完成，总耗时: ${totalTime}ms`);
      result.status = result.issues.length === 0 ? 'passed' : 'failed';

    } catch (error) {
      result.status = 'failed';
      result.issues.push({
        type: 'CRITICAL',
        message: `测试执行失败: ${error.message}`,
        details: error.stack
      });
      result.logs.push(`❌ 测试失败: ${error.message}`);
    }

    // 更新统计
    if (result.status === 'passed') {
      this.results.passed++;
      console.log(`   ✅ 通过`);
    } else {
      this.results.failed++;
      console.log(`   ❌ 失败: ${result.issues.length} 个问题`);
      result.issues.forEach(issue => {
        console.log(`      - ${issue.type}: ${issue.message}`);
        this.results.issues.push(`${testCase.name}: ${issue.message}`);
      });
    }

    this.results.details.push(result);
  }

  async validateResponse(responseData, result, testCase) {
    // 1. 基础格式验证
    this.validateBasicFormat(responseData, result);
    
    // 2. stop_reason验证
    this.validateStopReason(responseData, result);
    
    // 3. 工具调用验证
    this.validateToolCalls(responseData, result, testCase);
    
    // 4. 内容完整性验证
    this.validateContentIntegrity(responseData, result);
    
    // 5. 静默失败检查
    this.checkSilentFailures(responseData, result);
  }

  validateBasicFormat(response, result) {
    result.logs.push('🔍 验证基础响应格式...');

    const requiredFields = ['content', 'role', 'stop_reason', 'usage'];
    
    for (const field of requiredFields) {
      if (!(field in response)) {
        result.issues.push({
          type: 'CRITICAL',
          message: `缺失必要字段: ${field}`,
          details: `Anthropic格式要求包含${field}字段`
        });
      }
    }

    if (response.role !== 'assistant') {
      result.issues.push({
        type: 'HIGH',
        message: `错误的role值: ${response.role}，期望: assistant`
      });
    }

    if (!Array.isArray(response.content)) {
      result.issues.push({
        type: 'CRITICAL', 
        message: `content字段必须为数组，当前类型: ${typeof response.content}`
      });
    }
  }

  validateStopReason(response, result) {
    result.logs.push('🔍 验证stop_reason处理...');

    const validStopReasons = ['end_turn', 'tool_use', 'max_tokens', 'stop_sequence'];
    
    if (!response.stop_reason) {
      result.issues.push({
        type: 'CRITICAL',
        message: 'stop_reason字段缺失',
        details: '这可能表明stop_reason被错误地吞掉了'
      });
      return;
    }

    if (!validStopReasons.includes(response.stop_reason)) {
      result.issues.push({
        type: 'HIGH',
        message: `无效的stop_reason: ${response.stop_reason}`,
        details: `有效值: ${validStopReasons.join(', ')}`
      });
    }

    // 检查工具调用场景下的stop_reason
    const hasToolUse = response.content && response.content.some(block => block.type === 'tool_use');
    if (hasToolUse && response.stop_reason !== 'tool_use') {
      result.issues.push({
        type: 'CRITICAL',
        message: `工具调用场景下stop_reason错误: ${response.stop_reason}，期望: tool_use`,
        details: '这是之前修复的核心问题，不应该再出现'
      });
    }
  }

  validateToolCalls(response, result, testCase) {
    result.logs.push('🔍 验证工具调用传递翻译...');

    if (!testCase.request.tools || testCase.request.tools.length === 0) {
      return; // 非工具调用测试
    }

    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      result.issues.push({
        type: 'CRITICAL',
        message: '请求包含工具但响应中没有tool_use块',
        details: '可能的原因: 工具调用被静默忽略、格式转换失败、或Gemini API拒绝调用工具'
      });
      return;
    }

    // 验证每个工具调用
    toolUseBlocks.forEach((toolBlock, index) => {
      this.validateSingleToolCall(toolBlock, index, result);
    });

    result.logs.push(`✅ 发现 ${toolUseBlocks.length} 个工具调用`);
  }

  validateSingleToolCall(toolBlock, index, result) {
    const requiredFields = ['type', 'id', 'name', 'input'];
    
    for (const field of requiredFields) {
      if (!(field in toolBlock)) {
        result.issues.push({
          type: 'CRITICAL',
          message: `工具调用${index} 缺失${field}字段`,
          details: `完整的tool_use块必须包含: ${requiredFields.join(', ')}`
        });
      }
    }

    // 验证ID格式
    if (toolBlock.id && !toolBlock.id.startsWith('toolu_')) {
      result.issues.push({
        type: 'HIGH',
        message: `工具调用${index} ID格式错误: ${toolBlock.id}`,
        details: 'Anthropic格式要求ID以toolu_开头'
      });
    }

    // 验证输入参数
    if (typeof toolBlock.input !== 'object') {
      result.issues.push({
        type: 'HIGH',
        message: `工具调用${index} input必须为对象`,
        details: `当前类型: ${typeof toolBlock.input}`
      });
    }
  }

  validateContentIntegrity(response, result) {
    result.logs.push('🔍 验证内容完整性...');

    if (response.content.length === 0) {
      result.issues.push({
        type: 'CRITICAL',
        message: '响应内容为空',
        details: '可能的静默失败：请求被处理但没有生成任何内容'
      });
      return;
    }

    // 检查是否有空的文本块
    const emptyTextBlocks = response.content.filter(block => 
      block.type === 'text' && (!block.text || block.text.trim() === '')
    );

    if (emptyTextBlocks.length > 0) {
      result.issues.push({
        type: 'MEDIUM',
        message: `发现 ${emptyTextBlocks.length} 个空文本块`,
        details: '可能表明内容生成不完整'
      });
    }
  }

  checkSilentFailures(response, result) {
    result.logs.push('🔍 检查静默失败模式...');

    // 检查是否包含fallback错误消息
    const textBlocks = response.content.filter(block => block.type === 'text');
    const fallbackMessages = [
      'I apologize, but I cannot provide a response',
      'This may be due to content filtering',
      'API limitations',
      'quota restrictions',
      'try again later'
    ];

    textBlocks.forEach(block => {
      if (block.text) {
        fallbackMessages.forEach(pattern => {
          if (block.text.includes(pattern)) {
            result.issues.push({
              type: 'HIGH',
              message: '检测到fallback错误消息',
              details: `可能的静默失败，包含模式: "${pattern}"`
            });
          }
        });
      }
    });

    // 检查usage异常低值（可能表明请求被提前终止）
    if (response.usage) {
      if (response.usage.output_tokens < 5) {
        result.issues.push({
          type: 'MEDIUM',
          message: `输出token数异常低: ${response.usage.output_tokens}`,
          details: '可能表明响应生成被提前终止'
        });
      }
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Gemini工具调用覆盖测试结果');
    console.log('='.repeat(60));
    console.log(`✅ 通过: ${this.results.passed}`);
    console.log(`❌ 失败: ${this.results.failed}`);
    console.log(`🔴 问题总数: ${this.results.issues.length}`);
    
    if (this.results.issues.length > 0) {
      console.log('\n🚨 发现的问题:');
      this.results.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }

    if (this.results.failed === 0) {
      console.log('\n🎉 所有测试通过！Gemini工具调用功能正常');
    } else {
      console.log('\n⚠️  存在问题，需要修复');
    }
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        issueCount: this.results.issues.length
      },
      issues: this.results.issues,
      details: this.results.details
    };

    const reportFile = `gemini-tool-call-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportFile}`);
  }
}

// 运行测试
async function main() {
  const tester = new GeminiToolCallTester(TEST_CONFIG);
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GeminiToolCallTester, TEST_CONFIG };