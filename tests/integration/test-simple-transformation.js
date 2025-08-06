#!/usr/bin/env node

/**
 * 简单的转换测试：模拟 OpenAI -> Unified -> Anthropic 流程
 */

// 简单的映射函数（复制自我们的代码）
function mapOpenAIFinishReason(finishReason) {
  const mapping = {
    'stop': 'end_turn',
    'length': 'max_tokens',
    'function_call': 'tool_use',
    'tool_calls': 'tool_use',
    'content_filter': 'stop_sequence'
  };
  return mapping[finishReason] || 'end_turn';
}

// 模拟OpenAI response -> Unified response转换
function mockOpenAIToUnified(openaiResponse) {
  const choice = openaiResponse.choices[0];
  return {
    id: openaiResponse.id,
    object: 'chat.completion',
    created: openaiResponse.created,
    model: openaiResponse.model,
    choices: [{
      index: 0,
      message: {
        role: choice.message.role,
        content: choice.message.content,
        tool_calls: choice.message.tool_calls
      },
      finish_reason: choice.finish_reason
    }],
    usage: openaiResponse.usage
  };
}

// 模拟Unified -> Anthropic转换（基于我们修复的代码）
function mockUnifiedToAnthropic(unifiedResponse) {
  const choice = unifiedResponse.choices[0];
  const content = [];

  // 添加文本内容
  if (choice.message.content) {
    content.push({
      type: 'text',
      text: choice.message.content
    });
  }

  // 添加工具调用
  if (choice.message.tool_calls) {
    choice.message.tool_calls.forEach(toolCall => {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments || '{}')
      });
    });
  }

  // 关键：应用我们的修复
  return {
    id: unifiedResponse.id,
    type: 'message',
    role: 'assistant',
    content,
    model: unifiedResponse.model,
    stop_reason: mapOpenAIFinishReason(choice.finish_reason || 'stop'),
    stop_sequence: null,
    usage: {
      input_tokens: unifiedResponse.usage.prompt_tokens,
      output_tokens: unifiedResponse.usage.completion_tokens
    }
  };
}

// 测试用例
const testCases = [
  {
    name: "正常结束",
    openaiResponse: {
      id: "test-1",
      object: "chat.completion",
      created: 1234567890,
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! How can I help you?"
        },
        finish_reason: "stop"
      }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
    }
  },
  {
    name: "工具调用",
    openaiResponse: {
      id: "test-2",
      object: "chat.completion", 
      created: 1234567890,
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "I'll edit the file.",
          tool_calls: [{
            id: "call_123",
            type: "function",
            function: {
              name: "Edit",
              arguments: '{"file_path": "/tmp/test.txt", "old_string": "", "new_string": "hello"}'
            }
          }]
        },
        finish_reason: "tool_calls"
      }],
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
    }
  },
  {
    name: "达到长度限制",
    openaiResponse: {
      id: "test-3",
      object: "chat.completion",
      created: 1234567890, 
      model: "qwen3-coder",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "This response was cut off..."
        },
        finish_reason: "length"
      }],
      usage: { prompt_tokens: 20, completion_tokens: 100, total_tokens: 120 }
    }
  }
];

console.log('🧪 模拟完整转换管道测试');
console.log('='.repeat(50));

testCases.forEach((testCase, index) => {
  console.log(`\n📋 测试 ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(30));
  
  try {
    const originalFinishReason = testCase.openaiResponse.choices[0].finish_reason;
    console.log(`🔤 原始 finish_reason: "${originalFinishReason}"`);
    
    // 第一步：OpenAI -> Unified
    const unified = mockOpenAIToUnified(testCase.openaiResponse);
    console.log(`🔄 Unified finish_reason: "${unified.choices[0].finish_reason}"`);
    
    // 第二步：Unified -> Anthropic
    const anthropic = mockUnifiedToAnthropic(unified);
    console.log(`🎯 Anthropic stop_reason: "${anthropic.stop_reason}"`);
    
    // 验证映射
    const expectedStopReason = mapOpenAIFinishReason(originalFinishReason);
    if (anthropic.stop_reason === expectedStopReason) {
      console.log(`✅ 映射正确: ${originalFinishReason} -> ${anthropic.stop_reason}`);
    } else {
      console.log(`❌ 映射错误: ${originalFinishReason} -> ${anthropic.stop_reason} (期望: ${expectedStopReason})`);
    }
    
    // 显示完整结构
    console.log(`📦 最终结构: id=${anthropic.id}, type=${anthropic.type}, blocks=${anthropic.content.length}`);
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }
});

console.log(`\n${'='.repeat(50)}`);
console.log('🏁 模拟测试完成 - 理论上转换应该工作正常！');
console.log('💡 如果真实API仍然返回null，问题可能在于：');
console.log('   1. OpenAI Provider未正确传递finish_reason');  
console.log('   2. Anthropic Output Processor覆盖了stop_reason');
console.log('   3. 其他中间处理步骤丢失了字段');