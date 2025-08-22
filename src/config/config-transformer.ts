/**
 * RCC v4.0 Configuration Transformer
 *
 * 处理配置转换，包括环境变量替换、数据类型转换和配置格式迁移
 *
 * @author Jason Zhang
 */

import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 环境变量替换选项
 */
export interface EnvTransformOptions {
  allowUndefined?: boolean;
  defaultPrefix?: string;
  typeConversion?: boolean;
  recursiveDepth?: number;
}

/**
 * 类型转换选项
 */
export interface TypeConversionOptions {
  strict?: boolean;
  preserveStrings?: boolean;
  customConverters?: Record<string, (value: any) => any>;
}

/**
 * 转换结果
 */
export interface TransformResult<T = any> {
  data: T;
  transformedFields: string[];
  warnings: string[];
  errors: string[];
}

/**
 * 配置转换器
 */
export class ConfigTransformer {
  private static readonly DEFAULT_ENV_OPTIONS: EnvTransformOptions = {
    allowUndefined: false,
    typeConversion: true,
    recursiveDepth: 10,
  };

  private static readonly DEFAULT_TYPE_OPTIONS: TypeConversionOptions = {
    strict: false,
    preserveStrings: false,
  };

  /**
   * 处理环境变量替换
   */
  async processEnvironmentVariables<T = any>(
    data: any,
    options: EnvTransformOptions = {}
  ): Promise<TransformResult<T>> {
    secureLogger.debug('🔄 开始环境变量处理');

    const mergedOptions = { ...ConfigTransformer.DEFAULT_ENV_OPTIONS, ...options };
    const transformedFields: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const processedData = this.deepProcessEnvVars(data, mergedOptions, transformedFields, warnings, errors, '', 0);

      secureLogger.debug(`✅ 环境变量处理完成，转换了 ${transformedFields.length} 个字段`);

      return {
        data: processedData as T,
        transformedFields,
        warnings,
        errors,
      };
    } catch (error) {
      secureLogger.error('❌ 环境变量处理失败', { error: error.message });
      errors.push(`Environment variable processing failed: ${error.message}`);

      return {
        data: data as T,
        transformedFields,
        warnings,
        errors,
      };
    }
  }

  /**
   * 深度处理环境变量
   */
  private deepProcessEnvVars(
    obj: any,
    options: EnvTransformOptions,
    transformedFields: string[],
    warnings: string[],
    errors: string[],
    path: string,
    depth: number
  ): any {
    // 防止无限递归
    if (depth > (options.recursiveDepth || 10)) {
      warnings.push(`Maximum recursion depth reached at path: ${path}`);
      return obj;
    }

    if (typeof obj === 'string') {
      const result = this.replaceEnvVars(obj, options, path, warnings, errors);
      if (result !== obj) {
        transformedFields.push(path);
      }
      return result;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        this.deepProcessEnvVars(item, options, transformedFields, warnings, errors, `${path}[${index}]`, depth + 1)
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        result[key] = this.deepProcessEnvVars(
          value,
          options,
          transformedFields,
          warnings,
          errors,
          currentPath,
          depth + 1
        );
      }
      return result;
    }

    return obj;
  }

  /**
   * 替换环境变量
   */
  private replaceEnvVars(
    str: string,
    options: EnvTransformOptions,
    path: string,
    warnings: string[],
    errors: string[]
  ): any {
    // 支持格式: ${VAR_NAME}, ${VAR_NAME:default_value}, $VAR_NAME
    const envVarPattern = /\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g;

    let hasReplacements = false;
    const result = str.replace(envVarPattern, (match, braceVar, directVar) => {
      const varExpr = braceVar || directVar;
      const [varName, defaultValue] = varExpr.split(':');

      // 添加前缀（如果配置了）
      const fullVarName = options.defaultPrefix ? `${options.defaultPrefix}${varName}` : varName;
      const envValue = process.env[fullVarName] || process.env[varName];

      if (envValue !== undefined) {
        hasReplacements = true;
        return this.convertEnvValue(envValue, options);
      }

      if (defaultValue !== undefined) {
        hasReplacements = true;
        return this.convertEnvValue(defaultValue, options);
      }

      if (!options.allowUndefined) {
        errors.push(`Required environment variable ${varName} is not set at path: ${path}`);
        return match; // 保持原样
      }

      warnings.push(`Undefined environment variable ${varName} at path: ${path}`);
      return match; // 保持原样
    });

    return hasReplacements ? result : str;
  }

  /**
   * 转换环境变量值的类型
   */
  private convertEnvValue(value: string, options: EnvTransformOptions): any {
    if (!options.typeConversion) {
      return value;
    }

    // 尝试转换为数字
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // 尝试转换为布尔值
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true') {
      return true;
    }

    if (lowerValue === 'false') {
      return false;
    }

    // 尝试转换为null或undefined
    if (lowerValue === 'null') {
      return null;
    }

    if (lowerValue === 'undefined') {
      return undefined;
    }

    // 尝试解析JSON
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JQJsonHandler.parseJsonString(value);
      } catch {
        // 解析失败，保持字符串
      }
    }

    return value;
  }

  /**
   * 数据类型转换
   */
  async convertTypes<T = any>(
    data: any,
    schema: Record<string, string>,
    options: TypeConversionOptions = {}
  ): Promise<TransformResult<T>> {
    secureLogger.debug('🔄 开始数据类型转换');

    const mergedOptions = { ...ConfigTransformer.DEFAULT_TYPE_OPTIONS, ...options };
    const transformedFields: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const convertedData = this.deepConvertTypes(data, schema, mergedOptions, transformedFields, warnings, errors, '');

      secureLogger.debug(`✅ 数据类型转换完成，转换了 ${transformedFields.length} 个字段`);

      return {
        data: convertedData as T,
        transformedFields,
        warnings,
        errors,
      };
    } catch (error) {
      secureLogger.error('❌ 数据类型转换失败', { error: error.message });
      errors.push(`Type conversion failed: ${error.message}`);

      return {
        data: data as T,
        transformedFields,
        warnings,
        errors,
      };
    }
  }

  /**
   * 深度类型转换
   */
  private deepConvertTypes(
    obj: any,
    schema: Record<string, string>,
    options: TypeConversionOptions,
    transformedFields: string[],
    warnings: string[],
    errors: string[],
    path: string
  ): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.convertValue(obj, schema[path], options, path, transformedFields, warnings, errors);
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) =>
        this.deepConvertTypes(item, schema, options, transformedFields, warnings, errors, `${path}[${index}]`)
      );
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      result[key] = this.deepConvertTypes(value, schema, options, transformedFields, warnings, errors, currentPath);
    }

    return result;
  }

  /**
   * 转换单个值
   */
  private convertValue(
    value: any,
    targetType: string,
    options: TypeConversionOptions,
    path: string,
    transformedFields: string[],
    warnings: string[],
    errors: string[]
  ): any {
    if (!targetType || value === null || value === undefined) {
      return value;
    }

    // 检查是否有自定义转换器
    if (options.customConverters && options.customConverters[targetType]) {
      try {
        const converted = options.customConverters[targetType](value);
        transformedFields.push(path);
        return converted;
      } catch (error) {
        errors.push(`Custom converter failed for ${path}: ${error.message}`);
        return value;
      }
    }

    // 如果要保持字符串且当前就是字符串，直接返回
    if (options.preserveStrings && typeof value === 'string') {
      return value;
    }

    try {
      const converted = this.performTypeConversion(value, targetType, options.strict || false, warnings);
      if (converted !== value) {
        transformedFields.push(path);
      }
      return converted;
    } catch (error) {
      const message = `Type conversion failed for ${path}: ${error.message}`;

      if (options.strict) {
        errors.push(message);
      } else {
        warnings.push(message);
      }

      return value;
    }
  }

  /**
   * 执行类型转换
   */
  private performTypeConversion(value: any, targetType: string, strict: boolean, warnings?: string[]): any {
    switch (targetType.toLowerCase()) {
      case 'string':
        return String(value);

      case 'number':
        const num = Number(value);
        if (isNaN(num) && strict) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        return isNaN(num) ? value : num;

      case 'boolean':
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1') return true;
          if (lower === 'false' || lower === '0') return false;
        }
        if (strict) {
          throw new Error(`Cannot convert "${value}" to boolean`);
        }
        return Boolean(value);

      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        if (typeof value === 'string') {
          try {
            const parsed = JQJsonHandler.parseJsonString(value);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          } catch {
            // 解析失败，按逗号分割
            return value.split(',').map(s => s.trim());
          }
        }
        if (strict) {
          throw new Error(`Cannot convert "${value}" to array`);
        }
        return [value];

      case 'object':
        if (typeof value === 'object' && value !== null) {
          return value;
        }
        if (typeof value === 'string') {
          try {
            return JQJsonHandler.parseJsonString(value);
          } catch {
            if (strict) {
              throw new Error(`Cannot parse "${value}" as JSON object`);
            }
          }
        }
        return value;

      default:
        if (warnings) {
          warnings.push(`Unknown target type: ${targetType}`);
        }
        return value;
    }
  }

  /**
   * 配置格式迁移（v3到v4）
   */
  async migrateFromV3(v3Config: any): Promise<TransformResult> {
    secureLogger.debug('🔄 开始v3到v4配置迁移');

    const transformedFields: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // 这里应该实现具体的v3到v4迁移逻辑
      // 目前先返回一个基础的结构
      const v4Config = {
        version: '4.0.0',
        serverCompatibilityProviders: {},
        standardProviders: {},
        routing: {
          pipelineArchitecture: {
            layers: [],
            strictLayerEnforcement: true,
            allowCrossLayerCalls: false,
          },
          routingStrategies: {},
          routes: [],
          routingRules: {
            modelMapping: {},
            defaultRoute: '',
            routeSelectionCriteria: {
              primary: 'performance',
              secondary: 'availability',
              tertiary: 'cost',
            },
          },
          configuration: {
            strictErrorReporting: true,
            zeroFallbackPolicy: true,
            maxRetries: 3,
            requestTimeout: 30000,
            healthCheckInterval: 60000,
            debug: false,
            monitoring: {
              enabled: true,
              metricsCollection: true,
              performanceTracking: true,
            },
          },
          validation: {
            enforceLayerOrder: true,
            validateModuleCompatibility: true,
            requireHealthyProviders: true,
            preventCrossLayerCalls: true,
          },
        },
        security: {
          encryption: { enabled: false, algorithm: 'aes-256-gcm', keyDerivation: {}, encryptedFields: [] },
          keyManagement: { provider: 'env', masterKeyEnvVar: 'RCC_MASTER_KEY', keyRotation: {}, backup: {} },
          authentication: { apiKey: {}, jwt: {} },
          authorization: { rbac: {} },
          rateLimit: { enabled: false, global: {}, perProvider: {}, perIP: {} },
          inputValidation: {
            enabled: true,
            maxRequestSize: '10MB',
            allowedContentTypes: [],
            sanitization: {},
            requestValidation: {},
          },
          logging: { level: 'info', sensitiveFieldFiltering: {}, auditLog: {} },
          headers: { security: {}, cors: {} },
          errorHandling: {
            hideInternalErrors: true,
            sanitizeErrorMessages: true,
            logFullErrors: false,
            genericErrorMessage: 'Internal server error',
          },
          monitoring: { securityEvents: {}, metricsCollection: {} },
          compliance: { dataRetention: {}, privacy: {} },
          development: { allowInsecureConnections: false, debugMode: false, testDataGeneration: false },
        },
        validation: {
          required: ['routing', 'security'],
          environmentVariables: {
            required: [],
            optional: [],
          },
        },
      };

      warnings.push('v3 to v4 migration is not fully implemented yet');

      secureLogger.debug('✅ v3到v4配置迁移完成');

      return {
        data: v4Config,
        transformedFields,
        warnings,
        errors,
      };
    } catch (error) {
      secureLogger.error('❌ v3到v4配置迁移失败', { error: error.message });
      errors.push(`Migration failed: ${error.message}`);

      return {
        data: v3Config,
        transformedFields,
        warnings,
        errors,
      };
    }
  }

  /**
   * 清理敏感信息
   */
  sanitizeConfig(config: any, sensitiveFields: string[] = []): any {
    const defaultSensitiveFields = ['apiKey', 'secret', 'password', 'token', 'key', 'masterKey', 'privateKey'];

    const allSensitiveFields = [...defaultSensitiveFields, ...sensitiveFields];

    return this.deepSanitize(config, allSensitiveFields);
  }

  /**
   * 深度清理敏感信息
   */
  private deepSanitize(obj: any, sensitiveFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item, sensitiveFields));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()));

      if (isSensitive && typeof value === 'string') {
        result[key] = '***';
      } else {
        result[key] = this.deepSanitize(value, sensitiveFields);
      }
    }

    return result;
  }
}
