/**
 * RCC v4.0 Configuration Loader
 *
 * 提供配置文件加载、缓存管理和热重载功能
 *
 * @author Jason Zhang
 */

import * as path from 'path';
import { secureLogger } from '../utils/secure-logger';
import { SecureConfigManager } from '../utils/config-encryption';
import { ConfigParser, ParseResult } from './config-parser';
import { ConfigValidator, ValidationRules } from './config-validator';
import { ConfigTransformer, EnvTransformOptions } from './config-transformer';
import {
  RCCv4Config,
  PipelineRouting,
  SecurityConfig,
  ConfigLoadOptions,
  ConfigValidationResult,
  ConfigCacheItem,
} from './config-types';

/**
 * 配置加载器选项
 */
export interface LoaderOptions {
  enableCache?: boolean;
  enableValidation?: boolean;
  enableEnvTransform?: boolean;
  cacheTimeout?: number;
  watchForChanges?: boolean;
  validationRules?: Partial<ValidationRules>;
  envTransformOptions?: EnvTransformOptions;
}

/**
 * 配置加载结果
 */
export interface LoadResult {
  config: RCCv4Config;
  validation: ConfigValidationResult;
  loadedFiles: string[];
  loadTime: number;
  fromCache: boolean;
}

/**
 * 默认配置加载器选项
 */
const DEFAULT_LOADER_OPTIONS: Required<LoaderOptions> = {
  enableCache: true,
  enableValidation: true,
  enableEnvTransform: true,
  cacheTimeout: 300000, // 5分钟
  watchForChanges: false,
  validationRules: {},
  envTransformOptions: {},
};

/**
 * 配置加载器
 */
export class ConfigLoader {
  private parser: ConfigParser;
  private validator: ConfigValidator;
  private transformer: ConfigTransformer;
  private secureConfigManager: SecureConfigManager;
  private configCache: Map<string, ConfigCacheItem> = new Map();
  private options: Required<LoaderOptions>;
  private fileWatchers: Map<string, any> = new Map();

  constructor(options: LoaderOptions = {}) {
    this.options = { ...DEFAULT_LOADER_OPTIONS, ...options };
    this.parser = new ConfigParser();
    this.validator = new ConfigValidator(this.options.validationRules);
    this.transformer = new ConfigTransformer();
    this.secureConfigManager = new SecureConfigManager();
  }

  /**
   * 初始化配置加载器
   */
  async initialize(): Promise<void> {
    await this.secureConfigManager.initialize();
    secureLogger.info('🔧 配置加载器已初始化');
  }

