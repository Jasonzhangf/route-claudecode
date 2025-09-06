/**
 * Provider工厂
 *
 * 统一创建和管理各种Protocol处理器实例
 *
 * @author Jason Zhang
 */

import { OpenAIProtocolHandler, OpenAIProtocolConfig } from './openai-protocol-handler';
import { AnthropicProtocolHandler, AnthropicProtocolConfig } from './anthropic-protocol-handler';
import { ModuleInterface } from '../interfaces/module/base-module';

/**
 * 支持的Provider Protocol类型
 */
export type ProviderProtocolType = 'openai' | 'anthropic' | 'gemini';

/**
 * Provider配置接口
 */
export interface ProviderConfig {
  /** Provider Protocol类型 */
  type: ProviderProtocolType;
  /** Provider ID */
  id: string;
  /** Provider名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 特定协议的配置 */
  config: OpenAIProtocolConfig | AnthropicProtocolConfig | any;
}

/**
 * Provider创建选项
 */
export interface ProviderCreateOptions {
  /** Provider ID */
  id: string;
  /** Provider Protocol类型 */
  type: ProviderProtocolType;
  /** 特定协议的配置 */
  config: any;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * Provider工厂类
 */
export class ProviderFactory {
  private static instance: ProviderFactory;
  private createdProviders: Map<string, ModuleInterface>;

  private constructor() {
    this.createdProviders = new Map();
  }

  /**
   * 获取工厂单例
   */
  public static getInstance(): ProviderFactory {
    if (!ProviderFactory.instance) {
      ProviderFactory.instance = new ProviderFactory();
    }
    return ProviderFactory.instance;
  }

  /**
   * 创建Provider实例
   */
  public createProvider(options: ProviderCreateOptions): ModuleInterface {
    const { id, type, config, debug = false } = options;

    // 检查是否已经创建过相同ID的Provider
    if (this.createdProviders.has(id)) {
      throw new Error(`Provider with ID '${id}' already exists`);
    }

    let provider: ModuleInterface;

    try {
      switch (type) {
        case 'openai':
          provider = new OpenAIProtocolHandler(id, {
            ...config,
            debug,
          } as Partial<OpenAIProtocolConfig>);
          break;

        case 'anthropic':
          provider = new AnthropicProtocolHandler(id, {
            ...config,
            debug,
          } as Partial<AnthropicProtocolConfig>);
          break;

        case 'gemini':
          // TODO: 实现Gemini Protocol处理器
          throw new Error('Gemini Protocol handler not implemented yet');

        default:
          throw new Error(`Unsupported provider protocol type: ${type}`);
      }

      // 缓存已创建的Provider
      this.createdProviders.set(id, provider);

      if (debug) {
        console.log(`[ProviderFactory] Created ${type} provider with ID: ${id}`);
      }

      return provider;
    } catch (error) {
      if (debug) {
        console.error(`[ProviderFactory] Failed to create ${type} provider with ID: ${id}`, error);
      }
      throw error;
    }
  }

  /**
   * 批量创建Provider实例
   */
  public createProviders(configs: ProviderConfig[], debug: boolean = false): ModuleInterface[] {
    const providers: ModuleInterface[] = [];
    const errors: Array<{ id: string; error: Error }> = [];

    for (const providerConfig of configs) {
      if (!providerConfig.enabled) {
        if (debug) {
          console.log(`[ProviderFactory] Skipping disabled provider: ${providerConfig.id}`);
        }
        continue;
      }

      try {
        const provider = this.createProvider({
          id: providerConfig.id,
          type: providerConfig.type,
          config: providerConfig.config,
          debug,
        });

        providers.push(provider);
      } catch (error) {
        const errorInfo = {
          id: providerConfig.id,
          error: error as Error,
        };
        errors.push(errorInfo);

        if (debug) {
          console.error(`[ProviderFactory] Failed to create provider ${providerConfig.id}:`, error);
        }
      }
    }

    // 如果有错误，记录但不阻止其他Provider的创建
    if (errors.length > 0) {
      console.warn(
        `[ProviderFactory] Created ${providers.length} providers, failed to create ${errors.length} providers`
      );

      // 可以选择抛出聚合错误或只是警告
      if (providers.length === 0) {
        throw new Error(
          `Failed to create any providers. Errors: ${errors.map(e => `${e.id}: ${e.error.message}`).join(', ')}`
        );
      }
    }

    return providers;
  }

  /**
   * 获取已创建的Provider
   */
  public getProvider(id: string): ModuleInterface | undefined {
    return this.createdProviders.get(id);
  }

  /**
   * 获取所有已创建的Provider
   */
  public getAllProviders(): ModuleInterface[] {
    return Array.from(this.createdProviders.values());
  }

  /**
   * 检查Provider是否存在
   */
  public hasProvider(id: string): boolean {
    return this.createdProviders.has(id);
  }

  /**
   * 销毁Provider实例
   */
  public async destroyProvider(id: string): Promise<boolean> {
    const provider = this.createdProviders.get(id);

    if (!provider) {
      return false;
    }

    try {
      // 停止Provider
      await provider.stop();

      // 从缓存中移除
      this.createdProviders.delete(id);

      console.log(`[ProviderFactory] Destroyed provider: ${id}`);
      return true;
    } catch (error) {
      console.error(`[ProviderFactory] Failed to destroy provider ${id}:`, error);
      return false;
    }
  }

  /**
   * 销毁所有Provider实例
   */
  public async destroyAllProviders(): Promise<void> {
    const destroyPromises = Array.from(this.createdProviders.keys()).map(id => this.destroyProvider(id));

    await Promise.all(destroyPromises);

    console.log(`[ProviderFactory] Destroyed all providers`);
  }

  /**
   * 获取支持的Provider Protocol类型
   */
  public getSupportedTypes(): ProviderProtocolType[] {
    return ['openai', 'anthropic']; // 'gemini' 将在后续实现
  }

  /**
   * 验证Provider配置
   */
  public validateProviderConfig(config: ProviderConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基础字段验证
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Provider ID is required and must be a string');
    }

    if (!config.type || !this.getSupportedTypes().includes(config.type)) {
      errors.push(`Provider type must be one of: ${this.getSupportedTypes().join(', ')}`);
    }

    if (typeof config.enabled !== 'boolean') {
      errors.push('Provider enabled field must be a boolean');
    }

    if (!config.config || typeof config.config !== 'object') {
      errors.push('Provider config is required and must be an object');
    }

    // 特定协议配置验证
    if (config.type === 'openai' || config.type === 'anthropic') {
      const protocolConfig = config.config as OpenAIProtocolConfig | AnthropicProtocolConfig;

      if (!protocolConfig.apiKey) {
        errors.push(`${config.type} provider requires apiKey in config`);
      }

      if (!protocolConfig.defaultModel) {
        errors.push(`${config.type} provider requires defaultModel in config`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取工厂状态信息
   */
  public getFactoryStatus() {
    const providers = this.getAllProviders();

    return {
      totalProviders: providers.length,
      providerIds: providers.map(p => p.getId()),
      supportedTypes: this.getSupportedTypes(),
      createdAt: new Date().toISOString(),
    };
  }
}
