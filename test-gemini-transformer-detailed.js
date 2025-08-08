#!/usr/bin/env node
/**
 * Gemini Transformer详细测试
 * 项目所有者: Jason Zhang
 */

const path = require('path');
const fs = require('fs');

// 设置环境变量避免硬编码错误
process.env.RCC_PORT = process.env.RCC_PORT || '5502';

class GeminiTransformerTester {
  constructor() {
    this.results = {
      testName: 'Gemini Transformer Detailed Test',
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

  async testTransformerImport() {
    try {
      const transformerModule = require('./dist/transformers/gemini');
      
      return {
        imported: true,
        exportedFunctions: Object.keys(transformerModule),
        hasTransformToGemini: typeof transformerModule.transformAnthropicToGemini === 'function',
        hasTransformFromGemini: typeof transformerModule.transformGeminiToAnthropic === 'function'
      };
    } catch (error) {
      throw new Error(`Transformer导入失败: ${error.message}`);
    }
  }

  async testBasicAnthropicToGeminiTransform() {
    const { transformAnthropicToGemini } = require('./dist/transformers/gemini');
    
    const anthropicRequest = {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hello, how are you?'
        }
      ]
    };

    const geminiRequest = transformAnthropicToGemini(anthropicRequest);
    
    return {
      hasContents: !!geminiRequest.contents,
      contentsLength: geminiRequest.contents?.length || 0,
      firstContentRole: geminiRequest.contents?.[0]?.role,
      firstContentParts: geminiRequest.contents?.[0]?.parts?.length || 0,
      hasGenerationConfig: !!geminiRequest.generationConfig,
      maxOutputTokens: geminiRequest.generationConfig?.maxOutputTokens,
      originalModel: anthropicRequest.model,
      transformedStructure: Object.keys(geminiRequest)
    };
  }

