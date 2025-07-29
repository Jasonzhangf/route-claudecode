/**
 * 失败API调用专用日志记录器
 * Owner: Jason Zhang
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';

export interface FailureLogEntry {
  timestamp: string;
  requestId: string;
  providerId: string;
  model: string;
  originalModel: string;
  error: string;
  httpCode?: number;
  errorType: string;
  requestDuration?: number;
  requestBody?: any;
  routingCategory?: string;
  userAgent?: string;
  sessionId?: string;
  retryCount?: number;
}

export class FailureLogger {
  private logDir: string;
  private failureLogPath: string;
  private dailyLogPath: string = '';

  constructor(logDir: string = '~/.route-claude-code/logs') {
    // 展开波浪号路径
    this.logDir = logDir.startsWith('~') ? 
      path.join(require('os').homedir(), logDir.substring(1)) : 
      logDir;
    
    this.failureLogPath = path.join(this.logDir, 'failures.jsonl');
    this.updateDailyLogPath();
    
    // 每天凌晨更新日志路径
    this.scheduleDailyLogRotation();
  }

  /**
   * 记录API调用失败
   */
  async logFailure(entry: FailureLogEntry): Promise<void> {
    try {
      // 确保日志目录存在
      await this.ensureLogDirectory();

      // 准备日志条目
      const logEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
        loggedAt: new Date().toISOString()
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // 同时写入总失败日志和每日失败日志
      await Promise.all([
        fs.appendFile(this.failureLogPath, logLine),
        fs.appendFile(this.dailyLogPath, logLine)
      ]);

      logger.debug('Failure logged successfully', {
        requestId: entry.requestId,
        providerId: entry.providerId,
        error: entry.error
      });

    } catch (error) {
      logger.error('Failed to write failure log', {
        error: error instanceof Error ? error.message : String(error),
        entry: entry.requestId
      });
    }
  }

  /**
   * 获取失败统计
   */
  async getFailureStats(hours: number = 24): Promise<{
    totalFailures: number;
    failuresByProvider: { [key: string]: number };
    failuresByModel: { [key: string]: number };
    failuresByError: { [key: string]: number };
    failuresByHour: { [key: string]: number };
    avgFailureDuration: number;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const failures = await this.readRecentFailures(cutoffTime);

      const stats = {
        totalFailures: failures.length,
        failuresByProvider: {} as { [key: string]: number },
        failuresByModel: {} as { [key: string]: number },
        failuresByError: {} as { [key: string]: number },
        failuresByHour: {} as { [key: string]: number },
        avgFailureDuration: 0
      };

      let totalDuration = 0;
      let durationCount = 0;

      failures.forEach(failure => {
        // Provider统计
        stats.failuresByProvider[failure.providerId] = 
          (stats.failuresByProvider[failure.providerId] || 0) + 1;

        // Model统计
        stats.failuresByModel[failure.model] = 
          (stats.failuresByModel[failure.model] || 0) + 1;

        // 错误类型统计
        const errorType = this.categorizeError(failure.error, failure.httpCode);
        stats.failuresByError[errorType] = 
          (stats.failuresByError[errorType] || 0) + 1;

        // 按小时统计
        const hour = new Date(failure.timestamp).getHours();
        const hourKey = `${hour.toString().padStart(2, '0')}:00`;
        stats.failuresByHour[hourKey] = 
          (stats.failuresByHour[hourKey] || 0) + 1;

        // 持续时间统计
        if (failure.requestDuration) {
          totalDuration += failure.requestDuration;
          durationCount++;
        }
      });

      if (durationCount > 0) {
        stats.avgFailureDuration = Math.round(totalDuration / durationCount);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get failure stats', error);
      return {
        totalFailures: 0,
        failuresByProvider: {},
        failuresByModel: {},
        failuresByError: {},
        failuresByHour: {},
        avgFailureDuration: 0
      };
    }
  }

  /**
   * 获取失败趋势数据
   */
  async getFailureTrends(days: number = 7): Promise<{
    dailyFailures: { [date: string]: number };
    trendAnalysis: {
      isIncreasing: boolean;
      changePercentage: number;
      recommendation: string;
    };
  }> {
    try {
      const failures = await this.readRecentFailures(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );

      const dailyFailures: { [date: string]: number } = {};
      
      // 初始化所有日期为0
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        dailyFailures[dateKey] = 0;
      }

      // 统计每日失败数
      failures.forEach(failure => {
        const dateKey = failure.timestamp.split('T')[0];
        if (dailyFailures.hasOwnProperty(dateKey)) {
          dailyFailures[dateKey]++;
        }
      });

      // 趋势分析
      const dates = Object.keys(dailyFailures).sort();
      const firstHalf = dates.slice(0, Math.floor(dates.length / 2));
      const secondHalf = dates.slice(Math.floor(dates.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, date) => sum + dailyFailures[date], 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, date) => sum + dailyFailures[date], 0) / secondHalf.length;

      const changePercentage = firstHalfAvg > 0 ? 
        ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

      let recommendation = '';
      if (changePercentage > 20) {
        recommendation = '失败率显著上升，建议检查provider健康状态和配置';
      } else if (changePercentage < -20) {
        recommendation = '失败率显著下降，系统稳定性有所改善';
      } else {
        recommendation = '失败率变化在正常范围内';
      }

      return {
        dailyFailures,
        trendAnalysis: {
          isIncreasing: changePercentage > 5,
          changePercentage: Math.round(changePercentage * 100) / 100,
          recommendation
        }
      };
    } catch (error) {
      logger.error('Failed to get failure trends', error);
      return {
        dailyFailures: {},
        trendAnalysis: {
          isIncreasing: false,
          changePercentage: 0,
          recommendation: '无法获取趋势数据'
        }
      };
    }
  }

  /**
   * 清理旧日志文件
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.match(/^failures-\d{4}-\d{2}-\d{2}\.jsonl$/)) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`Deleted old failure log: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs', error);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // 目录已存在或其他错误，忽略
    }
  }

  /**
   * 更新每日日志路径
   */
  private updateDailyLogPath(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dailyLogPath = path.join(this.logDir, `failures-${today}.jsonl`);
  }

  /**
   * 安排每日日志轮转
   */
  private scheduleDailyLogRotation(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.updateDailyLogPath();
      // 设置每24小时轮转一次
      setInterval(() => {
        this.updateDailyLogPath();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * 读取最近的失败记录
   */
  private async readRecentFailures(cutoffTime: Date): Promise<FailureLogEntry[]> {
    const failures: FailureLogEntry[] = [];

    try {
      // 读取主失败日志
      const content = await fs.readFile(this.failureLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry: FailureLogEntry = JSON.parse(line);
          if (new Date(entry.timestamp) >= cutoffTime) {
            failures.push(entry);
          }
        } catch (parseError) {
          // 跳过无效的JSON行
        }
      }
    } catch (error) {
      // 文件不存在或读取失败
      logger.debug('Could not read failure log file', { error });
    }

    return failures.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * 对错误进行分类
   */
  private categorizeError(error: string, httpCode?: number): string {
    const errorLower = error.toLowerCase();

    if (httpCode) {
      if (httpCode >= 500) return 'Server Error';
      if (httpCode === 429) return 'Rate Limited';
      if (httpCode === 401 || httpCode === 403) return 'Authentication';
      if (httpCode >= 400) return 'Client Error';
    }

    if (errorLower.includes('timeout')) return 'Timeout';
    if (errorLower.includes('network') || errorLower.includes('connection')) return 'Network';
    if (errorLower.includes('auth') || errorLower.includes('token')) return 'Authentication';
    if (errorLower.includes('rate') || errorLower.includes('limit')) return 'Rate Limited';
    if (errorLower.includes('quota') || errorLower.includes('billing')) return 'Quota/Billing';

    return 'Unknown Error';
  }
}

// 导出单例实例
export const failureLogger = new FailureLogger();