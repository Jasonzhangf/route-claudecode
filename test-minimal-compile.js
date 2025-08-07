#!/usr/bin/env node

/**
 * 测试最小化Gemini客户端编译
 */

const { exec } = require('child_process');

console.log('🔧 测试最小化Gemini客户端编译');

const filesToTest = [
  'src/providers/gemini/modules/request-converter.ts',
  'src/providers/gemini/modules/response-converter.ts',
  'src/providers/gemini/client-minimal.ts'
];

exec(`npx tsc --noEmit --skipLibCheck ${filesToTest.join(' ')}`, (error, stdout, stderr) => {
  if (error) {
    console.log('❌ 编译失败:');
    console.log(stderr);
    
    // 尝试更详细的错误诊断
    console.log('\n🔍 详细错误诊断:');
    console.log('错误代码:', error.code);
    console.log('标准输出:', stdout);
    
    process.exit(1);
  } else if (stderr && !stderr.includes('warning')) {
    console.log('⚠️ 编译警告:');
    console.log(stderr);
    console.log('✅ 基本编译通过，但有警告');
    process.exit(0);
  } else {
    console.log('✅ 编译完全成功！');
    console.log('🎉 最小化Gemini Provider可以工作了');
    
    // 如果编译成功，可以替换原文件
    console.log('\n📝 下一步：');
    console.log('1. 替换 client.ts 为 client-minimal.ts');
    console.log('2. 运行基本功能测试');
    console.log('3. 逐步恢复高级功能');
    
    process.exit(0);
  }
});