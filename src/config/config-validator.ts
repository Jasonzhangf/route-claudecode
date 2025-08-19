/**
 * RCC v4.0 Configuration Validator
 *
 * 提供配置验证逻辑，包括模式验证、业务规则检查和数据完整性验证
 *
 * @author Jason Zhang
 */

import { secureLogger } from '../utils/secure-logger';
import {
  RCCv4Config,
  ServerCompatibilityProvider,
  StandardProvider,
  ConfigValidationResult,
  LayerConfig,
  RouteConfig,
} from './config-types';

/**
 * 验证规则配置
 */
export interface ValidationRules {
  version: {
    supported: string[];
    required: boolean;
  };
  providers: {
    minEnabledCount: number;
    requireLMStudio: boolean;
    requiredFields: string[];
  };
  routing: {
    minRoutes: number;
    requiredLayers: string[];
    enforceZeroFallback: boolean;
  };
  security: {
    requiredFields: string[];
    encryptionRequired: boolean;
  };
}

/**
 * 默认验证规则
 */
const DEFAULT_VALIDATION_RULES: ValidationRules = {
  version: {
    supported: ['4.0.0'],
    required: true,
  },
  providers: {
    minEnabledCount: 1,
    requireLMStudio: false,
    requiredFields: ['id', 'name', 'enabled', 'type', 'connection', 'models', 'features'],
  },
  routing: {
    minRoutes: 1,
    requiredLayers: ['transformer', 'protocol', 'server-compatibility', 'server'],
    enforceZeroFallback: true,
  },
  security: {
    requiredFields: ['encryption', 'authentication', 'authorization'],
    encryptionRequired: false,
  },
};

/**
 * 配置验证器
 */
export class ConfigValidator {
  private rules: ValidationRules;

  constructor(customRules?: Partial<ValidationRules>) {
    this.rules = this.mergeRules(DEFAULT_VALIDATION_RULES, customRules);
  }

