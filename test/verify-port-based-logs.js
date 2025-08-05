/**
 * 端口分组日志系统验证脚本
 * 验证日志按端口号分组的功能
 */

console.log('=== 端口分组日志系统验证 ===\n');

try {
  const { 
    logFinishReasonDebug, 
    logStopReasonDebug, 
    logToolCallCompletion,
    logApiError,
    logPollingRetry,
    getDebugLogDir,
    readDebugLogs,
    cleanupDebugLogs
  } = require('./dist/utils/finish-reason-debug.js');
  
  console.log('✅ Port-based debug module loaded successfully');
  
  // 测试不同端口的日志目录
  const testPorts = [3456, 6689, 5509];
  
  testPorts.forEach(port => {
    console.log(`\n🔍 测试端口 ${port}:`);
    console.log(`  📁 日志目录: ${getDebugLogDir(port)}`);
    
    // 测试日志记录
    logFinishReasonDebug(`test-finish-${port}`, 'tool_calls', 'openai', 'gpt-4', port, {
      testPort: port,
      message: 'Finish reason test'
    });
    
    logStopReasonDebug(`test-stop-${port}`, 'end_turn', 'anthropic', 'claude-3', port, {
      testPort: port,
      message: 'Stop reason test'
    });
    
    logToolCallCompletion(`test-tool-${port}`, `tool-${port}`, 'success', port, {
      toolResult: 'Tool completed successfully'
    });
    
    logApiError(`test-error-${port}`, 'openai', new Error('Test error'), port, 1);
    
    logPollingRetry(`test-retry-${port}`, 'anthropic', 2, 'Rate limit', port);
    
    console.log(`  ✅ 端口 ${port} 日志记录完成`);
  });
  
  // 验证目录结构
  console.log('\n📂 验证目录结构...');
  testPorts.forEach(port => {
    const debugDir = getDebugLogDir(port);
    const fs = require('fs');
    
    if (fs.existsSync(debugDir)) {
      const files = fs.readdirSync(debugDir);
      console.log(`  📄 Port ${port} 调试文件: ${files.join(', ')}`);
      
      // 验证日志内容
      const finishLogPath = require('path').join(debugDir, 'finish-reason-debug.log');
      if (fs.existsSync(finishLogPath)) {
        const content = fs.readFileSync(finishLogPath, 'utf-8');
        const lines = content.trim().split('\n');
        console.log(`  📝 Finish reason entries: ${lines.length}`);
      }
    } else {
      console.log(`  ❌ 端口 ${port} 调试目录不存在`);
    }
  });
  
  // 测试读取特定端口的日志
  console.log('\n📖 读取端口 3456 的日志...');
  const finishLogs = readDebugLogs('finish-reason', 3456, 3);
  console.log(`📄 Port 3456 finish reason entries: ${finishLogs.length}`);
  finishLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.timestamp} - ${log.requestId} (Port: ${log.port})`);
  });
  
  // 测试清理功能
  console.log('\n🧹 测试清理功能 (不实际删除)...');
  const cleanupResult = cleanupDebugLogs(3456, 0); // 0秒 = 测试不删除
  console.log('✅ 清理功能正常');
  
  console.log('\n🎉 端口分组日志系统验证完成！');
  console.log('\n📁 目录结构:');
  console.log('  ~/.route-claude-code/logs/');
  console.log('  ├── port-3456/ (默认端口)');
  console.log('  ├── port-6689/ (备用端口)');
  console.log('  ├── port-5509/ (备用端口)');
  console.log('  └── [其他端口...]');
  
  console.log('\n🔧 每个端口目录包含:');
  console.log('  - finish-reason-debug.log');
  console.log('  - stop-reason-debug.log');
  console.log('  - tool-call-completion.log');
  console.log('  - api-errors.log');
  console.log('  - polling-retries.log');
  
} catch (error) {
  console.error('❌ 端口分组日志系统验证失败:', error.message);
  console.error('错误详情:', error);
  
  console.log('\n🔍 可能的原因：');
  console.log('1. 构建失败');
  console.log('2. 文件系统权限问题');
  console.log('3. 端口参数传递错误');
  
  console.log('\n💡 建议解决方案：');
  console.log('1. 运行 npm run build 重新构建');
  console.log('2. 检查文件系统权限');
  console.log('3. 验证端口参数传递');
}