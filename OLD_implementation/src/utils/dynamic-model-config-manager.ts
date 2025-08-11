/**
 * 动态模型配置管理器
 * 集成模型发现系统并管理模型配置更新
 */

import { logger } from '@/utils/logger';
import { ProviderConfig } from '@/types';
import { DynamicModelDiscovery, createDynamicModelDiscovery, DiscoveryResult } from './dynamic-model-discovery';

export interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  capabilities: {
    text: boolean;
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
  isAvailable: boolean;
  lastChecked: number;
  responseTime: number;
  category: 'default' | 'background' | 'thinking' | 'longcontext' | 'search';
  priority: number;
}

export interface ProviderModelConfig {
  providerId: string;
  models: ModelConfig[];
  lastUpdated: number;
  isHealthy: boolean;
}

export interface ModelConfigManagerConfig {
  autoDiscovery: boolean;
  discoveryInterval: number; // 分钟
  maxModelsPerProvider: number;
  testRetries: number;
  testTimeout: number;
  enableCaching: boolean;
  cacheExpiry: number; // 分钟
}

export interface ModelUpdateEvent {
  providerId: string;
  type: 'model_added' | 'model_removed' | 'model_became_available' | 'model_became_unavailable';
  modelId: string;
  timestamp: number;
  details?: any;
}

/**
 * 动态模型配置管理器
 */
export class DynamicModelConfigManager {
  private config: ModelConfigManagerConfig;
  private discoveries: Map<string, DynamicModelDiscovery> = new Map();
  private providerConfigs: Map<string, ProviderModelConfig> = new Map();
  private updateListeners: Set<(event: ModelUpdateEvent) => void> = new Set();
  private discoveryIntervalId?: NodeJS.Timeout;
  
  constructor(config: ModelConfigManagerConfig) {
    this.config = config;
    logger.info('Dynamic Model Config Manager initialized', { config }, 'model-config-manager');
  }

  /**
   * 注册提供商
   */
  async registerProvider(providerId: string, providerConfig: ProviderConfig): Promise<void> {
    logger.info('Registering provider for model discovery', { providerId }, 'model-config-manager');
    
    // 创建模型发现实例
    const discoveryConfig = {
      provider: providerConfig,
      providerId,
      maxRetries: this.config.testRetries,
      retryDelay: 1000,
      requestTimeout: this.config.testTimeout,
      testPrompt: 'Hello, please respond briefly.',
      maxTokens: 50
    };
    
    const discovery = createDynamicModelDiscovery(discoveryConfig);
    this.discoveries.set(providerId, discovery);
    
    // 初始化提供商配置
    this.providerConfigs.set(providerId, {
      providerId,
      models: [],
      lastUpdated: 0,
      isHealthy: false
    });
    
    // 如果启用自动发现，立即执行第一次发现
    if (this.config.autoDiscovery) {
      await this.discoverProviderModels(providerId);
    }
    
    logger.info('Provider registered successfully', { providerId }, 'model-config-manager');
  }

  /**
   * 注销提供商
   */
  unregisterProvider(providerId: string): void {
    logger.info('Unregistering provider', { providerId }, 'model-config-manager');
    
    this.discoveries.delete(providerId);
    this.providerConfigs.delete(providerId);
    
    logger.info('Provider unregistered successfully', { providerId }, 'model-config-manager');
  }

  /**
   * 手动触发提供商模型发现
   */
  async discoverProviderModels(providerId: string): Promise<DiscoveryResult> {
    logger.info('Starting manual model discovery', { providerId }, 'model-config-manager');
    
    const discovery = this.discoveries.get(providerId);
    if (!discovery) {
      throw new Error(`Provider ${providerId} not registered`);
    }
    
    // 执行模型发现
    const result = await discovery.discoverModels();
    
    // 更新提供商配置
    await this.updateProviderModelConfig(providerId, result);
    
    // 触发更新事件
    this.notifyModelUpdateListeners(providerId, result);
    
    logger.info('Manual model discovery completed', {
      providerId,
      totalModels: result.totalModels,
      availableModels: result.availableModels.length,
      unavailableModels: result.unavailableModels.length
    }, 'model-config-manager');
    
    return result;
  }

