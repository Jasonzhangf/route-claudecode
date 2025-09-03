/**
 * 路由器单元测试
 * 使用配置管理器的输出数据验证路由决策和流水线模块配置
 */

import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 加载统一配置
const configManager = new UnifiedConfigManager();
const configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');

// 异步函数执行
async function runRouterUnitTest() {
  const config = await configManager.loadConfiguration(configPath);
  
  // 生成详细的路由决策和流水线配置
  const routerTestResults = generateDetailedRoutingConfiguration(config);
  
  // 保存测试结果
  fs.writeFileSync(
    path.join(outputDir, 'router-unit-test-results.json'),
    JSON.stringify(routerTestResults, null, 2)
  );
  
  // 生成摘要报告
  generateTestSummary(routerTestResults);
}

/**
 * 生成详细的路由决策和流水线模块配置
 */
function generateDetailedRoutingConfiguration(config: any): any {
  const timestamp = new Date().toISOString();
  
  // 路由决策表
  const routingTable: any = {};
  
  // 流水线配置
  const pipelineConfigs: any[] = [];
  
  // 模块实例配置
  const moduleInstances: any = {};
  
  // 遍历所有路由规则
  for (const [category, rule] of Object.entries(config.router.routingRules.modelMapping)) {
    const ruleStr = rule as string;
    const pairs = ruleStr.split(';');
    
    // 为每个类别创建路由映射
    routingTable[category] = {
      inputCategory: category,
      providers: []
    };
    
    // 处理每个提供商-模型对
    for (const pair of pairs) {
      const [providerName, model] = pair.split(',');
      if (providerName && model) {
        const providerConfig = config.provider.providers.find((p: any) => p.name === providerName);
        if (providerConfig) {
          // 获取API密钥数量
          let apiKeys: string[] = [];
          if (Array.isArray(providerConfig.api_key)) {
            apiKeys = providerConfig.api_key;
          } else if (providerConfig.api_key) {
            apiKeys = [providerConfig.api_key];
          } else if (Array.isArray(providerConfig.apiKey)) {
            apiKeys = providerConfig.apiKey;
          } else if (providerConfig.apiKey) {
            apiKeys = [providerConfig.apiKey];
          }
          
          // 为每个API密钥创建一个流水线实例
          for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
            const pipelineId = `${providerName}-${model}-key${keyIndex}`;
            
            // 添加到路由表
            routingTable[category].providers.push({
              provider: providerName,
              model: model,
              pipelineId: pipelineId,
              apiKeyIndex: keyIndex
            });
            
            // 创建详细的流水线配置
            const pipelineConfig = createPipelineConfiguration(
              pipelineId,
              providerName,
              model,
              providerConfig,
              keyIndex,
              config
            );
            
            pipelineConfigs.push(pipelineConfig);
            
            // 创建模块实例配置
            const modules = createModuleInstances(
              pipelineId,
              providerName,
              model,
              providerConfig,
              keyIndex
            );
            
            moduleInstances[pipelineId] = modules;
          }
        }
      }
    }
  }
  
  return {
    timestamp,
    testType: 'router-unit-test',
    input: {
      providerCount: config.provider.providers.length,
      routingRuleCount: Object.keys(config.router.routingRules.modelMapping).length
    },
    output: {
      routingTable,
      pipelineConfigs,
      moduleInstances
    },
    summary: {
      totalPipelines: pipelineConfigs.length,
      totalCategories: Object.keys(routingTable).length
    }
  };
}

/**
 * 创建流水线配置
 */
function createPipelineConfiguration(
  pipelineId: string,
  providerName: string,
  model: string,
  providerConfig: any,
  keyIndex: number,
  config: any
): any {
  return {
    pipelineId,
    provider: providerName,
    model: model,
    apiKeyIndex: keyIndex,
    modules: {
      // 客户端模块配置
      client: {
        type: 'ClientModule',
        config: {
          protocol: 'anthropic'
        }
      },
      // 路由器模块配置
      router: {
        type: 'RouterModule',
        config: {
          provider: providerName,
          model: model
        }
      },
      // 转换器模块配置
      transformer: {
        type: 'TransformerModule',
        config: {
          inputProtocol: 'anthropic',
          outputProtocol: 'openai'
        }
      },
      // 协议模块配置
      protocol: {
        type: 'ProtocolModule',
        config: {
          protocol: 'openai',
          model: model
        }
      },
      // 服务器兼容性模块配置
      serverCompatibility: {
        type: getServerCompatibilityType(providerName),
        config: getServerCompatibilityConfig(providerName, providerConfig)
      },
      // 服务器模块配置
      server: {
        type: 'ServerModule',
        config: {
          baseUrl: getApiKeyBaseUrl(providerConfig, keyIndex),
          apiKey: getApiKey(providerConfig, keyIndex),
          protocol: 'openai'
        }
      },
      // 响应转换器模块配置
      responseTransformer: {
        type: 'ResponseTransformerModule',
        config: {
          inputProtocol: 'openai',
          outputProtocol: 'anthropic'
        }
      }
    }
  };
}

