#!/usr/bin/env node

/**
 * Test script to verify tool call detection fix for 5509 port
 * Tests the specific text that previously caused false positive detection
 */

const { PipelineDebugger } = require('./dist/debug/pipeline-debugger');

// Test text that previously caused false positive (from actual error log)
const problematicText = `
基于对现有系统架构的深入分析，我来为您设计一个全新的模块化架构方案。

## 🏗️ 新架构设计：插件化模块系统 (Plugin-Based Modular Architecture)

### 📊 现有系统问题分析

通过代码分析，我发现了以下主要问题：

#### 1. **紧耦合问题**
- **服务器直接导入Provider**: \`server.ts\` 硬编码导入所有Provider
- **重复实现**: 每个Provider都有独立的认证、转换、解析逻辑
- **静态依赖**: 模块间通过import静态耦合，无法动态替换

#### 2. **代码重复严重**
- **转换逻辑重复**: 每个Provider都实现类似的格式转换
- **认证机制重复**: 不同Provider的认证逻辑相似但独立实现
- **工具调用处理重复**: 解析和处理逻辑在多处重复

#### 3. **扩展性差**
- **添加新Provider复杂**: 需要修改多个文件
- **无法热插拔**: 必须重启服务器才能添加/移除模块
- **测试困难**: 模块间依赖复杂，单元测试困难
`;

// Test cases for actual tool call JSON structures (should be detected)
const actualToolCallTexts = [
  // Anthropic format
  '{"type": "tool_use", "id": "call_123", "name": "bash", "input": {"command": "ls"}}',
  
  // OpenAI format
  '{"name": "bash", "arguments": {"command": "ls"}}',
  
  // Function call format
  '{"function": {"name": "bash", "arguments": "{\\"command\\": \\"ls\\"}"}}',
  
  // Tool call with ID  
  '{"id": "call_abc123", "type": "function", "function": {"name": "bash"}}',
  
  // Array format
  '[{"index": 0, "type": "function", "function": {"name": "bash"}}]'
];

console.log('🧪 Testing Tool Call Detection Fix for 5509 Port');
console.log('=' .repeat(60));

// Initialize debugger for port 5509
const pipelineDebugger = new PipelineDebugger(5509);

console.log('\n📝 Test 1: Normal text that previously caused false positive');
console.log('Text sample:', problematicText.substring(0, 200) + '...');

// Test the problematic text that caused false positive
const falsePositive = pipelineDebugger.detectToolCallError(
  problematicText,
  'test-request-1', 
  'text-processing',
  'test-provider',
  'test-model'
);

if (falsePositive) {
  console.log('❌ FAILED: Normal text still triggers false positive detection');
  process.exit(1);
} else {
  console.log('✅ PASSED: Normal text with "工具调用" no longer triggers false detection');
}

console.log('\n🔧 Test 2: Actual tool call JSON structures (should be detected)');

let actualToolCallsDetected = 0;
let totalActualToolCalls = actualToolCallTexts.length;

actualToolCallTexts.forEach((toolCallText, index) => {
  console.log(`\nTesting actual tool call ${index + 1}:`);
  console.log('JSON:', toolCallText.substring(0, 80) + '...');
  
  const detected = pipelineDebugger.detectToolCallError(
    toolCallText,
    `test-request-tool-${index}`,
    'json-parsing', 
    'test-provider',
    'test-model'
  );
  
  if (detected) {
    console.log('✅ PASSED: Actual tool call JSON correctly detected');
    actualToolCallsDetected++;
  } else {
    console.log('❌ FAILED: Actual tool call JSON not detected');
  }
});

console.log('\n📊 Test Results Summary');
console.log('=' .repeat(60));
console.log(`✅ False Positive Test: PASSED (normal text not flagged)`);
console.log(`🔧 Actual Tool Call Detection: ${actualToolCallsDetected}/${totalActualToolCalls} detected`);

if (actualToolCallsDetected === totalActualToolCalls) {
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('✅ Tool call detection fix is working correctly');
  console.log('✅ 5509 port should no longer have conversation interruptions from false positives');
  console.log('\n📋 What was fixed:');
  console.log('- Removed overly broad patterns like /tool_call/i');
  console.log('- Added specific JSON structure patterns');
  console.log('- Normal text mentioning "工具调用" no longer triggers errors');
  console.log('- Actual tool call JSON structures are still properly detected');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED');
  console.log('Some actual tool call structures were not detected');
  process.exit(1);
}