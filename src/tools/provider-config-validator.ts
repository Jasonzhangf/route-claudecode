/**
 * Provider配置验证和诊断工具
 *
 * 验证Provider配置文件的完整性和正确性
 * 提供配置诊断和修复建议
 *
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as JSON5 from 'json5';

/**
 * 配置验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  score: number; // 0-100的配置质量评分
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion?: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  field: string;
  message: string;
  recommendation: string;
}

/**
 * Provider配置架构定义
 */
export interface ProviderConfigSchema {
  required: string[];
  optional: string[];
  types: Record<string, string>;
  defaults: Record<string, any>;
  validation: Record<string, (value: any) => boolean>;
}

/**
 * Provider配置验证器
 */
export class ProviderConfigValidator {
  private schema: ProviderConfigSchema;

  constructor() {
    this.schema = this.defineSchema();
  }

  /**
   * 定义配置架构
   */
  private defineSchema(): ProviderConfigSchema {
    return {
      required: ['provider.id', 'provider.name', 'provider.type', 'connection.endpoint', 'models.default'],
      optional: [
        'provider.description',
        'provider.version',
        'provider.enabled',
        'connection.timeout',
        'connection.retries',
        'auth.apiKey',
        'defaults.max_tokens',
        'performance.maxConcurrentRequests',
        'errorHandling.maxRetries',
        'cache.enabled',
        'monitoring.enabled',
      ],
      types: {
        'provider.id': 'string',
        'provider.name': 'string',
        'provider.type': 'string',
        'provider.enabled': 'boolean',
        'connection.endpoint': 'string',
        'connection.timeout': 'number',
        'connection.retries': 'number',
        'models.default': 'string',
        'models.available': 'array',
        'defaults.max_tokens': 'number',
        'defaults.temperature': 'number',
        'performance.maxConcurrentRequests': 'number',
        'errorHandling.maxRetries': 'number',
        'cache.enabled': 'boolean',
        'cache.ttl': 'number',
        'monitoring.enabled': 'boolean',
      },
      defaults: {
        'provider.enabled': true,
        'provider.version': '1.0.0',
        'connection.timeout': 30000,
        'connection.retries': 3,
        'defaults.max_tokens': 4096,
        'defaults.temperature': 0.7,
        'performance.maxConcurrentRequests': 5,
        'errorHandling.maxRetries': 3,
        'cache.enabled': true,
        'cache.ttl': 300000,
        'monitoring.enabled': true,
      },
      validation: {
        'provider.type': (value: string) => ['anthropic', 'openai', 'gemini'].includes(value),
        'connection.endpoint': (value: string) => /^https?:\/\/.+/.test(value),
        'connection.timeout': (value: number) => value > 0 && value < 300000, // 5分钟以内
        'defaults.temperature': (value: number) => value >= 0 && value <= 2,
        'defaults.top_p': (value: number) => value >= 0 && value <= 1,
        'performance.maxConcurrentRequests': (value: number) => value > 0 && value <= 100,
        'errorHandling.maxRetries': (value: number) => value >= 0 && value <= 10,
        'cache.ttl': (value: number) => value > 0 && value <= 3600000, // 1小时以内
      },
    };
  }

  /**
   * 验证配置文件
   */
  public validateConfig(configPath: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100,
    };

