/**
 * Stop Reason调试记录检查脚本
 * 检查stop reason记录文件是否正常工作
 */

console.log('=== Stop Reason调试记录检查 ===\n');

try {
  const { logFinishReasonDebug, logStopReasonDebug, getDebugLogDir, readDebugLogs } = require('./dist/utils/finish-reason-debug.js');
  
  console.log('✅ Finish reason debug module loaded successfully');
  
  const debugLogDir = getDebugLogDir();
  console.log('📁 Debug log directory:', debugLogDir);
  
  // Test finish reason logging
  console.log('\n📝 测试finish reason记录...');
  logFinishReasonDebug('test-finish-123', 'tool_calls', 'openai', 'gpt-4', {
    mapping: 'tool_calls -> tool_use',
    context: 'enhanced-client'
  });
  console.log('✅ Finish reason test log created');
  
  // Test stop reason logging
  console.log('\n📝 测试stop reason记录...');
  logStopReasonDebug('test-stop-456', 'end_turn', 'anthropic', 'claude-3', {
    mapping: 'end_turn -> stop',
    context: 'anthropic-client'
  });
  console.log('✅ Stop reason test log created');
  
  // Read finish reason logs
  console.log('\n📖 读取finish reason记录...');
  const finishLogs = readDebugLogs('finish-reason', 5);
  console.log(`📄 Found ${finishLogs.length} finish reason log entries`);
  finishLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.finishReason} (${log.provider})`);
  });
  
  // Read stop reason logs
  console.log('\n📖 读取stop reason记录...');
  const stopLogs = readDebugLogs('stop-reason', 5);
  console.log(`📄 Found ${stopLogs.length} stop reason log entries`);
  stopLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} - ${log.stopReason} (${log.provider})`);
  });
  
  console.log('\n🎉 所有调试记录功能正常工作！');
  
} catch (error) {
  console.error('❌ 检查失败:', error.message);
  console.error('错误详情:', error);
  
  console.log('\n🔍 可能的原因：');
  console.log('1. 调试模块未正确构建');
  console.log('2. 文件系统权限问题');
  console.log('3. 调试目录创建失败');
  console.log('4. 依赖模块缺失');
  
  console.log('\n💡 建议解决方案：');
  console.log('1. 运行 npm run build 重新构建');
  console.log('2. 检查文件系统权限');
  console.log('3. 手动创建调试目录');
}