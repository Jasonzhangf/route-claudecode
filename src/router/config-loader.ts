/**
 * 配置加载器 - 合并用户配置和系统配置
 *
 * 设计原则：
 * 1. 用户配置：简单易用，包含模型和API Keys
 * 2. 系统配置：复杂的Provider端点和适配器配置
 * 3. 合并策略：用户配置 + 系统配置 → 完整路由配置
 *
 * @author RCC v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { secureLogger } from '../utils/secure-logger';
import { RoutingConfig, ProviderEndpoint } from './simple-router';
import { VirtualModelType } from './virtual-model-mapping';

// New simplified user config format
export interface NewUserConfig {
  providers: Record<string, {
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
    maxTokens: number;
  }>;
  routing: {
    defaultProvider: string;
    rules: Array<{
      name: string;
      provider: string;
      model: string;
    }>;
  };
  blacklistSettings?: {
    timeout429?: number;
    timeoutError?: number;
  };
  server?: {
    port?: number;
    host?: string;
    debug?: boolean;
  };
}

// Merged configuration interface
export interface MergedConfig {
  virtualModels: Record<string, {
    providers: Array<{
      providerId: string;
      model: string;
      weight: number;
      apiKeys: string[];
      endpoint: string;
      currentKeyIndex: number;
      maxTokens?: number;
      blacklist: string[];
    }>;
  }>;
  blacklistSettings: {
    timeout429: number;
    timeoutError: number;
  };
  server: {
    port: number;
    host: string;
    debug: boolean;
  };
  systemConfig?: any;
}

// Legacy user config format (for backward compatibility)
export interface UserConfig {
  virtualModels: Record<
    string,
    {
      providers: Array<{
        name: string;
        model: string;
        weight?: number;
        apiKeys: string[];
        maxTokens?: number; // User's maxTokens configuration
      }>;
    }
  >;
  blacklistSettings?: {
    timeout429?: number;
    timeoutError?: number;
  };
  server?: {
    port?: number;
    host?: string;
    debug?: boolean;
  };
}

export interface SystemConfig {
  providerTypes: Record<
    string,
    {
      endpoint: string;
      protocol: string;
      transformer: string;
      serverCompatibility?: string;
      timeout: number;
      maxRetries: number;
    }
  >;
  transformers: Record<string, any>;
  pipelineLayers: Record<string, any>;
  serverCompatibilityModules?: Record<string, {
    module: string;
    description: string;
  }>;
  connectionHandshake: {
    enabled: boolean;
    healthCheckInterval: number;
    validateApiKeys: boolean;
    timeoutMs: number;
  };
}

export interface MergedConfig extends RoutingConfig {
  server: {
    port: number;
    host: string;
    debug: boolean;
  };
  systemConfig: SystemConfig;
}

export class ConfigLoader {
  private static readonly DEFAULT_USER_CONFIG_PATH = path.join(
    process.env.HOME || '',
    '.route-claudecode',
    'config.json'
  );
  private static readonly DEFAULT_SYSTEM_CONFIG_PATH = path.join(__dirname, '../../config/system-config.json');

  /**
   * 加载并合并用户配置和系统配置
   */
  static loadConfig(userConfigPath?: string, systemConfigPath?: string): MergedConfig {
    const finalUserConfigPath = userConfigPath || this.DEFAULT_USER_CONFIG_PATH;
    const finalSystemConfigPath = systemConfigPath || this.DEFAULT_SYSTEM_CONFIG_PATH;

    // 加载用户配置
    const userConfig = this.loadUserConfig(finalUserConfigPath);

    // 加载系统配置
    const systemConfig = this.loadSystemConfig(finalSystemConfigPath);

    // 合并配置
    const mergedConfig = this.mergeConfigs(userConfig, systemConfig);

    secureLogger.info('Configuration loaded successfully', {
      userConfigPath: finalUserConfigPath,
      systemConfigPath: finalSystemConfigPath,
      virtualModelsCount: Object.keys(mergedConfig.virtualModels).length,
      totalProviders: Object.values(mergedConfig.virtualModels).reduce((sum, vm) => sum + vm.providers.length, 0),
    });

    return mergedConfig;
  }

  /**
   * 加载用户配置文件
   */
  private static loadUserConfig(configPath: string): UserConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`User config file not found: ${configPath}. Please create it from user-config.example.json`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = JSON.parse(configContent);

      // 检测配置格式并转换
      let config: UserConfig;
      if (this.isNewConfigFormat(rawConfig)) {
        config = this.convertNewConfigToLegacy(rawConfig as NewUserConfig);
        secureLogger.info('Converted new config format to legacy format', {
          configPath,
          providers: Object.keys(rawConfig.providers),
        });
      } else {
        config = rawConfig as UserConfig;
      }

      // 验证用户配置
      this.validateUserConfig(config);

      return config;
    } catch (error) {
      throw new Error(`Failed to load user config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * 检测是否为新的配置格式
   */
  private static isNewConfigFormat(config: any): boolean {
    return config.providers && config.routing && !config.virtualModels;
  }

  /**
   * 将新配置格式转换为旧格式
   */
  private static convertNewConfigToLegacy(newConfig: NewUserConfig): UserConfig {
    const virtualModels: Record<string, any> = {};

    // 为每个路由规则创建虚拟模型
    for (const rule of newConfig.routing.rules) {
      const provider = newConfig.providers[rule.provider];
      if (!provider) {
        throw new Error(`Provider '${rule.provider}' not found in providers section`);
      }

      const virtualModelName = rule.name === 'default' ? 'default' : rule.name;
      
      virtualModels[virtualModelName] = {
        providers: [{
          name: rule.provider,
          model: rule.model,
          weight: 100,
          apiKeys: [provider.apiKey],
          maxTokens: provider.maxTokens, // Preserve user's maxTokens setting
        }],
      };
    }

    // 如果没有default虚拟模型，创建一个
    if (!virtualModels.default && newConfig.routing.defaultProvider) {
      const defaultProvider = newConfig.providers[newConfig.routing.defaultProvider];
      if (defaultProvider) {
        virtualModels.default = {
          providers: [{
            name: newConfig.routing.defaultProvider,
            model: defaultProvider.defaultModel,
            weight: 100,
            apiKeys: [defaultProvider.apiKey],
            maxTokens: defaultProvider.maxTokens, // Preserve user's maxTokens setting
          }],
        };
      }
    }

    // 为所有虚拟模型类型创建配置，避免路由失败
    // 所有虚拟模型都映射到同一个默认provider
    if (newConfig.routing.defaultProvider) {
      const defaultProvider = newConfig.providers[newConfig.routing.defaultProvider];
      if (defaultProvider) {
        const providerConfig = {
          name: newConfig.routing.defaultProvider,
          model: defaultProvider.defaultModel,
          weight: 100,
          apiKeys: [defaultProvider.apiKey],
          maxTokens: defaultProvider.maxTokens,
        };

        // 为所有可能的虚拟模型类型创建配置
        const virtualModelTypes = ['premium', 'coding', 'reasoning', 'longContext', 'webSearch', 'background'];
        for (const vmType of virtualModelTypes) {
          if (!virtualModels[vmType]) {
            virtualModels[vmType] = {
              providers: [{ ...providerConfig }],
            };
          }
        }
      }
    }

    return {
      virtualModels,
      blacklistSettings: newConfig.blacklistSettings,
      server: newConfig.server,
    };
  }

  /**
   * 加载系统配置文件
   */
  private static loadSystemConfig(configPath: string): SystemConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`System config file not found: ${configPath}`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent) as SystemConfig;

      return config;
    } catch (error) {
      throw new Error(`Failed to load system config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * 验证用户配置
   */
  private static validateUserConfig(config: UserConfig): void {
    if (!config.virtualModels || typeof config.virtualModels !== 'object') {
      throw new Error('Invalid user config: virtualModels is required');
    }

    // 检查是否有default虚拟模型
    if (!config.virtualModels.default) {
      throw new Error('Invalid user config: default virtual model is required');
    }

    // 验证每个虚拟模型
    for (const [virtualModel, vmConfig] of Object.entries(config.virtualModels)) {
      if (!vmConfig.providers || !Array.isArray(vmConfig.providers) || vmConfig.providers.length === 0) {
        throw new Error(`Invalid user config: virtualModel '${virtualModel}' must have at least one provider`);
      }

      // 验证每个Provider
      for (const provider of vmConfig.providers) {
        if (!provider.name || !provider.model || !Array.isArray(provider.apiKeys) || provider.apiKeys.length === 0) {
          throw new Error(
            `Invalid user config: provider in '${virtualModel}' missing required fields (name, model, apiKeys)`
          );
        }
      }
    }
  }

  /**
   * 合并用户配置和系统配置
   */
  private static mergeConfigs(userConfig: UserConfig, systemConfig: SystemConfig): MergedConfig {
    const routingConfig: RoutingConfig = {
      virtualModels: {},
      blacklistSettings: {
        timeout429: userConfig.blacklistSettings?.timeout429 || 60000, // 1分钟
        timeoutError: userConfig.blacklistSettings?.timeoutError || 300000, // 5分钟
      },
    };

    // 转换用户配置的虚拟模型为路由配置
    for (const [virtualModelKey, vmConfig] of Object.entries(userConfig.virtualModels)) {
      const virtualModel = virtualModelKey as VirtualModelType;

      const providers: ProviderEndpoint[] = vmConfig.providers.map(userProvider => {
        // 从系统配置中查找Provider类型
        const providerType = systemConfig.providerTypes[userProvider.name];
        if (!providerType) {
          throw new Error(`Unknown provider type: ${userProvider.name}. Check system-config.json`);
        }

        return {
          providerId: `${userProvider.name}-${userProvider.model.replace(/[^a-zA-Z0-9]/g, '-')}`,
          model: userProvider.model,
          weight: userProvider.weight || 100, // 默认权重100
          apiKeys: userProvider.apiKeys,
          endpoint: providerType.endpoint,
          currentKeyIndex: 0,
          maxTokens: userProvider.maxTokens, // Pass user's maxTokens configuration
          blacklist: [],
        };
      });

      routingConfig.virtualModels[virtualModel] = {
        virtualModel,
        providers,
      };
    }

    // 构建完整配置
    const mergedConfig: MergedConfig = {
      ...routingConfig,
      server: {
        port: userConfig.server?.port || 5506,
        host: userConfig.server?.host || '0.0.0.0',
        debug: userConfig.server?.debug !== false, // 默认启用debug
      },
      systemConfig,
    };

    return mergedConfig;
  }

  /**
   * 创建默认用户配置文件
   */
  static createDefaultUserConfig(configPath?: string): string {
    const finalPath = configPath || this.DEFAULT_USER_CONFIG_PATH;
    const configDir = path.dirname(finalPath);

    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 如果配置文件已存在，不覆盖
    if (fs.existsSync(finalPath)) {
      return finalPath;
    }

    // 读取示例配置
    const exampleConfigPath = path.join(__dirname, '../../config/user-config.example.json');
    if (!fs.existsSync(exampleConfigPath)) {
      throw new Error(`Example config file not found: ${exampleConfigPath}`);
    }

    // 复制示例配置到用户配置路径
    const exampleContent = fs.readFileSync(exampleConfigPath, 'utf-8');
    fs.writeFileSync(finalPath, exampleContent, 'utf-8');

    secureLogger.info('Default user config created', { configPath: finalPath });
    return finalPath;
  }

  /**
   * 获取系统配置中的Provider信息
   */
  static getProviderInfo(systemConfig: SystemConfig, providerName: string): any {
    return systemConfig.providerTypes[providerName];
  }

  /**
   * 获取系统配置中的Transformer信息
   */
  static getTransformerInfo(systemConfig: SystemConfig, transformerName: string): any {
    return systemConfig.transformers[transformerName];
  }
}
