/**
 * Six-Layer Router - 严格按照六层架构设计的路由器
 * 管理认证、负载均衡，但不直接调用下层
 * 
 * Project owner: Jason Zhang
 */

import { configurationManager, ConfigurationManager, CategoryConfig, ProviderRouting } from '../config/configuration-manager.js';
import { authenticationManager, AuthenticationManager } from '../auth/authentication-manager.js';
import { multiKeyManager, MultiKeyManager } from '../multikey/multikey-manager.js';

export interface RoutingDecision {
  category: string;
  providerId: string;
  targetModel: string;
  weight: number;
  isHealthy: boolean;
  authStatus: string;
  backupProviders?: string[];
}

export interface LoadBalancingState {
  roundRobinCounters: Map<string, number>;
  providerFailures: Map<string, number>;
  lastHealthCheck: Map<string, number>;
  circuitBreakers: Map<string, {
    isOpen: boolean;
    failureCount: number;
    lastFailure: number;
    nextRetry: number;
  }>;
}

export class SixLayerRouter {
  private configManager: ConfigurationManager;
  private authManager: AuthenticationManager;
  private keyManager: MultiKeyManager;
  private loadBalancingState: LoadBalancingState;

  constructor() {
    this.configManager = configurationManager;
    this.authManager = authenticationManager;
    this.keyManager = multiKeyManager;
    
    this.loadBalancingState = {
      roundRobinCounters: new Map(),
      providerFailures: new Map(),
      lastHealthCheck: new Map(),
      circuitBreakers: new Map()
    };

    console.log('🎯 Six-Layer Router initialized');
    this.initializeRouter();
  }

  /**
   * 初始化路由器
   */
  private async initializeRouter(): Promise<void> {
    try {
      // 1. 等待配置管理器加载完成
      await this.waitForConfigurationReady();
      
      // 2. 初始化认证管理
      await this.initializeAuthentication();
      
      // 3. 初始化负载均衡状态
      this.initializeLoadBalancing();
      
      // 4. 启动健康检查
      this.startHealthCheckLoop();
      
      console.log('✅ Six-Layer Router initialization completed');
    } catch (error) {
      console.error('❌ Router initialization failed:', error);
      throw error;
    }
  }

  /**
   * 等待配置管理器准备就绪
   */
  private async waitForConfigurationReady(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const stats = this.configManager.getConfigStats();
      if (stats.activeRouting.generated) {
        console.log('📋 Configuration manager is ready');
        return;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`⏳ Waiting for configuration... (${attempts}/${maxAttempts})`);
    }
    
