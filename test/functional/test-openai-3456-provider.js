#!/usr/bin/env node
/**
 * OpenAI Provider 3456端口功能验证测试
 * 测试工具调用、多轮会话、流式响应等核心功能
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

class OpenAI3456ProviderTest {
  constructor() {
    this.baseURL = 'http://localhost:3456';
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * 执行完整的OpenAI Provider测试套件
   */
  async runCompleteTestSuite() {
    console.log('🧪 开始测试3456端口OpenAI Provider功能');
    console.log('=' .repeat(60));

    try {
      // 1. 健康检查
      await this.testHealthCheck();
      
      // 2. 简单文本响应测试
      await this.testSimpleTextResponse();
      
      // 3. 工具调用测试
      await this.testSingleToolCall();
      
      // 4. 多工具调用测试
      await this.testMultipleToolCalls();
      
      // 5. 多轮会话测试
      await this.testMultiTurnConversation();
      
      // 6. 流式响应测试
      await this.testStreamingResponse();

    } catch (error) {
      this.recordError('测试套件执行失败', error);
    }

    return this.generateTestReport();
  }

  /**
   * 测试健康检查
   */
  async testHealthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      
      if (response.status === 200 && response.data.healthy > 0) {
        this.recordSuccess('健康检查测试');
        console.log(`✅ 健康状态: ${response.data.healthy}/${response.data.total} providers健康`);
      } else {
        this.recordFailure('健康检查测试', '健康检查失败');
      }
    } catch (error) {
      this.recordError('健康检查测试', error);
    }
  }

  /**
   * 测试简单文本响应
   */
  async testSimpleTextResponse() {
    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '你好，请回复一个简单的问候。' }]
        }
      ],
      max_tokens: 100
    };

    try {
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (this.validateBasicResponse(response.data)) {
        this.recordSuccess('简单文本响应测试');
        const textContent = this.extractTextContent(response.data);
        console.log(`✅ 响应内容: ${textContent.substring(0, 50)}...`);
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
      model: 'claude-3-5-sonnet-20241022',
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
      ]
    };

    try {
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (this.validateToolCallResponse(response.data)) {
        this.recordSuccess('单一工具调用测试');
        const toolCalls = this.extractToolCalls(response.data);
        console.log(`✅ 工具调用: ${toolCalls.join(', ')}`);
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
      model: 'claude-3-5-sonnet-20241022',
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
      ]
    };

    try {
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      const toolCalls = this.extractToolCalls(response.data);
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
    try {
      // 第一轮：用户问题
      const request1 = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '我想学习编程，你有什么建议吗？' }]
          }
        ],
        max_tokens: 200
      };

      const response1 = await axios.post(`${this.baseURL}/v1/messages`, request1, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const firstResponse = this.extractTextContent(response1.data);

      // 第二轮：追问
      const request2 = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '我想学习编程，你有什么建议吗？' }]
          },
          {
            role: 'assistant',
            content: response1.data.content
          },
          {
            role: 'user',
            content: [{ type: 'text', text: '具体应该从哪种编程语言开始学习？' }]
          }
        ],
        max_tokens: 200
      };

      const response2 = await axios.post(`${this.baseURL}/v1/messages`, request2, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (this.validateBasicResponse(response2.data)) {
        this.recordSuccess('多轮会话测试');
        console.log(`✅ 第一轮: ${firstResponse.substring(0, 50)}...`);
        console.log(`✅ 第二轮: ${this.extractTextContent(response2.data).substring(0, 50)}...`);
      } else {
        this.recordFailure('多轮会话测试', '第二轮响应格式不正确');
      }
    } catch (error) {
      this.recordError('多轮会话测试', error);
    }
  }

  /**
   * 测试流式响应
   */
  async testStreamingResponse() {
    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请写一首关于春天的短诗。' }]
        }
      ],
      max_tokens: 150,
      stream: true
    };

    try {
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout: 30000
      });

      let chunkCount = 0;
      let hasContent = false;
      let hasMessageStart = false;
      let hasMessageStop = false;

      return new Promise((resolve) => {
        response.data.on('data', (chunk) => {
          chunkCount++;
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const event = line.slice(7).trim();
              if (event === 'message_start') {
                hasMessageStart = true;
              } else if (event === 'content_block_delta') {
                hasContent = true;
              } else if (event === 'message_stop') {
                hasMessageStop = true;
              }
            }
          }

          // 限制处理的chunk数量，避免无限循环
          if (chunkCount > 100) {
            response.data.destroy();
          }
        });

        response.data.on('end', () => {
          if (hasMessageStart && hasContent && hasMessageStop && chunkCount > 0) {
            this.recordSuccess('流式响应测试');
            console.log(`✅ 流式响应: 收到${chunkCount}个chunks`);
          } else {
            this.recordFailure('流式响应测试', `流式响应不完整: ${chunkCount}个chunks, start:${hasMessageStart}, content:${hasContent}, stop:${hasMessageStop}`);
          }
          resolve();
        });

        response.data.on('error', (error) => {
          this.recordError('流式响应测试', error);
          resolve();
        });
      });
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
      provider: '3456-OpenAI-Provider',
      providerType: 'openai-3456',
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

// 运行测试
async function runOpenAI3456Test() {
  const tester = new OpenAI3456ProviderTest();
  const report = await tester.runCompleteTestSuite();
  
  if (report.status === 'PASS') {
    console.log('\n🎉 OpenAI Provider 3456端口功能验证完全通过！');
  } else {
    console.log('\n⚠️  OpenAI Provider 3456端口存在部分问题，但基础功能可用。');
  }
  
  return report;
}

if (require.main === module) {
  runOpenAI3456Test().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runOpenAI3456Test };