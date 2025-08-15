/**
 * 配置版本管理器实现
 * 
 * 提供配置版本创建、管理、回滚和比较功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  IConfigVersionManager,
  ConfigVersion,
  ConfigUpdateResult,
  ConfigRollbackOptions,
  ConfigUpdateEvent,
  ConfigChangeType,
  ConfigValidationLevel
} from '../interfaces/core/config-hot-reload-interface';

/**
 * 版本存储项
 */
interface VersionStorageItem extends ConfigVersion {
  configData: any;
}

/**
 * 配置版本管理器实现
 */
export class ConfigVersionManager extends EventEmitter implements IConfigVersionManager {
  private versions = new Map<string, VersionStorageItem>();
  private currentVersionId: string | null = null;
  private maxVersions: number = 100;
  private autoCleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxVersions: number = 100, enableAutoCleanup: boolean = true) {
    super();
    this.maxVersions = maxVersions;
    
    if (enableAutoCleanup) {
      this.startAutoCleanup();
    }
    
    this.setupErrorHandling();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ConfigVersionManager error:', error);
    });
  }

  /**
   * 启动自动清理
   */
  private startAutoCleanup(): void {
    // 每小时检查一次过期版本
    this.autoCleanupInterval = setInterval(() => {
      this.performAutoCleanup().catch(error => {
        this.emit('error', error);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * 创建新版本
   */
  async createVersion(config: any, description?: string): Promise<ConfigVersion> {
    const timestamp = new Date();
    const configData = JSON.parse(JSON.stringify(config)); // 深拷贝
    const checksum = this.generateChecksum(configData);
    const version = this.generateVersionId(timestamp, checksum);

    // 检测变更
    const changes = await this.detectChangesFromPrevious(configData);

    const versionInfo: ConfigVersion = {
      version,
      timestamp,
      checksum,
      size: JSON.stringify(configData).length,
      author: this.getCurrentUser(),
      description: description || 'Automated version creation',
      changes,
      isActive: false, // 新版本默认不激活
      isRollbackPoint: false
    };

    const storageItem: VersionStorageItem = {
      ...versionInfo,
      configData
    };

    // 存储版本
    this.versions.set(version, storageItem);

    // 维护版本数量限制
    await this.enforceVersionLimit();

    this.emit('version-created', versionInfo);

    return versionInfo;
  }

  /**
   * 获取版本信息
   */
  async getVersion(version: string): Promise<ConfigVersion | null> {
    const storageItem = this.versions.get(version);
    if (!storageItem) {
      return null;
    }

    // 返回不包含配置数据的版本信息
    const { configData, ...versionInfo } = storageItem;
    return versionInfo;
  }

  /**
   * 获取所有版本
   */
  async getAllVersions(limit?: number): Promise<ConfigVersion[]> {
    const versions = Array.from(this.versions.values())
      .map(({ configData, ...versionInfo }) => versionInfo)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? versions.slice(0, limit) : versions;
  }

  /**
   * 获取当前活跃版本
   */
  async getCurrentVersion(): Promise<ConfigVersion> {
    if (!this.currentVersionId) {
      throw new Error('No active version set');
    }

    const version = await this.getVersion(this.currentVersionId);
    if (!version) {
      throw new Error(`Current version ${this.currentVersionId} not found`);
    }

    return version;
  }

  /**
   * 激活指定版本
   */
  async activateVersion(version: string): Promise<ConfigUpdateResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const versionInfo = this.versions.get(version);
      if (!versionInfo) {
        errors.push(`Version ${version} not found`);
        return this.createFailureResult(version, timestamp, startTime, errors, warnings);
      }

      // 获取当前版本（用于回滚）
      const rollbackVersion = this.currentVersionId;

      // 更新版本状态
      if (this.currentVersionId) {
        const currentVersion = this.versions.get(this.currentVersionId);
        if (currentVersion) {
          currentVersion.isActive = false;
        }
      }

      versionInfo.isActive = true;
      this.currentVersionId = version;

      // 创建激活事件
      const activationEvent: ConfigUpdateEvent = {
        id: this.generateEventId(),
        timestamp,
        type: ConfigChangeType.UPDATE,
        path: 'version-activation',
        oldValue: rollbackVersion,
        newValue: version,
        source: 'version-manager',
        version,
        metadata: {
          action: 'activate-version',
          previousVersion: rollbackVersion
        }
      };

      return {
        success: true,
        version,
        timestamp,
        changesApplied: [activationEvent],
        validationResults: [],
        rollbackVersion,
        duration: Date.now() - startTime,
        warnings,
        errors,
        metadata: {
          action: 'version-activation',
          configSize: versionInfo.size,
          totalVersions: this.versions.size
        }
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return this.createFailureResult(version, timestamp, startTime, errors, warnings);
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollback(options: ConfigRollbackOptions): Promise<ConfigUpdateResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const targetVersion = options.targetVersion;
      const versionInfo = this.versions.get(targetVersion);
      
      if (!versionInfo) {
        errors.push(`Target version ${targetVersion} not found`);
        return this.createFailureResult(targetVersion, timestamp, startTime, errors, warnings);
      }

      // 验证回滚前（如果启用）
      if (options.validateBeforeRollback) {
        const validationResult = await this.validateVersionData(versionInfo.configData);
        if (!validationResult.isValid) {
          errors.push('Version validation failed before rollback');
          return this.createFailureResult(targetVersion, timestamp, startTime, errors, warnings);
        }
      }

      // 创建备份（如果启用）
      let backupVersion: string | undefined;
      if (options.createBackup && this.currentVersionId) {
        const currentVersionData = this.versions.get(this.currentVersionId);
        if (currentVersionData) {
          const backupVersionInfo = await this.createVersion(
            currentVersionData.configData,
            `Backup before rollback to ${targetVersion} - ${options.reason || 'Manual rollback'}`
          );
          backupVersion = backupVersionInfo.version;
        }
      }

      // 执行回滚（实际上是激活目标版本）
      const rollbackResult = await this.activateVersion(targetVersion);

      if (rollbackResult.success) {
        // 标记为回滚点
        versionInfo.isRollbackPoint = true;

        // 创建回滚事件
        const rollbackEvent: ConfigUpdateEvent = {
          id: this.generateEventId(),
          timestamp,
          type: ConfigChangeType.UPDATE,
          path: 'version-rollback',
          oldValue: this.currentVersionId,
          newValue: targetVersion,
          source: 'version-manager-rollback',
          version: targetVersion,
          metadata: {
            action: 'rollback',
            reason: options.reason,
            backupVersion
          }
        };

        // 通知服务（如果启用）
        if (options.notifyServices) {
          this.emit('config-rollback', targetVersion);
        }

        return {
          ...rollbackResult,
          changesApplied: [rollbackEvent],
          rollbackVersion: backupVersion,
          metadata: {
            ...rollbackResult.metadata,
            action: 'rollback',
            reason: options.reason,
            backupVersion
          }
        };
      }

      return rollbackResult;

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during rollback');
      return this.createFailureResult(options.targetVersion, timestamp, startTime, errors, warnings);
    }
  }

  /**
   * 删除版本
   */
  async deleteVersion(version: string, force: boolean = false): Promise<void> {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    // 检查是否是当前活跃版本
    if (versionInfo.isActive && !force) {
      throw new Error(`Cannot delete active version ${version}. Use force=true to override.`);
    }

    // 检查是否是重要的回滚点
    if (versionInfo.isRollbackPoint && !force) {
      throw new Error(`Cannot delete rollback point ${version}. Use force=true to override.`);
    }

    // 删除版本
    this.versions.delete(version);

    // 如果删除的是当前版本，清除引用
    if (this.currentVersionId === version) {
      this.currentVersionId = null;
    }

    this.emit('version-deleted', version);
  }

  /**
   * 比较版本差异
   */
  async compareVersions(fromVersion: string, toVersion: string): Promise<ConfigUpdateEvent[]> {
    const fromVersionInfo = this.versions.get(fromVersion);
    const toVersionInfo = this.versions.get(toVersion);

    if (!fromVersionInfo) {
      throw new Error(`Source version ${fromVersion} not found`);
    }

    if (!toVersionInfo) {
      throw new Error(`Target version ${toVersion} not found`);
    }

    // 简化的差异检测
    const differences: ConfigUpdateEvent[] = [];
    
    if (fromVersionInfo.checksum !== toVersionInfo.checksum) {
      differences.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        type: ConfigChangeType.UPDATE,
        path: 'configuration',
        oldValue: fromVersionInfo.configData,
        newValue: toVersionInfo.configData,
        source: 'version-comparison',
        version: toVersion,
        metadata: {
          compareType: 'full-config',
          fromVersion,
          toVersion,
          fromChecksum: fromVersionInfo.checksum,
          toChecksum: toVersionInfo.checksum
        }
      });
    }

    return differences;
  }

  /**
   * 清理旧版本
   */
  async cleanupOldVersions(retentionDays: number): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedVersions: string[] = [];

    for (const [version, versionInfo] of this.versions) {
      // 跳过活跃版本和回滚点
      if (versionInfo.isActive || versionInfo.isRollbackPoint) {
        continue;
      }

      // 检查是否超过保留期
      if (versionInfo.timestamp < cutoffDate) {
        try {
          await this.deleteVersion(version, true);
          deletedVersions.push(version);
        } catch (error) {
          console.warn(`Failed to delete old version ${version}:`, error);
        }
      }
    }

    return deletedVersions;
  }

  /**
   * 销毁版本管理器
   */
  destroy(): void {
    if (this.autoCleanupInterval) {
      clearInterval(this.autoCleanupInterval);
      this.autoCleanupInterval = null;
    }

    this.versions.clear();
    this.currentVersionId = null;
    this.removeAllListeners();
  }

  /**
   * 获取版本统计
   */
  getVersionStats(): {
    totalVersions: number;
    activeVersion: string | null;
    rollbackPoints: number;
    oldestVersion: ConfigVersion | null;
    newestVersion: ConfigVersion | null;
    totalSize: number;
  } {
    const versions = Array.from(this.versions.values());
    const rollbackPoints = versions.filter(v => v.isRollbackPoint).length;
    const totalSize = versions.reduce((sum, v) => sum + v.size, 0);

    let oldestVersion: ConfigVersion | null = null;
    let newestVersion: ConfigVersion | null = null;

    if (versions.length > 0) {
      const sortedVersions = versions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      oldestVersion = { ...sortedVersions[0] };
      newestVersion = { ...sortedVersions[sortedVersions.length - 1] };
      delete (oldestVersion as any).configData;
      delete (newestVersion as any).configData;
    }

    return {
      totalVersions: this.versions.size,
      activeVersion: this.currentVersionId,
      rollbackPoints,
      oldestVersion,
      newestVersion,
      totalSize
    };
  }

  // ============ 私有方法 ============

  /**
   * 生成校验和
   */
  private generateChecksum(data: any): string {
    const content = JSON.stringify(data, null, 0);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 生成版本ID
   */
  private generateVersionId(timestamp: Date, checksum: string): string {
    const dateStr = timestamp.toISOString().replace(/[:-]/g, '').replace(/\..+/, '');
    const shortChecksum = checksum.substring(0, 8);
    return `v${dateStr}_${shortChecksum}`;
  }

  /**
   * 获取当前用户
   */
  private getCurrentUser(): string {
    return process.env.USER || process.env.USERNAME || 'system';
  }

  /**
   * 检测与前一版本的变更
   */
  private async detectChangesFromPrevious(configData: any): Promise<ConfigUpdateEvent[]> {
    if (!this.currentVersionId) {
      return []; // 首个版本，无变更
    }

    const currentVersion = this.versions.get(this.currentVersionId);
    if (!currentVersion) {
      return [];
    }

    // 简化的变更检测
    const changes: ConfigUpdateEvent[] = [];
    const currentChecksum = this.generateChecksum(currentVersion.configData);
    const newChecksum = this.generateChecksum(configData);

    if (currentChecksum !== newChecksum) {
      changes.push({
        id: this.generateEventId(),
        timestamp: new Date(),
        type: ConfigChangeType.UPDATE,
        path: 'configuration',
        oldValue: currentVersion.configData,
        newValue: configData,
        source: 'version-creation',
        version: 'pending',
        metadata: {
          previousVersion: this.currentVersionId,
          previousChecksum: currentChecksum,
          newChecksum
        }
      });
    }

    return changes;
  }

  /**
   * 执行版本数量限制
   */
  private async enforceVersionLimit(): Promise<void> {
    if (this.versions.size <= this.maxVersions) {
      return;
    }

    const versions = Array.from(this.versions.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const toDelete = this.versions.size - this.maxVersions;
    
    for (let i = 0; i < toDelete; i++) {
      const version = versions[i];
      
      // 跳过活跃版本和回滚点
      if (version.isActive || version.isRollbackPoint) {
        continue;
      }

      try {
        await this.deleteVersion(version.version, true);
      } catch (error) {
        console.warn(`Failed to delete old version during cleanup:`, error);
      }
    }
  }

  /**
   * 执行自动清理
   */
  private async performAutoCleanup(): Promise<void> {
    // 清理30天前的版本
    const deletedVersions = await this.cleanupOldVersions(30);
    
    if (deletedVersions.length > 0) {
      console.log(`Auto cleanup deleted ${deletedVersions.length} old versions`);
    }
  }

  /**
   * 验证版本数据
   */
  private async validateVersionData(configData: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // 基本结构验证
      if (typeof configData !== 'object' || configData === null) {
        errors.push('Invalid configuration data structure');
      }

      // TODO: 添加更多验证逻辑

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Validation error');
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * 创建失败结果
   */
  private createFailureResult(
    version: string,
    timestamp: Date,
    startTime: number,
    errors: string[],
    warnings: string[]
  ): ConfigUpdateResult {
    return {
      success: false,
      version,
      timestamp,
      changesApplied: [],
      validationResults: [],
      duration: Date.now() - startTime,
      warnings,
      errors
    };
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}