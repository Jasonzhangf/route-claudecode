/**
 * Intelligent Key Router for Gemini Provider
 * 
 * 实现基于429频率的智能多key轮询和降级模型策略
 * 
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 */

import { secureLogger } from '../../utils/secure-logger';

export interface KeyStats {
  keyId: string;
  keyIndex: number;
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  currentCooldown: number;
  lastSuccess: Date | null;
  lastRateLimit: Date | null;
  currentPriority: 'high' | 'medium' | 'backup' | 'disabled';
  consecutiveFailures: number;
  avgResponseTime: number;
}

export interface ModelTierInfo {
  name: string;
  tier: 'premium' | 'standard' | 'basic';
  allowedKeys: number[];
  fallbackChain: string[];
  currentFailures: number;
  lastFailure: Date | null;
  adaptiveCooldown: number;
}

export interface RoutingDecision {
  selectedKey: {
    apiKey: string;
    keyIndex: number;
    keyId: string;
  };
  selectedModel: string;
  reasoning: string;
  fallbacksAvailable: string[];
  estimatedWaitTime?: number;
}

export interface RoutingConfig {
  keyRotationStrategy: {
    strategy: string;
    cooldownMs: number;
    maxRetriesPerKey: number;
    rateLimitCooldownMs: number;
    keyPriority: Array<{
      keyIndex: number;
      priority: string;
      maxConcurrent: number;
      allowedTiers: string[];
    }>;
  };
  fallbackStrategy: {
    fallbackChains: Record<string, string[]>;
    rateLimitMonitoring: {
      enabled: boolean;
      windowSizeMinutes: number;
      maxFailuresBeforeFallback: number;
      recoveryCheckIntervalMinutes: number;
      adaptiveCooldown: {
        enabled: boolean;
        baseCooldownMs: number;
        maxCooldownMs: number;
        backoffMultiplier: number;
      };
    };
  };
  modelTiers: {
    premium: any[];
    standard: any[];
    basic: any[];
  };
}

/**
 * 智能Key路由器类
 */
export class IntelligentKeyRouter {
  private keyStats: Map<number, KeyStats> = new Map();
  private modelTiers: Map<string, ModelTierInfo> = new Map();
  private config: RoutingConfig;
  private apiKeys: string[];
  private concurrentRequests: Map<number, number> = new Map();
  
  constructor(config: RoutingConfig, apiKeys: string[]) {
    this.config = config;
    this.apiKeys = apiKeys;
    this.initializeKeyStats();
    this.initializeModelTiers();
    
    secureLogger.info('🧠 智能Key路由器已初始化', {
      totalKeys: apiKeys.length,
      premiumModels: config.modelTiers.premium.length,
      standardModels: config.modelTiers.standard.length,
      basicModels: config.modelTiers.basic.length
    });
  }
  
  /**
   * 初始化API Key统计信息
   */
  private initializeKeyStats(): void {
    this.apiKeys.forEach((apiKey, index) => {
      const keyId = apiKey.substring(-8);
      const priorityConfig = this.config.keyRotationStrategy.keyPriority.find(p => p.keyIndex === index);
      
      this.keyStats.set(index, {
        keyId,
        keyIndex: index,
        totalRequests: 0,
        successfulRequests: 0,
        rateLimitedRequests: 0,
        currentCooldown: 0,
        lastSuccess: null,
        lastRateLimit: null,
        currentPriority: (priorityConfig?.priority as any) || 'backup',
        consecutiveFailures: 0,
        avgResponseTime: 0
      });
      
      this.concurrentRequests.set(index, 0);
    });
  }
  
  /**
   * 初始化模型分级信息
   */
  private initializeModelTiers(): void {
    // Premium模型
    this.config.modelTiers.premium.forEach(model => {
      this.modelTiers.set(model.name, {
        name: model.name,
        tier: 'premium',
        allowedKeys: this.config.keyRotationStrategy.keyPriority
          .filter(kp => kp.allowedTiers.includes('premium'))
          .map(kp => kp.keyIndex),
        fallbackChain: this.config.fallbackStrategy.fallbackChains[model.name] || [],
        currentFailures: 0,
        lastFailure: null,
        adaptiveCooldown: 0
      });
    });
    
    // Standard模型
    this.config.modelTiers.standard.forEach(model => {
      this.modelTiers.set(model.name, {
        name: model.name,
        tier: 'standard',
        allowedKeys: this.config.keyRotationStrategy.keyPriority
          .filter(kp => kp.allowedTiers.includes('standard'))
          .map(kp => kp.keyIndex),
        fallbackChain: this.config.fallbackStrategy.fallbackChains[model.name] || [],
        currentFailures: 0,
        lastFailure: null,
        adaptiveCooldown: 0
      });
    });
    
    // Basic模型
    this.config.modelTiers.basic.forEach(model => {
      this.modelTiers.set(model.name, {
        name: model.name,
        tier: 'basic',
        allowedKeys: this.config.keyRotationStrategy.keyPriority
          .filter(kp => kp.allowedTiers.includes('basic'))
          .map(kp => kp.keyIndex),
        fallbackChain: this.config.fallbackStrategy.fallbackChains[model.name] || [],
        currentFailures: 0,
        lastFailure: null,
        adaptiveCooldown: 0
      });
    });
  }
  
