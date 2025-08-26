/**
 * Provider配置加载器
 *
 * 从配置文件加载Provider配置，支持多种格式
 *
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as JSON5 from 'json5';
// import * as yaml from 'yaml'; // TODO: 安装yaml包或使用替代方案
import { ProviderConfig } from './provider-factory';
import { JQJsonHandler } from '../../utils/jq-json-handler';
/**
 * 配置文件格式
 */
export type ConfigFormat = 'json' | 'json5' | 'yaml' | 'yml';

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  /** 配置文件路径 */
  filePath: string;
  /** 配置格式(自动检测如果不指定) */
  format?: ConfigFormat;
  /** 环境变量前缀，用于覆盖配置 */
  envPrefix?: string;
  /** 验证配置 */
  validate?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 配置文件结构
 */
export interface ProviderConfigFile {
  /** 版本信息 */
  version: string;
  /** Provider配置列表 */
  providers: ProviderConfig[];
  /** 全局配置 */
  global?: {
    /** 调试模式 */
    debug?: boolean;
    /** 日志级别 */
    logLevel?: string;
  };
}

/**
 * Provider配置加载器
 */
export class ConfigLoader {
  /**
   * 加载配置文件
   */
  public static async loadConfig(options: ConfigLoadOptions): Promise<ProviderConfigFile> {
    const { filePath, format, envPrefix, validate = true, debug = false } = options;

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }

      // 读取文件内容
      const fileContent = fs.readFileSync(filePath, 'utf8');

      if (debug) {
        console.log(`[ConfigLoader] Loading configuration from: ${filePath}`);
      }

      // 解析配置
      const parsedConfig = this.parseConfig(fileContent, format || this.detectFormat(filePath));

      // 应用环境变量覆盖
      if (envPrefix) {
        this.applyEnvironmentOverrides(parsedConfig, envPrefix);
      }

      // 验证配置
      if (validate) {
        this.validateConfig(parsedConfig);
      }

      if (debug) {
        console.log(`[ConfigLoader] Loaded ${parsedConfig.providers.length} provider configurations`);
      }