    try {
      // 读取配置文件
      if (!fs.existsSync(configPath)) {
        result.errors.push({
          field: 'file',
          message: '配置文件不存在',
          severity: 'critical',
          suggestion: '请检查文件路径是否正确',
        });
        result.valid = false;
        result.score = 0;
        return result;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      let config: any;

      try {
        config = JSON5.parse(content);
      } catch (parseError) {
        result.errors.push({
          field: 'syntax',
          message: 'JSON5语法错误: ' + (parseError as Error).message,
          severity: 'critical',
          suggestion: '请检查配置文件的JSON5语法',
        });
        result.valid = false;
        result.score = 0;
        return result;
      }

      // 验证必需字段
      this.validateRequiredFields(config, result);

      // 验证字段类型
      this.validateFieldTypes(config, result);

      // 验证字段值
      this.validateFieldValues(config, result);

      // 检查最佳实践
      this.checkBestPractices(config, result);

      // 计算最终评分
      this.calculateScore(result);

      return result;
    } catch (error) {
      result.errors.push({
        field: 'unknown',
        message: '验证过程中发生错误: ' + (error as Error).message,
        severity: 'critical',
      });
      result.valid = false;
      result.score = 0;
      return result;
    }
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(config: any, result: ValidationResult): void {
    for (const field of this.schema.required) {
      const value = this.getNestedValue(config, field);
      if (value === undefined || value === null) {
        result.errors.push({
          field,
          message: `必需字段缺失: ${field}`,
          severity: 'major',
          suggestion: `请添加 ${field} 字段`,
        });
        result.valid = false;
      }
    }
  }

  /**
   * 验证字段类型
   */
  private validateFieldTypes(config: any, result: ValidationResult): void {
    for (const [field, expectedType] of Object.entries(this.schema.types)) {
      const value = this.getNestedValue(config, field);
      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== expectedType) {
          result.errors.push({
            field,
            message: `字段类型错误: ${field} 期望 ${expectedType}，实际 ${actualType}`,
            severity: 'major',
            suggestion: `请将 ${field} 设置为 ${expectedType} 类型`,
          });
        }
      }
    }
  }

  /**
   * 验证字段值
   */
  private validateFieldValues(config: any, result: ValidationResult): void {
    for (const [field, validator] of Object.entries(this.schema.validation)) {
      const value = this.getNestedValue(config, field);
      if (value !== undefined && !validator(value)) {
        result.errors.push({
          field,
          message: `字段值验证失败: ${field} = ${value}`,
          severity: 'minor',
          suggestion: this.getValidationSuggestion(field),
        });
      }
    }
  }

  /**
   * 检查最佳实践
   */
  private checkBestPractices(config: any, result: ValidationResult): void {
    // 检查是否使用了默认值
    for (const [field, defaultValue] of Object.entries(this.schema.defaults)) {
      const value = this.getNestedValue(config, field);
      if (value === undefined) {
        result.warnings.push({
          field,
          message: `未设置 ${field}，将使用默认值 ${defaultValue}`,
          recommendation: `建议显式设置 ${field} 字段以提高配置清晰度`,
        });
      }
    }

    // 检查性能相关配置
    const maxConcurrent = this.getNestedValue(config, 'performance.maxConcurrentRequests');
    const timeout = this.getNestedValue(config, 'connection.timeout');

    if (maxConcurrent && timeout && maxConcurrent > 10 && timeout < 10000) {
      result.warnings.push({
        field: 'performance',
        message: '高并发请求配置了较短的超时时间',
        recommendation: '建议增加超时时间以适配高并发场景',
      });
    }

    // 检查安全性
    const logRequests = this.getNestedValue(config, 'debug.logRequests');
    if (logRequests === true) {
      result.warnings.push({
        field: 'debug.logRequests',
        message: '启用了请求日志记录',
        recommendation: '生产环境建议关闭请求日志以避免敏感信息泄露',
      });
    }
  }

  /**
   * 计算配置质量评分
   */
  private calculateScore(result: ValidationResult): void {
    let score = 100;

    // 错误扣分
    for (const error of result.errors) {
      switch (error.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'major':
          score -= 15;
          break;
        case 'minor':
          score -= 5;
          break;
      }
    }

    // 警告扣分
    score -= result.warnings.length * 2;

    result.score = Math.max(0, score);

    if (result.score < 60) {
      result.suggestions.push('配置质量较低，建议进行全面检查和修复');
    } else if (result.score < 80) {
      result.suggestions.push('配置基本可用，但还有改进空间');
    } else if (result.score < 95) {
      result.suggestions.push('配置质量良好，可考虑进一步优化');
    } else {
      result.suggestions.push('配置质量优秀！');
    }
  }

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 获取验证建议
   */
  private getValidationSuggestion(field: string): string {
    const suggestions: Record<string, string> = {
      'provider.type': '支持的类型: anthropic, openai, gemini',
      'connection.endpoint': '请使用完整的HTTP/HTTPS URL',
      'connection.timeout': '建议设置在1000-300000毫秒之间',
      'defaults.temperature': '温度值应在0-2之间',
      'defaults.top_p': 'top_p值应在0-1之间',
      'performance.maxConcurrentRequests': '建议设置在1-100之间',
      'errorHandling.maxRetries': '重试次数建议在0-10之间',
      'cache.ttl': '缓存时间建议在1000-3600000毫秒之间',
    };

    return suggestions[field] || '请检查字段值是否符合要求';
  }

  /**
   * 验证目录中的所有配置文件
   */
  public validateDirectory(dirPath: string): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    if (!fs.existsSync(dirPath)) {
      return results;
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.json') || file.endsWith('.json5'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      results[file] = this.validateConfig(filePath);
    }

    return results;
  }

  /**
   * 生成配置模板
   */
  public generateTemplate(providerType: 'anthropic' | 'openai' | 'gemini'): string {
    const baseTemplate = {
      provider: {
        id: `${providerType}-provider`,
        name: `${providerType.charAt(0).toUpperCase() + providerType.slice(1)} Provider`,
        type: providerType,
        description: `${providerType} API Provider`,
        version: '1.0.0',
        enabled: true,
      },
      connection: {
        endpoint:
          providerType === 'anthropic'
            ? 'https://api.anthropic.com/v1/messages'
            : providerType === 'openai'
              ? 'https://api.openai.com/v1/chat/completions'
              : 'https://generativelanguage.googleapis.com/v1beta/models',
        timeout: 30000,
        retries: 3,
      },
      auth: {
        type: 'api_key',
        apiKey: 'your-api-key-here',
      },
      models: {
        default:
          providerType === 'anthropic'
            ? 'claude-3-sonnet-20240229'
            : providerType === 'openai'
              ? 'gpt-4'
              : 'gemini-pro',
      },
      defaults: this.schema.defaults,
      performance: {
        maxConcurrentRequests: 5,
        requestQueueSize: 20,
        responseTimeout: 60000,
      },
      errorHandling: {
        maxRetries: 3,
        retryBackoff: 'exponential',
      },
      cache: {
        enabled: true,
        ttl: 300000,
      },
      monitoring: {
        enabled: true,
        metricsCollection: true,
      },
    };

    return JSON5.stringify(baseTemplate, null, 2);
  }
}