  /**
   * 加载完整的v4配置
   */
  async loadConfig(configDir: string = 'config/v4', options: ConfigLoadOptions = {}): Promise<LoadResult> {
    const startTime = Date.now();
    secureLogger.info(`📂 加载RCC v4.0配置: ${configDir}`);

    try {
      // 合并选项
      const loadOptions = { ...this.options, ...options };

      // 检查缓存
      if (loadOptions.useCache !== false && this.options.enableCache) {
        const cachedResult = this.getCachedConfig(configDir);
        if (cachedResult) {
          secureLogger.debug('📄 使用缓存的配置');
          return {
            ...cachedResult,
            loadTime: Date.now() - startTime,
            fromCache: true,
          };
        }
      }

      // 并行加载各个配置文件
      const [providersResult, routingResult, securityResult] = await Promise.all([
        this.loadProviderConfig(path.join(configDir, 'providers/server-compatibility-providers.json')),
        this.loadRoutingConfig(path.join(configDir, 'routing/pipeline-routing.json')),
        this.loadSecurityConfig(path.join(configDir, 'security/security-config.json')),
      ]);

      // 合并配置
      const rawConfig: RCCv4Config = {
        version: '4.0.0',
        serverCompatibilityProviders: providersResult.data.serverCompatibilityProviders || {},
        standardProviders: providersResult.data.standardProviders || {},
        routing: routingResult.data,
        security: securityResult.data,
        validation: providersResult.data.validation || {
          required: [],
          environmentVariables: { required: [], optional: [] },
        },
      };

      // 处理环境变量替换
      let processedConfig = rawConfig;
      if (loadOptions.processEnvVars !== false && this.options.enableEnvTransform) {
        const transformResult = await this.transformer.processEnvironmentVariables(
          rawConfig,
          this.options.envTransformOptions
        );
        processedConfig = transformResult.data;

        if (transformResult.warnings.length > 0) {
          secureLogger.warn('⚠️ 环境变量处理警告', { warnings: transformResult.warnings });
        }

        if (transformResult.errors.length > 0) {
          secureLogger.error('❌ 环境变量处理错误', { errors: transformResult.errors });
        }
      }

      // 验证配置
      let validation: ConfigValidationResult = { isValid: true, valid: true, errors: [], warnings: [] };
      if (loadOptions.validateConfig !== false && this.options.enableValidation) {
        validation = await this.validator.validate(processedConfig);

        if (!validation.isValid) {
          secureLogger.error('❌ 配置验证失败', validation);
          throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
          secureLogger.warn('⚠️ 配置验证警告', { warnings: validation.warnings });
        }
      }

      const result: LoadResult = {
        config: processedConfig,
        validation,
        loadedFiles: [
          path.join(configDir, 'providers/server-compatibility-providers.json'),
          path.join(configDir, 'routing/pipeline-routing.json'),
          path.join(configDir, 'security/security-config.json'),
        ],
        loadTime: Date.now() - startTime,
        fromCache: false,
      };

      // 缓存结果
      if (this.options.enableCache) {
        this.setCachedConfig(configDir, result);
      }

      // 设置文件监听
      if (this.options.watchForChanges) {
        this.setupFileWatchers(result.loadedFiles, configDir);
      }

      secureLogger.info('✅ RCC v4.0配置加载成功', {
        loadTime: result.loadTime,
        filesLoaded: result.loadedFiles.length,
      });

      return result;
    } catch (error) {
      secureLogger.error('❌ RCC v4.0配置加载失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 加载Provider配置
   */
  private async loadProviderConfig(filePath: string): Promise<ParseResult> {
    return this.loadConfigFile(filePath, 'providers');
  }

  /**
   * 加载路由配置
   */
  private async loadRoutingConfig(filePath: string): Promise<ParseResult<PipelineRouting>> {
    return this.loadConfigFile(filePath, 'routing');
  }

  /**
   * 加载安全配置
   */
  private async loadSecurityConfig(filePath: string): Promise<ParseResult<SecurityConfig>> {
    return this.loadConfigFile(filePath, 'security');
  }

  /**
   * 加载配置文件
   */
  private async loadConfigFile(filePath: string, type: string): Promise<ParseResult> {
    const cacheKey = `${type}:${filePath}`;

    // 检查缓存
    if (this.options.enableCache && this.configCache.has(cacheKey)) {
      const cachedItem = this.configCache.get(cacheKey)!;

      // 检查缓存是否过期
      if (Date.now() - cachedItem.timestamp < this.options.cacheTimeout) {
        secureLogger.debug(`📄 使用缓存的${type}配置: ${filePath}`);
        return {
          data: cachedItem.data,
          format: 'json',
          filePath: cachedItem.filePath,
          parsedAt: new Date(cachedItem.timestamp),
        };
      } else {
        // 缓存过期，移除
        this.configCache.delete(cacheKey);
      }
    }

    try {
      // 尝试使用安全配置管理器加载
      let config: any;
      try {
        config = await this.secureConfigManager.loadSecureConfig(filePath);
      } catch (secureError) {
        // 如果安全加载失败，使用普通解析器
        secureLogger.debug(`安全加载失败，使用普通解析器: ${filePath}`);
        const parseResult = await this.parser.parse(filePath);
        config = parseResult.data;
      }

      // 缓存结果
      if (this.options.enableCache) {
        this.configCache.set(cacheKey, {
          data: config,
          timestamp: Date.now(),
          filePath,
        });
      }

      secureLogger.debug(`📄 已加载${type}配置: ${filePath}`);

      return {
        data: config,
        format: 'json',
        filePath,
        parsedAt: new Date(),
      };
    } catch (error) {
      secureLogger.error(`❌ 加载${type}配置失败: ${filePath}`, { error: error.message });
      throw new Error(`Failed to load ${type} config from ${filePath}: ${error.message}`);
    }
  }

  /**
   * 获取缓存的配置
   */
  private getCachedConfig(configDir: string): LoadResult | null {
    const cacheKey = `full_config:${configDir}`;
    const cachedItem = this.configCache.get(cacheKey);

    if (!cachedItem) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - cachedItem.timestamp >= this.options.cacheTimeout) {
      this.configCache.delete(cacheKey);
      return null;
    }

    return cachedItem.data as LoadResult;
  }

  /**
   * 设置缓存的配置
   */
  private setCachedConfig(configDir: string, result: LoadResult): void {
    const cacheKey = `full_config:${configDir}`;
    this.configCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      filePath: configDir,
    });
  }

