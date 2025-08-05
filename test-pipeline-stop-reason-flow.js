#!/usr/bin/env node

/**
 * 端到端流水线模拟测试：Stop Reason处理流程
 * 模拟完整的处理流水线：OpenAI API Response -> Enhanced Client -> Transformer -> Output Processor -> Final Response
 */

console.log('🔍 完整流水线模拟测试：Stop Reason处理');
console.log('='.repeat(60));

// Step 1: 模拟ShuaiHong OpenAI API的原始响应
const mockShuaiHongApiResponse = {
  id: "chatcmpl-test-12345",
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model: "qwen3-coder",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: "Hello! How can I help you today?"
    },
    finish_reason: "stop"  // 关键字段
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 8,
    total_tokens: 18
  }
};

console.log('\n📡 Step 1: ShuaiHong API 原始响应');
console.log(`   🔤 finish_reason: "${mockShuaiHongApiResponse.choices[0].finish_reason}"`);
console.log(`   ✅ API响应格式正确`);

// Step 2: Enhanced OpenAI Client 处理
// 模拟 Enhanced Client 的 convertFromOpenAI 方法
function mockEnhancedClientProcessing(openaiResponse) {
  console.log('\n🔧 Step 2: Enhanced OpenAI Client 处理');
  
  // 模拟 transformOpenAIResponseToAnthropic 调用
  console.log('   📤 调用 transformOpenAIResponseToAnthropic...');
  
  // 2a: OpenAI -> Unified (OpenAI Transformer)
  const unifiedResponse = {
    id: openaiResponse.id,
    object: 'chat.completion',
    created: openaiResponse.created,
    model: openaiResponse.model,
    choices: [{
      index: 0,
      message: {
        role: openaiResponse.choices[0].message.role,
        content: openaiResponse.choices[0].message.content,
        tool_calls: openaiResponse.choices[0].message.tool_calls
      },
      finish_reason: openaiResponse.choices[0].finish_reason  // 保持原值
    }],
    usage: openaiResponse.usage
  };
  
  console.log(`   🔄 Unified format finish_reason: "${unifiedResponse.choices[0].finish_reason}"`);
  
  // 2b: Unified -> Anthropic (Anthropic Transformer) 
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
  
  const anthropicResponse = {
    id: unifiedResponse.id,
    type: 'message',
    role: 'assistant',
    content: [{
      type: 'text',
      text: unifiedResponse.choices[0].message.content
    }],
    model: unifiedResponse.model,
    stop_reason: mapFinishReason(unifiedResponse.choices[0].finish_reason),  // 关键映射
    stop_sequence: null,
    usage: {
      input_tokens: unifiedResponse.usage.prompt_tokens,
      output_tokens: unifiedResponse.usage.completion_tokens
    }
  };
  
  console.log(`   🎯 Anthropic format stop_reason: "${anthropicResponse.stop_reason}"`);
  console.log(`   ✅ Transformer处理完成`);
  
  return anthropicResponse;
}

const transformedResponse = mockEnhancedClientProcessing(mockShuaiHongApiResponse);

// Step 3: 模拟 Enhanced Client 的 BaseResponse 格式转换
function mockBaseResponseConversion(anthropicResponse) {
  console.log('\n🔄 Step 3: BaseResponse 格式转换');
  
  const baseResponse = {
    id: anthropicResponse.id,
    model: mockShuaiHongApiResponse.model, // 使用原始模型名
    role: 'assistant',
    content: anthropicResponse.content,
    stop_reason: anthropicResponse.stop_reason,  // 保持不变
    stop_sequence: anthropicResponse.stop_sequence,
    usage: {
      input_tokens: anthropicResponse.usage.input_tokens,
      output_tokens: anthropicResponse.usage.output_tokens
    }
  };
  
  console.log(`   📦 BaseResponse stop_reason: "${baseResponse.stop_reason}"`);
  console.log(`   ✅ BaseResponse转换完成`);
  
  return baseResponse;
}

