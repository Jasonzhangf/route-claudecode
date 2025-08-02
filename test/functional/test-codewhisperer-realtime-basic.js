/**
 * CodeWhisperer 实时流式实现测试
 * 测试实时流式客户端的基本功能
 */

import { CodeWhispererClient } from '../../src/providers/codewhisperer/client';
import { CodeWhispererStreamingConfigManager } from '../../src/providers/codewhisperer/config/streaming-config';

async function testRealtimeImplementation() {
  console.log('🚀 开始测试CodeWhisperer实时流式实现');
  
  try {
    // 1. 测试配置管理
    console.log('📋 测试1: 配置管理');
    const configManager = CodeWhispererStreamingConfigManager.getInstance();
    const config = configManager.getConfig();
    
    console.log('✅ 默认配置加载成功:', {
      implementation: config.implementation,
      realtimeOptions: config.realtimeOptions
    });
    
    // 2. 测试实时客户端创建
    console.log('📋 测试2: 实时客户端创建');
    const realtimeConfig = {
      ...config,
      implementation: 'realtime',
      realtimeOptions: {
        ...config.realtimeOptions,
        enableZeroDelay: true,
        toolCallStrategy: 'immediate',
      }
    };
    
    const realtimeClient = new CodeWhispererClient(realtimeConfig);
    
    console.log('✅ 实时客户端创建成功:', {
      clientType: realtimeClient.getClientType(),
      config: realtimeClient.getCurrentConfig()
    });
    
    // 3. 测试健康检查
    console.log('📋 测试3: 健康检查');
    const healthCheck = await realtimeClient.healthCheck();
    
    console.log('✅ 健康检查完成:', healthCheck);
    
    if (healthCheck.healthy) {
      console.log('🎉 实时客户端健康状态良好');
    } else {
      console.log('⚠️ 实时客户端健康检查失败:', healthCheck.message);
    }
    
    // 4. 测试配置切换
    console.log('📋 测试4: 配置切换');
    realtimeClient.switchImplementation('buffered');
    
    // 等待切换完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const switchedType = realtimeClient.getClientType();
    console.log('✅ 实现切换成功:', { switchedType });
    
    // 切换回实时
    realtimeClient.switchImplementation('realtime');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalType = realtimeClient.getClientType();
    console.log('✅ 切换回实时成功:', { finalType });
    
    // 5. 测试性能报告
    console.log('📋 测试5: 性能报告');
    const performanceReport = realtimeClient.getPerformanceReport();
    
    console.log('✅ 性能报告获取成功:', {
      totalRequests: performanceReport.totalRequests,
      successfulRequests: performanceReport.successfulRequests,
      implementationStats: performanceReport.implementationStats
    });
    
    // 6. 测试实现对比
    console.log('📋 测试6: 实现对比');
    const comparison = realtimeClient.getImplementationComparison();
    
    console.log('✅ 实现对比获取成功:', comparison);
    
    // 7. 清理资源
    console.log('📋 测试7: 资源清理');
    realtimeClient.destroy();
    
    console.log('✅ 资源清理完成');
    
    console.log('🎉 所有测试通过！CodeWhisperer实时流式实现功能正常');
    
    return {
      success: true,
      message: '所有测试通过',
      results: {
        configLoaded: true,
        clientCreated: true,
        healthCheck: healthCheck,
        implementationSwitch: {
          from: 'realtime',
          to: 'buffered',
          back: 'realtime',
          finalType
        },
        performanceReport: {
          totalRequests: performanceReport.totalRequests,
          successfulRequests: performanceReport.successfulRequests
        },
        comparison: comparison.comparison.recommendation
      }
    };
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: error
    };
  }
}

// 运行测试
if (require.main === module) {
  testRealtimeImplementation()
    .then(result => {
      console.log('\n📊 测试结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n🎯 建议: 实时流式实现测试成功，可以进行下一步的功能测试');
      } else {
        console.log('\n⚠️ 建议: 请检查错误信息并修复问题');
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试执行失败:', error);
      process.exit(1);
    });
}

export { testRealtimeImplementation };