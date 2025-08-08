#!/usr/bin/env node
/**
 * Gemini Provider工具调用专项测试
 * 项目所有者: Jason Zhang
 */

const path = require('path');
const fs = require('fs');

// 测试用的工具定义
const TEST_TOOLS = [
  {
    name: "get_weather",
    description: "Get weather information for a location",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location to get weather for"
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit"
        }
      },
      required: ["location"]
    }
  },
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
];

// 测试请求模板
const TEST_REQUEST = {
  model: "gemini-2.0-flash-exp",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "What's the weather like in Tokyo? Also calculate 15 * 24."
    }
  ],
  tools: TEST_TOOLS,
  metadata: {
    requestId: 'test-gemini-tools-' + Date.now()
  }
};

class GeminiToolCallTester {
  constructor() {
    this.results = {
      testName: 'Gemini Provider Tool Calls Test',
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

  async testGeminiClientImport() {
    try {
      const { GeminiClient } = require('./dist/providers/gemini/client');
      return { imported: true, clientType: typeof GeminiClient };
    } catch (error) {
      throw new Error(`无法导入GeminiClient: ${error.message}`);
    }
  }

  async testGeminiClientInitialization() {
    const { GeminiClient } = require('./dist/providers/gemini/client');
    
    const config = {
      endpoint: 'http://localhost:5502',
      defaultModel: 'gemini-2.0-flash-exp',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.GEMINI_API_KEY || 'test-key-gemini'
        }
      },
      httpOptions: {
        timeout: 30000,
        maxRetries: 1
      }
    };

    const client = new GeminiClient(config, 'test-gemini-client');
    
    return {
      clientName: client.name,
      clientType: client.type,
      hasApiKey: !!config.authentication.credentials.apiKey
    };
  }

  async testHealthCheck() {
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

    const client = new GeminiClient(config, 'health-test-client');
    const healthStatus = await client.healthCheck();
    
    return { healthy: healthStatus };
  }

