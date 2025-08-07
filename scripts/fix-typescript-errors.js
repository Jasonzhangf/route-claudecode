#!/usr/bin/env node
/**
 * 🔧 修复TypeScript编译错误
 * 
 * 修复finishReason变量未定义的问题
 */

const fs = require('fs').promises;

console.log('🔧 [TYPESCRIPT-FIX] 开始修复TypeScript错误...');

async function fixEnhancedClientErrors() {
  console.log('📝 修复 enhanced-client.ts 中的错误...');
  
  const filePath = 'src/providers/openai/enhanced-client.ts';
  
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 检查第二个错误的上下文 - 这里finishReason应该是已定义的
    // 但是缩进可能有问题，让我修复缩进
    const badIndentPattern = /        \/\/ 🔧 修复：工具调用场景下不发送message_stop\s*if \(finishReason !== 'tool_use'\) \{/g;
    const fixedIndent = `        // 🔧 修复：工具调用场景下不发送message_stop
        if (finishReason !== 'tool_use') {`;
    
    content = content.replace(badIndentPattern, fixedIndent);
    
    // 修复第三个错误的缩进
    const badIndentPattern2 = /    \/\/ 🔧 修复：工具调用场景下不发送message_stop\s*if \(finishReason !== 'tool_use'\) \{/g;
    const fixedIndent2 = `    // 🔧 修复：工具调用场景下不发送message_stop
    if (finishReason !== 'tool_use') {`;
    
    content = content.replace(badIndentPattern2, fixedIndent2);
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`   ✅ ${filePath} 修复完成`);
    
  } catch (error) {
    console.error(`   ❌ 修复失败:`, error.message);
  }
}

async function validateTypescriptCompilation() {
  console.log('📝 验证TypeScript编译...');
  
  const { execSync } = require('child_process');
  
  try {
    console.log('   🔨 运行TypeScript编译检查...');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log('   ✅ TypeScript编译检查通过');
    return true;
  } catch (error) {
    console.log('   ❌ TypeScript编译仍有错误:');
    console.log(error.stdout?.toString() || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 开始修复TypeScript错误...');
  
  await fixEnhancedClientErrors();
  
  console.log('\\n📊 验证修复效果...');
  const success = await validateTypescriptCompilation();
  
  if (success) {
    console.log('\\n✅ 所有TypeScript错误已修复！');
    console.log('\\n🔧 现在可以运行构建:');
    console.log('   ./install-local.sh');
  } else {
    console.log('\\n⚠️ 仍有TypeScript错误需要手动修复');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 修复失败:', error);
    process.exit(1);
  });
}