#!/usr/bin/env node

// 调试工具名称格式问题
console.log('🔍 调试Gemini API工具名称格式问题');

// 从错误日志中提取的问题：Gemini API需要工具名称符合特定规范
const geminiToolNameRequirements = {
  // Must start with a letter or an underscore
  mustStartWith: /^[a-zA-Z_]/,
  // Must be alphanumeric (a-z, A-Z, 0-9), underscores (_), dots (.) or dashes (-), with a maximum length of 64
  allowedCharacters: /^[a-zA-Z0-9_.\\-]+$/,
  maxLength: 64
};

console.log('📋 Gemini API工具名称要求:');
console.log('- 必须以字母或下划线开头');
console.log('- 只能包含字母、数字、下划线、点、短划线');
console.log('- 最大长度64字符');

// 模拟Claude Code常用的工具名称
const commonClaudeCodeTools = [
  'Bash', 'Edit', 'Write', 'Read', 'LS', 'Grep', 'WebFetch', 'Task'
];

console.log('\n🧪 测试常见Claude Code工具名称是否符合Gemini规范:');

commonClaudeCodeTools.forEach(toolName => {
  const startCheck = geminiToolNameRequirements.mustStartWith.test(toolName);
  const charCheck = geminiToolNameRequirements.allowedCharacters.test(toolName);
  const lengthCheck = toolName.length <= geminiToolNameRequirements.maxLength;
  const isValid = startCheck && charCheck && lengthCheck;
  
  console.log(`  ${isValid ? '✅' : '❌'} ${toolName}`);
  if (!isValid) {
    console.log(`    - 开头检查: ${startCheck ? '✅' : '❌'}`);
    console.log(`    - 字符检查: ${charCheck ? '✅' : '❌'}`);
    console.log(`    - 长度检查: ${lengthCheck ? '✅' : '❌'} (${toolName.length}/${geminiToolNameRequirements.maxLength})`);
  }
});

// 测试可能有问题的工具名称
const problematicToolNames = [
  'Claude-Code-Router', // 可能包含连字符
  'Multi-Tool-Example', // 多连字符
  '1st-Tool', // 数字开头
  'Tool@Name', // 特殊字符
  'Very.Long.Tool.Name.That.Might.Exceed.Sixty.Four.Characters.Limit.Test', // 超长
];

console.log('\n⚠️ 测试可能有问题的工具名称:');

problematicToolNames.forEach(toolName => {
  const startCheck = geminiToolNameRequirements.mustStartWith.test(toolName);
  const charCheck = geminiToolNameRequirements.allowedCharacters.test(toolName);
  const lengthCheck = toolName.length <= geminiToolNameRequirements.maxLength;
  const isValid = startCheck && charCheck && lengthCheck;
  
  console.log(`  ${isValid ? '✅' : '❌'} ${toolName}`);
  if (!isValid) {
    console.log(`    - 开头检查: ${startCheck ? '✅' : '❌'}`);
    console.log(`    - 字符检查: ${charCheck ? '✅' : '❌'}`);
    console.log(`    - 长度检查: ${lengthCheck ? '✅' : '❌'} (${toolName.length}/${geminiToolNameRequirements.maxLength})`);
  }
});

// 工具名称修复函数
function fixToolNameForGemini(toolName) {
  let fixed = toolName;
  
  // 如果不以字母或下划线开头，添加前缀
  if (!geminiToolNameRequirements.mustStartWith.test(fixed)) {
    fixed = 'tool_' + fixed;
  }
  
  // 替换不允许的字符为下划线
  fixed = fixed.replace(/[^a-zA-Z0-9_.\\-]/g, '_');
  
  // 限制长度
  if (fixed.length > geminiToolNameRequirements.maxLength) {
    fixed = fixed.substring(0, geminiToolNameRequirements.maxLength);
  }
  
  return fixed;
}

console.log('\n🔧 工具名称修复示例:');

problematicToolNames.forEach(toolName => {
  const fixed = fixToolNameForGemini(toolName);
  const isValid = geminiToolNameRequirements.mustStartWith.test(fixed) && 
                  geminiToolNameRequirements.allowedCharacters.test(fixed) && 
                  fixed.length <= geminiToolNameRequirements.maxLength;
  
  console.log(`  ${toolName} → ${fixed} ${isValid ? '✅' : '❌'}`);
});

console.log('\n📝 需要在预处理器中添加Gemini工具名称格式修复逻辑');
console.log('📝 修复位置: src/preprocessing/unified-compatibility-preprocessor.ts');
console.log('📝 供应商: shuaihong-openai (使用Gemini模型时)');