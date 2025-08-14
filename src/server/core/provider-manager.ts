/**
 * Provider Management Module
 * 
 * 管理Provider的生命周期、查找和验证
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { Provider, ProviderConfig, RouterConfig } from '@/types';
import { CodeWhispererProvider } from '@/providers/codewhisperer';
import { createOpenAIClient } from '@/providers/openai/client-factory';
import { AnthropicProvider } from '@/providers/anthropic';
import { GeminiProvider } from '@/providers/gemini';

export interface ProviderManagerDependencies {
  config: RouterConfig;
  logger: any;
}

export class ProviderManager {
  private providers: Map<string, Provider> = new Map();
  
  constructor(private deps: ProviderManagerDependencies) {}

  /**
   * 初始化所有Provider
   */
  initializeProviders(): void {
    this.deps.logger.info('Initializing providers', {
      count: Object.keys(this.deps.config.providers || {}).length
    });

    for (const [providerId, providerConfig] of Object.entries(this.deps.config.providers || {})) {
      try {
        const provider = this.createProvider(providerId, providerConfig);
        this.providers.set(providerId, provider);
        
        this.deps.logger.info(`Provider ${providerId} initialized`, {
          type: providerConfig.type,
          name: provider.name
        });
      } catch (error) {
        this.deps.logger.error(`Failed to initialize provider ${providerId}`, {
          error: error instanceof Error ? error.message : String(error),
          config: providerConfig
        });
        // Continue with other providers
      }
    }

    this.deps.logger.info('Provider initialization completed', {
      totalProviders: this.providers.size,
      successfullyInitialized: Array.from(this.providers.keys())
    });
  }

  /**
   * 创建Provider实例
   */
  private createProvider(providerId: string, config: ProviderConfig): Provider {
    const commonConfig = {
      ...config,
      port: this.deps.config.server.port
    };

    switch (config.type) {
      case 'codewhisperer':
        return new CodeWhispererProvider(providerId);
      case 'openai':
        return createOpenAIClient(commonConfig, providerId, this.deps.config);
      case 'anthropic':
        return new AnthropicProvider(commonConfig);
      case 'gemini':
        return new GeminiProvider(commonConfig, providerId);
      case 'lmstudio':
        console.log('🎯 [PROVIDER-MANAGER] Creating OpenAI client for LMStudio:', { providerId, config: config.type });
        const lmstudioClient = createOpenAIClient(commonConfig, providerId);
        console.log('✅ [PROVIDER-MANAGER] OpenAI client for LMStudio created:', { 
          providerId, 
          clientName: lmstudioClient.name,
          clientType: lmstudioClient.type 
        });
        return lmstudioClient;
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }

  /**
   * 根据ID查找Provider
   */
  findProvider(providerId: string): Provider | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * 根据ID查找Provider（抛出异常如果未找到）
   */
  getProvider(providerId: string): Provider {
    const provider = this.findProvider(providerId);
    
    if (!provider) {
      const availableProviders = Array.from(this.providers.keys());
      throw new Error(
        `Provider '${providerId}' not found. Available providers: ${availableProviders.join(', ')}`
      );
    }
    
    return provider;
  }

  /**
   * 从Provider池中选择一个可用的Provider
   */
  selectProviderFromPool(providers: string[], originalProviderId: string): string {
    // 首先尝试原始Provider
    if (providers.includes(originalProviderId)) {
      const provider = this.findProvider(originalProviderId);
      if (provider) {
        return originalProviderId;
      }
    }

    // 尝试其他Provider
    for (const providerId of providers) {
      const provider = this.findProvider(providerId);
      if (provider) {
        this.deps.logger.info(`Selected alternative provider: ${providerId} (original: ${originalProviderId})`);
        return providerId;
      }
    }

    // 如果都不可用，抛出错误而不是使用fallback
    this.deps.logger.error(`No healthy providers available for original: ${originalProviderId}`, {
      requestedProviders: providers,
      timestamp: new Date().toISOString()
    });
    throw new Error(`No healthy providers available. Requested: ${providers.join(', ')}. Original: ${originalProviderId}`);
  }

  /**
   * 获取所有Provider
   */
  getAllProviders(): Map<string, Provider> {
    return new Map(this.providers);
  }

  /**
   * 获取Provider列表
   */
  getProviderList(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 获取Provider数量
   */
  getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * 检查Provider是否存在
   */
  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * 获取健康的Provider列表
   */
  async getHealthyProviders(): Promise<string[]> {
    const healthyProviders: string[] = [];
    
    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        if (isHealthy) {
          healthyProviders.push(providerId);
        }
      } catch (error) {
        this.deps.logger.warn(`Health check failed for provider ${providerId}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Provider被视为不健康
      }
    }
    
    return healthyProviders;
  }

  /**
   * 获取不健康的Provider列表
   */
  async getUnhealthyProviders(): Promise<Array<{ providerId: string; error?: string }>> {
    const unhealthyProviders: Array<{ providerId: string; error?: string }> = [];
    
    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) {
          unhealthyProviders.push({ providerId });
        }
      } catch (error) {
        unhealthyProviders.push({
          providerId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return unhealthyProviders;
  }

  /**
   * 验证Provider健康状态
   */
  async validateProvider(provider: Provider): Promise<boolean> {
    try {
      return await provider.isHealthy();
    } catch (error) {
      this.deps.logger.warn(`Provider validation failed`, {
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 获取Provider统计信息
   */
  async getProviderStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        stats[providerId] = {
          name: provider.name || providerId,
          healthy: isHealthy,
          type: this.getProviderType(providerId)
        };
      } catch (error) {
        stats[providerId] = {
          name: provider.name || providerId,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: this.getProviderType(providerId)
        };
      }
    }
    
    return stats;
  }

  /**
   * 获取Provider类型
   */
  private getProviderType(providerId: string): string {
    const provider = this.providers.get(providerId);
    if (!provider) return 'unknown';
    
    // 尝试从provider配置中获取类型
    const providerConfig = this.deps.config.providers?.[providerId];
    if (providerConfig?.type) {
      return providerConfig.type;
    }
    
    // 根据providerId推断类型
    if (providerId.includes('anthropic')) return 'anthropic';
    if (providerId.includes('openai') || providerId.includes('modelscope') || providerId.includes('lmstudio')) return 'openai';
    if (providerId.includes('gemini') || providerId.includes('google')) return 'gemini';
    return 'codewhisperer';
  }

  /**
   * 关闭所有Provider
   */
  async shutdown(): Promise<void> {
    this.deps.logger.info('Shutting down providers', {
      count: this.providers.size
    });
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [providerId, provider] of this.providers) {
      if ('shutdown' in provider && typeof provider.shutdown === 'function') {
        shutdownPromises.push(
          (provider as any).shutdown().catch((error: any) => {
            this.deps.logger.error(`Failed to shutdown provider ${providerId}`, {
              error: error instanceof Error ? error.message : String(error)
            });
          })
        );
      }
    }
    
    await Promise.all(shutdownPromises);
    this.providers.clear();
    
    this.deps.logger.info('All providers shut down');
  }
}

/**
 * 创建Provider Manager实例的工厂函数
 */
export function createProviderManager(deps: ProviderManagerDependencies): ProviderManager {
  return new ProviderManager(deps);
}