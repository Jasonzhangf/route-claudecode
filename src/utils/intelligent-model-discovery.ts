/**
 * 智能模型发现系统 v2.0
 * 通过/models端点获取模型列表，多次测试避免流控误判，智能更新配置
 */

import { logger } from '@/utils/logger';
import { ProviderConfig, ProviderError } from '@/types';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ModelTestResult {
  modelId: string;
  isAvailable: boolean;
  responseTime: number;
  successRate: number;
  testCount: number;
  errors: string[];
  statusCodes: number[];
  lastTestTime: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProviderModelInfo {
  id: string;
  name?: string;
  description?: string;
  created?: number;
  owned_by?: string;
  capabilities?: {
    text: boolean;
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
  pricing?: {
    input: number;
    output: number;
  };
  context_length?: number;
}

export interface IntelligentDiscoveryConfig {
  providerId: string;
  provider: ProviderConfig;
  testConfig: {
    testCount: number;
    testInterval: number;
    requestTimeout: number;
    testPrompt: string;
    maxTokens: number;
    rateLimitBackoff: number;
    maxConcurrentTests: number;
  };
  qualityThresholds: {
    minSuccessRate: number;
    maxResponseTime: number;
    minConfidenceLevel: 'high' | 'medium' | 'low';
  };
  cacheConfig: {
    modelListTTL: number;
    testResultTTL: number;
    enablePersistentCache: boolean;
  };
}

export interface DiscoveryReport {
  providerId: string;
  discoveryTime: number;
  totalModelsFound: number;
  modelsFromAPI: number;
  modelsFromFallback: number;
  availableModels: ModelTestResult[];
  unavailableModels: ModelTestResult[];
  configurationUpdated: boolean;
  recommendations: string[];
  warnings: string[];
  errors: string[];
  performance: {
    totalDuration: number;
    apiCallDuration: number;
    testingDuration: number;
    averageResponseTime: number;
  };
}

export class IntelligentModelDiscovery {
  private config: IntelligentDiscoveryConfig;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private testQueue: Array<{ modelId: string; priority: number }> = [];
  private activeTests: Set<string> = new Set();

  constructor(config: IntelligentDiscoveryConfig) {
    this.config = config;
  }

  /**
   * 执行完整的智能模型发现流程
   */
  async discoverAndUpdateModels(): Promise<DiscoveryReport> {
    const startTime = Date.now();
    const report: DiscoveryReport = {
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
      logger.info('Starting intelligent model discovery', {
        providerId: this.config.providerId,
        testCount: this.config.testConfig.testCount,
        minSuccessRate: this.config.qualityThresholds.minSuccessRate
      }, 'intelligent-discovery');

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

      // 2. 智能模型测试
      const testStartTime = Date.now();
      const testResults = await this.intelligentModelTesting(models);
      report.performance.testingDuration = Date.now() - testStartTime;

      // 3. 分析测试结果
      const { available, unavailable } = this.analyzeTestResults(testResults);
      report.availableModels = available;
      report.unavailableModels = unavailable;

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

      logger.info('Intelligent model discovery completed', {
        providerId: this.config.providerId,
        totalModels: report.totalModelsFound,
        availableModels: report.availableModels.length,
        unavailableModels: report.unavailableModels.length,
        configUpdated: report.configurationUpdated,
        duration: report.performance.totalDuration
      }, 'intelligent-discovery');

      return report;

    } catch (error) {
      const errorMessage = `Discovery failed: ${error instanceof Error ? error.message : String(error)}`;
      report.errors.push(errorMessage);
      report.performance.totalDuration = Date.now() - startTime;

      logger.error('Intelligent model discovery failed', {
        providerId: this.config.providerId,
        error: error instanceof Error ? error.message : String(error),
        duration: report.performance.totalDuration
      }, 'intelligent-discovery');

      return report;
    }
  }

  /**
   * 从API获取模型列表
   */
  private async fetchModelsFromAPI(): Promise<ProviderModelInfo[]> {
    const cacheKey = `models:${this.config.providerId}`;
    
    // 检查缓存
    if (this.isCacheValid(cacheKey)) {
      logger.debug('Using cached model list', { providerId: this.config.providerId }, 'intelligent-discovery');
      return this.cache.get(cacheKey);
    }

    const modelsEndpoint = this.buildModelsEndpoint();
    const headers = this.buildAuthHeaders();

    try {
      logger.debug('Fetching models from API', {
        providerId: this.config.providerId,
        endpoint: modelsEndpoint
      }, 'intelligent-discovery');

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

      // 缓存结果
      this.cache.set(cacheKey, models);
      this.cacheExpiry.set(cacheKey, Date.now() + this.config.cacheConfig.modelListTTL);

      logger.info('Successfully fetched models from API', {
        providerId: this.config.providerId,
        modelCount: models.length,
        sampleModels: models.slice(0, 3).map(m => m.id)
      }, 'intelligent-discovery');

      return models;

    } catch (error) {
      logger.warn('Failed to fetch models from API', {
        providerId: this.config.providerId,
        endpoint: modelsEndpoint,
        error: error instanceof Error ? error.message : String(error)
      }, 'intelligent-discovery');

      throw error;
    }
  }

  /**
   * 智能模型测试 - 考虑流控和并发限制
   */
  private async intelligentModelTesting(models: ProviderModelInfo[]): Promise<ModelTestResult[]> {
    const results: ModelTestResult[] = [];
    const { maxConcurrentTests, testCount, testInterval, rateLimitBackoff } = this.config.testConfig;

    // 按优先级排序模型（常见模型优先测试）
    const prioritizedModels = this.prioritizeModels(models);
    
    logger.info('Starting intelligent model testing', {
      providerId: this.config.providerId,
      totalModels: models.length,
      testCount,
      maxConcurrentTests
    }, 'intelligent-discovery');

    // 分批测试，控制并发
    for (let i = 0; i < prioritizedModels.length; i += maxConcurrentTests) {
      const batch = prioritizedModels.slice(i, i + maxConcurrentTests);
      
      logger.debug(`Testing model batch ${Math.floor(i / maxConcurrentTests) + 1}`, {
        providerId: this.config.providerId,
        batchSize: batch.length,
        models: batch.map(m => m.id)
      }, 'intelligent-discovery');

      // 并发测试当前批次
      const batchPromises = batch.map(model => 
        this.testModelWithRetryLogic(model, testCount)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理批次结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // 测试失败，创建失败结果
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
        }
      });

      // 批次间延迟，避免过快请求
      if (i + maxConcurrentTests < prioritizedModels.length) {
        await this.delay(rateLimitBackoff);
      }
    }

    return results;
  }

  /**
   * 带重试逻辑的模型测试
   */
  private async testModelWithRetryLogic(model: ProviderModelInfo, testCount: number): Promise<ModelTestResult> {
    const results: Array<{ success: boolean; responseTime: number; error?: string; statusCode?: number }> = [];
    const { testInterval, rateLimitBackoff } = this.config.testConfig;

    for (let attempt = 0; attempt < testCount; attempt++) {
      try {
        logger.debug(`Testing model ${model.id} (${attempt + 1}/${testCount})`, {
          providerId: this.config.providerId,
          modelId: model.id,
          attempt: attempt + 1
        }, 'intelligent-discovery');

        const startTime = Date.now();
        await this.sendTestRequest(model.id);
        const responseTime = Date.now() - startTime;

        results.push({
          success: true,
          responseTime
        });

        logger.debug(`Model test successful`, {
          providerId: this.config.providerId,
          modelId: model.id,
          attempt: attempt + 1,
          responseTime
        }, 'intelligent-discovery');

      } catch (error) {
        const responseTime = Date.now();
        const statusCode = (error as any)?.response?.status || (error as any)?.status;
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          success: false,
          responseTime,
          error: errorMessage,
          statusCode
        });

        logger.debug(`Model test failed`, {
          providerId: this.config.providerId,
          modelId: model.id,
          attempt: attempt + 1,
          error: errorMessage,
          statusCode
        }, 'intelligent-discovery');

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

  /**
   * 分析单个模型的测试结果
   */
  private analyzeModelTestResults(
    modelId: string, 
    results: Array<{ success: boolean; responseTime: number; error?: string; statusCode?: number }>
  ): ModelTestResult {
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    const successRate = successfulTests.length / results.length;
    const averageResponseTime = successfulTests.length > 0
      ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
      : 0;

    // 错误分析
    const rateLimitErrors = failedTests.filter(r => r.statusCode === 429);
    const authErrors = failedTests.filter(r => r.statusCode === 401 || r.statusCode === 403);
    const serverErrors = failedTests.filter(r => r.statusCode && r.statusCode >= 500);

    // 判断可用性和置信度
    let isAvailable = false;
    let confidence: 'high' | 'medium' | 'low' = 'low';

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
      responseTime: averageResponseTime,
      successRate,
      testCount: results.length,
      errors: failedTests.map(r => r.error || 'Unknown error'),
      statusCodes: failedTests.map(r => r.statusCode || 0).filter(code => code > 0),
      lastTestTime: Date.now(),
      confidence
    };
  }

  /**
   * 分析所有测试结果
   */
  private analyzeTestResults(results: ModelTestResult[]): {
    available: ModelTestResult[];
    unavailable: ModelTestResult[];
  } {
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

  /**
   * 更新提供商配置
   */
  private async updateProviderConfiguration(availableModels: ModelTestResult[]): Promise<boolean> {
    try {
      // 这里需要根据实际的配置文件结构来实现
      // 示例实现：更新配置文件中的模型列表
      
      const configPath = this.findConfigurationFile();
      if (!configPath) {
        logger.warn('Configuration file not found', { providerId: this.config.providerId }, 'intelligent-discovery');
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
        providerConfig.models = modelIds;
        
        // 设置默认模型（选择最高质量的模型）
        if (modelIds.length > 0) {
          providerConfig.defaultModel = modelIds[0];
        }

        // 写入更新后的配置
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        logger.info('Configuration updated successfully', {
          providerId: this.config.providerId,
          configPath,
          backupPath,
          modelCount: modelIds.length,
          defaultModel: providerConfig.defaultModel
        }, 'intelligent-discovery');

        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to update configuration', {
        providerId: this.config.providerId,
        error: error instanceof Error ? error.message : String(error)
      }, 'intelligent-discovery');

      return false;
    }
  }

  /**
   * 生成建议和警告
   */
  private generateRecommendations(report: DiscoveryReport): void {
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
  private buildModelsEndpoint(): string {
    const { provider } = this.config;
    const baseUrl = provider.endpoint.replace(/\/v1\/chat\/completions$/, '');
    return `${baseUrl}/v1/models`;
  }

  private buildAuthHeaders(): Record<string, string> {
    const { provider } = this.config;
    const headers: Record<string, string> = {
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

  private parseModelsResponse(data: any): ProviderModelInfo[] {
    const models: ProviderModelInfo[] = [];

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

  private prioritizeModels(models: ProviderModelInfo[]): ProviderModelInfo[] {
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

  private async sendTestRequest(modelId: string): Promise<any> {
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
      throw new ProviderError(
        `Test request failed: ${response.statusText}`,
        this.config.providerId,
        response.status
      );
    }

    return response.json();
  }

  private inferModelCapabilities(modelId: string): ProviderModelInfo['capabilities'] {
    const lowerId = modelId.toLowerCase();
    
    return {
      text: true,
      vision: lowerId.includes('vision') || lowerId.includes('gpt-4') || lowerId.includes('claude-3'),
      tools: lowerId.includes('gpt-4') || lowerId.includes('claude-3') || lowerId.includes('gemini'),
      streaming: true
    };
  }

  private getFallbackModels(): ProviderModelInfo[] {
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

  private findConfigurationFile(): string | null {
    // 这里需要根据实际项目结构来实现
    // 示例：查找配置文件
    const possiblePaths = [
      path.join(process.cwd(), 'config.json'),
      path.join(process.env.HOME || '', '.route-claude-code', 'config', 'current.json')
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

  private isCacheValid(cacheKey: string): boolean {
    const expiryTime = this.cacheExpiry.get(cacheKey);
    return expiryTime ? Date.now() < expiryTime : false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建智能模型发现实例的工厂函数
 */
export function createIntelligentModelDiscovery(config: IntelligentDiscoveryConfig): IntelligentModelDiscovery {
  return new IntelligentModelDiscovery(config);
}

/**
 * 默认配置
 */
export const DEFAULT_DISCOVERY_CONFIG: Omit<IntelligentDiscoveryConfig, 'providerId' | 'provider'> = {
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