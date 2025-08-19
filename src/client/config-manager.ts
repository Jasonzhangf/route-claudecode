/**
 * 配置管理器实现
 *
 * 提供配置加载、验证、列表和重置功能
 *
 * @author Jason Zhang
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IConfigManager, ValidationResult } from '../interfaces/core/cli-abstraction';
import { RCCError, ErrorHandler } from '../interfaces/client/error-handler';
import { DataValidator } from '../middleware/data-validator';

/**
 * 配置管理器错误类
 */
export class ConfigManagerError extends RCCError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFIG_MANAGER_ERROR', details);
    this.name = 'ConfigManagerError';
  }
}

/**
 * 配置验证Schema
 */
const CONFIG_SCHEMA = {
  serverCompatibilityProviders: {
    type: 'object' as const,
    required: false,
    properties: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, required: true },
        protocol: { type: 'string' as const, required: true },
        connection: {
          type: 'object' as const,
          required: true,
          properties: {
            endpoint: { type: 'string' as const, required: true },
            authentication: {
              type: 'object' as const,
              required: false,
              properties: {
                apiKey: { type: 'string' as const, required: false },
              },
            },
          },
        },
        models: {
          type: 'array' as const,
          required: false,
          properties: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const, required: true },
              maxTokens: { type: 'number' as const, required: false },
            },
          },
        },
      },
    },
  },
  routing: {
    type: 'object' as const,
    required: false,
    properties: {
      strategy: { type: 'string' as const, required: false },
      defaultProvider: { type: 'string' as const, required: false },
    },
  },
  server: {
    type: 'object' as const,
    required: false,
    properties: {
      port: { type: 'number' as const, required: false },
      host: { type: 'string' as const, required: false },
      debug: { type: 'boolean' as const, required: false },
    },
  },
  zeroFallbackPolicy: { type: 'boolean' as const, required: false },
};

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  serverCompatibilityProviders: {
    'lmstudio-local': {
      name: 'LM Studio Local',
      protocol: 'openai',
      connection: {
        endpoint: 'http://localhost:1234/v1/chat/completions',
        authentication: {
          apiKey: 'lm-studio',
        },
      },
      models: [
        {
          name: 'llama-3.1-8b',
          maxTokens: 4096,
        },
      ],
    },
  },
  routing: {
    strategy: 'round-robin',
    defaultProvider: 'lmstudio-local',
  },
  server: {
    port: 5506,
    host: 'localhost',
    debug: false,
  },
  zeroFallbackPolicy: true,
};

/**
 * 配置管理器实现
 */
export class ConfigManager implements IConfigManager {
  private configCache = new Map<string, any>();

  constructor(private errorHandler: ErrorHandler) {}

  /**
   * 加载配置
   */
  async loadConfig(configPath?: string): Promise<any> {
    try {
      const finalPath = configPath || this.getDefaultConfigPath();

      // 检查缓存
      if (this.configCache.has(finalPath)) {
        return { ...this.configCache.get(finalPath) };
      }

      // 检查文件是否存在
      try {
        await fs.access(finalPath);
      } catch {
        // 文件不存在，创建默认配置
        await this.createDefaultConfig(finalPath);
      }

      // 读取配置文件
      const configContent = await fs.readFile(finalPath, 'utf-8');
      const config = JSON.parse(configContent);

      // 合并默认配置
      const mergedConfig = this.mergeWithDefaults(config);

      // 缓存配置
      this.configCache.set(finalPath, mergedConfig);

      return { ...mergedConfig };
    } catch (error) {
      const configError = new ConfigManagerError(`Failed to load config: ${(error as Error).message}`, { configPath });
      this.errorHandler.handleError(configError);
      throw configError;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config: any): ValidationResult {
    try {
      const validation = DataValidator.validate(config, CONFIG_SCHEMA);
      const warnings: string[] = [];

      // 额外验证逻辑
      if (config.zeroFallbackPolicy === false) {
        warnings.push('zeroFallbackPolicy is disabled - this may affect error handling behavior');
      }

      if (config.serverCompatibilityProviders) {
        const providers = Object.keys(config.serverCompatibilityProviders);
        if (providers.length === 0) {
          validation.errors.push('At least one provider must be configured');
        }

        // 验证默认provider是否存在
        if (config.routing?.defaultProvider && !providers.includes(config.routing.defaultProvider)) {
          validation.errors.push(`Default provider '${config.routing.defaultProvider}' is not configured`);
        }
      }

      return {
        valid: validation.isValid && validation.errors.length === 0,
        errors: validation.errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  /**
   * 列出配置文件
   */
  async listConfigs(): Promise<string[]> {
    try {
      const configDir = path.dirname(this.getDefaultConfigPath());

      try {
        await fs.access(configDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(configDir);
      return files.filter(file => file.endsWith('.json')).map(file => path.join(configDir, file));
    } catch (error) {
      const configError = new ConfigManagerError(`Failed to list configs: ${(error as Error).message}`);
      this.errorHandler.handleError(configError);
      throw configError;
    }
  }

  /**
   * 重置配置
   */
  async resetConfig(): Promise<void> {
    try {
      const defaultPath = this.getDefaultConfigPath();
      await this.createDefaultConfig(defaultPath);

      // 清除缓存
      this.configCache.delete(defaultPath);
    } catch (error) {
      const configError = new ConfigManagerError(`Failed to reset config: ${(error as Error).message}`);
      this.errorHandler.handleError(configError);
      throw configError;
    }
  }

  /**
   * 获取默认配置路径
   */
  getDefaultConfigPath(): string {
    return path.join(process.cwd(), 'config', 'default.json');
  }

  /**
   * 获取用户配置路径
   */
  getUserConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    return path.join(homeDir, '.route-claudecode', 'config.json');
  }

  /**
   * 创建默认配置文件
   */
  private async createDefaultConfig(configPath: string): Promise<void> {
    const configDir = path.dirname(configPath);

    // 确保目录存在
    await fs.mkdir(configDir, { recursive: true });

    // 写入默认配置
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaults(config: any): any {
    return this.deepMerge(DEFAULT_CONFIG, config);
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (typeof source !== 'object' || typeof target !== 'object') {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * 保存配置
   */
  async saveConfig(config: any, configPath?: string): Promise<void> {
    try {
      const finalPath = configPath || this.getDefaultConfigPath();
      const configDir = path.dirname(finalPath);

      // 确保目录存在
      await fs.mkdir(configDir, { recursive: true });

      // 验证配置
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // 保存配置
      await fs.writeFile(finalPath, JSON.stringify(config, null, 2), 'utf-8');

      // 更新缓存
      this.configCache.set(finalPath, config);
    } catch (error) {
      const configError = new ConfigManagerError(`Failed to save config: ${(error as Error).message}`, { configPath });
      this.errorHandler.handleError(configError);
      throw configError;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * 获取配置模板
   */
  getConfigTemplate(): any {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * 验证配置路径
   */
  async validateConfigPath(configPath: string): Promise<boolean> {
    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, 'utf-8');
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取配置统计信息
   */
  getConfigStats(config: any): any {
    return {
      providers: Object.keys(config.serverCompatibilityProviders || {}).length,
      hasRouting: !!config.routing,
      hasServer: !!config.server,
      zeroFallbackEnabled: config.zeroFallbackPolicy === true,
      totalModels: Object.values(config.serverCompatibilityProviders || {}).reduce(
        (count, provider: any) => count + (provider.models?.length || 0),
        0
      ),
    };
  }
}

// ConfigManager is already exported above
