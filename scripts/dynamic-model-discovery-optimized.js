#!/usr/bin/env node

/**
 * Optimized Dynamic Model Discovery and Configuration Update System
 * 优化版动态模型发现和配置更新系统
 * 
 * 功能:
 * 1. 对所有provider进行动态模型发现
 * 2. 测试模型可用性（优化版）
 * 3. 更新单供应商配置文件
 * 4. 生成全混合负载均衡配置
 * 5. 生成OpenAI全混合配置
 */

const fs = require('fs');
const path = require('path');

// 导入智能模型发现系统
const {
  smartModelDiscovery,
  testModelAvailability,
  makeRequest,
  EnhancedLogger
} = require('../scripts/smart-model-discovery');

// 配置文件路径
const CONFIG_PATHS = {
  singleProvider: '/Users/fanzhang/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json',
  multiProvider: '/Users/fanzhang/.route-claude-code/config/load-balancing/config-multi-openai-full.json',
  outputDir: '/Users/fanzhang/.route-claude-code/config/dynamic'
};

// 测试超时和并发设置（优化版）
const TEST_TIMEOUT = 15000;
const CONCURRENT_LIMIT = 5; // 增加并发限制
const MAX_MODELS_PER_PROVIDER = 20; // 限制每个provider测试的模型数量

/**
 * 测试单个模型的可用性
 */
async function testModelAvailabilityWithTimeout(endpoint, model, apiKey = null, timeout = TEST_TIMEOUT) {
  const testPayload = {
    model: model,
    messages: [{ role: 'user', content: 'What is 2+2? Answer with just the number.' }],
    max_tokens: 10,
    temperature: 0.1
  };

  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await makeRequest(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testPayload)
    });

    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(response.data);
        const answer = jsonResponse.choices?.[0]?.message?.content || '';
        
        // 验证回答是否正确
        const isCorrect = answer.trim() === '4' || answer.includes('4');
        
        return {
          available: true,
          status: response.status,
          model: model,
          working: isCorrect,
          answer: answer.trim(),
          usage: jsonResponse.usage || null,
          responseModel: jsonResponse.model || model
        };
      } catch (parseError) {
        return {
          available: false,
          status: response.status,
          model: model,
          error: 'Failed to parse JSON response',
          working: false
        };
      }
    } else if (response.status === 400 || response.status === 404) {
      // 模型不存在或不支持
      return {
        available: false,
        status: response.status,
        model: model,
        error: 'Model not available or not supported',
        working: false
      };
    } else if (response.status === 401) {
      // 认证失败
      return {
        available: false,
        status: response.status,
        model: model,
        error: 'Authentication failed',
        working: false
      };
    } else if (response.status === 429) {
      // 速率限制 - 认为模型存在但暂时不可用
      return {
        available: true,
        status: response.status,
        model: model,
        working: false,
        note: 'Rate limited, but model exists',
        answer: ''
      };
    } else {
      // 其他错误
      return {
        available: false,
        status: response.status,
        model: model,
        error: `HTTP ${response.status}: ${response.data.substring(0, 100)}`,
        working: false
      };
    }
  } catch (error) {
    return {
      available: false,
      status: 'CONNECTION_ERROR',
      model: model,
      error: error.message,
      working: false
    };
  }
}

/**
 * 并发测试多个模型的可用性
 */
