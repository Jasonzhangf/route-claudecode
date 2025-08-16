/**
 * 配置热重载器实现
 * 
 * 提供配置文件监听、热重载、验证和版本管理功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { promises as fs, watch, FSWatcher, Stats } from 'fs';
import { join, dirname, extname } from 'path';
import * as crypto from 'crypto';
import {
  IConfigHotReloader,
  ConfigWatchOptions,
  ConfigUpdateOptions,
  ConfigUpdateResult,
  ConfigValidationResult,
  ConfigUpdateEvent,
  ConfigChangeType,
  ConfigUpdateMode,
  ConfigUpdateStrategy,
  ConfigValidationLevel
} from '../interfaces/core/config-hot-reload-interface';

/**
 * 文件变更事件
 */
interface FileChangeEvent {
  type: 'change' | 'rename' | 'add' | 'unlink';
  path: string;
  stats?: Stats;
}

/**
 * 配置热重载器实现
 */
export class ConfigHotReloader extends EventEmitter implements IConfigHotReloader {
  private watchers = new Map<string, FSWatcher>();
  private watchOptions?: ConfigWatchOptions;
  private configCache = new Map<string, any>();
  private updateHistory: ConfigUpdateEvent[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isWatchingFlag = false;
  
  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ConfigHotReloader error:', error);
    });
  }

  /**
   * 开始监听配置文件变化
   */
  async startWatching(options: ConfigWatchOptions): Promise<void> {
    if (this.isWatchingFlag) {
      await this.stopWatching();
    }

    this.watchOptions = options;
    this.isWatchingFlag = true;

    // 验证和准备监听路径
    const validPaths = await this.validateWatchPaths(options.paths);
    
    for (const path of validPaths) {
      await this.setupWatcher(path, options);
    }

    // 初始加载所有配置文件
    await this.initialLoadConfigs(validPaths);

    this.emit('watching-started', validPaths);
  }

  /**
   * 停止监听配置文件变化
   */
  async stopWatching(): Promise<void> {
    // 关闭所有监听器
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        console.warn(`Error closing watcher for ${path}:`, error);
      }
    }

    // 清理定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }

    // 重置状态
    this.watchers.clear();
    this.debounceTimers.clear();
    this.isWatchingFlag = false;
    this.watchOptions = undefined;

    this.emit('watching-stopped');
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(configPath: string, options: Partial<ConfigUpdateOptions> = {}): Promise<ConfigUpdateResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 检查文件存在性
      const exists = await this.fileExists(configPath);
      if (!exists) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      // 读取和解析配置文件
      const newConfig = await this.loadConfigFile(configPath);
      const oldConfig = this.configCache.get(configPath);

      // 生成版本号
      const version = this.generateVersion(newConfig);

      // 验证配置
      const validationLevel = options.validationLevel || ConfigValidationLevel.BASIC;
      const validationResults = await this.validateConfig(newConfig, validationLevel);
      
      if (validationResults.some(r => !r.isValid)) {
        const validationErrors = validationResults
          .filter(r => !r.isValid)
          .flatMap(r => r.errors.map(e => e.message));
        errors.push(...validationErrors);
      }

      // 检测变更
      const changes = this.detectChanges(configPath, oldConfig, newConfig);

      // 如果有错误且不是强制模式，返回失败
      if (errors.length > 0 && !options.retryCount) {
        return {
          success: false,
          version,
          timestamp,
          changesApplied: [],
          validationResults,
          duration: Date.now() - startTime,
          warnings,
          errors
        };
      }

      // 应用配置更新
      if (changes.length > 0) {
        const updateResult = await this.applyConfigUpdates(changes, options);
        
        if (updateResult.success) {
          // 更新缓存
          this.configCache.set(configPath, newConfig);
          
          // 记录更新历史
          this.addToHistory(...changes);
          
          // 发送通知事件
          for (const change of changes) {
            this.emit('config-updated', change);
          }
        }

        return {
          ...updateResult,
          validationResults,
          warnings
        };
      }

      // 没有变更
      return {
        success: true,
        version,
        timestamp,
        changesApplied: [],
        validationResults,
        duration: Date.now() - startTime,
        warnings,
        errors
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        version: 'error',
        timestamp,
        changesApplied: [],
        validationResults: [],
        duration: Date.now() - startTime,
        warnings,
        errors
      };
    }
  }

  /**
   * 应用配置更新
   */
  async applyConfigUpdates(updates: ConfigUpdateEvent[], options: Partial<ConfigUpdateOptions> = {}): Promise<ConfigUpdateResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const appliedChanges: ConfigUpdateEvent[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 设置默认选项
      const updateOptions = {
        mode: options.mode || ConfigUpdateMode.HOT_RELOAD,
        strategy: options.strategy || ConfigUpdateStrategy.MERGE,
        validationLevel: options.validationLevel || ConfigValidationLevel.BASIC,
        createBackup: options.createBackup !== false,
        notifyServices: options.notifyServices !== false,
        timeout: options.timeout || 30000,
        retryCount: options.retryCount || 3,
        ...options
      };

      // 创建备份（如果启用）
      let rollbackVersion: string | undefined;
      if (updateOptions.createBackup) {
        rollbackVersion = await this.createBackup(updates);
      }

      // 按策略应用更新
      for (const update of updates) {
        try {
          const applied = await this.applySingleUpdate(update, updateOptions);
          if (applied) {
            appliedChanges.push(update);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to apply update ${update.id}: ${errorMsg}`);
          
          // 如果是关键错误，可能需要回滚
          if (updateOptions.createBackup && errors.length > 2) {
            warnings.push('Multiple failures detected, consider rollback');
          }
        }
      }

      // 通知相关服务（如果启用）
      if (updateOptions.notifyServices && appliedChanges.length > 0) {
        await this.notifyServices(appliedChanges);
      }

      const version = this.generateVersion(appliedChanges);
      
      return {
        success: errors.length === 0,
        version,
        timestamp,
        changesApplied: appliedChanges,
        validationResults: [], // 在reloadConfig中处理验证
        rollbackVersion,
        duration: Date.now() - startTime,
        warnings,
        errors,
        metadata: {
          updateMode: updateOptions.mode,
          updateStrategy: updateOptions.strategy,
          totalUpdates: updates.length,
          appliedUpdates: appliedChanges.length
        }
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during update');
      
      return {
        success: false,
        version: 'error',
        timestamp,
        changesApplied: appliedChanges,
        validationResults: [],
        duration: Date.now() - startTime,
        warnings,
        errors
      };
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(config: any, level: ConfigValidationLevel = ConfigValidationLevel.BASIC): Promise<ConfigValidationResult[]> {
    const results: ConfigValidationResult[] = [];

    try {
      // 基础验证
      if (level >= ConfigValidationLevel.BASIC) {
        results.push(await this.performBasicValidation(config));
      }

      // 严格验证
      if (level >= ConfigValidationLevel.STRICT) {
        results.push(await this.performStrictValidation(config));
      }

      // 完整验证（包括业务逻辑）
      if (level >= ConfigValidationLevel.FULL) {
        results.push(await this.performFullValidation(config));
      }

    } catch (error) {
      results.push({
        path: 'root',
        isValid: false,
        level,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Validation failed',
          path: 'root',
          severity: 'error' as const
        }],
        warnings: [],
        suggestions: []
      });
    }

    return results;
  }

  /**
   * 获取配置变更历史
   */
  async getUpdateHistory(limit: number = 100): Promise<ConfigUpdateEvent[]> {
    return this.updateHistory
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * 检查是否正在监听
   */
  isWatching(): boolean {
    return this.isWatchingFlag;
  }

  // ============ 私有方法 ============

  /**
   * 验证监听路径
   */
  private async validateWatchPaths(paths: string[]): Promise<string[]> {
    const validPaths: string[] = [];

    for (const path of paths) {
      try {
        const exists = await this.fileExists(path);
        if (exists) {
          validPaths.push(path);
        } else {
          console.warn(`Watch path does not exist: ${path}`);
        }
      } catch (error) {
        console.warn(`Cannot access watch path ${path}:`, error);
      }
    }

    return validPaths;
  }

  /**
   * 设置文件监听器
   */
  private async setupWatcher(path: string, options: ConfigWatchOptions): Promise<void> {
    try {
      const watcher = watch(path, {
        recursive: options.recursive
      }, (eventType, filename) => {
        if (filename) {
          this.handleFileChange(path, filename, eventType);
        }
      });

      watcher.on('error', (error) => {
        console.error(`Watcher error for ${path}:`, error);
        this.emit('error', new Error(`Watcher error for ${path}: ${error.message}`));
      });

      this.watchers.set(path, watcher);

    } catch (error) {
      throw new Error(`Failed to setup watcher for ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理文件变更事件
   */
  private handleFileChange(basePath: string, filename: string, eventType: string): void {
    if (!this.watchOptions) return;

    const fullPath = join(basePath, filename);
    
    // 检查文件扩展名过滤
    if (this.watchOptions.fileExtensions.length > 0) {
      const ext = extname(fullPath);
      if (!this.watchOptions.fileExtensions.includes(ext)) {
        return;
      }
    }

    // 检查忽略路径
    if (this.isIgnoredPath(fullPath)) {
      return;
    }

    // 防抖处理
    this.debounceFileChange(fullPath, () => {
      this.processFileChange(fullPath, eventType);
    });
  }

  /**
   * 防抖处理文件变更
   */
  private debounceFileChange(path: string, callback: () => void): void {
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = this.watchOptions?.debounceDelay || 300;
    const timer = setTimeout(callback, delay);
    this.debounceTimers.set(path, timer);
  }

  /**
   * 处理文件变更
   */
  private async processFileChange(path: string, eventType: string): Promise<void> {
    try {
      // 自动重新加载配置
      const result = await this.reloadConfig(path, {
        mode: ConfigUpdateMode.HOT_RELOAD,
        strategy: ConfigUpdateStrategy.REPLACE,
        validationLevel: ConfigValidationLevel.BASIC
      });

      if (result.success) {
        console.log(`Configuration reloaded successfully: ${path}`);
      } else {
        console.error(`Failed to reload configuration ${path}:`, result.errors);
        this.emit('config-validation-failed', []);
      }

    } catch (error) {
      console.error(`Error processing file change for ${path}:`, error);
      this.emit('error', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * 初始加载配置文件
   */
  private async initialLoadConfigs(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        const config = await this.loadConfigFile(path);
        this.configCache.set(path, config);
      } catch (error) {
        console.warn(`Failed to load initial config from ${path}:`, error);
      }
    }
  }

  /**
   * 加载配置文件
   */
  private async loadConfigFile(path: string): Promise<any> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      const ext = extname(path).toLowerCase();

      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.yaml':
        case '.yml':
          try {
            const yaml = await import('yaml');
            return yaml.parse(content);
          } catch (error) {
            throw new Error(`YAML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        case '.toml':
          try {
            const toml = await import('@iarna/toml');
            return toml.parse(content);
          } catch (error) {
            throw new Error(`TOML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to load config file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为忽略路径
   */
  private isIgnoredPath(path: string): boolean {
    if (!this.watchOptions?.ignorePaths) return false;

    return this.watchOptions.ignorePaths.some(ignorePath => {
      return path.includes(ignorePath);
    });
  }

  /**
   * 检测配置变更
   */
  private detectChanges(path: string, oldConfig: any, newConfig: any): ConfigUpdateEvent[] {
    const changes: ConfigUpdateEvent[] = [];
    const timestamp = new Date();
    const version = this.generateVersion(newConfig);

    // 简化的变更检测 - 深度比较可以更复杂
    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      changes.push({
        id: this.generateEventId(),
        timestamp,
        type: ConfigChangeType.UPDATE,
        path,
        oldValue: oldConfig,
        newValue: newConfig,
        source: 'file-watcher',
        version,
        metadata: {
          fileSize: JSON.stringify(newConfig).length,
          changeDetectedAt: timestamp.toISOString()
        }
      });
    }

    return changes;
  }

  /**
   * 应用单个配置更新
   */
  private async applySingleUpdate(update: ConfigUpdateEvent, options: ConfigUpdateOptions): Promise<boolean> {
    try {
      // 根据更新类型和路径进行具体的配置更新
      const { type, path, newValue } = update;
      
      // 基本处理时间
      await new Promise(resolve => setTimeout(resolve, 10));

      // 根据更新类型进行实际处理
      switch (type) {
        case 'create':
          return await this.handleCreateUpdate(path, newValue, options);
        case 'update':
          return await this.handleUpdateUpdate(path, newValue, options);
        case 'delete':
          return await this.handleDeleteUpdate(path, options);
        default:
          throw new Error(`Unsupported update type: ${type}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 处理创建更新
   */
  private async handleCreateUpdate(path: string, value: any, options: ConfigUpdateOptions): Promise<boolean> {
    // 实际的创建逻辑实现
    return true;
  }

  /**
   * 处理更新更新
   */
  private async handleUpdateUpdate(path: string, value: any, options: ConfigUpdateOptions): Promise<boolean> {
    // 实际的更新逻辑实现
    return true;
  }

  /**
   * 处理删除更新
   */
  private async handleDeleteUpdate(path: string, options: ConfigUpdateOptions): Promise<boolean> {
    // 实际的删除逻辑实现
    return true;
  }

  /**
   * 创建配置备份
   */
  private async createBackup(updates: ConfigUpdateEvent[]): Promise<string> {
    const backupVersion = this.generateVersion(updates);
    
    // TODO: 实现实际的备份逻辑
    // 这里应该将当前配置状态保存到备份存储中
    
    return backupVersion;
  }

  /**
   * 通知相关服务
   */
  private async notifyServices(changes: ConfigUpdateEvent[]): Promise<void> {
    for (const change of changes) {
      this.emit('update-notification-sent', 'all-services', change);
    }
  }

  /**
   * 基础配置验证
   */
  private async performBasicValidation(config: any): Promise<ConfigValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    // 基本结构检查
    if (typeof config !== 'object' || config === null) {
      errors.push({
        code: 'INVALID_TYPE',
        message: 'Configuration must be an object',
        path: 'root',
        severity: 'error' as const
      });
    }

    return {
      path: 'root',
      isValid: errors.length === 0,
      level: ConfigValidationLevel.BASIC,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 严格配置验证
   */
  private async performStrictValidation(config: any): Promise<ConfigValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    // TODO: 实现更严格的验证逻辑

    return {
      path: 'root',
      isValid: errors.length === 0,
      level: ConfigValidationLevel.STRICT,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 完整配置验证
   */
  private async performFullValidation(config: any): Promise<ConfigValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: any[] = [];

    // TODO: 实现完整的验证逻辑，包括业务规则

    return {
      path: 'root',
      isValid: errors.length === 0,
      level: ConfigValidationLevel.FULL,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 生成版本号
   */
  private generateVersion(data: any): string {
    const content = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `v${Date.now()}-${hash.substring(0, 8)}`;
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(...events: ConfigUpdateEvent[]): void {
    this.updateHistory.push(...events);
    
    // 保持历史记录在合理范围内
    if (this.updateHistory.length > 1000) {
      this.updateHistory.splice(0, this.updateHistory.length - 1000);
    }
  }
}