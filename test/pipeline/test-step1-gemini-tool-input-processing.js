#!/usr/bin/env node

/**
 * STD-8-STEP-PIPELINE - Step 1: Gemini Tool Call Input Processing
 * 验证Anthropic API请求链路通畅性，专门针对Gemini工具调用
 * 
 * Project owner: Jason Zhang
 * Test Script: Step1 - Input Processing for Gemini Tool Calling Pipeline
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Import Universal Pipeline Debugger
const UniversalPipelineDebugger = require('../../dist/debug/universal-pipeline-debug').default;

const BASE_URL = 'http://localhost:5502'; // Gemini服务端口
const STEP_OUTPUT_FILE = './debug-data/step1-gemini-tool-input-output.json';

async function testStep1GeminiToolInputProcessing() {
  const debugger = new UniversalPipelineDebugger('./debug-data');
  const sessionId = await debugger.initializeDebugSession(
    'gemini-tool-calling',
    'step1-input-processing'
  );

  console.log('🧪 STD-8-STEP-PIPELINE - Step 1: Gemini工具调用输入处理测试');
  console.log('=' .repeat(60));
  console.log(`调试会话ID: ${sessionId}`);
  console.log(`目标服务: ${BASE_URL}`);
  console.log('');

  // 构建测试用例：涵盖多种Gemini工具调用场景
  const testCases = [
    {
      name: "Anthropic格式单工具",
      request: {
        model: "gemini-2.5-flash",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: "What's the weather like in Tokyo? Use the weather tool to check."
        }],
        tools: [{
          name: "get_weather",
          description: "Get current weather for a location",
          input_schema: {
            type: "object",
            properties: {
              location: { 
                type: "string", 
                description: "City name" 
              },
              units: { 
                type: "string", 
                enum: ["celsius", "fahrenheit"],
                description: "Temperature units"
              }
            },
            required: ["location"]
          }
        }]
      }
    },
    {
      name: "OpenAI格式单工具",
      request: {
        model: "gemini-2.5-pro", 
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: "Search for information about Node.js latest features. Use the search tool."
        }],
        tools: [{
          type: "function",
          function: {
            name: "search_web",
            description: "Search the web for information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                max_results: {
                  type: "integer",
                  description: "Maximum number of results",
                  default: 5
                }
              },
              required: ["query"]
            }
          }
        }]
      }
    },
    {
      name: "多工具混合格式",
      request: {
        model: "gemini-2.5-flash",
        max_tokens: 1500,
        messages: [{
          role: "user", 
          content: "Help me plan a trip to Paris. Check the weather and search for attractions."
        }],
        tools: [
          {
            name: "get_weather",
            description: "Get weather information",
            input_schema: {
              type: "object",
              properties: {
                location: { type: "string" }
              },
              required: ["location"]
            }
          },
          {
            type: "function",
            function: {
              name: "search_attractions",
              description: "Search for tourist attractions",
              parameters: {
                type: "object", 
                properties: {
                  city: { type: "string" },
                  category: { type: "string", enum: ["museum", "restaurant", "landmark"] }
                },
                required: ["city"]
              }
            }
          }
        ]
      }
    },
    {
      name: "复杂嵌套Schema",
      request: {
        model: "gemini-2.5-pro",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: "Create a user profile with nested data structure."
        }],
        tools: [{
          name: "create_user_profile",
          description: "Create a complex user profile",
          input_schema: {
            type: "object",
            properties: {
              personal_info: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "integer" },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["email", "phone"] },
                        value: { type: "string" }
                      }
                    }
                  }
                },
                required: ["name"]
              },
              preferences: {
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            required: ["personal_info"]
          }
        }]
      }
    }
  ];

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 测试用例 ${i + 1}: ${testCase.name}`);
    console.log('-'.repeat(40));

    const stepId = `step1-test-${i + 1}`;
    
    try {
      // 捕获输入数据
      await debugger.captureStepData(
        stepId,
        `Step1-${testCase.name}`,
        'Input processing test for Gemini tool calling',
        testCase.request
      );

      console.log('📤 发送请求到Gemini服务...');
      console.log(`模型: ${testCase.request.model}`);
      console.log(`工具数量: ${testCase.request.tools.length}`);
      console.log(`消息内容: ${testCase.request.messages[0].content.substring(0, 50)}...`);

      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/chat/completions`, testCase.request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ 请求成功 (${duration}ms)`);
      console.log(`响应状态: ${response.status}`);
      console.log(`响应数据大小: ${JSON.stringify(response.data).length} bytes`);

      // 分析响应内容
      const responseData = response.data;
      const choice = responseData.choices?.[0];
      const message = choice?.message;

      console.log(`停止原因: ${choice?.finish_reason || 'unknown'}`);
      console.log(`内容类型: ${Array.isArray(message?.content) ? 'structured' : 'text'}`);
      
      if (Array.isArray(message?.content)) {
        const toolUses = message.content.filter(c => c.type === 'tool_use');
        console.log(`工具调用数量: ${toolUses.length}`);
        if (toolUses.length > 0) {
          console.log(`工具调用: ${toolUses.map(t => t.name).join(', ')}`);
        }
      }

      // 捕获输出数据
      await debugger.captureStepData(
        stepId,
        `Step1-${testCase.name}`,
        'Input processing test completed',
        testCase.request,
        responseData,
        null,
        { duration, status: response.status }
      );

      results.push({
        testCase: testCase.name,
        status: 'success',
        duration,
        response: responseData,
        analysis: {
          finishReason: choice?.finish_reason,
          hasToolCalls: Array.isArray(message?.content) && message.content.some(c => c.type === 'tool_use'),
          toolCallCount: Array.isArray(message?.content) ? message.content.filter(c => c.type === 'tool_use').length : 0,
          responseSize: JSON.stringify(responseData).length
        }
      });

    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      
      if (error.response) {
        console.log(`错误状态: ${error.response.status}`);
        console.log(`错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
      }

      // 捕获错误数据
      await debugger.captureStepData(
        stepId,
        `Step1-${testCase.name}`,
        'Input processing test failed',
        testCase.request,
        null,
        {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      );

      results.push({
        testCase: testCase.name,
        status: 'failed',
        error: error.message,
        errorDetails: error.response?.data
      });
    }

    // 短暂延迟避免API限制
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 保存完整结果到文件用于下一步
  const outputData = {
    timestamp: new Date().toISOString(),
    step: 'step1-input-processing',
    pipelineType: 'gemini-tool-calling',
    testResults: results,
    summary: {
      totalTests: results.length,
      successCount: results.filter(r => r.status === 'success').length,
      failureCount: results.filter(r => r.status === 'failed').length,
      hasToolCallResponses: results.filter(r => r.analysis?.hasToolCalls).length
    }
  };

  await fs.mkdir(path.dirname(STEP_OUTPUT_FILE), { recursive: true });
  await fs.writeFile(STEP_OUTPUT_FILE, JSON.stringify(outputData, null, 2));

  // 完成调试会话
  const summary = await debugger.completeSession();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Step 1 测试总结:');
  console.log(`总测试数: ${outputData.summary.totalTests}`);
  console.log(`成功: ${outputData.summary.successCount}`);
  console.log(`失败: ${outputData.summary.failureCount}`);
  console.log(`包含工具调用的响应: ${outputData.summary.hasToolCallResponses}`);
  console.log(`结果保存到: ${STEP_OUTPUT_FILE}`);
  
  if (summary) {
    console.log(`调试数据: ${summary.dataCaptureSummary.storageLocation}`);
  }

  console.log('\n🎯 关键发现:');
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`✅ ${result.testCase}: ${result.analysis.hasToolCalls ? '有工具调用' : '无工具调用'} (${result.analysis.finishReason})`);
    } else {
      console.log(`❌ ${result.testCase}: ${result.error}`);
    }
  });

  console.log('\n🔄 下一步: 运行 test-step2-gemini-tool-input-preprocessing.js');

  return outputData;
}

// 运行测试
if (require.main === module) {
  testStep1GeminiToolInputProcessing()
    .then(result => {
      console.log('\n✅ Step 1 测试完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Step 1 测试失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { testStep1GeminiToolInputProcessing };