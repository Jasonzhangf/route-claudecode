/**
 * RCC v4.0 统一配置加载器
 *
 * 实现永久模板规则的配置加载和验证系统
 * 遵循.claude/rules/unified-cli-config-template.md规范
 * 所有配置值从配置文件加载，无硬编码
 *
 * @author Jason Zhang
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 合并配置接口
 */
export interface MergedConfig {
  version: string;
  templateVersion: string;
  virtualModels: Record<string, VirtualModelConfig>;
  blacklistSettings: BlacklistSettings;
  server: ServerConfig;
  systemConfig?: any;
}

/**
 * 虚拟模型配置
 */
export interface VirtualModelConfig {
  providers: ProviderConfig[];
}

/**
 * Provider配置
 */
export interface ProviderConfig {
  name: string;
  model: string;
  weight: number;
  apiKeys: string[];
}

/**
 * 黑名单设置
 */
export interface BlacklistSettings {
  timeout429: number;
  timeoutError: number;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  debug: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 配置错误类型
 */
export enum ConfigErrorType {
  MISSING_FILE = 'MISSING_FILE',
  INVALID_JSON = 'INVALID_JSON',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
}

/**
 * 配置模板接口
 */
interface ConfigTemplate {
  paths: {
    templateConfig: string;
    systemConfig: string;
    searchPaths: string[];
  };
  errorMessages: Record<string, string>;
  defaultConfig: any;
  validationRules: any;
}

/**
 * 统一配置加载器实现
 */
export class UnifiedConfigLoader {
  private configTemplate: ConfigTemplate | null = null;

  /**
   * 初始化配置模板
   */
  private async loadConfigTemplate(): Promise<ConfigTemplate> {
    if (this.configTemplate) {
      return this.configTemplate;
    }

    try {
      // 使用环境变量或默认路径
      const templatePath = process.env.RCC_CONFIG_TEMPLATE_PATH || 'config/unified-config-templates.json';
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      this.configTemplate = JSON.parse(templateContent);
      return this.configTemplate!;
    } catch (error) {
      throw new Error(`Failed to load config template: ${error.message}`);
    }
  }

