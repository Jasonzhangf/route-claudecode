#!/usr/bin/env node

/**
 * Debug系统测试脚本
 * 
 * 用于快速测试和验证Debug系统的功能
 * 
 * 使用方法:
 * node test-debug-system.js
 */

const path = require('path');
const fs = require('fs');

// 检查是否已编译TypeScript
const debugModulePath = path.join(__dirname, 'dist', 'debug', 'index.js');
const testFilePath = path.join(__dirname, 'dist', 'debug', 'debug-test.js');

if (!fs.existsSync(debugModulePath) || !fs.existsSync(testFilePath)) {
  console.log('📦 正在编译TypeScript...');
  
  const { spawn } = require('child_process');
  
  const compile = spawn('npx', ['tsc'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });
  
  compile.on('close', (code) => {
    if (code === 0) {
      console.log('✅ 编译完成，开始测试...\n');
      runTest();
    } else {
      console.error('❌ TypeScript编译失败');
      process.exit(1);
    }
  });
  
  compile.on('error', (error) => {
    console.error('❌ 编译过程出错:', error.message);
    
    // 如果npx不可用，尝试直接运行测试
    console.log('⚠️ 跳过编译，尝试直接运行测试...');
    runTest();
  });
} else {
  console.log('📁 发现已编译文件，直接运行测试...\n');
  runTest();
}

function runTest() {
  try {
    // 尝试加载并运行测试
    const { runDebugSystemTest } = require(testFilePath);
    
    console.log('🧪 RCC v4.0 Debug系统测试');
    console.log('=' .repeat(50));
    
    runDebugSystemTest()
      .then(() => {
        console.log('\n🎉 Debug系统测试成功完成！');
        console.log('💡 查看生成的报告文件:');
        console.log('   - performance-report-*.html (性能分析报告)');
        console.log('   - replay-report-*.html (回放测试报告)');
        console.log('   - session-export-*.json (会话数据导出)');
        console.log('\n📁 调试数据存储在: ./test-debug-data/');
      })
      .catch(error => {
        console.error('❌ Debug系统测试失败:', error.message);
        if (error.stack) {
          console.error('🔍 错误详情:', error.stack);
        }
        process.exit(1);
      });
      
  } catch (error) {
    console.error('❌ 无法加载测试模块:', error.message);
    console.log('\n📝 请确保已正确编译TypeScript代码:');
    console.log('   npm run build');
    console.log('   或');
    console.log('   npx tsc');
    process.exit(1);
  }
}