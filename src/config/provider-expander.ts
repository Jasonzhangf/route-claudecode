/**
 * Provider路由展开器 - 解析复杂路由格式并生成展开后的Provider配置
 * 支持多provider路由格式和可选security增强配置
 * 
 * @author RCC v4.0
 */

import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { ConfigError, ValidationError, ERROR_CODES } from '../types/error';

/**
 * 展开后的Provider配置
 */
export interface ExpandedProvider {
  name: string;
  model: string;
  priority: number;
  isSecurityEnhanced: boolean;
  virtualModel: string;
  category: string;
  // 原始Provider配置引用
  originalProvider: {
    name: string;
    protocol?: string;
    api_base_url: string;
    api_key: string;
    models: string[];
    serverCompatibility?: {
      use: string;
      options?: Record<string, any>;
    };
    maxTokens?: number;
  };
}

/**
 * 路由解析结果
 */
export interface ExpandedRouting {
  // 主要路由 - 按优先级排序
  primaryProviders: ExpandedProvider[];
  // 可选的安全增强路由
  securityProviders: ExpandedProvider[];
  // 合并的所有路由 (主要 + 安全)
  allProviders: ExpandedProvider[];
}

/**
 * Provider路由展开器
 */
export class ProviderExpander {
  
  /**
   * 展开多provider路由配置
   * 解析格式: "provider1,model1;provider2,model2;..."
   * 支持可选的security字段
   */
  static expandRouting(
    router: Record<string, string>,
    security: Record<string, string> | undefined,
    providers: Array<any>
  ): ExpandedRouting {
    try {
      secureLogger.info('🔧 Expanding multi-provider routing configuration', {
        routerCategories: Object.keys(router).length,
        securityCategories: security ? Object.keys(security).length : 0,
        totalProviders: providers.length
      });

      const primaryProviders: ExpandedProvider[] = [];
      const securityProviders: ExpandedProvider[] = [];
      
      // 创建Provider映射表 (name -> provider config)
      const providerMap = new Map<string, any>();
      providers.forEach(provider => {
        providerMap.set(provider.name, provider);
      });
      
      let globalPriority = 1;
      
      // 1. 处理主要路由 (router section)
      for (const [virtualModel, routeString] of Object.entries(router)) {
        const expanded = this.parseRouteString(
          virtualModel,
          routeString,
          providerMap,
          false, // isSecurityEnhanced = false
          globalPriority
        );
        
        primaryProviders.push(...expanded);
        globalPriority += expanded.length;
      }
      
      // 2. 处理可选安全增强路由 (security section)
      if (security) {
        for (const [virtualModel, routeString] of Object.entries(security)) {
          const expanded = this.parseRouteString(
            virtualModel,
            routeString,
            providerMap,
            true, // isSecurityEnhanced = true
            globalPriority
          );
          
          securityProviders.push(...expanded);
          globalPriority += expanded.length;
        }
      }
      
      // 3. 合并所有Provider
      const allProviders = [...primaryProviders, ...securityProviders];
      
      secureLogger.info('✅ Provider routing expansion completed', {
        primaryProviders: primaryProviders.length,
        securityProviders: securityProviders.length,
        totalExpanded: allProviders.length
      });
      
      return {
        primaryProviders,
        securityProviders,
        allProviders
      };
    } catch (error) {
      const configError = new ConfigError('Provider路由展开失败', {
        originalError: error,
        router: Object.keys(router),
        security: security ? Object.keys(security) : undefined,
        providersCount: providers.length
      });
      secureLogger.error('❌ Provider routing expansion failed', { error: configError });
      throw configError;
    }
  }
  
  /**
   * 解析单个路由字符串
   * 格式: "provider1,model1;provider2,model2;provider3,model3"
   */
  private static parseRouteString(
    virtualModel: string,
    routeString: string,
    providerMap: Map<string, any>,
    isSecurityEnhanced: boolean,
    startPriority: number
  ): ExpandedProvider[] {
    const expanded: ExpandedProvider[] = [];
    
    try {
      // 分割路由字符串
      const routes = routeString.split(';').map(route => route.trim()).filter(route => route.length > 0);
      
      routes.forEach((route, index) => {
        const [providerName, modelName] = route.split(',').map(part => part.trim());
        
        if (!providerName || !modelName) {
          secureLogger.warn('⚠️ Invalid route format, skipping', {
            virtualModel,
            route,
            expected: 'provider,model'
          });
          return;
        }
        
        // 查找Provider配置
        const originalProvider = providerMap.get(providerName);
        if (!originalProvider) {
          secureLogger.warn('⚠️ Provider not found, skipping', {
            virtualModel,
            providerName,
            availableProviders: Array.from(providerMap.keys())
          });
          return;
        }
        
        // 验证模型是否在Provider的模型列表中
        const modelExists = originalProvider.models.some((model: any) => 
          typeof model === 'string' ? model === modelName : model.name === modelName
        );
        if (!modelExists) {
          secureLogger.warn('⚠️ Model not found in provider, skipping', {
            virtualModel,
            providerName,
            modelName,
            availableModels: originalProvider.models
          });
          return;
        }
        
        // 创建展开的Provider配置
        const expandedProvider: ExpandedProvider = {
          name: providerName,
          model: modelName,
          priority: startPriority + index,
          isSecurityEnhanced,
          virtualModel,
          category: virtualModel,
          originalProvider: {
            name: originalProvider.name,
            protocol: originalProvider.protocol,
            api_base_url: originalProvider.api_base_url,
            api_key: originalProvider.api_key,
            models: originalProvider.models,
            serverCompatibility: originalProvider.serverCompatibility,
            maxTokens: originalProvider.maxTokens || originalProvider.serverCompatibility?.options?.maxTokens
          }
        };
        
        expanded.push(expandedProvider);
        
        secureLogger.debug('📋 Route expanded', {
          virtualModel,
          providerName,
          modelName,
          priority: expandedProvider.priority,
          isSecurityEnhanced,
          maxTokens: expandedProvider.originalProvider.maxTokens
        });
      });
      
      return expanded;
    } catch (error) {
      const configError = new ConfigError(`路由字符串解析失败: ${routeString}`, {
        originalError: error,
        virtualModel,
        routeString,
        isSecurityEnhanced
      });
      secureLogger.error('❌ Route string parsing failed', { error: configError });
      throw configError;
    }
  }
  
