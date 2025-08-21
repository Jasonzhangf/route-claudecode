/**
 * Provider映射工具
 * 
 * 基于配置文件进行Provider映射，消除硬编码
 * 
 * @author Jason Zhang
 */

import { API_DEFAULTS } from '../constants/api-defaults';

export interface ProviderMappingConfig {
  modelToProvider: Record<string, string>;
  defaultProvider: string;
  providerAliases: Record<string, string>;
}

/**
 * Provider映射器
 */
export class ProviderMapper {
  private config: ProviderMappingConfig;

  constructor(config?: Partial<ProviderMappingConfig>) {
    this.config = {
      modelToProvider: config?.modelToProvider || API_DEFAULTS.PROVIDER_MAPPING.MODEL_TO_PROVIDER,
      defaultProvider: config?.defaultProvider || API_DEFAULTS.PROVIDER_MAPPING.DEFAULT_PROVIDER,
      providerAliases: config?.providerAliases || API_DEFAULTS.PROVIDER_MAPPING.PROVIDER_ALIASES,
    };
  }

  /**
   * 从模型名称推断Provider
   */
  inferProviderFromModel(modelName: string): string {
    if (!modelName) {
      return this.config.defaultProvider;
    }

    const lowerModel = modelName.toLowerCase();

    // 检查精确匹配
    if (this.config.modelToProvider[lowerModel]) {
      return this.config.modelToProvider[lowerModel];
    }

    // 检查部分匹配
    for (const [pattern, provider] of Object.entries(this.config.modelToProvider)) {
      if (lowerModel.includes(pattern)) {
        return provider;
      }
    }

    return this.config.defaultProvider;
  }

  /**
   * 解析Provider别名
   */
  resolveProviderAlias(providerName: string): string {
    if (!providerName) {
      return this.config.defaultProvider;
    }

    const lowerProvider = providerName.toLowerCase();
    return this.config.providerAliases[lowerProvider] || providerName;
  }

  /**
   * 从请求头提取Provider
   */
  extractProviderFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
    const providerHeader = headers['x-provider'] || headers['X-Provider'];
    
    if (providerHeader) {
      const provider = Array.isArray(providerHeader) ? providerHeader[0] : providerHeader;
      return this.resolveProviderAlias(provider);
    }

    return null;
  }

  /**
   * 从URL路径提取Provider
   */
  extractProviderFromUrl(url: string): string | null {
    if (!url) return null;

    const urlMatch = url.match(/\/api\/v1\/providers\/([^\/]+)/);
    if (urlMatch) {
      return this.resolveProviderAlias(urlMatch[1]);
    }

    return null;
  }

  /**
   * 综合提取目标Provider
   */
  extractTargetProvider(options: {
    headers?: Record<string, string | string[] | undefined>;
    url?: string;
    model?: string;
  }): string {
    const { headers, url, model } = options;

    // 优先级1: 明确指定的Provider
    if (headers) {
      const headerProvider = this.extractProviderFromHeaders(headers);
      if (headerProvider) {
        return headerProvider;
      }
    }

    // 优先级2: URL路径中的Provider
    if (url) {
      const urlProvider = this.extractProviderFromUrl(url);
      if (urlProvider) {
        return urlProvider;
      }
    }

    // 优先级3: 从模型名称推断
    if (model) {
      return this.inferProviderFromModel(model);
    }

    // 默认Provider
    return this.config.defaultProvider;
  }

  /**
   * 更新映射配置
   */
  updateConfig(newConfig: Partial<ProviderMappingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ProviderMappingConfig {
    return { ...this.config };
  }

  /**
   * 添加模型到Provider映射
   */
  addModelMapping(modelPattern: string, provider: string): void {
    this.config.modelToProvider[modelPattern.toLowerCase()] = provider;
  }

  /**
   * 添加Provider别名
   */
  addProviderAlias(alias: string, provider: string): void {
    this.config.providerAliases[alias.toLowerCase()] = provider;
  }

  /**
   * 获取所有支持的Provider
   */
  getSupportedProviders(): string[] {
    const providers = new Set<string>();
    
    // 从模型映射中收集Provider
    Object.values(this.config.modelToProvider).forEach(provider => providers.add(provider));
    
    // 从别名映射中收集Provider
    Object.values(this.config.providerAliases).forEach(provider => providers.add(provider));
    
    // 添加默认Provider
    providers.add(this.config.defaultProvider);

    return Array.from(providers).sort();
  }
}

/**
 * 默认Provider映射器实例
 */
export const defaultProviderMapper = new ProviderMapper();

/**
 * 创建自定义Provider映射器
 */
export function createProviderMapper(config?: Partial<ProviderMappingConfig>): ProviderMapper {
  return new ProviderMapper(config);
}