  /**
   * 测试特定模型可用性
   */
  async testModelAvailability(providerId: string, modelId: string): Promise<boolean> {
    logger.debug('Testing model availability', { providerId, modelId }, 'model-config-manager');
    
    const discovery = this.discoveries.get(providerId);
    if (!discovery) {
      throw new Error(`Provider ${providerId} not registered`);
    }
    
    try {
      const result = await discovery.testModelAvailability(modelId, 3);
      
      // 更新模型配置
      const providerConfig = this.providerConfigs.get(providerId);
      if (providerConfig) {
        const modelConfig = providerConfig.models.find(m => m.id === modelId);
        if (modelConfig) {
          const oldAvailability = modelConfig.isAvailable;
          modelConfig.isAvailable = result.isAvailable;
          modelConfig.lastChecked = result.testTimestamp;
          modelConfig.responseTime = result.responseTime;
          
          // 如果可用性发生变化，触发事件
          if (oldAvailability !== result.isAvailable) {
            this.notifySingleModelUpdate(providerId, {
              type: result.isAvailable ? 'model_became_available' : 'model_became_unavailable',
              providerId,
              modelId,
              timestamp: Date.now(),
              details: { result }
            });
          }
        }
      }
      
      logger.debug('Model availability test completed', {
        providerId,
        modelId,
        isAvailable: result.isAvailable,
        responseTime: result.responseTime
      }, 'model-config-manager');
      
      return result.isAvailable;
      
    } catch (error) {
      logger.error('Model availability test failed', {
        providerId,
        modelId,
        error: error instanceof Error ? error.message : String(error)
      }, 'model-config-manager');
      
      return false;
    }
  }

  /**
   * 获取提供商的模型配置
   */
  getProviderModels(providerId: string): ModelConfig[] {
    const providerConfig = this.providerConfigs.get(providerId);
    return providerConfig ? providerConfig.models : [];
  }

  /**
   * 获取所有提供商的模型配置
   */
  getAllModels(): ModelConfig[] {
    const allModels: ModelConfig[] = [];
    
    for (const providerConfig of this.providerConfigs.values()) {
      allModels.push(...providerConfig.models);
    }
    
    return allModels;
  }