      return parsedConfig;
    } catch (error) {
      if (debug) {
        console.error(`[ConfigLoader] Failed to load configuration:`, error);
      }
      throw error;
    }
  }

  /**
   * 检测配置文件格式
   */
  private static detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return 'json';
      case '.json5':
        return 'json5';
      case '.yaml':
        return 'yaml';
      case '.yml':
        return 'yml';
      default:
        return 'json'; // 默认为JSON
    }
  }

  /**
   * 解析配置内容
   */
  private static parseConfig(content: string, format: ConfigFormat): ProviderConfigFile {
    switch (format) {
      case 'json':
        return JSON.parse(content);

      case 'json5':
        return JSON5.parse(content);

      case 'yaml':
      case 'yml':
        throw new Error('YAML parsing not supported (yaml package not installed)');

      default:
        throw new Error(`Unsupported configuration format: ${format}`);
    }
  }

  /**
   * 应用环境变量覆盖
   */
  private static applyEnvironmentOverrides(config: ProviderConfigFile, envPrefix: string): void {
    const prefix = envPrefix.toUpperCase();

    // 全局配置覆盖
    if (process.env[`${prefix}_DEBUG`]) {
      if (!config.global) config.global = {};
      config.global.debug = process.env[`${prefix}_DEBUG`] === 'true';
    }

    // Provider配置覆盖
    config.providers.forEach((provider, index) => {
      const providerPrefix = `${prefix}_PROVIDER_${index}`;

      // API Key覆盖
      const apiKeyEnv = process.env[`${providerPrefix}_API_KEY`];
      if (apiKeyEnv && provider.config) {
        provider.config.apiKey = apiKeyEnv;
      }

      // 启用状态覆盖
      const enabledEnv = process.env[`${providerPrefix}_ENABLED`];
      if (enabledEnv !== undefined) {
        provider.enabled = enabledEnv === 'true';
      }
    });
  }

  /**
   * 验证配置结构
   */
  private static validateConfig(config: ProviderConfigFile): void {
    const errors: string[] = [];

    // 验证版本信息
    if (!config.version) {
      errors.push('Configuration version is required');
    }

    // 验证Provider配置
    if (!config.providers || !Array.isArray(config.providers)) {
      errors.push('Providers configuration must be an array');
    } else if (config.providers.length === 0) {
      errors.push('At least one provider configuration is required');
    } else {
      // 验证每个Provider配置
      config.providers.forEach((provider, index) => {
        const providerErrors = this.validateProviderConfig(provider, index);
        errors.push(...providerErrors);
      });
    }

    // 检查Provider ID唯一性
    const providerIds = config.providers.map(p => p.id);
    const duplicateIds = providerIds.filter((id, index) => providerIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate provider IDs found: ${duplicateIds.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * 验证单个Provider配置
   */
  private static validateProviderConfig(provider: ProviderConfig, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Provider ${index}`;

    if (!provider.id) {
      errors.push(`${prefix}: ID is required`);
    }

    if (!provider.type) {
      errors.push(`${prefix}: Type is required`);
    }

    if (!provider.name) {
      errors.push(`${prefix}: Name is required`);
    }

    if (typeof provider.enabled !== 'boolean') {
      errors.push(`${prefix}: Enabled must be a boolean`);
    }

    if (!provider.config) {
      errors.push(`${prefix}: Config is required`);
    } else {
      // 验证特定协议配置
      if (provider.type === 'openai' || provider.type === 'anthropic') {
        if (!provider.config.apiKey) {
          errors.push(`${prefix}: API key is required for ${provider.type} provider`);
        }
        if (!provider.config.defaultModel) {
          errors.push(`${prefix}: Default model is required for ${provider.type} provider`);
        }
      }
    }

    return errors;
  }

  /**
   * 保存配置文件
   */
  public static async saveConfig(config: ProviderConfigFile, filePath: string, format?: ConfigFormat): Promise<void> {
    const configFormat = format || this.detectFormat(filePath);
    let content: string;

    switch (configFormat) {
      case 'json':
        content = JQJsonHandler.stringifyJson(config, false);
        break;

      case 'json5':
        content = JSON5.stringify(config, null, 2);
        break;

      case 'yaml':
      case 'yml':
        throw new Error('YAML writing not supported (yaml package not installed)');
        break;

      default:
        throw new Error(`Unsupported configuration format: ${configFormat}`);
    }

    // 确保目录存在
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * 创建示例配置
   */
  public static createExampleConfig(): ProviderConfigFile {
    return {
      version: '4.0.0',
      global: {
        debug: false,
        logLevel: 'info',
      },
      providers: [
        {
          id: 'openai-primary',
          name: 'OpenAI Primary',
          type: 'openai',
          enabled: true,
          config: {
            apiKey: 'sk-your-openai-api-key',
            defaultModel: 'gpt-3.5-turbo',
            timeout: 30000,
            maxRetries: 3,
            enableStreaming: true,
            enableToolCalls: true,
            debug: false,
          },
        },
        {
          id: 'anthropic-primary',
          name: 'Anthropic Primary',
          type: 'anthropic',
          enabled: true,
          config: {
            apiKey: 'your-anthropic-api-key',
            defaultModel: 'claude-3-sonnet-20240229',
            timeout: 30000,
            maxRetries: 3,
            enableToolCalls: true,
            debug: false,
          },
        },
      ],
    };
  }

  /**
   * 合并配置文件
   */
  public static mergeConfigs(
    baseConfig: ProviderConfigFile,
    overrideConfig: Partial<ProviderConfigFile>
  ): ProviderConfigFile {
    const merged: ProviderConfigFile = {
      ...baseConfig,
      ...overrideConfig,
    };

    // 合并providers数组
    if (overrideConfig.providers) {
      merged.providers = [...baseConfig.providers, ...overrideConfig.providers];
    }

    // 合并global配置
    if (overrideConfig.global) {
      merged.global = { ...baseConfig.global, ...overrideConfig.global };
    }

    return merged;
  }
}
