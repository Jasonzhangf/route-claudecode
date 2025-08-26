/**
 * 精准流水线拉黑管理器
 * 
 * 职责：
 * 1. 基于配置规则执行精准拉黑策略
 * 2. 处理429流控的短期拉黑和计数器管理
 * 3. 管理销毁规则（必须手动启用）
 * 4. 持久化拉黑状态，重启后保持
 * 
 * @author RCC v4.0 - Precise Pipeline Blacklist Management
 */

import { promises as fs } from 'fs';
import path from 'path';
import { secureLogger } from '../../utils/secure-logger';
import { JQJsonHandler } from '../../utils/jq-json-handler';
import { RCCError, ConfigError, ERROR_CODES } from '../../types/error';

// 销毁规则配置
export interface DestroyRule {
  statusCode: number;
  errorPatterns: string[];
  enabled: boolean; // 必须手动设置为true
  description: string;
  adminNote?: string;
}

// 429流控规则配置
export interface RateLimitRule {
  statusCode: 429;
  blockDuration: number; // 拉黑时长(毫秒)
  maxConsecutiveFailures: number; // 最大连续失败次数
  resetInterval: number; // 重置计数器间隔(毫秒)
  description: string;
}

// 拉黑配置
export interface BlacklistConfig {
  enabled: boolean;
  persistenceFile: string;
  destroyRules: DestroyRule[];
  rateLimitRule: RateLimitRule;
}

// 429错误计数器
interface RateLimitCounter {
  pipelineId: string;
  consecutiveCount: number;
  firstFailureTime: number;
  lastFailureTime: number;
  resetAt: number; // 何时重置计数器
}

// 临时拉黑记录
interface TemporaryBlock {
  pipelineId: string;
  reason: string;
  createdAt: number;
  expiresAt: number;
  blockCount: number; // 第几次被拉黑
}

// 流水线状态
export interface PipelineStatus {
  status: 'active' | 'temporarily_blocked';
  reason?: string;
  unblockAt?: Date;
  consecutiveFailures?: number;
}

// 拉黑处理动作
export interface BlockAction {
  action: 'destroy' | 'temporary_block' | 'none';
  duration?: number; // 毫秒
  reason: string;
}

/**
 * 精准流水线拉黑管理器
 */
export class PrecisePipelineBlacklistManager {
  private config: BlacklistConfig;
  private rateLimitCounters = new Map<string, RateLimitCounter>();
  private temporaryBlocks = new Map<string, TemporaryBlock>();
  private initialized = false;

  // 默认配置
  private static readonly DEFAULT_CONFIG: BlacklistConfig = {
    enabled: true,
    persistenceFile: path.join(process.cwd(), 'data', 'pipeline-blacklist.json'),
    destroyRules: [
      {
        statusCode: 402,
        errorPatterns: ['payment', 'balance', 'credit', 'quota', 'billing'],
        enabled: false, // 必须手动启用
        description: '账户余额不足或配额用尽',
        adminNote: '启用前请确认这是期望的行为'
      },
      {
        statusCode: 401,
        errorPatterns: ['invalid api key', 'unauthorized', 'authentication failed', 'invalid_api_key'],
        enabled: false,
        description: '认证失败或API Key无效',
        adminNote: '启用前请确认API Key配置正确'
      },
      {
        statusCode: 403,
        errorPatterns: ['forbidden', 'banned', 'suspended', 'account disabled'],
        enabled: false,
        description: '账户被封禁或暂停',
        adminNote: '启用前请确认账户状态'
      }
    ],
    rateLimitRule: {
      statusCode: 429,
      blockDuration: 60000, // 1分钟
      maxConsecutiveFailures: 3, // 3次后销毁
      resetInterval: 300000, // 5分钟重置
      description: '429流控处理：1分钟拉黑，3次后销毁'
    }
  };

  constructor(config?: Partial<BlacklistConfig>) {
    this.config = {
      ...PrecisePipelineBlacklistManager.DEFAULT_CONFIG,
      ...config
    };
  }

