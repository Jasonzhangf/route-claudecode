/**
 * Debug记录器实现
 * 
 * 提供请求追踪、调试记录和数据持久化功能
 * 
 * @author Jason Zhang
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import {
  IDebugRecorder,
  DebugRecord,
  RequestTrace,
  TraceStep,
  PerformanceTrace,
  DebugLevel,
  RecordType,
  DebugConfig
} from '../interfaces/core/debug-interface';
import { RouteRequest, RouteResponse } from '../interfaces/core/router-interface';

/**
 * Debug记录器实现类
 */
export class DebugRecorder extends EventEmitter implements IDebugRecorder {
  private config: DebugConfig;
  private records: Map<string, DebugRecord> = new Map();
  private activeTraces: Map<string, {
    requestId: string;
    sessionId: string;
    startTime: Date;
    request: RouteRequest;
    steps: TraceStep[];
    performance: PerformanceTrace;
  }> = new Map();
  private isInitialized: boolean = false;

  constructor(config: DebugConfig) {
    super();
    this.config = config;
  }

  /**
   * 初始化记录器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 确保存储目录存在
    await this.ensureStorageDir();

    // 加载现有记录
    await this.loadExistingRecords();

    // 设置自动清理
    if (this.config.autoCleanup) {
      this.setupAutoCleanup();
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * 记录Debug信息
   */
  async record(record: DebugRecord): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // 检查级别和类型过滤
    if (!this.shouldRecord(record)) {
      return;
    }

    // 添加到内存缓存
    this.records.set(record.id, record);

    // 限制内存中的记录数量
    this.trimRecords();

    // 持久化到磁盘
    await this.persistRecord(record);

