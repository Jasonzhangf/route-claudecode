/**
 * 服务器启动时的调试系统使用示例
 * 
 * 演示如何在RCC v4.0服务器启动时集成Pipeline调试系统
 * 
 * @author RCC v4.0
 */

import { PipelineDebugSystemFactory, PipelineDebugConfig, DEFAULT_PIPELINE_DEBUG_CONFIG } from './index';
import { RoutingTable } from '../interfaces/router/request-router';
import { secureLogger } from '../utils/secure-logger';

/**
 * 服务器启动调试集成示例
 */
export class ServerStartupDebugExample {
  
  /**
   * 演示在服务器启动时集成调试系统的完整流程
   */
  static async demonstrateServerStartupWithDebug(
    pipelineManager: any,
    routingTable: RoutingTable,
    pipelineRouter?: any,
    loadBalancer?: any,
    debugConfig: PipelineDebugConfig = DEFAULT_PIPELINE_DEBUG_CONFIG
  ): Promise<{
    debugSummary: any;
    testResults?: any;
  }> {
    
    secureLogger.info('🚀 === RCC v4.0 Server Startup with Debug System ===');
    
    // Step 1: 创建调试系统
    secureLogger.info('🔧 Creating debug systems...');
    const { pipelineDebug, requestTest } = PipelineDebugSystemFactory.createDebugSystem(
      pipelineManager, 
      pipelineRouter, 
      loadBalancer
    );
    
    // Step 2: 执行初始化检查
    if (debugConfig.enableInitializationCheck) {
      secureLogger.info('🔍 Performing initialization check...');
      
      try {
        const validationResult = await pipelineDebug.performInitializationCheck(routingTable);
        
        if (!validationResult.isValid) {
          secureLogger.error('❌ Server startup failed: Pipeline initialization validation failed');
          throw new Error(`Pipeline validation failed: ${validationResult.errors.join(', ')}`);
        }
        
        secureLogger.info('✅ Pipeline initialization validation passed');
        
      } catch (error) {
        secureLogger.error('❌ Server startup failed during initialization check:', { error: error.message });
        throw error;
      }
    }
    
    // Step 3: 执行请求测试（如果配置启用）
    let testResults;
    if (debugConfig.enableRequestTesting && pipelineRouter && loadBalancer) {
      secureLogger.info('🧪 Performing startup request test...');
      
      try {
        // 构建标准测试请求
        const testRequest = {
          model: 'claude-3-5-sonnet',
          messages: [
            { role: 'user', content: 'Hello, this is a server startup test request.' }
          ],
          maxTokens: 100,
          temperature: 0.7
        };
        
        testResults = await requestTest.performRequestTest(testRequest);
        
        if (testResults.executionResult.hasResponse) {
          secureLogger.info('✅ Startup request test passed');
        } else {
          secureLogger.warn('⚠️  Startup request test failed, but server can still start', {
            error: testResults.executionResult.error
          });
        }
        
      } catch (error) {
        secureLogger.warn('⚠️  Startup request test failed:', { error: error.message });
        // 请求测试失败不应该阻止服务器启动
      }
    }
    
    // Step 4: 获取调试摘要
    const debugSummary = pipelineDebug.getDebugSummary();
    
    secureLogger.info('📊 Debug Summary:', {
      totalPipelines: debugSummary.totalPipelines,
      pipelinesByStatus: debugSummary.pipelinesByStatus,
      pipelinesByProvider: debugSummary.pipelinesByProvider,
      lastCheckTime: debugSummary.lastCheckTime?.toISOString()
    });
    
    // Step 5: 设置监听器用于运行时监控
    this.setupRuntimeMonitoring(pipelineDebug, requestTest, debugConfig);
    
    secureLogger.info('🎉 Server startup debug integration completed successfully');
    
    return {
      debugSummary,
      testResults
    };
  }
  
