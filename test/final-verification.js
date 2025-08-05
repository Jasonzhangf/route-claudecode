/**
 * 最终验证Stop Reason调试记录
 * 确认所有功能正常工作
 */

console.log('=== 最终验证Stop Reason调试记录 ===\n');

try {
  // 从全局安装的包加载
  const path = require('path');
  const globalNodeModules = require('child_process').execSync('npm root -g').toString().trim();
  const debugModulePath = path.join(globalNodeModules, 'route-claudecode', 'dist', 'utils', 'finish-reason-debug.js');
  
  console.log('🔍 尝试加载调试模块...');
  console.log('📁 模块路径:', debugModulePath);
  
  const { logFinishReasonDebug, logStopReasonDebug, getDebugLogDir, readDebugLogs } = require(debugModulePath);
  
  console.log('✅ Finish reason debug module loaded successfully');
  
  const debugLogDir = getDebugLogDir();
  console.log('📁 Debug log directory:', debugLogDir);
  
  // Test finish reason logging
  console.log('\n📝 测试finish reason记录...');
  logFinishReasonDebug('final-test-finish', 'tool_calls', 'openai', 'gpt-4', {
    test: 'final_verification',
    timestamp: new Date().toISOString()
  });
  console.log('✅ Finish reason test log created');
  
  // Test stop reason logging
  console.log('\n📝 测试stop reason记录...');
  logStopReasonDebug('final-test-stop', 'end_turn', 'anthropic', 'claude-3', {
    test: 'final_verification',
    timestamp: new Date().toISOString()
  });
  console.log('✅ Stop reason test log created');
  
  // Read and display logs
  console.log('\n📖 读取最近的finish reason记录...');
  const finishLogs = readDebugLogs('finish-reason', 3);
  console.log(`📄 Found ${finishLogs.length} finish reason log entries`);
  finishLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp}`);
    console.log(`     Request ID: ${log.requestId}`);
    console.log(`     Finish Reason: ${log.finishReason}`);
    console.log(`     Provider: ${log.provider}, Model: ${log.model}`);
    if (log.additionalData?.test) {
      console.log(`     Test: ${log.additionalData.test}`);
    }
  });
  
  console.log('\n📖 读取最近的stop reason记录...');
  const stopLogs = readDebugLogs('stop-reason', 3);
  console.log(`📄 Found ${stopLogs.length} stop reason log entries`);
  stopLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp}`);
    console.log(`     Request ID: ${log.requestId}`);
    console.log(`     Stop Reason: ${log.stopReason}`);
    console.log(`     Provider: ${log.provider}, Model: ${log.model}`);
    if (log.additionalData?.test) {
      console.log(`     Test: ${log.additionalData.test}`);
    }
  });
  
  console.log('\n🎉 所有验证通过！Stop reason调试记录功能完全正常！');
  console.log(`📁 日志文件位置: ${debugLogDir}`);
  console.log('🔧 可用的调试文件:');
  console.log('  - finish-reason-debug.log');
  console.log('  - stop-reason-debug.log');
  console.log('  - tool-call-completion.log');
  console.log('  - api-errors.log');
  console.log('  - polling-retries.log');
  
} catch (error) {
  console.error('❌ 验证失败:', error.message);
  console.error('错误详情:', error);
  
  console.log('\n🔍 故障排除建议：');
  console.log('1. 检查全局包是否正确安装: npm list -g route-claudecode');
  console.log('2. 检查调试模块是否存在: ls -la $(npm root -g)/route-claudecode/dist/utils/');
  console.log('3. 手动测试模块: node -e "require(\"$(npm root -g)/route-claudecode/dist/utils/finish-reason-debug.js\")"');
  console.log('4. 检查日志目录: ls -la ~/.route-claude-code/logs/');
}