    this.emit('record-created', record);
  }

  /**
   * 批量记录Debug信息
   */
  async recordBatch(records: DebugRecord[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const validRecords = records.filter(record => this.shouldRecord(record));
    
    for (const record of validRecords) {
      this.records.set(record.id, record);
    }

    this.trimRecords();

    // 批量持久化
    await this.persistRecordBatch(validRecords);

    for (const record of validRecords) {
      this.emit('record-created', record);
    }
  }

  /**
   * 开始请求追踪
   */
  startRequestTrace(request: RouteRequest): string {
    const traceId = this.generateTraceId();
    const sessionId = this.generateSessionId();

    const trace = {
      requestId: request.id,
      sessionId,
      startTime: new Date(),
      request,
      steps: [],
      performance: this.initializePerformanceTrace()
    };

    this.activeTraces.set(traceId, trace);

    // 记录追踪开始
    const record: DebugRecord = {
      id: this.generateRecordId(),
      timestamp: new Date(),
      level: DebugLevel.DEBUG,
      type: RecordType.REQUEST,
      sessionId,
      moduleId: 'debug-recorder',
      data: {
        traceId,
        request,
        action: 'trace-started'
      }
    };

    this.record(record);
    this.emit('trace-started', traceId, request);

    return traceId;
  }

  /**
   * 添加追踪步骤
   */
  async addTraceStep(traceId: string, step: TraceStep): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    trace.steps.push(step);

    // 记录步骤
    const record: DebugRecord = {
      id: this.generateRecordId(),
      timestamp: new Date(),
      level: DebugLevel.DEBUG,
      type: RecordType.PIPELINE,
      sessionId: trace.sessionId,
      moduleId: step.moduleId,
      data: {
        traceId,
        step,
        action: 'step-added'
      }
    };

    await this.record(record);
  }

  /**
   * 结束请求追踪
   */
  async endRequestTrace(traceId: string, response?: RouteResponse, error?: Error): Promise<RequestTrace> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const endTime = new Date();
    const totalTime = endTime.getTime() - trace.startTime.getTime();

    // 更新性能数据
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const finalPerformance: PerformanceTrace = {
      ...trace.performance,
      totalTime,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    const requestTrace: RequestTrace = {
      requestId: trace.requestId,
      sessionId: trace.sessionId,
      startTime: trace.startTime,
      endTime,
      request: trace.request,
      response,
      steps: trace.steps,
      error,
      performance: finalPerformance
    };

    // 移除活跃追踪
    this.activeTraces.delete(traceId);

    // 记录追踪完成
    const record: DebugRecord = {
      id: this.generateRecordId(),
      timestamp: new Date(),
      level: error ? DebugLevel.ERROR : DebugLevel.INFO,
      type: error ? RecordType.ERROR : RecordType.RESPONSE,
      sessionId: trace.sessionId,
      moduleId: 'debug-recorder',
      data: {
        traceId,
        requestTrace,
        action: 'trace-completed'
      }
    };

    await this.record(record);
    this.emit('trace-completed', requestTrace);

    return requestTrace;
  }

  /**
   * 查询Debug记录
   */
  async queryRecords(filters: {
    sessionId?: string;
    level?: DebugLevel;
    type?: RecordType;
    moduleId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<DebugRecord[]> {
    let records = Array.from(this.records.values());

    // 应用过滤条件
    if (filters.sessionId) {
      records = records.filter(r => r.sessionId === filters.sessionId);
    }

    if (filters.level) {
      records = records.filter(r => r.level === filters.level);
    }

    if (filters.type) {
      records = records.filter(r => r.type === filters.type);
    }

    if (filters.moduleId) {
      records = records.filter(r => r.moduleId === filters.moduleId);
    }

    if (filters.startTime) {
      records = records.filter(r => r.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      records = records.filter(r => r.timestamp <= filters.endTime!);
    }

    // 按时间排序（最新的在前）
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 应用限制
    if (filters.limit && filters.limit > 0) {
      records = records.slice(0, filters.limit);
    }

    return records;
  }

  /**
   * 获取请求追踪
   */
  async getRequestTrace(requestId: string): Promise<RequestTrace | null> {
    // 查找完成的追踪记录
    const records = await this.queryRecords({
      type: RecordType.RESPONSE,
      limit: 1000 // 合理的限制
    });

    for (const record of records) {
      if (record.data.requestTrace && record.data.requestTrace.requestId === requestId) {
        return record.data.requestTrace;
      }
    }

    return null;
  }

  /**
   * 检查是否应该记录
   */
  private shouldRecord(record: DebugRecord): boolean {
    // 检查级别
    const levels = [DebugLevel.TRACE, DebugLevel.DEBUG, DebugLevel.INFO, DebugLevel.WARN, DebugLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const recordLevelIndex = levels.indexOf(record.level);

    if (recordLevelIndex < currentLevelIndex) {
      return false;
    }

    // 检查类型
    if (this.config.recordTypes.length > 0 && !this.config.recordTypes.includes(record.type)) {
      return false;
    }

    return true;
  }

  /**
   * 限制记录数量
   */
  private trimRecords(): void {
    if (this.records.size <= this.config.maxRecords) {
      return;
    }

    const records = Array.from(this.records.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    // 保留最新的记录
    const toKeep = records.slice(0, this.config.maxRecords);
    this.records.clear();

    for (const [id, record] of toKeep) {
      this.records.set(id, record);
    }
  }

  /**
   * 持久化记录
   */
  private async persistRecord(record: DebugRecord): Promise<void> {
    const filePath = this.getRecordFilePath(record);
    const dir = join(this.config.storageDir, record.sessionId);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(record, null, 2));
  }

  /**
   * 批量持久化记录
   */
  private async persistRecordBatch(records: DebugRecord[]): Promise<void> {
    const recordsBySession = new Map<string, DebugRecord[]>();

    for (const record of records) {
      if (!recordsBySession.has(record.sessionId)) {
        recordsBySession.set(record.sessionId, []);
      }
      recordsBySession.get(record.sessionId)!.push(record);
    }

    for (const [sessionId, sessionRecords] of Array.from(recordsBySession.entries())) {
      const dir = join(this.config.storageDir, sessionId);
      await fs.mkdir(dir, { recursive: true });

      const batchFile = join(dir, `batch-${Date.now()}.json`);
      await fs.writeFile(batchFile, JSON.stringify(sessionRecords, null, 2));
    }
  }

  /**
   * 确保存储目录存在
   */
  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
  }

  /**
   * 加载现有记录
   */
  private async loadExistingRecords(): Promise<void> {
    // 为了性能，只加载最近的记录
    // 实际项目中可能需要更复杂的索引机制
  }

  /**
   * 设置自动清理
   */
  private setupAutoCleanup(): void {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时

    setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        this.emit('error', error);
      }
    }, cleanupInterval);
  }

  /**
   * 执行清理
   */
  private async performCleanup(): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.config.cleanupDays * 24 * 60 * 60 * 1000);

    // 清理内存中的记录
    const toDelete: string[] = [];
    for (const [id, record] of Array.from(this.records.entries())) {
      if (record.timestamp < cutoffTime) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.records.delete(id);
    }

    // TODO: 清理磁盘文件
    this.emit('cleanup-completed', toDelete.length);
  }

  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成记录ID
   */
  private generateRecordId(): string {
    return `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 初始化性能追踪
   */
  private initializePerformanceTrace(): PerformanceTrace {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      totalTime: 0,
      routingTime: 0,
      pipelineTime: 0,
      networkTime: 0,
      transformTime: 0,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * 获取记录文件路径
   */
  private getRecordFilePath(record: DebugRecord): string {
    const fileName = `${record.type}_${record.id}.json`;
    return join(this.config.storageDir, record.sessionId, fileName);
  }
}