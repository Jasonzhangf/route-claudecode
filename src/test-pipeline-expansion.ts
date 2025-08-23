/**
 * PipelineTableManager流水线展开功能测试
 * 测试多provider路由配置的流水线生成和多key支持
 * 
 * @author RCC v4.0
 */

import { ConfigReader } from './config/config-reader';
import { PipelineTableManager } from './pipeline/pipeline-table-manager';
import { secureLogger } from './utils/secure-logger';
import { JQJsonHandler } from './utils/jq-json-handler';
import path from 'path';
import { PipelineError } from './types/error';

/**
 * 测试PipelineTableManager的展开功能
 */
async function testPipelineExpansion() {
  try {
    secureLogger.info('🧪 Starting PipelineTableManager expansion test');
    
    // 测试文件路径
    const multiProviderConfigPath = path.join(
      process.env.HOME || '',
      '.route-claudecode/config/multi-provider-hybrid-v4.json'
    );
    
    const systemConfigPath = path.join(__dirname, '../config/system-config.json');
    
    secureLogger.info('📂 Loading configuration files', {
      userConfig: multiProviderConfigPath,
      systemConfig: systemConfigPath
    });
    
    // 1. 加载配置
    const mergedConfig = ConfigReader.loadConfig(multiProviderConfigPath, systemConfigPath);
    
    secureLogger.info('✅ Configuration loaded', {
      providersCount: mergedConfig.providers.length,
      routerCategories: Object.keys(mergedConfig.router || {}).length,
      hasExpandedRouting: !!mergedConfig.expandedRouting,
      hasSecurity: !!mergedConfig.security
    });
    
    // 2. 创建PipelineTableManager
    const pipelineManager = new PipelineTableManager(mergedConfig);
    
    // 3. 生成流水线路由表
    secureLogger.info('🔧 Generating pipeline routing table');
    const routingTable = await pipelineManager.getOrGenerateRoutingTable();
    
    secureLogger.info('✅ Pipeline routing table generated', {
      totalPipelines: routingTable.totalPipelines,
      categoriesCount: Object.keys(routingTable.pipelinesGroupedByVirtualModel).length,
      categories: Object.keys(routingTable.pipelinesGroupedByVirtualModel)
    });
    
    // 4. 分析生成的流水线
    const analysis = analyzePipelineTable(routingTable);
    secureLogger.info('📊 Pipeline analysis completed', analysis);
    
    // 5. 验证多key支持
    const multiKeyAnalysis = analyzeMultiKeySupport(routingTable);
    secureLogger.info('🔑 Multi-key analysis completed', multiKeyAnalysis);
    
    // 6. 验证security路由支持
    const securityAnalysis = analyzeSecurityRoutes(routingTable);
    secureLogger.info('🔐 Security routes analysis completed', securityAnalysis);
    
    // 7. 生成测试摘要
    const testSummary = {
      metadata: {
        timestamp: new Date().toISOString(),
        testType: 'pipeline-expansion',
        version: '4.0'
      },
      configuration: {
        hasExpandedRouting: !!mergedConfig.expandedRouting,
        expandedProviders: mergedConfig.expandedRouting ? {
          primary: mergedConfig.expandedRouting.primaryProviders.length,
          security: mergedConfig.expandedRouting.securityProviders.length,
          total: mergedConfig.expandedRouting.allProviders.length
        } : null
      },
      pipelines: {
        total: routingTable.totalPipelines,
        categories: Object.keys(routingTable.pipelinesGroupedByVirtualModel).length,
        analysis,
        multiKeySupport: multiKeyAnalysis,
        securityRoutes: securityAnalysis
      }
    };
    
    secureLogger.info('📄 Final pipeline test summary', testSummary);
    
    return {
      success: true,
      routingTable,
      analysis,
      summary: testSummary
    };
    
  } catch (error) {
    const testError = new PipelineError('流水线展开测试失败', {
      originalError: error,
      testPhase: 'pipeline-expansion-test'
    });
    secureLogger.error('❌ Pipeline expansion test failed', { error: testError });
    
    return {
      success: false,
      error: testError
    };
  }
}

/**
 * 分析流水线表结构
 */