const baseResponse = mockBaseResponseConversion(transformedResponse);

// Step 4: 模拟 Anthropic Output Processor 处理
function mockAnthropicOutputProcessor(response) {
  console.log('\n📤 Step 4: Anthropic Output Processor 处理');
  
  // 检查是否已经是Anthropic格式
  const isAnthropicFormat = (
    response &&
    typeof response === 'object' &&
    response.role === 'assistant' &&
    Array.isArray(response.content)
  );
  
  console.log(`   🔍 是否已是Anthropic格式: ${isAnthropicFormat}`);
  
  if (isAnthropicFormat) {
    // 使用 validateAndNormalize
    console.log('   🔧 使用 validateAndNormalize 方法');
    const mapFinishReason = (finishReason) => {
      const mapping = {
        '': 'end_turn',
        null: 'end_turn', 
        undefined: 'end_turn',
        'stop': 'end_turn'
      };
      return mapping[finishReason] || finishReason;
    };
    
    const normalized = {
      content: response.content,
      id: response.id,
      model: response.model,
      role: 'assistant',
      stop_reason: response.stop_reason || mapFinishReason('stop'),  // 关键逻辑
      stop_sequence: response.stop_sequence || null,
      type: 'message',
      usage: response.usage
    };
    
    console.log(`   📋 Normalized stop_reason: "${normalized.stop_reason}"`);
    console.log(`   ✅ Output Processor完成`);
    
    return normalized;
  } else {
    // 其他转换方法
    console.log('   ⚠️  使用其他转换方法');
    return response;
  }
}

const finalResponse = mockAnthropicOutputProcessor(baseResponse);

// Step 5: 最终验证
console.log('\n🏁 Step 5: 最终结果验证');
console.log('-'.repeat(40));
console.log(`📊 完整流水线结果:`);
console.log(`   • 原始 finish_reason: "${mockShuaiHongApiResponse.choices[0].finish_reason}"`);
console.log(`   • 最终 stop_reason: "${finalResponse.stop_reason}"`);
console.log(`   • 内容块数量: ${finalResponse.content.length}`);
console.log(`   • 响应ID: ${finalResponse.id}`);

// 验证映射正确性
const expectedStopReason = 'end_turn';
if (finalResponse.stop_reason === expectedStopReason) {
  console.log(`   ✅ 映射正确: stop -> ${finalResponse.stop_reason}`);
} else {
  console.log(`   ❌ 映射错误: 期望 ${expectedStopReason}, 实际 ${finalResponse.stop_reason}`);
}

// 检查字段完整性
const requiredFields = ['content', 'id', 'model', 'role', 'stop_reason', 'type', 'usage'];
const missingFields = requiredFields.filter(field => !(field in finalResponse));

if (missingFields.length === 0) {
  console.log(`   ✅ 所有必需字段都存在`);
} else {
  console.log(`   ❌ 缺少字段: ${missingFields.join(', ')}`);
}

console.log('\n' + '='.repeat(60));
console.log('📋 模拟测试总结');
console.log('='.repeat(60));

if (finalResponse.stop_reason === expectedStopReason && missingFields.length === 0) {
  console.log('🎉 SUCCESS: 流水线模拟测试完全通过！');
  console.log('💡 理论上系统应该正常工作');
  console.log('💭 如果真实API仍有问题，可能原因：');
  console.log('   1. 真实的OpenAI响应格式与模拟不同');
  console.log('   2. 处理流程中有我们遗漏的步骤');
  console.log('   3. 某些边界条件处理有问题');
} else {
  console.log('❌ FAILURE: 模拟测试发现问题');
  console.log('🔧 需要修复的问题：');
  if (finalResponse.stop_reason !== expectedStopReason) {
    console.log(`   • stop_reason映射错误`);
  }
  if (missingFields.length > 0) {
    console.log(`   • 缺少必需字段: ${missingFields.join(', ')}`);
  }
}

console.log('\n🚀 下一步：运行真实API测试验证理论结果');