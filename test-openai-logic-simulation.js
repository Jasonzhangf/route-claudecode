#!/usr/bin/env node
/**
 * OpenAI Provider逻辑模拟测试
 * 使用模拟数据测试核心逻辑，不依赖服务器
 */

const path = require('path');

// 模拟OpenAI API响应数据
const mockOpenAIResponses = {
  // 基本工具调用响应
  toolCallResponse: {
    id: "chatcmpl-test123",
    object: "chat.completion",
    created: 1699999999,
    model: "claude-3-5-sonnet-20241022",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call_test123",
          type: "function",
          function: {
            name: "calculate",
            arguments: '{"expression":"15 + 27"}'
          }
        }]
      },
      finish_reason: "tool_calls"
    }],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 20,
      total_tokens: 70
    }
  },

  // 文本响应
  textResponse: {
    id: "chatcmpl-test456",
    object: "chat.completion", 
    created: 1699999999,
    model: "claude-3-5-sonnet-20241022",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "计算结果是42。"
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 30,
      completion_tokens: 10,
      total_tokens: 40
    }
  },

  // 无效响应（缺少choices）
  invalidResponse: {
    id: "chatcmpl-test789",
    object: "chat.completion",
    created: 1699999999,
    model: "claude-3-5-sonnet-20241022",
    // 缺少choices字段
    usage: {
      prompt_tokens: 30,
      completion_tokens: 10,
      total_tokens: 40
    }
  }
};

// 模拟BaseRequest数据
const mockBaseRequests = {
  // 工具调用请求
  toolCallRequest: {
    model: "claude-3-5-sonnet-20241022",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "请计算 15 + 27" }]
      }
    ],
    max_tokens: 200,
    tools: [
      {
        name: "calculate",
        description: "执行数学计算",
        input_schema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "数学表达式" }
          },
          required: ["expression"]
        }
      }
    ],
    metadata: {
      requestId: "test-req-001"
    }
  },

  // 流式工具调用请求
  streamingToolCallRequest: {
    model: "claude-3-5-sonnet-20241022",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "请计算 42 / 6" }]
      }
    ],
    max_tokens: 200,
    stream: true,
    tools: [
      {
        name: "calculate",
        description: "数学计算",
        input_schema: {
          type: "object",
          properties: { 
            expression: { type: "string", description: "数学表达式" }
          },
          required: ["expression"]
        }
      }
    ],
    metadata: {
      requestId: "test-req-002"
    }
  },

  // 工具结果请求
  toolResultRequest: {
    model: "claude-3-5-sonnet-20241022",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "请计算 25 * 8" }]
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_test123",
            name: "calculate",
            input: { expression: "25 * 8" }
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_test123",
            content: "200"
          }
        ]
      }
    ],
    max_tokens: 200,
    metadata: {
      requestId: "test-req-003"
    }
  }
};

class OpenAILogicSimulator {
  constructor() {
    this.testResults = [];
  }

