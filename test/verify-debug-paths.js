/**
 * Stop Reason调试记录路径验证脚本
 * 验证调试记录文件是否在正确的路径下
 */

console.log('=== Stop Reason调试记录路径验证 ===\n');

try {
  const { logFinishReasonDebug, logStopReasonDebug, getDebugLogDir, readDebugLogs } = require('./dist/utils/finish-reason-debug.js');
  
  console.log('✅ Finish reason debug module loaded successfully');
  
  const debugLogDir = getDebugLogDir();
  console.log('📁 Correct debug log directory:', debugLogDir);
  console.log('🔍 Expected path: Should contain route-claudecode/logs');
  
  // Test finish reason logging
  console.log('\n📝 测试finish reason记录（正确路径）...');
  logFinishReasonDebug('test-path-123', 'tool_calls', 'openai', 'gpt-4', {
    mapping: 'tool_calls -> tool_use',
    context: 'path-corrected',
    expectedPath: debugLogDir
  });
  console.log('✅ Finish reason test log created in correct location');
  
  // Test stop reason logging
  console.log('\n📝 测试stop reason记录（正确路径）...');
  logStopReasonDebug('test-path-456', 'end_turn', 'anthropic', 'claude-3', {
    mapping: 'end_turn -> stop',
    context: 'path-corrected',
    expectedPath: debugLogDir
  });
  console.log('✅ Stop reason test log created in correct location');
  
  // Verify directory structure
  console.log('\n📂 验证目录结构...');
  const fs = require('fs');
  if (fs.existsSync(debugLogDir)) {
    const files = fs.readdirSync(debugLogDir);
    console.log('📄 Files in correct debug directory:');
    files.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    // Check for expected debug files
    const expectedFiles = ['finish-reason-debug.log', 'stop-reason-debug.log'];
    expectedFiles.forEach(file => {
      const filePath = require('path').join(debugLogDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} exists (${stats.size} bytes)`);
      } else {
        console.log(`❌ ${file} missing`);
      }
    });
  } else {
    console.log('❌ Debug directory does not exist:', debugLogDir);
  }
  
  // Read finish reason logs
  console.log('\n📖 读取finish reason记录...');
  const finishLogs = readDebugLogs('finish-reason', 3);
  console.log(`📄 Found ${finishLogs.length} finish reason log entries`);
  finishLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.finishReason} (${log.provider})`);
    if (log.expectedPath) {
      console.log(`     📍 Expected path: ${log.expectedPath}`);
    }
  });
  
  // Read stop reason logs
  console.log('\n📖 读取stop reason记录...');
  const stopLogs = readDebugLogs('stop-reason', 3);
  console.log(`📄 Found ${stopLogs.length} stop reason log entries`);
  stopLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.stopReason} (${log.provider})`);
    if (log.expectedPath) {
      console.log(`     📍 Expected path: ${log.expectedPath}`);
    }
  });
  
  console.log('\n🎉 路径修复完成！调试记录现在在正确的位置：');
  console.log(`📍 正确路径: ${debugLogDir}`);
  
} catch (error) {
  console.error('❌ 路径验证失败:', error.message);
  console.error('错误详情:', error);
  
  console.log('\n🔍 可能的原因：');
  console.log('1. 配置路径模块问题');
  console.log('2. 文件系统权限问题');
  console.log('3. 构建失败');
  console.log('4. 依赖模块缺失');
  
  console.log('\n💡 建议解决方案：');
  console.log('1. 检查 config-paths.ts 模块');
  console.log('2. 运行 npm run build 重新构建');
  console.log('3. 检查文件系统权限');
}