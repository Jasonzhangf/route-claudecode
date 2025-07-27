#!/usr/bin/env node

/**
 * 复现工具调用被误认为文本的问题测试
 * 基于用户报告的服务器消息记录建立的测试用例
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

class ToolIssueReproducer {
  constructor() {
    this.serverUrl = 'http://127.0.0.1:3456';
    this.testResults = [];
    this.logFile = '/tmp/tool-issue-reproduction.log';
  }

  /**
   * 记录测试日志
   */
  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  /**
   * 发送工具调用请求并分析响应
   */
  async testToolCallProcessing(testName, request) {
    this.log(`\n🧪 开始测试: ${testName}`);
    
    try {
      // 发送请求
      const response = await axios.post(`${this.serverUrl}/v1/messages`, request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'Accept': 'text/event-stream',
          'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
        },
        responseType: 'stream',
        timeout: 30000
      });

      // 解析SSE流
      const events = await this.parseSSEStream(response.data);
      
      // 分析事件
      const analysis = this.analyzeEvents(events);
      
      // 记录结果
      const testResult = {
        testName,
        success: true,
        analysis,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      this.log(`✅ 测试完成: ${testName}`, analysis);
      
      return testResult;

    } catch (error) {
      const testResult = {
        testName,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      this.log(`❌ 测试失败: ${testName}`, { error: error.message });
      
      return testResult;
    }
  }

  /**
   * 解析SSE流
   */
  async parseSSEStream(stream) {
    return new Promise((resolve, reject) => {
      const events = [];
      let buffer = '';

      const timeout = setTimeout(() => {
        reject(new Error('Stream parsing timeout'));
      }, 30000);

      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            events.push({ type: 'event', value: eventType, timestamp: Date.now() });
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              events.push({ type: 'data', value: parsed, timestamp: Date.now() });
            } catch (e) {
              events.push({ type: 'data', value: data, timestamp: Date.now() });
            }
          }
        }
      });

      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(events);
      });

      stream.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 分析事件流
   */
  analyzeEvents(events) {
    const analysis = {
      totalEvents: events.length,
      eventTypes: {},
      toolEvents: [],
      stopEvents: [],
      textEvents: [],
      issues: []
    };

    // 统计事件类型
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if (event.type === 'event') {
        analysis.eventTypes[event.value] = (analysis.eventTypes[event.value] || 0) + 1;

        // 检查工具相关事件
        if (event.value.includes('content_block')) {
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.type === 'data') {
            const eventData = {
              event: event.value,
              data: nextEvent.value,
              index: i
            };

            // 判断是否为工具调用
            if (nextEvent.value.content_block && nextEvent.value.content_block.type === 'tool_use') {
              analysis.toolEvents.push({
                ...eventData,
                toolName: nextEvent.value.content_block.name,
                toolId: nextEvent.value.content_block.id,
                toolInput: nextEvent.value.content_block.input
              });
            } else if (nextEvent.value.content_block && nextEvent.value.content_block.type === 'text') {
              analysis.textEvents.push({
                ...eventData,
                textContent: nextEvent.value.content_block.text || ''
              });
            }
          }
        }

        // 检查停止相关事件
        if (event.value.includes('stop') || event.value.includes('delta')) {
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.type === 'data') {
            analysis.stopEvents.push({
              event: event.value,
              data: nextEvent.value,
              index: i
            });
          }
        }
      }
    }

    // 检查问题
    this.detectIssues(analysis);

    return analysis;
  }

  /**
   * 检测问题
   */
  detectIssues(analysis) {
    // 检查是否有工具调用被误认为文本
    const suspiciousTextEvents = analysis.textEvents.filter(evt => {
      const text = evt.textContent || '';
      return text.includes('<function_calls>') || 
             text.includes('antml:invoke') ||
             text.includes('tool_use') ||
             text.includes('function_calls');
    });

    if (suspiciousTextEvents.length > 0) {
      analysis.issues.push({
        type: 'tool_mistaken_as_text',
        severity: 'high',
        description: '工具调用被误认为文本内容',
        events: suspiciousTextEvents
      });
    }

    // 检查停止信号
    const stopSignals = analysis.stopEvents.filter(evt => 
      (evt.data.delta && evt.data.delta.stop_reason) || 
      evt.event === 'message_stop'
    );

    if (stopSignals.length > 0) {
      analysis.issues.push({
        type: 'premature_stop',
        severity: 'medium',
        description: '检测到过早的停止信号',
        events: stopSignals
      });
    }

    // 检查工具调用完整性
    const hasToolStart = analysis.toolEvents.length > 0;
    const hasToolStop = analysis.eventTypes['content_block_stop'] > 0;

    if (hasToolStart && !hasToolStop) {
      analysis.issues.push({
        type: 'incomplete_tool_call',
        severity: 'high',
        description: '工具调用开始但没有正确结束',
        toolEvents: analysis.toolEvents
      });
    }
  }

  /**
   * 运行所有测试用例
   */
  async runAllTests() {
    console.log('🔍 开始复现工具调用问题...\n');
    
    // 清空日志文件
    fs.writeFileSync(this.logFile, '');

    // 测试用例1: 简单工具调用
    await this.testToolCallProcessing('简单工具调用', {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "请帮我读取文件 /tmp/test.txt"
        }
      ],
      tools: [
        {
          name: "Read",
          description: "读取文件内容",
          input_schema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "文件路径"
              }
            },
            required: ["file_path"]
          }
        }
      ]
    });

    // 测试用例2: 多工具调用
    await this.testToolCallProcessing('多工具调用', {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "请先读取文件 /tmp/test.txt，然后列出当前目录的文件"
        }
      ],
      tools: [
        {
          name: "Read",
          description: "读取文件内容",
          input_schema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "文件路径"
              }
            },
            required: ["file_path"]
          }
        },
        {
          name: "LS",
          description: "列出目录内容",
          input_schema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "目录路径"
              }
            },
            required: ["path"]
          }
        }
      ]
    });

    // 测试用例3: 长对话中的工具调用
    await this.testToolCallProcessing('长对话工具调用', {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "你好"
        },
        {
          role: "assistant", 
          content: "你好！有什么我可以帮助你的吗？"
        },
        {
          role: "user",
          content: "请帮我搜索文件中包含'test'的内容"
        }
      ],
      tools: [
        {
          name: "Grep",
          description: "搜索文件内容",
          input_schema: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "搜索模式"
              }
            },
            required: ["pattern"]
          }
        }
      ]
    });

    // 输出最终报告
    this.generateReport();
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 测试报告总结');
    console.log('==================');

    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`总测试数: ${totalTests}`);
    console.log(`成功: ${successfulTests}`);
    console.log(`失败: ${failedTests}`);

    // 汇总所有问题
    const allIssues = [];
    this.testResults.forEach(result => {
      if (result.analysis && result.analysis.issues) {
        allIssues.push(...result.analysis.issues.map(issue => ({
          ...issue,
          testName: result.testName
        })));
      }
    });

    if (allIssues.length > 0) {
      console.log('\n🚨 发现的问题:');
      allIssues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.testName}] ${issue.type}: ${issue.description}`);
        console.log(`   严重程度: ${issue.severity}`);
      });
    } else {
      console.log('\n✅ 未发现问题');
    }

    console.log(`\n📝 详细日志保存在: ${this.logFile}`);
  }
}

// 运行测试
const reproducer = new ToolIssueReproducer();
reproducer.runAllTests().catch(console.error);