    throw new Error('Configuration manager failed to initialize');
  }

  /**
   * 初始化认证管理
   */
  private async initializeAuthentication(): Promise<void> {
    const activeProviders = this.configManager.getActiveProviders();
    
    console.log('🔐 Initializing authentication for active providers...');
    
    for (const providerId of activeProviders) {
      const authConfig = this.configManager.getProviderAuthConfig(providerId);
      if (authConfig) {
        // 注册到认证管理器
        const authManagerConfig = {
          id: providerId,
          providerId: providerId,
          originalProviderId: providerId,
          type: authConfig.type,
          keyIndex: 0,
          totalKeys: 1,
          credentials: {
            type: authConfig.type as 'bearer' | 'api-key' | 'aws-codewhisperer' | 'oauth',
            credentials: authConfig.credentials
          }
        };
        
        this.authManager.registerAuth(authManagerConfig);
        
        // 注册到多Key管理器
        if (authConfig.credentials.apiKeys || authConfig.credentials.apiKey) {
          this.keyManager.registerKeysFromConfig(providerId, {
            authentication: {
              credentials: authConfig.credentials
            }
          });
        }
      }
    }
    
    console.log(`✅ Authentication initialized for ${activeProviders.length} providers`);
  }

  /**
   * 初始化负载均衡状态
   */
  private initializeLoadBalancing(): void {
    const activeProviders = this.configManager.getActiveProviders();
    
    for (const providerId of activeProviders) {
      this.loadBalancingState.roundRobinCounters.set(providerId, 0);
      this.loadBalancingState.providerFailures.set(providerId, 0);
      this.loadBalancingState.lastHealthCheck.set(providerId, Date.now());
      this.loadBalancingState.circuitBreakers.set(providerId, {
        isOpen: false,
        failureCount: 0,
        lastFailure: 0,
        nextRetry: 0
      });
    }
    
    console.log(`⚖️ Load balancing initialized for ${activeProviders.length} providers`);
  }

  /**
   * 启动健康检查循环
   */
  private startHealthCheckLoop(): void {
    const rules = this.configManager.getLoadBalancingRules();
    if (!rules) return;

    setInterval(() => {
      this.performHealthCheck();
    }, rules.healthCheckInterval);

    console.log(`🏥 Health check loop started (interval: ${rules.healthCheckInterval}ms)`);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const activeProviders = this.configManager.getActiveProviders();
    const rules = this.configManager.getLoadBalancingRules();
    if (!rules) return;

    for (const providerId of activeProviders) {
      const circuitBreaker = this.loadBalancingState.circuitBreakers.get(providerId);
      if (!circuitBreaker) continue;

      // 检查断路器状态
      if (circuitBreaker.isOpen && Date.now() > circuitBreaker.nextRetry) {
        console.log(`🔄 Attempting to close circuit breaker for: ${providerId}`);
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
      }

      // 更新健康检查时间
      this.loadBalancingState.lastHealthCheck.set(providerId, Date.now());
    }
  }

  /**
   * 核心路由方法 - 只做路由决策，不调用下层
   */
  public async route(request: any, requestId: string): Promise<RoutingDecision> {
    try {
      console.log(`🎯 Starting routing for request: ${requestId}`);
      
      // 1. 确定路由类别
      const category = this.determineCategory(request);
      console.log(`📂 Determined category: ${category} for request: ${requestId}`);
      
      // 2. 获取类别配置
      const categoryConfig = this.configManager.getRoutingDecision(category);
      if (!categoryConfig) {
        throw new Error(`No routing configuration found for category: ${category}`);
      }
      
      // 3. 应用模型映射规则
      const modelMapping = this.applyModelMapping(request.model, category);
      console.log(`🗺️ Model mapping applied: ${request.model} → ${modelMapping.targetModel} for request: ${requestId}`);
      
      // 4. 选择最佳provider（负载均衡）
      const selectedProvider = await this.selectBestProvider(categoryConfig, requestId);
      if (!selectedProvider) {
        throw new Error(`No available provider for category: ${category}`);
      }
      
      // 5. 构建路由决策
      const routingDecision: RoutingDecision = {
        category,
        providerId: selectedProvider.provider,
        targetModel: modelMapping.targetModel,
        weight: selectedProvider.weight,
        isHealthy: this.isProviderHealthy(selectedProvider.provider),
        authStatus: this.getProviderAuthStatus(selectedProvider.provider),
        backupProviders: this.getBackupProviders(categoryConfig, selectedProvider.provider)
      };
      
      console.log(`✅ Routing decision made for request: ${requestId}`, {
        category: routingDecision.category,
        provider: routingDecision.providerId,
        model: routingDecision.targetModel,
        healthy: routingDecision.isHealthy,
        authStatus: routingDecision.authStatus
      });
      
      return routingDecision;
      
    } catch (error) {
      console.error(`❌ Routing failed for request: ${requestId}`, error);
      throw error;
    }
  }

  /**
   * 确定请求类别
   */
  private determineCategory(request: any): string {
    // 1. 检查请求中是否明确指定类别
    if (request.category) {
      return request.category;
    }
    
    // 2. 基于模型映射规则确定类别
    if (request.model) {
      const modelMapping = this.configManager.getModelMappingRule(request.model);
      if (modelMapping) {
        return modelMapping.targetCategory;
      }
    }
    
    // 3. 基于请求特征推断类别
    if (request.messages && request.messages.length > 10) {
      return 'longcontext';
    }
    
    if (request.system?.includes('thinking') || request.system?.includes('analyze')) {
      return 'thinking';
    }
    
    if (request.system?.includes('search') || request.system?.includes('find')) {
      return 'search';
    }
    
    // 4. 默认类别
    return 'default';
  }

  /**
   * 应用模型映射规则
   */
  private applyModelMapping(inputModel: string, category: string): { targetModel: string; mappingApplied: boolean } {
    // 1. 检查显式模型映射
    const modelMapping = this.configManager.getModelMappingRule(inputModel);
    if (modelMapping) {
      return {
        targetModel: inputModel, // 使用原始模型名，让下游transformer处理
        mappingApplied: true
      };
    }
    
    // 2. 如果没有映射规则，使用类别配置中的默认模型
    const categoryConfig = this.configManager.getRoutingDecision(category);
    if (categoryConfig && categoryConfig.providers.length > 0) {
      return {
        targetModel: categoryConfig.providers[0].model,
        mappingApplied: false
      };
    }
    
    // 3. 保持原始模型
    return {
      targetModel: inputModel || 'claude-3-5-sonnet-20241022',
      mappingApplied: false
    };
  }

  /**
   * 选择最佳provider（负载均衡）
   */
  private async selectBestProvider(categoryConfig: CategoryConfig, requestId: string): Promise<ProviderRouting | null> {
    const availableProviders = categoryConfig.providers.filter(p => 
      this.isProviderAvailable(p.provider)
    );
    
    if (availableProviders.length === 0) {
      console.warn(`⚠️ No available providers for category, request: ${requestId}`);
      return null;
    }
    
    const rules = this.configManager.getLoadBalancingRules();
    if (!rules) {
      return availableProviders[0]; // 如果没有负载均衡规则，返回第一个
    }
    
    switch (rules.strategy) {
      case 'weighted_round_robin':
        return this.selectByWeightedRoundRobin(availableProviders, requestId);
      case 'least_connections':
        return this.selectByLeastConnections(availableProviders, requestId);
      case 'random':
        return this.selectByRandom(availableProviders, requestId);
      default:
        return this.selectByRoundRobin(availableProviders, requestId);
    }
  }

  /**
   * 加权轮询选择
   */
  private selectByWeightedRoundRobin(providers: ProviderRouting[], requestId: string): ProviderRouting {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const provider of providers) {
      currentWeight += provider.weight;
      if (random <= currentWeight) {
        console.log(`⚖️ Weighted round robin selected: ${provider.provider} for request: ${requestId}`);
        return provider;
      }
    }
    
    return providers[0];
  }

  /**
   * 轮询选择
   */
  private selectByRoundRobin(providers: ProviderRouting[], requestId: string): ProviderRouting {
    const categoryKey = providers.map(p => p.provider).join(',');
    const currentCount = this.loadBalancingState.roundRobinCounters.get(categoryKey) || 0;
    const selectedProvider = providers[currentCount % providers.length];
    
    this.loadBalancingState.roundRobinCounters.set(categoryKey, currentCount + 1);
    
    console.log(`🔄 Round robin selected: ${selectedProvider.provider} for request: ${requestId}`);
    return selectedProvider;
  }

  /**
   * 最少连接选择
   */
  private selectByLeastConnections(providers: ProviderRouting[], requestId: string): ProviderRouting {
    // 基于KeyManager的统计信息选择连接最少的provider
    let bestProvider = providers[0];
    let leastConnections = Number.MAX_SAFE_INTEGER;
    
    for (const provider of providers) {
      const stats = this.keyManager.getKeyStats(provider.provider);
      if (stats.concurrentRequests < leastConnections) {
        leastConnections = stats.concurrentRequests;
        bestProvider = provider;
      }
    }
    
    console.log(`📊 Least connections selected: ${bestProvider.provider} (${leastConnections} connections) for request: ${requestId}`);
    return bestProvider;
  }

  /**
   * 随机选择
   */
  private selectByRandom(providers: ProviderRouting[], requestId: string): ProviderRouting {
    const randomIndex = Math.floor(Math.random() * providers.length);
    const selectedProvider = providers[randomIndex];
    
    console.log(`🎲 Random selection: ${selectedProvider.provider} for request: ${requestId}`);
    return selectedProvider;
  }

  /**
   * 检查provider是否可用
   */
  private isProviderAvailable(providerId: string): boolean {
    // 1. 检查是否在活动列表中
    const activeProviders = this.configManager.getActiveProviders();
    if (!activeProviders.includes(providerId)) {
      return false;
    }
    
    // 2. 检查断路器状态
    const circuitBreaker = this.loadBalancingState.circuitBreakers.get(providerId);
    if (circuitBreaker?.isOpen) {
      return false;
    }
    
    // 3. 检查认证状态
    const authConfig = this.configManager.getProviderAuthConfig(providerId);
    if (authConfig?.status !== 'active') {
      return false;
    }
    
    return true;
  }

  /**
   * 检查provider健康状态
   */
  private isProviderHealthy(providerId: string): boolean {
    const stats = this.configManager.getConfigStats();
    const healthStatus = stats.activeRouting.healthStatus?.[providerId];
    return healthStatus?.status === 'healthy';
  }

  /**
   * 获取provider认证状态
   */
  private getProviderAuthStatus(providerId: string): string {
    const authConfig = this.configManager.getProviderAuthConfig(providerId);
    return authConfig?.status || 'unknown';
  }

  /**
   * 获取备用providers
   */
  private getBackupProviders(categoryConfig: CategoryConfig, selectedProvider: string): string[] {
    return categoryConfig.providers
      .filter(p => p.provider !== selectedProvider && this.isProviderAvailable(p.provider))
      .map(p => p.provider);
  }

  /**
   * 报告provider失败
   */
  public reportProviderFailure(providerId: string, error: string, requestId: string): void {
    console.warn(`⚠️ Provider failure reported: ${providerId} for request: ${requestId}`, error);
    
    // 更新失败计数
    const currentFailures = this.loadBalancingState.providerFailures.get(providerId) || 0;
    this.loadBalancingState.providerFailures.set(providerId, currentFailures + 1);
    
    // 检查断路器阈值
    const rules = this.configManager.getLoadBalancingRules();
    const circuitBreaker = this.loadBalancingState.circuitBreakers.get(providerId);
    
    if (rules && circuitBreaker && rules.circuitBreaker.enabled) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailure = Date.now();
      
      if (circuitBreaker.failureCount >= rules.circuitBreaker.failureThreshold) {
        circuitBreaker.isOpen = true;
        circuitBreaker.nextRetry = Date.now() + rules.circuitBreaker.recoveryTimeout;
        console.warn(`🚫 Circuit breaker opened for provider: ${providerId}`);
      }
    }
    
    // 通知配置管理器
    this.configManager.markProviderFailure(providerId, error);
  }

  /**
   * 报告provider成功
   */
  public reportProviderSuccess(providerId: string, requestId: string): void {
    console.log(`✅ Provider success reported: ${providerId} for request: ${requestId}`);
    
    // 重置失败计数
    this.loadBalancingState.providerFailures.set(providerId, 0);
    
    // 重置断路器
    const circuitBreaker = this.loadBalancingState.circuitBreakers.get(providerId);
    if (circuitBreaker) {
      circuitBreaker.failureCount = 0;
      circuitBreaker.isOpen = false;
    }
  }

  /**
   * 获取路由统计信息
   */
  public getRoutingStats(): any {
    return {
      configManager: this.configManager.getConfigStats(),
      authManager: this.authManager.getAuthStats(),
      keyManager: this.keyManager.getKeyStats(),
      loadBalancing: {
        roundRobinCounters: Object.fromEntries(this.loadBalancingState.roundRobinCounters),
        providerFailures: Object.fromEntries(this.loadBalancingState.providerFailures),
        circuitBreakers: Object.fromEntries(
          Array.from(this.loadBalancingState.circuitBreakers.entries()).map(([key, value]) => [
            key,
            { ...value, isOpen: value.isOpen, failureCount: value.failureCount }
          ])
        )
      }
    };
  }
}

// 全局六层路由器实例
export const sixLayerRouter = new SixLayerRouter();