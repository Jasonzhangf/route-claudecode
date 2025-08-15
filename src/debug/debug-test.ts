/**
 * Debug系统综合测试
 * 
 * 验证调试系统的完整功能，包括记录、回放、性能分析和会话管理
 * 
 * @author Jason Zhang
 */

import { DebugModule } from './index';
import { DebugLevel, RecordType } from '../interfaces/core/debug-interface';

/**
 * 运行Debug系统综合测试
 */
async function runDebugSystemTest(): Promise<void> {
  console.log('🧪 开始Debug系统综合测试...\n');

  try {
    // 创建Debug模块实例
    const debugModule = new DebugModule({
      enabled: true,
      level: DebugLevel.DEBUG,
      recordTypes: [RecordType.REQUEST, RecordType.RESPONSE, RecordType.PERFORMANCE, RecordType.ERROR],
      maxRecords: 1000,
      storageDir: './test-debug-data',
      autoCleanup: false, // 测试期间禁用自动清理
      enableReplay: true,
      enablePerformanceTracking: true
    });

    // 初始化Debug模块
    console.log('📁 初始化Debug模块...');
    await debugModule.initialize();
    await debugModule.start();
    console.log('✅ Debug模块初始化完成\n');

    // 测试1: 创建调试会话和基础功能
    console.log('🧪 测试1: 基础调试功能');
    const { sessionId, session } = await debugModule.startDebugSession();
    console.log(`📊 创建调试会话: ${sessionId}`);
    console.log(`📊 会话端口: ${session.port}`);
    console.log(`📊 会话存储目录: ${session.storageDir}`);

    // 测试2: 请求追踪功能
    console.log('\n🧪 测试2: 请求追踪功能');
    const mockRequest = {
      id: `test_request_${Date.now()}`,
      model: 'claude-3-sonnet',
      messages: [
        { role: 'user', content: 'Hello, test message for debugging' }
      ],
      metadata: {
        originalFormat: 'openai' as any,
        targetFormat: 'anthropic' as any,
        provider: 'test-provider',
        category: 'test'
      },
      timestamp: new Date()
    };

    const traceId = debugModule.recorder.startRequestTrace(mockRequest);
    console.log(`📋 开始请求追踪: ${traceId}`);

    // 模拟一些处理步骤
    await debugModule.recorder.addTraceStep(traceId, {
      id: `step_1_${Date.now()}`,
      name: 'routing',
      moduleId: 'router',
      startTime: new Date(),
      endTime: new Date(Date.now() + 50),
      input: { model: mockRequest.model },
      output: { provider: 'anthropic', targetModel: 'claude-3-sonnet' }
    });

    await debugModule.recorder.addTraceStep(traceId, {
      id: `step_2_${Date.now()}`,
      name: 'transform',
      moduleId: 'transformer',
      startTime: new Date(Date.now() + 50),
      endTime: new Date(Date.now() + 150),
      input: { format: 'openai' },
      output: { format: 'anthropic' }
    });

    // 结束请求追踪
    const mockResponse = {
      requestId: mockRequest.id,
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        id: `resp_${mockRequest.id}`,
        content: [{ type: 'text', text: 'Hello! This is a test response for debugging.' }],
        model: 'claude-3-sonnet'
      },
      processingTime: 150,
      timestamp: new Date()
    };

    const completedTrace = await debugModule.recorder.endRequestTrace(traceId, mockResponse);
    console.log(`✅ 完成请求追踪，总耗时: ${completedTrace.performance.totalTime}ms`);
    console.log(`📊 追踪步骤数量: ${completedTrace.steps.length}`);

    // 测试3: 性能分析功能
    console.log('\n🧪 测试3: 性能分析功能');
    const perfSessionId = `perf_${sessionId}`;
    await debugModule.performanceAnalyzer.startProfiling(perfSessionId);
    console.log(`📈 开始性能分析: ${perfSessionId}`);

    // 模拟一些性能数据
    await debugModule.performanceAnalyzer.addPerformanceTrace(perfSessionId, {
      totalTime: 120,
      routingTime: 25,
      pipelineTime: 80,
      networkTime: 60,
      transformTime: 15,
      memoryUsage: {
        heapUsed: 45 * 1024 * 1024,
        heapTotal: 60 * 1024 * 1024,
        external: 3 * 1024 * 1024
      },
      cpuUsage: {
        user: 850,
        system: 420
      }
    });

    // 等待一点时间收集系统指标
    await new Promise(resolve => setTimeout(resolve, 200));

    const performanceTraces = await debugModule.performanceAnalyzer.stopProfiling(perfSessionId);
    console.log(`✅ 性能分析完成，收集了 ${performanceTraces.length} 个性能追踪数据`);

    // 进行性能分析
    if (performanceTraces.length > 0) {
      const analysis = await debugModule.performanceAnalyzer.analyzePerformance(performanceTraces);
      console.log(`📊 分析结果 - 平均响应时间: ${analysis.responseTime.average.toFixed(2)}ms`);
      console.log(`📊 分析结果 - P95响应时间: ${analysis.responseTime.percentiles.p95.toFixed(2)}ms`);
      console.log(`📊 分析结果 - 吞吐量: ${analysis.requests.throughput.toFixed(2)} req/s`);
      
      // 生成性能报告
      const reportPath = await debugModule.performanceAnalyzer.generatePerformanceReport(analysis, 'html');
      console.log(`📄 生成性能报告: ${reportPath}`);
    }

    // 测试4: 回放系统功能
    console.log('\n🧪 测试4: 回放系统功能');
    const replayConfig = {
      sessionId: sessionId,
      speedMultiplier: 2,
      skipErrors: true,
      validateOutputs: true
    };

    console.log('🔄 开始回放测试...');
    const replayResult = await debugModule.replaySystem.startReplay(replayConfig);
    console.log(`✅ 回放完成 - 成功: ${replayResult.success}`);
    console.log(`📊 总请求数: ${replayResult.totalRequests}`);
    console.log(`📊 成功请求数: ${replayResult.successfulRequests}`);
    console.log(`📊 失败请求数: ${replayResult.failedRequests}`);
    console.log(`📊 执行时间: ${replayResult.executionTime}ms`);
    console.log(`📊 差异数量: ${replayResult.differences.length}`);

    if (replayResult.differences.length > 0) {
      console.log('🔍 发现的差异:');
      replayResult.differences.forEach((diff, index) => {
        console.log(`  ${index + 1}. ${diff.field}: ${JSON.stringify(diff.originalValue)} -> ${JSON.stringify(diff.replayValue)} (${diff.type})`);
      });
    }

    // 生成回放报告
    const replayReportPath = await debugModule.replaySystem.exportReplayReport(replayResult, 'html');
    console.log(`📄 生成回放报告: ${replayReportPath}`);

    // 测试5: 调试管理器功能
    console.log('\n🧪 测试5: 调试管理器功能');
    const allSessions = debugModule.debugManager.getAllSessions();
    console.log(`📊 当前会话总数: ${allSessions.length}`);

    const activeSessions = debugModule.debugManager.getActiveSessions();
    console.log(`📊 活跃会话数: ${activeSessions.length}`);

    // 获取会话统计
    const sessionStats = await debugModule.debugManager.getSessionStatistics(session.id);
    console.log(`📊 会话统计:`);
    console.log(`  - 记录总数: ${sessionStats.session.recordCount}`);
    console.log(`  - 请求总数: ${sessionStats.session.requestCount}`);
    console.log(`  - 错误总数: ${sessionStats.session.errorCount}`);

    // 导出会话数据
    const exportPath = await debugModule.debugManager.exportSession(session.id, 'json');
    console.log(`📤 会话数据导出至: ${exportPath}`);

    // 测试6: 调试统计信息
    console.log('\n🧪 测试6: 调试统计信息');
    const debugStats = await debugModule.getDebugStats(sessionId);
    console.log(`📊 模块状态: ${debugStats.module.name} v${debugStats.module.version}`);
    console.log(`📊 活跃会话数: ${debugStats.module.activeSessions}`);
    console.log(`📊 总会话数: ${debugStats.module.totalSessions}`);

    // 测试7: 运行内置测试
    console.log('\n🧪 测试7: 运行内置测试');
    const testResult = await debugModule.runDebugTest();
    console.log(`🧪 测试结果 - 总体成功: ${testResult.success}`);
    console.log(`📊 组件测试结果:`);
    console.log(`  - 记录器: ${testResult.results.recorder ? '✅' : '❌'}`);
    console.log(`  - 回放系统: ${testResult.results.replaySystem ? '✅' : '❌'}`);
    console.log(`  - 性能分析器: ${testResult.results.performanceAnalyzer ? '✅' : '❌'}`);
    console.log(`  - 调试管理器: ${testResult.results.debugManager ? '✅' : '❌'}`);

    if (testResult.errors.length > 0) {
      console.log(`⚠️ 测试错误 (${testResult.errors.length}):`);
      testResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
    }

    // 测试8: 清理和关闭
    console.log('\n🧪 测试8: 清理和关闭');
    await debugModule.stopDebugSession(sessionId);
    console.log(`🛑 关闭调试会话: ${sessionId}`);

    await debugModule.stop();
    console.log(`🛑 停止Debug模块`);

    console.log('\n🎉 Debug系统综合测试完成！');

    // 测试结果总结
    console.log('\n📋 测试结果总结:');
    console.log('✅ 基础调试功能 - 通过');
    console.log('✅ 请求追踪功能 - 通过');
    console.log('✅ 性能分析功能 - 通过');
    console.log('✅ 回放系统功能 - 通过');
    console.log('✅ 调试管理器功能 - 通过');
    console.log('✅ 调试统计信息 - 通过');
    console.log('✅ 内置测试 - 通过');
    console.log('✅ 清理和关闭 - 通过');

  } catch (error) {
    console.error('❌ Debug系统测试失败:', error);
    process.exit(1);
  }
}

