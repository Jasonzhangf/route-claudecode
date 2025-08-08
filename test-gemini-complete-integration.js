#!/usr/bin/env node
/**
 * Gemini完整集成测试 - Provider + Transformer
 * 项目所有者: Jason Zhang
 */

const path = require('path');
const fs = require('fs');

// 设置环境变量
process.env.RCC_PORT = process.env.RCC_PORT || '5502';

class GeminiIntegrationTester {
  constructor() {
    this.results = {
      testName: 'Gemini Complete Integration Test',
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runTest(testName, testFn) {
    this.log(`开始测试: ${testName}`);
    this.results.summary.total++;
    
    const testResult = {
      name: testName,
      status: 'failed',
      startTime: Date.now(),
      error: null,
      details: {}
    };

    try {
      const result = await testFn();
      testResult.status = 'passed';
      testResult.details = result || {};
      this.results.summary.passed++;
      this.log(`测试通过: ${testName}`, 'success');
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      this.results.summary.failed++;
      this.log(`测试失败: ${testName} - ${error.message}`, 'error');
    }

    testResult.duration = Date.now() - testResult.startTime;
    this.results.tests.push(testResult);
  }

  async testGeminiServiceConnection() {
    // 测试端口5502的Gemini服务是否可用
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5502,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            connected: true,
            statusCode: res.statusCode,
            response: data.substring(0, 100)
          });
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Gemini服务连接失败: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Gemini服务连接超时'));
      });
      
      req.end();
    });
  }

  async testGeminiProviderBasicResponse() {
    const { GeminiClient } = require('./dist/providers/gemini/client');
    
    const config = {
      endpoint: 'http://localhost:5502',
      defaultModel: 'gemini-2.0-flash-exp',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.GEMINI_API_KEY || 'test-key-gemini'
        }
      }
    };

    const client = new GeminiClient(config, 'integration-test-client');
    
    const basicRequest = {
      model: "gemini-2.0-flash-exp",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: "Say 'Hello World' and nothing else."
        }
      ],
      metadata: {
        requestId: 'integration-basic-' + Date.now()
      }
    };

    const response = await client.createCompletion(basicRequest);
    
    return {
      hasResponse: !!response,
      responseType: response?.type,
      responseRole: response?.role,
      hasContent: !!response.content && response.content.length > 0,
      firstContentType: response.content?.[0]?.type,
      firstContentText: response.content?.[0]?.text?.substring(0, 50),
      hasModel: !!response.model,
      hasId: !!response.id,
      hasUsage: !!response.usage,
      stopReason: response.stop_reason,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens
    };
  }

  async testGeminiProviderToolResponse() {
    const { GeminiClient } = require('./dist/providers/gemini/client');
    
    const config = {
      endpoint: 'http://localhost:5502',
      defaultModel: 'gemini-2.0-flash-exp',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.GEMINI_API_KEY || 'test-key-gemini'
        }
      }
    };

    const client = new GeminiClient(config, 'tool-integration-test');
    
    const toolRequest = {
      model: "gemini-2.0-flash-exp",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: "Use the calculate tool to compute 25 * 8."
        }
      ],
      tools: [
        {
          name: "calculate",
          description: "Perform mathematical calculations",
          input_schema: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "Mathematical expression to evaluate"
              }
            },
            required: ["expression"]
          }
        }
      ],
      metadata: {
        requestId: 'integration-tool-' + Date.now()
      }
    };

    const response = await client.createCompletion(toolRequest);
    
    // 分析响应中的工具调用
    const toolUseBlocks = response.content?.filter(block => block.type === 'tool_use') || [];
    const textBlocks = response.content?.filter(block => block.type === 'text') || [];
    
    return {
      hasResponse: !!response,
      hasContent: !!response.content && response.content.length > 0,
      totalContentBlocks: response.content?.length || 0,
      hasTextBlocks: textBlocks.length > 0,
      textBlockCount: textBlocks.length,
      hasToolUseBlocks: toolUseBlocks.length > 0,
      toolUseBlockCount: toolUseBlocks.length,
      firstToolName: toolUseBlocks[0]?.name,
      firstToolId: toolUseBlocks[0]?.id,
      firstToolInput: toolUseBlocks[0]?.input,
      stopReason: response.stop_reason,
      hasUsage: !!response.usage
    };
  }

  async testGeminiStreamingResponse() {
    const { GeminiClient } = require('./dist/providers/gemini/client');
    
    const config = {
      endpoint: 'http://localhost:5502',
      defaultModel: 'gemini-2.0-flash-exp',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.GEMINI_API_KEY || 'test-key-gemini'
        }
      }
    };

    const client = new GeminiClient(config, 'streaming-test');
    
    const streamRequest = {
      model: "gemini-2.0-flash-exp",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Count from 1 to 3, each number on a new line."
        }
      ],
      metadata: {
        requestId: 'integration-stream-' + Date.now()
      }
    };

    const events = [];
    let messageStartReceived = false;
    let contentReceived = false;
    let messageStopReceived = false;
    let totalTextLength = 0;

    for await (const chunk of client.streamCompletion(streamRequest)) {
      events.push(chunk.event);
      
      if (chunk.event === 'message_start') {
        messageStartReceived = true;
      } else if (chunk.event === 'content_block_delta') {
        contentReceived = true;
        if (chunk.data?.delta?.text) {
          totalTextLength += chunk.data.delta.text.length;
        }
      } else if (chunk.event === 'message_stop') {
        messageStopReceived = true;
      }
    }
    
    return {
      totalEvents: events.length,
      messageStartReceived,
      contentReceived,
      messageStopReceived,
      totalTextLength,
      eventTypes: [...new Set(events)],
      hasCompleteFlow: messageStartReceived && contentReceived && messageStopReceived
    };
  }

  async testResponseParsing() {
    // 测试不同类型响应的解析能力
    const { transformGeminiToAnthropic } = require('./dist/transformers/gemini');
    
    const testCases = [
      {
        name: '纯文本响应',
        geminiResponse: {
          candidates: [
            {
              content: {
                parts: [{ text: "This is a simple text response." }],
                role: 'model'
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 8, totalTokenCount: 13 }
        }
      },
      {
        name: '工具调用响应',
        geminiResponse: {
          candidates: [
            {
              content: {
                parts: [
                  { text: "I'll calculate that for you." },
                  { 
                    functionCall: {
                      name: "calculate",
                      args: { expression: "25 * 8" }
                    }
                  }
                ],
                role: 'model'
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 15, totalTokenCount: 25 }
        }
      },
      {
        name: '错误响应',
        geminiResponse: {
          candidates: [
            {
              content: {
                parts: [{ text: "I apologize, but I encountered an error." }],
                role: 'model'
              },
              finishReason: 'OTHER'
            }
          ]
        }
      }
    ];

    const results = {};
    
    for (const testCase of testCases) {
      try {
        const anthropicResponse = transformGeminiToAnthropic(
          testCase.geminiResponse,
          'gemini-2.0-flash-exp',
          `parse-test-${testCase.name}`
        );
        
        results[testCase.name] = {
          success: true,
          hasContent: !!anthropicResponse.content && anthropicResponse.content.length > 0,
          contentBlocks: anthropicResponse.content?.length || 0,
          hasTextBlock: anthropicResponse.content?.some(b => b.type === 'text') || false,
          hasToolUse: anthropicResponse.content?.some(b => b.type === 'tool_use') || false,
          stopReason: anthropicResponse.stop_reason,
          hasUsage: !!anthropicResponse.usage
        };
      } catch (error) {
        results[testCase.name] = {
          success: false,
          error: error.message
        };
      }
    }
    
    return results;
  }

  generateReport() {
    const successRate = this.results.summary.total > 0 
      ? Math.round((this.results.summary.passed / this.results.summary.total) * 100)
      : 0;

    console.log('\n' + '='.repeat(70));
    console.log('📊 Gemini完整集成测试报告');
    console.log('='.repeat(70));
    
    console.log(`📅 测试时间: ${this.results.timestamp}`);
    console.log(`📈 测试统计: ${this.results.summary.passed}/${this.results.summary.total} 通过 (${successRate}%)`);
    
    console.log('\n🧪 测试详情:');
    this.results.tests.forEach((test, index) => {
      const status = test.status === 'passed' ? '✅' : '❌';
      const duration = `${test.duration}ms`;
      console.log(`   ${index + 1}. ${status} ${test.name} (${duration})`);
      
      if (test.error) {
        console.log(`      错误: ${test.error}`);
      }
    });

    // 功能验证总结
    console.log('\n🔍 集成功能验证:');
    const servicePassed = this.results.tests.find(t => t.name.includes('服务连接'))?.status === 'passed';
    const basicResponsePassed = this.results.tests.find(t => t.name.includes('基础响应'))?.status === 'passed';
    const toolResponsePassed = this.results.tests.find(t => t.name.includes('工具响应'))?.status === 'passed';
    const streamingPassed = this.results.tests.find(t => t.name.includes('流式响应'))?.status === 'passed';
    const parsingPassed = this.results.tests.find(t => t.name.includes('响应解析'))?.status === 'passed';

    console.log(`   🌐 服务连接: ${servicePassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   💬 基础响应: ${basicResponsePassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔧 工具响应: ${toolResponsePassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   📡 流式响应: ${streamingPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔍 响应解析: ${parsingPassed ? '✅ 正常' : '❌ 失败'}`);

    if (successRate >= 90) {
      console.log('\n🎉 Gemini集成状态: 优秀');
      console.log('   Provider和Transformer完全集成工作正常');
    } else if (successRate >= 70) {
      console.log('\n⚠️ Gemini集成状态: 良好，存在部分问题');
    } else {
      console.log('\n❌ Gemini集成状态: 需要修复');
    }

    // 详细分析各个测试的结果
    console.log('\n📋 详细功能分析:');
    
    const serviceTest = this.results.tests.find(t => t.name.includes('服务连接'));
    if (serviceTest?.details) {
      console.log(`   🌐 服务连接: 状态码${serviceTest.details.statusCode || 'N/A'}, 连接${serviceTest.details.connected ? '成功' : '失败'}`);
    }

    const basicTest = this.results.tests.find(t => t.name.includes('基础响应'));
    if (basicTest?.details) {
      const d = basicTest.details;
      console.log(`   💬 基础响应: 类型${d.responseType}, 角色${d.responseRole}, 内容${d.hasContent ? '✅' : '❌'}, 使用量${d.hasUsage ? '✅' : '❌'}`);
      if (d.firstContentText) {
        console.log(`      首段内容: "${d.firstContentText}"`);
      }
    }

    const toolTest = this.results.tests.find(t => t.name.includes('工具响应'));
    if (toolTest?.details) {
      const d = toolTest.details;
      console.log(`   🔧 工具响应: ${d.totalContentBlocks}个内容块, 工具调用${d.toolUseBlockCount}个, 文本块${d.textBlockCount}个`);
      if (d.firstToolName) {
        console.log(`      首个工具: ${d.firstToolName}, 输入: ${JSON.stringify(d.firstToolInput)}`);
      }
    }

    const streamTest = this.results.tests.find(t => t.name.includes('流式响应'));
    if (streamTest?.details) {
      const d = streamTest.details;
      console.log(`   📡 流式响应: ${d.totalEvents}个事件, 文本长度${d.totalTextLength}, 流程${d.hasCompleteFlow ? '完整' : '不完整'}`);
      console.log(`      事件类型: ${d.eventTypes?.join(', ') || '无'}`);
    }

    // 诊断建议
    if (!servicePassed) {
      console.log('\n⚠️ 诊断建议: Gemini服务连接问题');
      console.log('   1. 确认端口5502服务启动: rcc start config-google-gemini-5502.json');
      console.log('   2. 验证GEMINI_API_KEY环境变量设置');
      console.log('   3. 检查网络连接和防火墙设置');
    }

    if (servicePassed && !basicResponsePassed) {
      console.log('\n⚠️ 诊断建议: Provider实现问题');
      console.log('   1. 检查GeminiClient的createCompletion方法');
      console.log('   2. 验证transformer转换逻辑');
      console.log('   3. 查看详细日志输出');
    }

    if (basicResponsePassed && !toolResponsePassed) {
      console.log('\n⚠️ 诊断建议: 工具调用特定问题');
      console.log('   1. 检查工具定义格式转换');
      console.log('   2. 验证Gemini API的工具调用支持');
      console.log('   3. 查看transformer的工具处理逻辑');
    }

    console.log('\n📋 Gemini集成测试完成');
    return this.results;
  }
}

async function main() {
  console.log('🚀 启动Gemini完整集成测试\n');
  
  const tester = new GeminiIntegrationTester();
  
  // 执行所有测试
  await tester.runTest('Gemini服务连接测试', () => tester.testGeminiServiceConnection());
  await tester.runTest('Provider基础响应测试', () => tester.testGeminiProviderBasicResponse());
  await tester.runTest('Provider工具响应测试', () => tester.testGeminiProviderToolResponse());
  await tester.runTest('Provider流式响应测试', () => tester.testGeminiStreamingResponse());
  await tester.runTest('响应解析能力测试', () => tester.testResponseParsing());
  
  // 生成报告
  return tester.generateReport();
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { main };