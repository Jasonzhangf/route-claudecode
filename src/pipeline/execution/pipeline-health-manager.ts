/**
 * 流水线健康管理器 - 管理流水线健康状态和黑名单
 * 
 * 职责：
 * 1. 跟踪流水线成功率和健康状态
 * 2. 管理流水线黑名单（临时和永久）
 * 3. 提供健康流水线筛选功能
 * 4. 自动恢复机制
 * 
 * @author RCC v4.0 - Pipeline Execution Architecture
 */

export interface PipelineHealthStats {
  pipelineId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  lastRequestTime: number;
  lastSuccessTime: number;
  lastErrorTime: number;
  averageResponseTime: number;
  responseTimeHistory: number[];
}

export interface BlacklistEntry {
  pipelineId: string;
  until: number; // 黑名单到期时间戳
  reason: string;
  blacklistedAt: number;
  attemptCount: number; // 黑名单次数
}

export interface HealthManagerConfig {
  healthThreshold: number; // 健康阈值 (成功率)
  minRequestsForHealthCheck: number; // 最少请求数才进行健康检查
  responseTimeWindow: number; // 响应时间窗口大小
  autoRecoveryEnabled: boolean; // 是否启用自动恢复
  maxBlacklistDuration: number; // 最大黑名单时间
}

/**
 * 流水线健康管理器
 */
export class PipelineHealthManager {
  private healthStats = new Map<string, PipelineHealthStats>();
  private blacklist = new Map<string, BlacklistEntry>();
  private config: HealthManagerConfig;
  
  constructor(config: Partial<HealthManagerConfig> = {}) {
    this.config = {
      healthThreshold: 0.8, // 80%成功率
      minRequestsForHealthCheck: 10, // 最少10个请求
      responseTimeWindow: 100, // 记录最近100次响应时间
      autoRecoveryEnabled: true,
      maxBlacklistDuration: 300000, // 最大5分钟
      ...config
    };
  }
  
  /**
   * 检查流水线是否健康
   */
  isHealthy(pipelineId: string): boolean {
    // 首先检查是否在黑名单
    if (this.isBlacklisted(pipelineId)) {
      return false;
    }
    
    const stats = this.healthStats.get(pipelineId);
    if (!stats) {
      // 新流水线默认健康
      return true;
    }
    
    // 请求数量不足，认为健康
    if (stats.totalRequests < this.config.minRequestsForHealthCheck) {
      return true;
    }
    
    // 基于成功率判断健康状态
    return stats.successRate >= this.config.healthThreshold;
  }
  
  /**
   * 检查流水线是否在黑名单中
   */
  isBlacklisted(pipelineId: string): boolean {
    const entry = this.blacklist.get(pipelineId);
    if (!entry) {
      return false;
    }
    
    // 检查是否已过期
    if (Date.now() > entry.until) {
      this.blacklist.delete(pipelineId);
      return false;
    }
    
    return true;
  }
  
  /**
   * 将流水线加入黑名单
   */
  blacklistPipeline(pipelineId: string, duration: number, reason: string): void {
    const existing = this.blacklist.get(pipelineId);
    const now = Date.now();
    
    // 如果已经在黑名单中，延长时间并增加计数
    if (existing) {
      const newDuration = Math.min(duration * (existing.attemptCount + 1), this.config.maxBlacklistDuration);
      this.blacklist.set(pipelineId, {
        ...existing,
        until: now + newDuration,
        reason: `${existing.reason}, ${reason}`,
        attemptCount: existing.attemptCount + 1
      });
    } else {
      this.blacklist.set(pipelineId, {
        pipelineId,
        until: now + Math.min(duration, this.config.maxBlacklistDuration),
        reason,
        blacklistedAt: now,
        attemptCount: 1
      });
    }
  }
  
  /**
   * 手动移除流水线黑名单
   */
  unblacklistPipeline(pipelineId: string): void {
    this.blacklist.delete(pipelineId);
  }
  
  /**
   * 记录成功请求
   */
  recordSuccess(pipelineId: string, responseTime: number = 0): void {
    const stats = this.getOrCreateStats(pipelineId);
    const now = Date.now();
    
    stats.totalRequests++;
    stats.successCount++;
    stats.lastRequestTime = now;
    stats.lastSuccessTime = now;
    
    // 记录响应时间
    if (responseTime > 0) {
      stats.responseTimeHistory.push(responseTime);
      if (stats.responseTimeHistory.length > this.config.responseTimeWindow) {
        stats.responseTimeHistory.shift();
      }
      stats.averageResponseTime = this.calculateAverageResponseTime(stats.responseTimeHistory);
    }
    
    this.updateSuccessRate(stats);
  }
  
  /**
   * 记录失败请求
   */
  recordFailure(pipelineId: string, error: Error): void {
    const stats = this.getOrCreateStats(pipelineId);
    const now = Date.now();
    
    stats.totalRequests++;
    stats.errorCount++;
    stats.lastRequestTime = now;
    stats.lastErrorTime = now;
    
    this.updateSuccessRate(stats);
  }
  
  /**
   * 获取健康的流水线列表
   */
  getHealthyPipelines(allPipelines: string[]): string[] {
    return allPipelines.filter(pipelineId => this.isHealthy(pipelineId));
  }
  
  /**
   * 获取流水线健康统计
   */
  getHealthStats(pipelineId: string): PipelineHealthStats | undefined {
    return this.healthStats.get(pipelineId);
  }
  
  /**
   * 获取所有健康统计
   */
  getAllHealthStats(): Map<string, PipelineHealthStats> {
    return new Map(this.healthStats);
  }
  
  /**
   * 获取黑名单状态
   */
  getBlacklistStatus(): Map<string, BlacklistEntry> {
    // 清理过期的黑名单条目
    const now = Date.now();
    for (const [pipelineId, entry] of this.blacklist) {
      if (now > entry.until) {
        this.blacklist.delete(pipelineId);
      }
    }
    
    return new Map(this.blacklist);
  }
  
  /**
   * 重置流水线统计
   */
  resetStats(pipelineId?: string): void {
    if (pipelineId) {
      this.healthStats.delete(pipelineId);
      this.blacklist.delete(pipelineId);
    } else {
      this.healthStats.clear();
      this.blacklist.clear();
    }
  }
  
  /**
   * 获取或创建流水线统计
   */
  private getOrCreateStats(pipelineId: string): PipelineHealthStats {
    let stats = this.healthStats.get(pipelineId);
    if (!stats) {
      stats = {
        pipelineId,
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        successRate: 1.0,
        lastRequestTime: 0,
        lastSuccessTime: 0,
        lastErrorTime: 0,
        averageResponseTime: 0,
        responseTimeHistory: []
      };
      this.healthStats.set(pipelineId, stats);
    }
    return stats;
  }
  
  /**
   * 更新成功率
   */
  private updateSuccessRate(stats: PipelineHealthStats): void {
    if (stats.totalRequests > 0) {
      stats.successRate = stats.successCount / stats.totalRequests;
    }
  }
  
  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(history: number[]): number {
    if (history.length === 0) return 0;
    const sum = history.reduce((total, time) => total + time, 0);
    return sum / history.length;
  }
}