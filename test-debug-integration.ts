/**
 * Debug系统集成测试
 */

import { globalDebugInit } from './src/modules/logging/src/global-debug-init';
import { ConfigPreprocessor } from './src/modules/config/src/config-preprocessor';
import { secureLogger } from './src/modules/error-handler/src/utils/secure-logger';

async function testDebugIntegration() {
  secureLogger.info('开始测试Debug系统集成');
  
  // 1. 初始化全局debug系统
  secureLogger.info('初始化全局debug系统');
  await globalDebugInit.initializeAllModules();
  secureLogger.info('全局debug系统初始化成功');
  
  // 2. 开始全局debug会话
  secureLogger.info('开始全局debug会话');
  const sessionId = globalDebugInit.startGlobalSession('test-session-001');
  secureLogger.info('Debug会话开始', { sessionId });
  
  // 3. 测试config模块的debug集成
  secureLogger.info('测试Config模块debug集成');
  const testConfigPath = '/Users/fanzhang/.route-claudecode/config.json';
  
  const result = await ConfigPreprocessor.preprocess(testConfigPath);
  secureLogger.info('Config预处理完成', {
    success: result.success,
    processingTime: result.metadata.processingTime
  });
  
  // 4. 获取debug统计信息
  secureLogger.info('获取debug统计信息');
  const stats = globalDebugInit.getAllStatistics();
  secureLogger.info('Debug统计信息获取完成', { statsKeys: Object.keys(stats) });
  
  // 5. 结束debug会话
  secureLogger.info('结束debug会话');
  await globalDebugInit.endGlobalSession();
  secureLogger.info('Debug会话已结束');
  
  secureLogger.info('Debug系统集成测试完成');
}

// 运行测试
if (require.main === module) {
  testDebugIntegration();
}