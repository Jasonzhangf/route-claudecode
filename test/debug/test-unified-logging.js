/**
 * 统一日志系统测试
 * 验证新的日志系统功能
 */

import { getLogger, createRequestTracker, createErrorTracker, quickLog } from './dist/logging/index.js';

async function testUnifiedLogging() {
  console.log('🧪 Testing Unified Logging System...');
  
  const testPort = 5505;
  
  try {
    // 测试基础日志功能
    console.log('\n📝 Testing basic logging...');
    const logger = getLogger(testPort);
    
    logger.info('Test info message', { test: true });
    logger.warn('Test warning message', { warning: true });
    logger.error('Test error message', { error: true });
    logger.debug('Test debug message', { debug: true });
    
    // 测试专用日志方法
    console.log('\n🔧 Testing specialized logging...');
    logger.logRequest('req-123', 'POST', '/v1/messages', { userId: 'test-user' });
    logger.logResponse('req-123', 200, { success: true }, 150);
    logger.logPipeline('routing', 'Route selected', { provider: 'test-provider' }, 'req-123');
    logger.logPerformance('request_processing', 150, { requestId: 'req-123' }, 'req-123');
    logger.logToolCall('Tool call executed', { toolName: 'test-tool' }, 'req-123');
    logger.logStreaming('Chunk received', { chunkIndex: 1 }, 'req-123');
    
    // 测试请求跟踪器
    console.log('\n📊 Testing request tracker...');
    const requestTracker = createRequestTracker(testPort);
    
    requestTracker.startRequest('req-456', testPort, 'anthropic', 'claude-3', { test: true });
    requestTracker.logStage('req-456', 'processing', { stage: 'input' });
    requestTracker.logToolCall('req-456', 'test-tool', { result: 'success' });
    requestTracker.logStreaming('req-456', 1, { chunk: 'test' });
    requestTracker.completeRequest('req-456', 200, { completed: true });
    
    // 测试错误跟踪器
    console.log('\n❌ Testing error tracker...');
    const errorTracker = createErrorTracker(testPort);
    
    errorTracker.logToolCallError({
      requestId: 'req-789',
      errorMessage: 'Tool call parsing failed',
      transformationStage: 'output',
      provider: 'anthropic',
      model: 'claude-3',
      context: { rawData: 'test' },
      port: testPort
    });
    
    errorTracker.logStandardizedError({
      port: testPort,
      provider: 'anthropic',
      model: 'claude-3',
      key: 'test-key-12345',
      errorCode: 400,
      reason: 'Invalid request',
      requestId: 'req-789'
    });
    
    errorTracker.logGeneralError('General error occurred', new Error('Test error'), 'req-789', 'test-stage');
    
    // 测试快速日志
    console.log('\n⚡ Testing quick logging...');
    quickLog('Quick info message');
    quickLog('Quick warning message', { warning: true }, 'warn');
    quickLog('Quick error message', { error: true }, 'error');
    
    console.log('\n✅ All tests completed successfully!');
    console.log(`📁 Logs are organized in: ~/.route-claude-code/logs/port-${testPort}/`);
    
    // 获取统计信息
    const stats = await logger.cleanup();
    console.log(`🧹 Cleaned up ${stats} old log directories`);
    
    // 优雅关闭
    await logger.shutdown();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testUnifiedLogging().then(() => {
    console.log('🎉 Unified logging test completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export { testUnifiedLogging };