  /**
   * 智能路由决策 - 选择最佳的Key和Model组合
   */
  async selectOptimalRoute(requestedModel: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<RoutingDecision> {
    secureLogger.debug('🎯 开始智能路由决策', { requestedModel, priority });
    
    // 1. 检查请求的模型是否可用
    let targetModel = requestedModel;
    let modelInfo = this.modelTiers.get(requestedModel);
    
    if (!modelInfo) {
      // 如果请求的模型不存在，尝试找到最接近的替代模型
      targetModel = this.findBestAlternativeModel(requestedModel);
      modelInfo = this.modelTiers.get(targetModel);
      
      if (!modelInfo) {
        throw new Error(`无法找到可用的模型: ${requestedModel}`);
      }
    }
    
    // 2. 检查模型当前是否处于冷却状态
    if (this.isModelInCooldown(modelInfo)) {
      const fallbackModel = await this.selectFallbackModel(targetModel);
      if (fallbackModel) {
        targetModel = fallbackModel;
        modelInfo = this.modelTiers.get(targetModel)!;
      }
    }
    
    // 3. 为选定的模型选择最佳API Key
    const bestKey = await this.selectBestKeyForModel(modelInfo, priority);
    
    if (!bestKey) {
      // 如果没有可用的Key，尝试降级到其他模型
      const fallbackModel = await this.selectFallbackModel(targetModel);
      if (fallbackModel) {
        targetModel = fallbackModel;
        modelInfo = this.modelTiers.get(targetModel)!;
        const fallbackKey = await this.selectBestKeyForModel(modelInfo, 'low');
        
        if (fallbackKey) {
          return {
            selectedKey: fallbackKey,
            selectedModel: targetModel,
            reasoning: `原模型${requestedModel}的所有Key都不可用，降级到${targetModel}`,
            fallbacksAvailable: modelInfo.fallbackChain,
            estimatedWaitTime: this.estimateRecoveryTime(requestedModel)
          };
        }
      }
      
      throw new Error(`没有可用的API Key和模型组合`);
    }
    
    // 4. 更新并发计数
    this.concurrentRequests.set(bestKey.keyIndex, 
      (this.concurrentRequests.get(bestKey.keyIndex) || 0) + 1);
    
    const reasoning = this.generateRoutingReasoning(requestedModel, targetModel, bestKey, modelInfo);
    
    secureLogger.info('✅ 路由决策完成', {
      requestedModel,
      selectedModel: targetModel,
      selectedKey: bestKey.keyId,
      reasoning
    });
    
    return {
      selectedKey: bestKey,
      selectedModel: targetModel,
      reasoning,
      fallbacksAvailable: modelInfo.fallbackChain
    };
  }
  
  /**
   * 为指定模型选择最佳API Key
   */
  private async selectBestKeyForModel(modelInfo: ModelTierInfo, priority: 'high' | 'normal' | 'low'): Promise<{
    apiKey: string;
    keyIndex: number;
    keyId: string;
  } | null> {
    const now = Date.now();
    const availableKeys = modelInfo.allowedKeys
      .map(keyIndex => this.keyStats.get(keyIndex)!)
      .filter(stats => {
        // 过滤掉正在冷却中的Key
        if (stats.currentCooldown > 0 && now < stats.currentCooldown) {
          return false;
        }
        
        // 检查并发限制
        const priorityConfig = this.config.keyRotationStrategy.keyPriority
          .find(p => p.keyIndex === stats.keyIndex);
        const currentConcurrent = this.concurrentRequests.get(stats.keyIndex) || 0;
        
        if (priorityConfig && currentConcurrent >= priorityConfig.maxConcurrent) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => this.calculateKeyScore(a, priority) - this.calculateKeyScore(b, priority));
    
    if (availableKeys.length === 0) {
      return null;
    }
    
    const bestKey = availableKeys[0];
    return {
      apiKey: this.apiKeys[bestKey.keyIndex],
      keyIndex: bestKey.keyIndex,
      keyId: bestKey.keyId
    };
  }
  
  /**
   * 计算API Key的评分 (越低越好)
   */
  private calculateKeyScore(keyStats: KeyStats, priority: 'high' | 'normal' | 'low'): number {
    let score = 0;
    
    // 基础优先级分数
    const priorityScores = { high: 0, medium: 10, backup: 20, disabled: 1000 };
    score += priorityScores[keyStats.currentPriority] || 50;
    
    // 成功率分数 (失败率越高分数越高)
    const successRate = keyStats.totalRequests > 0 
      ? keyStats.successfulRequests / keyStats.totalRequests 
      : 1;
    score += (1 - successRate) * 100;
    
    // 最近429频率分数
    const recentRateLimitPenalty = keyStats.lastRateLimit 
      ? Math.max(0, 30 - (Date.now() - keyStats.lastRateLimit.getTime()) / 60000) // 30分钟内的429给予惩罚
      : 0;
    score += recentRateLimitPenalty;
    
    // 连续失败惩罚
    score += keyStats.consecutiveFailures * 5;
    
    // 响应时间分数
    score += keyStats.avgResponseTime / 100; // 将毫秒转换为分数
    
    // 根据请求优先级调整
    if (priority === 'high' && keyStats.currentPriority === 'high') {
      score *= 0.5; // 高优先级请求偏向高优先级Key
    } else if (priority === 'low' && keyStats.currentPriority === 'backup') {
      score *= 0.8; // 低优先级请求可以使用备用Key
    }
    
    return score;
  }
  
  /**
   * 选择降级模型
   */
  private async selectFallbackModel(originalModel: string): Promise<string | null> {
    const modelInfo = this.modelTiers.get(originalModel);
    if (!modelInfo || modelInfo.fallbackChain.length === 0) {
      return null;
    }
    
    // 遍历降级链，找到第一个可用的模型
    for (const fallbackModel of modelInfo.fallbackChain) {
      const fallbackInfo = this.modelTiers.get(fallbackModel);
      if (fallbackInfo && !this.isModelInCooldown(fallbackInfo)) {
        // 检查是否有可用的Key
        const hasAvailableKey = fallbackInfo.allowedKeys.some(keyIndex => {
          const keyStats = this.keyStats.get(keyIndex);
          if (!keyStats) return false;
          
          const now = Date.now();
          return keyStats.currentCooldown === 0 || now >= keyStats.currentCooldown;
        });
        
        if (hasAvailableKey) {
          secureLogger.info('🔄 启用降级模型', { 
            original: originalModel, 
            fallback: fallbackModel 
          });
          return fallbackModel;
        }
      }
    }
    
    return null;
  }
  
  /**
   * 检查模型是否处于冷却状态
   */
  private isModelInCooldown(modelInfo: ModelTierInfo): boolean {
    if (!this.config.fallbackStrategy.rateLimitMonitoring.enabled) {
      return false;
    }
    
    if (modelInfo.currentFailures < this.config.fallbackStrategy.rateLimitMonitoring.maxFailuresBeforeFallback) {
      return false;
    }
    
    if (!modelInfo.lastFailure) {
      return false;
    }
    
    const cooldownDuration = Math.min(
      this.config.fallbackStrategy.rateLimitMonitoring.adaptiveCooldown.baseCooldownMs * 
      Math.pow(this.config.fallbackStrategy.rateLimitMonitoring.adaptiveCooldown.backoffMultiplier, 
               modelInfo.currentFailures - this.config.fallbackStrategy.rateLimitMonitoring.maxFailuresBeforeFallback),
      this.config.fallbackStrategy.rateLimitMonitoring.adaptiveCooldown.maxCooldownMs
    );
    
    const timeSinceLastFailure = Date.now() - modelInfo.lastFailure.getTime();
    return timeSinceLastFailure < cooldownDuration;
  }
  
  /**
   * 寻找最佳替代模型
   */
  private findBestAlternativeModel(requestedModel: string): string {
    // 简单的模型匹配逻辑，可以根据需要扩展
    const modelNames = Array.from(this.modelTiers.keys());
    
    // 尝试找到版本相近的模型
    if (requestedModel.includes('2.5')) {
      const gemini25Models = modelNames.filter(name => name.includes('2.5'));
      if (gemini25Models.length > 0) {
        return gemini25Models[0];
      }
    }
    
    if (requestedModel.includes('2.0')) {
      const gemini20Models = modelNames.filter(name => name.includes('2.0'));
      if (gemini20Models.length > 0) {
        return gemini20Models[0];
      }
    }
    
    // 默认返回第一个可用模型
    return modelNames[0] || 'gemini-2.5-flash';
  }
  
  /**
   * 生成路由决策的解释
   */
  private generateRoutingReasoning(
    requestedModel: string, 
    selectedModel: string, 
    selectedKey: { keyId: string; keyIndex: number }, 
    modelInfo: ModelTierInfo
  ): string {
    const keyStats = this.keyStats.get(selectedKey.keyIndex)!;
    const concurrent = this.concurrentRequests.get(selectedKey.keyIndex) || 0;
    
    let reasoning = `选择Key ${selectedKey.keyId} (${keyStats.currentPriority}优先级, 成功率${this.calculateSuccessRate(keyStats)}%, 当前并发${concurrent})`;
    
    if (requestedModel !== selectedModel) {
      reasoning += ` | 模型降级: ${requestedModel} → ${selectedModel}`;
    }
    
    reasoning += ` | 模型层级: ${modelInfo.tier}`;
    
    return reasoning;
  }
  
  /**
   * 计算成功率
   */
  private calculateSuccessRate(keyStats: KeyStats): number {
    if (keyStats.totalRequests === 0) return 100;
    return Math.round((keyStats.successfulRequests / keyStats.totalRequests) * 100);
  }
  
  /**
   * 估算恢复时间
   */
  private estimateRecoveryTime(model: string): number {
    const modelInfo = this.modelTiers.get(model);
    if (!modelInfo || !modelInfo.lastFailure) return 0;
    
    const baseCooldown = this.config.fallbackStrategy.rateLimitMonitoring.adaptiveCooldown.baseCooldownMs;
    const backoffMultiplier = this.config.fallbackStrategy.rateLimitMonitoring.adaptiveCooldown.backoffMultiplier;
    
    return baseCooldown * Math.pow(backoffMultiplier, modelInfo.currentFailures);
  }
  
  /**
   * 记录请求结果
   */
  recordRequestResult(
    keyIndex: number, 
    model: string, 
    isSuccess: boolean, 
    isRateLimited: boolean, 
    responseTime: number
  ): void {
    // 更新Key统计
    const keyStats = this.keyStats.get(keyIndex);
    if (keyStats) {
      keyStats.totalRequests++;
      
      if (isSuccess) {
        keyStats.successfulRequests++;
        keyStats.consecutiveFailures = 0;
        keyStats.lastSuccess = new Date();
        keyStats.currentCooldown = 0;
      } else {
        keyStats.consecutiveFailures++;
        
        if (isRateLimited) {
          keyStats.rateLimitedRequests++;
          keyStats.lastRateLimit = new Date();
          
          // 设置自适应冷却
          const cooldown = Math.min(
            this.config.keyRotationStrategy.rateLimitCooldownMs * 
            Math.pow(1.5, keyStats.consecutiveFailures),
            600000 // 最大10分钟
          );
          keyStats.currentCooldown = Date.now() + cooldown;
          
          secureLogger.warn('⚠️ API Key遇到429限制', {
            keyId: keyStats.keyId,
            consecutiveFailures: keyStats.consecutiveFailures,
            cooldownMs: cooldown
          });
        }
      }
      
      // 更新平均响应时间
      keyStats.avgResponseTime = (keyStats.avgResponseTime * (keyStats.totalRequests - 1) + responseTime) / keyStats.totalRequests;
    }
    
    // 更新模型统计
    const modelInfo = this.modelTiers.get(model);
    if (modelInfo) {
      if (isSuccess) {
        modelInfo.currentFailures = 0;
        modelInfo.adaptiveCooldown = 0;
      } else if (isRateLimited) {
        modelInfo.currentFailures++;
        modelInfo.lastFailure = new Date();
        
        secureLogger.warn('⚠️ 模型遇到频率限制', {
          model,
          failures: modelInfo.currentFailures,
          threshold: this.config.fallbackStrategy.rateLimitMonitoring.maxFailuresBeforeFallback
        });
      }
    }
    
    // 减少并发计数
    this.concurrentRequests.set(keyIndex, Math.max(0, (this.concurrentRequests.get(keyIndex) || 0) - 1));
  }
  
  /**
   * 获取当前路由器状态
   */
  getRouterStatus(): {
    keyStats: KeyStats[];
    modelStats: Array<{
      name: string;
      tier: string;
      failures: number;
      inCooldown: boolean;
      allowedKeys: number;
    }>;
    totalConcurrentRequests: number;
  } {
    const keyStats = Array.from(this.keyStats.values());
    const modelStats = Array.from(this.modelTiers.values()).map(model => ({
      name: model.name,
      tier: model.tier,
      failures: model.currentFailures,
      inCooldown: this.isModelInCooldown(model),
      allowedKeys: model.allowedKeys.length
    }));
    
    const totalConcurrentRequests = Array.from(this.concurrentRequests.values())
      .reduce((sum, concurrent) => sum + concurrent, 0);
    
    return { keyStats, modelStats, totalConcurrentRequests };
  }
}