/**
 * Provider Expander - 多Key等价于多Provider策略
 * 
 * 核心思想：一个provider如果有N个keys，自动扩展为N个独立providers
 * 这样SimpleProviderManager可以按顺序轮询所有expanded providers，
 * 避免Provider级别的拉黑问题
 * 
 * Project owner: Jason Zhang
 */

import { logger } from '@/utils/logger';

export interface ExpandedProvider {
  providerId: string;
  originalProviderId: string;
  keyIndex: number;
  totalKeys: number;
  config: any;
}

export interface ProviderExpansionResult {
  expandedProviders: Map<string, ExpandedProvider>;
  originalProviders: Map<string, any>;
}

export class ProviderExpander {
  
  /**
   * 扩展providers配置：多Key的provider → 多个独立providers
   */
  static expandProviders(providersConfig: Record<string, any>): ProviderExpansionResult {
    const expandedProviders = new Map<string, ExpandedProvider>();
    const originalProviders = new Map<string, any>();
    
    logger.info('🔧 Starting provider expansion for multi-key routing', {
      originalProviderCount: Object.keys(providersConfig).length
    });
    
    for (const [providerId, config] of Object.entries(providersConfig)) {
      originalProviders.set(providerId, config);
      
      // 检查是否有多个API keys
      const credentials = config.authentication?.credentials;
      const apiKeys = credentials?.apiKey || credentials?.api_key;
      
      if (Array.isArray(apiKeys) && apiKeys.length > 1) {
        // 多Key provider → 扩展为多个独立providers
        logger.info(`📊 Expanding multi-key provider: ${providerId}`, {
          keyCount: apiKeys.length,
          strategy: 'multi-key-as-multi-provider'
        });
        
        for (let i = 0; i < apiKeys.length; i++) {
          const expandedProviderId = `${providerId}-key${i + 1}`;
          
          // 创建单key配置
          const expandedConfig = {
            ...config,
            authentication: {
              ...config.authentication,
              credentials: {
                ...credentials,
                apiKey: apiKeys[i], // 单个key
                api_key: apiKeys[i]
              }
            },
            // 移除keyRotation配置，因为现在是单key
            keyRotation: undefined
          };
          
          const expandedProvider: ExpandedProvider = {
            providerId: expandedProviderId,
            originalProviderId: providerId,
            keyIndex: i,
            totalKeys: apiKeys.length,
            config: expandedConfig
          };
          
          expandedProviders.set(expandedProviderId, expandedProvider);
          
          logger.debug(`✅ Created expanded provider: ${expandedProviderId}`, {
            originalProvider: providerId,
            keyIndex: i + 1,
            totalKeys: apiKeys.length
          });
        }
      } else {
        // 单Key provider → 保持原样
        const expandedProvider: ExpandedProvider = {
          providerId: providerId,
          originalProviderId: providerId,
          keyIndex: 0,
          totalKeys: 1,
          config: config
        };
        
        expandedProviders.set(providerId, expandedProvider);
        
        logger.debug(`➡️ Single-key provider unchanged: ${providerId}`);
      }
    }
    
    const totalExpanded = expandedProviders.size;
    const originalCount = Object.keys(providersConfig).length;
    const expansionRatio = Math.round((totalExpanded / originalCount) * 100) / 100;
    
    logger.info('🎯 Provider expansion completed', {
      originalProviderCount: originalCount,
      expandedProviderCount: totalExpanded,
      expansionRatio: `${expansionRatio}x`,
      multiKeyProviders: totalExpanded - originalCount
    });
    
    return {
      expandedProviders,
      originalProviders
    };
  }
  
  /**
   * 更新routing配置以使用扩展后的providers
   */
  static updateRoutingWithExpandedProviders(
    routingConfig: any,
    expandedProviders: Map<string, ExpandedProvider>
  ): any {
    const updatedRouting: any = {};
    
    for (const [category, categoryConfig] of Object.entries(routingConfig)) {
      if ((categoryConfig as any).providers) {
        // 新格式：多provider配置
        const expandedProviderList: any[] = [];
        
        for (const providerEntry of (categoryConfig as any).providers) {
          const originalProviderId = providerEntry.provider;
          
          // 查找所有扩展的providers
          const matchingProviders = Array.from(expandedProviders.values())
            .filter(ep => ep.originalProviderId === originalProviderId);
          
          if (matchingProviders.length > 1) {
            // 多key provider已被扩展
            for (const expandedProvider of matchingProviders) {
              expandedProviderList.push({
                provider: expandedProvider.providerId,
                model: providerEntry.model
              });
            }
            
            logger.debug(`🔀 Expanded routing for ${category}`, {
              originalProvider: originalProviderId,
              expandedProviders: matchingProviders.map(p => p.providerId),
              model: providerEntry.model
            });
          } else {
            // 单key provider保持原样
            expandedProviderList.push(providerEntry);
          }
        }
        
        updatedRouting[category] = {
          providers: expandedProviderList
        };
      } else {
        // 旧格式：单provider配置
        updatedRouting[category] = categoryConfig;
      }
    }
    
    logger.info('✅ Routing configuration updated with expanded providers', {
      categories: Object.keys(updatedRouting).length
    });
    
    return updatedRouting;
  }
}