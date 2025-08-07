#!/usr/bin/env node

/**
 * 快速编译测试 - 只检查Gemini相关文件
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🔧 快速编译测试 - Gemini Provider');

// 只编译Gemini相关的核心文件
const filesToTest = [
  'src/providers/gemini/modules/request-converter.ts',
  'src/providers/gemini/modules/response-converter.ts',
  'src/providers/gemini/modules/api-client.ts',
  'src/providers/gemini/modules/streaming-simulator.ts',
  'src/providers/gemini/client.ts'
];

exec(`npx tsc --noEmit --skipLibCheck --strict false ${filesToTest.join(' ')}`, (error, stdout, stderr) => {
  if (error) {
    console.log('❌ 编译失败:');
    console.log(stderr);
    console.log('错误代码:', error.code);
    process.exit(1);
  } else if (stderr && !stderr.includes('warning')) {
    console.log('⚠️ 编译警告:');
    console.log(stderr);
    console.log('✅ 基本编译通过，但有警告');
    process.exit(0);
  } else {
    console.log('✅ 编译完全成功！');
    console.log('🎉 Gemini Provider基本修复完成');
    process.exit(0);
  }
});