  /**
   * 获取可用的模型（按类别筛选）
   */
  getAvailableModels(category?: string): ModelConfig[] {
    let models = this.getAllModels().filter(m => m.isAvailable);
    
    if (category) {
      models = models.filter(m => m.category === category);
    }
    
    // 按优先级排序
    return models.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取模型配置
   */
  getModelConfig(providerId: string, modelId: string): ModelConfig | undefined {
    const providerConfig = this.providerConfigs.get(providerId);
    return providerConfig?.models.find(m => m.id === modelId);
  }

  /**
   * 开始自动发现循环
   */
  startAutoDiscovery(): void {
    if (this.discoveryIntervalId) {
      logger.warn('Auto discovery already started', {}, 'model-config-manager');
      return;
    }
    
    logger.info('Starting auto discovery loop', {
      interval: this.config.discoveryInterval + ' minutes'
    }, 'model-config-manager');
    
    this.discoveryIntervalId = setInterval(async () => {
      await this.runAutoDiscoveryCycle();
    }, this.config.discoveryInterval * 60 * 1000);
    
    // 立即执行第一次循环
    this.runAutoDiscoveryCycle().catch(error => {
      logger.error('Auto discovery cycle failed', error, 'model-config-manager');
    });
  }

  /**
   * 停止自动发现循环
   */
  stopAutoDiscovery(): void {
    if (this.discoveryIntervalId) {
      clearInterval(this.discoveryIntervalId);
      this.discoveryIntervalId = undefined;
      
      logger.info('Auto discovery stopped', {}, 'model-config-manager');
    }
  }

  /**
   * 添加模型更新监听器
   */
  addModelUpdateListener(listener: (event: ModelUpdateEvent) => void): void {
    this.updateListeners.add(listener);
  }

  /**
   * 移除模型更新监听器
   */
  removeModelUpdateListener(listener: (event: ModelUpdateEvent) => void): void {
    this.updateListeners.delete(listener);
  }

  /**
   * 获取管理器状态
   */
  getStatus(): {
    registeredProviders: string[];
    totalModels: number;
    availableModels: number;
    isAutoDiscoveryRunning: boolean;
    cacheStats: any[];
    lastUpdateTime: number;
  } {
    const cacheStats = Array.from(this.discoveries.values()).map(d => d.getCacheStats());
    
    return {
      registeredProviders: Array.from(this.discoveries.keys()),
      totalModels: this.getAllModels().length,
      availableModels: this.getAllModels().filter(m => m.isAvailable).length,
      isAutoDiscoveryRunning: !!this.discoveryIntervalId,
      cacheStats,
      lastUpdateTime: Math.max(...Array.from(this.providerConfigs.values()).map(c => c.lastUpdated))
    };
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    for (const discovery of this.discoveries.values()) {
      discovery.clearCache();
    }
    
    logger.info('All model discovery caches cleared', {}, 'model-config-manager');
  }

  /**
   * 自动发现循环
   */
  private async runAutoDiscoveryCycle(): Promise<void> {
    logger.debug('Running auto discovery cycle', {}, 'model-config-manager');
    
    const providers = Array.from(this.discoveries.keys());
    
    for (const providerId of providers) {
      try {
        await this.discoverProviderModels(providerId);
      } catch (error) {
        logger.error('Auto discovery cycle failed for provider', {
          providerId,
          error: error instanceof Error ? error.message : String(error)
        }, 'model-config-manager');
      }
      
      // 提供商发现间隔
      await this.delay(5000);
    }
  }

  /**
   * 更新提供商模型配置
   */
  private async updateProviderModelConfig(providerId: string, result: DiscoveryResult): Promise<void> {
    const discovery = this.discoveries.get(providerId)!;
    const providerConfig = this.providerConfigs.get(providerId)!;
    
    // 获取现有模型配置
    const existingModels = new Map(providerConfig.models.map(m => [m.id, m]));
    const newModels: ModelConfig[] = [];
    const updatedModels: ModelConfig[] = [];
    
    // 处理可用模型
    for (const modelId of result.availableModels) {
      const existingModel = existingModels.get(modelId);
      
      if (existingModel) {
        // 更新现有模型
        existingModel.isAvailable = true;
        existingModel.lastChecked = result.discoveryTimestamp;
        updatedModels.push(existingModel);
        
        existingModels.delete(modelId);
      } else {
        // 添加新模型
        const modelConfig = await this.createModelConfigFromDiscovery(providerId, modelId, discovery);
        newModels.push(modelConfig);
      }
    }
    
    // 处理不可用模型
    for (const modelId of result.unavailableModels) {
      const existingModel = existingModels.get(modelId);
      
      if (existingModel) {
        // 更新现有模型为不可用
        existingModel.isAvailable = false;
        existingModel.lastChecked = result.discoveryTimestamp;
        updatedModels.push(existingModel);
        
        existingModels.delete(modelId);
      }
    }
    
    // 处理不再存在的模型（标记为不可用）
    for (const existingModel of existingModels.values()) {
      existingModel.isAvailable = false;
      existingModel.lastChecked = result.discoveryTimestamp;
      updatedModels.push(existingModel);
    }
    
    // 限制模型数量
    const finalModels = [...newModels, ...updatedModels]
      .slice(0, this.config.maxModelsPerProvider)
      .sort((a, b) => b.priority - a.priority);
    
    // 更新提供商配置
    providerConfig.models = finalModels;
    providerConfig.lastUpdated = result.discoveryTimestamp;
    providerConfig.isHealthy = result.availableModels.length > 0;
    
    logger.info('Provider model config updated', {
      providerId,
      totalModels: finalModels.length,
      newModels: newModels.length,
      updatedModels: updatedModels.length,
      availableModels: result.availableModels.length,
      averageResponseTime: result.averageResponseTime
    }, 'model-config-manager');
  }

  /**
   * 从发现结果创建模型配置
   */
  private async createModelConfigFromDiscovery(providerId: string, modelId: string, discovery: DynamicModelDiscovery): Promise<ModelConfig> {
    // 测试模型可用性以获取响应时间
    const availabilityResult = await discovery.testModelAvailability(modelId, 1);
    
    // 推断模型类别
    const category = this.inferModelCategory(modelId);
    
    // 推断模型优先级
    const priority = this.inferModelPriority(modelId);
    
    return {
      id: modelId,
      name: modelId,
      description: `Discovered model: ${modelId}`,
      capabilities: {
        text: true,
        vision: false, // 需要通过测试确定
        tools: false, // 需要通过测试确定
        streaming: true
      },
      isAvailable: availabilityResult.isAvailable,
      lastChecked: availabilityResult.testTimestamp,
      responseTime: availabilityResult.responseTime,
      category,
      priority
    };
  }

  /**
   * 推断模型类别
   */
  private inferModelCategory(modelId: string): ModelConfig['category'] {
    const lowerId = modelId.toLowerCase();
    
    if (lowerId.includes('haiku') || lowerId.includes('fast') || lowerId.includes('quick')) {
      return 'background';
    }
    
    if (lowerId.includes('thinking') || lowerId.includes('reasoning') || lowerId.includes('chain')) {
      return 'thinking';
    }
    
    if (lowerId.includes('long') || lowerId.includes('context') || lowerId.includes('128k')) {
      return 'longcontext';
    }
    
    if (lowerId.includes('search') || lowerId.includes('rag') || lowerId.includes('retrieval')) {
      return 'search';
    }
    
    return 'default';
  }

  /**
   * 推断模型优先级
   */
  private inferModelPriority(modelId: string): number {
    const lowerId = modelId.toLowerCase();
    
    // 最新模型优先级最高
    if (lowerId.includes('claude-3-5') || lowerId.includes('gpt-4-turbo') || lowerId.includes('gemini-1.5-pro')) {
      return 100;
    }
    
    if (lowerId.includes('claude-3') || lowerId.includes('gpt-4') || lowerId.includes('gemini-pro')) {
      return 80;
    }
    
    if (lowerId.includes('claude-2') || lowerId.includes('gpt-3.5') || lowerId.includes('gemini-1.0')) {
      return 60;
    }
    
    // 开源模型
    if (lowerId.includes('llama') || lowerId.includes('mistral') || lowerId.includes('qwen')) {
      return 40;
    }
    
    // 未知模型默认优先级
    return 20;
  }

  /**
   * 通知模型更新监听器
   */
  private notifyModelUpdateListeners(providerId: string, result: DiscoveryResult): void {
    const providerConfig = this.providerConfigs.get(providerId);
    if (!providerConfig) return;
    
    const existingModels = new Set(
      this.providerConfigs.get(providerId)?.models.map(m => m.id) || []
    );
    
    // 检测新添加的模型
    for (const modelId of result.availableModels) {
      if (!existingModels.has(modelId)) {
        this.notifySingleModelUpdate(providerId, {
          type: 'model_added',
          providerId,
          modelId,
          timestamp: Date.now(),
          details: { result }
        });
      }
    }
  }

  /**
   * 通知单个模型更新
   */
  private notifySingleModelUpdate(providerId: string, event: ModelUpdateEvent): void {
    const fullEvent: ModelUpdateEvent = {
      ...event,
      providerId
    };
    
    for (const listener of this.updateListeners) {
      try {
        listener(fullEvent);
      } catch (error) {
        logger.error('Model update listener error', {
          providerId,
          eventId: `${event.type}-${event.modelId}`,
          error: error instanceof Error ? error.message : String(error)
        }, 'model-config-manager');
      }
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 工厂函数创建动态模型配置管理器
 */
export function createDynamicModelConfigManager(config: ModelConfigManagerConfig): DynamicModelConfigManager {
  return new DynamicModelConfigManager(config);
}

/**
 * 默认配置
 */
export const DEFAULT_MODEL_CONFIG_MANAGER_CONFIG: ModelConfigManagerConfig = {
  autoDiscovery: true,
  discoveryInterval: 30, // 30分钟
  maxModelsPerProvider: 10,
  testRetries: 3,
  testTimeout: 30000,
  enableCaching: true,
  cacheExpiry: 60 // 60分钟
};
