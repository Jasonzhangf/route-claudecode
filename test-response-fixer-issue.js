#!/usr/bin/env node

/**
 * 直接测试响应修复器处理工具调用文本的问题
 * 模拟Gemini返回包含工具调用文本的响应
 */

const { fixResponse } = require('./dist/utils/response-fixer');

function testResponseFixer() {
  console.log('🔍 直接测试响应修复器');
  console.log('========================');
  
  // 模拟Gemini返回的包含工具调用文本的响应
  const mockResponse = {
    content: [
      {
        type: 'text',
        text: `I'll help you analyze the package.json file and run a status check.

Tool call: Read({"file_path": "package.json"})

The Read tool will help us examine the package.json file to understand the project dependencies and structure.`
      }
    ],
    usage: {
      input_tokens: 1000,
      output_tokens: 50
    }
  };
  
  console.log('📤 原始响应:');
  console.log('   Content blocks:', mockResponse.content.length);
  console.log('   Text content:', JSON.stringify(mockResponse.content[0].text, null, 2));
  
  try {
    // 应用响应修复
    const fixedResponse = fixResponse(mockResponse, 'test-request-123');
    
    console.log('\n✅ 修复完成');
    console.log('📊 修复结果:');
    console.log('   修复后blocks:', fixedResponse.content.length);
    console.log('   应用的修复:', fixedResponse.fixes_applied);
    
    // 分析修复后的每个block
    fixedResponse.content.forEach((block, index) => {
      console.log(`\n📋 修复后Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        console.log('   Text length:', block.text.length);
        console.log('   Text content:', JSON.stringify(block.text));
        
        // 检查是否还包含工具调用文本
        if (block.text.includes('Tool call:')) {
          console.log('   ❌ 仍包含工具调用文本!');
        } else {
          console.log('   ✅ 工具调用文本已清理');
        }
        
      } else if (block.type === 'tool_use') {
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input:', JSON.stringify(block.input));
      }
    });
    
    // 检查问题
    const hasTextBlock = fixedResponse.content.some(block => block.type === 'text' && block.text.trim());
    const hasToolBlock = fixedResponse.content.some(block => block.type === 'tool_use');
    const hasToolCallText = fixedResponse.content.some(block => 
      block.type === 'text' && block.text.includes('Tool call:')
    );
    
    console.log('\n🔍 问题诊断:');
    console.log('   有文本块:', hasTextBlock ? '是' : '否');
    console.log('   有工具块:', hasToolBlock ? '是' : '否');
    console.log('   文本中仍有工具调用:', hasToolCallText ? '❌ 是' : '✅ 否');
    
    if (hasToolCallText) {
      console.log('\n❌ 问题确认: 响应修复器没有完全清理工具调用文本');
      console.log('💡 这就是用户看到"Tool call: ..."的原因');
      
      // 分析具体问题
      const textBlock = fixedResponse.content.find(block => 
        block.type === 'text' && block.text.includes('Tool call:')
      );
      
      if (textBlock) {
        console.log('\n🔧 问题分析:');
        console.log('存在问题的文本块:');
        console.log(JSON.stringify(textBlock.text, null, 2));
        
        // 检查文本是否只包含解释性内容
        const withoutToolCall = textBlock.text.replace(/Tool call:[^}]*}/g, '').trim();
        if (withoutToolCall) {
          console.log('\n📝 解释性文字 (这部分应该保留):');
          console.log(JSON.stringify(withoutToolCall, null, 2));
          console.log('\n💡 修复策略: 应该只保留解释性文字，完全移除"Tool call: ..."部分');
        }
      }
      
    } else {
      console.log('\n✅ 工具调用文本已正确处理');
    }
    
    return !hasToolCallText;
    
  } catch (error) {
    console.error('❌ 响应修复失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试更复杂的场景
function testComplexScenario() {
  console.log('\n🔍 测试复杂工具调用场景');
  console.log('=========================');
  
  const complexResponse = {
    content: [
      {
        type: 'text',
        text: `I'll help you with multiple tasks. Let me start by reading the package.json and then run a status check.

First, I'll read the package.json file:

Tool call: Read({"file_path": "package.json"})

Now let me also run a quick status check:

Tool call: Bash({"command": "npm status", "description": "Check npm status"})

These tools will help us understand the project structure and current status.`
      }
    ]
  };
  
  console.log('📤 复杂场景原始响应:');
  console.log('   包含多个工具调用的文本');
  
  try {
    const fixedResponse = fixResponse(complexResponse, 'test-complex-123');
    
    console.log('📊 修复结果:');
    console.log('   修复后blocks:', fixedResponse.content.length);
    console.log('   应用的修复:', fixedResponse.fixes_applied);
    
    let hasToolCallText = false;
    
    fixedResponse.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}: ${block.type}`);
      
      if (block.type === 'text') {
        if (block.text.includes('Tool call:')) {
          hasToolCallText = true;
          console.log('   ❌ 仍包含工具调用文本');
        }
        console.log('   Text:', JSON.stringify(block.text.slice(0, 100)));
      } else if (block.type === 'tool_use') {
        console.log('   Tool:', block.name);
      }
    });
    
    return !hasToolCallText;
    
  } catch (error) {
    console.error('❌ 复杂场景测试失败:', error.message);
    return false;
  }
}

function main() {
  console.log('🧪 响应修复器测试套件');
  console.log('====================\n');
  
  const test1 = testResponseFixer();
  const test2 = testComplexScenario();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  console.log('基础测试:', test1 ? '✅ 通过' : '❌ 失败');
  console.log('复杂测试:', test2 ? '✅ 通过' : '❌ 失败');
  
  const allPassed = test1 && test2;
  console.log('整体结果:', allPassed ? '✅ 全部通过' : '❌ 存在问题');
  
  if (!allPassed) {
    console.log('\n🔧 修复建议:');
    console.log('响应修复器需要改进工具调用文本的清理逻辑');
    console.log('确保完全移除"Tool call: ..."格式，只保留解释性文字');
  }
  
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main();
}