/**
 * 创建模块实例配置
 */
function createModuleInstances(
  pipelineId: string,
  providerName: string,
  model: string,
  providerConfig: any,
  keyIndex: number
): any {
  return {
    pipelineId,
    modules: [
      {
        id: `${pipelineId}-client`,
        type: 'ClientModule',
        implementation: 'AnthropicClient',
        inputs: ['anthropicRequest'],
        outputs: ['routedRequest']
      },
      {
        id: `${pipelineId}-router`,
        type: 'RouterModule',
        implementation: 'ModelRouter',
        inputs: ['routedRequest'],
        outputs: ['transformerInput'],
        config: {
          provider: providerName,
          model: model
        }
      },
      {
        id: `${pipelineId}-transformer`,
        type: 'TransformerModule',
        implementation: 'AnthropicToOpenAIConverter',
        inputs: ['transformerInput'],
        outputs: ['protocolInput'],
        config: {
          inputProtocol: 'anthropic',
          outputProtocol: 'openai'
        }
      },
      {
        id: `${pipelineId}-protocol`,
        type: 'ProtocolModule',
        implementation: 'OpenAIProtocolHandler',
        inputs: ['protocolInput'],
        outputs: ['compatibilityInput'],
        config: {
          protocol: 'openai',
          model: model
        }
      },
      {
        id: `${pipelineId}-serverCompatibility`,
        type: 'ServerCompatibilityModule',
        implementation: getServerCompatibilityType(providerName),
        inputs: ['compatibilityInput'],
        outputs: ['serverInput'],
        config: getServerCompatibilityConfig(providerName, providerConfig)
      },
      {
        id: `${pipelineId}-server`,
        type: 'ServerModule',
        implementation: 'HTTPAPIClient',
        inputs: ['serverInput'],
        outputs: ['rawResponse'],
        config: {
          baseUrl: getApiKeyBaseUrl(providerConfig, keyIndex),
          apiKey: getApiKey(providerConfig, keyIndex),
          protocol: 'openai'
        }
      },
      {
        id: `${pipelineId}-responseTransformer`,
        type: 'ResponseTransformerModule',
        implementation: 'OpenAIToAnthropicConverter',
        inputs: ['rawResponse'],
        outputs: ['anthropicResponse'],
        config: {
          inputProtocol: 'openai',
          outputProtocol: 'anthropic'
        }
      }
    ]
  };
}

/**
 * 获取服务器兼容性模块类型
 */
function getServerCompatibilityType(providerName: string): string {
  const compatibilityMap: { [key: string]: string } = {
    'qwen': 'QwenServerCompatibility',
    'iflow': 'IFlowServerCompatibility',
    'lmstudio': 'LMStudioServerCompatibility'
  };
  
  return compatibilityMap[providerName] || 'PassthroughServerCompatibility';
}

/**
 * 获取服务器兼容性配置
 */
function getServerCompatibilityConfig(providerName: string, providerConfig: any): any {
  if (providerConfig.serverCompatibility) {
    return providerConfig.serverCompatibility;
  }
  
  // 默认配置
  return {
    use: providerName,
    strictValidation: true
  };
}

/**
 * 获取API密钥
 */
function getApiKey(providerConfig: any, keyIndex: number): string {
  if (Array.isArray(providerConfig.api_key)) {
    return providerConfig.api_key[keyIndex] || providerConfig.api_key[0];
  } else if (providerConfig.api_key) {
    return providerConfig.api_key;
  } else if (Array.isArray(providerConfig.apiKey)) {
    return providerConfig.apiKey[keyIndex] || providerConfig.apiKey[0];
  } else if (providerConfig.apiKey) {
    return providerConfig.apiKey;
  }
  
  return '';
}

/**
 * 获取API基础URL
 */
function getApiKeyBaseUrl(providerConfig: any, keyIndex: number): string {
  // 如果有多个API密钥配置，可能有不同的基础URL
  if (providerConfig.api_base_urls && Array.isArray(providerConfig.api_base_urls)) {
    return providerConfig.api_base_urls[keyIndex] || providerConfig.api_base_urls[0];
  }
  
  // 默认使用提供商的基础URL
  return providerConfig.api_base_url || providerConfig.baseURL || providerConfig.apiBaseUrl || '';
}

/**
 * 生成测试摘要
 */
function generateTestSummary(testResults: any) {
  const summary = `
路由器单元测试报告
==================

测试时间: ${testResults.timestamp}
输入数据:
  - 提供商数量: ${testResults.input.providerCount}
  - 路由规则数: ${testResults.input.routingRuleCount}

输出结果:
  - 流水线总数: ${testResults.summary.totalPipelines}
  - 路由类别数: ${testResults.summary.totalCategories}

详细结果已保存到: router-unit-test-results.json
  `;
  
  fs.writeFileSync(
    path.join(outputDir, 'router-unit-test-summary.txt'),
    summary.trim()
  );
}

// 执行路由器单元测试
runRouterUnitTest();