  /**
   * 验证展开后的路由配置
   */
  static validateExpandedRouting(routing: ExpandedRouting): void {
    try {
      secureLogger.info('🔍 Validating expanded routing configuration');
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // 1. 检查是否有主要路由
      if (routing.primaryProviders.length === 0) {
        errors.push('至少需要一个主要路由配置');
      }
      
      // 2. 检查优先级是否重复
      const priorities = new Set<number>();
      routing.allProviders.forEach(provider => {
        if (priorities.has(provider.priority)) {
          warnings.push(`发现重复的优先级: ${provider.priority}`);
        }
        priorities.add(provider.priority);
      });
      
      // 3. 检查virtualModel分类
      const virtualModels = new Set<string>();
      routing.allProviders.forEach(provider => {
        virtualModels.add(provider.virtualModel);
      });
      
      // 4. 检查是否有安全增强路由但没有对应的主要路由
      routing.securityProviders.forEach(secProvider => {
        const hasPrimaryRoute = routing.primaryProviders.some(
          primary => primary.virtualModel === secProvider.virtualModel
        );
        if (!hasPrimaryRoute) {
          warnings.push(`安全增强路由 ${secProvider.virtualModel} 没有对应的主要路由`);
        }
      });
      
      // 输出验证结果
      if (errors.length > 0) {
        const validationError = new ValidationError(`路由配置验证失败: ${errors.join(', ')}`, {
          errors,
          warnings,
          totalProviders: routing.allProviders.length
        });
        secureLogger.error('❌ Routing validation failed', { error: validationError });
        throw validationError;
      }
      
      if (warnings.length > 0) {
        secureLogger.warn('⚠️ Routing validation warnings', { warnings });
      }
      
      secureLogger.info('✅ Routing validation completed', {
        totalProviders: routing.allProviders.length,
        virtualModels: Array.from(virtualModels),
        warnings: warnings.length
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      const validationError = new ValidationError('路由配置验证过程中发生错误', {
        originalError: error,
        totalProviders: routing.allProviders.length
      });
      secureLogger.error('❌ Routing validation process failed', { error: validationError });
      throw validationError;
    }
  }
  
  /**
   * 生成路由摘要信息 (用于日志和调试)
   */
  static generateRoutingSummary(routing: ExpandedRouting): Record<string, any> {
    const summary: Record<string, any> = {
      totalProviders: routing.allProviders.length,
      primaryProviders: routing.primaryProviders.length,
      securityProviders: routing.securityProviders.length,
      categories: {},
      providers: {}
    };
    
    // 按category统计
    routing.allProviders.forEach(provider => {
      if (!summary.categories[provider.category]) {
        summary.categories[provider.category] = {
          primary: 0,
          security: 0,
          models: new Set<string>()
        };
      }
      
      if (provider.isSecurityEnhanced) {
        summary.categories[provider.category].security++;
      } else {
        summary.categories[provider.category].primary++;
      }
      
      summary.categories[provider.category].models.add(provider.model);
    });
    
    // 按provider统计
    routing.allProviders.forEach(provider => {
      if (!summary.providers[provider.name]) {
        summary.providers[provider.name] = {
          categories: new Set<string>(),
          models: new Set<string>(),
          isPrimary: false,
          isSecurity: false
        };
      }
      
      summary.providers[provider.name].categories.add(provider.category);
      summary.providers[provider.name].models.add(provider.model);
      
      if (provider.isSecurityEnhanced) {
        summary.providers[provider.name].isSecurity = true;
      } else {
        summary.providers[provider.name].isPrimary = true;
      }
    });
    
    // 转换Set为Array (便于JSON序列化)
    Object.values(summary.categories).forEach((cat: any) => {
      cat.models = Array.from(cat.models);
    });
    
    Object.values(summary.providers).forEach((prov: any) => {
      prov.categories = Array.from(prov.categories);
      prov.models = Array.from(prov.models);
    });
    
    return summary;
  }
}