async function testModelsConcurrently(endpoint, models, apiKey = null, concurrentLimit = CONCURRENT_LIMIT) {
  const results = [];
  
  EnhancedLogger.info(`Testing ${models.length} models concurrently`, {
    endpoint,
    concurrentLimit
  });
  
  // 分批并发测试
  for (let i = 0; i < models.length; i += concurrentLimit) {
    const batch = models.slice(i, i + concurrentLimit);
    const batchPromises = batch.map(model => 
      testModelAvailabilityWithTimeout(endpoint, model, apiKey)
    );
    
    EnhancedLogger.debug(`Testing batch ${Math.floor(i/concurrentLimit) + 1}`, {
      models: batch,
      batchSize: batch.length
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          available: false,
          status: 'TEST_ERROR',
          model: batch[index],
          error: result.reason.message,
          working: false
        });
      }
    });
    
    // 批次间延迟，避免触发速率限制
    if (i + concurrentLimit < models.length) {
      EnhancedLogger.debug(`Delay between batches`, { delayMs: 1000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * 分析模型测试结果
 */
function analyzeTestResults(testResults) {
  const availableModels = testResults.filter(r => r.available).map(r => r.model);
  const workingModels = testResults.filter(r => r.available && r.working).map(r => r.model);
  const availableButNotWorking = testResults.filter(r => r.available && !r.working);
  const unavailableModels = testResults.filter(r => !r.available);
  
  const analysis = {
    totalTested: testResults.length,
    available: availableModels.length,
    working: workingModels.length,
    unavailable: unavailableModels.length,
    availableButNotWorking: availableButNotWorking.length,
    successRate: workingModels.length / testResults.length,
    availableModels,
    workingModels,
    unavailableModels: unavailableModels.map(r => ({
      model: r.model,
      error: r.error,
      status: r.status
    })),
    availableButNotWorkingDetails: availableButNotWorking.map(r => ({
      model: r.model,
      status: r.status,
      note: r.note,
      answer: r.answer
    }))
  };
  
  return analysis;
}

/**
 * 生成推荐默认模型
 */
function getRecommendedDefaultModel(workingModels, availableModels) {
  // 优先选择工作模型的推荐顺序
  const preferredOrder = [
    'gpt-4o-mini',
    'gpt-4o', 
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'qwen3-coder',
    'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    'ZhipuAI/GLM-4.5',
    'claude-4-sonnet',
    'glm-4.5'
  ];
  
  // 首先从工作模型中选择
  for (const model of preferredOrder) {
    if (workingModels.includes(model)) {
      return model;
    }
  }
  
  // 如果没有工作模型，从可用模型中选择
  for (const model of preferredOrder) {
    if (availableModels.includes(model)) {
      return model;
    }
  }
  
  // 最后返回第一个可用或工作模型
  return workingModels[0] || availableModels[0];
}

/**
 * 生成maxTokens配置
 */
function generateMaxTokensConfig(models) {
  const maxTokens = {};
  
  models.forEach(model => {
    // 根据模型类型设置默认maxTokens
    if (model.includes('claude') && model.includes('opus')) {
      maxTokens[model] = 200000;
    } else if (model.includes('claude') || model.includes('sonnet')) {
      maxTokens[model] = 200000;
    } else if (model.includes('gemini')) {
      maxTokens[model] = 131072;
    } else if (model.includes('glm')) {
      maxTokens[model] = 128000;
    } else if (model.includes('qwen') || model.includes('Qwen')) {
      maxTokens[model] = 262144;
    } else {
      maxTokens[model] = 131072;
    }
  });
  
  return maxTokens;
}

/**
 * 更新单供应商配置文件
 */
async function updateSingleProviderConfig(providerConfig, testAnalysis) {
  const { workingModels, availableModels } = testAnalysis;
  
  // 使用工作模型，如果没有工作模型则使用可用模型
  const modelsToUse = workingModels.length > 0 ? workingModels : availableModels;
  
  if (modelsToUse.length === 0) {
    EnhancedLogger.warn('No available models found, skipping config update');
    return null;
  }
  
  // 生成更新的配置
  const updatedConfig = {
    ...providerConfig,
    models: modelsToUse,
    defaultModel: getRecommendedDefaultModel(workingModels, availableModels),
    maxTokens: generateMaxTokensConfig(modelsToUse)
  };
  
  return updatedConfig;
}

/**
 * 生成负载均衡配置
 */
function generateLoadBalancingConfig(testResultsByProvider, originalConfig) {
  const providers = [];
  let totalWeight = 0;
  
  for (const [providerId, testResults] of Object.entries(testResultsByProvider)) {
    const analysis = analyzeTestResults(testResults);
    const { workingModels, availableModels } = analysis;
    
    if (workingModels.length === 0 && availableModels.length === 0) {
      EnhancedLogger.warn(`Skipping ${providerId} - no available models`);
      continue;
    }
    
    // 排除LMStudio（按用户要求）
    if (providerId.includes('lmstudio')) {
      EnhancedLogger.info(`Excluding ${providerId} from load balancing config`);
      continue;
    }
    
    const modelsToUse = workingModels.length > 0 ? workingModels : availableModels;
    const weight = modelsToUse.length; // 基于可用模型数量分配权重
    
    totalWeight += weight;
    
    providers.push({
      provider: providerId,
      models: modelsToUse,
      weight: weight,
      defaultModel: getRecommendedDefaultModel(workingModels, availableModels)
    });
  }
  
  // 生成配置
  const loadBalancingConfig = {
    name: 'Dynamic Load Balancing Configuration',
    description: `Auto-generated load balancing config with ${providers.length} providers`,
    server: {
      port: 6690,
      host: '0.0.0.0'
    },
    providers: {},
    routing: {
      default: {
        providers: providers.map(p => ({
          provider: p.provider,
          model: p.defaultModel,
          weight: p.weight
        })),
        loadBalancing: {
          enabled: true,
          strategy: 'health_based'
        },
        failover: {
          enabled: true,
          triggers: [
            {
              type: 'http_status',
              codes: [429, 500, 502, 503, 504],
              blacklistDuration: 300
            }
          ]
        }
      }
    },
    loadBalancing: {
      enabled: true,
      strategy: 'health_based_with_blacklist'
    },
    failover: {
      enabled: true,
      triggers: [
        {
          type: 'http_status',
          codes: [429, 500, 502, 503, 504],
          blacklistDuration: 300
        }
      ]
    },
    debug: {
      enabled: true,
      logLevel: 'info',
      traceRequests: true,
      saveRequests: false,
      logDir: '/Users/fanzhang/.route-claude-code/logs'
    },
    hooks: []
  };
  
  // 填充providers配置
  for (const provider of providers) {
    // 从原始配置中复制provider的详细信息
    const originalProviderConfig = originalConfig.providers[provider.provider];
    if (originalProviderConfig) {
      loadBalancingConfig.providers[provider.provider] = {
        ...originalProviderConfig,
        models: provider.models,
        defaultModel: provider.defaultModel,
        maxTokens: generateMaxTokensConfig(provider.models)
      };
    }
  }
  
  return loadBalancingConfig;
}

/**
 * 生成OpenAI全混合配置
 */
function generateOpenAIMixedConfig(testResultsByProvider, originalConfig) {
  const allOpenAIModels = new Set();
  const openAIProviders = [];
  
  // 收集所有OpenAI类型的可用模型
  for (const [providerId, testResults] of Object.entries(testResultsByProvider)) {
    const analysis = analyzeTestResults(testResults);
    const { workingModels, availableModels } = analysis;
    
    // 只包含OpenAI类型的provider（排除gemini、anthropic等）
    // 这里我们假设除了google-gemini之外的都是OpenAI兼容的
    if (providerId.includes('gemini')) {
      continue;
    }
    
    // 排除LMStudio
    if (providerId.includes('lmstudio')) {
      continue;
    }
    
    const modelsToUse = workingModels.length > 0 ? workingModels : availableModels;
    
    if (modelsToUse.length > 0) {
      modelsToUse.forEach(model => allOpenAIModels.add(model));
      
      openAIProviders.push({
        provider: providerId,
        models: modelsToUse,
        defaultModel: getRecommendedDefaultModel(workingModels, availableModels)
      });
    }
  }
  
  if (allOpenAIModels.size === 0) {
    EnhancedLogger.warn('No OpenAI models found, skipping OpenAI mixed config generation');
    return null;
  }
  
  const modelsList = Array.from(allOpenAIModels);
  
  // 生成配置 - 使用ShuaiHong作为主要provider
  const shuaihongConfig = originalConfig.providers['shuaihong-openai'];
  
  const openAIMixedConfig = {
    name: 'OpenAI Mixed Configuration',
    description: `Auto-generated OpenAI mixed config with ${modelsList.length} models from ${openAIProviders.length} providers`,
    server: {
      port: 6691,
      host: '0.0.0.0'
    },
    providers: {
      'openai-mixed': {
        ...shuaihongConfig,
        models: modelsList,
        defaultModel: getRecommendedDefaultModel([], modelsList),
        maxTokens: generateMaxTokensConfig(modelsList)
      }
    },
    routing: {
      default: {
        provider: 'openai-mixed',
        model: getRecommendedDefaultModel([], modelsList)
      },
      background: {
        provider: 'openai-mixed',
        model: getRecommendedDefaultModel([], modelsList)
      },
      thinking: {
        provider: 'openai-mixed',
        model: getRecommendedDefaultModel([], modelsList)
      },
      longcontext: {
        provider: 'openai-mixed',
        model: getRecommendedDefaultModel([], modelsList)
      },
      search: {
        provider: 'openai-mixed',
        model: getRecommendedDefaultModel([], modelsList)
      }
    },
    loadBalancing: {
      enabled: false // 单一provider，不需要负载均衡
    },
    failover: {
      enabled: false // 单一provider，不需要failover
    },
    debug: {
      enabled: true,
      logLevel: 'info',
      traceRequests: true,
      saveRequests: false,
      logDir: '/Users/fanzhang/.route-claude-code/logs'
    },
    hooks: []
  };
  
  return openAIMixedConfig;
}

/**
 * 备份配置文件
 */
async function backupConfigFile(configPath) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(configPath), 'backups');
    const backupFilename = `${path.basename(configPath, '.json')}.backup.${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);
    
    // 创建备份目录
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 复制配置文件
    fs.copyFileSync(configPath, backupPath);
    
    EnhancedLogger.success('Config file backed up', {
      originalPath: configPath,
      backupPath: backupPath,
      timestamp: new Date().toISOString()
    });
    
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to backup config file ${configPath}: ${error.message}`);
  }
}

