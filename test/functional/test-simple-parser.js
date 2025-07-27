#!/usr/bin/env node

/**
 * 测试我们修复后的解析器
 */

const fs = require('fs');

// 使用之前保存的原始响应数据
const rawResponseFile = 'debug-codewhisperer-raw-2025-07-26T14-38-26-427Z.bin';

if (!fs.existsSync(rawResponseFile)) {
  console.error('❌ 原始响应文件不存在:', rawResponseFile);
  console.log('请先运行: node debug-codewhisperer-raw-response.js');
  process.exit(1);
}

console.log('🔍 测试修复后的解析器...\n');

try {
  // 动态导入我们的解析器（绕过TypeScript问题）
  const { execSync } = require('child_process');
  
  // 编译TypeScript文件
  console.log('📦 编译TypeScript解析器...');
  execSync('npx tsc src/providers/codewhisperer/parser.ts --outDir temp --target es2020 --module commonjs --esModuleInterop --skipLibCheck', { stdio: 'inherit' });
  
  // 导入编译后的解析器
  const parser = require('./temp/providers/codewhisperer/parser.js');
  
  // 读取原始响应
  const rawResponse = fs.readFileSync(rawResponseFile);
  console.log(`📄 读取原始响应: ${rawResponse.length} bytes`);
  
  // 测试事件解析
  console.log('\n🔍 解析事件...');
  const events = parser.parseEvents(rawResponse);
  console.log(`解析到 ${events.length} 个事件:`);
  
  events.forEach((event, i) => {
    console.log(`  [${i}] ${event.Event}:`);
    console.log(`      Data:`, JSON.stringify(event.Data, null, 6));
  });
  
  // 测试非流式响应解析
  console.log('\n🔍 解析非流式响应...');
  const contexts = parser.parseNonStreamingResponse(rawResponse, 'test');
  console.log(`解析到 ${contexts.length} 个context:`);
  
  contexts.forEach((context, i) => {
    console.log(`  [${i}]`, JSON.stringify(context, null, 2));
  });
  
  // 分析结果
  console.log('\n📊 解析结果分析:');
  const hasTextContent = contexts.some(c => c.type === 'text' && c.text && c.text.trim());
  const hasToolContent = contexts.some(c => c.type === 'tool_use');
  
  console.log(`有文本内容: ${hasTextContent ? '✅' : '❌'}`);
  console.log(`有工具内容: ${hasToolContent ? '✅' : '❌'}`);
  
  if (hasTextContent) {
    const textContent = contexts.find(c => c.type === 'text');
    console.log(`文本内容长度: ${textContent.text.length} 字符`);
    console.log(`文本预览: "${textContent.text.substring(0, 100)}..."`);
  }
  
  // 清理临时文件
  execSync('rm -rf temp');
  
  console.log('\n✨ 解析器测试完成!');
  
  if (hasTextContent || hasToolContent) {
    console.log('🎉 解析器修复成功！');
  } else {
    console.log('❌ 解析器仍有问题');
  }
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  
  // 清理临时文件
  try {
    require('child_process').execSync('rm -rf temp');
  } catch {}
}