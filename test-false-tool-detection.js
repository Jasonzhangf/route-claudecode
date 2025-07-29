#!/usr/bin/env node

/**
 * 测试响应修复器是否会错误识别正常文本中的工具调用引用
 */

const { fixResponse } = require('./dist/utils/response-fixer');

function testFalsePositiveDetection() {
  console.log('🔍 测试误识别工具调用的问题');
  console.log('============================');
  
  // 模拟包含工具调用教学内容的响应
  const mockResponse = {
    content: [
      {
        type: 'text',
        text: `我来解释一下如何使用工具调用。

在Claude Code中，你可以使用以下格式来调用工具：

1. 读取文件：Tool call: Read({"file_path": "example.txt"})
2. 执行命令：Tool call: Bash({"command": "npm start"})
3. 搜索代码：Tool call: Grep({"pattern": "function"})

这些只是格式示例，实际使用时系统会自动处理工具调用。

现在让我实际读取一个文件来演示：

Tool call: Read({"file_path": "package.json"})

这个工具调用将会被系统处理。`
      }
    ]
  };
  
  console.log('📤 原始响应包含:');
  console.log('   - 教学内容中的工具调用示例 (应该保留)');
  console.log('   - 真实的工具调用 (应该提取)');
  console.log('   - 文本长度:', mockResponse.content[0].text.length);
  
  try {
    const fixedResponse = fixResponse(mockResponse, 'test-false-positive');
    
    console.log('\n📊 修复结果:');
    console.log('   修复后blocks:', fixedResponse.content.length);
    console.log('   应用的修复:', fixedResponse.fixes_applied);
    
    let textBlocks = 0;
    let toolBlocks = 0;
    let textContainsExamples = false;
    let textContainsRealCall = false;
    
    fixedResponse.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}: ${block.type}`);
      
      if (block.type === 'text') {
        textBlocks++;
        
        // 检查是否包含教学示例
        if (block.text.includes('读取文件：Tool call:') || 
            block.text.includes('执行命令：Tool call:') ||
            block.text.includes('搜索代码：Tool call:')) {
          textContainsExamples = true;
          console.log('   ✅ 包含教学示例 (应该保留)');
        }
        
        // 检查是否错误保留了真实工具调用
        if (block.text.includes('现在让我实际读取') && 
            block.text.includes('Tool call: Read')) {
          textContainsRealCall = true;
          console.log('   ❌ 仍包含真实工具调用 (应该被提取)');
        }
        
        console.log('   Text length:', block.text.length);
        console.log('   Text preview:', JSON.stringify(block.text.slice(0, 100)));
        
      } else if (block.type === 'tool_use') {
        toolBlocks++;
        console.log('   Tool name:', block.name);
        console.log('   Tool input:', JSON.stringify(block.input));
      }
    });
    
    console.log('\n🔍 检测结果分析:');
    console.log('   文本块数量:', textBlocks);
    console.log('   工具块数量:', toolBlocks);
    console.log('   保留了教学示例:', textContainsExamples ? '✅ YES' : '❌ NO');
    console.log('   错误保留真实调用:', textContainsRealCall ? '❌ YES' : '✅ NO');
    
    // 理想结果：应该提取1个真实工具调用，保留教学示例
    const isCorrect = toolBlocks === 1 && textContainsExamples && !textContainsRealCall;
    
    if (!isCorrect) {
      console.log('\n❌ 问题发现:');
      if (toolBlocks !== 1) {
        console.log(`   - 工具块数量异常: 期望1个，实际${toolBlocks}个`);
      }
      if (!textContainsExamples) {
        console.log('   - 教学示例被错误移除');
      }
      if (textContainsRealCall) {
        console.log('   - 真实工具调用未被提取');
      }
      
      console.log('\n💡 当前检测逻辑过于简单，需要改进上下文识别');
    } else {
      console.log('\n✅ 检测逻辑正确，能区分教学内容和真实调用');
    }
    
    return isCorrect;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

function testExtremeCase() {
  console.log('\n🔍 测试极端情况：纯教学内容');
  console.log('===============================');
  
  const pureEducationalContent = {
    content: [
      {
        type: 'text',
        text: `关于Claude工具调用的使用指南：

工具调用的基本格式是这样的：
- Tool call: Read({"file_path": "文件路径"})
- Tool call: Bash({"command": "命令", "description": "描述"})
- Tool call: Grep({"pattern": "搜索模式"})

这些都是格式示例，帮助你理解如何与工具交互。记住，Tool call: 后面跟着工具名称和JSON参数。

工具调用在实际使用中会被Claude自动处理，你不需要手动输入Tool call:格式。`
      }
    ]
  };
  
  try {
    const fixedResponse = fixResponse(pureEducationalContent, 'test-educational');
    
    console.log('📊 纯教学内容处理结果:');
    console.log('   修复后blocks:', fixedResponse.content.length);
    console.log('   应用的修复:', fixedResponse.fixes_applied);
    
    const hasTextBlock = fixedResponse.content.some(block => block.type === 'text');
    const hasToolBlock = fixedResponse.content.some(block => block.type === 'tool_use');
    const textPreserved = fixedResponse.content.some(block => 
      block.type === 'text' && block.text.includes('工具调用的基本格式')
    );
    
    console.log('   保留了文本块:', hasTextBlock ? '✅' : '❌');
    console.log('   错误创建工具块:', hasToolBlock ? '❌' : '✅');
    console.log('   教学内容完整:', textPreserved ? '✅' : '❌');
    
    const isCorrect = hasTextBlock && !hasToolBlock && textPreserved;
    
    if (isCorrect) {
      console.log('\n✅ 纯教学内容处理正确');
    } else {
      console.log('\n❌ 纯教学内容被错误处理');
      console.log('💡 系统错误地将教学示例识别为真实工具调用');
    }
    
    return isCorrect;
    
  } catch (error) {
    console.error('❌ 极端情况测试失败:', error.message);
    return false;
  }
}

function main() {
  console.log('🧪 工具调用误识别测试套件');
  console.log('===========================\n');
  
  const test1 = testFalsePositiveDetection();
  const test2 = testExtremeCase();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  console.log('混合内容测试:', test1 ? '✅ 通过' : '❌ 失败');
  console.log('纯教学内容测试:', test2 ? '✅ 通过' : '❌ 失败');
  
  const overallResult = test1 && test2;
  console.log('整体结果:', overallResult ? '✅ 无误识别' : '❌ 存在误识别');
  
  if (!overallResult) {
    console.log('\n🔧 修复建议:');
    console.log('1. 改进工具调用检测的上下文分析');
    console.log('2. 区分教学示例和真实工具调用');
    console.log('3. 考虑位置和语言模式来判断意图');
    console.log('4. 添加白名单机制保护教学内容');
  }
  
  process.exit(overallResult ? 0 : 1);
}

if (require.main === module) {
  main();
}