  /**
   * 加载和合并配置
   */
  async loadConfig(userConfigPath?: string, systemConfigPath?: string): Promise<MergedConfig> {
    try {
      // 1. 加载配置模板
      const template = await this.loadConfigTemplate();

      // 2. 加载系统配置
      const systemConfig = await this.loadSystemConfig(systemConfigPath || template.paths.systemConfig);

      // 3. 加载用户配置
      const userConfig = await this.loadUserConfig(userConfigPath, template.paths.searchPaths);

      // 4. 合并配置
      const mergedConfig = this.mergeConfigs(systemConfig, userConfig, template.defaultConfig);

      // 5. 验证配置
      const validation = this.validateTemplate(mergedConfig, template);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      return mergedConfig;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * 加载系统配置
   */
  private async loadSystemConfig(systemConfigPath: string): Promise<any> {
    try {
      const configContent = await fs.readFile(systemConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.warn(`System config not found at ${systemConfigPath}, using empty config`);
      return {};
    }
  }

  /**
   * 加载用户配置
   */
  private async loadUserConfig(userConfigPath?: string, searchPaths?: string[]): Promise<any> {
    const template = await this.loadConfigTemplate();
    const paths = searchPaths || template.paths.searchPaths;

    // 如果指定了路径，直接使用
    if (userConfigPath) {
      try {
        const configContent = await fs.readFile(userConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        return this.convertLegacyConfig(config);
      } catch (error) {
        throw new Error(this.formatError(ConfigErrorType.MISSING_FILE, { path: userConfigPath }, template));
      }
    }

    // 按顺序搜索配置文件
    for (const searchPath of paths) {
      const resolvedPath = searchPath.startsWith('~')
        ? path.join(process.env.HOME || '', searchPath.slice(2))
        : searchPath;

      try {
        const configContent = await fs.readFile(resolvedPath, 'utf-8');
        const config = JSON.parse(configContent);
        return this.convertLegacyConfig(config);
      } catch (error) {
        // 继续搜索下一个路径
        continue;
      }
    }

    throw new Error(
      this.formatError(
        ConfigErrorType.MISSING_FILE,
        {
          path: paths.join(', '),
        },
        template
      )
    );
  }

  /**
   * 合并配置
   */
  private mergeConfigs(systemConfig: any, userConfig: any, defaultConfig: any): MergedConfig {
    return {
      version: userConfig.version || defaultConfig.version,
      templateVersion: defaultConfig.templateVersion,
      virtualModels: userConfig.virtualModels || defaultConfig.virtualModels,
      blacklistSettings: {
        timeout429: userConfig.blacklistSettings?.timeout429 || defaultConfig.blacklistSettings.timeout429,
        timeoutError: userConfig.blacklistSettings?.timeoutError || defaultConfig.blacklistSettings.timeoutError,
      },
      server: {
        port: userConfig.server?.port || defaultConfig.server.port,
        host: userConfig.server?.host || defaultConfig.server.host,
        debug: userConfig.server?.debug !== undefined ? userConfig.server.debug : defaultConfig.server.debug,
      },
      systemConfig,
    };
  }

  /**
   * 验证配置模板
   */
  validateTemplate(config: any, template: ConfigTemplate): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rules = template.validationRules;

    // 验证必需字段
    for (const field of rules.required) {
      if (!config[field]) {
        errors.push(this.formatError(ConfigErrorType.MISSING_REQUIRED, { field }, template));
      }
    }

    // 验证必需的虚拟模型
    if (config.virtualModels) {
      for (const requiredModel of rules.virtualModels.requiredModels) {
        if (!config.virtualModels[requiredModel]) {
          errors.push(
            this.formatError(
              ConfigErrorType.MISSING_REQUIRED,
              {
                field: `virtualModels.${requiredModel}`,
              },
              template
            )
          );
        }
      }

      // 验证Provider配置
      for (const [modelName, modelConfig] of Object.entries(config.virtualModels)) {
        if (typeof modelConfig === 'object' && modelConfig !== null) {
          const typedConfig = modelConfig as any;
          if (!typedConfig.providers || !Array.isArray(typedConfig.providers)) {
            errors.push(this.formatError(ConfigErrorType.PROVIDER_ERROR, { provider: modelName }, template));
            continue;
          }

          for (const provider of typedConfig.providers) {
            for (const field of rules.virtualModels.providerFields) {
              if (!provider[field]) {
                errors.push(this.formatError(ConfigErrorType.PROVIDER_ERROR, { provider: modelName }, template));
                break;
              }
            }
          }
        }
      }
    }

    // 验证服务器配置
    if (config.server?.port) {
      const port = config.server.port;
      const [minPort, maxPort] = rules.server.portRange;
      if (port < minPort || port > maxPort) {
        warnings.push(`Port ${port} is outside recommended range [${minPort}-${maxPort}]`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 创建默认配置
   */
  async createDefaultConfig(outputPath: string): Promise<string> {
    const template = await this.loadConfigTemplate();
    const defaultConfig = {
      '// RCC v4.0 统一配置模板 - 永不变更': '',
      ...template.defaultConfig,
    };

    const configJson = JSON.stringify(defaultConfig, null, 2);
    await fs.writeFile(outputPath, configJson, 'utf-8');

    return outputPath;
  }

  /**
   * 格式化错误消息
   */
  private formatError(errorType: ConfigErrorType, params: Record<string, string>, template: ConfigTemplate): string {
    let message = template.errorMessages[errorType];

    for (const [key, value] of Object.entries(params)) {
      message = message.replace(`{${key}}`, value);
    }

    return message;
  }

  /**
   * 向后兼容：检测和转换旧配置格式
   */
  private convertLegacyConfig(config: any): any {
    // 自动检测和转换旧格式
    if (config.providers && Array.isArray(config.providers)) {
      config.virtualModels = {
        default: {
          providers: config.providers,
        },
      };
      delete config.providers;
    }

    return config;
  }
}
