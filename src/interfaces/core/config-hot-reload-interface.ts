/**
 * 配置热重载系统接口定义
 * 
 * 定义配置文件热重载、动态更新、版本管理的标准接口
 * 
 * @author Jason Zhang
 */

import { IModule, ModuleConfig } from './module-interface';

/**
 * 配置更新模式
 */
export enum ConfigUpdateMode {
  HOT_RELOAD = 'hot-reload',      // 热重载模式，立即生效
  STAGED = 'staged',              // 分阶段更新，需要激活
  SCHEDULED = 'scheduled',        // 计划更新，指定时间生效
  MANUAL = 'manual'              // 手动确认更新
}

/**
 * 配置更新策略
 */
export enum ConfigUpdateStrategy {
  MERGE = 'merge',               // 合并更新
  REPLACE = 'replace',           // 完全替换
  PATCH = 'patch',              // 补丁更新
  INCREMENTAL = 'incremental'    // 增量更新
}

/**
 * 配置验证级别
 */
export enum ConfigValidationLevel {
  NONE = 'none',                 // 无验证
  BASIC = 'basic',               // 基础验证
  STRICT = 'strict',             // 严格验证
  FULL = 'full'                  // 完整验证（包括业务逻辑）
}

/**
 * 配置变更类型
 */
export enum ConfigChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move',
  RENAME = 'rename'
}

/**
 * 配置更新事件
 */
export interface ConfigUpdateEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: ConfigChangeType;
  readonly path: string;
  readonly oldValue?: any;
  readonly newValue?: any;
  readonly source: string;
  readonly version: string;
  readonly metadata?: Record<string, any>;
}

/**
 * 配置版本信息
 */
export interface ConfigVersion {
  readonly version: string;
  readonly timestamp: Date;
  readonly checksum: string;
  readonly size: number;
  readonly author?: string;
  readonly description?: string;
  readonly changes: ConfigUpdateEvent[];
  readonly isActive: boolean;
  readonly isRollbackPoint: boolean;
}

/**
 * 配置回滚选项
 */
export interface ConfigRollbackOptions {
  readonly targetVersion: string;
  readonly createBackup: boolean;
  readonly validateBeforeRollback: boolean;
  readonly notifyServices: boolean;
  readonly reason?: string;
}

/**
 * 配置更新选项
 */
export interface ConfigUpdateOptions {
  readonly mode: ConfigUpdateMode;
  readonly strategy: ConfigUpdateStrategy;
  readonly validationLevel: ConfigValidationLevel;
  readonly createBackup: boolean;
  readonly notifyServices: boolean;
  readonly timeout: number;
  readonly retryCount: number;
  readonly description?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * 配置更新结果
 */
export interface ConfigUpdateResult {
  readonly success: boolean;
  readonly version: string;
  readonly timestamp: Date;
  readonly changesApplied: ConfigUpdateEvent[];
  readonly validationResults: ConfigValidationResult[];
  readonly rollbackVersion?: string;
  readonly duration: number;
  readonly warnings: string[];
  readonly errors: string[];
  readonly metadata?: Record<string, any>;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  readonly path: string;
  readonly isValid: boolean;
  readonly level: ConfigValidationLevel;
  readonly errors: ConfigValidationError[];
  readonly warnings: ConfigValidationWarning[];
  readonly suggestions: ConfigSuggestion[];
}

/**
 * 配置验证错误
 */
export interface ConfigValidationError {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly severity: 'error' | 'critical';
  readonly details?: Record<string, any>;
}

/**
 * 配置验证警告
 */
export interface ConfigValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly suggestion?: string;
  readonly details?: Record<string, any>;
}

/**
 * 配置建议
 */
export interface ConfigSuggestion {
  readonly type: 'optimization' | 'security' | 'performance' | 'compatibility';
  readonly message: string;
  readonly path: string;
  readonly proposedValue?: any;
  readonly impact: 'low' | 'medium' | 'high';
}

/**
 * 配置文件监听选项
 */
export interface ConfigWatchOptions {
  readonly paths: string[];
  readonly recursive: boolean;
  readonly ignorePaths: string[];
  readonly debounceDelay: number;
  readonly fileExtensions: string[];
  readonly followSymlinks: boolean;
}

