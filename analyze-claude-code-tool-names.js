#!/usr/bin/env node

console.log('🔍 分析Claude Code工具名称是否符合Gemini API规范');
console.log('=' .repeat(70));

// Claude Code的完整工具集
const claudeCodeTools = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'Read', 'Edit', 'MultiEdit', 'Write',
  'NotebookRead', 'NotebookEdit', 'WebFetch', 'TodoWrite', 'WebSearch', 'ExitPlanMode'
];

// Gemini API工具名称规范
const geminiNameRegex = /^[a-zA-Z_][a-zA-Z0-9_.\\-]*$/;
const maxLength = 64;

console.log('📋 Claude Code工具名称 (15个):');
claudeCodeTools.forEach((name, index) => {
  console.log(`  [${index}] ${name}`);
});

console.log('\n🔍 Gemini API规范验证:');
console.log('- 必须以字母或下划线开头');
console.log('- 只能包含：a-z, A-Z, 0-9, _, ., -');
console.log('- 最大长度64字符');

console.log('\n✅ 逐个验证:');
let invalidCount = 0;
let validCount = 0;

claudeCodeTools.forEach((name, index) => {
  const startsCorrect = /^[a-zA-Z_]/.test(name);
  const charsValid = geminiNameRegex.test(name);
  const lengthOk = name.length <= maxLength;
  const isValid = startsCorrect && charsValid && lengthOk;
  
  const status = isValid ? '✅' : '❌';
  console.log(`  [${String(index).padStart(2, '0')}] ${status} ${name.padEnd(15)} - ${isValid ? '符合规范' : '不符合'}`);
  
  if (!isValid) {
    invalidCount++;
    if (!startsCorrect) console.log(`      ❌ 开头问题: 必须以字母或下划线开头`);
    if (!charsValid) console.log(`      ❌ 字符问题: 包含非法字符`);  
    if (!lengthOk) console.log(`      ❌ 长度问题: 超过64字符 (${name.length})`);
  } else {
    validCount++;
  }
});

console.log(`\n📊 验证结果统计:`);
console.log(`  ✅ 符合规范: ${validCount} 个`);
console.log(`  ❌ 不符合规范: ${invalidCount} 个`);
console.log(`  📈 总计: ${claudeCodeTools.length} 个`);

if (invalidCount === 0) {
  console.log('\n🎉 结论: 所有Claude Code工具名称都符合Gemini API规范!');
  console.log('💡 问题可能在工具名称转换或格式化过程中');
} else {
  console.log('\n⚠️ 结论: 发现工具名称格式问题');
  console.log('💡 需要修复这些工具名称以符合Gemini规范');
}

// 额外测试：检查可能的转换问题
console.log('\n🔧 检查可能的转换问题:');
console.log('1. 工具名称在转换时被添加了前缀/后缀?');
console.log('2. 工具名称被转换为其他格式?');
console.log('3. 字符编码问题导致非法字符?');
console.log('4. 重复工具导致索引问题?');