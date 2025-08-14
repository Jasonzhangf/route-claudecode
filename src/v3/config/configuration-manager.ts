/**
 * Configuration Manager - 统一配置管理器
 * 负责读取、验证和管理所有配置文件
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RoutingTableConfig {
  configVersion: string;
  routingTable: {
    categories: Record<string, CategoryConfig>;
  };
  modelMappingRules: {
    inputModel: Record<string, ModelMappingRule>;
    unmappedModelBehavior: {
      action: string;
      logWarning: boolean;
    };
  };
  loadBalancingRules: LoadBalancingRules;
  authenticationPolicy: AuthenticationPolicy;
  metadata: {
    description: string;
    lastUpdated: string;
    version: string;
    author: string;
  };
}

export interface CategoryConfig {
  required?: boolean;
  description: string;
  providers: ProviderRouting[];
  fallback?: {
    provider: string;
    model: string;
  };
}

export interface ProviderRouting {
  provider: string;
  model: string;
  weight: number;
  priority?: number;
}

export interface ModelMappingRule {
  targetCategory: string;
  preferredProvider: string;
}

export interface LoadBalancingRules {
  strategy: string;
  healthCheckInterval: number;
  failoverThreshold: number;
  cooldownPeriod: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

export interface AuthenticationPolicy {
  failureHandling: string;
  blacklistDuration: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
}

export interface ProviderAuthConfig {
  providerId: string;
  type: string;
  credentials: any;
  status: 'active' | 'blacklisted' | 'failed';
  lastChecked: number;
  failureCount: number;
}

export interface ActiveRoutingTable {
  version: string;
  generatedAt: number;
  activeProviders: string[];
  routingDecisions: Record<string, CategoryConfig>;
  blacklistedProviders: string[];
  healthStatus: Record<string, any>;
}

export class ConfigurationManager {
  private routingTableConfig: RoutingTableConfig | null = null;
  private providerAuthConfigs: Map<string, ProviderAuthConfig> = new Map();
  private activeRoutingTable: ActiveRoutingTable | null = null;
  private configDir: string;

  constructor() {
    this.configDir = path.join(__dirname, '../../../config');
    console.log('📋 Configuration Manager initialized');
    this.loadAllConfigurations();
  }

  /**
   * 加载所有配置文件
   */
  private async loadAllConfigurations(): Promise<void> {
    try {
      // 1. 加载主路由表
      await this.loadRoutingTable();
      
      // 2. 加载认证配置
      await this.loadAuthenticationConfigs();
      
      // 3. 生成活动路由表
      await this.generateActiveRoutingTable();
      
      console.log('✅ All configurations loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load configurations:', error);
      throw error;
    }
  }

  /**
   * 加载路由表配置
   */
  private async loadRoutingTable(): Promise<void> {
    try {
      const routingTablePath = path.join(this.configDir, 'routing-table.json');
      const content = fs.readFileSync(routingTablePath, 'utf8');
      this.routingTableConfig = JSON.parse(content);
      
      console.log('📊 Routing table loaded:', {
        categories: Object.keys(this.routingTableConfig!.routingTable.categories).length,
        version: this.routingTableConfig!.configVersion
      });
    } catch (error) {
      console.error('❌ Failed to load routing table:', error);
      throw error;
    }
  }

  /**
   * 加载认证配置（从现有provider配置中提取）
   */
  private async loadAuthenticationConfigs(): Promise<void> {
    try {
      // 从路由表中获取所有provider列表
      const allProviders = this.getAllProvidersFromRoutingTable();
      
      // 为每个provider加载认证配置
      for (const providerId of allProviders) {
        const authConfig = await this.loadProviderAuthConfig(providerId);
        if (authConfig) {
          this.providerAuthConfigs.set(providerId, authConfig);
        }
      }
      
      console.log('🔐 Authentication configs loaded:', {
        providers: this.providerAuthConfigs.size
      });
    } catch (error) {
      console.error('❌ Failed to load authentication configs:', error);
      throw error;
    }
  }

  /**
   * 从路由表中获取所有provider列表
   */
  private getAllProvidersFromRoutingTable(): string[] {
    if (!this.routingTableConfig) return [];
    
    const providers = new Set<string>();
    
    for (const [categoryName, categoryConfig] of Object.entries(this.routingTableConfig.routingTable.categories)) {
      for (const providerRouting of categoryConfig.providers) {
        providers.add(providerRouting.provider);
      }
      
      // 添加fallback provider
      if (categoryConfig.fallback) {
        providers.add(categoryConfig.fallback.provider);
      }
    }
    
    return Array.from(providers);
  }

  /**
   * 加载单个provider的认证配置
   */
  private async loadProviderAuthConfig(providerId: string): Promise<ProviderAuthConfig | null> {
    try {
      // 尝试从多个可能的配置文件中加载
      const possiblePaths = [
        path.join(this.configDir, `providers/${providerId}.json`),
        path.join(this.configDir, `system/provider-auth/${providerId}.json`),
        path.join(this.configDir, `user/${providerId}-auth.json`)
      ];
      
      for (const configPath of possiblePaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(content);
          
          return {
            providerId,
            type: config.authentication?.type || config.type || 'unknown',
            credentials: config.authentication?.credentials || config.credentials || {},
            status: 'active',
            lastChecked: Date.now(),
            failureCount: 0
          };
        }
      }
      
      console.warn(`⚠️ No auth config found for provider: ${providerId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to load auth config for ${providerId}:`, error);
      return null;
    }
  }

  /**
   * 生成活动路由表（基于认证状态）
   */
  private async generateActiveRoutingTable(): Promise<void> {
    if (!this.routingTableConfig) {
      throw new Error('Routing table config not loaded');
    }

    const activeProviders: string[] = [];
    const blacklistedProviders: string[] = [];
    const healthStatus: Record<string, any> = {};
    const routingDecisions: Record<string, CategoryConfig> = {};

    // 检查每个provider的认证状态
    for (const [providerId, authConfig] of this.providerAuthConfigs) {
      const isHealthy = await this.checkProviderHealth(providerId, authConfig);
      
      healthStatus[providerId] = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastChecked: Date.now(),
        authStatus: authConfig.status
      };

      if (isHealthy && authConfig.status === 'active') {
        activeProviders.push(providerId);
      } else {
        blacklistedProviders.push(providerId);
      }
    }

    // 基于活动provider生成路由决策
    for (const [categoryName, categoryConfig] of Object.entries(this.routingTableConfig.routingTable.categories)) {
      const activeProvidersInCategory = categoryConfig.providers.filter(
        p => activeProviders.includes(p.provider)
      );

      if (activeProvidersInCategory.length > 0) {
        routingDecisions[categoryName] = {
          ...categoryConfig,
          providers: activeProvidersInCategory
        };
      } else if (categoryConfig.required) {
        console.warn(`⚠️ Required category '${categoryName}' has no active providers`);
        // 保留原配置但标记为不健康
        routingDecisions[categoryName] = categoryConfig;
      }
    }

    this.activeRoutingTable = {
      version: this.routingTableConfig.configVersion,
      generatedAt: Date.now(),
      activeProviders,
      routingDecisions,
      blacklistedProviders,
      healthStatus
    };

    // 保存活动路由表到文件
    await this.saveActiveRoutingTable();

    console.log('🎯 Active routing table generated:', {
      activeProviders: activeProviders.length,
      blacklistedProviders: blacklistedProviders.length,
      activeCategories: Object.keys(routingDecisions).length
    });
  }

  /**
   * 检查provider健康状态
   */
  private async checkProviderHealth(providerId: string, authConfig: ProviderAuthConfig): Promise<boolean> {
    try {
      // 基本认证配置检查
      if (!authConfig.credentials) {
        console.warn(`⚠️ No credentials for provider: ${providerId}`);
        return false;
      }

      // 这里可以添加更多的健康检查逻辑
      // 例如：API endpoint检查、认证测试等
      
      return true;
    } catch (error) {
      console.error(`❌ Health check failed for ${providerId}:`, error);
      return false;
    }
  }

  /**
   * 保存活动路由表到文件
   */
  private async saveActiveRoutingTable(): Promise<void> {
    try {
      const generatedDir = path.join(this.configDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      const activeRoutingPath = path.join(generatedDir, 'active-routing.json');
      fs.writeFileSync(activeRoutingPath, JSON.stringify(this.activeRoutingTable, null, 2));
      
      console.log('💾 Active routing table saved to:', activeRoutingPath);
    } catch (error) {
      console.error('❌ Failed to save active routing table:', error);
    }
  }

  /**
   * 获取路由决策
   */
  public getRoutingDecision(category: string): CategoryConfig | null {
    if (!this.activeRoutingTable) return null;
    return this.activeRoutingTable.routingDecisions[category] || null;
  }

  /**
   * 获取模型映射规则
   */
  public getModelMappingRule(inputModel: string): ModelMappingRule | null {
    if (!this.routingTableConfig) return null;
    return this.routingTableConfig.modelMappingRules.inputModel[inputModel] || null;
  }

  /**
   * 获取负载均衡规则
   */
  public getLoadBalancingRules(): LoadBalancingRules | null {
    return this.routingTableConfig?.loadBalancingRules || null;
  }

  /**
   * 获取认证策略
   */
  public getAuthenticationPolicy(): AuthenticationPolicy | null {
    return this.routingTableConfig?.authenticationPolicy || null;
  }

  /**
   * 获取provider认证配置
   */
  public getProviderAuthConfig(providerId: string): ProviderAuthConfig | null {
    return this.providerAuthConfigs.get(providerId) || null;
  }

  /**
   * 获取活动provider列表
   */
  public getActiveProviders(): string[] {
    return this.activeRoutingTable?.activeProviders || [];
  }

  /**
   * 获取黑名单provider列表
   */
  public getBlacklistedProviders(): string[] {
    return this.activeRoutingTable?.blacklistedProviders || [];
  }

  /**
   * 标记provider为失败状态
   */
  public markProviderFailure(providerId: string, error: string): void {
    const authConfig = this.providerAuthConfigs.get(providerId);
    if (authConfig) {
      authConfig.failureCount++;
      authConfig.lastChecked = Date.now();
      
      const policy = this.getAuthenticationPolicy();
      if (policy && authConfig.failureCount >= policy.retryPolicy.maxRetries) {
        authConfig.status = 'blacklisted';
        console.warn(`🚫 Provider blacklisted due to failures: ${providerId}`);
        
        // 重新生成活动路由表
        this.generateActiveRoutingTable();
      }
    }
  }

  /**
   * 重新加载配置
   */
  public async reloadConfigurations(): Promise<void> {
    console.log('🔄 Reloading configurations...');
    await this.loadAllConfigurations();
  }

  /**
   * 获取配置统计信息
   */
  public getConfigStats(): any {
    return {
      routingTable: {
        categories: this.routingTableConfig ? Object.keys(this.routingTableConfig.routingTable.categories).length : 0,
        version: this.routingTableConfig?.configVersion
      },
      authentication: {
        totalProviders: this.providerAuthConfigs.size,
        activeProviders: this.getActiveProviders().length,
        blacklistedProviders: this.getBlacklistedProviders().length
      },
      activeRouting: {
        generated: !!this.activeRoutingTable,
        generatedAt: this.activeRoutingTable?.generatedAt,
        activeCategories: this.activeRoutingTable ? Object.keys(this.activeRoutingTable.routingDecisions).length : 0
      }
    };
  }
}

// 全局配置管理器实例
export const configurationManager = new ConfigurationManager();