/**
 * 响应统计管理器 - 记录每个provider和模型的响应数量
 * Owner: Jason Zhang
 */

import { logger } from './logger';

export interface CategoryStats {
  totalResponses: number;
  successfulResponses: number;
  failedResponses: number;
  streamingResponses: number;
  nonStreamingResponses: number;
  totalResponseTime: number;
  averageResponseTime: number;
}

export interface ResponseStat {
  providerId: string;
  model: string;
  totalResponses: number;
  successfulResponses: number;
  failedResponses: number;
  streamingResponses: number;
  nonStreamingResponses: number;
  lastResponseTime: Date;
  averageResponseTime: number;
  totalResponseTime: number;
  categories: {
    [category: string]: CategoryStats;
  };
}

export interface ProviderStats {
  [providerId: string]: {
    [model: string]: ResponseStat;
  };
}

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getConfigPaths } from './config-paths';

export class ResponseStatsManager {
  private stats: ProviderStats = {};
  private startTime: Date = new Date();
  private logInterval: NodeJS.Timeout | null = null;
  private statsFilePath: string;


    constructor() {
    const configPaths = getConfigPaths();
    this.statsFilePath = resolve(configPaths.configDir, 'response-stats.json');
    this.loadStats();

    // 每5分钟输出一次统计日志 - 已禁用定期输出避免干扰
    // this.startPeriodicLogging();
    // Save stats on exit
    process.on('beforeExit', () => this.saveStats());
    logger.info('ResponseStatsManager initialized');
  }

    /**
   * 记录成功响应
   */
  recordSuccess(providerId: string, model: string, responseTimeMs: number, isStreaming: boolean = false): void {
    const stat = this.getOrCreateStat(providerId, model);
    
    stat.totalResponses++;
    if (isStreaming) {
      stat.streamingResponses++;
    } else {
      stat.nonStreamingResponses++;
    }
    stat.successfulResponses++;
    stat.lastResponseTime = new Date();
    stat.totalResponseTime += responseTimeMs;
    stat.averageResponseTime = stat.totalResponseTime / stat.totalResponses;

    logger.debug(`Response recorded: ${providerId}/${model}`, {
      providerId,
      model,
      responseTimeMs,
      isStreaming,
      totalResponses: stat.totalResponses,
      successRate: `${((stat.successfulResponses / stat.totalResponses) * 100).toFixed(1)}%`
    });
  }

  /**
   * 记录失败响应
   */
  recordFailure(providerId: string, model: string, error: string, isStreaming: boolean = false): void {
    const stat = this.getOrCreateStat(providerId, model);
    
    stat.totalResponses++;
    if (isStreaming) {
      stat.streamingResponses++;
    } else {
      stat.nonStreamingResponses++;
    }
    stat.failedResponses++;
    stat.lastResponseTime = new Date();

    logger.warn(`Failed response recorded: ${providerId}/${model}`, {
      providerId,
      model,
      error,
      isStreaming,
      totalResponses: stat.totalResponses,
      failureRate: `${((stat.failedResponses / stat.totalResponses) * 100).toFixed(1)}%`
    });
  }

  /**
   * 获取或创建统计记录
   */
  private getOrCreateStat(providerId: string, model: string): ResponseStat {
    if (!this.stats[providerId]) {
      this.stats[providerId] = {};
    }

    if (!this.stats[providerId][model]) {
      this.stats[providerId][model] = {
        providerId,
        model,
        totalResponses: 0,
        successfulResponses: 0,
        failedResponses: 0,
        streamingResponses: 0,
        nonStreamingResponses: 0,
        lastResponseTime: new Date(),
        averageResponseTime: 0,
        totalResponseTime: 0,
        categories: {}
      };
    }

    return this.stats[providerId][model];
  }

  /**
   * 获取所有统计数据
   */
  getAllStats(): ProviderStats {
    return JSON.parse(JSON.stringify(this.stats));
  }

  /**
   * 获取特定provider的统计
   */
  getProviderStats(providerId: string): { [model: string]: ResponseStat } | null {
    return this.stats[providerId] || null;
  }