function analyzePipelineTable(routingTable: any): Record<string, any> {
  const analysis: Record<string, any> = {
    totalPipelines: routingTable.totalPipelines,
    categories: {},
    providers: {},
    priorities: [],
    securityEnhanced: 0,
    regularPipelines: 0
  };
  
  // 按类别分析
  Object.entries(routingTable.pipelinesGroupedByVirtualModel).forEach(([category, pipelines]: [string, any[]]) => {
    analysis.categories[category] = {
      count: pipelines.length,
      providers: [...new Set(pipelines.map(p => p.provider))],
      models: [...new Set(pipelines.map(p => p.targetModel))],
      priorities: pipelines.map(p => p.priority).sort((a, b) => a - b),
      hasSecurityRoutes: pipelines.some(p => p.isSecurityEnhanced),
      securityCount: pipelines.filter(p => p.isSecurityEnhanced).length
    };
  });
  
  // 按provider分析
  routingTable.allPipelines.forEach((pipeline: any) => {
    if (!analysis.providers[pipeline.provider]) {
      analysis.providers[pipeline.provider] = {
        count: 0,
        categories: new Set(),
        models: new Set(),
        apiKeys: new Set(),
        priorities: []
      };
    }
    
    analysis.providers[pipeline.provider].count++;
    analysis.providers[pipeline.provider].categories.add(pipeline.category);
    analysis.providers[pipeline.provider].models.add(pipeline.targetModel);
    analysis.providers[pipeline.provider].apiKeys.add(pipeline.apiKeyIndex);
    analysis.providers[pipeline.provider].priorities.push(pipeline.priority);
    
    analysis.priorities.push(pipeline.priority);
    
    if (pipeline.isSecurityEnhanced) {
      analysis.securityEnhanced++;
    } else {
      analysis.regularPipelines++;
    }
  });
  
  // 转换Set为Array
  Object.values(analysis.providers).forEach((provider: any) => {
    provider.categories = Array.from(provider.categories);
    provider.models = Array.from(provider.models);
    provider.apiKeys = Array.from(provider.apiKeys);
    provider.priorities.sort((a: number, b: number) => a - b);
  });
  
  analysis.priorities.sort((a, b) => a - b);
  
  return analysis;
}

/**
 * 分析多key支持
 */
function analyzeMultiKeySupport(routingTable: any): Record<string, any> {
  const multiKeyAnalysis: Record<string, any> = {
    providersWithMultiKeys: {},
    totalMultiKeyPipelines: 0,
    singleKeyProviders: 0,
    multiKeyProviders: 0
  };
  
  const providerKeys: Record<string, Set<number>> = {};
  
  routingTable.allPipelines.forEach((pipeline: any) => {
    if (!providerKeys[pipeline.provider]) {
      providerKeys[pipeline.provider] = new Set();
    }
    providerKeys[pipeline.provider].add(pipeline.apiKeyIndex);
  });
  
  Object.entries(providerKeys).forEach(([provider, keyIndexes]: [string, Set<number>]) => {
    const keyCount = keyIndexes.size;
    if (keyCount > 1) {
      multiKeyAnalysis.providersWithMultiKeys[provider] = {
        keyCount,
        keyIndexes: Array.from(keyIndexes).sort(),
        pipelinesPerKey: {}
      };
      multiKeyAnalysis.multiKeyProviders++;
      
      // 统计每个key的pipeline数量
      Array.from(keyIndexes).forEach(keyIndex => {
        const pipelinesForKey = routingTable.allPipelines.filter(
          (p: any) => p.provider === provider && p.apiKeyIndex === keyIndex
        );
        multiKeyAnalysis.providersWithMultiKeys[provider].pipelinesPerKey[`key${keyIndex}`] = pipelinesForKey.length;
        multiKeyAnalysis.totalMultiKeyPipelines += pipelinesForKey.length;
      });
    } else {
      multiKeyAnalysis.singleKeyProviders++;
    }
  });
  
  return multiKeyAnalysis;
}

/**
 * 分析security路由
 */
function analyzeSecurityRoutes(routingTable: any): Record<string, any> {
  const securityAnalysis: Record<string, any> = {
    totalSecurityPipelines: 0,
    categoriesWithSecurity: {},
    categoriesWithoutSecurity: [],
    securityProviders: new Set(),
    securityModels: new Set()
  };
  
  // 分析每个类别的security配置
  Object.entries(routingTable.pipelinesGroupedByVirtualModel).forEach(([category, pipelines]: [string, any[]]) => {
    const securityPipelines = pipelines.filter(p => p.isSecurityEnhanced);
    const regularPipelines = pipelines.filter(p => !p.isSecurityEnhanced);
    
    if (securityPipelines.length > 0) {
      securityAnalysis.categoriesWithSecurity[category] = {
        securityCount: securityPipelines.length,
        regularCount: regularPipelines.length,
        securityProviders: [...new Set(securityPipelines.map(p => p.provider))],
        securityModels: [...new Set(securityPipelines.map(p => p.targetModel))]
      };
      
      securityPipelines.forEach((pipeline: any) => {
        securityAnalysis.securityProviders.add(pipeline.provider);
        securityAnalysis.securityModels.add(pipeline.targetModel);
      });
      
      securityAnalysis.totalSecurityPipelines += securityPipelines.length;
    } else {
      securityAnalysis.categoriesWithoutSecurity.push(category);
    }
  });
  
  securityAnalysis.securityProviders = Array.from(securityAnalysis.securityProviders);
  securityAnalysis.securityModels = Array.from(securityAnalysis.securityModels);
  
  return securityAnalysis;
}

/**
 * 主测试函数
 */
async function main() {
  const result = await testPipelineExpansion();
  
  if (result.success) {
    console.log('✅ PipelineTableManager expansion test completed successfully');
    console.log('📊 Test summary:', JSON.stringify(result.summary, null, 2));
    process.exit(0);
  } else {
    console.error('❌ PipelineTableManager expansion test failed');
    console.error('🚨 Error:', result.error?.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}