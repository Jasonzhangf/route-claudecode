#!/usr/bin/env node

/**
 * Debug OpenAI -> Anthropic transformation pipeline
 * 模拟完整的数据转换流程来定位stop_reason字段丢失的原因
 */

const { transformOpenAIResponseToAnthropic } = require('./dist/transformers/manager');

// 模拟各种OpenAI响应格式
const mockOpenAIResponses = [
  {
    name: "正常完成",
    response: {
      id: "chatcmpl-test-1",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! How can I help you today?"
        },
        finish_reason: "stop"
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18
      }
    }
  },
  {
    name: "工具调用完成",
    response: {
      id: "chatcmpl-test-2", 
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "I'll edit the file for you.",
          tool_calls: [{
            id: "call_test_123",
            type: "function",
            function: {
              name: "Edit",
              arguments: '{"file_path": "/tmp/test.txt", "old_string": "", "new_string": "hello world"}'
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
    }
  },
  {
    name: "达到最大长度",
    response: {
      id: "chatcmpl-test-3",
      object: "chat.completion", 
      created: Math.floor(Date.now() / 1000),
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "This is a very long response that was cut off due to max_tokens limit..."
        },
        finish_reason: "length"
      }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 100,
        total_tokens: 120
      }
    }
  }
];

console.log('🔍 测试 OpenAI -> Anthropic 转换管道');
console.log('='.repeat(60));

mockOpenAIResponses.forEach((testCase, index) => {
  console.log(`\n📋 测试 ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(40));
  
  try {
    // 显示原始OpenAI响应的关键字段
    const originalFinishReason = testCase.response.choices[0].finish_reason;
    console.log(`🔤 原始 finish_reason: "${originalFinishReason}"`);
    
    // 执行转换
    const result = transformOpenAIResponseToAnthropic(testCase.response, 'test-request');
    
    // 检查转换结果
    console.log(`📦 转换后结构:`, {
      id: result.id,
      type: result.type,
      role: result.role,
      stop_reason: result.stop_reason,
      stop_sequence: result.stop_sequence,
      contentBlocks: result.content?.length || 0
    });
    
    // 验证stop_reason映射
    const expectedMapping = {
      'stop': 'end_turn',
      'tool_calls': 'tool_use', 
      'length': 'max_tokens',
      'function_call': 'tool_use',
      'content_filter': 'stop_sequence'
    };
    
    const expectedStopReason = expectedMapping[originalFinishReason] || 'end_turn';
    const actualStopReason = result.stop_reason;
    
    if (actualStopReason === expectedStopReason) {
      console.log(`✅ stop_reason 映射正确: ${originalFinishReason} -> ${actualStopReason}`);
    } else {
      console.log(`❌ stop_reason 映射错误: ${originalFinishReason} -> ${actualStopReason} (期望: ${expectedStopReason})`);
    }
    
    // 检查内容结构  
    if (result.content && Array.isArray(result.content)) {
      console.log(`📝 内容块数量: ${result.content.length}`);
      result.content.forEach((block, i) => {
        console.log(`   ${i+1}. ${block.type}${block.name ? ` (${block.name})` : ''}`);
      });
    }
    
  } catch (error) {
    console.log(`❌ 转换失败: ${error.message}`);
    console.log(`🔍 错误堆栈:`, error.stack);
  }
});

console.log('\n' + '='.repeat(60));
console.log('🏁 转换管道测试完成');