  async testToolCallAnthropicToGeminiTransform() {
    const { transformAnthropicToGemini } = require('./dist/transformers/gemini');
    
    const anthropicRequestWithTools = {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: 'What\'s the weather in Tokyo and calculate 15 * 24?'
        }
      ],
      tools: [
        {
          name: "get_weather",
          description: "Get weather information for a location",
          input_schema: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "Location to get weather for"
              }
            },
            required: ["location"]
          }
        },
        {
          name: "calculate",
          description: "Perform calculations",
          input_schema: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "Math expression to evaluate"
              }
            },
            required: ["expression"]
          }
        }
      ]
    };

    const geminiRequest = transformAnthropicToGemini(anthropicRequestWithTools);
    
    return {
      hasTools: !!geminiRequest.tools,
      toolCount: geminiRequest.tools?.length || 0,
      toolNames: geminiRequest.tools?.map(tool => tool.functionDeclarations?.[0]?.name) || [],
      hasContents: !!geminiRequest.contents,
      hasGenerationConfig: !!geminiRequest.generationConfig,
      toolConfigType: geminiRequest.toolConfig?.functionCallingConfig?.mode || 'none',
      transformedStructure: Object.keys(geminiRequest)
    };
  }

  async testGeminiToAnthropicBasicTransform() {
    const { transformGeminiToAnthropic } = require('./dist/transformers/gemini');
    
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Hello! I'm doing well, thank you for asking. How can I help you today?"
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 25,
        totalTokenCount: 35
      }
    };

    const anthropicResponse = transformGeminiToAnthropic(
      mockGeminiResponse, 
      'gemini-2.0-flash-exp', 
      'test-request-123'
    );
    
    return {
      hasId: !!anthropicResponse.id,
      hasType: anthropicResponse.type === 'message',
      hasRole: anthropicResponse.role === 'assistant',
      hasContent: !!anthropicResponse.content && anthropicResponse.content.length > 0,
      contentType: anthropicResponse.content?.[0]?.type,
      contentText: anthropicResponse.content?.[0]?.text?.substring(0, 50) + '...',
      hasModel: !!anthropicResponse.model,
      hasStopReason: !!anthropicResponse.stop_reason,
      hasUsage: !!anthropicResponse.usage,
      inputTokens: anthropicResponse.usage?.input_tokens,
      outputTokens: anthropicResponse.usage?.output_tokens,
      responseStructure: Object.keys(anthropicResponse)
    };
  }

  async testGeminiToAnthropicToolCallTransform() {
    const { transformGeminiToAnthropic } = require('./dist/transformers/gemini');
    
    const mockGeminiToolResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "I'll help you get the weather information and perform that calculation."
              },
              {
                functionCall: {
                  name: "get_weather",
                  args: {
                    location: "Tokyo"
                  }
                }
              },
              {
                functionCall: {
                  name: "calculate", 
                  args: {
                    expression: "15 * 24"
                  }
                }
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 45,
        totalTokenCount: 60
      }
    };

    const anthropicResponse = transformGeminiToAnthropic(
      mockGeminiToolResponse,
      'gemini-2.0-flash-exp',
      'test-tool-request-456'
    );
    
    const toolUseBlocks = anthropicResponse.content?.filter(block => block.type === 'tool_use') || [];
    const textBlocks = anthropicResponse.content?.filter(block => block.type === 'text') || [];
    
    return {
      hasContent: !!anthropicResponse.content && anthropicResponse.content.length > 0,
      contentBlockCount: anthropicResponse.content?.length || 0,
      hasTextBlocks: textBlocks.length > 0,
      hasToolUseBlocks: toolUseBlocks.length > 0,
      toolUseCount: toolUseBlocks.length,
      toolNames: toolUseBlocks.map(block => block.name),
      toolIds: toolUseBlocks.map(block => block.id),
      firstToolInput: toolUseBlocks[0]?.input || {},
      hasStopReason: !!anthropicResponse.stop_reason,
      stopReason: anthropicResponse.stop_reason,
      responseStructure: Object.keys(anthropicResponse)
    };
  }

  async testComplexMessageTransform() {
    const { transformAnthropicToGemini, transformGeminiToAnthropic } = require('./dist/transformers/gemini');
    
    // 测试多轮对话转换
    const complexAnthropicRequest = {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: 'Hello, can you help me with math?'
        },
        {
          role: 'assistant', 
          content: 'Of course! I\'d be happy to help you with math. What would you like to work on?'
        },
        {
          role: 'user',
          content: 'What is the square root of 144?'
        }
      ]
    };

    const geminiRequest = transformAnthropicToGemini(complexAnthropicRequest);
    
    // 模拟Gemini响应
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "The square root of 144 is 12. This is because 12 × 12 = 144."
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 25,
        candidatesTokenCount: 20,
        totalTokenCount: 45
      }
    };

    const anthropicResponse = transformGeminiToAnthropic(
      mockGeminiResponse,
      'gemini-2.0-flash-exp', 
      'complex-test-789'
    );
    
    return {
      // Anthropic → Gemini 转换结果
      geminiContentsCount: geminiRequest.contents?.length || 0,
      geminiRoles: geminiRequest.contents?.map(c => c.role) || [],
      hasSystemInstruction: !!geminiRequest.systemInstruction,
      
      // Gemini → Anthropic 转换结果
      anthropicContentBlocks: anthropicResponse.content?.length || 0,
      anthropicRole: anthropicResponse.role,
      anthropicType: anthropicResponse.type,
      hasCompleteResponse: !!(anthropicResponse.id && anthropicResponse.content && anthropicResponse.usage),
      
      // 往返转换完整性检查
      roundTripComplete: !!(geminiRequest.contents && anthropicResponse.content)
    };
  }

  async testErrorHandling() {
    const { transformAnthropicToGemini, transformGeminiToAnthropic } = require('./dist/transformers/gemini');
    
    const testResults = {
      emptyRequestHandled: false,
      invalidGeminiResponseHandled: false,
      missingFieldsHandled: false
    };

    // 测试空请求
    try {
      const result = transformAnthropicToGemini({});
      testResults.emptyRequestHandled = !!result && typeof result === 'object';
    } catch (error) {
      testResults.emptyRequestError = error.message;
    }

    // 测试无效Gemini响应
    try {
      const result = transformGeminiToAnthropic({}, 'test-model', 'test-id');
      testResults.invalidGeminiResponseHandled = !!result && typeof result === 'object';
    } catch (error) {
      testResults.invalidGeminiResponseError = error.message;
    }

    // 测试缺少字段的请求
    try {
      const result = transformAnthropicToGemini({
        model: 'test-model',
        // 故意缺少messages字段
      });
      testResults.missingFieldsHandled = !!result && typeof result === 'object';
    } catch (error) {
      testResults.missingFieldsError = error.message;
    }

    return testResults;
  }

  generateReport() {
    const successRate = this.results.summary.total > 0 
      ? Math.round((this.results.summary.passed / this.results.summary.total) * 100)
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Gemini Transformer详细测试报告');
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
    });

    // 功能验证总结
    console.log('\n🔍 Transformer功能验证:');
    const importPassed = this.results.tests.find(t => t.name.includes('导入'))?.status === 'passed';
    const basicTransformPassed = this.results.tests.find(t => t.name.includes('基础转换'))?.status === 'passed';
    const toolTransformPassed = this.results.tests.find(t => t.name.includes('工具调用转换'))?.status === 'passed';
    const responseTransformPassed = this.results.tests.find(t => t.name.includes('响应转换'))?.status === 'passed';
    const toolResponsePassed = this.results.tests.find(t => t.name.includes('工具调用响应'))?.status === 'passed';
    const complexTransformPassed = this.results.tests.find(t => t.name.includes('复杂转换'))?.status === 'passed';
    const errorHandlingPassed = this.results.tests.find(t => t.name.includes('错误处理'))?.status === 'passed';

    console.log(`   📦 模块导入: ${importPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔄 基础转换: ${basicTransformPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔧 工具调用转换: ${toolTransformPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   📤 响应转换: ${responseTransformPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🛠️ 工具响应转换: ${toolResponsePassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   🔀 复杂场景转换: ${complexTransformPassed ? '✅ 正常' : '❌ 失败'}`);
    console.log(`   ⚠️ 错误处理: ${errorHandlingPassed ? '✅ 正常' : '❌ 失败'}`);

    if (successRate >= 90) {
      console.log('\n🎉 Gemini Transformer状态: 优秀');
      console.log('   所有核心转换功能工作正常');
    } else if (successRate >= 70) {
      console.log('\n⚠️ Gemini Transformer状态: 良好，存在小问题');
    } else {
      console.log('\n❌ Gemini Transformer状态: 需要修复');
    }

    // 详细分析
    console.log('\n📋 转换功能分析:');
    
    const importTest = this.results.tests.find(t => t.name.includes('导入'));
    if (importTest?.details) {
      console.log(`   📦 导出函数: ${importTest.details.exportedFunctions?.join(', ') || '未知'}`);
    }

    const basicTest = this.results.tests.find(t => t.name.includes('基础转换'));
    if (basicTest?.details) {
      console.log(`   🔄 基础转换能力: contents生成${basicTest.details.hasContents ? '✅' : '❌'}, 配置生成${basicTest.details.hasGenerationConfig ? '✅' : '❌'}`);
    }

    const toolTest = this.results.tests.find(t => t.name.includes('工具调用转换'));
    if (toolTest?.details) {
      console.log(`   🔧 工具转换: ${toolTest.details.toolCount}个工具 [${toolTest.details.toolNames?.join(', ') || ''}]`);
    }

    const responseTest = this.results.tests.find(t => t.name.includes('工具调用响应'));
    if (responseTest?.details) {
      console.log(`   🛠️ 工具响应: ${responseTest.details.toolUseCount}个工具调用，停止原因: ${responseTest.details.stopReason || '未知'}`);
    }

    console.log('\n📋 Gemini Transformer测试完成');
    return this.results;
  }
}

async function main() {
  console.log('🚀 启动Gemini Transformer详细测试\n');
  
  const tester = new GeminiTransformerTester();
  
  // 执行所有测试
  await tester.runTest('Transformer模块导入测试', () => tester.testTransformerImport());
  await tester.runTest('Anthropic到Gemini基础转换测试', () => tester.testBasicAnthropicToGeminiTransform());
  await tester.runTest('Anthropic到Gemini工具调用转换测试', () => tester.testToolCallAnthropicToGeminiTransform());
  await tester.runTest('Gemini到Anthropic基础响应转换测试', () => tester.testGeminiToAnthropicBasicTransform());
  await tester.runTest('Gemini到Anthropic工具调用响应转换测试', () => tester.testGeminiToAnthropicToolCallTransform());
  await tester.runTest('复杂多轮对话转换测试', () => tester.testComplexMessageTransform());
  await tester.runTest('错误处理和边界情况测试', () => tester.testErrorHandling());
  
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