/**
 * 保存配置文件
 */
async function saveConfigFile(configPath, config, description) {
  try {
    // 创建输出目录
    const outputDir = path.dirname(configPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 备份现有文件
    let backupPath = null;
    if (fs.existsSync(configPath)) {
      backupPath = await backupConfigFile(configPath);
    }
    
    // 写入新配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    EnhancedLogger.success('Config file saved', {
      configPath,
      description,
      backupPath,
      timestamp: new Date().toISOString()
    });
    
    return {
      configPath,
      backupPath,
      description
    };
  } catch (error) {
    throw new Error(`Failed to save config file ${configPath}: ${error.message}`);
  }
}

/**
 * 智能选择要测试的模型（限制数量并优先选择重要模型）
 */
function selectModelsForTesting(discoveredModels, maxModels = MAX_MODELS_PER_PROVIDER) {
  // 优先级排序的模型列表
  const priorityModels = [
    'gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-4-turbo',
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
    'qwen3-coder', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct',
    'ZhipuAI/GLM-4.5', 'glm-4.5',
    'claude-4-sonnet', 'claude-3-5-sonnet-20241022',
    'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct'
  ];
  
  // 按优先级排序
  const sortedModels = [...discoveredModels].sort((a, b) => {
    const aPriority = priorityModels.indexOf(a);
    const bPriority = priorityModels.indexOf(b);
    
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    
    return a.localeCompare(b);
  });
  
  // 返回限制数量内的模型
  return sortedModels.slice(0, maxModels);
}