  /**
   * 验证完整配置
   */
  async validate(config: RCCv4Config): Promise<ConfigValidationResult> {
    secureLogger.debug('🔍 开始配置验证');

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 基础结构验证
      this.validateBasicStructure(config, errors);

      // 版本验证
      this.validateVersion(config, errors);

      // Provider验证
      this.validateProviders(config, errors, warnings);

      // 路由验证
      this.validateRouting(config, errors, warnings);

      // 安全配置验证
      this.validateSecurity(config, errors, warnings);

      // 业务规则验证
      this.validateBusinessRules(config, errors, warnings);

      const isValid = errors.length === 0;

      if (isValid) {
        secureLogger.info('✅ 配置验证通过');
      } else {
        secureLogger.error('❌ 配置验证失败', { errors, warnings });
      }

      return {
        isValid,
        valid: isValid,
        errors,
        warnings,
      };
    } catch (error) {
      secureLogger.error('❌ 配置验证过程中发生错误', { error: error.message });
      errors.push(`Validation process error: ${error.message}`);

      return {
        isValid: false,
        valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * 验证基础结构
   */
  private validateBasicStructure(config: any, errors: string[]): void {
    if (!config) {
      errors.push('Configuration is null or undefined');
      return;
    }

    if (typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return;
    }

    const requiredTopLevelFields = [
      'version',
      'serverCompatibilityProviders',
      'standardProviders',
      'routing',
      'security',
      'validation',
    ];

    for (const field of requiredTopLevelFields) {
      if (!(field in config)) {
        errors.push(`Missing required top-level field: ${field}`);
      }
    }
  }

  /**
   * 验证版本
   */
  private validateVersion(config: RCCv4Config, errors: string[]): void {
    if (!this.rules.version.required) {
      return;
    }

    if (!config.version) {
      errors.push('Version is required');
      return;
    }

    if (!this.rules.version.supported.includes(config.version)) {
      errors.push(
        `Unsupported version: ${config.version}. Supported versions: ${this.rules.version.supported.join(', ')}`
      );
    }
  }

  /**
   * 验证Provider配置
   */
  private validateProviders(config: RCCv4Config, errors: string[], warnings: string[]): void {
    // 验证Server-Compatibility Providers
    this.validateProviderGroup(config.serverCompatibilityProviders, 'server-compatibility', errors, warnings);

    // 验证Standard Providers
    this.validateProviderGroup(config.standardProviders, 'server', errors, warnings);

    // 验证启用的Provider数量
    const enabledProviders = this.getEnabledProviders(config);
    if (enabledProviders.length < this.rules.providers.minEnabledCount) {
      errors.push(`At least ${this.rules.providers.minEnabledCount} provider(s) must be enabled`);
    }

    // 检查LM Studio Provider (如果需要)
    if (this.rules.providers.requireLMStudio) {
      const hasLMStudio = this.hasLMStudioProvider(config);
      if (!hasLMStudio) {
        errors.push('LM Studio provider is required but not found');
      }
    } else {
      // 非必需但给出警告
      const hasLMStudio = this.hasLMStudioProvider(config);
      if (!hasLMStudio) {
        warnings.push('No LM Studio provider found - this may limit functionality');
      }
    }
  }

  /**
   * 验证Provider组
   */
  private validateProviderGroup(
    providers: Record<string, any>,
    expectedType: string,
    errors: string[],
    warnings: string[]
  ): void {
    if (!providers || typeof providers !== 'object') {
      errors.push(`Invalid providers configuration for type: ${expectedType}`);
      return;
    }

    for (const [providerId, provider] of Object.entries(providers)) {
      this.validateSingleProvider(provider, expectedType, providerId, errors, warnings);
    }
  }

  /**
   * 验证单个Provider
   */
  private validateSingleProvider(
    provider: any,
    expectedType: string,
    providerId: string,
    errors: string[],
    warnings: string[]
  ): void {
    const prefix = `Provider ${providerId}`;

    // 验证必需字段
    for (const field of this.rules.providers.requiredFields) {
      if (!(field in provider)) {
        errors.push(`${prefix}: Missing required field '${field}'`);
      }
    }

    // 验证类型
    if (provider.type !== expectedType) {
      errors.push(`${prefix}: Expected type '${expectedType}', got '${provider.type}'`);
    }

    // 验证连接配置
    this.validateProviderConnection(provider.connection, prefix, errors);

    // 验证模型配置
    this.validateProviderModels(provider.models, prefix, errors, warnings);

    // 验证功能配置
    this.validateProviderFeatures(provider.features, prefix, errors);
  }

  /**
   * 验证Provider连接配置
   */
  private validateProviderConnection(connection: any, prefix: string, errors: string[]): void {
    if (!connection) {
      errors.push(`${prefix}: Missing connection configuration`);
      return;
    }

    const requiredConnectionFields = ['baseUrl', 'timeout', 'maxRetries'];
    for (const field of requiredConnectionFields) {
      if (!(field in connection)) {
        errors.push(`${prefix}: Missing required connection field '${field}'`);
      }
    }

    // 验证URL格式
    if (connection.baseUrl && !this.isValidUrl(connection.baseUrl)) {
      errors.push(`${prefix}: Invalid baseUrl format`);
    }

    // 验证数值范围
    if (connection.timeout && (connection.timeout < 0 || connection.timeout > 300000)) {
      errors.push(`${prefix}: Timeout must be between 0 and 300000ms`);
    }

    if (connection.maxRetries && (connection.maxRetries < 0 || connection.maxRetries > 10)) {
      errors.push(`${prefix}: MaxRetries must be between 0 and 10`);
    }
  }

  /**
   * 验证Provider模型配置
   */
  private validateProviderModels(models: any, prefix: string, errors: string[], warnings: string[]): void {
    if (!models) {
      errors.push(`${prefix}: Missing models configuration`);
      return;
    }

    if (!models.supportedModels || !Array.isArray(models.supportedModels)) {
      errors.push(`${prefix}: supportedModels must be an array`);
    }

    if (!models.defaultModel) {
      errors.push(`${prefix}: defaultModel is required`);
    }

    // 检查默认模型是否在支持列表中
    if (models.defaultModel && models.supportedModels && !models.supportedModels.includes(models.defaultModel)) {
      warnings.push(`${prefix}: defaultModel '${models.defaultModel}' is not in supportedModels list`);
    }
  }

  /**
   * 验证Provider功能配置
   */
  private validateProviderFeatures(features: any, prefix: string, errors: string[]): void {
    if (!features) {
      errors.push(`${prefix}: Missing features configuration`);
      return;
    }

    const requiredFeatures = ['chat', 'streaming'];
    for (const feature of requiredFeatures) {
      if (!(feature in features)) {
        errors.push(`${prefix}: Missing required feature '${feature}'`);
      }
    }
  }

  /**
   * 验证路由配置
   */
  private validateRouting(config: RCCv4Config, errors: string[], warnings: string[]): void {
    if (!config.routing) {
      errors.push('Missing routing configuration');
      return;
    }

    // 验证流水线架构
    this.validatePipelineArchitecture(config.routing.pipelineArchitecture, errors);

    // 验证路由
    this.validateRoutes(config.routing.routes, errors, warnings);

    // 验证路由配置
    this.validateRoutingConfiguration(config.routing.configuration, errors, warnings);
  }

  /**
   * 验证流水线架构
   */
  private validatePipelineArchitecture(architecture: any, errors: string[]): void {
    if (!architecture) {
      errors.push('Missing pipeline architecture configuration');
      return;
    }

    if (!architecture.layers || !Array.isArray(architecture.layers)) {
      errors.push('Pipeline architecture layers must be an array');
      return;
    }

    // 验证必需层
    const layerNames = architecture.layers.map((l: LayerConfig) => l.name);
    for (const requiredLayer of this.rules.routing.requiredLayers) {
      if (!layerNames.includes(requiredLayer)) {
        errors.push(`Required pipeline layer missing: ${requiredLayer}`);
      }
    }

    // 验证层顺序
    this.validateLayerOrder(architecture.layers, errors);
  }

  /**
   * 验证层顺序
   */
  private validateLayerOrder(layers: LayerConfig[], errors: string[]): void {
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedLayers.length; i++) {
      if (sortedLayers[i].order !== i + 1) {
        errors.push(
          `Invalid layer order: expected order ${i + 1}, got ${sortedLayers[i].order} for layer ${sortedLayers[i].name}`
        );
      }
    }
  }

  /**
   * 验证路由
   */
  private validateRoutes(routes: RouteConfig[], errors: string[], warnings: string[]): void {
    if (!routes || !Array.isArray(routes)) {
      errors.push('Routes must be an array');
      return;
    }

    if (routes.length < this.rules.routing.minRoutes) {
      errors.push(`At least ${this.rules.routing.minRoutes} route(s) must be configured`);
    }

    // 验证每个路由
    routes.forEach((route, index) => {
      this.validateSingleRoute(route, index, errors, warnings);
    });

    // 验证路由ID唯一性
    this.validateRouteUniqueness(routes, errors);
  }

  /**
   * 验证单个路由
   */
  private validateSingleRoute(route: RouteConfig, index: number, errors: string[], warnings: string[]): void {
    const prefix = `Route ${index}`;

    const requiredFields = ['id', 'name', 'enabled', 'priority', 'conditions', 'pipeline'];
    for (const field of requiredFields) {
      if (!(field in route)) {
        errors.push(`${prefix}: Missing required field '${field}'`);
      }
    }

    // 验证优先级
    if (route.priority && (route.priority < 1 || route.priority > 100)) {
      warnings.push(`${prefix}: Priority should be between 1 and 100`);
    }
  }

  /**
   * 验证路由唯一性
   */
  private validateRouteUniqueness(routes: RouteConfig[], errors: string[]): void {
    const routeIds = new Set<string>();
    const routeNames = new Set<string>();

    routes.forEach((route, index) => {
      if (routeIds.has(route.id)) {
        errors.push(`Duplicate route ID: ${route.id}`);
      } else {
        routeIds.add(route.id);
      }

      if (routeNames.has(route.name)) {
        errors.push(`Duplicate route name: ${route.name}`);
      } else {
        routeNames.add(route.name);
      }
    });
  }

  /**
   * 验证路由配置
   */
  private validateRoutingConfiguration(configuration: any, errors: string[], warnings: string[]): void {
    if (!configuration) {
      errors.push('Missing routing configuration');
      return;
    }

    // 强制验证零fallback策略 - Zero Fallback Policy Rule ZF-003
    if (!configuration.zeroFallbackPolicy) {
      errors.push(
        'Zero fallback policy must be enabled (zeroFallbackPolicy: true). See .claude/rules/zero-fallback-policy.md'
      );
    }

    // 检查并拒绝任何fallback相关配置 - Zero Fallback Policy Rule ZF-003
    const fallbackFields = ['fallback', 'backup', 'secondary', 'emergency', 'fallbackChain'];
    for (const field of fallbackFields) {
      if (field in configuration) {
        errors.push(`Fallback configuration '${field}' is prohibited by Zero Fallback Policy Rule ZF-003`);
      }
    }

    // 验证超时配置
    if (configuration.requestTimeout && configuration.requestTimeout < 1000) {
      warnings.push('Request timeout is very low (< 1000ms), this may cause issues');
    }
  }

  /**
   * 验证安全配置
   */
  private validateSecurity(config: RCCv4Config, errors: string[], warnings: string[]): void {
    if (!config.security) {
      errors.push('Missing security configuration');
      return;
    }

    // 验证必需的安全字段
    for (const field of this.rules.security.requiredFields) {
      if (!(field in config.security)) {
        errors.push(`Missing required security field: ${field}`);
      }
    }

    // 验证加密配置
    if (
      this.rules.security.encryptionRequired &&
      (!config.security.encryption || !config.security.encryption.enabled)
    ) {
      errors.push('Encryption is required but not enabled');
    }
  }

  /**
   * 验证业务规则
   */
  private validateBusinessRules(config: RCCv4Config, errors: string[], warnings: string[]): void {
    // 检查Provider和路由的一致性
    this.validateProviderRouteConsistency(config, warnings);

    // 检查模型映射的一致性
    this.validateModelMappingConsistency(config, warnings);
  }

  /**
   * 验证Provider和路由的一致性
   */
  private validateProviderRouteConsistency(config: RCCv4Config, warnings: string[]): void {
    const enabledProviders = this.getEnabledProviders(config);
    const enabledRoutes = config.routing.routes.filter(r => r.enabled);

    if (enabledProviders.length > 0 && enabledRoutes.length === 0) {
      warnings.push('Providers are enabled but no routes are enabled');
    }

    if (enabledProviders.length === 0 && enabledRoutes.length > 0) {
      warnings.push('Routes are enabled but no providers are enabled');
    }
  }

  /**
   * 验证模型映射的一致性
   */
  private validateModelMappingConsistency(config: RCCv4Config, warnings: string[]): void {
    // 这里可以添加模型映射的一致性检查
    // 例如检查路由中引用的模型是否在Provider中存在
  }

  /**
   * 获取启用的Provider列表
   */
  private getEnabledProviders(config: RCCv4Config): (ServerCompatibilityProvider | StandardProvider)[] {
    const providers: (ServerCompatibilityProvider | StandardProvider)[] = [];

    for (const provider of Object.values(config.serverCompatibilityProviders)) {
      if (provider.enabled) {
        providers.push(provider);
      }
    }

    for (const provider of Object.values(config.standardProviders)) {
      if (provider.enabled) {
        providers.push(provider as StandardProvider);
      }
    }

    return providers;
  }

  /**
   * 检查是否有LM Studio Provider
   */
  private hasLMStudioProvider(config: RCCv4Config): boolean {
    return Object.values(config.serverCompatibilityProviders).some(
      p => p.id.includes('lmstudio') || p.name.toLowerCase().includes('lmstudio')
    );
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 合并验证规则
   */
  private mergeRules(defaultRules: ValidationRules, customRules?: Partial<ValidationRules>): ValidationRules {
    if (!customRules) {
      return { ...defaultRules };
    }

    return {
      version: { ...defaultRules.version, ...customRules.version },
      providers: { ...defaultRules.providers, ...customRules.providers },
      routing: { ...defaultRules.routing, ...customRules.routing },
      security: { ...defaultRules.security, ...customRules.security },
    };
  }

  /**
   * 获取当前验证规则
   */
  getValidationRules(): ValidationRules {
    return { ...this.rules };
  }

  /**
   * 更新验证规则
   */
  updateValidationRules(customRules: Partial<ValidationRules>): void {
    this.rules = this.mergeRules(this.rules, customRules);
  }
}
