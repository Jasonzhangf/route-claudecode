#!/usr/bin/env node
/**
 * OpenAI Provider简化逻辑测试
 * 使用编译后的代码测试核心逻辑
 */

// 模拟数据
const mockOpenAIResponse = {
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
};

const mockBaseRequest = {
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
};

async function testOpenAILogic() {
  console.log('🚀 OpenAI Provider简化逻辑测试');
  console.log('='.repeat(50));

  let passedTests = 0;
  let totalTests = 0;

  try {
    // 测试1: Transformer逻辑
    console.log('🧪 测试1: OpenAI Transformer');
    totalTests++;

    const { createOpenAITransformer } = require('./dist/transformers/openai');
    const transformer = createOpenAITransformer();

    // 测试请求转换
    const openaiRequest = transformer.transformBaseRequestToOpenAI(mockBaseRequest);
    console.log(`✅ 请求转换成功: 模型=${openaiRequest.model}, 工具=${openaiRequest.tools?.length || 0}`);

    // 测试响应转换
    const baseResponse = transformer.transformOpenAIResponseToBase(mockOpenAIResponse, mockBaseRequest);
    console.log(`✅ 响应转换成功: stop_reason=${baseResponse.stop_reason}, 内容块=${baseResponse.content.length}`);

    // 验证工具调用
    const toolCalls = baseResponse.content.filter(c => c.type === 'tool_use');
    const isValidTransform = 
      baseResponse.stop_reason === 'tool_use' && 
      toolCalls.length > 0 && 
      toolCalls[0].name === 'calculate';

    if (isValidTransform) {
      console.log('🎯 Transformer测试: ✅ 通过');
      passedTests++;
    } else {
      console.log('🎯 Transformer测试: ❌ 失败');
    }

  } catch (error) {
    console.log(`❌ Transformer测试失败: ${error.message}`);
  }

  try {
    // 测试2: StreamingSimulator逻辑
    console.log('\n🧪 测试2: StreamingSimulator');
    totalTests++;

    const { StreamingSimulator } = require('./dist/utils/openai-streaming-handler');
    const { createOpenAITransformer } = require('./dist/transformers/openai');
    
    const transformer = createOpenAITransformer();
    const baseResponse = transformer.transformOpenAIResponseToBase(mockOpenAIResponse, mockBaseRequest);

    // 收集流式事件
    const streamEvents = [];
    for (const chunk of StreamingSimulator.simulateStreamingResponse(baseResponse, 'test-req-002')) {
      streamEvents.push(chunk);
    }

    console.log(`✅ 流式模拟完成: ${streamEvents.length}个事件`);

    // 验证关键事件
    const eventTypes = streamEvents.map(e => e.event);
    const hasMessageStart = eventTypes.includes('message_start');
    const hasMessageStop = eventTypes.includes('message_stop');
    const hasContentBlock = eventTypes.includes('content_block_start');

    // 检查finish reason
    const messageDeltaEvent = streamEvents.find(e => e.event === 'message_delta');
    const finishReason = messageDeltaEvent?.data?.delta?.stop_reason;

    const isValidStreaming = 
      hasMessageStart && hasMessageStop && hasContentBlock && 
      finishReason === 'tool_use';

    if (isValidStreaming) {
      console.log('🎯 StreamingSimulator测试: ✅ 通过');
      console.log(`   事件: ${[...new Set(eventTypes)].join(', ')}`);
      console.log(`   Finish Reason: ${finishReason}`);
      passedTests++;
    } else {
      console.log('🎯 StreamingSimulator测试: ❌ 失败');
      console.log(`   缺少事件: start=${hasMessageStart}, stop=${hasMessageStop}, content=${hasContentBlock}`);
      console.log(`   Finish Reason: ${finishReason}`);
    }

  } catch (error) {
    console.log(`❌ StreamingSimulator测试失败: ${error.message}`);
  }

  try {
    // 测试3: 错误处理
    console.log('\n🧪 测试3: 错误处理');
    totalTests++;

    const { createOpenAITransformer } = require('./dist/transformers/openai');
    const transformer = createOpenAITransformer();

    // 测试无效响应
    const invalidResponse = { ...mockOpenAIResponse };
    delete invalidResponse.choices; // 删除choices字段

    let errorCaught = false;
    try {
      transformer.transformOpenAIResponseToBase(invalidResponse, mockBaseRequest);
    } catch (error) {
      errorCaught = true;
      console.log(`✅ 错误正确捕获: ${error.message}`);
    }

    if (errorCaught) {
      console.log('🎯 错误处理测试: ✅ 通过');
      passedTests++;
    } else {
      console.log('🎯 错误处理测试: ❌ 失败 - 未捕获错误');
    }

  } catch (error) {
    console.log(`❌ 错误处理测试失败: ${error.message}`);
  }

  // 生成测试报告
  console.log('\n📊 逻辑测试结果');
  console.log('='.repeat(50));
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`🎯 测试结果: ${passedTests}/${totalTests} 通过 (${successRate}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有逻辑测试通过！OpenAI Provider核心逻辑正常。');
    console.log('✅ 可以进行服务器测试。');
    return true;
  } else {
    console.log('⚠️  部分逻辑测试失败，需要修复。');
    return false;
  }
}

if (require.main === module) {
  testOpenAILogic().catch(error => {
    console.error('❌ 逻辑测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testOpenAILogic };