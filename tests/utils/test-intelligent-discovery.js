/**
 * 测试智能模型发现系统
 */

const { IntelligentModelDiscovery } = require('./scripts/intelligent-model-discovery.js');

async function testIntelligentDiscovery() {
  console.log('🧪 测试智能模型发现系统...\n');

  // 测试shuaihong-openai提供商
  const testConfig = {
    providerId: 'shuaihong-openai',
    provider: {
      type: 'openai',
      endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
      authentication: {
        type: 'bearer',
        credentials: {
          apiKey: 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
        }
      }
    },
    testConfig: {
      testCount: 2, // 减少测试次数以加快速度
      testInterval: 500,
      requestTimeout: 8000,
      testPrompt: 'Hi',
      maxTokens: 3,
      rateLimitBackoff: 1000,
      maxConcurrentTests: 1 // 减少并发避免流控
    },
    qualityThresholds: {
      minSuccessRate: 0.5, // 降低成功率要求
      maxResponseTime: 15000,
      minConfidenceLevel: 'low'
    },
    cacheConfig: {
      modelListTTL: 5 * 60 * 1000,
      testResultTTL: 2 * 60 * 1000,
      enablePersistentCache: false
    }
  };

  try {
    const discovery = new IntelligentModelDiscovery(testConfig);
    const report = await discovery.discoverAndUpdateModels();

    console.log('\n📊 测试结果报告:');
    console.log('='.repeat(50));
    
    console.log(`Provider: ${report.providerId}`);
    console.log(`总模型数: ${report.totalModelsFound}`);
    console.log(`API获取: ${report.modelsFromAPI}`);
    console.log(`备用模型: ${report.modelsFromFallback}`);
    console.log(`可用模型: ${report.availableModels.length}`);
    console.log(`不可用模型: ${report.unavailableModels.length}`);
    
    if (report.availableModels.length > 0) {
      console.log('\n✅ 可用模型详情:');
      report.availableModels.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.modelId}`);
        console.log(`     成功率: ${(model.successRate * 100).toFixed(0)}%`);
        console.log(`     响应时间: ${model.responseTime}ms`);
        console.log(`     置信度: ${model.confidence}`);
      });
    }

    if (report.unavailableModels.length > 0) {
      console.log('\n❌ 不可用模型详情:');
      report.unavailableModels.slice(0, 3).forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.modelId}`);
        console.log(`     成功率: ${(model.successRate * 100).toFixed(0)}%`);
        console.log(`     主要错误: ${model.errors[0] || 'Unknown'}`);
      });
    }

    console.log('\n⚡ 性能指标:');
    console.log(`  总耗时: ${report.performance.totalDuration}ms`);
    console.log(`  API调用: ${report.performance.apiCallDuration}ms`);
    console.log(`  模型测试: ${report.performance.testingDuration}ms`);
    console.log(`  平均响应: ${Math.round(report.performance.averageResponseTime)}ms`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 建议:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  警告:');
      report.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log(`\n🔧 配置已更新: ${report.configurationUpdated ? '是' : '否'}`);

    console.log('\n✅ 智能发现系统测试完成!');
    
    // 验证核心功能
    console.log('\n🔍 功能验证:');
    console.log(`✅ API模型获取: ${report.modelsFromAPI > 0 ? '成功' : '失败'}`);
    console.log(`✅ 模型测试: ${report.availableModels.length + report.unavailableModels.length > 0 ? '成功' : '失败'}`);
    console.log(`✅ 质量分析: ${report.availableModels.some(m => m.confidence === 'high') ? '发现高质量模型' : '未发现高质量模型'}`);
    console.log(`✅ 性能监控: ${report.performance.averageResponseTime > 0 ? '成功' : '失败'}`);

  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log(error.stack);
  }
}

testIntelligentDiscovery().catch(console.error);