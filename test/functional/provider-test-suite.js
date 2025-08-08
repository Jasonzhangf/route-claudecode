#!/usr/bin/env node
/**
 * Provider功能验证测试套件
 * 验证所有Provider的工具调用和多轮会话功能
 * 项目所有者: Jason Zhang
 */

const { BaseRequest } = require('../src/types');
const { logger } = require('../src/utils/logger');

class ProviderTestSuite {
  constructor(provider) {
    this.provider = provider;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * 执行完整的Provider测试套件
   */
  async runCompleteTestSuite() {
    console.log(`🧪 开始测试Provider: ${this.provider.name}`);
    console.log('=' .repeat(60));

    try {
      // 1. 基础连接测试
      await this.testBasicConnection();
      
      // 2. 简单文本响应测试
      await this.testSimpleTextResponse();
      
      // 3. 工具调用测试
      await this.testSingleToolCall();
      
      // 4. 多工具调用测试
      await this.testMultipleToolCalls();
      
      // 5. 多轮会话测试
      await this.testMultiTurnConversation();
      
      // 6. 工具调用结果处理测试
      await this.testToolCallResultHandling();
      
      // 7. 流式响应测试
      await this.testStreamingResponse();

    } catch (error) {
      this.recordError('测试套件执行失败', error);
    }

    return this.generateTestReport();
  }

  /**
   * 测试基础连接
   */
  async testBasicConnection() {
    try {
      const isHealthy = await this.provider.isHealthy();
      if (isHealthy) {
        this.recordSuccess('基础连接测试');
      } else {
        this.recordFailure('基础连接测试', '健康检查失败');
      }
    } catch (error) {
      this.recordError('基础连接测试', error);
    }
  }

  /**
   * 测试简单文本响应
   */
  async testSimpleTextResponse() {
    const request = {
      model: 'default',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '你好，请回复一个简单的问候。' }]
        }
      ],
      max_tokens: 100,
      metadata: {
        requestId: `test-simple-${Date.now()}`,
        sessionId: 'test-session',
        conversationId: 'test-conversation'
      }
    };

    try {
      const response = await this.provider.sendRequest(request);
      
      if (this.validateBasicResponse(response)) {
        this.recordSuccess('简单文本响应测试');
        console.log(`✅ 响应内容: ${this.extractTextContent(response)}`);
      } else {
        this.recordFailure('简单文本响应测试', '响应格式不正确');
      }
    } catch (error) {
      this.recordError('简单文本响应测试', error);
    }
  }

  /**
   * 测试单一工具调用
   */
  async testSingleToolCall() {
    const request = {
      model: 'default',
      messages: [
        {
          role: 'user', 
          content: [{ type: 'text', text: '请帮我计算 15 + 27 的结果' }]
        }
      ],
      max_tokens: 200,
      tools: [
        {
          name: 'calculate',
          description: '执行数学计算',
          input_schema: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: '数学表达式' },
              operation: { type: 'string', description: '运算类型' }
            },
            required: ['expression']
          }
        }
      ],
      metadata: {
        requestId: `test-tool-${Date.now()}`,
        sessionId: 'test-session',
        conversationId: 'test-conversation'
      }
    };

    try {
      const response = await this.provider.sendRequest(request);
      
      if (this.validateToolCallResponse(response)) {
        this.recordSuccess('单一工具调用测试');
        console.log(`✅ 工具调用: ${this.extractToolCalls(response)}`);
      } else {
        this.recordFailure('单一工具调用测试', '未正确调用工具');
      }
    } catch (error) {
      this.recordError('单一工具调用测试', error);
    }
  }

  /**
   * 测试多工具调用
   */
  async testMultipleToolCalls() {
    const request = {
      model: 'default',
      messages: [
        {
          role: 'user',
          content: [{ 
            type: 'text', 
            text: '请帮我：1) 计算 10 + 20，2) 获取当前时间，3) 查询天气信息' 
          }]
        }
      ],
      max_tokens: 300,
      tools: [
        {
          name: 'calculate',
          description: '数学计算',
          input_schema: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression']
          }
        },
        {
          name: 'get_current_time',
          description: '获取当前时间',
          input_schema: { type: 'object', properties: {} }
        },
        {
          name: 'get_weather',
          description: '查询天气',
          input_schema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location']
          }
        }
      ],
      metadata: {
        requestId: `test-multi-tool-${Date.now()}`,
        sessionId: 'test-session',
        conversationId: 'test-conversation'
      }
    };

    try {
      const response = await this.provider.sendRequest(request);
      
      const toolCalls = this.extractToolCalls(response);
      if (toolCalls.length >= 2) {
        this.recordSuccess('多工具调用测试');
        console.log(`✅ 调用了${toolCalls.length}个工具: ${toolCalls.join(', ')}`);
      } else {
        this.recordFailure('多工具调用测试', `只调用了${toolCalls.length}个工具`);
      }
    } catch (error) {
      this.recordError('多工具调用测试', error);
    }
  }

  /**
   * 测试多轮会话
   */
  async testMultiTurnConversation() {
    const sessionId = 'test-multi-turn-session';
    const conversationId = 'test-multi-turn-conversation';

    try {
      // 第一轮：用户问题
      const request1 = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '我想学习编程，你有什么建议吗？' }]
          }
        ],
        max_tokens: 200,
        metadata: {
          requestId: `test-turn1-${Date.now()}`,
          sessionId,
          conversationId
        }
      };

      const response1 = await this.provider.sendRequest(request1);
      const firstResponse = this.extractTextContent(response1);

      // 第二轮：追问
      const request2 = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '我想学习编程，你有什么建议吗？' }]
          },
          {
            role: 'assistant',
            content: response1.content
          },
          {
            role: 'user',
            content: [{ type: 'text', text: '具体应该从哪种编程语言开始学习？' }]
          }
        ],
        max_tokens: 200,
        metadata: {
          requestId: `test-turn2-${Date.now()}`,
          sessionId,
          conversationId
        }
      };

      const response2 = await this.provider.sendRequest(request2);
      
      if (this.validateBasicResponse(response2)) {
        this.recordSuccess('多轮会话测试');
        console.log(`✅ 第一轮: ${firstResponse.substring(0, 50)}...`);
        console.log(`✅ 第二轮: ${this.extractTextContent(response2).substring(0, 50)}...`);
      } else {
        this.recordFailure('多轮会话测试', '第二轮响应格式不正确');
      }
    } catch (error) {
      this.recordError('多轮会话测试', error);
    }
  }

  /**
   * 测试工具调用结果处理
   */
  async testToolCallResultHandling() {
    try {
      // 先进行一次工具调用
      const toolCallRequest = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '请计算 5 * 8' }]
          }
        ],
        max_tokens: 200,
        tools: [
          {
            name: 'calculate',
            description: '数学计算',
            input_schema: {
              type: 'object',
              properties: { expression: { type: 'string' } },
              required: ['expression']
            }
          }
        ],
        metadata: {
          requestId: `test-tool-result-1-${Date.now()}`,
          sessionId: 'test-tool-result-session',
          conversationId: 'test-tool-result-conversation'
        }
      };

      const toolCallResponse = await this.provider.sendRequest(toolCallRequest);
      
      if (!this.validateToolCallResponse(toolCallResponse)) {
        this.recordFailure('工具调用结果处理测试', '初始工具调用失败');
        return;
      }

      // 模拟工具执行结果
      const toolResult = {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolCallResponse.content.find(c => c.type === 'tool_use')?.id,
            content: '计算结果: 5 * 8 = 40'
          }
        ]
      };

      // 发送包含工具结果的请求
      const resultRequest = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '请计算 5 * 8' }]
          },
          {
            role: 'assistant',
            content: toolCallResponse.content
          },
          toolResult
        ],
        max_tokens: 200,
        metadata: {
          requestId: `test-tool-result-2-${Date.now()}`,
          sessionId: 'test-tool-result-session',
          conversationId: 'test-tool-result-conversation'
        }
      };

      const finalResponse = await this.provider.sendRequest(resultRequest);
      
      if (this.validateBasicResponse(finalResponse)) {
        this.recordSuccess('工具调用结果处理测试');
        console.log(`✅ 工具结果处理: ${this.extractTextContent(finalResponse).substring(0, 80)}...`);
      } else {
        this.recordFailure('工具调用结果处理测试', '工具结果处理响应不正确');
      }
    } catch (error) {
      this.recordError('工具调用结果处理测试', error);
    }
  }

  /**
   * 测试流式响应
   */
  async testStreamingResponse() {
    const request = {
      model: 'default',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请写一首关于春天的短诗。' }]
        }
      ],
      max_tokens: 150,
      metadata: {
        requestId: `test-stream-${Date.now()}`,
        sessionId: 'test-stream-session',
        conversationId: 'test-stream-conversation'
      }
    };

    try {
      let chunkCount = 0;
      let hasContent = false;
      let hasMessageStart = false;
      let hasMessageStop = false;

      for await (const chunk of this.provider.sendStreamRequest(request)) {
        chunkCount++;
        
        if (chunk.event === 'message_start') {
          hasMessageStart = true;
        } else if (chunk.event === 'content_block_delta') {
          hasContent = true;
        } else if (chunk.event === 'message_stop') {
          hasMessageStop = true;
        }

        // 限制处理的chunk数量，避免无限循环
        if (chunkCount > 100) break;
      }

      if (hasMessageStart && hasContent && hasMessageStop && chunkCount > 0) {
        this.recordSuccess('流式响应测试');
        console.log(`✅ 流式响应: 收到${chunkCount}个chunks`);
      } else {
        this.recordFailure('流式响应测试', `流式响应不完整: ${chunkCount}个chunks, start:${hasMessageStart}, content:${hasContent}, stop:${hasMessageStop}`);
      }
    } catch (error) {
      this.recordError('流式响应测试', error);
    }
  }

  /**
   * 验证基础响应格式
   */
  validateBasicResponse(response) {
    return response && 
           response.content && 
           Array.isArray(response.content) &&
           response.content.length > 0 &&
           response.stop_reason &&
           response.role === 'assistant';
  }

  /**
   * 验证工具调用响应
   */
  validateToolCallResponse(response) {
    if (!this.validateBasicResponse(response)) return false;
    
    const hasToolUse = response.content.some(c => c.type === 'tool_use');
    const correctStopReason = response.stop_reason === 'tool_use';
    
    return hasToolUse && correctStopReason;
  }

  /**
   * 提取文本内容
   */
  extractTextContent(response) {
    const textBlocks = response.content.filter(c => c.type === 'text');
    return textBlocks.map(c => c.text).join('');
  }

  /**
   * 提取工具调用
   */
  extractToolCalls(response) {
    const toolCalls = response.content.filter(c => c.type === 'tool_use');
    return toolCalls.map(c => c.name);
  }

  /**
   * 记录成功
   */
  recordSuccess(testName) {
    this.testResults.passed++;
    console.log(`✅ ${testName}: 通过`);
  }

  /**
   * 记录失败
   */
  recordFailure(testName, reason) {
    this.testResults.failed++;
    this.testResults.errors.push({ test: testName, type: 'failure', reason });
    console.log(`❌ ${testName}: 失败 - ${reason}`);
  }

  /**
   * 记录错误
   */
  recordError(testName, error) {
    this.testResults.failed++;
    this.testResults.errors.push({ 
      test: testName, 
      type: 'error', 
      error: error.message || String(error) 
    });
    console.log(`🚨 ${testName}: 错误 - ${error.message || String(error)}`);
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    const total = this.testResults.passed + this.testResults.failed;
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;

    const report = {
      provider: this.provider.name,
      providerType: this.provider.type,
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: `${successRate}%`
      },
      errors: this.testResults.errors,
      status: this.testResults.failed === 0 ? 'PASS' : 'FAIL'
    };

    console.log('\n📊 测试报告');
    console.log('=' .repeat(40));
    console.log(`Provider: ${report.provider} (${report.providerType})`);
    console.log(`总测试: ${report.summary.total}`);
    console.log(`通过: ${report.summary.passed}`);
    console.log(`失败: ${report.summary.failed}`);
    console.log(`成功率: ${report.summary.successRate}`);
    console.log(`状态: ${report.status}`);

    if (report.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      report.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.test}: ${error.reason || error.error}`);
      });
    }

    return report;
  }
}

module.exports = { ProviderTestSuite };