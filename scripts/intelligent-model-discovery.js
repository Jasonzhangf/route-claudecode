#!/usr/bin/env node

/**
 * 智能模型发现CLI工具
 * 使用/models端点获取模型列表，多次测试避免流控，智能更新配置
 */

const fs = require('fs').promises;
const path = require('path');

// 模拟TypeScript的智能发现逻辑
class IntelligentModelDiscovery {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  async discoverAndUpdateModels() {
    const startTime = Date.now();
    const report = {
      providerId: this.config.providerId,
      discoveryTime: startTime,
      totalModelsFound: 0,
      modelsFromAPI: 0,
      modelsFromFallback: 0,
      availableModels: [],
      unavailableModels: [],
      configurationUpdated: false,
      recommendations: [],
      warnings: [],
      errors: [],
      performance: {
        totalDuration: 0,
        apiCallDuration: 0,
        testingDuration: 0,
        averageResponseTime: 0
      }
    };

    try {
      console.log(`🔍 Starting intelligent model discovery for ${this.config.providerId}...`);

      // 1. 获取模型列表
      const apiStartTime = Date.now();
      const models = await this.fetchModelsFromAPI();
      report.performance.apiCallDuration = Date.now() - apiStartTime;
      
      if (models.length === 0) {
        report.warnings.push('No models found from API, using fallback models');
        const fallbackModels = this.getFallbackModels();
        models.push(...fallbackModels);
        report.modelsFromFallback = fallbackModels.length;
      } else {
        report.modelsFromAPI = models.length;
      }

      report.totalModelsFound = models.length;
      console.log(`📋 Found ${models.length} models from API`);

      // 2. 智能模型测试
      const testStartTime = Date.now();
      const testResults = await this.intelligentModelTesting(models);
      report.performance.testingDuration = Date.now() - testStartTime;

      // 3. 分析测试结果
      const { available, unavailable } = this.analyzeTestResults(testResults);
      report.availableModels = available;
      report.unavailableModels = unavailable;

      console.log(`✅ Available models: ${available.length}`);
      console.log(`❌ Unavailable models: ${unavailable.length}`);

      // 4. 计算性能指标
      const allResponseTimes = [...available, ...unavailable]
        .filter(r => r.responseTime > 0)
        .map(r => r.responseTime);
      
      report.performance.averageResponseTime = allResponseTimes.length > 0
        ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
        : 0;

      // 5. 生成建议和警告
      this.generateRecommendations(report);

      // 6. 更新配置（如果有可用模型）
      if (available.length > 0) {
        const updateSuccess = await this.updateProviderConfiguration(available);
        report.configurationUpdated = updateSuccess;
        
        if (updateSuccess) {
          report.recommendations.push(`Configuration updated with ${available.length} available models`);
        } else {
          report.warnings.push('Failed to update configuration file');
        }
      } else {
        report.warnings.push('No available models found, configuration not updated');
      }

      report.performance.totalDuration = Date.now() - startTime;

      return report;

    } catch (error) {
      const errorMessage = `Discovery failed: ${error.message}`;
      report.errors.push(errorMessage);
      report.performance.totalDuration = Date.now() - startTime;
      return report;
    }
  }

