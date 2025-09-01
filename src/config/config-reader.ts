/**
 * 配置读取器 - 直接读取Demo1格式，无任何格式转换
 * 遵循用户指令：读取是一次性的，不进行格式转换
 *
 * @author RCC v4.0
 */

import { JQJsonHandler } from '../utils/jq-json-handler';
import { secureLogger } from '../utils/secure-logger';
import { ProviderExpander, ExpandedRouting } from './provider-expander';
import { ConfigError } from '../types/error';
import { getServerPort, getServerHost } from '../constants/server-defaults';

/**
 * Demo1用户配置文件格式 - 支持新的统一格式
 */
export interface UserConfig {
  Providers: Array<{
    name: string;
    priority?: number; // 新增：Provider优先级
    protocol?: string; // 新统一格式：协议类型，自动决定transformer
    api_base_url: string;
    api_key: string;
    models: string[];
    weight?: number;
    maxTokens?: number;
    serverCompatibility?: {
      use: string; // 新统一格式：服务器兼容性类型
      options?: Record<string, any>; // 兼容性选项
    };
    // 向后兼容旧格式
    transformer?: {
      use?: string[];
    };
  }>;
  // 支持多provider路由格式，如: "qwen,model1;shuaihong,model2"
  router?: Record<string, string>; // virtualModel -> "provider1,model1;provider2,model2;..."
  Router?: Record<string, string>; // 向后兼容大写字段
  // 可选的安全备用路由配置
  security?: Record<string, string>; // virtualModel -> "provider,model"
  blacklistSettings?: {
    timeout429?: number;
    timeoutError?: number;
  };
  server?: {
    port?: number;
    host?: string;
    debug?: boolean;
  };
  APIKEY?: string;
}

/**
 * 系统配置文件格式
 */
export interface SystemConfig {
  providerTypes: Record<string, {
    endpoint: string;
    protocol: string;
    transformer: string;
    serverCompatibility?: string;
    timeout: number;
    maxRetries: number;
  }>;
  transformers: Record<string, any>;
  pipelineLayers: Record<string, any>;
  serverCompatibilityModules: Record<string, any>;
  connectionHandshake: {
    enabled: boolean;
    healthCheckInterval: number;
    validateApiKeys: boolean;
    timeoutMs: number;
  };
}

/**
 * 合并后的完整配置 (支持展开的provider配置)
 */
export interface MergedConfig {
  // 用户配置部分 (直接从Demo1读取)
  providers: UserConfig['Providers'];
  router: UserConfig['Router'];
  // 新增：展开后的路由配置 (可选，仅当存在复杂路由时生成)
  expandedRouting?: ExpandedRouting;
  // 可选的安全增强配置
  security?: Record<string, string>;
  server: {
    port: number;
    host: string;
    debug: boolean;
  };
  apiKey: string;
  blacklistSettings: {
    timeout429: number;
    timeoutError: number;
  };
  
  // 系统配置部分
  systemConfig: SystemConfig;
}

/**
 * 配置读取器 - 无格式转换
 */
export class ConfigReader {
  
  /**
   * 加载和合并配置 - 直接读取，无任何转换
   */
  static loadConfig(userConfigPath: string, systemConfigPath: string): MergedConfig {
    secureLogger.info('🔧 Loading configuration with direct reading (no conversions)', {
      userConfigPath,
      systemConfigPath
    });

    // 1. 使用jq直接读取用户配置 (Demo1格式)
    const userConfig = JQJsonHandler.parseJsonFile<UserConfig>(userConfigPath);
    
    // 2. 使用jq直接读取系统配置
    const systemConfig = JQJsonHandler.parseJsonFile<SystemConfig>(systemConfigPath);
    
    // 3. 验证配置格式
    this.validateUserConfig(userConfig);
    this.validateSystemConfig(systemConfig);
    
    // 4. 直接合并配置 (无格式转换)
    const mergedConfig = this.mergeConfigs(userConfig, systemConfig);
    
    const routerConfig = userConfig.router || userConfig.Router || {};
    secureLogger.info('✅ Configuration loaded successfully with direct reading', {
      userProviders: userConfig.Providers.length,
      routerRules: Object.keys(routerConfig).length,
    });

    return mergedConfig;
  }