  /**
   * 设置运行时监控
   */
  private static setupRuntimeMonitoring(
    pipelineDebug: any,
    requestTest: any,
    debugConfig: PipelineDebugConfig
  ): void {
    
    // 监听初始化检查完成事件
    pipelineDebug.on('initializationCheckCompleted', (data: any) => {
      secureLogger.info('🔍 Initialization check completed:', {
        timestamp: data.timestamp,
        isValid: data.validationResult.isValid,
        totalPipelines: data.validationResult.totalFound
      });
    });
    
    // 监听初始化检查失败事件
    pipelineDebug.on('initializationCheckFailed', (data: any) => {
      secureLogger.error('❌ Initialization check failed:', {
        timestamp: data.timestamp,
        error: data.error
      });
    });
    
    // 监听请求测试事件
    requestTest.on('requestTestCompleted', (data: any) => {
      secureLogger.info('🧪 Request test completed:', {
        virtualModel: data.routingResult.virtualModel,
        selectedPipeline: data.routingResult.selectedPipelineId,
        hasResponse: data.executionResult.hasResponse,
        executionTime: data.executionResult.executionTime
      });
    });
    
    // 监听请求测试失败事件
    requestTest.on('requestTestFailed', (data: any) => {
      secureLogger.error('❌ Request test failed:', {
        error: data.error
      });
    });
    
    // 监听诊断完成事件
    requestTest.on('diagnosisCompleted', (data: any) => {
      secureLogger.info('🩺 Diagnosis completed:', {
        pipelineId: data.pipelineId,
        failedLayer: data.failedLayer,
        recommendations: data.recommendations
      });
    });
    
    // 如果配置了定期测试，设置定时器
    if (debugConfig.testRequestInterval && debugConfig.testRequestInterval > 0) {
      setInterval(async () => {
        try {
          const testRequest = {
            model: 'claude-3-5-sonnet',
            messages: [{ role: 'user', content: 'Periodic health check.' }],
            maxTokens: 50
          };
          
          await requestTest.performRequestTest(testRequest);
          
        } catch (error) {
          secureLogger.warn('⚠️  Periodic request test failed:', { error: error.message });
        }
      }, debugConfig.testRequestInterval);
      
      secureLogger.info(`⏰ Periodic request testing enabled (interval: ${debugConfig.testRequestInterval}ms)`);
    }
  }
  
  /**
   * 手动执行调试检查（用于运行时诊断）
   */
  static async performManualDiagnostic(
    pipelineManager: any,
    routingTable: RoutingTable,
    testRequest?: any
  ): Promise<any> {
    
    secureLogger.info('🔧 === Manual Pipeline Diagnostic ===');
    
    const pipelineDebug = PipelineDebugSystemFactory.createPipelineDebugSystem(pipelineManager);
    
    // 执行初始化检查
    const validationResult = await pipelineDebug.performInitializationCheck(routingTable);
    
    // 获取所有流水线状态
    const allPipelineInfo = pipelineDebug.getAllPipelineDebugInfo();
    
    // 获取摘要
    const summary = pipelineDebug.getDebugSummary();
    
    const diagnosticResult = {
      timestamp: new Date().toISOString(),
      validationResult,
      pipelineDetails: allPipelineInfo,
      summary,
      recommendations: this.generateRecommendations(validationResult, allPipelineInfo)
    };
    
    secureLogger.info('📊 Manual diagnostic completed:', {
      isValid: validationResult.isValid,
      totalPipelines: summary.totalPipelines,
      issueCount: validationResult.errors.length
    });
    
    return diagnosticResult;
  }
  
  /**
   * 生成基于诊断结果的建议
   */
  private static generateRecommendations(validationResult: any, pipelineInfo: any[]): string[] {
    const recommendations: string[] = [];
    
    if (!validationResult.isValid) {
      recommendations.push('Pipeline validation failed - check configuration and initialization');
    }
    
    if (validationResult.missingPipelines.length > 0) {
      recommendations.push(`Missing pipelines: ${validationResult.missingPipelines.join(', ')}`);
    }
    
    if (validationResult.unexpectedPipelines.length > 0) {
      recommendations.push(`Unexpected pipelines found: ${validationResult.unexpectedPipelines.join(', ')}`);
    }
    
    // 检查错误状态的流水线
    const errorPipelines = pipelineInfo.filter(p => p.status === 'error');
    if (errorPipelines.length > 0) {
      recommendations.push(`Pipelines in error state: ${errorPipelines.map(p => p.pipelineId).join(', ')}`);
    }
    
    // 检查未连接的层
    for (const pipeline of pipelineInfo) {
      const disconnectedLayers = Object.entries(pipeline.layerStatus)
        .filter(([, status]) => status === 'error')
        .map(([layer]) => layer);
        
      if (disconnectedLayers.length > 0) {
        recommendations.push(`Pipeline ${pipeline.pipelineId} has disconnected layers: ${disconnectedLayers.join(', ')}`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All pipelines appear to be functioning correctly');
    }
    
    return recommendations;
  }
}

/**
 * 使用示例
 */
export const USAGE_EXAMPLE = `
// 在服务器启动时使用调试系统
async function startServer() {
  // ... 初始化Pipeline Manager, Router等 ...
  
  try {
    const debugResult = await ServerStartupDebugExample.demonstrateServerStartupWithDebug(
      pipelineManager,
      routingTable,
      pipelineRouter,
      loadBalancer,
      {
        enableInitializationCheck: true,
        enableRequestTesting: true,
        enableLayerDiagnostics: true,
        logLevel: 'info',
        testRequestInterval: 60000 // 每分钟测试一次
      }
    );
    
    console.log('Debug Summary:', debugResult.debugSummary);
    
    // 启动HTTP服务器
    await httpServer.start();
    
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

// 手动诊断
async function runDiagnostic() {
  const result = await ServerStartupDebugExample.performManualDiagnostic(
    pipelineManager,
    routingTable
  );
  
  console.log('Diagnostic Result:', result);
}
`;