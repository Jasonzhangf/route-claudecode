#!/usr/bin/env node

/**
 * LM Studio OpenAI Provider 测试脚本
 * 测试从provider发出请求到获取响应后的处理部分
 * 确认到transformer前请求和响应符合标准
 * 项目所有者: Jason Zhang
 */

const { createOpenAISDKClient } = require('./dist/providers/openai/sdk-client');
const { logger } = require('./dist/utils/logger');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  type: 'openai',
  endpoint: 'http://localhost:1234/v1/chat/completions',
  port: 5506,
  authentication: {
    type: 'none' // LM Studio不需要认证
  },
  settings: {},
  defaultModel: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
  sdkOptions: {
    timeout: 30000,
    maxRetries: 2,
    defaultHeaders: {
      'User-Agent': 'Claude-Code-Router/2.8.0'
    }
  }
};

// 创建测试输出目录
const OUTPUT_DIR = path.join(__dirname, 'debug-output', 'openai-provider-test');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(OUTPUT_DIR, `openai-provider-test-${timestamp}.log`);

// 日志记录函数
function logTest(message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    data
  };
  
  console.log(`[${logEntry.timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

// 测试用例定义
const TEST_CASES = [
  {
    name: 'Text-Only Request',
    description: '纯文本请求测试',
    request: {
      model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a simple greeting.'
        }
      ],
      max_tokens: 100,
      metadata: {
        requestId: `test_text_${Date.now()}`,
        testCase: 'text-only'
      }
    }
  },
  {
    name: 'Tool Use Request', 
    description: '工具调用请求测试',
    request: {
      model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      messages: [
        {
          role: 'user',
          content: 'What is the current weather in Tokyo?'
        }
      ],
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          input_schema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and country'
              }
            },
            required: ['location']
          }
        }
      ],
      max_tokens: 200,
      metadata: {
        requestId: `test_tool_${Date.now()}`,
        testCase: 'tool-use'
      }
    }
  },
  {
    name: 'System Message Request',
    description: '系统消息请求测试',
    request: {
      model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      system: 'You are a helpful assistant that always responds in JSON format.',
      messages: [
        {
          role: 'user',
          content: 'Tell me about artificial intelligence'
        }
      ],
      max_tokens: 150,
      metadata: {
        requestId: `test_system_${Date.now()}`,
        testCase: 'system-message'
      }
    }
  }
];

async function validateRequest(testCase, transformedRequest) {
  logTest(`🔍 Validating transformed request for: ${testCase.name}`);
  
  const validation = {
    hasModel: !!transformedRequest.model,
    hasMessages: Array.isArray(transformedRequest.messages) && transformedRequest.messages.length > 0,
    hasMaxTokens: typeof transformedRequest.max_tokens === 'number',
    hasTools: transformedRequest.tools ? Array.isArray(transformedRequest.tools) : true,
    validMessageFormat: true,
    validToolFormat: true
  };

  // 验证消息格式
  for (const message of transformedRequest.messages) {
    if (!message.role || !message.content) {
      validation.validMessageFormat = false;
      break;
    }
  }

  // 验证工具格式（如果存在）
  if (transformedRequest.tools) {
    for (const tool of transformedRequest.tools) {
      if (!tool.type || tool.type !== 'function' || !tool.function || !tool.function.name) {
        validation.validToolFormat = false;
        break;
      }
    }
  }

  const isValid = Object.values(validation).every(v => v === true);
  
  logTest(`✅ Request validation result: ${isValid ? 'PASSED' : 'FAILED'}`, validation);
  
  if (!isValid) {
    logTest('❌ Invalid request structure detected', transformedRequest);
  }
  
  return { isValid, validation };
}

async function validateResponse(testCase, response) {
  logTest(`🔍 Validating response for: ${testCase.name}`);
  
  const validation = {
    hasId: !!response.id,
    hasChoices: Array.isArray(response.choices) && response.choices.length > 0,
    hasUsage: !!response.usage,
    hasValidChoice: false,
    hasValidContent: false,
    hasToolCalls: false,
    finishReason: null
  };

  if (validation.hasChoices) {
    const choice = response.choices[0];
    validation.hasValidChoice = !!choice && !!choice.message;
    
    if (choice.message) {
      validation.hasValidContent = !!(choice.message.content || choice.message.tool_calls);
      validation.hasToolCalls = !!choice.message.tool_calls;
      validation.finishReason = choice.finish_reason;
    }
  }

  const isValid = validation.hasId && validation.hasChoices && validation.hasUsage && validation.hasValidChoice;
  
  logTest(`✅ Response validation result: ${isValid ? 'PASSED' : 'FAILED'}`, validation);
  
  if (!isValid) {
    logTest('❌ Invalid response structure detected', response);
  }
  
  return { isValid, validation };
}

async function testProvider() {
  logTest('🚀 Starting OpenAI Provider LM Studio Test');
  logTest('📋 Test Configuration', TEST_CONFIG);

  try {
    // 创建 OpenAI SDK Client
    const provider = createOpenAISDKClient(TEST_CONFIG, 'lmstudio-test');
    
    logTest('✅ Provider created successfully');

    // 健康检查
    logTest('🏥 Performing health check...');
    const isHealthy = await provider.isHealthy();
    
    if (!isHealthy) {
      throw new Error('LM Studio is not healthy - ensure it is running on localhost:1234');
    }
    
    logTest('✅ Health check passed');

    // 执行测试用例
    const results = {
      totalTests: TEST_CASES.length,
      passedTests: 0,
      failedTests: 0,
      testResults: []
    };

    for (const testCase of TEST_CASES) {
      logTest(`\n🧪 Executing Test Case: ${testCase.name}`);
      logTest(`📝 Description: ${testCase.description}`);

      try {
        const startTime = Date.now();
        
        // 发送请求
        logTest('📤 Sending request to provider...');
        const response = await provider.sendRequest(testCase.request);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        logTest(`⏱️ Request completed in ${duration}ms`);
        
        // 验证响应
        const responseValidation = await validateResponse(testCase, response);
        
        // 记录测试结果
        const testResult = {
          testCase: testCase.name,
          status: responseValidation.isValid ? 'PASSED' : 'FAILED',
          duration,
          request: {
            model: testCase.request.model,
            hasTools: !!testCase.request.tools,
            hasSystem: !!testCase.request.system,
            messageCount: testCase.request.messages.length
          },
          response: {
            id: response.id,
            model: response.model,
            hasContent: response.content && response.content.length > 0,
            contentBlocks: response.content ? response.content.length : 0,
            stopReason: response.stop_reason,
            hasUsage: !!response.usage
          },
          validation: responseValidation.validation
        };

        results.testResults.push(testResult);
        
        if (responseValidation.isValid) {
          results.passedTests++;
          logTest(`✅ Test PASSED: ${testCase.name}`);
        } else {
          results.failedTests++;
          logTest(`❌ Test FAILED: ${testCase.name}`);
        }

        // 保存详细响应到文件
        const responseFile = path.join(OUTPUT_DIR, `response-${testCase.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`);
        fs.writeFileSync(responseFile, JSON.stringify({
          testCase: testCase.name,
          request: testCase.request,
          response: response,
          validation: responseValidation
        }, null, 2));
        
        logTest(`💾 Response saved to: ${responseFile}`);

      } catch (error) {
        results.failedTests++;
        
        const errorResult = {
          testCase: testCase.name,
          status: 'ERROR',
          error: {
            message: error.message,
            stack: error.stack
          }
        };
        
        results.testResults.push(errorResult);
        
        logTest(`💥 Test ERROR: ${testCase.name}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }

    // 生成测试报告
    logTest('\n📊 Test Summary', results);
    
    const reportFile = path.join(OUTPUT_DIR, `test-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      summary: results,
      timestamp: new Date().toISOString(),
      config: TEST_CONFIG,
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    }, null, 2));
    
    logTest(`📝 Complete test report saved to: ${reportFile}`);
    
    // 输出结果
    console.log('\n' + '='.repeat(50));
    console.log(`🎯 OpenAI Provider Test Results`);
    console.log(`📊 Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passedTests}`);
    console.log(`❌ Failed: ${results.failedTests}`);
    console.log(`📁 Output Directory: ${OUTPUT_DIR}`);
    console.log('='.repeat(50));

    if (results.failedTests === 0) {
      console.log('🎉 All tests passed! OpenAI Provider is working correctly.');
      process.exit(0);
    } else {
      console.log('⚠️ Some tests failed. Check the logs for details.');
      process.exit(1);
    }

  } catch (error) {
    logTest('💥 Critical test failure', {
      error: error.message,
      stack: error.stack
    });
    
    console.error('💥 Critical Error:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testProvider().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { testProvider };