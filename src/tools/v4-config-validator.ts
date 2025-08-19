/**
 * RCC v4.0 Configuration Validator
 *
 * 验证v4配置文件是否符合schema要求
 *
 * @author Jason Zhang
 * @version 4.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  RCCv4Config,
  ServerCompatibilityProvider,
  StandardProvider,
  PipelineRouting,
  SecurityConfig,
  ValidationConfig,
} from '../config/v4-config-loader';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  configPath: string;
  validatedAt: Date;
}

export interface ConfigValidationReport {
  totalConfigs: number;
  validConfigs: number;
  invalidConfigs: number;
  results: ValidationResult[];
  summary: {
    commonErrors: Record<string, number>;
    commonWarnings: Record<string, number>;
    recommendations: string[];
  };
}

/**
 * v4配置文件验证器
 */
export class V4ConfigValidator {
  private readonly requiredFields = {
    root: ['version', 'serverCompatibilityProviders', 'standardProviders', 'routing', 'security', 'validation'],
    provider: ['id', 'name', 'description', 'enabled', 'type', 'protocol', 'connection', 'models', 'features'],
    connection: ['endpoint', 'timeout', 'maxRetries'],
    models: ['supported', 'default', 'capabilities'],
    routing: ['pipelineArchitecture', 'routingStrategies', 'routes', 'routingRules', 'configuration'],
    route: ['id', 'name', 'description', 'enabled', 'priority', 'weight', 'conditions', 'pipeline'],
  };

  /**
   * 验证单个配置文件
   */
  async validateConfig(configPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      configPath,
      validatedAt: new Date(),
    };