/**
 * 配置热重载器接口
 */
export interface IConfigHotReloader {
  /**
   * 开始监听配置文件变化
   * @param options 监听选项
   * @returns Promise<void>
   */
  startWatching(options: ConfigWatchOptions): Promise<void>;

  /**
   * 停止监听配置文件变化
   * @returns Promise<void>
   */
  stopWatching(): Promise<void>;

  /**
   * 重新加载配置
   * @param configPath 配置文件路径
   * @param options 更新选项
   * @returns Promise<ConfigUpdateResult> 更新结果
   */
  reloadConfig(configPath: string, options?: Partial<ConfigUpdateOptions>): Promise<ConfigUpdateResult>;

  /**
   * 应用配置更新
   * @param updates 配置更新事件数组
   * @param options 更新选项
   * @returns Promise<ConfigUpdateResult> 更新结果
   */
  applyConfigUpdates(updates: ConfigUpdateEvent[], options?: Partial<ConfigUpdateOptions>): Promise<ConfigUpdateResult>;

  /**
   * 验证配置
   * @param config 配置对象
   * @param level 验证级别
   * @returns Promise<ConfigValidationResult[]> 验证结果
   */
  validateConfig(config: any, level?: ConfigValidationLevel): Promise<ConfigValidationResult[]>;

  /**
   * 获取配置变更历史
   * @param limit 数量限制
   * @returns Promise<ConfigUpdateEvent[]> 变更历史
   */
  getUpdateHistory(limit?: number): Promise<ConfigUpdateEvent[]>;

  /**
   * 检查是否正在监听
   * @returns boolean 是否正在监听
   */
  isWatching(): boolean;
}

/**
 * 配置版本管理器接口
 */
export interface IConfigVersionManager {
  /**
   * 创建新版本
   * @param config 配置对象
   * @param description 版本描述
   * @returns Promise<ConfigVersion> 新版本信息
   */
  createVersion(config: any, description?: string): Promise<ConfigVersion>;

  /**
   * 获取版本信息
   * @param version 版本号
   * @returns Promise<ConfigVersion | null> 版本信息
   */
  getVersion(version: string): Promise<ConfigVersion | null>;

  /**
   * 获取所有版本
   * @param limit 数量限制
   * @returns Promise<ConfigVersion[]> 版本列表
   */
  getAllVersions(limit?: number): Promise<ConfigVersion[]>;

  /**
   * 获取当前活跃版本
   * @returns Promise<ConfigVersion> 当前版本
   */
  getCurrentVersion(): Promise<ConfigVersion>;

  /**
   * 激活指定版本
   * @param version 版本号
   * @returns Promise<ConfigUpdateResult> 激活结果
   */
  activateVersion(version: string): Promise<ConfigUpdateResult>;

  /**
   * 回滚到指定版本
   * @param options 回滚选项
   * @returns Promise<ConfigUpdateResult> 回滚结果
   */
  rollback(options: ConfigRollbackOptions): Promise<ConfigUpdateResult>;

  /**
   * 删除版本
   * @param version 版本号
   * @param force 是否强制删除
   * @returns Promise<void>
   */
  deleteVersion(version: string, force?: boolean): Promise<void>;

  /**
   * 比较版本差异
   * @param fromVersion 源版本
   * @param toVersion 目标版本
   * @returns Promise<ConfigUpdateEvent[]> 差异列表
   */
  compareVersions(fromVersion: string, toVersion: string): Promise<ConfigUpdateEvent[]>;

  /**
   * 清理旧版本
   * @param retentionDays 保留天数
   * @returns Promise<string[]> 已删除的版本列表
   */
  cleanupOldVersions(retentionDays: number): Promise<string[]>;
}

/**
 * 配置通知管理器接口
 */
export interface IConfigNotificationManager {
  /**
   * 注册配置更新监听器
   * @param serviceId 服务ID
   * @param callback 回调函数
   * @returns void
   */
  registerUpdateListener(serviceId: string, callback: ConfigUpdateCallback): void;

  /**
   * 注销配置更新监听器
   * @param serviceId 服务ID
   * @returns void
   */
  unregisterUpdateListener(serviceId: string): void;