  /**
   * 测试1: OpenAI Transformer逻辑测试
   */
  async testTransformerLogic() {
    console.log('🧪 测试1: OpenAI Transformer逻辑测试');
    console.log('-'.repeat(50));

    try {
      // 动态导入transformer（使用编译后的代码）
      const { createOpenAITransformer } = require('./dist/transformers/openai');
      const transformer = createOpenAITransformer();

      // 测试1.1: BaseRequest到OpenAI格式转换
      console.log('📤 测试1.1: BaseRequest -> OpenAI格式转换');
      const openaiRequest = transformer.transformBaseRequestToOpenAI(mockBaseRequests.toolCallRequest);
      
      console.log(`✅ 转换成功`);
      console.log(`🔧 模型: ${openaiRequest.model}`);
      console.log(`🛠️  工具数量: ${openaiRequest.tools?.length || 0}`);
      console.log(`📝 消息数量: ${openaiRequest.messages.length}`);
      console.log(`🌊 流式: ${openaiRequest.stream}`);

      // 验证转换结果
      const isValidOpenAIRequest = 
        openaiRequest.model === mockBaseRequests.toolCallRequest.model &&
        openaiRequest.tools && openaiRequest.tools.length > 0 &&
        openaiRequest.messages.length > 0;

      console.log(`🎯 转换验证: ${isValidOpenAIRequest ? '✅ 通过' : '❌ 失败'}`);

      // 测试1.2: OpenAI响应到BaseResponse转换
      console.log('\n📥 测试1.2: OpenAI响应 -> BaseResponse转换');
      const baseResponse = transformer.transformOpenAIResponseToBase(
        mockOpenAIResponses.toolCallResponse, 
        mockBaseRequests.toolCallRequest
      );

      console.log(`✅ 转换成功`);
      console.log(`📋 Stop Reason: ${baseResponse.stop_reason}`);
      console.log(`🔧 Content Blocks: ${baseResponse.content.length}`);
      
      const toolCalls = baseResponse.content.filter(c => c.type === 'tool_use');
      console.log(`🛠️  工具调用数量: ${toolCalls.length}`);

      // 验证转换结果
      const isValidBaseResponse = 
        baseResponse.stop_reason === 'tool_use' &&
        toolCalls.length > 0 &&
        toolCalls[0].name === 'calculate';

      console.log(`🎯 转换验证: ${isValidBaseResponse ? '✅ 通过' : '❌ 失败'}`);

      this.testResults.push({
        name: 'Transformer Logic',
        passed: isValidOpenAIRequest && isValidBaseResponse,
        details: {
          requestTransform: isValidOpenAIRequest,
          responseTransform: isValidBaseResponse,
          toolCallsDetected: toolCalls.length,
          stopReason: baseResponse.stop_reason
        }
      });

    } catch (error) {
      console.error('❌ Transformer测试失败:', error.message);
      this.testResults.push({
        name: 'Transformer Logic',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * 测试2: StreamingSimulator逻辑测试
   */
  async testStreamingSimulatorLogic() {
    console.log('\n🧪 测试2: StreamingSimulator逻辑测试');
    console.log('-'.repeat(50));

    try {
      // 动态导入StreamingSimulator
      const { StreamingSimulator } = require('./dist/utils/openai-streaming-handler');
      const { createOpenAITransformer } = require('./dist/transformers/openai');
      
      const transformer = createOpenAITransformer();

      // 先转换OpenAI响应为BaseResponse
      const baseResponse = transformer.transformOpenAIResponseToBase(
        mockOpenAIResponses.toolCallResponse, 
        mockBaseRequests.toolCallRequest
      );

      console.log('📤 开始流式模拟...');
      
      // 收集流式事件
      const streamEvents = [];
      for (const chunk of StreamingSimulator.simulateStreamingResponse(baseResponse, 'test-req-002')) {
        streamEvents.push(chunk);
      }

      console.log(`✅ 流式模拟完成`);
      console.log(`📦 总事件数: ${streamEvents.length}`);

      // 分析事件类型
      const eventTypes = streamEvents.map(e => e.event);
      const uniqueEventTypes = [...new Set(eventTypes)];
      console.log(`🎭 事件类型: ${uniqueEventTypes.join(', ')}`);

      // 验证关键事件
      const hasMessageStart = eventTypes.includes('message_start');
      const hasContentBlockStart = eventTypes.includes('content_block_start');
      const hasContentBlockDelta = eventTypes.includes('content_block_delta');
      const hasContentBlockStop = eventTypes.includes('content_block_stop');
      const hasMessageDelta = eventTypes.includes('message_delta');
      const hasMessageStop = eventTypes.includes('message_stop');

      console.log(`📨 Message Start: ${hasMessageStart ? '✅' : '❌'}`);
      console.log(`🔧 Content Block Start: ${hasContentBlockStart ? '✅' : '❌'}`);
      console.log(`📝 Content Block Delta: ${hasContentBlockDelta ? '✅' : '❌'}`);
      console.log(`🛑 Content Block Stop: ${hasContentBlockStop ? '✅' : '❌'}`);
      console.log(`📋 Message Delta: ${hasMessageDelta ? '✅' : '❌'}`);
      console.log(`🏁 Message Stop: ${hasMessageStop ? '✅' : '❌'}`);

      // 检查finish reason传递
      const messageDeltaEvent = streamEvents.find(e => e.event === 'message_delta');
      const finishReason = messageDeltaEvent?.data?.delta?.stop_reason;
      console.log(`🎯 Finish Reason: ${finishReason}`);

      // 验证流式模拟
      const isValidStreaming = 
        hasMessageStart && hasContentBlockStart && hasMessageDelta && 
        hasMessageStop && finishReason === 'tool_use';

      console.log(`🎯 流式模拟验证: ${isValidStreaming ? '✅ 通过' : '❌ 失败'}`);

      this.testResults.push({
        name: 'Streaming Simulator',
        passed: isValidStreaming,
        details: {
          eventCount: streamEvents.length,
          eventTypes: uniqueEventTypes,
          hasAllRequiredEvents: hasMessageStart && hasContentBlockStart && hasMessageDelta && hasMessageStop,
          finishReason: finishReason
        }
      });

    } catch (error) {
      console.error('❌ StreamingSimulator测试失败:', error.message);
      this.testResults.push({
        name: 'Streaming Simulator',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * 测试3: 错误处理逻辑测试
   */
  async testErrorHandlingLogic() {
    console.log('\n🧪 测试3: 错误处理逻辑测试');
    console.log('-'.repeat(50));

    try {
      const { createOpenAITransformer } = require('./src/transformers/openai');
      const transformer = createOpenAITransformer();

      // 测试无效响应处理
      console.log('📤 测试无效响应处理...');
      
      let errorCaught = false;
      let errorMessage = '';

      try {
        transformer.transformOpenAIResponseToBase(
          mockOpenAIResponses.invalidResponse, 
          mockBaseRequests.toolCallRequest
        );
      } catch (error) {
        errorCaught = true;
        errorMessage = error.message;
      }

      console.log(`🚨 错误捕获: ${errorCaught ? '✅' : '❌'}`);
      console.log(`📋 错误信息: ${errorMessage}`);

      // 验证错误处理
      const isValidErrorHandling = 
        errorCaught && 
        errorMessage.includes('missing choices');

      console.log(`🎯 错误处理验证: ${isValidErrorHandling ? '✅ 通过' : '❌ 失败'}`);

      this.testResults.push({
        name: 'Error Handling',
        passed: isValidErrorHandling,
        details: {
          errorCaught: errorCaught,
          errorMessage: errorMessage,
          expectedError: 'missing choices'
        }
      });

    } catch (error) {
      console.error('❌ 错误处理测试失败:', error.message);
      this.testResults.push({
        name: 'Error Handling',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * 测试4: 工具调用结果处理逻辑
   */
  async testToolResultHandlingLogic() {
    console.log('\n🧪 测试4: 工具调用结果处理逻辑');
    console.log('-'.repeat(50));

    try {
      const { createOpenAITransformer } = require('./src/transformers/openai');
      const transformer = createOpenAITransformer();

      // 测试工具结果请求转换
      console.log('📤 测试工具结果请求转换...');
      const openaiRequest = transformer.transformBaseRequestToOpenAI(mockBaseRequests.toolResultRequest);

      console.log(`✅ 转换成功`);
      console.log(`📝 消息数量: ${openaiRequest.messages.length}`);
      console.log(`🔧 包含工具结果: ${JSON.stringify(openaiRequest.messages).includes('tool_result') ? '✅' : '❌'}`);

      // 验证工具结果处理
      const hasToolResult = openaiRequest.messages.some(msg => 
        typeof msg.content === 'string' && msg.content.includes('200')
      );

      console.log(`🎯 工具结果处理验证: ${hasToolResult ? '✅ 通过' : '❌ 失败'}`);

      this.testResults.push({
        name: 'Tool Result Handling',
        passed: hasToolResult,
        details: {
          messageCount: openaiRequest.messages.length,
          hasToolResult: hasToolResult
        }
      });

    } catch (error) {
      console.error('❌ 工具结果处理测试失败:', error.message);
      this.testResults.push({
        name: 'Tool Result Handling',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * 运行所有逻辑测试
   */
  async runAllLogicTests() {
    console.log('🚀 OpenAI Provider逻辑模拟测试');
    console.log('='.repeat(60));
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log(`测试模式: 逻辑模拟（无服务器依赖）`);

    // 设置模块路径
    process.chdir(__dirname);

    await this.testTransformerLogic();
    await this.testStreamingSimulatorLogic();
    await this.testErrorHandlingLogic();
    await this.testToolResultHandlingLogic();

    // 生成测试报告
    console.log('\n📊 逻辑测试结果总结');
    console.log('='.repeat(60));
    
    let passedTests = 0;
    let totalTests = this.testResults.length;

    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      console.log(`${index + 1}. ${result.name}: ${status}`);
      
      if (result.passed) {
        passedTests++;
      } else if (result.error) {
        console.log(`   错误: ${result.error}`);
      }

      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    });

    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\n🎯 逻辑测试结果: ${passedTests}/${totalTests} 通过 (${successRate}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 所有逻辑测试通过！可以进行服务器测试。');
    } else {
      console.log('⚠️  部分逻辑测试失败，需要修复后再进行服务器测试。');
    }

    return {
      passed: passedTests,
      total: totalTests,
      successRate: successRate,
      allPassed: passedTests === totalTests,
      results: this.testResults
    };
  }
}

// 运行逻辑测试
async function runLogicSimulation() {
  const simulator = new OpenAILogicSimulator();
  return await simulator.runAllLogicTests();
}

if (require.main === module) {
  runLogicSimulation().catch(error => {
    console.error('❌ 逻辑测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runLogicSimulation };