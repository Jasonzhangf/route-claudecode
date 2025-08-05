/**
 * Stop Reason调试记录验证脚本（修正路径版）
 * 验证stop reason记录文件是否在正确路径工作
 */

console.log('=== Stop Reason调试记录检查（修正路径版）===\n');

try {
  const { logFinishReasonDebug, logStopReasonDebug, getDebugLogDir, readDebugLogs } = require('./dist/utils/finish-reason-debug.js');
  
  console.log('✅ Finish reason debug module loaded successfully');
  
  const debugLogDir = getDebugLogDir();
  console.log('📁 Debug log directory:', debugLogDir);
  
  // Test finish reason logging
  console.log('\n📝 测试finish reason记录...');
  logFinishReasonDebug('test-finish-correct-path', 'tool_calls', 'openai', 'gpt-4', {
    mapping: 'tool_calls -> tool_use',
    context: 'enhanced-client',
    path: 'corrected'
  });
  console.log('✅ Finish reason test log created');
  
  // Test stop reason logging
  console.log('\n📝 测试stop reason记录...');
  logStopReasonDebug('test-stop-correct-path', 'end_turn', 'anthropic', 'claude-3', {
    mapping: 'end_turn -> stop',
    context: 'anthropic-client',
    path: 'corrected'
  });
  console.log('✅ Stop reason test log created');
  
  // Read finish reason logs
  console.log('\n📖 读取finish reason记录...');
  const finishLogs = readDebugLogs('finish-reason', 3);
  console.log(`📄 Found ${finishLogs.length} finish reason log entries`);
  finishLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.finishReason} (${log.provider})`);
    if (log.additionalData?.path) {
      console.log(`     Path: ${log.additionalData.path}`);
    }
  });
  
  // Read stop reason logs
  console.log('\n📖 读取stop reason记录...');
  const stopLogs = readDebugLogs('stop-reason', 3);
  console.log(`📄 Found ${stopLogs.length} stop reason log entries`);
  stopLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.stopReason} (${log.provider})`);
    if (log.additionalData?.path) {
      console.log(`     Path: ${log.additionalData.path}`);
    }
  });
  
  console.log('\n🎉 所有调试记录功能正常工作！');
  console.log(`📁 日志文件位置: ${debugLogDir}`);
  
} catch (error) {
  console.error('❌ 检查失败:', error.message);
  console.error('错误详情:', error);
  
  console.log('\n🔍 可能的原因：');
  console.log('1. 调试模块未正确构建');
  console.log('2. 配置路径模块问题');
  console.log('3. 文件系统权限问题');
  
  console.log('\n💡 建议解决方案：');
  console.log('1. 运行 npm run build 重新构建');
  console.log('2. 检查 config-paths.ts 模块');
  console.log('3. 检查文件系统权限');
}