  /**
   * 初始化拉黑管理器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 验证配置
      this.validateConfig();

      // 确保数据目录存在
      const dataDir = path.dirname(this.config.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });

      // 加载持久化数据
      await this.loadPersistenceData();

      // 清理过期的临时拉黑
      this.cleanupExpiredBlocks();

      this.initialized = true;

      secureLogger.info('Precise pipeline blacklist manager initialized', {
        enabled: this.config.enabled,
        destroyRulesCount: this.config.destroyRules.length,
        enabledDestroyRules: this.config.destroyRules.filter(r => r.enabled).length,
        activeCounters: this.rateLimitCounters.size,
        temporaryBlocks: this.temporaryBlocks.size
      });

    } catch (error) {
      const rccError = new RCCError(
        'Failed to initialize blacklist manager',
        ERROR_CODES.PIPELINE_INIT_FAILED,
        'pipeline-blacklist',
        { originalError: error }
      );
      secureLogger.error('Blacklist manager initialization failed', { error: rccError });
      this.initialized = true; // 标记为已初始化，使用默认配置
    }
  }

  /**
   * 检查是否应该销毁流水线（基于配置的销毁规则）
   */
  public shouldDestroyPipeline(statusCode: number, errorMessage: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // 查找匹配的销毁规则
    const matchingRule = this.config.destroyRules.find(rule => 
      rule.statusCode === statusCode && 
      rule.enabled === true && // 必须手动启用
      rule.errorPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (matchingRule) {
      secureLogger.warn('Pipeline marked for destruction by configured rule', {
        statusCode,
        errorMessage: errorMessage.substring(0, 100),
        rule: matchingRule.description,
        patterns: matchingRule.errorPatterns
      });

      return true;
    }

    return false;
  }

  /**
   * 处理429流控错误
   */
  public handle429Error(pipelineId: string): BlockAction {
    if (!this.config.enabled) {
      return { action: 'none', reason: 'Blacklist disabled' };
    }

    const counter = this.getRateLimitCounter(pipelineId);
    counter.consecutiveCount++;
    counter.lastFailureTime = Date.now();

    // 更新重置时间
    counter.resetAt = Date.now() + this.config.rateLimitRule.resetInterval;

    // 第1-2次429：临时拉黑1分钟
    if (counter.consecutiveCount < this.config.rateLimitRule.maxConsecutiveFailures) {
      this.addTemporaryBlock(
        pipelineId, 
        this.config.rateLimitRule.blockDuration, 
        `429 Rate Limit (${counter.consecutiveCount}/${this.config.rateLimitRule.maxConsecutiveFailures})`
      );

      secureLogger.warn('Pipeline temporarily blocked for rate limiting', {
        pipelineId,
        consecutiveCount: counter.consecutiveCount,
        maxFailures: this.config.rateLimitRule.maxConsecutiveFailures,
        blockDuration: this.config.rateLimitRule.blockDuration
      });

      return {
        action: 'temporary_block',
        duration: this.config.rateLimitRule.blockDuration,
        reason: `Rate limit exceeded (${counter.consecutiveCount}/${this.config.rateLimitRule.maxConsecutiveFailures})`
      };
    }

    // 第3次429：销毁流水线
    secureLogger.error('Pipeline marked for destruction due to persistent rate limiting', {
      pipelineId,
      consecutiveCount: counter.consecutiveCount,
      firstFailure: new Date(counter.firstFailureTime).toISOString(),
      lastFailure: new Date(counter.lastFailureTime).toISOString()
    });

    // 清理相关数据
    this.rateLimitCounters.delete(pipelineId);
    this.temporaryBlocks.delete(pipelineId);

    return {
      action: 'destroy',
      reason: `Persistent rate limiting - ${counter.consecutiveCount} consecutive 429 errors`
    };
  }

  /**
   * 检查流水线当前状态
   */
  public checkPipelineStatus(pipelineId: string): PipelineStatus {
    // 检查是否被临时拉黑
    const tempBlock = this.temporaryBlocks.get(pipelineId);
    if (tempBlock && Date.now() < tempBlock.expiresAt) {
      return {
        status: 'temporarily_blocked',
        reason: tempBlock.reason,
        unblockAt: new Date(tempBlock.expiresAt),
        consecutiveFailures: this.rateLimitCounters.get(pipelineId)?.consecutiveCount
      };
    }

    // 清理过期的临时拉黑
    if (tempBlock && Date.now() >= tempBlock.expiresAt) {
      this.temporaryBlocks.delete(pipelineId);
      
      secureLogger.info('Pipeline temporary block expired', { 
        pipelineId,
        wasBlocked: tempBlock.reason
      });

      // 保存状态变更
      this.savePersistenceData().catch(error => {
        const rccError = new RCCError(
          'Failed to save blacklist data after block expiry',
          ERROR_CODES.INTERNAL_ERROR,
          'pipeline-blacklist',
          { originalError: error, pipelineId }
        );
        secureLogger.error('Persistence save failed', { error: rccError });
      });
    }

    return { status: 'active' };
  }

  /**
   * 重置429错误计数器（成功请求后调用）
   */
  public resetRateLimitCounter(pipelineId: string): void {
    const counter = this.rateLimitCounters.get(pipelineId);
    if (counter && counter.consecutiveCount > 0) {
      secureLogger.debug('Resetting rate limit counter after successful request', {
        pipelineId,
        previousCount: counter.consecutiveCount
      });
      
      this.rateLimitCounters.delete(pipelineId);
      this.savePersistenceData().catch(error => {
        const rccError = new RCCError(
          'Failed to save blacklist data after counter reset',
          ERROR_CODES.INTERNAL_ERROR,
          'pipeline-blacklist',
          { originalError: error, pipelineId }
        );
        secureLogger.error('Persistence save failed', { error: rccError });
      });
    }
  }

  /**
   * 手动解除临时拉黑
   */
  public async manualUnblock(pipelineId: string): Promise<boolean> {
    const wasBlocked = this.temporaryBlocks.has(pipelineId);
    
    if (wasBlocked) {
      const blockInfo = this.temporaryBlocks.get(pipelineId);
      this.temporaryBlocks.delete(pipelineId);
      
      secureLogger.info('Pipeline manually unblocked', {
        pipelineId,
        previousReason: blockInfo?.reason,
        remainingTime: blockInfo ? Math.max(0, blockInfo.expiresAt - Date.now()) : 0
      });

      await this.savePersistenceData();
    }

    return wasBlocked;
  }

  /**
   * 获取拉黑统计信息
   */
  public getStatistics() {
    const enabledRules = this.config.destroyRules.filter(r => r.enabled);
    const activeBlocks = Array.from(this.temporaryBlocks.values())
      .filter(block => Date.now() < block.expiresAt);

    return {
      enabled: this.config.enabled,
      destroyRules: {
        total: this.config.destroyRules.length,
        enabled: enabledRules.length,
        enabledRules: enabledRules.map(r => ({
          statusCode: r.statusCode,
          description: r.description
        }))
      },
      rateLimitRule: {
        blockDuration: this.config.rateLimitRule.blockDuration,
        maxFailures: this.config.rateLimitRule.maxConsecutiveFailures
      },
      currentState: {
        activeCounters: this.rateLimitCounters.size,
        temporaryBlocks: activeBlocks.length,
        expiredBlocks: this.temporaryBlocks.size - activeBlocks.length
      }
    };
  }

  /**
   * 销毁流水线 - 清理所有相关数据
   */
  public destroyPipeline(pipelineId: string): void {
    secureLogger.info('Destroying pipeline data', { pipelineId });
    
    // 清理429计数器
    this.rateLimitCounters.delete(pipelineId);
    
    // 清理临时拉黑记录
    this.temporaryBlocks.delete(pipelineId);
    
    // 保存持久化数据
    this.savePersistenceData().catch(error => {
      secureLogger.warn('Failed to save persistence data after destroying pipeline', {
        pipelineId,
        error: error.message
      });
    });
  }

  /**
   * 获取或创建429错误计数器
   */
  private getRateLimitCounter(pipelineId: string): RateLimitCounter {
    const existing = this.rateLimitCounters.get(pipelineId);
    const now = Date.now();

    // 检查是否需要重置计数器
    if (existing && now > existing.resetAt) {
      secureLogger.debug('Resetting expired rate limit counter', {
        pipelineId,
        previousCount: existing.consecutiveCount,
        age: now - existing.firstFailureTime
      });
      this.rateLimitCounters.delete(pipelineId);
    }

    // 创建新计数器或返回现有计数器
    if (!this.rateLimitCounters.has(pipelineId)) {
      const newCounter: RateLimitCounter = {
        pipelineId,
        consecutiveCount: 0,
        firstFailureTime: now,
        lastFailureTime: now,
        resetAt: now + this.config.rateLimitRule.resetInterval
      };
      this.rateLimitCounters.set(pipelineId, newCounter);
      return newCounter;
    }

    return this.rateLimitCounters.get(pipelineId)!;
  }

  /**
   * 添加临时拉黑记录
   */
  private addTemporaryBlock(pipelineId: string, duration: number, reason: string): void {
    const existing = this.temporaryBlocks.get(pipelineId);
    const now = Date.now();

    const block: TemporaryBlock = {
      pipelineId,
      reason,
      createdAt: now,
      expiresAt: now + duration,
      blockCount: (existing?.blockCount || 0) + 1
    };

    this.temporaryBlocks.set(pipelineId, block);

    // 异步保存数据
    this.savePersistenceData().catch(error => {
      const rccError = new RCCError(
        'Failed to save blacklist data after temporary block',
        ERROR_CODES.INTERNAL_ERROR,
        'pipeline-blacklist',
        { originalError: error, pipelineId, reason }
      );
      secureLogger.error('Persistence save failed', { error: rccError });
    });
  }

  /**
   * 清理过期的临时拉黑记录
   */
  private cleanupExpiredBlocks(): void {
    const now = Date.now();
    const expiredBlocks: string[] = [];

    for (const [pipelineId, block] of this.temporaryBlocks) {
      if (now > block.expiresAt) {
        expiredBlocks.push(pipelineId);
      }
    }

    for (const pipelineId of expiredBlocks) {
      this.temporaryBlocks.delete(pipelineId);
    }

    if (expiredBlocks.length > 0) {
      secureLogger.info('Cleaned up expired temporary blocks', {
        cleanedCount: expiredBlocks.length,
        remainingBlocks: this.temporaryBlocks.size
      });
    }
  }

  /**
   * 验证配置合法性
   */
  private validateConfig(): void {
    if (!this.config.destroyRules || !Array.isArray(this.config.destroyRules)) {
      const configError = new ConfigError(
        'Invalid blacklist configuration: destroyRules must be an array',
        { config: this.config }
      );
      secureLogger.error('Config validation failed', { error: configError });
      throw configError;
    }

    if (!this.config.rateLimitRule || this.config.rateLimitRule.statusCode !== 429) {
      const configError = new ConfigError(
        'Invalid blacklist configuration: rateLimitRule must be configured for status code 429',
        { rateLimitRule: this.config.rateLimitRule }
      );
      secureLogger.error('Config validation failed', { error: configError });
      throw configError;
    }

    // 检查销毁规则的安全性
    const enabledRules = this.config.destroyRules.filter(r => r.enabled);
    if (enabledRules.length > 0) {
      secureLogger.warn('Destroy rules are enabled - pipelines will be destroyed automatically', {
        enabledRules: enabledRules.map(r => ({
          statusCode: r.statusCode,
          description: r.description
        }))
      });
    }
  }

  /**
   * 加载持久化数据
   */
  private async loadPersistenceData(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.persistenceFile, 'utf8');
      const parsed = JSON.parse(data);

      // 加载429计数器
      if (parsed.rateLimitCounters) {
        for (const counter of parsed.rateLimitCounters) {
          this.rateLimitCounters.set(counter.pipelineId, counter);
        }
      }

      // 加载临时拉黑记录
      if (parsed.temporaryBlocks) {
        for (const block of parsed.temporaryBlocks) {
          this.temporaryBlocks.set(block.pipelineId, block);
        }
      }

      secureLogger.info('Loaded blacklist persistence data', {
        counters: this.rateLimitCounters.size,
        blocks: this.temporaryBlocks.size,
        file: this.config.persistenceFile
      });

    } catch (error) {
      if (error.code === 'ENOENT') {
        secureLogger.debug('No existing blacklist persistence file found');
      } else {
        const rccError = new RCCError(
          'Failed to load blacklist persistence data',
          ERROR_CODES.CONFIG_LOAD_FAILED,
          'pipeline-blacklist',
          { originalError: error, file: this.config.persistenceFile }
        );
        secureLogger.error('Persistence load failed', { error: rccError });
      }
    }
  }

  /**
   * 保存持久化数据
   */
  private async savePersistenceData(): Promise<void> {
    try {
      const data = {
        timestamp: Date.now(),
        rateLimitCounters: Array.from(this.rateLimitCounters.values()),
        temporaryBlocks: Array.from(this.temporaryBlocks.values())
      };

      await fs.writeFile(
        this.config.persistenceFile, 
        JQJsonHandler.stringifyJson(data, false), 
        'utf8'
      );

      secureLogger.debug('Saved blacklist persistence data', {
        counters: data.rateLimitCounters.length,
        blocks: data.temporaryBlocks.length,
        file: this.config.persistenceFile
      });

    } catch (error) {
      const rccError = new RCCError(
        'Failed to save blacklist persistence data',
        ERROR_CODES.INTERNAL_ERROR,
        'pipeline-blacklist',
        { originalError: error, file: this.config.persistenceFile }
      );
      secureLogger.error('Persistence save failed', { error: rccError });
      throw rccError;
    }
  }
}