/**
 * Provider Fetch历史记录管理器
 * 记录已排除的模型，避免重复搜索
 * 
 * @author Jason Zhang
 * @version v3.0.3
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface HistoryRecord {
  modelName: string;
  reason: 'blacklisted' | 'low-tokens' | 'not-available' | 'failed-simple-chat';
  timestamp: string;
  providerName: string;
  providerType: string;
  details?: string;
}

export interface ProviderHistory {
  [providerKey: string]: {
    lastFetch: string;
    excludedModels: HistoryRecord[];
    successfulModels: string[];
  };
}

/**
 * Provider Fetch历史记录管理器
 */
export class ProviderHistoryManager {
  private historyFile: string;
  private history: ProviderHistory = {};

  constructor() {
    // 历史记录存储在用户配置目录
    const configDir = path.join(os.homedir(), '.route-claudecode', 'history');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.historyFile = path.join(configDir, 'provider-fetch-history.json');
    this.loadHistory();
  }

  /**
   * 加载历史记录
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        this.history = JSON.parse(data);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load fetch history: ${error instanceof Error ? error.message : error}`);
      this.history = {};
    }
  }

  /**
   * 保存历史记录
   */
  private saveHistory(): void {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error(`❌ Failed to save fetch history: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 生成Provider键
   */
  private getProviderKey(providerName: string, providerType: string, endpoint: string): string {
    // 使用provider名称、类型和endpoint的组合作为唯一键
    return `${providerName}-${providerType}-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 检查模型是否在历史排除列表中
   */
  isModelExcluded(providerName: string, providerType: string, endpoint: string, modelName: string): HistoryRecord | null {
    const key = this.getProviderKey(providerName, providerType, endpoint);
    const providerHistory = this.history[key];
    
    if (!providerHistory) {
      return null;
    }

    // 查找匹配的排除记录
    return providerHistory.excludedModels.find(record => 
      record.modelName === modelName
    ) || null;
  }

  /**
   * 获取应该跳过的模型列表
   */
  getExcludedModels(providerName: string, providerType: string, endpoint: string): string[] {
    const key = this.getProviderKey(providerName, providerType, endpoint);
    const providerHistory = this.history[key];
    
    if (!providerHistory) {
      return [];
    }

    // 返回所有被排除的模型名称
    return providerHistory.excludedModels.map(record => record.modelName);
  }

  /**
   * 记录排除的模型
   */
  addExcludedModel(
    providerName: string, 
    providerType: string, 
    endpoint: string, 
    modelName: string, 
    reason: HistoryRecord['reason'],
    details?: string
  ): void {
    const key = this.getProviderKey(providerName, providerType, endpoint);
    
    if (!this.history[key]) {
      this.history[key] = {
        lastFetch: new Date().toISOString(),
        excludedModels: [],
        successfulModels: []
      };
    }

    // 检查是否已存在，避免重复
    const existing = this.history[key].excludedModels.find(record => 
      record.modelName === modelName
    );

    if (!existing) {
      this.history[key].excludedModels.push({
        modelName,
        reason,
        timestamp: new Date().toISOString(),
        providerName,
        providerType,
        details
      });
    } else {
      // 更新已存在的记录
      existing.reason = reason;
      existing.timestamp = new Date().toISOString();
      existing.details = details;
    }

    this.saveHistory();
  }

  /**
   * 记录成功的模型
   */
  addSuccessfulModel(
    providerName: string, 
    providerType: string, 
    endpoint: string, 
    modelName: string
  ): void {
    const key = this.getProviderKey(providerName, providerType, endpoint);
    
    if (!this.history[key]) {
      this.history[key] = {
        lastFetch: new Date().toISOString(),
        excludedModels: [],
        successfulModels: []
      };
    }

    // 添加到成功列表（避免重复）
    if (!this.history[key].successfulModels.includes(modelName)) {
      this.history[key].successfulModels.push(modelName);
    }

    // 如果之前被排除，从排除列表中移除
    this.history[key].excludedModels = this.history[key].excludedModels.filter(
      record => record.modelName !== modelName
    );

    this.saveHistory();
  }

  /**
   * 更新fetch时间
   */
  updateFetchTime(providerName: string, providerType: string, endpoint: string): void {
    const key = this.getProviderKey(providerName, providerType, endpoint);
    
    if (!this.history[key]) {
      this.history[key] = {
        lastFetch: new Date().toISOString(),
        excludedModels: [],
        successfulModels: []
      };
    }

    this.history[key].lastFetch = new Date().toISOString();
    this.saveHistory();
  }

  /**
   * 获取统计信息
   */
  getStats(providerName?: string, providerType?: string, endpoint?: string): any {
    if (providerName && providerType && endpoint) {
      // 获取特定provider的统计
      const key = this.getProviderKey(providerName, providerType, endpoint);
      const providerHistory = this.history[key];
      
      if (!providerHistory) {
        return {
          excludedModels: 0,
          successfulModels: 0,
          lastFetch: null
        };
      }

      return {
        excludedModels: providerHistory.excludedModels.length,
        successfulModels: providerHistory.successfulModels.length,
        lastFetch: providerHistory.lastFetch,
        exclusionReasons: this.countExclusionReasons(providerHistory.excludedModels)
      };
    } else {
      // 获取全局统计
      let totalExcluded = 0;
      let totalSuccessful = 0;
      const reasonCounts: { [reason: string]: number } = {};

      for (const providerHistory of Object.values(this.history)) {
        totalExcluded += providerHistory.excludedModels.length;
        totalSuccessful += providerHistory.successfulModels.length;
        
        for (const record of providerHistory.excludedModels) {
          reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + 1;
        }
      }

      return {
        totalProviders: Object.keys(this.history).length,
        totalExcluded,
        totalSuccessful,
        exclusionReasons: reasonCounts
      };
    }
  }

  /**
   * 统计排除原因
   */
  private countExclusionReasons(records: HistoryRecord[]): { [reason: string]: number } {
    const counts: { [reason: string]: number } = {};
    for (const record of records) {
      counts[record.reason] = (counts[record.reason] || 0) + 1;
    }
    return counts;
  }

  /**
   * 清理历史记录（移除过期的记录）
   */
  cleanup(maxAgeInDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    let cleanedCount = 0;

    for (const [key, providerHistory] of Object.entries(this.history)) {
      // 清理过期的排除记录
      const originalLength = providerHistory.excludedModels.length;
      providerHistory.excludedModels = providerHistory.excludedModels.filter(
        record => record.timestamp > cutoffTimestamp
      );
      cleanedCount += originalLength - providerHistory.excludedModels.length;

      // 如果provider历史为空，移除整个provider记录
      if (providerHistory.excludedModels.length === 0 && providerHistory.successfulModels.length === 0) {
        delete this.history[key];
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old history records`);
      this.saveHistory();
    }
  }

  /**
   * 显示历史记录摘要
   */
  printSummary(): void {
    const stats = this.getStats();
    console.log(`\n📊 Provider Fetch History Summary:`);
    console.log(`   📋 Total providers tracked: ${stats.totalProviders}`);
    console.log(`   ✅ Successful models: ${stats.totalSuccessful}`);
    console.log(`   ❌ Excluded models: ${stats.totalExcluded}`);
    
    if (Object.keys(stats.exclusionReasons).length > 0) {
      console.log(`   📈 Exclusion breakdown:`);
      for (const [reason, count] of Object.entries(stats.exclusionReasons)) {
        const emoji = this.getReasonEmoji(reason);
        console.log(`      ${emoji} ${reason}: ${count}`);
      }
    }
    console.log('');
  }

  /**
   * 获取排除原因对应的emoji
   */
  private getReasonEmoji(reason: string): string {
    switch (reason) {
      case 'blacklisted': return '🚫';
      case 'low-tokens': return '🔻';
      case 'not-available': return '❌';
      case 'failed-simple-chat': return '💬';
      default: return '❓';
    }
  }
}