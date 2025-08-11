/**
 * 动态模型发现系统
 * 通过API获取模型列表并验证可用性
 */

import { logger } from '@/utils/logger';
import { BaseRequest, ProviderConfig, ProviderError } from '@/types';

export interface ModelInfo {
  id: string;
  name: string;
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
    prompt: number;
    completion: number;
  };
}

export interface ModelAvailabilityResult {
  modelId: string;
  isAvailable: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
  testTimestamp: number;
  retryCount: number;
}

export interface ModelDiscoveryConfig {
  provider: ProviderConfig;
  providerId: string;
  maxRetries: number;
  retryDelay: number;
  requestTimeout: number;
  testPrompt: string;
  maxTokens: number;
}

export interface DiscoveryResult {
  providerId: string;
  totalModels: number;
  availableModels: string[];
  unavailableModels: string[];
  averageResponseTime: number;
  discoveryTimestamp: number;
  errors: string[];
}

/**
 * 模型发现和验证核心类
 */
export class DynamicModelDiscovery {
  private config: ModelDiscoveryConfig;
  private cache: Map<string, ModelInfo[]> = new Map();
  private availabilityCache: Map<string, ModelAvailabilityResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30分钟

  constructor(config: ModelDiscoveryConfig) {
    this.config = config;
  }

  /**
   * 获取可用的模型列表
   */
  async fetchAvailableModels(): Promise<ModelInfo[]> {
    const cacheKey = `${this.config.providerId}:models`;
    
    // 检查缓存
    if (this.isCacheValid(cacheKey)) {
      logger.debug('Using cached model list', { providerId: this.config.providerId }, 'model-discovery');
      return this.cache.get(cacheKey)!;
    }

    try {
      logger.info('Fetching model list from API', { providerId: this.config.providerId }, 'model-discovery');
      
      const models = await this.fetchModelsFromAPI();
      
      // 缓存结果
      this.cache.set(cacheKey, models);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      
      logger.info('Successfully fetched model list', { 
        providerId: this.config.providerId,
        modelCount: models.length,
        modelNames: models.slice(0, 5).map(m => m.id)
      }, 'model-discovery');
      
      return models;
    } catch (error) {
      logger.error('Failed to fetch model list', {
        providerId: this.config.providerId,
        error: error instanceof Error ? error.message : String(error)
      }, 'model-discovery');
      
      // 如果API获取失败，返回默认模型列表
      return this.getDefaultModels();
    }
  }

  /**
   * 从提供商API获取模型列表
   */
  private async fetchModelsFromAPI(): Promise<ModelInfo[]> {
    const { provider, providerId } = this.config;
    
    // 根据提供商类型使用不同的API端点
    switch (provider.type) {
      case 'openai':
      case 'shuaihong':
      case 'lmstudio':
        return this.fetchOpenAICompatibleModels();
      case 'anthropic':
        return this.fetchAnthropicModels();
      case 'gemini':
        return this.fetchGeminiModels();
      default:
        logger.warn(`Unsupported provider type for model discovery: ${provider.type}`, { providerId }, 'model-discovery');
        return this.getDefaultModels();
    }
  }

  /**
   * 获取OpenAI兼容的模型列表
   */
  private async fetchOpenAICompatibleModels(): Promise<ModelInfo[]> {
    const endpoint = this.getModelsEndpoint();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
      
      const response = await fetch(`${endpoint}/models`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const models: ModelInfo[] = [];

      // 处理OpenAI格式的模型列表
      if (data.data && Array.isArray(data.data)) {
        for (const model of data.data) {
          models.push({
            id: model.id,
            name: model.id,
            description: `Model: ${model.id}`,
            created: model.created,
            owned_by: model.owned_by,
            capabilities: this.inferCapabilities(model.id)
          });
        }
      }

      return models;
    } catch (error) {
      logger.error('Failed to fetch OpenAI-compatible models', {
        providerId: this.config.providerId,
        endpoint,
        error: error instanceof Error ? error.message : String(error)
      }, 'model-discovery');
      throw error;
    }
  }