  /**
   * 获取汇总统计
   */
  getSummaryStats(): {
    totalRequests: number;
    totalProviders: number;
    totalModels: number;
    topProvider: { providerId: string; count: number } | null;
    topModel: { model: string; count: number } | null;
    overallSuccessRate: number;
  } {
    let totalRequests = 0;
    let totalSuccessful = 0;
    const providerCounts: { [key: string]: number } = {};
    const modelCounts: { [key: string]: number } = {};

    for (const [providerId, providerData] of Object.entries(this.stats)) {
      for (const [model, stat] of Object.entries(providerData)) {
        totalRequests += stat.totalResponses;
        totalSuccessful += stat.successfulResponses;
        
        providerCounts[providerId] = (providerCounts[providerId] || 0) + stat.totalResponses;
        modelCounts[model] = (modelCounts[model] || 0) + stat.totalResponses;
      }
    }

    // 找出使用最多的provider和model
    const topProvider = Object.entries(providerCounts).length > 0 
      ? Object.entries(providerCounts).reduce((a, b) => a[1] > b[1] ? a : b)
      : null;
    
    const topModel = Object.entries(modelCounts).length > 0
      ? Object.entries(modelCounts).reduce((a, b) => a[1] > b[1] ? a : b)
      : null;

    return {
      totalRequests,
      totalProviders: Object.keys(this.stats).length,
      totalModels: Object.keys(modelCounts).length,
      topProvider: topProvider ? { providerId: topProvider[0], count: topProvider[1] } : null,
      topModel: topModel ? { model: topModel[0], count: topModel[1] } : null,
      overallSuccessRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0
    };
  }

  /**
   * 开始定期日志输出
   */
  private startPeriodicLogging(): void {
    this.logInterval = setInterval(() => {
      this.logSummaryStats();
    }, 5 * 60 * 1000); // 每5分钟
  }

  /**
   * 输出汇总统计日志
   */
  logSummaryStats(): void {
    const summary = this.getSummaryStats();
    const runtime = new Date().getTime() - this.startTime.getTime();
    const runtimeMinutes = Math.floor(runtime / 60000);

    logger.info('📊 Response Statistics Summary', {
      runtime: `${runtimeMinutes} minutes`,
      totalRequests: summary.totalRequests,
      totalProviders: summary.totalProviders,
      totalModels: summary.totalModels,
      overallSuccessRate: `${summary.overallSuccessRate.toFixed(1)}%`,
      topProvider: summary.topProvider ? 
        `${summary.topProvider.providerId} (${summary.topProvider.count} requests)` : 'N/A',
      topModel: summary.topModel ? 
        `${summary.topModel.model} (${summary.topModel.count} requests)` : 'N/A'
    });

    // 详细的provider分布统计
    this.logDetailedStats();
  }

  /**
   * 输出详细统计日志
   */
  private logDetailedStats(): void {
    const providerBreakdown: { [providerId: string]: number } = {};
    const modelBreakdown: { [model: string]: number } = {};

    for (const [providerId, providerData] of Object.entries(this.stats)) {
      let providerTotal = 0;
      for (const [model, stat] of Object.entries(providerData)) {
        providerTotal += stat.totalResponses;
        modelBreakdown[model] = (modelBreakdown[model] || 0) + stat.totalResponses;
      }
      if (providerTotal > 0) {
        providerBreakdown[providerId] = providerTotal;
      }
    }

    if (Object.keys(providerBreakdown).length > 0) {
      logger.info('🎯 Provider Distribution', providerBreakdown);
    }

    if (Object.keys(modelBreakdown).length > 0) {
      logger.info('🤖 Model Distribution', modelBreakdown);
    }

    // 输出权重效果验证
    this.logWeightEffectiveness();
  }

  /**
   * 输出权重效果验证日志
   */
  private logWeightEffectiveness(): void {
    const effectiveness: { [category: string]: any } = {};

    for (const [providerId, providerData] of Object.entries(this.stats)) {
      for (const [model, stat] of Object.entries(providerData)) {
        if (stat.totalResponses > 0) {
          effectiveness[`${providerId}/${model}`] = {
            responses: stat.totalResponses,
            successRate: `${((stat.successfulResponses / stat.totalResponses) * 100).toFixed(1)}%`,
            avgResponseTime: `${stat.averageResponseTime.toFixed(0)}ms`,
            lastActive: stat.lastResponseTime.toISOString().split('T')[1].split('.')[0]
          };
        }
      }
    }

    if (Object.keys(effectiveness).length > 0) {
      logger.info('⚖️ Weight Effectiveness Analysis', effectiveness);
    }
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.stats = {};
    this.startTime = new Date();
    logger.info('Response statistics reset');
  }

  /**
   * 停止定期日志
   */
  private loadStats(): void {
    try {
      if (existsSync(this.statsFilePath)) {
        const data = readFileSync(this.statsFilePath, 'utf8');
        this.stats = JSON.parse(data);
        logger.info('Response stats loaded from file');
      } else {
        logger.info('No existing response stats file found, starting fresh.');
      }
    } catch (error) {
      logger.error('Failed to load response stats', error);
    }
  }

  private saveStats(): void {
    try {
      writeFileSync(this.statsFilePath, JSON.stringify(this.stats, null, 2));
      logger.info('Response stats saved to file');
    } catch (error) {
      logger.error('Failed to save response stats', error);
    }
  }
  
  destroy(): void {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    logger.info('ResponseStatsManager destroyed');
  }
}

// 导出单例实例
export const responseStatsManager = new ResponseStatsManager();