  /**
   * 验证用户配置格式
   */
  private static validateUserConfig(config: UserConfig): void {
    if (!Array.isArray(config.Providers)) {
      throw new ConfigError('用户配置中Providers必须是数组', { config });
    }
    
    // 支持router或Router字段 (向后兼容)
    const router = config.router || config.Router;
    if (!router || typeof router !== 'object') {
      throw new ConfigError('用户配置中router/Router必须是对象', { 
        hasRouter: !!config.router,
        hasCapitalRouter: !!config.Router,
        config 
      });
    }
    
    // 验证每个Provider
    for (const provider of config.Providers) {
      // 支持apiKey或api_key字段 (向后兼容)
      const apiKey = (provider as any).apiKey || (provider as any).api_key;
      if (!provider.name || !apiKey || !Array.isArray(provider.models)) {
        throw new ConfigError(`Provider配置不完整: ${provider.name || 'unknown'}`, {
          provider,
          requiredFields: ['name', 'apiKey', 'models']
        });
      }
    }
  }

  /**
   * 验证系统配置格式
   */
  private static validateSystemConfig(config: SystemConfig): void {
    if (!config.providerTypes || typeof config.providerTypes !== 'object') {
      throw new Error('系统配置中providerTypes必须是对象');
    }
    
    if (!config.transformers || typeof config.transformers !== 'object') {
      throw new Error('系统配置中transformers必须是对象');
    }
  }

  /**
   * 合并配置 - 支持展开复杂路由格式
   */
  private static mergeConfigs(userConfig: UserConfig, systemConfig: SystemConfig): MergedConfig {
    try {
      // 检测是否需要展开路由配置
      let expandedRouting: ExpandedRouting | undefined;
      const router = userConfig.router || userConfig.Router || {};
      const security = userConfig.security;
      
      // 检查是否存在复杂路由格式 (包含分号分隔的多provider路由)
      const hasComplexRouting = Object.values(router).some(routeString => 
        typeof routeString === 'string' && routeString.includes(';')
      );
      
      if (hasComplexRouting || security) {
        secureLogger.info('🔍 Detected complex routing format, expanding providers', {
          hasComplexRouting,
          hasSecurity: !!security,
          routerCategories: Object.keys(router).length,
          securityCategories: security ? Object.keys(security).length : 0
        });
        
        // 展开复杂路由配置
        expandedRouting = ProviderExpander.expandRouting(router, security, userConfig.Providers);
        
        // 验证展开后的配置
        ProviderExpander.validateExpandedRouting(expandedRouting);
        
        // 生成摘要信息用于日志
        const summary = ProviderExpander.generateRoutingSummary(expandedRouting);
        secureLogger.info('✅ Complex routing expanded successfully', summary);
      } else {
        secureLogger.info('📋 Using standard routing format, no expansion needed');
      }

      return {
        // 直接使用用户配置，无转换
        providers: userConfig.Providers,
        router: userConfig.Router || userConfig.router,
        // 新增：展开后的路由配置 (可选)
        expandedRouting,
        // 可选的安全增强配置
        security: userConfig.security,
        server: {
          port: userConfig.server?.port || getServerPort(),
          host: userConfig.server?.host || getServerHost(),
          debug: userConfig.server?.debug || false
        },
        apiKey: userConfig.APIKEY || 'rcc4-proxy-key',
        blacklistSettings: {
          timeout429: userConfig.blacklistSettings?.timeout429 || 60000,
          timeoutError: userConfig.blacklistSettings?.timeoutError || 300000
        },
        
        // 直接使用系统配置，无转换
        systemConfig
      };
    } catch (error) {
      const configError = new ConfigError('配置合并失败', {
        originalError: error,
        providersCount: userConfig.Providers.length,
        routerCategories: Object.keys(userConfig.Router || userConfig.router || {}).length
      });
      secureLogger.error('❌ Configuration merge failed', { error: configError });
      throw configError;
    }
  }
}