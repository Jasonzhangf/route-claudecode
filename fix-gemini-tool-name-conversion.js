#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 修复Gemini工具名称转换问题');
console.log('=' .repeat(60));

// 问题分析
console.log('📋 问题分析:');
console.log('1. Claude Code用户使用Anthropic工具格式');
console.log('2. shuaihong-openai provider提供gemini-2.5-flash-lite模型');
console.log('3. 工具转换链: Anthropic → OpenAI → Gemini');
console.log('4. 在某个转换环节，15个工具名称格式出错');

console.log('\n🔍 可能的问题源头:');
console.log('1. OpenAI转换器处理Anthropic工具时格式错误');
console.log('2. Gemini transformer接收到错误格式的工具');
console.log('3. 预处理器修改了工具名称');
console.log('4. JSON序列化/反序列化过程中的编码问题');

// 检查是否存在工具名称处理的特殊逻辑
const filesToCheck = [
  '/Users/fanzhang/Documents/github/claude-code-router/src/transformers/openai.ts',
  '/Users/fanzhang/Documents/github/claude-code-router/src/transformers/gemini.ts',
  '/Users/fanzhang/Documents/github/claude-code-router/src/preprocessing/unified-compatibility-preprocessor.ts'
];

console.log('\n🔍 检查关键文件中的工具转换逻辑:');

filesToCheck.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`✅ 找到: ${path.basename(filePath)}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查工具名称相关的处理
    const nameRelatedLines = content.split('\n').filter((line, index) => {
      const lowerLine = line.toLowerCase();
      return lowerLine.includes('tool') && (
        lowerLine.includes('name') || 
        lowerLine.includes('function') ||
        lowerLine.includes('declaration')
      );
    }).slice(0, 5); // 只显示前5行相关内容
    
    if (nameRelatedLines.length > 0) {
      console.log(`  📝 相关工具名称处理:`);
      nameRelatedLines.forEach((line, i) => {
        console.log(`    ${i + 1}. ${line.trim()}`);
      });
    }
  } else {
    console.log(`❌ 未找到: ${filePath}`);
  }
});

console.log('\n💡 建议的修复方案:');
console.log('1. 在Gemini transformer中添加工具名称验证');
console.log('2. 确保工具名称在转换过程中不被修改');
console.log('3. 添加工具名称格式检查和自动修复');
console.log('4. 在预处理阶段验证工具名称符合Gemini规范');

console.log('\n🚨 具体修复步骤:');
console.log('步骤1: 在buildToolsAndConfig方法中添加名称验证');
console.log('步骤2: 检查所有工具转换点，确保名称不被意外修改');
console.log('步骤3: 添加调试日志输出实际发送给Gemini API的工具名称');
console.log('步骤4: 测试修复效果');