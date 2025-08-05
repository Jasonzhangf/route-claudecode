#!/usr/bin/env node

/**
 * 内部流水线诊断测试：深入分析每个处理步骤
 * 目标：找出stop_reason字段在哪个环节丢失
 */

console.log('🔍 内部流水线深度诊断');
console.log('='.repeat(60));

// 问题分析：我们的修复涵盖了多个层面，但仍然返回null
// 让我们逐层分析可能的问题点

console.log('\n📋 修复点回顾:');
console.log('1. ✅ Anthropic Transformer - 添加了stop_reason映射');
console.log('2. ✅ Output Processor validateAndNormalize - 有fallback逻辑');  
console.log('3. ✅ Output Processor convertFromContentArray - 添加了stop_reason');
console.log('4. ✅ Output Processor convertFromText - 添加了stop_reason');

console.log('\n🤔 可能的遗漏点:');

// 分析1: Enhanced Client 的 convertFromOpenAI 可能有问题
console.log('\n🔍 分析1: Enhanced Client convertFromOpenAI 方法');
console.log('问题：Enhanced Client 调用 transformOpenAIResponseToAnthropic 后');
console.log('可能在构建 BaseResponse 时丢失了 stop_reason');

function analyzeEnhancedClientFlow() {
  console.log('\n  📤 模拟 Enhanced Client 流程:');
  
  // 模拟原始 OpenAI 响应
  const openaiResponse = {
    choices: [{ finish_reason: "stop", message: { content: "Hello" } }],
    id: "test", model: "qwen3-coder", usage: { prompt_tokens: 5, completion_tokens: 3 }
  };
  
  console.log(`     🔤 原始 finish_reason: "${openaiResponse.choices[0].finish_reason}"`);
  
  // 步骤1: transformOpenAIResponseToAnthropic (我们已经修复)
  const anthropicResponse = {
    id: "test", type: 'message', role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
    stop_reason: 'end_turn', // 这里应该正确
    stop_sequence: null,
    usage: { input_tokens: 5, output_tokens: 3 }
  };
  
  console.log(`     🎯 Anthropic stop_reason: "${anthropicResponse.stop_reason}"`);
  
  // 步骤2: 构建 BaseResponse (关键检查点)
  const baseResponse = {
    id: anthropicResponse.id,
    model: openaiResponse.model,
    role: 'assistant', 
    content: anthropicResponse.content,
    stop_reason: anthropicResponse.stop_reason,  // 这里可能有问题？
    stop_sequence: anthropicResponse.stop_sequence,
    usage: anthropicResponse.usage
  };
  
  console.log(`     📦 BaseResponse stop_reason: "${baseResponse.stop_reason}"`);
  console.log(`     ✅ Enhanced Client 应该保持 stop_reason`);
  
  return baseResponse;
}

const enhancedClientResult = analyzeEnhancedClientFlow();

// 分析2: Output Processor 的路由逻辑
console.log('\n🔍 分析2: Output Processor 路由逻辑');
console.log('问题：Output Processor 的 process() 方法可能选择了错误的转换路径');

function analyzeOutputProcessorRouting(response) {
  console.log('\n  📤 模拟 Output Processor 路由:');
  
  // 检查 isAnthropicFormat 条件
  const isAnthropicFormat = (
    response &&
    typeof response === 'object' &&
    response.role === 'assistant' &&
    Array.isArray(response.content)
  );
  
  console.log(`     🔍 isAnthropicFormat check: ${isAnthropicFormat}`);
  console.log(`       - 存在对象: ${!!response}`);
  console.log(`       - role=assistant: ${response.role === 'assistant'}`);
  console.log(`       - content是数组: ${Array.isArray(response.content)}`);
  
  if (isAnthropicFormat) {
    console.log(`     ✅ 应该使用 validateAndNormalize`);
    console.log(`     📋 validateAndNormalize 输入 stop_reason: "${response.stop_reason}"`);
    
    // 模拟 validateAndNormalize
    const mapFinishReason = (reason) => reason === 'stop' ? 'end_turn' : reason;
    const normalized = {
      ...response,
      stop_reason: response.stop_reason || mapFinishReason('stop')
    };
    
    console.log(`     📋 validateAndNormalize 输出 stop_reason: "${normalized.stop_reason}"`);
    return normalized;
  } else {
    console.log(`     ⚠️  使用其他转换方法 - 可能有问题`);
    return response;
  }
}

const outputProcessorResult = analyzeOutputProcessorRouting(enhancedClientResult);

// 分析3: 检查是否有其他转换路径
console.log('\n🔍 分析3: 其他可能的转换路径');

function analyzeOtherConversionPaths(response) {
  console.log('\n  📤 检查可能的转换路径:');
  
  // 检查 convertFromOpenAI 条件
  const hasChoices = response.choices && Array.isArray(response.choices);
  console.log(`     🔄 OpenAI format (choices数组): ${hasChoices}`);
  
  // 检查 convertFromContentArray 条件  
  const isContentArray = Array.isArray(response);
  console.log(`     📝 Content array format: ${isContentArray}`);
  
  // 检查 convertFromText 条件
  const isString = typeof response === 'string';
  console.log(`     📄 Text format: ${isString}`);
  
  // 检查 convertFromStructured 条件
  const hasContent = response && response.content && !hasChoices && !isContentArray;
  console.log(`     🏗️  Structured format: ${hasContent}`);
  
  if (hasChoices) {
    console.log(`     ⚠️  如果走OpenAI路径，使用 mapOpenAIFinishReason`);
  } else if (isContentArray) {
    console.log(`     ⚠️  如果走ContentArray路径，使用我们修复的代码`);
  } else if (isString) {
    console.log(`     ⚠️  如果走Text路径，使用我们修复的代码`);
  } else if (hasContent) {
    console.log(`     ⚠️  如果走Structured路径，需要检查实现`);
  }
}

analyzeOtherConversionPaths(enhancedClientResult);

// 分析4: 可能的字段覆盖问题
console.log('\n🔍 分析4: 字段覆盖检查');
console.log('问题：某些处理步骤可能意外覆盖了 stop_reason 字段');

function analyzeFieldOverride() {
  console.log('\n  📤 检查可能的字段覆盖:');
  
  console.log('     ⚠️  可能的覆盖点:');
  console.log('       1. Response fixing 机制');
  console.log('       2. Session management');
  console.log('       3. 最终响应序列化');
  console.log('       4. Streaming vs Non-streaming 处理差异');
  
  console.log('\n     🔍 需要检查的关键代码点:');
  console.log('       1. Enhanced Client 的 fixResponse 调用');
  console.log('       2. 各种 Processor 的字段合并逻辑');
  console.log('       3. 响应构建时的字段拷贝');
}

analyzeFieldOverride();

console.log('\n🎯 诊断结论');
console.log('='.repeat(40));
console.log('基于分析，最可能的问题点：');
console.log('1. 🔴 Enhanced Client 可能在某个步骤覆盖了 stop_reason');
console.log('2. 🔴 Output Processor 的路由逻辑可能选择了错误的路径');
console.log('3. 🔴 convertFromStructured 方法可能缺少 stop_reason 处理');

console.log('\n🔧 建议的修复策略：');
console.log('1. 检查 Enhanced Client 的完整数据流');
console.log('2. 验证 Output Processor 的 convertFromStructured 方法');
console.log('3. 添加每个步骤的 stop_reason 调试日志');
console.log('4. 确认 fixResponse 机制不会覆盖 stop_reason');

console.log('\n🚀 下一步：深入检查 convertFromStructured 和相关代码');