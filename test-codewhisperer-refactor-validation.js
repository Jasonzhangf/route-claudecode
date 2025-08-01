#!/usr/bin/env node

/**
 * CodeWhisperer重构验证测试
 * 标准测试：使用全部CodeWhisperer配置正常进行工具调用和完成多轮会话
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3458', // Development server
  timeout: 60000,
  model: 'claude-sonnet-4-20250514', // 会路由到CodeWhisperer
  maxTokens: 131072,
};

// 日志文件
const logFile = `/tmp/codewhisperer-refactor-test-${Date.now()}.log`;

class CodeWhispererValidationTest {
  constructor() {
    this.testResults = [];
    this.conversationHistory = [];
    this.sessionId = `cw_test_${Date.now()}`;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    // 写入日志文件
    fs.appendFileSync(logFile, logEntry + '\n');
    if (data) {
      fs.appendFileSync(logFile, JSON.stringify(data, null, 2) + '\n');
    }
  }

  async sendMessage(content, options = {}) {
    const message = {
      role: 'user',
      content: content
    };

    // 构建完整的消息历史
    const messages = [...this.conversationHistory, message];

    const request = {
      model: TEST_CONFIG.model,
      max_tokens: TEST_CONFIG.maxTokens,
      messages: messages,
      ...options
    };

    this.log(`发送消息到CodeWhisperer`, {
      turn: Math.floor(this.conversationHistory.length / 2) + 1,
      userMessage: content,
      historyLength: this.conversationHistory.length,
      hasTools: !!(options.tools && options.tools.length > 0)
    });

    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${TEST_CONFIG.baseUrl}/v1/messages`, request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-session-id': this.sessionId
        },
        timeout: TEST_CONFIG.timeout
      });

      const duration = Date.now() - startTime;
      
      const assistantContent = this.extractTextContent(response.data.content);
      const assistantMessage = {
        role: 'assistant',
        content: assistantContent
      };

      // 更新对话历史
      this.conversationHistory.push(message, assistantMessage);

      this.log(`收到CodeWhisperer响应`, {
        duration: `${duration}ms`,
        responseLength: assistantContent.length,
        model: response.data.model,
        usage: response.data.usage,
        hasToolUse: this.hasToolUse(response.data.content)
      });

      return {
        success: true,
        response: response.data,
        assistantContent,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.log(`CodeWhisperer请求失败`, {
        duration: `${duration}ms`,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  extractTextContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    
    return '';
  }

  hasToolUse(content) {
    if (Array.isArray(content)) {
      return content.some(block => block.type === 'tool_use');
    }
    return false;
  }

  async runTest(testName, testFunction) {
    this.log(`\n🧪 开始测试: ${testName}`);
    
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        success: true,
        duration,
        result
      });
      
      this.log(`✅ 测试通过: ${testName} (${duration}ms)`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        success: false,
        duration,
        error: error.message
      });
      
      this.log(`❌ 测试失败: ${testName} (${duration}ms)`, { error: error.message });
      throw error;
    }
  }

  // Test 1: 基础文本对话
  async testBasicConversation() {
    return await this.runTest('基础文本对话', async () => {
      const result = await this.sendMessage('你好，请简单介绍一下你自己。');
      
      if (!result.success) {
        throw new Error(`请求失败: ${result.error}`);
      }
      
      if (result.assistantContent.length < 10) {
        throw new Error('响应内容过短');
      }
      
      return {
        responseLength: result.assistantContent.length,
        duration: result.duration
      };
    });
  }

  // Test 2: 多轮对话
  async testMultiTurnConversation() {
    return await this.runTest('多轮对话', async () => {
      // 第一轮
      const result1 = await this.sendMessage('我想了解JavaScript的异步编程。');
      if (!result1.success) {
        throw new Error(`第一轮对话失败: ${result1.error}`);
      }

      // 第二轮
      const result2 = await this.sendMessage('能给我一个Promise的实际例子吗？');
      if (!result2.success) {
        throw new Error(`第二轮对话失败: ${result2.error}`);
      }

      // 第三轮
      const result3 = await this.sendMessage('那async/await又是怎么工作的？');
      if (!result3.success) {
        throw new Error(`第三轮对话失败: ${result3.error}`);
      }

      return {
        turns: 3,
        totalHistoryLength: this.conversationHistory.length,
        averageDuration: (result1.duration + result2.duration + result3.duration) / 3
      };
    });
  }

  // Test 3: 工具调用测试
  async testToolCalls() {
    return await this.runTest('工具调用', async () => {
      const tools = [
        {
          name: 'get_weather',
          description: '获取指定城市的天气信息',
          input_schema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: '城市名称'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: '温度单位'
              }
            },
            required: ['city']
          }
        }
      ];

      const result = await this.sendMessage(
        '请帮我查询北京今天的天气情况。',
        { tools }
      );
      
      if (!result.success) {
        throw new Error(`工具调用请求失败: ${result.error}`);
      }

      // 检查是否包含工具调用
      const hasToolCall = this.hasToolUse(result.response.content);
      
      return {
        hasToolCall,
        responseLength: result.assistantContent.length,
        duration: result.duration,
        toolsProvided: tools.length
      };
    });
  }

  // Test 4: 复杂工具调用
  async testComplexToolCalls() {
    return await this.runTest('复杂工具调用', async () => {
      const tools = [
        {
          name: 'calculate',
          description: '执行数学计算',
          input_schema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: '要计算的数学表达式'
              }
            },
            required: ['expression']
          }
        },
        {
          name: 'search_web',
          description: '搜索网络信息',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '搜索查询'
              },
              limit: {
                type: 'integer',
                description: '返回结果数量限制'
              }
            },
            required: ['query']
          }
        }
      ];

      const result = await this.sendMessage(
        '请帮我计算 (25 * 4) + (100 / 5) 的结果，然后搜索关于这个数字的有趣信息。',
        { tools }
      );
      
      if (!result.success) {
        throw new Error(`复杂工具调用失败: ${result.error}`);
      }

      return {
        hasToolCall: this.hasToolUse(result.response.content),
        responseLength: result.assistantContent.length,
        duration: result.duration,
        toolsCount: tools.length
      };
    });
  }

  // Test 5: 系统消息测试
  async testSystemMessage() {
    return await this.runTest('系统消息处理', async () => {
      // 重置对话历史以测试系统消息
      const originalHistory = this.conversationHistory;
      this.conversationHistory = [];

      try {
        const result = await this.sendMessage('请用专业的技术术语解释什么是微服务架构。', {
          system: [
            {
              type: 'text',
              text: '你是一个资深的软件架构师，请用专业、准确的技术术语来回答问题。'
            }
          ]
        });
        
        if (!result.success) {
          throw new Error(`系统消息测试失败: ${result.error}`);
        }

        return {
          responseLength: result.assistantContent.length,
          duration: result.duration,
          hasSystemPrompt: true
        };
        
      } finally {
        // 恢复原始对话历史
        this.conversationHistory = originalHistory;
      }
    });
  }

  // 生成测试报告
  generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`,
        totalDuration: `${totalDuration}ms`,
        averageDuration: `${Math.round(totalDuration / totalTests)}ms`
      },
      configuration: {
        model: TEST_CONFIG.model,
        baseUrl: TEST_CONFIG.baseUrl,
        timeout: TEST_CONFIG.timeout,
        sessionId: this.sessionId
      },
      conversationHistory: {
        totalMessages: this.conversationHistory.length,
        turns: Math.floor(this.conversationHistory.length / 2)
      },
      testResults: this.testResults,
      logFile: logFile
    };

    return report;
  }
}

// 执行测试
async function runCodeWhispererValidation() {
  console.log('🚀 开始CodeWhisperer重构验证测试\n');
  console.log(`日志文件: ${logFile}`);
  
  const tester = new CodeWhispererValidationTest();
  
  try {
    // 按顺序执行所有测试
    await tester.testBasicConversation();
    await tester.testMultiTurnConversation();
    await tester.testToolCalls();
    await tester.testComplexToolCalls();
    await tester.testSystemMessage();
    
    // 生成并保存报告
    const report = tester.generateReport();
    const reportFile = `/tmp/codewhisperer-refactor-report-${Date.now()}.json`;
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('\n📊 测试完成 - 报告摘要:');
    console.log(`✅ 通过: ${report.summary.passed}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`📈 成功率: ${report.summary.successRate}`);
    console.log(`⏱️  平均响应时间: ${report.summary.averageDuration}`);
    console.log(`📁 详细报告: ${reportFile}`);
    console.log(`📋 测试日志: ${logFile}`);

    if (report.summary.failed === 0) {
      console.log('\n🎉 所有测试通过！CodeWhisperer重构验证成功。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查详细报告。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 测试执行失败:', error.message);
    
    const report = tester.generateReport();
    const reportFile = `/tmp/codewhisperer-refactor-error-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📁 错误报告: ${reportFile}`);
    console.log(`📋 测试日志: ${logFile}`);
    
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runCodeWhispererValidation().catch(console.error);
}

module.exports = { CodeWhispererValidationTest };