  async fetchModelsFromAPI() {
    const modelsEndpoint = this.buildModelsEndpoint();
    const headers = this.buildAuthHeaders();

    try {
      console.log(`🌐 Fetching models from: ${modelsEndpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.testConfig.requestTimeout);

      const response = await fetch(modelsEndpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = this.parseModelsResponse(data);

      console.log(`📊 Parsed ${models.length} models from API response`);
      return models;

    } catch (error) {
      console.log(`⚠️  Failed to fetch models from API: ${error.message}`);
      throw error;
    }
  }

  async intelligentModelTesting(models) {
    const results = [];
    const { maxConcurrentTests, testCount, rateLimitBackoff } = this.config.testConfig;

    // 按优先级排序模型
    const prioritizedModels = this.prioritizeModels(models);
    
    console.log(`🧪 Starting intelligent testing of ${models.length} models...`);
    console.log(`📋 Test configuration: ${testCount} tests per model, max ${maxConcurrentTests} concurrent`);

    // 分批测试，控制并发
    for (let i = 0; i < prioritizedModels.length; i += maxConcurrentTests) {
      const batch = prioritizedModels.slice(i, i + maxConcurrentTests);
      
      console.log(`\n📦 Testing batch ${Math.floor(i / maxConcurrentTests) + 1}: ${batch.map(m => m.id).join(', ')}`);

      // 并发测试当前批次
      const batchPromises = batch.map(model => 
        this.testModelWithRetryLogic(model, testCount)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理批次结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          const testResult = result.value;
          const status = testResult.isAvailable ? '✅' : '❌';
          const confidence = testResult.confidence.toUpperCase();
          console.log(`  ${status} ${batch[index].id}: ${(testResult.successRate * 100).toFixed(0)}% success, ${testResult.responseTime}ms avg, ${confidence} confidence`);
        } else {
          results.push({
            modelId: batch[index].id,
            isAvailable: false,
            responseTime: 0,
            successRate: 0,
            testCount: 0,
            errors: [result.reason?.message || 'Test failed'],
            statusCodes: [],
            lastTestTime: Date.now(),
            confidence: 'low'
          });
          console.log(`  ❌ ${batch[index].id}: Test failed - ${result.reason?.message || 'Unknown error'}`);
        }
      });

      // 批次间延迟，避免过快请求
      if (i + maxConcurrentTests < prioritizedModels.length) {
        console.log(`⏳ Waiting ${rateLimitBackoff}ms before next batch...`);
        await this.delay(rateLimitBackoff);
      }
    }

    return results;
  }

  async testModelWithRetryLogic(model, testCount) {
    const results = [];
    const { testInterval, rateLimitBackoff } = this.config.testConfig;

    for (let attempt = 0; attempt < testCount; attempt++) {
      try {
        const startTime = Date.now();
        await this.sendTestRequest(model.id);
        const responseTime = Date.now() - startTime;

        results.push({
          success: true,
          responseTime
        });

      } catch (error) {
        const responseTime = Date.now();
        const statusCode = error?.response?.status || error?.status;
        const errorMessage = error.message;

        results.push({
          success: false,
          responseTime,
          error: errorMessage,
          statusCode
        });

        // 如果是429错误，增加延迟
        if (statusCode === 429) {
          await this.delay(rateLimitBackoff * (attempt + 1));
        }
      }

      // 测试间隔
      if (attempt < testCount - 1) {
        await this.delay(testInterval);
      }
    }

    // 分析测试结果
    return this.analyzeModelTestResults(model.id, results);
  }

  analyzeModelTestResults(modelId, results) {
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    const successRate = successfulTests.length / results.length;
    const averageResponseTime = successfulTests.length > 0
      ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
      : 0;

    // 错误分析
    const rateLimitErrors = failedTests.filter(r => r.statusCode === 429);
    const authErrors = failedTests.filter(r => r.statusCode === 401 || r.statusCode === 403);

    // 判断可用性和置信度
    let isAvailable = false;
    let confidence = 'low';

    if (successRate >= 0.8) {
      isAvailable = true;
      confidence = 'high';
    } else if (successRate >= 0.6) {
      isAvailable = true;
      confidence = 'medium';
    } else if (successRate >= 0.4 && rateLimitErrors.length === failedTests.length) {
      // 如果失败都是429错误，可能是流控，认为模型可用但置信度低
      isAvailable = true;
      confidence = 'low';
    } else if (authErrors.length > 0) {
      // 认证错误，模型不可用
      isAvailable = false;
      confidence = 'high';
    }

    return {
      modelId,
      isAvailable,
      responseTime: Math.round(averageResponseTime),
      successRate,
      testCount: results.length,
      errors: failedTests.map(r => r.error || 'Unknown error'),
      statusCodes: failedTests.map(r => r.statusCode || 0).filter(code => code > 0),
      lastTestTime: Date.now(),
      confidence
    };
  }

  analyzeTestResults(results) {
    const { minSuccessRate, maxResponseTime, minConfidenceLevel } = this.config.qualityThresholds;
    
    const confidenceLevels = { low: 0, medium: 1, high: 2 };
    const minConfidenceValue = confidenceLevels[minConfidenceLevel];

    const available = results.filter(result => {
      return result.isAvailable &&
             result.successRate >= minSuccessRate &&
             result.responseTime <= maxResponseTime &&
             confidenceLevels[result.confidence] >= minConfidenceValue;
    });

    const unavailable = results.filter(result => !available.includes(result));

    // 按质量排序可用模型
    available.sort((a, b) => {
      // 优先级：置信度 > 成功率 > 响应时间
      const confidenceDiff = confidenceLevels[b.confidence] - confidenceLevels[a.confidence];
      if (confidenceDiff !== 0) return confidenceDiff;
      
      const successRateDiff = b.successRate - a.successRate;
      if (Math.abs(successRateDiff) > 0.1) return successRateDiff;
      
      return a.responseTime - b.responseTime;
    });

    return { available, unavailable };
  }

  async updateProviderConfiguration(availableModels) {
    try {
      const configPath = this.findConfigurationFile();
      if (!configPath) {
        console.log('⚠️  Configuration file not found');
        return false;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // 更新模型列表
      const modelIds = availableModels.map(m => m.modelId);
      const providerConfig = config.providers[this.config.providerId];
      
      if (providerConfig) {
        // 备份原配置
        const backupPath = `${configPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, configContent);

        // 更新模型列表
        const originalModels = providerConfig.models || [];
        providerConfig.models = modelIds;
        
        // 设置默认模型（选择最高质量的模型）
        if (modelIds.length > 0) {
          providerConfig.defaultModel = modelIds[0];
        }

        // 写入更新后的配置
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        console.log(`💾 Configuration updated successfully:`);
        console.log(`   Config file: ${configPath}`);
        console.log(`   Backup saved: ${backupPath}`);
        console.log(`   Original models: ${originalModels.length}`);
        console.log(`   Updated models: ${modelIds.length}`);
        console.log(`   Default model: ${providerConfig.defaultModel}`);

        return true;
      }

      return false;

    } catch (error) {
      console.log(`❌ Failed to update configuration: ${error.message}`);
      return false;
    }
  }

