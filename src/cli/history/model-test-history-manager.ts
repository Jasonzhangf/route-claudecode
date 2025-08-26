/**
 * 模型测试历史记录管理器
 * 
 * 提供模型测试结果的持久化存储、查询和管理功能
 * 支持快速模式下的历史记录缓存和智能跳过逻辑
 * 
 * @author Jason Zhang
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JQJsonHandler } from '../../utils/jq-json-handler';
import { secureLogger } from '../../utils/secure-logger';

/**
 * 历史管理器专用错误类型
 */
export class ModelTestHistoryError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ModelTestHistoryError';
    
    // 记录错误日志
    secureLogger.error('ModelTestHistory操作失败', {
      operation,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 模型测试记录接口
 */
export interface ModelTestRecord {
  /** 唯一标识符：provider_name:model_name */
  id: string;
  /** Provider名称 */
  providerName: string;
  /** 模型名称 */
  modelName: string;
  /** 测试类型 */
  testType: 'classification' | 'context_length' | 'availability' | 'multimodal' | 'full';
  /** 测试状态 */
  status: 'success' | 'failed' | 'skipped' | 'pending';
  /** 测试结果详情 */
  result: {
    /** 模型分类结果 */
    category?: 'multimodal' | 'reasoning' | 'programming' | 'long_context' | 'general' | 'embedding' | 'audio' | 'image';
    /** 上下文长度(K tokens) */
    contextLength?: number;
    /** 最大令牌数 */
    maxTokens?: number;
    /** 是否可用 */
    available?: boolean;
    /** 多模态能力 */
    multimodal?: boolean;
    /** 错误信息(如果失败) */
    error?: string;
    /** 测试耗时(毫秒) */
    duration?: number;
    /** API端点 */
    endpoint?: string;
  };
  /** 测试时间戳 */
  testedAt: string;
  /** 记录创建时间 */
  createdAt: string;
  /** 记录更新时间 */
  updatedAt: string;
  /** 测试版本(用于判断是否需要重新测试) */
  testVersion: string;
  /** 过期时间(可选) */
  expiresAt?: string;
}

/**
 * 历史记录查询选项
 */
export interface HistoryQueryOptions {
  /** Provider名称过滤 */
  providerName?: string;
  /** 模型名称过滤(支持模糊匹配) */
  modelName?: string;
  /** 测试状态过滤 */
  status?: ModelTestRecord['status'][];
  /** 测试类型过滤 */
  testType?: ModelTestRecord['testType'][];
  /** 时间范围过滤 */
  timeRange?: {
    from: string;
    to: string;
  };
  /** 是否包含过期记录 */
  includeExpired?: boolean;
  /** 限制返回数量 */
  limit?: number;
  /** 排序字段 */
  sortBy?: 'testedAt' | 'updatedAt' | 'modelName';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 历史记录统计信息
 */
export interface HistoryStatistics {
  /** 总记录数 */
  totalRecords: number;
  /** 成功测试数 */
  successCount: number;
  /** 失败测试数 */
  failedCount: number;
  /** 按Provider统计 */
  byProvider: Record<string, {
    total: number;
    success: number;
    failed: number;
  }>;
  /** 按测试类型统计 */
  byTestType: Record<string, number>;
  /** 最近测试时间 */
  lastTestedAt?: string;
  /** 历史文件大小(字节) */
  fileSize: number;
}

/**
 * 历史数据结构
 */
interface HistoryData {
  metadata: {
    version: string;
    createdAt: string;
    lastUpdated: string;
    totalRecords: number;
  };
  records: ModelTestRecord[];
}

/**
 * 模型测试历史记录管理器
 */
export class ModelTestHistoryManager {
  private historyDir: string;
  private historyFile: string;
  private currentVersion: string = '1.0.0';
  
  constructor() {
    this.historyDir = path.join(os.homedir(), '.route-claudecode', 'history');
    this.historyFile = path.join(this.historyDir, 'model-test-history.json');
  }

  /**
   * 初始化历史记录管理器
   */
  async initialize(): Promise<void> {
    try {
      // 确保历史目录存在
      await fs.mkdir(this.historyDir, { recursive: true });
      
      // 验证历史文件是否存在，不存在则创建
      if (!(await this.fileExists(this.historyFile))) {
        await this.createEmptyHistoryFile();
        secureLogger.info('创建新的模型测试历史文件', { 
          historyFile: this.historyFile 
        });
      }
      
      // 验证历史文件格式
      await this.validateHistoryFile();
      
      secureLogger.info('模型测试历史记录管理器初始化完成', {
        historyDir: this.historyDir,
        historyFile: this.historyFile,
        version: this.currentVersion
      });
    } catch (error) {
      throw new ModelTestHistoryError(
        `历史记录管理器初始化失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialize',
        { historyDir: this.historyDir }
      );
    }
  }

  /**
   * 保存模型测试记录
   */
  async saveTestRecord(record: Omit<ModelTestRecord, 'id' | 'createdAt' | 'updatedAt' | 'testVersion'>): Promise<ModelTestRecord> {
    try {
      const now = new Date().toISOString();
      const fullRecord: ModelTestRecord = {
        ...record,
        id: `${record.providerName}:${record.modelName}`,
        createdAt: now,
        updatedAt: now,
        testVersion: this.currentVersion
      };

      const history = await this.loadHistory();
      
      // 检查是否已存在相同记录
      const existingIndex = history.records.findIndex(r => r.id === fullRecord.id && r.testType === fullRecord.testType);
      
      if (existingIndex >= 0) {
        // 更新现有记录
        history.records[existingIndex] = {
          ...history.records[existingIndex],
          ...fullRecord,
          createdAt: history.records[existingIndex].createdAt, // 保持原创建时间
          updatedAt: now
        };
        secureLogger.info('更新模型测试记录', { 
          id: fullRecord.id, 
          testType: fullRecord.testType,
          status: fullRecord.status 
        });
      } else {
        // 添加新记录
        history.records.push(fullRecord);
        secureLogger.info('添加新模型测试记录', { 
          id: fullRecord.id, 
          testType: fullRecord.testType,
          status: fullRecord.status 
        });
      }

      // 更新元数据
      history.metadata.lastUpdated = now;
      history.metadata.totalRecords = history.records.length;

      // 保存到文件
      await this.saveHistory(history);
      
      return fullRecord;
    } catch (error) {
      throw new ModelTestHistoryError(
        `保存模型测试记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'saveTestRecord',
        { 
          providerName: record.providerName, 
          modelName: record.modelName,
          testType: record.testType 
        }
      );
    }
  }

  /**
   * 查询模型测试记录
   */
  async queryRecords(options: HistoryQueryOptions = {}): Promise<ModelTestRecord[]> {
    try {
      const history = await this.loadHistory();
      let records = [...history.records];

      // 应用过滤条件
      if (options.providerName) {
        records = records.filter(r => r.providerName === options.providerName);
      }

      if (options.modelName) {
        records = records.filter(r => r.modelName.toLowerCase().includes(options.modelName!.toLowerCase()));
      }

      if (options.status && options.status.length > 0) {
        records = records.filter(r => options.status!.includes(r.status));
      }

      if (options.testType && options.testType.length > 0) {
        records = records.filter(r => options.testType!.includes(r.testType));
      }

      if (options.timeRange) {
        records = records.filter(r => 
          r.testedAt >= options.timeRange!.from && 
          r.testedAt <= options.timeRange!.to
        );
      }

      // 过期记录过滤
      if (!options.includeExpired) {
        const now = new Date().toISOString();
        records = records.filter(r => !r.expiresAt || r.expiresAt > now);
      }

      // 排序
      const sortBy = options.sortBy || 'testedAt';
      const sortOrder = options.sortOrder || 'desc';
      records.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const result = aVal! < bVal! ? -1 : aVal! > bVal! ? 1 : 0;
        return sortOrder === 'asc' ? result : -result;
      });

      // 限制数量
      if (options.limit && options.limit > 0) {
        records = records.slice(0, options.limit);
      }

      return records;
    } catch (error) {
      throw new ModelTestHistoryError(
        `查询模型测试记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'queryRecords',
        { options }
      );
    }
  }

  /**
   * 获取特定模型的测试记录
   */
  async getModelRecord(providerName: string, modelName: string, testType?: ModelTestRecord['testType']): Promise<ModelTestRecord | null> {
    try {
      const records = await this.queryRecords({
        providerName,
        modelName: modelName, // 精确匹配
        testType: testType ? [testType] : undefined,
        limit: 1
      });

      // 精确匹配模型名称
      const exactMatch = records.find(r => r.modelName === modelName);
      return exactMatch || null;
    } catch (error) {
      secureLogger.error('获取模型测试记录失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        providerName,
        modelName,
        testType
      });
      return null;
    }
  }

  /**
   * 检查模型是否需要重新测试
   */
  async shouldSkipModel(providerName: string, modelName: string, testType: ModelTestRecord['testType']): Promise<{
    shouldSkip: boolean;
    reason?: string;
    record?: ModelTestRecord;
  }> {
    try {
      const record = await this.getModelRecord(providerName, modelName, testType);
      
      if (!record) {
        return { shouldSkip: false, reason: 'no_history' };
      }

      // 检查记录是否过期
      if (record.expiresAt && record.expiresAt <= new Date().toISOString()) {
        return { shouldSkip: false, reason: 'expired', record };
      }

      // 检查测试版本是否匹配
      if (record.testVersion !== this.currentVersion) {
        return { shouldSkip: false, reason: 'version_mismatch', record };
      }

      // 成功的测试可以跳过
      if (record.status === 'success') {
        return { shouldSkip: true, reason: 'already_successful', record };
      }

      // 失败的测试需要重新测试
      if (record.status === 'failed') {
        return { shouldSkip: false, reason: 'previous_failed', record };
      }

      // 其他状态需要重新测试
      return { shouldSkip: false, reason: 'status_' + record.status, record };
    } catch (error) {
      secureLogger.error('检查模型跳过状态失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        providerName,
        modelName,
        testType
      });
      return { shouldSkip: false, reason: 'check_error' };
    }
  }

  /**
   * 获取需要重新测试的低上下文模型
   */
  async getLowContextModels(providerName?: string, contextThreshold: number = 128): Promise<ModelTestRecord[]> {
    try {
      const records = await this.queryRecords({
        providerName,
        status: ['success'],
        testType: ['context_length', 'full']
      });

      // 过滤出低上下文模型
      return records.filter(record => {
        const contextLength = record.result.contextLength || 0;
        return contextLength > 0 && contextLength < contextThreshold;
      });
    } catch (error) {
      secureLogger.error('获取低上下文模型失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        providerName,
        contextThreshold
      });
      return [];
    }
  }

  /**
   * 获取历史统计信息
   */
  async getStatistics(): Promise<HistoryStatistics> {
    try {
      const history = await this.loadHistory();
      const records = history.records;

      const stats: HistoryStatistics = {
        totalRecords: records.length,
        successCount: records.filter(r => r.status === 'success').length,
        failedCount: records.filter(r => r.status === 'failed').length,
        byProvider: {},
        byTestType: {},
        fileSize: await this.getFileSize()
      };

      // 按Provider统计
      records.forEach(record => {
        if (!stats.byProvider[record.providerName]) {
          stats.byProvider[record.providerName] = {
            total: 0,
            success: 0,
            failed: 0
          };
        }
        
        const providerStats = stats.byProvider[record.providerName];
        providerStats.total++;
        
        if (record.status === 'success') {
          providerStats.success++;
        } else if (record.status === 'failed') {
          providerStats.failed++;
        }
      });

      // 按测试类型统计
      records.forEach(record => {
        stats.byTestType[record.testType] = (stats.byTestType[record.testType] || 0) + 1;
      });

      // 最近测试时间
      if (records.length > 0) {
        const sortedRecords = records.sort((a, b) => b.testedAt.localeCompare(a.testedAt));
        stats.lastTestedAt = sortedRecords[0].testedAt;
      }

      return stats;
    } catch (error) {
      throw new ModelTestHistoryError(
        `获取历史统计信息失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getStatistics',
        {}
      );
    }
  }

  /**
   * 清理历史记录
   */
  async clearHistory(options: {
    providerName?: string;
    olderThan?: string;
    status?: ModelTestRecord['status'][];
    confirmClear?: boolean;
  } = {}): Promise<{
    deletedCount: number;
    remainingCount: number;
  }> {
    try {
      if (!options.confirmClear) {
        throw new ModelTestHistoryError(
          '清理历史记录需要确认参数 confirmClear: true',
          'clearHistory',
          { options }
        );
      }

      const history = await this.loadHistory();
      const originalCount = history.records.length;
      
      // 应用清理过滤条件
      let recordsToKeep = history.records;

      if (options.providerName) {
        recordsToKeep = recordsToKeep.filter(r => r.providerName !== options.providerName);
      }

      if (options.olderThan) {
        recordsToKeep = recordsToKeep.filter(r => r.testedAt >= options.olderThan!);
      }

      if (options.status && options.status.length > 0) {
        recordsToKeep = recordsToKeep.filter(r => !options.status!.includes(r.status));
      }

      // 更新历史记录
      history.records = recordsToKeep;
      history.metadata.lastUpdated = new Date().toISOString();
      history.metadata.totalRecords = recordsToKeep.length;

      await this.saveHistory(history);

      const result = {
        deletedCount: originalCount - recordsToKeep.length,
        remainingCount: recordsToKeep.length
      };

      secureLogger.info('清理历史记录完成', {
        ...result,
        options
      });

      return result;
    } catch (error) {
      throw new ModelTestHistoryError(
        `清理历史记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'clearHistory',
        { options }
      );
    }
  }

  /**
   * 导出历史记录
   */
  async exportHistory(outputPath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    try {
      const history = await this.loadHistory();
      
      if (format === 'json') {
        await fs.writeFile(outputPath, JQJsonHandler.stringifyJson(history, false));
      } else if (format === 'csv') {
        // 简单的CSV导出实现
        const csvHeader = 'ID,Provider,Model,TestType,Status,Category,ContextLength,MaxTokens,Available,TestedAt\n';
        const csvRows = history.records.map(record => {
          return [
            record.id,
            record.providerName,
            record.modelName,
            record.testType,
            record.status,
            record.result.category || '',
            record.result.contextLength || '',
            record.result.maxTokens || '',
            record.result.available || '',
            record.testedAt
          ].join(',');
        }).join('\n');
        
        await fs.writeFile(outputPath, csvHeader + csvRows);
      }

      secureLogger.info('导出历史记录完成', {
        outputPath,
        format,
        recordCount: history.records.length
      });
    } catch (error) {
      throw new ModelTestHistoryError(
        `导出历史记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'exportHistory',
        { outputPath, format }
      );
    }
  }

  // ========== Private Methods ==========

  /**
   * 加载历史记录
   */
  private async loadHistory(): Promise<HistoryData> {
    try {
      const content = await fs.readFile(this.historyFile, 'utf-8');
      return JQJsonHandler.parseJsonString(content);
    } catch (error) {
      secureLogger.error('加载历史文件失败', {
        error: error instanceof Error ? error.message : 'Unknown error',
        historyFile: this.historyFile
      });
      // 如果文件不存在或损坏，创建空文件
      await this.createEmptyHistoryFile();
      return this.loadHistory();
    }
  }

  /**
   * 保存历史记录
   */
  private async saveHistory(history: HistoryData): Promise<void> {
    try {
      const content = JQJsonHandler.stringifyJson(history, false);
      await fs.writeFile(this.historyFile, content);
    } catch (error) {
      throw new ModelTestHistoryError(
        `保存历史文件失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'saveHistory',
        { historyFile: this.historyFile }
      );
    }
  }

  /**
   * 创建空的历史文件
   */
  private async createEmptyHistoryFile(): Promise<void> {
    const emptyHistory: HistoryData = {
      metadata: {
        version: this.currentVersion,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalRecords: 0
      },
      records: []
    };
    
    await this.saveHistory(emptyHistory);
  }

  /**
   * 验证历史文件格式
   */
  private async validateHistoryFile(): Promise<void> {
    try {
      const history = await this.loadHistory();
      
      // 验证必要字段
      if (!history.metadata || !history.records) {
        throw new ModelTestHistoryError(
          '历史文件格式无效：缺少metadata或records字段',
          'validateHistoryFile',
          { historyFile: this.historyFile }
        );
      }

      if (!Array.isArray(history.records)) {
        throw new ModelTestHistoryError(
          '历史文件格式无效：records必须是数组',
          'validateHistoryFile',
          { historyFile: this.historyFile }
        );
      }

      // 验证版本兼容性
      if (history.metadata.version !== this.currentVersion) {
        secureLogger.warn('历史文件版本不匹配', {
          fileVersion: history.metadata.version,
          currentVersion: this.currentVersion
        });
        // 可以在这里添加版本迁移逻辑
      }
    } catch (error) {
      if (error instanceof ModelTestHistoryError) {
        throw error;
      }
      throw new ModelTestHistoryError(
        `历史文件验证失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'validateHistoryFile',
        { historyFile: this.historyFile }
      );
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件大小
   */
  private async getFileSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.historyFile);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

export default ModelTestHistoryManager;