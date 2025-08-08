#!/usr/bin/env node

/**
 * OpenAI Transformer Comprehensive Test
 * 测试OpenAI transformer的完整功能
 * Owner: Jason Zhang
 */

const path = require('path');

// 设置模块路径别名
require('module-alias/register');
require('module-alias').addAlias('@', path.join(__dirname, 'dist'));

const { createOpenAITransformer } = require('./dist/transformers/openai');
const { logger } = require('./dist/utils/logger');

async function testOpenAITransformer() {
  console.log('🧪 [TRANSFORMER-TEST] Starting OpenAI Transformer comprehensive test');
  
  const transformer = createOpenAITransformer();
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  function runTest(testName, testFn) {
    testResults.total++;
    try {
      console.log(`\n🔧 [TEST] ${testName}`);
      const result = testFn();
      if (result) {
        console.log(`✅ [PASS] ${testName}`);
        testResults.passed++;
        return true;
      } else {
        console.log(`❌ [FAIL] ${testName}`);
        testResults.failed++;
        return false;
      }
    } catch (error) {
      console.log(`💥 [ERROR] ${testName}: ${error.message}`);
      testResults.failed++;
      testResults.errors.push({ test: testName, error: error.message });
      return false;
    }
  }

  // 测试1: 基础BaseRequest到OpenAI格式转换
  runTest('BaseRequest to OpenAI conversion', () => {
    const baseRequest = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello, world!' }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      system: 'You are a helpful assistant.',
      tools: []
    };

    const openaiRequest = transformer.transformBaseRequestToOpenAI(baseRequest);
    
    console.log('  📋 Generated OpenAI request:', JSON.stringify(openaiRequest, null, 2));
    
    return (
      openaiRequest.model === 'claude-4-sonnet' &&
      openaiRequest.messages.length === 2 && // system + user message
      openaiRequest.messages[0].role === 'system' &&
      openaiRequest.messages[1].role === 'user' &&
      openaiRequest.max_tokens === 1000 &&
      openaiRequest.temperature === 0.7
    );
  });

  // 测试2: 工具调用转换
  runTest('Tool calls conversion', () => {
    const baseRequest = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is the weather like?' }
          ]
        }
      ],
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather information',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' }
            },
            required: ['location']
          }
        }
      ]
    };

    const openaiRequest = transformer.transformBaseRequestToOpenAI(baseRequest);
    
    console.log('  📋 Tools in OpenAI request:', JSON.stringify(openaiRequest.tools, null, 2));
    
    return (
      Array.isArray(openaiRequest.tools) &&
      openaiRequest.tools.length === 1 &&
      openaiRequest.tools[0].type === 'function' &&
      openaiRequest.tools[0].function.name === 'get_weather' &&
      openaiRequest.tools[0].function.description === 'Get current weather information'
    );
  });

  // 测试3: OpenAI响应到BaseResponse转换
  runTest('OpenAI response to BaseResponse conversion', () => {
    const openaiResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          tool_calls: null
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };

    const originalRequest = {
      model: 'claude-4-sonnet',
      messages: [],
      metadata: { originalModel: 'claude-4-sonnet' }
    };

    const baseResponse = transformer.transformOpenAIResponseToBase(openaiResponse, originalRequest);
    
    console.log('  📋 Generated BaseResponse:', JSON.stringify(baseResponse, null, 2));
    
    return (
      baseResponse.id === 'chatcmpl-123' &&
      baseResponse.role === 'assistant' &&
      Array.isArray(baseResponse.content) &&
      baseResponse.content.length === 1 &&
      baseResponse.content[0].type === 'text' &&
      baseResponse.content[0].text === 'Hello! How can I help you today?' &&
      baseResponse.stop_reason === 'end_turn' &&
      baseResponse.usage.input_tokens === 10 &&
      baseResponse.usage.output_tokens === 20
    );
  });

  // 测试4: 工具调用响应转换
  runTest('Tool call response conversion', () => {
    const openaiResponse = {
      id: 'chatcmpl-456',
      object: 'chat.completion',
      created: 1677652300,
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_abc123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: JSON.stringify({ location: 'New York' })
            }
          }]
        },
        finish_reason: 'tool_calls'
      }],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 25,
        total_tokens: 40
      }
    };

    const originalRequest = {
      model: 'claude-4-sonnet',
      messages: [],
      metadata: { originalModel: 'claude-4-sonnet' }
    };

    const baseResponse = transformer.transformOpenAIResponseToBase(openaiResponse, originalRequest);
    
    console.log('  📋 Tool call BaseResponse:', JSON.stringify(baseResponse, null, 2));
    
    return (
      baseResponse.id === 'chatcmpl-456' &&
      Array.isArray(baseResponse.content) &&
      baseResponse.content.length === 1 &&
      baseResponse.content[0].type === 'tool_use' &&
      baseResponse.content[0].id === 'call_abc123' &&
      baseResponse.content[0].name === 'get_weather' &&
      baseResponse.content[0].input.location === 'New York' &&
      baseResponse.stop_reason === 'tool_use'
    );
  });

  // 测试5: 统一格式转换
  runTest('Unified format conversion', () => {
    const openaiRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      max_tokens: 500,
      temperature: 0.8,
      stream: false
    };

    const unifiedRequest = transformer.transformRequestToUnified(openaiRequest);
    const backToOpenAI = transformer.transformRequestFromUnified(unifiedRequest);
    
    console.log('  📋 Round-trip conversion:', {
      original: openaiRequest,
      unified: unifiedRequest,
      converted: backToOpenAI
    });
    
    return (
      backToOpenAI.model === openaiRequest.model &&
      backToOpenAI.messages.length === openaiRequest.messages.length &&
      backToOpenAI.max_tokens === openaiRequest.max_tokens &&
      backToOpenAI.temperature === openaiRequest.temperature
    );
  });

  // 测试6: Stream chunk处理
  runTest('Stream chunk processing', () => {
    const streamChunk = {
      id: 'chatcmpl-stream',
      object: 'chat.completion.chunk',
      created: 1677652400,
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: {
          content: 'Hello '
        },
        finish_reason: null
      }]
    };

    const processedChunk = transformer.transformStreamChunk(streamChunk);
    
    console.log('  📋 Processed stream chunk:', JSON.stringify(processedChunk, null, 2));
    
    return (
      processedChunk.id === 'chatcmpl-stream' &&
      processedChunk.object === 'chat.completion.chunk' &&
      processedChunk.choices[0].delta.content === 'Hello ' &&
      processedChunk.choices[0].finish_reason === null
    );
  });

  // 测试7: 错误处理
  runTest('Error handling', () => {
    let errorCount = 0;

    // 测试null/undefined请求
    try {
      transformer.transformBaseRequestToOpenAI(null);
    } catch (error) {
      if (error.message.includes('null or undefined')) errorCount++;
    }

    // 测试无效消息格式
    try {
      transformer.transformBaseRequestToOpenAI({
        model: 'test',
        messages: 'invalid'
      });
    } catch (error) {
      if (error.message.includes('must be an array')) errorCount++;
    }

    // 测试无效OpenAI响应
    try {
      transformer.transformOpenAIResponseToBase(null, {});
    } catch (error) {
      if (error.message.includes('null or undefined')) errorCount++;
    }

    // 测试缺少choices的响应
    try {
      transformer.transformOpenAIResponseToBase({ id: 'test' }, {});
    } catch (error) {
      if (error.message.includes('missing choices')) errorCount++;
    }

    console.log(`  📋 Caught ${errorCount}/4 expected errors`);
    return errorCount === 4;
  });

  // 输出测试结果
  console.log('\n📊 [RESULTS] OpenAI Transformer Test Summary:');
  console.log(`  Total tests: ${testResults.total}`);
  console.log(`  Passed: ${testResults.passed}`);
  console.log(`  Failed: ${testResults.failed}`);
  console.log(`  Success rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n💥 [ERRORS] Failed tests:');
    testResults.errors.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`);
    });
  }

  const success = testResults.failed === 0;
  console.log(`\n${success ? '✅' : '❌'} [FINAL] OpenAI Transformer test ${success ? 'PASSED' : 'FAILED'}`);
  
  return success;
}

// 运行测试
if (require.main === module) {
  testOpenAITransformer()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testOpenAITransformer };