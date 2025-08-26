/**
 * 固定流水线生成验证脚本
 * 
 * @author RCC v4.0
 */

import { readFileSync } from 'fs';
import { ConfigReader, MergedConfig } from './config/config-reader';
import { PipelineTableManager } from './pipeline/pipeline-table-manager';
import { secureLogger } from './utils/secure-logger';
import { JQJsonHandler } from './utils/jq-json-handler';
import { getServerPort, getServerHost } from './constants/server-defaults';
import { TIMEOUT_DEFAULTS } from './constants/timeout-defaults';
import { API_DEFAULTS } from './constants/api-defaults';

const CONFIG_PATH = '/Users/fanzhang/.route-claudecode/config/multi-provider-hybrid-v4.json';

async function testFixedPipelineGeneration(): Promise<void> {
  const requestId = `test-${Date.now()}`;
  
  secureLogger.info('🚀 固定流水线生成测试开始', { requestId });

  try {
    // 读取配置
    const rawConfig = readFileSync(CONFIG_PATH, 'utf-8');
    const userConfig = JQJsonHandler.parseJsonString(rawConfig);
    secureLogger.info('✅ 配置读取成功', { 
      requestId, 
      providers: userConfig.Providers?.length || 0 
    });

    // 创建合并配置
    const mergedConfig: MergedConfig = {
      providers: userConfig.Providers.map((p: any) => ({
        name: p.name,
        priority: p.priority || 1,
        api_base_url: p.api_base_url,
        api_key: p.api_key,
        models: p.models?.map((m: any) => typeof m === 'string' ? m : m.name) || [],
        protocol: p.protocol || 'openai',
        serverCompatibility: p.serverCompatibility
      })),
      router: userConfig.router || {},
      server: {
        port: getServerPort(),
        host: getServerHost(),
        debug: false
      },
      apiKey: 'test-api-key',
      blacklistSettings: {
        timeout429: 60000,
        timeoutError: 300000
      },
      systemConfig: {
        providerTypes: {},
        transformers: {},
        pipelineLayers: {},
        serverCompatibilityModules: {},
        connectionHandshake: {
          enabled: true,
          healthCheckInterval: 60000,
          validateApiKeys: true,
          timeoutMs: 5000
        }
      }
    };
    
    secureLogger.info('✅ 配置创建成功', { 
      requestId,
      providers: mergedConfig.providers?.length || 0,
      routerRules: Object.keys(mergedConfig.router || {}).length
    });

    // 创建Pipeline Table Manager
    const tableManager = new PipelineTableManager(mergedConfig);
    
    // 生成路由表
    const routingTable = await tableManager.getOrGenerateRoutingTable();
    secureLogger.info('✅ 路由表生成成功', {
      requestId,
      totalPipelines: routingTable.totalPipelines,
      categories: Object.keys(routingTable.pipelinesGroupedByVirtualModel)
    });

    // 打印详细信息
    Object.entries(routingTable.pipelinesGroupedByVirtualModel).forEach(([category, pipelines]) => {
      secureLogger.info(`📂 类别: ${category}`, {
        requestId,
        pipelineCount: pipelines.length,
        pipelines: pipelines.map((p: any) => `${p.provider}:${p.targetModel}`)
      });
    });

    // 生成固定管道执行器
    const executors = await tableManager.generateExecutablePipelines(routingTable);
    secureLogger.info('✅ 固定管道执行器生成成功', {
      requestId,
      executorCount: executors.length,
      successRate: `${executors.length}/${routingTable.totalPipelines}`
    });

    // 检查第一个执行器的组件
    if (executors.length > 0) {
      const sample = executors[0];
      secureLogger.info('🔍 示例执行器组件验证', {
        requestId,
        pipelineId: sample.pipelineId,
        components: {
          transformer: sample.components.transformer.type,
          protocol: sample.components.protocol.type,
          serverCompatibility: sample.components.serverCompatibility.type,
          server: sample.components.server.type
        }
      });
    }

    // 验证路由规则指向流水线 - 每个路由规则应该能找到对应的流水线
    const routerConfig = mergedConfig.router || {};
    let totalRouteRules = 0;
    let matchedRouteRules = 0;
    let totalCategories = 0;
    let matchedCategories = 0;
    
    // 构建流水线查找表：provider+model -> pipeline
    const pipelineLookup = new Map();
    routingTable.allPipelines.forEach((pipeline: any) => {
      const key = `${pipeline.provider}:${pipeline.targetModel}`;
      pipelineLookup.set(key, pipeline);
    });
    
    Object.entries(routerConfig).forEach(([virtualModel, routeEntry]) => {
      if (typeof routeEntry === 'string') {
        // 跳过注释行和空配置
        if (virtualModel.startsWith('//') || routeEntry.trim() === '') {
          secureLogger.info(`🎯 ${virtualModel} 路由验证`, {
            requestId,
            type: 'comment/empty',
            status: 'skipped'
          });
          return;
        }

        totalCategories++;
        const routes = routeEntry.split(';').map(r => r.trim());
        let categoryMatched = true;
        let routeResults: any[] = [];
        
        routes.forEach(route => {
          if (route.includes(',')) {
            totalRouteRules++;
            const [provider, model] = route.split(',').map(s => s.trim());
            const pipelineKey = `${provider}:${model}`;
            const foundPipeline = pipelineLookup.get(pipelineKey);
            
            if (foundPipeline) {
              matchedRouteRules++;
              routeResults.push({ rule: route, status: 'found', pipelineId: foundPipeline.pipelineId });
            } else {
              categoryMatched = false;
              routeResults.push({ rule: route, status: 'missing', pipelineKey });
            }
          }
        });
        
        if (categoryMatched) matchedCategories++;
        
        secureLogger.info(`🎯 ${virtualModel} 路由验证`, {
          requestId,
          routeRules: routes.length,
          matchedRules: routeResults.filter(r => r.status === 'found').length,
          categoryMatched,
          details: routeResults
        });
      }
    });

    secureLogger.info('🎉 测试完成', {
      requestId,
      status: 'success',
      totalPipelines: routingTable.totalPipelines,
      totalExecutors: executors.length,
      routeRuleValidation: `${matchedRouteRules}/${totalRouteRules} 路由规则匹配`,
      categoryValidation: `${matchedCategories}/${totalCategories} 路由类别完全匹配`
    });

  } catch (error) {
    secureLogger.error('❌ 测试失败', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testFixedPipelineGeneration().catch(error => {
    process.exit(1);
  });
}

export { testFixedPipelineGeneration };