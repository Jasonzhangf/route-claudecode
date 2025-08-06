#!/usr/bin/env node

/**
 * 基于真实日志数据流测试
 * 使用从pipeline.log中提取的真实数据
 */

console.log('🔍 真实数据流测试');
console.log('='.repeat(50));

// 从日志中提取的真实Provider Response
const realProviderResponse = {
  "id": "gen-1754396562-oxAWzIaMAZK5jlmvTQiU",
  "model": "qwen3-coder",
  "role": "assistant",
  "content": [{"type": "text", "text": "Hi！"}],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {"input_tokens": 11, "output_tokens": 3}
};

console.log('\n📥 真实Provider Response:');
console.log(`   stop_reason: "${realProviderResponse.stop_reason}"`);
console.log(`   类型: ${typeof realProviderResponse.stop_reason}`);

// 模拟isAnthropicFormat检查
function isAnthropicFormat(response) {
  const result = (
    response &&
    typeof response === 'object' &&
    response.role === 'assistant' &&
    Array.isArray(response.content) &&
    (response.type === 'message' || !response.type)
  );
  
  console.log('\n🔍 isAnthropicFormat 检查:');
  console.log(`   response存在: ${!!response}`);
  console.log(`   typeof === 'object': ${typeof response === 'object'}`);
  console.log(`   role === 'assistant': ${response.role === 'assistant'}`);
  console.log(`   Array.isArray(content): ${Array.isArray(response.content)}`);
  console.log(`   type条件: ${response.type === 'message' || !response.type} (type="${response.type}")`);
  console.log(`   ✅ 总结果: ${result}`);
  
  return result;
}

const useValidateAndNormalize = isAnthropicFormat(realProviderResponse);

if (useValidateAndNormalize) {
  console.log('\n🔧 走 validateAndNormalize 路径');
  
  // 模拟validateAndNormalize方法
  function validateAndNormalize(response, originalRequest = {model: 'qwen3-coder'}) {
    const mapFinishReason = (finishReason) => {
      if (!finishReason || finishReason === '' || finishReason === null || finishReason === undefined) {
        return 'end_turn';
      }
      return finishReason;
    };
    
    console.log('\n   📥 validateAndNormalize 输入:');
    console.log(`      response.stop_reason: "${response.stop_reason}"`);
    
    const normalized = {
      content: response.content,
      id: response.id,
      model: originalRequest.model,
      role: 'assistant',
      stop_reason: response.stop_reason || mapFinishReason('stop'),
      stop_sequence: response.stop_sequence || null,
      type: 'message',
      usage: response.usage
    };
    
    console.log('\n   📤 validateAndNormalize 输出:');
    console.log(`      normalized.stop_reason: "${normalized.stop_reason}"`);
    console.log(`      类型: ${typeof normalized.stop_reason}`);
    
    return normalized;
  }
  
  const result = validateAndNormalize(realProviderResponse);
  
  console.log('\n🏁 最终结果:');
  console.log(`   stop_reason: "${result.stop_reason}"`);
  
  if (result.stop_reason === 'end_turn') {
    console.log('   ✅ SUCCESS: validateAndNormalize保持了stop_reason!');
    console.log('   💡 问题一定在别的地方');
  } else {
    console.log('   ❌ FAILURE: validateAndNormalize有问题');
  }
  
} else {
  console.log('\n⚠️  走其他转换路径');
}

console.log('\n💭 根据日志分析:');
console.log('Provider Response 有 stop_reason: "end_turn"');
console.log('Final Response 缺少 stop_reason');
console.log('validateAndNormalize 理论上应该保持这个字段');
console.log('问题可能在于:');
console.log('1. validateAndNormalize 的实际实现与代码不符');
console.log('2. 有其他步骤在 validateAndNormalize 之后移除了该字段');
console.log('3. logger.debug 输出和实际返回值不同');