    try {
      // 检查文件是否存在
      if (!fs.existsSync(configPath)) {
        result.valid = false;
        result.errors.push(`Configuration file not found: ${configPath}`);
        return result;
      }

      // 读取和解析配置文件
      const configContent = fs.readFileSync(configPath, 'utf8');
      let config: any;

      try {
        config = JSON.parse(configContent);
      } catch (parseError) {
        result.valid = false;
        result.errors.push(`Invalid JSON format: ${parseError.message}`);
        return result;
      }

      // 验证根级字段
      this.validateRootFields(config, result);

      // 验证版本
      this.validateVersion(config, result);

      // 验证Provider配置
      this.validateProviders(config, result);

      // 验证路由配置
      this.validateRouting(config, result);

      // 验证安全配置
      this.validateSecurity(config, result);

      // 验证validation配置
      this.validateValidation(config, result);

      // 验证配置一致性
      this.validateConsistency(config, result);

      // 性能优化建议
      this.generateOptimizationSuggestions(config, result);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error.message}`);
    }

    // 最终有效性判断
    result.valid = result.errors.length === 0;

    return result;
  }

  /**
   * 验证多个配置文件
   */
  async validateConfigs(configPaths: string[]): Promise<ConfigValidationReport> {
    const results: ValidationResult[] = [];

    for (const configPath of configPaths) {
      const result = await this.validateConfig(configPath);
      results.push(result);
    }

    return this.generateReport(results);
  }

  /**
   * 验证根级字段
   */
  private validateRootFields(config: any, result: ValidationResult): void {
    for (const field of this.requiredFields.root) {
      if (!(field in config)) {
        result.errors.push(`Missing required root field: ${field}`);
      }
    }

    // 检查意外字段
    const allowedRootFields = [...this.requiredFields.root, 'server', 'debug', 'metadata'];
    for (const field in config) {
      if (!allowedRootFields.includes(field)) {
        result.warnings.push(`Unexpected root field: ${field}`);
      }
    }
  }

  /**
   * 验证版本
   */
  private validateVersion(config: any, result: ValidationResult): void {
    if (!config.version) {
      result.errors.push('Missing version field');
      return;
    }

    if (typeof config.version !== 'string') {
      result.errors.push('Version must be a string');
      return;
    }

    if (!config.version.startsWith('4.0')) {
      result.errors.push(`Invalid version for v4 config: ${config.version}`);
    }
  }

  /**
   * 验证Provider配置
   */
  private validateProviders(config: any, result: ValidationResult): void {
    // 验证serverCompatibilityProviders
    if (config.serverCompatibilityProviders) {
      for (const [key, provider] of Object.entries(config.serverCompatibilityProviders)) {
        this.validateProvider(provider as any, 'server-compatibility', key, result);
      }
    }

    // 验证standardProviders
    if (config.standardProviders) {
      for (const [key, provider] of Object.entries(config.standardProviders)) {
        this.validateProvider(provider as any, 'standard', key, result);
      }
    }

    // 检查是否至少有一个Provider
    const totalProviders =
      Object.keys(config.serverCompatibilityProviders || {}).length +
      Object.keys(config.standardProviders || {}).length;

    if (totalProviders === 0) {
      result.errors.push('At least one provider must be configured');
    }
  }

  /**
   * 验证单个Provider
   */
  private validateProvider(provider: any, expectedType: string, key: string, result: ValidationResult): void {
    const prefix = `Provider ${key}:`;

    // 验证必需字段
    for (const field of this.requiredFields.provider) {
      if (!(field in provider)) {
        result.errors.push(`${prefix} Missing required field: ${field}`);
      }
    }

    // 验证类型
    if (provider.type !== expectedType) {
      result.errors.push(`${prefix} Invalid type: expected ${expectedType}, got ${provider.type}`);
    }

    // 验证连接配置
    if (provider.connection) {
      this.validateConnection(provider.connection, prefix, result);
    }

    // 验证模型配置
    if (provider.models) {
      this.validateModels(provider.models, prefix, result);
    }

    // 验证特性配置
    if (provider.features) {
      this.validateFeatures(provider.features, prefix, result);
    }

    // 验证协议
    const validProtocols = ['openai', 'anthropic', 'gemini'];
    if (provider.protocol && !validProtocols.includes(provider.protocol)) {
      result.warnings.push(`${prefix} Unknown protocol: ${provider.protocol}`);
    }
  }

  /**
   * 验证连接配置
   */
  private validateConnection(connection: any, prefix: string, result: ValidationResult): void {
    // 验证必需字段
    for (const field of this.requiredFields.connection) {
      if (!(field in connection)) {
        result.errors.push(`${prefix} Connection missing required field: ${field}`);
      }
    }

    // 验证端点URL
    if (connection.endpoint) {
      if (typeof connection.endpoint !== 'string') {
        result.errors.push(`${prefix} Connection endpoint must be a string`);
      } else if (!connection.endpoint.startsWith('http')) {
        result.warnings.push(`${prefix} Connection endpoint should use HTTP/HTTPS protocol`);
      }
    }

    // 验证超时
    if (connection.timeout && (typeof connection.timeout !== 'number' || connection.timeout <= 0)) {
      result.errors.push(`${prefix} Connection timeout must be a positive number`);
    }

    // 验证重试次数
    if (connection.maxRetries && (typeof connection.maxRetries !== 'number' || connection.maxRetries < 0)) {
      result.errors.push(`${prefix} Connection maxRetries must be a non-negative number`);
    }
  }

  /**
   * 验证模型配置
   */
  private validateModels(models: any, prefix: string, result: ValidationResult): void {
    // 验证必需字段
    for (const field of this.requiredFields.models) {
      if (!(field in models)) {
        result.errors.push(`${prefix} Models missing required field: ${field}`);
      }
    }

    // 验证支持的模型列表
    if (models.supported) {
      if (!Array.isArray(models.supported)) {
        result.errors.push(`${prefix} Models supported must be an array`);
      } else if (models.supported.length === 0) {
        result.warnings.push(`${prefix} No supported models defined`);
      }
    }

    // 验证默认模型
    if (models.default && models.supported) {
      if (!models.supported.includes(models.default)) {
        result.errors.push(`${prefix} Default model '${models.default}' not in supported models list`);
      }
    }

    // 验证capabilities
    if (models.capabilities) {
      const requiredCapabilities = ['chat', 'streaming'];
      for (const capability of requiredCapabilities) {
        if (!(capability in models.capabilities)) {
          result.warnings.push(`${prefix} Missing capability definition: ${capability}`);
        }
      }
    }
  }

  /**
   * 验证特性配置
   */
  private validateFeatures(features: any, prefix: string, result: ValidationResult): void {
    const requiredFeatures = ['streaming', 'toolCalling'];

    for (const feature of requiredFeatures) {
      if (!(feature in features)) {
        result.warnings.push(`${prefix} Missing feature definition: ${feature}`);
      }
    }

    // 验证特性值类型
    for (const [key, value] of Object.entries(features)) {
      if (typeof value !== 'boolean') {
        result.errors.push(`${prefix} Feature '${key}' must be a boolean`);
      }
    }
  }

  /**
   * 验证路由配置
   */
  private validateRouting(config: any, result: ValidationResult): void {
    if (!config.routing) {
      result.errors.push('Missing routing configuration');
      return;
    }

    const routing = config.routing;

    // 验证流水线架构
    this.validatePipelineArchitecture(routing.pipelineArchitecture, result);

    // 验证路由策略
    this.validateRoutingStrategies(routing.routingStrategies, result);

    // 验证路由
    this.validateRoutes(routing.routes, result);

    // 验证路由规则
    this.validateRoutingRules(routing.routingRules, result);

    // 验证路由配置
    this.validateRoutingConfiguration(routing.configuration, result);
  }

  /**
   * 验证流水线架构
   */
  private validatePipelineArchitecture(architecture: any, result: ValidationResult): void {
    if (!architecture) {
      result.errors.push('Missing pipelineArchitecture');
      return;
    }

    if (!architecture.layers || !Array.isArray(architecture.layers)) {
      result.errors.push('PipelineArchitecture layers must be an array');
      return;
    }

    // 验证层顺序
    const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
    for (let i = 0; i < expectedLayers.length; i++) {
      const layer = architecture.layers[i];
      if (!layer || layer.name !== expectedLayers[i] || layer.order !== i + 1) {
        result.errors.push(`Invalid layer at position ${i + 1}: expected ${expectedLayers[i]}`);
      }
    }

    // 验证严格层执行
    if (typeof architecture.strictLayerEnforcement !== 'boolean') {
      result.errors.push('PipelineArchitecture strictLayerEnforcement must be a boolean');
    }

    if (typeof architecture.allowCrossLayerCalls !== 'boolean') {
      result.errors.push('PipelineArchitecture allowCrossLayerCalls must be a boolean');
    }
  }

  /**
   * 验证路由策略
   */
  private validateRoutingStrategies(strategies: any, result: ValidationResult): void {
    if (!strategies || typeof strategies !== 'object') {
      result.errors.push('RoutingStrategies must be an object');
      return;
    }

    if (Object.keys(strategies).length === 0) {
      result.warnings.push('No routing strategies defined');
    }

    for (const [key, strategy] of Object.entries(strategies)) {
      this.validateRoutingStrategy(strategy as any, key, result);
    }
  }

  /**
   * 验证单个路由策略
   */
  private validateRoutingStrategy(strategy: any, key: string, result: ValidationResult): void {
    const requiredFields = ['id', 'name', 'description', 'algorithm', 'fallbackEnabled', 'strictErrorReporting'];

    for (const field of requiredFields) {
      if (!(field in strategy)) {
        result.errors.push(`RoutingStrategy ${key}: Missing required field: ${field}`);
      }
    }

    // 验证fallbackEnabled与zeroFallbackPolicy的一致性
    if (strategy.fallbackEnabled === true) {
      result.warnings.push(`RoutingStrategy ${key}: fallbackEnabled=true may conflict with zeroFallbackPolicy`);
    }
  }

  /**
   * 验证路由
   */
  private validateRoutes(routes: any, result: ValidationResult): void {
    if (!routes || !Array.isArray(routes)) {
      result.errors.push('Routes must be an array');
      return;
    }

    if (routes.length === 0) {
      result.errors.push('At least one route must be defined');
      return;
    }

    for (let i = 0; i < routes.length; i++) {
      this.validateRoute(routes[i], i, result);
    }
  }

  /**
   * 验证单个路由
   */
  private validateRoute(route: any, index: number, result: ValidationResult): void {
    const prefix = `Route ${index}:`;

    // 验证必需字段
    for (const field of this.requiredFields.route) {
      if (!(field in route)) {
        result.errors.push(`${prefix} Missing required field: ${field}`);
      }
    }

    // 验证pipeline层配置
    if (route.pipeline && route.pipeline.layers) {
      for (let i = 0; i < route.pipeline.layers.length; i++) {
        const layer = route.pipeline.layers[i];
        if (!layer.layer || !layer.moduleId || !layer.config) {
          result.errors.push(`${prefix} Pipeline layer ${i}: Missing required fields`);
        }
      }
    }

    // 验证优先级和权重
    if (typeof route.priority !== 'number' || route.priority <= 0) {
      result.errors.push(`${prefix} Priority must be a positive number`);
    }

    if (typeof route.weight !== 'number' || route.weight < 0 || route.weight > 1) {
      result.errors.push(`${prefix} Weight must be a number between 0 and 1`);
    }
  }

  /**
   * 验证路由规则
   */
  private validateRoutingRules(rules: any, result: ValidationResult): void {
    if (!rules) {
      result.errors.push('Missing routingRules');
      return;
    }

    if (!rules.defaultRoute) {
      result.errors.push('RoutingRules: Missing defaultRoute');
    }

    if (!rules.routeSelectionCriteria) {
      result.errors.push('RoutingRules: Missing routeSelectionCriteria');
    }
  }

  /**
   * 验证路由配置
   */
  private validateRoutingConfiguration(config: any, result: ValidationResult): void {
    if (!config) {
      result.errors.push('Missing routing configuration');
      return;
    }

    // 验证必需字段
    const requiredFields = ['strictErrorReporting', 'zeroFallbackPolicy', 'maxRetries', 'requestTimeout'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        result.errors.push(`Routing configuration: Missing required field: ${field}`);
      }
    }

    // 验证zeroFallbackPolicy
    if (typeof config.zeroFallbackPolicy !== 'boolean') {
      result.errors.push('zeroFallbackPolicy must be a boolean');
    }

    // 验证紧急fallback配置一致性
    if (config.zeroFallbackPolicy && config.allowEmergencyFallback && !config.emergencyThresholds) {
      result.warnings.push('allowEmergencyFallback enabled but emergencyThresholds not defined');
    }
  }

  /**
   * 验证安全配置
   */
  private validateSecurity(config: any, result: ValidationResult): void {
    if (!config.security) {
      result.warnings.push('Missing security configuration');
      return;
    }

    // 这里可以添加更多安全配置验证
  }

  /**
   * 验证validation配置
   */
  private validateValidation(config: any, result: ValidationResult): void {
    if (!config.validation) {
      result.warnings.push('Missing validation configuration');
      return;
    }

    const requiredFields = [
      'enforceLayerOrder',
      'validateModuleCompatibility',
      'requireHealthyProviders',
      'preventCrossLayerCalls',
    ];
    for (const field of requiredFields) {
      if (!(field in config.validation)) {
        result.warnings.push(`Validation configuration: Missing field: ${field}`);
      }
    }
  }

  /**
   * 验证配置一致性
   */
  private validateConsistency(config: any, result: ValidationResult): void {
    // 验证路由引用的Provider是否存在
    if (config.routing && config.routing.routes) {
      for (const route of config.routing.routes) {
        if (route.pipeline && route.pipeline.layers) {
          for (const layer of route.pipeline.layers) {
            if (layer.config && layer.config.providerId) {
              const providerId = layer.config.providerId;
              const exists =
                (config.serverCompatibilityProviders && config.serverCompatibilityProviders[providerId]) ||
                (config.standardProviders && config.standardProviders[providerId]);

              if (!exists) {
                result.errors.push(`Route ${route.id}: Referenced provider '${providerId}' not found`);
              }
            }
          }
        }
      }
    }
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(config: any, result: ValidationResult): void {
    // 检查Provider数量
    const totalProviders =
      Object.keys(config.serverCompatibilityProviders || {}).length +
      Object.keys(config.standardProviders || {}).length;

    if (totalProviders === 1) {
      result.suggestions.push('Consider adding backup providers for high availability');
    }

    // 检查健康检查配置
    let hasHealthCheck = false;
    for (const provider of Object.values(config.serverCompatibilityProviders || {})) {
      if ((provider as any).healthCheck?.enabled) {
        hasHealthCheck = true;
        break;
      }
    }

    if (!hasHealthCheck) {
      result.suggestions.push('Enable health checks for better reliability');
    }

    // 检查监控配置
    if (config.routing?.configuration?.monitoring?.enabled !== true) {
      result.suggestions.push('Enable monitoring for better observability');
    }
  }

  /**
   * 生成验证报告
   */
  private generateReport(results: ValidationResult[]): ConfigValidationReport {
    const validConfigs = results.filter(r => r.valid).length;
    const invalidConfigs = results.length - validConfigs;

    // 统计常见错误和警告
    const commonErrors: Record<string, number> = {};
    const commonWarnings: Record<string, number> = {};

    for (const result of results) {
      for (const error of result.errors) {
        commonErrors[error] = (commonErrors[error] || 0) + 1;
      }
      for (const warning of result.warnings) {
        commonWarnings[warning] = (commonWarnings[warning] || 0) + 1;
      }
    }

    // 生成建议
    const recommendations: string[] = [];
    if (invalidConfigs > 0) {
      recommendations.push('Fix configuration errors before deployment');
    }
    if (validConfigs < results.length) {
      recommendations.push('Review and address all warnings');
    }
    recommendations.push('Regularly validate configurations after changes');

    return {
      totalConfigs: results.length,
      validConfigs,
      invalidConfigs,
      results,
      summary: {
        commonErrors,
        commonWarnings,
        recommendations,
      },
    };
  }
}

/**
 * 命令行工具函数
 */
export async function validateV4Configs(configPaths: string[]): Promise<void> {
  const validator = new V4ConfigValidator();
  const report = await validator.validateConfigs(configPaths);

  console.log('\n🔍 RCC v4.0 Configuration Validation Report');
  console.log('═'.repeat(50));
  console.log(`📊 Total Configurations: ${report.totalConfigs}`);
  console.log(`✅ Valid Configurations: ${report.validConfigs}`);
  console.log(`❌ Invalid Configurations: ${report.invalidConfigs}`);
  console.log('');

  for (const result of report.results) {
    const status = result.valid ? '✅' : '❌';
    const configName = path.basename(result.configPath);
    console.log(`${status} ${configName}`);

    if (result.errors.length > 0) {
      console.log(`   Errors (${result.errors.length}):`);
      for (const error of result.errors) {
        console.log(`     • ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`   Warnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        console.log(`     • ${warning}`);
      }
    }

    if (result.suggestions.length > 0) {
      console.log(`   Suggestions (${result.suggestions.length}):`);
      for (const suggestion of result.suggestions) {
        console.log(`     • ${suggestion}`);
      }
    }
    console.log('');
  }

  if (Object.keys(report.summary.commonErrors).length > 0) {
    console.log('🔍 Most Common Errors:');
    for (const [error, count] of Object.entries(report.summary.commonErrors)) {
      console.log(`   • ${error} (${count} occurrences)`);
    }
    console.log('');
  }

  console.log('💡 Recommendations:');
  for (const recommendation of report.summary.recommendations) {
    console.log(`   • ${recommendation}`);
  }
}