  /**
   * 设置文件监听器
   */
  private setupFileWatchers(filePaths: string[], configDir: string): void {
    if (this.fileWatchers.has(configDir)) {
      return; // 已经设置了监听器
    }

    try {
      const fs = require('fs');
      const watchers: any[] = [];

      for (const filePath of filePaths) {
        const watcher = fs.watchFile(filePath, { interval: 1000 }, () => {
          secureLogger.info(`📄 检测到配置文件变化: ${filePath}`);
          this.handleFileChange(configDir);
        });
        watchers.push(watcher);
      }

      this.fileWatchers.set(configDir, watchers);
      secureLogger.debug(`👀 设置了 ${watchers.length} 个文件监听器`);
    } catch (error) {
      secureLogger.warn('⚠️ 设置文件监听器失败', { error: error.message });
    }
  }

  /**
   * 处理文件变化
   */
  private handleFileChange(configDir: string): void {
    // 清除相关缓存
    this.clearCache(configDir);

    // 触发配置重新加载事件（可以扩展为事件发射器）
    secureLogger.info('🔄 配置文件已更改，缓存已清除');
  }

  /**
   * 清除缓存
   */
  clearCache(configDir?: string): void {
    if (configDir) {
      // 清除特定目录的缓存
      const keysToDelete = Array.from(this.configCache.keys()).filter(key => key.includes(configDir));

      for (const key of keysToDelete) {
        this.configCache.delete(key);
      }

      secureLogger.debug(`🧹 清除了 ${keysToDelete.length} 个缓存项`);
    } else {
      // 清除所有缓存
      const cacheSize = this.configCache.size;
      this.configCache.clear();
      secureLogger.debug(`🧹 清除了所有缓存 (${cacheSize} 个项目)`);
    }
  }

  /**
   * 获取缓存状态
   */
  getCacheStats(): { size: number; items: string[] } {
    return {
      size: this.configCache.size,
      items: Array.from(this.configCache.keys()),
    };
  }

  /**
   * 热重载配置
   */
  async reloadConfig(configDir: string): Promise<LoadResult> {
    secureLogger.info(`🔄 热重载配置: ${configDir}`);

    // 清除缓存
    this.clearCache(configDir);

    // 重新加载
    return this.loadConfig(configDir, { useCache: false });
  }

  /**
   * 预加载配置（用于性能优化）
   */
  async preloadConfig(configDir: string): Promise<void> {
    try {
      await this.loadConfig(configDir);
      secureLogger.debug(`📋 配置预加载完成: ${configDir}`);
    } catch (error) {
      secureLogger.warn(`⚠️ 配置预加载失败: ${configDir}`, { error: error.message });
    }
  }

  /**
   * 验证配置目录结构
   */
  async validateConfigStructure(configDir: string): Promise<{ isValid: boolean; missing: string[]; issues: string[] }> {
    const requiredFiles = [
      'providers/server-compatibility-providers.json',
      'routing/pipeline-routing.json',
      'security/security-config.json',
    ];

    const missing: string[] = [];
    const issues: string[] = [];

    for (const file of requiredFiles) {
      const filePath = path.join(configDir, file);
      try {
        const fs = require('fs');
        await fs.promises.access(filePath);
      } catch {
        missing.push(file);
      }
    }

    if (missing.length === 0) {
      // 尝试解析文件以检查格式
      for (const file of requiredFiles) {
        try {
          await this.parser.parse(path.join(configDir, file));
        } catch (error) {
          issues.push(`Invalid format in ${file}: ${error.message}`);
        }
      }
    }

    return {
      isValid: missing.length === 0 && issues.length === 0,
      missing,
      issues,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清除缓存
    this.configCache.clear();

    // 清除文件监听器
    for (const [configDir, watchers] of this.fileWatchers) {
      const fs = require('fs');
      for (const watcher of watchers) {
        fs.unwatchFile(watcher);
      }
    }
    this.fileWatchers.clear();

    // 清理安全配置管理器
    this.secureConfigManager.cleanup();

    secureLogger.info('🧹 配置加载器已清理');
  }
}