  generateRecommendations(report) {
    const { availableModels, unavailableModels } = report;
    
    // 性能建议
    if (report.performance.averageResponseTime > 5000) {
      report.warnings.push('High average response time detected, consider optimizing requests');
    }

    // 可用性建议
    if (availableModels.length === 0) {
      report.warnings.push('No models are available, check provider configuration and API keys');
    } else if (availableModels.length < 3) {
      report.recommendations.push('Consider adding more models for better load balancing');
    }

    // 质量建议
    const lowConfidenceModels = availableModels.filter(m => m.confidence === 'low');
    if (lowConfidenceModels.length > 0) {
      report.warnings.push(`${lowConfidenceModels.length} models have low confidence, monitor their performance`);
    }

    // 错误分析
    const rateLimitIssues = unavailableModels.filter(m => 
      m.statusCodes.some(code => code === 429)
    );
    if (rateLimitIssues.length > 0) {
      report.recommendations.push('Consider implementing rate limiting or using multiple API keys');
    }

    const authIssues = unavailableModels.filter(m => 
      m.statusCodes.some(code => code === 401 || code === 403)
    );
    if (authIssues.length > 0) {
      report.warnings.push('Authentication issues detected, verify API keys and permissions');
    }
  }

  // 辅助方法
  buildModelsEndpoint() {
    const { provider } = this.config;
    let baseUrl = provider.endpoint;
    
    // 处理不同的端点格式
    if (baseUrl.includes('/v1/chat/completions')) {
      baseUrl = baseUrl.replace('/v1/chat/completions', '');
    } else if (baseUrl.includes('/chat/completions')) {
      baseUrl = baseUrl.replace('/chat/completions', '');
    }
    
    return `${baseUrl}/v1/models`;
  }

