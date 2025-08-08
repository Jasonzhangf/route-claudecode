#!/usr/bin/env node

/**
 * OpenAI Preprocess Comprehensive Test
 * 测试OpenAI预处理功能的完整测试
 * Owner: Jason Zhang
 */

const path = require('path');

// 设置环境变量
process.env.RCC_PORT = '3456';

// 设置模块路径别名
require('module-alias/register');
require('module-alias').addAlias('@', path.join(__dirname, 'dist'));

const { getModularPreprocessingManager } = require('./dist/preprocessing/modular-preprocessing-manager');
const { createOptimizedOpenAIParser } = require('./dist/providers/openai/universal-openai-parser');
const { logger } = require('./dist/utils/logger');

async function testOpenAIPreprocess() {
  console.log('🧪 [PREPROCESS-TEST] Starting OpenAI Preprocess comprehensive test');
  
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

  async function runAsyncTest(testName, testFn) {
    testResults.total++;
    try {
      console.log(`\n🔧 [TEST] ${testName}`);
      const result = await testFn();
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

  // 测试1: Modular Preprocessing Manager初始化
  runTest('Modular Preprocessing Manager initialization', () => {
    const preprocessor = getModularPreprocessingManager(5506);
    
    console.log('  📋 Preprocessor created:', !!preprocessor);
    
    return preprocessor !== null && typeof preprocessor === 'object';
  });

  // 测试2: 基础请求预处理
  await runAsyncTest('Basic request preprocessing', async () => {
    const preprocessor = getModularPreprocessingManager();
    
    const baseRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello world!' }
      ],
      max_tokens: 1000
    };

    const processedRequest = await preprocessor.preprocessRequest(baseRequest);
    
    console.log('  📋 Original request:', JSON.stringify(baseRequest, null, 2));
    console.log('  📋 Processed request:', JSON.stringify(processedRequest, null, 2));
    
    return (
      processedRequest.model === baseRequest.model &&
      processedRequest.messages.length === baseRequest.messages.length &&
      processedRequest.metadata &&
      typeof processedRequest.metadata.requestId === 'string'
    );
  });

  // 测试3: 请求预处理metadata处理
  await runAsyncTest('Request preprocessing metadata handling', async () => {
    const preprocessor = getModularPreprocessingManager();
    
    const baseRequest = {
      model: 'claude-sonnet-4',
      messages: [
        { role: 'user', content: 'Test message' }
      ],
      metadata: {
        requestId: 'test-123',
        customField: 'test-value'
      }
    };

    const processedRequest = await preprocessor.preprocessRequest(baseRequest);
    
    console.log('  📋 Metadata preservation:', {
      originalRequestId: baseRequest.metadata.requestId,
      processedRequestId: processedRequest.metadata.requestId,
      customField: processedRequest.metadata.customField
    });
    
    return (
      processedRequest.metadata.requestId === 'test-123' &&
      processedRequest.metadata.customField === 'test-value'
    );
  });

  // 测试4: 空请求处理
  await runAsyncTest('Empty request handling', async () => {
    const preprocessor = getModularPreprocessingManager();
    
    const emptyRequest = {};

    const processedRequest = await preprocessor.preprocessRequest(emptyRequest);
    
    console.log('  📋 Empty request processed:', JSON.stringify(processedRequest, null, 2));
    
    return (
      processedRequest.metadata &&
      processedRequest.metadata.requestId === 'unknown'
    );
  });

  // 测试5: 响应预处理
  await runAsyncTest('Response preprocessing', async () => {
    const preprocessor = getModularPreprocessingManager();
    
    const baseResponse = {
      id: 'resp-123',
      content: [
        { type: 'text', text: 'Hello there!' }
      ],
      model: 'gpt-4',
      role: 'assistant',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 20
      }
    };

    const processedResponse = await preprocessor.preprocessResponse(baseResponse);
    
    console.log('  📋 Response preprocessing result:', {
      originalId: baseResponse.id,
      processedId: processedResponse.id,
      contentType: processedResponse.content[0].type,
      modelMatch: baseResponse.model === processedResponse.model
    });
    
    return (
      processedResponse.id === baseResponse.id &&
      processedResponse.content.length === baseResponse.content.length &&
      processedResponse.model === baseResponse.model
    );
  });

  // 测试6: Universal OpenAI Parser初始化
  runTest('Universal OpenAI Parser initialization', () => {
    const parser = createOptimizedOpenAIParser('test-request-123');
    
    console.log('  📋 Parser created:', !!parser);
    console.log('  📋 Parser has strategies:', !!parser.strategies);
    
    return parser !== null && typeof parser === 'object';
  });

  // 测试7: OpenAI Stream数据解析
  await runAsyncTest('OpenAI stream data parsing', async () => {
    const parser = createOptimizedOpenAIParser('test-stream-456');
    
    const streamData = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]`;

    const parsedEvents = await parser.processResponse(streamData, 'test-stream-456');
    
    console.log('  📋 Parsed events count:', parsedEvents.length);
    console.log('  📋 First event:', JSON.stringify(parsedEvents[0] || {}, null, 2));
    console.log('  📋 Last event finish_reason:', parsedEvents[parsedEvents.length - 1]?.choices?.[0]?.finish_reason);
    
    return (
      parsedEvents.length >= 3 &&
      parsedEvents[0].choices[0].delta.content === 'Hello' &&
      parsedEvents[1].choices[0].delta.content === ' world' &&
      parsedEvents[2].choices[0].finish_reason === 'stop'
    );
  });

  // 测试8: 工具调用流式数据解析
  await runAsyncTest('Tool call stream data parsing', async () => {
    const parser = createOptimizedOpenAIParser('test-tool-789');
    
    const toolCallStreamData = `data: {"id":"chatcmpl-tool","object":"chat.completion.chunk","created":1677652300,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"get_weather","arguments":"{\\"location\\""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-tool","object":"chat.completion.chunk","created":1677652300,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":": \\"New York\\"}"}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-tool","object":"chat.completion.chunk","created":1677652300,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}

data: [DONE]`;

    const parsedEvents = await parser.processResponse(toolCallStreamData, 'test-tool-789');
    
    console.log('  📋 Tool call events count:', parsedEvents.length);
    console.log('  📋 First tool call event:', JSON.stringify(parsedEvents[0] || {}, null, 2));
    
    return (
      parsedEvents.length >= 3 &&
      parsedEvents[0].choices[0].delta.tool_calls &&
      parsedEvents[0].choices[0].delta.tool_calls[0].function.name === 'get_weather' &&
      parsedEvents[parsedEvents.length - 1].choices[0].finish_reason === 'tool_calls'
    );
  });

  // 测试9: 错误数据处理
  await runAsyncTest('Invalid data handling', async () => {
    const parser = createOptimizedOpenAIParser('test-error-999');
    
    const invalidData = `data: {"invalid": "json"
data: not_json_at_all
data: {"id":"valid","choices":[{"delta":{"content":"ok"},"finish_reason":null}]}
data: [DONE]`;

    const parsedEvents = await parser.processResponse(invalidData, 'test-error-999');
    
    console.log('  📋 Invalid data parsed events:', parsedEvents.length);
    console.log('  📋 Valid event found:', !!parsedEvents.find(e => e.id === 'valid'));
    
    // 应该解析出1个有效事件（忽略无效的）
    return (
      parsedEvents.length >= 1 &&
      parsedEvents.some(e => e.id === 'valid')
    );
  });

  // 测试10: 大量数据性能测试
  await runAsyncTest('Large data performance test', async () => {
    const parser = createOptimizedOpenAIParser('test-perf-1000');
    
    // 生成大量流式数据
    const largeStreamData = Array.from({ length: 100 }, (_, i) => 
      `data: {"id":"chatcmpl-perf","object":"chat.completion.chunk","created":1677652300,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"chunk_${i} "},"finish_reason":null}]}`
    ).join('\n') + '\ndata: {"id":"chatcmpl-perf","object":"chat.completion.chunk","created":1677652300,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\ndata: [DONE]';

    const startTime = Date.now();
    const parsedEvents = await parser.processResponse(largeStreamData, 'test-perf-1000');
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log('  📋 Performance test:', {
      events: parsedEvents.length,
      processingTime: `${processingTime}ms`,
      eventsPerMs: (parsedEvents.length / processingTime).toFixed(2)
    });
    
    return (
      parsedEvents.length === 101 && // 100 content chunks + 1 stop
      processingTime < 1000 // 应该在1秒内完成
    );
  });

  // 输出测试结果
  console.log('\n📊 [RESULTS] OpenAI Preprocess Test Summary:');
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
  console.log(`\n${success ? '✅' : '❌'} [FINAL] OpenAI Preprocess test ${success ? 'PASSED' : 'FAILED'}`);
  
  return success;
}

// 运行测试
if (require.main === module) {
  testOpenAIPreprocess()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testOpenAIPreprocess };