/**
 * 主函数
 */
async function main() {
  const startTime = new Date();
  EnhancedLogger.success('Optimized Dynamic Model Discovery and Configuration Update System Start');
  EnhancedLogger.info('System Features', {
    features: [
      'Dynamic model discovery for all providers',
      'Comprehensive model availability testing (optimized)',
      'Automatic single provider config updates',
      'Load balancing config generation',
      'OpenAI mixed config generation',
      'Limited models per provider for faster execution'
    ]
  });
  
  try {
    // 步骤1: 加载现有配置文件
    EnhancedLogger.info('Loading existing configuration files');
    
    const multiProviderConfig = JSON.parse(fs.readFileSync(CONFIG_PATHS.multiProvider, 'utf8'));
    const singleProviderConfig = JSON.parse(fs.readFileSync(CONFIG_PATHS.singleProvider, 'utf8'));
    
    EnhancedLogger.info('Configuration files loaded', {
      multiProvider: Object.keys(multiProviderConfig.providers || {}).length + ' providers',
      singleProvider: Object.keys(singleProviderConfig.providers || {}).length + ' providers'
    });
    
    // 步骤2: 对所有provider进行动态模型发现和测试
    EnhancedLogger.info('Starting dynamic model discovery and testing for all providers');
    
    const testResultsByProvider = {};
    
    for (const [providerId, providerConfig] of Object.entries(multiProviderConfig.providers)) {
      try {
        EnhancedLogger.info(`Processing provider: ${providerId}`);
        
        // 2.1 动态模型发现
        EnhancedLogger.info(`Discovering models for ${providerId}`);
        const discoveryResult = await smartModelDiscovery(providerConfig, providerId);
        
        if (discoveryResult.models.length === 0) {
          EnhancedLogger.warn(`No models discovered for ${providerId}, skipping`);
          continue;
        }
        
        EnhancedLogger.success(`Models discovered for ${providerId}`, {
          totalModels: discoveryResult.models.length,
          sources: discoveryResult.totalSources
        });
        
        // 2.2 智能选择要测试的模型
        const modelsToTest = selectModelsForTesting(discoveryResult.models, MAX_MODELS_PER_PROVIDER);
        
        EnhancedLogger.info(`Selected ${modelsToTest.length} models for testing (out of ${discoveryResult.models.length} discovered)`);
        
        // 2.3 测试模型可用性
        EnhancedLogger.info(`Testing model availability for ${providerId}`);
        const testResults = await testModelsConcurrently(
          providerConfig.endpoint,
          modelsToTest,
          providerConfig.authentication?.credentials?.apiKey?.[0] || null
        );
        
        // 2.4 分析测试结果
        const analysis = analyzeTestResults(testResults);
        
        EnhancedLogger.success(`Model testing completed for ${providerId}`, {
          analysis: {
            totalTested: analysis.totalTested,
            available: analysis.available,
            working: analysis.working,
            successRate: (analysis.successRate * 100).toFixed(1) + '%'
          }
        });
        
        // 显示详细信息
        if (analysis.workingModels.length > 0) {
          EnhancedLogger.info(`Working models for ${providerId}`, {
            workingModels: analysis.workingModels
          });
        }
        
        if (analysis.availableButNotWorkingDetails.length > 0) {
          EnhancedLogger.warn(`Available but not working models for ${providerId}`, {
            models: analysis.availableButNotWorkingDetails
          });
        }
        
        if (analysis.unavailableModels.length > 0) {
          EnhancedLogger.warn(`Unavailable models for ${providerId}`, {
            unavailableModels: analysis.unavailableModels.slice(0, 5)
          });
        }
        
        testResultsByProvider[providerId] = testResults;
        
      } catch (error) {
        EnhancedLogger.error(`Failed to process provider ${providerId}`, { error: error.message });
      }
    }
    
    // 步骤3: 更新单供应商配置文件
    EnhancedLogger.info('Updating single provider configuration');
    
    // 优先使用ShuaiHong的测试结果
    const shuaihongTestResults = testResultsByProvider['shuaihong-openai'];
    let singleProviderUpdateResult = null;
    
    if (shuaihongTestResults) {
      const shuaihongAnalysis = analyzeTestResults(shuaihongTestResults);
      const updatedConfig = await updateSingleProviderConfig(singleProviderConfig.providers['shuaihong-openai'], shuaihongAnalysis);
      
      if (updatedConfig) {
        // 更新配置
        const configToUpdate = {
          ...singleProviderConfig,
          providers: {
            ...singleProviderConfig.providers,
            'shuaihong-openai': updatedConfig
          }
        };
        
        singleProviderUpdateResult = await saveConfigFile(
          CONFIG_PATHS.singleProvider,
          configToUpdate,
          'Updated single provider config with tested ShuaiHong models'
        );
      }
    }
    
    // 步骤4: 生成负载均衡配置
    EnhancedLogger.info('Generating load balancing configuration');
    
    const loadBalancingConfig = generateLoadBalancingConfig(testResultsByProvider, multiProviderConfig);
    
    if (loadBalancingConfig && Object.keys(loadBalancingConfig.providers).length > 0) {
      const loadBalancingPath = path.join(CONFIG_PATHS.outputDir, 'config-load-balancing-dynamic.json');
      const loadBalancingResult = await saveConfigFile(
        loadBalancingPath,
        loadBalancingConfig,
        'Generated load balancing config with tested models (excluding LMStudio)'
      );
    }
    
    // 步骤5: 生成OpenAI全混合配置
    EnhancedLogger.info('Generating OpenAI mixed configuration');
    
    const openAIMixedConfig = generateOpenAIMixedConfig(testResultsByProvider, multiProviderConfig);
    
    if (openAIMixedConfig && Object.keys(openAIMixedConfig.providers).length > 0) {
      const openAIMixedPath = path.join(CONFIG_PATHS.outputDir, 'config-openai-mixed-dynamic.json');
      const openAIMixedResult = await saveConfigFile(
        openAIMixedPath,
        openAIMixedConfig,
        'Generated OpenAI mixed config with all tested OpenAI models'
      );
    }
    
    // 步骤6: 生成总结报告
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    
    EnhancedLogger.success('Optimized dynamic model discovery and configuration update completed!', {
      executionTime: `${executionTime.toFixed(2)}s`,
      providersProcessed: Object.keys(testResultsByProvider).length,
      configsGenerated: [
        singleProviderUpdateResult ? 'Single provider config' : null,
        loadBalancingConfig ? 'Load balancing config' : null,
        openAIMixedConfig ? 'OpenAI mixed config' : null
      ].filter(Boolean)
    });
    
    EnhancedLogger.info('Generated configuration files', {
      outputDir: CONFIG_PATHS.outputDir,
      files: [
        singleProviderUpdateResult ? 'config-openai-shuaihong-5508.json (updated)' : null,
        loadBalancingConfig ? 'config-load-balancing-dynamic.json' : null,
        openAIMixedConfig ? 'config-openai-mixed-dynamic.json' : null
      ].filter(Boolean)
    });
    
    EnhancedLogger.info('Next steps', {
      recommendations: [
        'Review generated configuration files',
        'Test the updated configurations',
        'Restart router services with new configs',
        'Monitor model availability in production'
      ]
    });
    
  } catch (error) {
    EnhancedLogger.error('Optimized dynamic model discovery system failed', { error: error.message });
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    EnhancedLogger.error('Optimized dynamic model discovery system failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = {
  main,
  testModelAvailabilityWithTimeout,
  testModelsConcurrently,
  analyzeTestResults,
  updateSingleProviderConfig,
  generateLoadBalancingConfig,
  generateOpenAIMixedConfig,
  saveConfigFile,
  selectModelsForTesting
};