  buildAuthHeaders() {
    const { provider } = this.config;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router/2.7.0'
    };

    if (provider.authentication.type !== 'none') {
      const credentials = provider.authentication.credentials;
      const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';
      
      if (Array.isArray(apiKey)) {
        headers['Authorization'] = `Bearer ${apiKey[0]}`;
      } else if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return headers;
  }

  parseModelsResponse(data) {
    const models = [];

    if (data.data && Array.isArray(data.data)) {
      // OpenAI格式
      for (const model of data.data) {
        models.push({
          id: model.id,
          name: model.id,
          description: `Model: ${model.id}`,
          created: model.created,
          owned_by: model.owned_by,
          capabilities: this.inferModelCapabilities(model.id)
        });
      }
    } else if (data.models && Array.isArray(data.models)) {
      // Gemini格式
      for (const model of data.models) {
        models.push({
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name,
          description: model.description,
          capabilities: {
            text: true,
            vision: model.supportedGenerationMethods?.includes('generateContent') || false,
            tools: model.supportedGenerationMethods?.includes('generateContent') || false,
            streaming: true
          }
        });
      }
    }

    return models;
  }

  prioritizeModels(models) {
    // 常见模型优先级
    const priorityPatterns = [
      /gpt-4o/i,
      /gpt-4/i,
      /claude-3/i,
      /gemini/i,
      /qwen/i,
      /glm/i
    ];

    return models.sort((a, b) => {
      const aPriority = priorityPatterns.findIndex(pattern => pattern.test(a.id));
      const bPriority = priorityPatterns.findIndex(pattern => pattern.test(b.id));
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      } else if (aPriority !== -1) {
        return -1;
      } else if (bPriority !== -1) {
        return 1;
      }
      
      return a.id.localeCompare(b.id);
    });
  }

  async sendTestRequest(modelId) {
    const endpoint = this.config.provider.endpoint;
    const headers = this.buildAuthHeaders();
    const { testPrompt, maxTokens, requestTimeout } = this.config.testConfig;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`Test request failed: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  inferModelCapabilities(modelId) {
    const lowerId = modelId.toLowerCase();
    
    return {
      text: true,
      vision: lowerId.includes('vision') || lowerId.includes('gpt-4') || lowerId.includes('claude-3'),
      tools: lowerId.includes('gpt-4') || lowerId.includes('claude-3') || lowerId.includes('gemini'),
      streaming: true
    };
  }

  getFallbackModels() {
    const { provider } = this.config;
    
    switch (provider.type) {
      case 'openai':
        return [
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: { text: true, vision: false, tools: true, streaming: true } },
          { id: 'gpt-4', name: 'GPT-4', capabilities: { text: true, vision: false, tools: true, streaming: true } }
        ];
      default:
        return [
          { id: 'default-model', name: 'Default Model', capabilities: { text: true, vision: false, tools: false, streaming: true } }
        ];
    }
  }

  findConfigurationFile() {
    const possiblePaths = [
      path.join(process.env.HOME || '', '.route-claude-code', 'config', 'load-balancing', 'config-multi-openai-full.json'),
      path.join(process.env.HOME || '', '.route-claude-code', 'config', 'current.json'),
      path.join(process.cwd(), 'config.json')
    ];

    for (const configPath of possiblePaths) {
      try {
        if (require('fs').existsSync(configPath)) {
          return configPath;
        }
      } catch (error) {
        // 忽略错误，继续查找
      }
    }

    return null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 默认配置
const DEFAULT_CONFIG = {
  testConfig: {
    testCount: 3,
    testInterval: 1000,
    requestTimeout: 10000,
    testPrompt: 'Hello',
    maxTokens: 5,
    rateLimitBackoff: 2000,
    maxConcurrentTests: 2
  },
  qualityThresholds: {
    minSuccessRate: 0.6,
    maxResponseTime: 10000,
    minConfidenceLevel: 'medium'
  },
  cacheConfig: {
    modelListTTL: 30 * 60 * 1000, // 30分钟
    testResultTTL: 10 * 60 * 1000, // 10分钟
    enablePersistentCache: true
  }
};

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node intelligent-model-discovery.js <provider-id> [config-file]');
    console.log('');
    console.log('Examples:');
    console.log('  node intelligent-model-discovery.js shuaihong-openai');
    console.log('  node intelligent-model-discovery.js lmstudio-openai ~/.route-claude-code/config/lmstudio.json');
    process.exit(1);
  }

  const providerId = args[0];
  const configFile = args[1];

  try {
    // 加载配置
    let config;
    if (configFile) {
      const configContent = await fs.readFile(configFile, 'utf-8');
      config = JSON.parse(configContent);
    } else {
      // 查找默认配置文件
      const defaultConfigPath = path.join(process.env.HOME || '', '.route-claude-code', 'config', 'load-balancing', 'config-multi-openai-full.json');
      const configContent = await fs.readFile(defaultConfigPath, 'utf-8');
      config = JSON.parse(configContent);
    }

    if (!config.providers[providerId]) {
      console.log(`❌ Provider '${providerId}' not found in configuration`);
      console.log(`Available providers: ${Object.keys(config.providers).join(', ')}`);
      process.exit(1);
    }

    // 创建发现配置
    const discoveryConfig = {
      providerId,
      provider: config.providers[providerId],
      ...DEFAULT_CONFIG
    };

    // 执行智能发现
    const discovery = new IntelligentModelDiscovery(discoveryConfig);
    const report = await discovery.discoverAndUpdateModels();

    // 输出报告
    console.log('\n' + '='.repeat(60));
    console.log('📊 INTELLIGENT MODEL DISCOVERY REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n🏢 Provider: ${report.providerId}`);
    console.log(`⏰ Discovery Time: ${new Date(report.discoveryTime).toLocaleString()}`);
    console.log(`📋 Total Models Found: ${report.totalModelsFound}`);
    console.log(`🌐 Models from API: ${report.modelsFromAPI}`);
    console.log(`🔄 Models from Fallback: ${report.modelsFromFallback}`);
    
    console.log(`\n✅ Available Models (${report.availableModels.length}):`);
    report.availableModels.forEach((model, index) => {
      const confidence = model.confidence.toUpperCase();
      const successRate = (model.successRate * 100).toFixed(0);
      console.log(`  ${index + 1}. ${model.modelId}`);
      console.log(`     Success Rate: ${successRate}%, Response Time: ${model.responseTime}ms, Confidence: ${confidence}`);
    });

    if (report.unavailableModels.length > 0) {
      console.log(`\n❌ Unavailable Models (${report.unavailableModels.length}):`);
      report.unavailableModels.forEach((model, index) => {
        const successRate = (model.successRate * 100).toFixed(0);
        const mainError = model.errors[0] || 'Unknown error';
        console.log(`  ${index + 1}. ${model.modelId}`);
        console.log(`     Success Rate: ${successRate}%, Error: ${mainError}`);
      });
    }

    console.log(`\n⚡ Performance:`);
    console.log(`   Total Duration: ${report.performance.totalDuration}ms`);
    console.log(`   API Call Duration: ${report.performance.apiCallDuration}ms`);
    console.log(`   Testing Duration: ${report.performance.testingDuration}ms`);
    console.log(`   Average Response Time: ${Math.round(report.performance.averageResponseTime)}ms`);

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    if (report.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      report.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (report.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      report.errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log(`\n🔧 Configuration Updated: ${report.configurationUpdated ? 'Yes' : 'No'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Discovery completed successfully!');
    
    if (report.configurationUpdated) {
      console.log('\n🔄 Next steps:');
      console.log('1. Restart the router service to apply the new configuration');
      console.log('2. Test the updated models with actual requests');
      console.log('3. Monitor performance and adjust thresholds if needed');
    }

  } catch (error) {
    console.log(`❌ Discovery failed: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { IntelligentModelDiscovery, DEFAULT_CONFIG };