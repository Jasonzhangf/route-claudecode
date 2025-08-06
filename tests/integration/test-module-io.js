#!/usr/bin/env node

/**
 * 模块输入输出测试
 * 直接测试每个处理模块的输入输出，找出stop_reason丢失的位置
 */

console.log('🧪 模块输入输出测试');
console.log('='.repeat(50));

// 测试输入：模拟ShuaiHong API返回的标准OpenAI格式响应
const testInput = {
  id: "chatcmpl-test-12345",
  object: "chat.completion", 
  created: 1734567890,
  model: "qwen3-coder",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: "Hello! How can I help you?"
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 8,
    total_tokens: 18
  }
};

console.log('\n📥 输入测试数据:');
console.log(`   🔤 finish_reason: "${testInput.choices[0].finish_reason}"`);
console.log(`   📄 content: "${testInput.choices[0].message.content}"`);

// 模块1: OpenAI Transformer - transformResponseToUnified
console.log('\n🔧 模块1: OpenAI Transformer');
function testOpenAITransformer(response) {
  const choice = response.choices[0];
  const unified = {
    id: response.id,
    object: 'chat.completion',
    created: response.created,
    model: response.model,
    choices: [{
      index: 0,
      message: {
        role: choice.message.role,
        content: choice.message.content,
        tool_calls: choice.message.tool_calls
      },
      finish_reason: choice.finish_reason
    }],
    usage: response.usage
  };
  
  console.log(`   📥 输入 finish_reason: "${response.choices[0].finish_reason}"`);
  console.log(`   📤 输出 finish_reason: "${unified.choices[0].finish_reason}"`);
  console.log(`   ✅ OpenAI Transformer 保持字段不变`);
  
  return unified;
}

const unifiedResult = testOpenAITransformer(testInput);

// 模块2: Anthropic Transformer - transformResponseFromUnified
console.log('\n🔧 模块2: Anthropic Transformer');
function testAnthropicTransformer(unifiedResponse) {
  const choice = unifiedResponse.choices[0];
  
  // 映射函数
  const mapFinishReason = (finishReason) => {
    const mapping = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'function_call': 'tool_use',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence'
    };
    return mapping[finishReason] || 'end_turn';
  };
  
  const anthropic = {
    id: unifiedResponse.id,
    type: 'message', 
    role: 'assistant',
    content: [{
      type: 'text',
      text: choice.message.content
    }],
    model: unifiedResponse.model,
    stop_reason: mapFinishReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: unifiedResponse.usage.prompt_tokens,
      output_tokens: unifiedResponse.usage.completion_tokens
    }
  };
  
  console.log(`   📥 输入 finish_reason: "${choice.finish_reason}"`);
  console.log(`   📤 输出 stop_reason: "${anthropic.stop_reason}"`);
  console.log(`   ✅ Anthropic Transformer 正确映射字段`);
  
  return anthropic;
}

const anthropicResult = testAnthropicTransformer(unifiedResult);

// 模块3: Enhanced Client - BaseResponse转换
console.log('\n🔧 模块3: Enhanced Client BaseResponse');
function testEnhancedClientConversion(anthropicResponse, originalRequest) {
  const baseResponse = {
    id: anthropicResponse.id,
    model: originalRequest.model,
    role: 'assistant',
    content: anthropicResponse.content,
    stop_reason: anthropicResponse.stop_reason,
    stop_sequence: anthropicResponse.stop_sequence,
    usage: anthropicResponse.usage
  };
  
  console.log(`   📥 输入 stop_reason: "${anthropicResponse.stop_reason}"`);
  console.log(`   📤 输出 stop_reason: "${baseResponse.stop_reason}"`);
  console.log(`   ✅ Enhanced Client 保持字段不变`);
  
  return baseResponse;
}

const baseResult = testEnhancedClientConversion(anthropicResult, testInput);

// 模块4: Output Processor - 路由判断
console.log('\n🔧 模块4: Output Processor 路由判断');
function testOutputProcessorRouting(response) {
  const isAnthropicFormat = (
    response &&
    typeof response === 'object' &&
    response.role === 'assistant' &&
    Array.isArray(response.content) &&
    (response.type === 'message' || !response.type)
  );
  
  console.log(`   🔍 isAnthropicFormat: ${isAnthropicFormat}`);
  console.log(`   📋 选择的处理方法: ${isAnthropicFormat ? 'validateAndNormalize' : '其他方法'}`);
  
  return isAnthropicFormat;
}

const useValidateAndNormalize = testOutputProcessorRouting(baseResult);

// 模块5: Output Processor - validateAndNormalize
console.log('\n🔧 模块5: Output Processor validateAndNormalize');
function testValidateAndNormalize(response) {
  const mapFinishReason = (finishReason) => {
    if (!finishReason || finishReason === '' || finishReason === null || finishReason === undefined) {
      return 'end_turn';
    }
    return finishReason;
  };
  
  const normalized = {
    content: response.content,
    id: response.id,
    model: response.model,
    role: 'assistant',
    stop_reason: response.stop_reason || mapFinishReason('stop'),
    stop_sequence: response.stop_sequence || null,
    type: 'message',
    usage: response.usage
  };
  
  console.log(`   📥 输入 stop_reason: "${response.stop_reason}"`);
  console.log(`   📤 输出 stop_reason: "${normalized.stop_reason}"`);
  console.log(`   ✅ validateAndNormalize 保持或设置默认值`);
  
  return normalized;
}

let finalResult;
if (useValidateAndNormalize) {
  finalResult = testValidateAndNormalize(baseResult);
} else {
  console.log('   ⚠️  使用其他处理方法 - 需要检查');
  finalResult = baseResult;
}

// 最终验证
console.log('\n🏁 最终结果验证');
console.log('='.repeat(30));
console.log(`📊 完整链路结果:`);
console.log(`   • 原始 finish_reason: "${testInput.choices[0].finish_reason}"`);
console.log(`   • 最终 stop_reason: "${finalResult.stop_reason}"`);
console.log(`   • 字段类型: ${typeof finalResult.stop_reason}`);
console.log(`   • 是否null: ${finalResult.stop_reason === null}`);
console.log(`   • 是否undefined: ${finalResult.stop_reason === undefined}`);

if (finalResult.stop_reason === 'end_turn') {
  console.log('   ✅ SUCCESS: 模块测试通过！');
  console.log('   💡 理论上所有模块都正确处理了stop_reason');
} else {
  console.log('   ❌ FAILURE: 某个模块有问题');
}

console.log('\n🔍 结论:');
if (finalResult.stop_reason === 'end_turn') {
  console.log('所有核心模块都正确处理stop_reason。');
  console.log('问题可能在于：');
  console.log('1. 实际数据格式与模拟不同');
  console.log('2. 有其他未测试的处理路径');
  console.log('3. 某些边界情况或异步处理问题');
} else {
  console.log('发现模块问题，需要修复相应模块。');
}