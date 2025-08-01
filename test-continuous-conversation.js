#!/usr/bin/env node

/**
 * 标准连续对话测试 - 使用kiro-gmail配置
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

class ContinuousConversationTester {
  constructor() {
    this.baseURL = 'http://127.0.0.1:6677/v1/messages'; // kiro-gmail配置端口
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key'
    };
    this.conversationHistory = [];
    this.testResults = [];
  }

  async runStandardTests() {
    console.log('🧪 开始标准连续对话测试 (kiro-gmail配置)\n');
    
    const tests = [
      { name: '基础对话测试', method: 'testBasicConversation' },
      { name: '多轮对话测试', method: 'testMultiTurnConversation' },
      { name: '工具调用测试', method: 'testToolCall' },
      { name: '复杂工具调用测试', method: 'testComplexToolCall' },
      { name: '长连续对话测试', method: 'testLongConversation' }
    ];

    for (const test of tests) {
      console.log(`\n📝 执行: ${test.name}`);
      try {
        const result = await this[test.method]();
        this.testResults.push({
          test: test.name,
          status: 'SUCCESS',
          duration: result.duration,
          details: result
        });
        console.log(`✅ ${test.name} 通过 (${result.duration}ms)`);
      } catch (error) {
        this.testResults.push({
          test: test.name,
          status: 'FAILED',
          error: error.message,
          details: error.response?.data
        });
        console.log(`❌ ${test.name} 失败: ${error.message}`);
      }
    }

    return this.generateReport();
  }

  async testBasicConversation() {
    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        { role: "user", content: "你好，请简单介绍一下你自己" }
      ]
    };

    const startTime = Date.now();
    const response = await axios.post(this.baseURL, request, { headers: this.headers });
    const duration = Date.now() - startTime;

    this.conversationHistory.push(...request.messages);
    this.conversationHistory.push({
      role: "assistant",
      content: response.data.content
    });

    return {
      duration,
      statusCode: response.status,
      contentBlocks: response.data.content?.length || 0,
      model: response.data.model
    };
  }

  async testMultiTurnConversation() {
    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [
        ...this.conversationHistory,
        { role: "user", content: "请告诉我一个有趣的编程小技巧" }
      ]
    };

    const startTime = Date.now();
    const response = await axios.post(this.baseURL, request, { headers: this.headers });
    const duration = Date.now() - startTime;

    this.conversationHistory.push({ role: "user", content: "请告诉我一个有趣的编程小技巧" });
    this.conversationHistory.push({
      role: "assistant", 
      content: response.data.content
    });

    return {
      duration,
      statusCode: response.status,
      contentBlocks: response.data.content?.length || 0,
      historyLength: request.messages.length,
      model: response.data.model
    };
  }

  async testToolCall() {
    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        { role: "user", content: "请帮我搜索项目中所有的TypeScript文件" }
      ],
      tools: [
        {
          name: "Glob",
          description: "文件模式匹配工具",
          input_schema: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "要匹配的文件模式" }
            },
            required: ["pattern"]
          }
        }
      ]
    };

    const startTime = Date.now();
    const response = await axios.post(this.baseURL, request, { headers: this.headers });
    const duration = Date.now() - startTime;

    const hasToolCall = response.data.content?.some(block => block.type === 'tool_use');

    return {
      duration,
      statusCode: response.status,
      contentBlocks: response.data.content?.length || 0,
      hasToolCall,
      toolCalls: response.data.content?.filter(block => block.type === 'tool_use') || [],
      model: response.data.model
    };
  }

  async testComplexToolCall() {
    const request = {
      model: "claude-sonnet-4-20250514", 
      max_tokens: 300,
      messages: [
        { role: "user", content: "请帮我创建一个待办事项列表，包含3个编程任务" }
      ],
      tools: [
        {
          name: "TodoWrite",
          description: "创建待办事项",
          input_schema: {
            type: "object",
            properties: {
              todos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    content: { type: "string" },
                    status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    id: { type: "string" }
                  },
                  required: ["content", "status", "priority", "id"]
                }
              }
            },
            required: ["todos"]
          }
        }
      ]
    };

    const startTime = Date.now();
    const response = await axios.post(this.baseURL, request, { headers: this.headers });
    const duration = Date.now() - startTime;

    const toolCalls = response.data.content?.filter(block => block.type === 'tool_use') || [];
    const todoCall = toolCalls.find(call => call.name === 'TodoWrite');

    return {
      duration,
      statusCode: response.status,
      contentBlocks: response.data.content?.length || 0,
      hasComplexToolCall: !!todoCall,
      todoCount: todoCall?.input?.todos?.length || 0,
      model: response.data.model
    };
  }

  async testLongConversation() {
    // 模拟长对话历史
    const longHistory = [];
    for (let i = 0; i < 5; i++) {
      longHistory.push({ role: "user", content: `这是第${i+1}轮对话的用户消息` });
      longHistory.push({ role: "assistant", content: `这是第${i+1}轮对话的助手回复` });
    }

    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        ...longHistory,
        { role: "user", content: "请总结我们之前的对话内容" }
      ]
    };

    const startTime = Date.now();
    const response = await axios.post(this.baseURL, request, { headers: this.headers });
    const duration = Date.now() - startTime;

    return {
      duration,
      statusCode: response.status,
      contentBlocks: response.data.content?.length || 0,
      inputMessages: request.messages.length,
      model: response.data.model
    };
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testSuite: '标准连续对话测试',
      configuration: 'kiro-gmail',
      totalTests: this.testResults.length,
      passed: this.testResults.filter(r => r.status === 'SUCCESS').length,
      failed: this.testResults.filter(r => r.status === 'FAILED').length,
      results: this.testResults,
      summary: {
        successRate: `${(this.testResults.filter(r => r.status === 'SUCCESS').length / this.testResults.length * 100).toFixed(1)}%`,
        averageDuration: `${Math.round(this.testResults.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) / this.testResults.length)}ms`
      }
    };

    // 保存报告
    const reportPath = `/tmp/continuous-conversation-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 测试完成总结:');
    console.log(`   总测试数: ${report.totalTests}`); 
    console.log(`   通过: ${report.passed}`);
    console.log(`   失败: ${report.failed}`);
    console.log(`   成功率: ${report.summary.successRate}`);
    console.log(`   平均响应时间: ${report.summary.averageDuration}`);
    console.log(`   📁 详细报告: ${reportPath}`);

    return report;
  }
}

// 运行测试
async function main() {
  const tester = new ContinuousConversationTester();
  
  try {
    const report = await tester.runStandardTests();
    
    if (report.failed === 0) {
      console.log('\n🎉 所有测试通过！连续对话功能完全正常');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查详细报告');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);