  /**
   * 获取Anthropic模型列表
   */
  private async fetchAnthropicModels(): Promise<ModelInfo[]> {
    // Anthropic不提供模型列表API，返回硬编码的已知模型
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Latest Claude 3.5 Sonnet model',
        capabilities: { text: true, vision: true, tools: true, streaming: true }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast Claude 3.5 Haiku model',
        capabilities: { text: true, vision: true, tools: true, streaming: true }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most capable Claude 3 model',
        capabilities: { text: true, vision: true, tools: true, streaming: true }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced Claude 3 model',
        capabilities: { text: true, vision: true, tools: true, streaming: true }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast Claude 3 model',
        capabilities: { text: true, vision: false, tools: true, streaming: true }
      }
    ];
  }

  /**
   * 获取Gemini模型列表
   */
  private async fetchGeminiModels(): Promise<ModelInfo[]> {
    const endpoint = this.getModelsEndpoint();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
      
      const response = await fetch(`${endpoint}/v1beta/models?key=${this.getAPIKey()}`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const models: ModelInfo[] = [];

      // 处理Gemini格式的模型列表
      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          if (model.supportedGenerationMethods?.includes('generateContent')) {
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
      }

      return models;
    } catch (error) {
      logger.error('Failed to fetch Gemini models', {
        providerId: this.config.providerId,
        endpoint,
        error: error instanceof Error ? error.message : String(error)
      }, 'model-discovery');
      throw error;
    }
  }

  /**
   * 测试模型可用性（多次测试避免流控误判）
   */
  async testModelAvailability(modelId: string, testCount: number = 3): Promise<ModelAvailabilityResult> {
    const cacheKey = `${this.config.providerId}:${modelId}:availability`;
    
    // 检查缓存
    if (this.isCacheValid(cacheKey)) {
      return this.availabilityCache.get(cacheKey)!;
    }

    const results: ModelAvailabilityResult[] = [];
    
    for (let i = 0; i < testCount; i++) {
      try {
        logger.debug(`Testing model availability (${i + 1}/${testCount})`, {
          providerId: this.config.providerId,
          modelId,
          testIndex: i + 1
        }, 'model-discovery');
        
        const startTime = Date.now();
        
        // 发送测试请求
        const result = await this.sendTestRequest(modelId);
        const responseTime = Date.now() - startTime;
        
        results.push({
          modelId,
          isAvailable: true,
          responseTime,
          testTimestamp: startTime,
          retryCount: i
        });
        
        logger.debug(`Model test successful (${i + 1}/${testCount})`, {
          providerId: this.config.providerId,
          modelId,
          responseTime,
          testIndex: i + 1
        }, 'model-discovery');
        
      } catch (error) {
        const responseTime = Date.now();
        
        results.push({
          modelId,
          isAvailable: false,
          responseTime,
          error: error instanceof Error ? error.message : String(error),
          statusCode: (error as any)?.response?.status || (error as any)?.status,
          testTimestamp: responseTime,
          retryCount: i
        });
        
        logger.warn(`Model test failed (${i + 1}/${testCount})`, {
          providerId: this.config.providerId,
          modelId,
          error: error instanceof Error ? error.message : String(error),
          statusCode: (error as any)?.response?.status || (error as any)?.status,
          testIndex: i + 1
        }, 'model-discovery');
      }
      
      // 测试间隔
      if (i < testCount - 1) {
        await this.delay(this.config.retryDelay);
      }
    }

    // 分析测试结果
    const finalResult = this.analyzeTestResults(results);
    
    // 缓存结果
    this.availabilityCache.set(cacheKey, finalResult);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
    
    logger.info(`Model availability test completed`, {
      providerId: this.config.providerId,
      modelId,
      isAvailable: finalResult.isAvailable,
      successRate: results.filter(r => r.isAvailable).length / results.length,
      avgResponseTime: finalResult.responseTime,
      testCount: results.length
    }, 'model-discovery');
    
    return finalResult;
  }

  /**
   * 分析测试结果，避免流控误判
   */
  private analyzeTestResults(results: ModelAvailabilityResult[]): ModelAvailabilityResult {
    const successfulTests = results.filter(r => r.isAvailable);
    const failedTests = results.filter(r => !r.isAvailable);
    
    // 计算成功率
    const successRate = successfulTests.length / results.length;
    
    // 计算平均响应时间（仅成功请求）
    const avgResponseTime = successfulTests.length > 0
      ? successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length
      : failedTests.reduce((sum, r) => sum + r.responseTime, 0) / failedTests.length;
    
    // 错误分析
    const rateLimitErrors = failedTests.filter(r => r.statusCode === 429);
    const authErrors = failedTests.filter(r => r.statusCode === 401 || r.statusCode === 403);
    const networkErrors = failedTests.filter(r => !r.statusCode || r.statusCode >= 500);
    
    // 判断模型可用性
    let isAvailable = false;
    let retryCount = Math.max(...results.map(r => r.retryCount));
    
    if (successRate >= 0.6) {
      // 成功率超过60%，认为模型可用
      isAvailable = true;
    } else if (successRate === 0.5 && results.length === 2) {
      // 2次测试中1次成功，认为模型可用（可能是一次性流控）
      isAvailable = true;
    } else if (successRate === 0.33 && results.length === 3) {
      // 3次测试中1次成功，需要进一步判断
      // 如果失败的都是429错误，可能是流控，认为模型可用
      if (rateLimitErrors.length === failedTests.length) {
        isAvailable = true;
        retryCount = Math.min(retryCount + 1, this.config.maxRetries);
      }
    }
    
    // 认证错误直接认为不可用
    if (authErrors.length > 0) {
      isAvailable = false;
    }
    
    return {
      modelId: results[0].modelId,
      isAvailable,
      responseTime: avgResponseTime,
      error: isAvailable ? undefined : failedTests[0]?.error,
      statusCode: isAvailable ? undefined : failedTests[0]?.statusCode,
      testTimestamp: Date.now(),
      retryCount
    };
  }

  /**
   * 执行完整的模型发现流程
   */
  async discoverModels(): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      logger.info('Starting model discovery', { providerId: this.config.providerId }, 'model-discovery');
      
      // 1. 获取模型列表
      const models = await this.fetchAvailableModels();
      
      if (models.length === 0) {
        errors.push('No models found from API');
        return {
          providerId: this.config.providerId,
          totalModels: 0,
          availableModels: [],
          unavailableModels: [],
          averageResponseTime: 0,
          discoveryTimestamp: Date.now(),
          errors
        };
      }
      
      // 2. 测试每个模型的可用性
      const availableModels: string[] = [];
      const unavailableModels: string[] = [];
      const responseTimes: number[] = [];
      
      // 限制测试的模型数量，避免耗时过长
      const modelsToTest = models.slice(0, 10); // 最多测试10个模型
      
      for (const model of modelsToTest) {
        try {
          const result = await this.testModelAvailability(model.id, 3);
          responseTimes.push(result.responseTime);
          
          if (result.isAvailable) {
            availableModels.push(model.id);
            logger.info('Model available', {
              providerId: this.config.providerId,
              modelId: model.id,
              responseTime: result.responseTime
            }, 'model-discovery');
          } else {
            unavailableModels.push(model.id);
            logger.warn('Model unavailable', {
              providerId: this.config.providerId,
              modelId: model.id,
              error: result.error,
              statusCode: result.statusCode
            }, 'model-discovery');
          }
        } catch (error) {
          unavailableModels.push(model.id);
          errors.push(`Failed to test model ${model.id}: ${error}`);
          logger.error('Error testing model', {
            providerId: this.config.providerId,
            modelId: model.id,
            error: error instanceof Error ? error.message : String(error)
          }, 'model-discovery');
        }
        
        // 模型测试间隔
        await this.delay(1000);
      }
      
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;
      
      const discoveryResult: DiscoveryResult = {
        providerId: this.config.providerId,
        totalModels: models.length,
        availableModels,
        unavailableModels,
        averageResponseTime,
        discoveryTimestamp: Date.now(),
        errors
      };
      
      logger.info('Model discovery completed', {
        providerId: this.config.providerId,
        totalModels: discoveryResult.totalModels,
        availableModels: discoveryResult.availableModels.length,
        unavailableModels: discoveryResult.unavailableModels.length,
        averageResponseTime: discoveryResult.averageResponseTime,
        discoveryDuration: Date.now() - startTime
      }, 'model-discovery');
      
      return discoveryResult;
      
    } catch (error) {
      const errorMessage = `Model discovery failed: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      
      logger.error('Model discovery failed', {
        providerId: this.config.providerId,
        error: error instanceof Error ? error.message : String(error)
      }, 'model-discovery');
      
      return {
        providerId: this.config.providerId,
        totalModels: 0,
        availableModels: [],
        unavailableModels: [],
        averageResponseTime: 0,
        discoveryTimestamp: Date.now(),
        errors
      };
    }
  }

  /**
   * 发送测试请求
   */
  private async sendTestRequest(modelId: string): Promise<any> {
    const { provider, providerId } = this.config;
    const testRequest: BaseRequest = {
      model: modelId,
      messages: [{ role: 'user', content: this.config.testPrompt }],
      max_tokens: this.config.maxTokens,
      metadata: {
        requestId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    };

    const endpoint = this.getChatEndpoint();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(testRequest),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ProviderError(
        `Model test failed: ${response.statusText}`,
        providerId,
        response.status
      );
    }

    return response.json();
  }

  /**
   * 获取模型列表端点
   */
  private getModelsEndpoint(): string {
    const { provider } = this.config;
    
    if (provider.type === 'gemini') {
      return provider.endpoint;
    }
    
    // 对于OpenAI兼容的服务，从chat端点推导models端点
    const url = new URL(provider.endpoint);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    if (pathParts.includes('chat') && pathParts.includes('completions')) {
      // /v1/chat/completions -> /v1/models
      const basePath = pathParts.slice(0, -2).join('/');
      url.pathname = basePath ? `/${basePath}/models` : '/v1/models';
    } else if (pathParts.includes('completions')) {
      // /v1/completions -> /v1/models
      const basePath = pathParts.slice(0, -1).join('/');
      url.pathname = basePath ? `/${basePath}/models` : '/v1/models';
    }
    
    return url.toString();
  }

  /**
   * 获取聊天端点
   */
  private getChatEndpoint(): string {
    return this.config.provider.endpoint;
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const { provider } = this.config;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router/2.0.0'
    };

    if (provider.authentication.type === 'none') {
      return headers;
    }

    const credentials = provider.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';
    
    if (Array.isArray(apiKey)) {
      headers['Authorization'] = `Bearer ${apiKey[0]}`;
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * 获取API密钥
   */
  private getAPIKey(): string {
    const { provider } = this.config;
    const credentials = provider.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';
    
    if (Array.isArray(apiKey)) {
      return apiKey[0];
    }
    
    return apiKey || '';
  }

  /**
   * 推断模型能力
   */
  private inferCapabilities(modelId: string): ModelInfo['capabilities'] {
    const capabilities = {
      text: true,
      vision: false,
      tools: false,
      streaming: true
    };

    // 基于模型名称推断能力
    const lowerId = modelId.toLowerCase();
    
    if (lowerId.includes('vision') || lowerId.includes('image')) {
      capabilities.vision = true;
    }
    
    if (lowerId.includes('tool') || lowerId.includes('function')) {
      capabilities.tools = true;
    }
    
    // 常见模型的能力推断
    if (lowerId.includes('gpt-4') || 
        lowerId.includes('claude-3') || 
        lowerId.includes('gemini-pro')) {
      capabilities.tools = true;
    }
    
    if (lowerId.includes('gpt-4-vision') || 
        lowerId.includes('claude-3') || 
        lowerId.includes('gemini-pro-vision')) {
      capabilities.vision = true;
    }

    return capabilities;
  }

  /**
   * 获取默认模型列表
   */
  private getDefaultModels(): ModelInfo[] {
    const { provider } = this.config;
    
    switch (provider.type) {
      case 'openai':
      case 'shuaihong':
        return [
          { id: 'gpt-4', name: 'GPT-4', capabilities: { text: true, vision: false, tools: true, streaming: true } },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', capabilities: { text: true, vision: true, tools: true, streaming: true } },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', capabilities: { text: true, vision: false, tools: true, streaming: true } }
        ];
      case 'lmstudio':
        return [
          { id: 'llama-2-7b-chat', name: 'Llama 2 7B Chat', capabilities: { text: true, vision: false, tools: false, streaming: true } },
          { id: 'mistral-7b-instruct', name: 'Mistral 7B Instruct', capabilities: { text: true, vision: false, tools: false, streaming: true } },
          { id: 'qwen-7b-chat', name: 'Qwen 7B Chat', capabilities: { text: true, vision: false, tools: true, streaming: true } }
        ];
      default:
        return [
          { id: 'default-model', name: 'Default Model', capabilities: { text: true, vision: false, tools: false, streaming: true } }
        ];
    }
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiryTime = this.cacheExpiry.get(cacheKey);
    return expiryTime ? Date.now() < expiryTime : false;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.availabilityCache.clear();
    this.cacheExpiry.clear();
    logger.info('Model discovery cache cleared', { providerId: this.config.providerId }, 'model-discovery');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    modelCacheSize: number;
    availabilityCacheSize: number;
    cacheKeys: string[];
  } {
    return {
      modelCacheSize: this.cache.size,
      availabilityCacheSize: this.availabilityCache.size,
      cacheKeys: Array.from(this.cache.keys()).concat(Array.from(this.availabilityCache.keys()))
    };
  }
}

/**
 * 工厂函数创建动态模型发现实例
 */
export function createDynamicModelDiscovery(config: ModelDiscoveryConfig): DynamicModelDiscovery {
  return new DynamicModelDiscovery(config);
}