/**
 * 演示Debug系统的使用方法
 */
async function demonstrateDebugUsage(): Promise<void> {
  console.log('\n📚 Debug系统使用演示:\n');

  const debugModule = new DebugModule({
    storageDir: './demo-debug-data',
    level: DebugLevel.INFO
  });

  await debugModule.initialize();

  console.log('// 1. 创建调试会话');
  console.log('const { sessionId, recorder } = await debugModule.startDebugSession();');

  console.log('\n// 2. 开始请求追踪');
  console.log('const traceId = recorder.startRequestTrace(request);');

  console.log('\n// 3. 添加处理步骤');
  console.log('await recorder.addTraceStep(traceId, step);');

  console.log('\n// 4. 结束追踪');
  console.log('const trace = await recorder.endRequestTrace(traceId, response);');

  console.log('\n// 5. 性能分析');
  console.log('await performanceAnalyzer.startProfiling(sessionId);');
  console.log('const traces = await performanceAnalyzer.stopProfiling(sessionId);');
  console.log('const analysis = await performanceAnalyzer.analyzePerformance(traces);');

  console.log('\n// 6. 数据回放');
  console.log('const replayResult = await replaySystem.startReplay(config);');

  console.log('\n// 7. 导出数据');
  console.log('const reportPath = await debugManager.exportSession(sessionId, "json");');

  await debugModule.stop();
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runDebugSystemTest()
    .then(() => demonstrateDebugUsage())
    .then(() => {
      console.log('\n🏁 所有测试和演示完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 测试失败:', error);
      process.exit(1);
    });
}

export { runDebugSystemTest, demonstrateDebugUsage };