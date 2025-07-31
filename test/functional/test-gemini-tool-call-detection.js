#!/usr/bin/env node

/**
 * Test: Gemini工具调用智能检测与处理
 * 
 * 测试目标：
 * 1. 验证Gemini响应中工具调用的正确检测
 * 2. 测试智能缓冲策略：工具调用使用缓冲，纯文本使用流式
 * 3. 确保工具调用解析格式正确
 */

const https = require('https');
const http = require('http');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8888',
  timeout: 120000, // 2分钟超时
  testCases: [
    {
      name: '工具调用测试',
      description: '包含WebSearch工具调用的请求',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: '请帮我搜索今天的天气情况，并告诉我应该穿什么衣服'
          }
        ],
        tools: [
          {
            name: 'WebSearch',
            description: '搜索互联网信息',
            input_schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '搜索查询词'
                }
              },
              required: ['query']
            }
          }
        ]
      },
      expectedStrategy: 'tool-buffered',
      expectedIndicators: ['function_call', 'tool_call', 'functionCall', 'WebSearch']
    },
    {
      name: '纯文本测试',
      description: '不包含工具调用的普通文本请求',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: '请写一首关于春天的诗'
          }
        ]
      },
      expectedStrategy: 'text-streaming',
      expectedIndicators: []
    }
  ]
};

class GeminiToolTestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };
  }

  async runAllTests() {
    console.log('🧪 Gemini工具调用智能检测测试');
    console.log('=' + '='.repeat(50));
    
    for (const testCase of TEST_CONFIG.testCases) {
      console.log(`\n📋 测试用例: ${testCase.name}`);
      console.log(`   描述: ${testCase.description}`);
      console.log(`   预期策略: ${testCase.expectedStrategy}`);
      
      const result = await this.runSingleTest(testCase);
      this.results.details.push(result);
      
      if (result.success) {
        console.log(`   ✅ PASS - ${result.message}`);
        this.results.passed++;
      } else {
        console.log(`   ❌ FAIL - ${result.message}`);
        this.results.failed++;
      }
      this.results.total++;
    }
    
    this.printSummary();
  }

  async runSingleTest(testCase) {
    const startTime = Date.now();
    
    try {
      // 发送请求
      const response = await this.sendStreamingRequest(testCase.request);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 分析响应
      const analysis = this.analyzeResponse(response, testCase);
      
      return {
        testCase: testCase.name,
        success: analysis.success,
        message: analysis.message,
        duration: duration,
        details: {
          statusCode: response.statusCode,
          eventCount: response.events.length,
          hasContent: response.hasContent,
          contentLength: response.contentLength,
          outputTokens: response.outputTokens,
          detectedStrategy: analysis.detectedStrategy,
          toolCallIndicators: analysis.toolCallIndicators,
          rawResponse: response.rawData.slice(0, 500) // 前500字符用于调试
        }
      };
      
    } catch (error) {
      return {
        testCase: testCase.name,
        success: false,
        message: `测试执行失败: ${error.message}`,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async sendStreamingRequest(requestData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'localhost',
        port: 8888,
        path: '/v1/messages?beta=true',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'text/event-stream'
        },
        timeout: TEST_CONFIG.timeout
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        const events = [];
        let hasContent = false;
        let contentLength = 0;
        let outputTokens = 0;

        res.on('data', (chunk) => {
          rawData += chunk.toString();
          
          // 解析SSE事件
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                events.push(eventData);
                
                // 检测内容和token
                if (eventData.type === 'content_block_delta' && eventData.delta?.text) {
                  hasContent = true;
                  contentLength += eventData.delta.text.length;
                }
                
                if (eventData.type === 'message_delta' && eventData.usage?.output_tokens) {
                  outputTokens = eventData.usage.output_tokens;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            events: events,
            hasContent: hasContent,
            contentLength: contentLength,
            outputTokens: outputTokens,
            rawData: rawData
          });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  analyzeResponse(response, testCase) {
    const analysis = {
      success: false,
      message: '',
      detectedStrategy: 'unknown',
      toolCallIndicators: []
    };

    // 基本检查
    if (response.statusCode !== 200) {
      analysis.message = `HTTP错误: ${response.statusCode}`;
      return analysis;
    }

    if (response.events.length === 0) {
      analysis.message = '没有接收到流式事件';
      return analysis;
    }

    if (!response.hasContent) {
      analysis.message = '没有接收到内容';
      return analysis;
    }

    // 检测工具调用指示器
    const rawText = response.rawData.toLowerCase();
    for (const indicator of testCase.expectedIndicators) {
      if (rawText.includes(indicator.toLowerCase())) {
        analysis.toolCallIndicators.push(indicator);
      }
    }

    // 根据测试用例判断策略检测
    if (testCase.expectedStrategy === 'tool-buffered') {
      // 工具调用测试
      if (analysis.toolCallIndicators.length > 0) {
        analysis.detectedStrategy = 'tool-buffered';
        analysis.success = true;
        analysis.message = `工具调用正确检测，发现指示器: ${analysis.toolCallIndicators.join(', ')}`;
      } else {
        analysis.detectedStrategy = 'text-streaming';
        analysis.message = `未检测到工具调用指示器，可能处理有误`;
      }
    } else {
      // 纯文本测试
      if (analysis.toolCallIndicators.length === 0) {
        analysis.detectedStrategy = 'text-streaming';
        analysis.success = true;
        analysis.message = `纯文本正确处理，智能流式策略生效`;
      } else {
        analysis.detectedStrategy = 'tool-buffered';
        analysis.message = `意外检测到工具调用指示器: ${analysis.toolCallIndicators.join(', ')}`;
      }
    }

    // Token检查
    if (response.outputTokens === 0) {
      analysis.success = false;
      analysis.message += ` (警告: outputTokens=0，可能存在token计算问题)`;
    }

    return analysis;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果总结');
    console.log('='.repeat(60));
    console.log(`总测试数: ${this.results.total}`);
    console.log(`通过: ${this.results.passed}`);
    console.log(`失败: ${this.results.failed}`);
    console.log(`成功率: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    console.log('\n📋 详细结果:');
    for (const result of this.results.details) {
      console.log(`\n🔍 ${result.testCase}:`);
      console.log(`   状态: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   耗时: ${result.duration}ms`);
      console.log(`   消息: ${result.message}`);
      
      if (result.details) {
        console.log(`   事件数: ${result.details.eventCount}`);
        console.log(`   内容长度: ${result.details.contentLength}`);
        console.log(`   输出Tokens: ${result.details.outputTokens}`);
        console.log(`   检测策略: ${result.details.detectedStrategy}`);
        
        if (result.details.toolCallIndicators.length > 0) {
          console.log(`   工具调用指示器: ${result.details.toolCallIndicators.join(', ')}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.results.failed > 0) {
      console.log('❌ 部分测试失败，需要检查Gemini工具调用处理逻辑');
      process.exit(1);
    } else {
      console.log('✅ 所有测试通过，Gemini智能缓冲策略工作正常');
      process.exit(0);
    }
  }
}

// 主函数
async function main() {
  const runner = new GeminiToolTestRunner();
  await runner.runAllTests();
}

// 异常处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}