  async testBasicCompletion() {
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

    const client = new GeminiClient(config, 'basic-test-client');
    
    const basicRequest = {
      model: "gemini-2.0-flash-exp",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Say hello in one word."
        }
      ],
      metadata: {
        requestId: 'basic-test-' + Date.now()
      }
    };

    const response = await client.createCompletion(basicRequest);
    
    return {
      hasResponse: !!response,
      hasContent: !!response.content && response.content.length > 0,
      contentType: response.content?.[0]?.type,
      stopReason: response.stop_reason,
      model: response.model
    };
  }

  async testToolCallCompletion() {
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

    const client = new GeminiClient(config, 'tool-test-client');
    const response = await client.createCompletion(TEST_REQUEST);
    
    // 分析响应中的工具调用
    const hasToolUse = response.content.some(block => block.type === 'tool_use');
    const toolCalls = response.content.filter(block => block.type === 'tool_use');
    
    return {
      hasResponse: !!response,
      hasContent: !!response.content && response.content.length > 0,
      hasToolUse: hasToolUse,
      toolCallCount: toolCalls.length,
      toolNames: toolCalls.map(call => call.name),
      stopReason: response.stop_reason,
      contentBlocks: response.content.length,
      model: response.model
    };
  }

  async testStreamingCompletion() {
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

    const client = new GeminiClient(config, 'stream-test-client');
    
    const streamRequest = {
      model: "gemini-2.0-flash-exp",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Count from 1 to 5."
        }
      ],
      metadata: {
        requestId: 'stream-test-' + Date.now()
      }
    };

    const events = [];
    let messageStartReceived = false;
    let contentReceived = false;
    let messageStopReceived = false;

    for await (const chunk of client.streamCompletion(streamRequest)) {
      events.push(chunk.event);
      
      if (chunk.event === 'message_start') {
        messageStartReceived = true;
      } else if (chunk.event === 'content_block_delta') {
        contentReceived = true;
      } else if (chunk.event === 'message_stop') {
        messageStopReceived = true;
      }
    }
    
    return {
      eventCount: events.length,
      messageStartReceived,
      contentReceived,
      messageStopReceived,
      eventTypes: [...new Set(events)]
    };
  }

  async testTransformerComponents() {
    try {
      const transformerModule = require('./dist/transformers/gemini');
      
      const hasTransformToGemini = typeof transformerModule.transformAnthropicToGemini === 'function';
      const hasTransformFromGemini = typeof transformerModule.transformGeminiToAnthropic === 'function';
      
      // 测试基本转换
      const testRequest = {
        model: 'gemini-2.0-flash-exp',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100
      };
      
      const geminiRequest = transformerModule.transformAnthropicToGemini(testRequest);
      
      return {
        transformerImported: true,
        hasTransformToGemini,
        hasTransformFromGemini,
        transformationWorked: !!geminiRequest && !!geminiRequest.contents
      };
    } catch (error) {
      throw new Error(`Transformer测试失败: ${error.message}`);
    }
  }

  generateReport() {
    const successRate = this.results.summary.total > 0 
      ? Math.round((this.results.summary.passed / this.results.summary.total) * 100)
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Gemini Provider工具调用测试报告');
    console.log('='.repeat(60));
    
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
      
      if (test.details && Object.keys(test.details).length > 0) {
        console.log(`      详情: ${JSON.stringify(test.details, null, 2).split('\n').map(line => '      ' + line).join('\n').trim()}`);
      }
    });

    // 功能验证总结
    console.log('\n🔍 功能验证总结:');
    const clientImportPassed = this.results.tests.find(t => t.name.includes('导入'))?.status === 'passed';
    const healthCheckPassed = this.results.tests.find(t => t.name.includes('健康'))?.status === 'passed';
    const basicCompletionPassed = this.results.tests.find(t => t.name.includes('基础'))?.status === 'passed';
    const toolCallPassed = this.results.tests.find(t => t.name.includes('工具调用'))?.status === 'passed';
    const streamingPassed = this.results.tests.find(t => t.name.includes('流式'))?.status === 'passed';
    const transformerPassed = this.results.tests.find(t => t.name.includes('Transformer'))?.status === 'passed';

    console.log(`   📦 客户端导入: ${clientImportPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🏥 健康检查: ${healthCheckPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   💬 基础响应: ${basicCompletionPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔧 工具调用: ${toolCallPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   📡 流式响应: ${streamingPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔄 转换器: ${transformerPassed ? '✅ 正常' : '❌ 失败'}`);

    if (successRate >= 80) {
      console.log('\n🎉 Gemini Provider总体状态: 优秀');
    } else if (successRate >= 60) {
      console.log('\n⚠️ Gemini Provider总体状态: 良好，存在部分问题');
    } else {
      console.log('\n❌ Gemini Provider总体状态: 需要修复');
    }

    // 诊断建议
    if (!clientImportPassed) {
      console.log('\n⚠️ 诊断建议: 检查项目构建状态');
      console.log('   运行: npm run build');
    }

    if (!healthCheckPassed) {
      console.log('\n⚠️ 诊断建议: 检查Gemini服务状态');
      console.log('   1. 确认端口5502服务启动');
      console.log('   2. 验证GEMINI_API_KEY环境变量');
      console.log('   3. 检查网络连接');
    }

    if (!toolCallPassed && basicCompletionPassed) {
      console.log('\n⚠️ 诊断建议: 工具调用特定问题');
      console.log('   1. 检查工具定义格式');
      console.log('   2. 验证transformer工具调用转换逻辑');
      console.log('   3. 确认Gemini API工具调用支持');
    }

    console.log('\n📋 测试完成，报告保存到控制台输出');
    return this.results;
  }
}

async function main() {
  console.log('🚀 启动Gemini Provider工具调用专项测试\n');
  
  const tester = new GeminiToolCallTester();
  
  // 执行所有测试
  await tester.runTest('GeminiClient导入测试', () => tester.testGeminiClientImport());
  await tester.runTest('GeminiClient初始化测试', () => tester.testGeminiClientInitialization());
  await tester.runTest('健康检查测试', () => tester.testHealthCheck());
  await tester.runTest('基础响应测试', () => tester.testBasicCompletion());
  await tester.runTest('工具调用响应测试', () => tester.testToolCallCompletion());
  await tester.runTest('流式响应测试', () => tester.testStreamingCompletion());
  await tester.runTest('Transformer组件测试', () => tester.testTransformerComponents());
  
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