  /**
   * 通知所有监听器
   * @param event 配置更新事件
   * @returns Promise<void>
   */
  notifyAll(event: ConfigUpdateEvent): Promise<void>;

  /**
   * 通知特定服务
   * @param serviceId 服务ID
   * @param event 配置更新事件
   * @returns Promise<void>
   */
  notifyService(serviceId: string, event: ConfigUpdateEvent): Promise<void>;

  /**
   * 获取监听器状态
   * @returns Record<string, boolean> 监听器状态映射
   */
  getListenerStatus(): Record<string, boolean>;

  /**
   * 批量通知
   * @param events 配置更新事件数组
   * @returns Promise<void>
   */
  notifyBatch(events: ConfigUpdateEvent[]): Promise<void>;
}

/**
 * 配置更新回调函数类型
 */
export type ConfigUpdateCallback = (event: ConfigUpdateEvent) => Promise<void> | void;

/**
 * 配置热重载模块配置
 */
export interface ConfigHotReloadConfig extends ModuleConfig {
  readonly watchPaths: string[];
  readonly autoReload: boolean;
  readonly validationLevel: ConfigValidationLevel;
  readonly backupEnabled: boolean;
  readonly maxVersions: number;
  readonly cleanupInterval: number;
  readonly notificationTimeout: number;
  readonly debounceDelay: number;
  readonly maxRetries: number;
  readonly enableRollback: boolean;
}

/**
 * 配置热重载主模块接口
 */
export interface IConfigHotReloadModule extends IModule {
  readonly config: ConfigHotReloadConfig;
  readonly hotReloader: IConfigHotReloader;
  readonly versionManager: IConfigVersionManager;
  readonly notificationManager: IConfigNotificationManager;

  /**
   * 开始配置监控
   * @param configPaths 配置文件路径数组
   * @returns Promise<void>
   */
  startConfigMonitoring(configPaths: string[]): Promise<void>;

  /**
   * 停止配置监控
   * @returns Promise<void>
   */
  stopConfigMonitoring(): Promise<void>;

  /**
   * 手动触发配置重新加载
   * @param configPath 配置文件路径
   * @param options 更新选项
   * @returns Promise<ConfigUpdateResult> 更新结果
   */
  triggerReload(configPath: string, options?: Partial<ConfigUpdateOptions>): Promise<ConfigUpdateResult>;

  /**
   * 获取配置状态概览
   * @returns Promise<ConfigStatusOverview> 状态概览
   */
  getConfigStatus(): Promise<ConfigStatusOverview>;

  /**
   * 执行配置健康检查
   * @returns Promise<ConfigHealthCheckResult[]> 健康检查结果
   */
  runConfigHealthCheck(): Promise<ConfigHealthCheckResult[]>;
}

/**
 * 配置状态概览
 */
export interface ConfigStatusOverview {
  readonly currentVersion: string;
  readonly lastUpdate: Date;
  readonly totalVersions: number;
  readonly watchedPaths: string[];
  readonly isWatching: boolean;
  readonly pendingUpdates: number;
  readonly lastValidation: {
    timestamp: Date;
    isValid: boolean;
    errorCount: number;
    warningCount: number;
  };
  readonly recentChanges: ConfigUpdateEvent[];
}

/**
 * 配置健康检查结果
 */
export interface ConfigHealthCheckResult {
  readonly path: string;
  readonly isHealthy: boolean;
  readonly checkType: 'existence' | 'syntax' | 'schema' | 'permissions';
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly timestamp: Date;
}

/**
 * 配置热重载事件类型
 */
export interface ConfigHotReloadEvents {
  'config-updated': (event: ConfigUpdateEvent) => void;
  'config-validation-failed': (results: ConfigValidationResult[]) => void;
  'config-rollback': (version: string) => void;
  'version-created': (version: ConfigVersion) => void;
  'watching-started': (paths: string[]) => void;
  'watching-stopped': () => void;
  'update-notification-sent': (serviceId: string, event: ConfigUpdateEvent) => void;
  'health-check-completed': (results: ConfigHealthCheckResult[]) => void;
}