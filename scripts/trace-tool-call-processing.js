#!/usr/bin/env node
/**
 * 🔍 追踪工具调用处理流程
 * 
 * 问题：工具调用检测成功，但在后续处理中被丢失
 * 需要找出在哪个环节工具调用被移除了
 */

console.log('🔍 [TOOL-CALL-TRACE] 追踪工具调用处理流程...');

console.log('\n📊 问题分析:');
console.log('='.repeat(60));
console.log('✅ 1. 工具调用检测器: 应该能正确检测 (模拟测试通过)');
console.log('❓ 2. 响应流水线处理: 可能在这里丢失');
console.log('❓ 3. 输出处理器: 可能在这里丢失');
console.log('❌ 4. 一致性验证器: 发现没有工具调用，修复stop_reason');

console.log('\n🔍 关键日志分析:');
console.log('='.repeat(60));
console.log('从日志中可以看到:');
console.log('1. "Tool detection result: 1 tools found" - 检测成功');
console.log('2. "Fixed unnecessary tool_use stop_reason" - 验证器认为没有工具');
console.log('3. 这说明工具调用在检测后被丢失了');

console.log('\n🎯 可能的问题点:');
console.log('='.repeat(60));
console.log('1. 响应流水线的transformation阶段');
console.log('2. 输出处理器的格式转换');
console.log('3. 某个中间处理步骤覆盖了content');
console.log('4. 工具调用格式转换错误');

console.log('\n💡 调试建议:');
console.log('='.repeat(60));
console.log('1. 在响应流水线的每个阶段添加日志');
console.log('2. 检查transformation阶段是否保留了工具调用');
console.log('3. 检查输出处理器是否正确处理工具调用');
console.log('4. 确认一致性验证器的工具计数逻辑');

console.log('\n🔧 立即修复方案:');
console.log('='.repeat(60));
console.log('1. 在一致性验证器中添加详细的工具计数日志');
console.log('2. 在响应流水线中添加工具调用追踪');
console.log('3. 检查是否有代码意外清空了content数组');

// 模拟问题场景
console.log('\n🧪 模拟问题场景:');
console.log('='.repeat(60));

const originalResponse = {
  content: [
    {
      type: "text", 
      text: "Tool call: Write({...})"
    }
  ],
  stop_reason: "tool_use"
};

console.log('原始响应:', JSON.stringify(originalResponse, null, 2));

// 模拟工具调用检测后
const afterDetection = {
  content: [
    {
      type: "tool_use",
      id: "toolu_123",
      name: "Write", 
      input: { content: "...", file_path: "..." }
    }
  ],
  stop_reason: "tool_use"
};

console.log('\n检测后应该是:', JSON.stringify(afterDetection, null, 2));

// 模拟一致性验证器看到的
const beforeValidation = {
  content: [
    {
      type: "text",
      text: "Tool call: Write({...})" // 工具调用又变回了文本！
    }
  ],
  stop_reason: "tool_use"
};

console.log('\n验证器看到的:', JSON.stringify(beforeValidation, null, 2));
console.log('👆 这就是问题所在！工具调用被还原成了文本');

console.log('\n🎯 结论:');
console.log('='.repeat(60));
console.log('工具调用检测成功，但在后续处理中被覆盖或还原了');
console.log('需要检查响应流水线和输出处理器的实现');

console.log('\n✅ 追踪完成');