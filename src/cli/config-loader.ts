/**
 * 配置文件加载器
 *
 * 支持多种配置源的加载和合并：命令行参数、环境变量、配置文件
 *
 * @author Jason Zhang
 */

import { ParsedCommand } from '../interfaces';
import { getServerPort, getServerHost, getHttpRequestTimeout } from '../constants';

/**
 * 配置源类型
 */
export type ConfigSource = 'default' | 'file' | 'env' | 'cli';

/**
 * 配置值定义
 */
export interface ConfigValue {
  value: any;
  source: ConfigSource;
  priority: number;
}

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  configPath?: string;
  envPrefix?: string;
  allowEnvOverride?: boolean;
  validateConfig?: boolean;
}

/**
 * 配置模式定义
 */
export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    default?: any;
    envVar?: string;
    description?: string;
    required?: boolean;
  };
}

/**
 * 配置加载器
 */
export class ConfigLoader {
  private defaultConfig: Record<string, any> = {};
  private schema: ConfigSchema = {};

  constructor() {
    this.initializeDefaults();
    this.initializeSchema();
  }

  /**
   * 加载并合并配置
   */
  async loadConfig(command: ParsedCommand, options: ConfigLoadOptions = {}): Promise<Record<string, any>> {
    const configs: Record<string, ConfigValue> = {};

    // 1. 加载默认配置
    this.mergeConfig(configs, this.defaultConfig, 'default', 0);

    // 2. 加载配置文件
    if (options.configPath || command.options.config) {
      const filePath = options.configPath || command.options.config;
      const fileConfig = await this.loadConfigFile(filePath);
      this.mergeConfig(configs, fileConfig, 'file', 1);
    }

    // 3. 加载环境变量
    if (options.allowEnvOverride !== false) {
      const envConfig = this.loadEnvironmentConfig(options.envPrefix || 'RCC');
      this.mergeConfig(configs, envConfig, 'env', 2);
    }

    // 4. 应用命令行参数
    this.mergeConfig(configs, command.options, 'cli', 3);

    // 5. 提取最终值
    const finalConfig = this.extractFinalValues(configs);

    // 6. 验证配置（如果启用）
    if (options.validateConfig !== false) {
      this.validateConfig(finalConfig);
    }

    return finalConfig;
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaults(): void {
    this.defaultConfig = {
      // 服务器配置
      port: getServerPort(),
      host: getServerHost(),
      debug: false,

      // 客户端配置
      autoStart: false,
      export: false,

      // 状态配置
      detailed: false,

      // 停止配置
      force: false,

      // 配置管理
      list: false,
      validate: false,
      reset: false,

      // 通用配置
      timeout: getHttpRequestTimeout(),
      retryCount: 3,
      logLevel: 'info',
    };
  }

  /**
   * 初始化配置模式
   */
  private initializeSchema(): void {
    this.schema = {
      port: {
        type: 'number',
        envVar: 'RCC_PORT',
        description: 'Server port number',
        default: getServerPort(),
      },
      host: {
        type: 'string',
        envVar: 'RCC_HOST',
        description: 'Server host address',
        default: getServerHost(),
      },
      debug: {
        type: 'boolean',
        envVar: 'RCC_DEBUG',
        description: 'Enable debug mode',
        default: false,
      },
      config: {
        type: 'string',
        envVar: 'RCC_CONFIG',
        description: 'Configuration file path',
      },
      autoStart: {
        type: 'boolean',
        envVar: 'RCC_AUTO_START',
        description: 'Auto start server if not running',
        default: false,
      },
      export: {
        type: 'boolean',
        envVar: 'RCC_EXPORT',
        description: 'Export configuration for environment variables',
        default: false,
      },
      detailed: {
        type: 'boolean',
        envVar: 'RCC_DETAILED',
        description: 'Show detailed status information',
        default: false,
      },
      force: {
        type: 'boolean',
        envVar: 'RCC_FORCE',
        description: 'Force operation without confirmation',
        default: false,
      },
      timeout: {
        type: 'number',
        envVar: 'RCC_TIMEOUT',
        description: 'Request timeout in milliseconds',
        default: getHttpRequestTimeout(),
      },
      retryCount: {
        type: 'number',
        envVar: 'RCC_RETRY_COUNT',
        description: 'Number of retry attempts',
        default: 3,
      },
      logLevel: {
        type: 'string',
        envVar: 'RCC_LOG_LEVEL',
        description: 'Logging level (error, warn, info, debug)',
        default: 'info',
      },
    };
  }

  /**
   * 加载配置文件
   */
  private async loadConfigFile(filePath: string): Promise<Record<string, any>> {
    try {
      // TODO: 实现实际的文件加载逻辑
      // 这里需要支持 JSON, YAML, TOML 等格式

      if (filePath.endsWith('.json')) {
        return this.loadJSONConfig(filePath);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        return this.loadYAMLConfig(filePath);
      } else if (filePath.endsWith('.toml')) {
        return this.loadTOMLConfig(filePath);
      } else {
        throw new Error(`Unsupported config file format: ${filePath}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load config file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 加载JSON配置文件
   */
  private async loadJSONConfig(filePath: string): Promise<Record<string, any>> {
    // TODO: 实现实际的JSON文件读取
    // const fs = await import('fs/promises');\n    // const content = await fs.readFile(filePath, 'utf-8');\n    // return JSON.parse(content);

    // 模拟返回空配置
    return {};
  }

  /**
   * 加载YAML配置文件
   */
  private async loadYAMLConfig(filePath: string): Promise<Record<string, any>> {
    // TODO: 实现YAML文件加载
    // 需要安装 yaml 依赖
    throw new Error('YAML config support not implemented yet');
  }

  /**
   * 加载TOML配置文件
   */
  private async loadTOMLConfig(filePath: string): Promise<Record<string, any>> {
    // TODO: 实现TOML文件加载
    // 需要安装 @iarna/toml 依赖
    throw new Error('TOML config support not implemented yet');
  }

  /**
   * 加载环境变量配置
   */
  private loadEnvironmentConfig(prefix: string): Record<string, any> {
    const envConfig: Record<string, any> = {};

    // 遍历schema中定义的环境变量
    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.envVar) {
        const envValue = process.env[definition.envVar];
        if (envValue !== undefined) {
          envConfig[key] = this.parseEnvValue(envValue, definition.type);
        }
      }
    }

    // 检查通用前缀的环境变量
    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (envKey.startsWith(prefix + '_')) {
        const configKey = this.envToConfigKey(envKey, prefix);
        if (!envConfig[configKey]) {
          // 只有在schema中没有定义时才使用
          envConfig[configKey] = this.parseEnvValue(envValue!, 'string');
        }
      }
    }

    return envConfig;
  }

  /**
   * 解析环境变量值
   */
  private parseEnvValue(value: string, type: string): any {
    switch (type) {
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value in environment variable: ${value}`);
        }
        return num;
      case 'object':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON value in environment variable: ${value}`);
        }
      default:
        return value;
    }
  }

  /**
   * 环境变量名转配置键名
   */
  private envToConfigKey(envKey: string, prefix: string): string {
    return envKey
      .substring(prefix.length + 1) // 移除前缀和下划线
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()); // 转驼峰命名
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    configs: Record<string, ConfigValue>,
    newConfig: Record<string, any>,
    source: ConfigSource,
    priority: number
  ): void {
    for (const [key, value] of Object.entries(newConfig)) {
      if (value !== undefined && value !== null) {
        const existing = configs[key];
        if (!existing || existing.priority <= priority) {
          configs[key] = { value, source, priority };
        }
      }
    }
  }

  /**
   * 提取最终配置值
   */
  private extractFinalValues(configs: Record<string, ConfigValue>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, configValue] of Object.entries(configs)) {
      result[key] = configValue.value;
    }

    return result;
  }

  /**
   * 验证配置
   */
  private validateConfig(config: Record<string, any>): void {
    const errors: string[] = [];

    // 检查必需字段
    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.required && !(key in config)) {
        errors.push(`Missing required configuration: ${key}`);
      }
    }

    // 类型验证
    for (const [key, value] of Object.entries(config)) {
      const definition = this.schema[key];
      if (definition && !this.validateType(value, definition.type)) {
        errors.push(`Invalid type for ${key}: expected ${definition.type}, got ${typeof value}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * 验证值类型
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 获取配置源信息
   */
  getConfigSources(config: Record<string, any>): Record<string, ConfigSource> {
    // TODO: 实现配置源跟踪
    // 返回每个配置项的来源信息
    const sources: Record<string, ConfigSource> = {};

    for (const key of Object.keys(config)) {
      sources[key] = 'default'; // 简化实现
    }

    return sources;
  }

  /**
   * 导出配置为环境变量格式
   */
  exportAsEnvVars(config: Record<string, any>, prefix: string = 'RCC'): string[] {
    const envVars: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      const definition = this.schema[key];
      const envKey = definition?.envVar || `${prefix}_${this.configToEnvKey(key)}`;
      const envValue = this.formatEnvValue(value);
      envVars.push(`export ${envKey}=${envValue}`);
    }

    return envVars;
  }

  /**
   * 配置键名转环境变量名
   */
  private configToEnvKey(configKey: string): string {
    return configKey
      .replace(/([a-z])([A-Z])/g, '$1_$2') // 驼峰转下划线
      .toUpperCase();
  }

  /**
   * 格式化环境变量值
   */
  private formatEnvValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`; // 转义引号
    } else if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`; // 转义单引号
    } else {
      return String(value);
    }
  }
}
