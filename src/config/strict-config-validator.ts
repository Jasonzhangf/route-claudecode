/**
 * 严格配置验证器 - 启动时验证必选字段
 * 
 * 目的：防止错误配置导致的运行时问题
 * 策略：配置错误时立即终止启动，不允许错误传播
 * 
 * @author RCC v4.0 配置增强
 */

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedConfig?: any;
  normalized?: any;
}

export class StrictConfigValidator {
  
  /**
   * 验证完整配置文件
   */
  static validateConfig(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedConfig = { ...config };

    // 1. 基础结构验证
    if (!config) {
      errors.push('配置文件为空或无效');
      return { isValid: false, errors, warnings };
    }

    // 2. 版本验证
    if (!config.version || !config.version.startsWith('4.')) {
      errors.push(`不支持的配置版本: ${config.version}，要求4.x版本`);
    }

    // 3. Providers验证
    const providersResult = this.validateProviders(config);
    errors.push(...providersResult.errors);
    warnings.push(...providersResult.warnings);
    if (providersResult.normalized) {
      normalizedConfig.providers = providersResult.normalized;
    }

    // 4. Router/routing验证
    const routerResult = this.validateRouter(config);
    errors.push(...routerResult.errors);
    warnings.push(...routerResult.warnings);
    if (routerResult.normalized) {
      normalizedConfig.router = routerResult.normalized;
    }

    // 5. 服务器配置验证
    const serverResult = this.validateServer(config);
    errors.push(...serverResult.errors);
    warnings.push(...serverResult.warnings);

    // 6. 交叉引用验证
    const crossRefResult = this.validateCrossReferences(normalizedConfig);
    errors.push(...crossRefResult.errors);
    warnings.push(...crossRefResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedConfig: errors.length === 0 ? normalizedConfig : undefined
    };
  }

  /**
   * 验证Providers配置
   */
  private static validateProviders(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 支持大小写变体
    const providers = config.providers || config.Providers;
    
    if (!providers) {
      errors.push('缺少必选字段: providers (或Providers)');
      return { isValid: false, errors, warnings };
    }

    if (!Array.isArray(providers)) {
      errors.push('providers必须是数组');
      return { isValid: false, errors, warnings };
    }

    if (providers.length === 0) {
      errors.push('providers数组不能为空');
      return { isValid: false, errors, warnings };
    }

    const normalizedProviders: any[] = [];

    providers.forEach((provider: any, index: number) => {
      const providerErrors: string[] = [];
      
      // 必选字段验证
      if (!provider.name) {
        providerErrors.push(`providers[${index}].name 是必选字段`);
      }
      
      // 支持多种URL字段名
      const baseURL = provider.baseURL || provider.api_base_url || provider.base_url;
      if (!baseURL) {
        providerErrors.push(`providers[${index}] 缺少API地址字段 (baseURL/api_base_url/base_url)`);
      }
      
      // 支持多种API密钥字段名
      const apiKey = provider.apiKey || provider.api_key;
      if (!apiKey) {
        providerErrors.push(`providers[${index}] 缺少API密钥字段 (apiKey/api_key)`);
      }

      // 模型验证
      if (!provider.models || provider.models.length === 0) {
        providerErrors.push(`providers[${index}].models 不能为空`);
      }

      errors.push(...providerErrors);

      // 标准化provider配置
      if (providerErrors.length === 0) {
        normalizedProviders.push({
          ...provider,
          baseURL: baseURL,
          apiKey: apiKey
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalized: normalizedProviders
    };
  }

  /**
   * 验证Router配置
   */
  private static validateRouter(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 支持大小写和不同字段名
    const router = config.router || config.Router || config.routing;
    
    if (!router) {
      errors.push('缺少必选字段: router (或Router/routing)');
      return { isValid: false, errors, warnings };
    }

    // 必须有default路由
    if (!router.default) {
      errors.push('router配置必须包含default路由规则');
    }

    // 验证路由格式
    Object.entries(router).forEach(([key, value]) => {
      if (typeof value !== 'string') {
        errors.push(`router.${key} 必须是字符串格式 (provider,model)`);
        return;
      }
      
      const routeStr = value as string;
      if (!routeStr.includes(',')) {
        errors.push(`router.${key} 格式错误，应为 'provider,model' 格式: ${routeStr}`);
        return;
      }

      const parts = routeStr.split(',').map(s => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        errors.push(`router.${key} 解析失败，provider或model为空: ${routeStr}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalized: router
    };
  }

  /**
   * 验证Server配置
   */
  private static validateServer(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!config.server) {
      warnings.push('缺少server配置，将使用默认值');
      return { isValid: true, errors, warnings };
    }

    const server = config.server;
    
    if (server.port && (server.port < 1024 || server.port > 65535)) {
      warnings.push(`端口号 ${server.port} 可能不合适，建议使用1024-65535范围`);
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * 验证交叉引用关系
   */
  private static validateCrossReferences(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const providers = config.providers || [];
    const router = config.router || {};
    
    // 验证路由引用的provider是否存在
    const providerNames = new Set(providers.map((p: any) => p.name));
    
    Object.entries(router).forEach(([routeName, routeValue]) => {
      const routeStr = routeValue as string;
      const [providerName, modelName] = routeStr.split(',').map(s => s.trim());
      
      if (!providerNames.has(providerName)) {
        errors.push(`router.${routeName} 引用了不存在的provider: ${providerName}`);
        return;
      }

      // 验证模型是否存在
      const provider = providers.find((p: any) => p.name === providerName);
      if (provider && provider.models) {
        const models = Array.isArray(provider.models) 
          ? provider.models.map((m: any) => typeof m === 'string' ? m : m.name)
          : [];
        
        if (!models.includes(modelName)) {
          warnings.push(`router.${routeName} 引用了provider ${providerName} 中不存在的模型: ${modelName}`);
        }
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * 打印验证结果
   */
  static printValidationResult(result: ConfigValidationResult): void {
    console.log('\n🔍 ====== RCC v4.0 配置验证结果 ======');
    
    if (result.isValid) {
      console.log('✅ 配置验证通过');
    } else {
      console.log('❌ 配置验证失败');
    }

    if (result.errors.length > 0) {
      console.log('\n🚨 配置错误:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ 配置警告:');
      result.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    if (!result.isValid) {
      console.log('\n💥 启动终止: 请修复配置错误后重新启动');
      console.log('=====================================\n');
    } else {
      console.log('\n🚀 配置验证完成，服务启动中...');
      console.log('=====================================\n');
    }
  }
}