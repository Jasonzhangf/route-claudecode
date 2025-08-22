/**
 * Debug记录器
 *
 * 协调各个调试模块的主接口，负责Debug数据的管理和协调
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecord, DebugSession, ModuleRecord, DebugConfig } from './types/debug-types';
import { RCCError } from '../types/error';
import { Pipeline } from '../pipeline/types';
import { DebugFilter, DebugFilterImpl } from './debug-filter';
import { DebugSerializer, DebugSerializerImpl } from './debug-serializer';
import { DebugStorage, DebugStorageImpl } from './debug-storage';
import { DebugAnalyzer, DebugAnalyzerImpl, AnalysisReport } from './debug-analyzer';
import { DebugCollector, DebugCollectorImpl, DebugEvent } from './debug-collector';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * Debug记录器接口
 */
export interface DebugRecorder {
  createSession(port: number, sessionId?: string): DebugSession;
  endSession(sessionId: string): Promise<void>;
  recordPipelineExecution(requestId: string, pipeline: Pipeline, data: any): void;
  recordModuleInput(moduleName: string, requestId: string, input: any): void;
  recordModuleOutput(moduleName: string, requestId: string, output: any): void;
  recordModuleError(moduleName: string, requestId: string, error: RCCError): void;
  saveRecord(record: DebugRecord): Promise<void>;
  loadRecord(requestId: string): Promise<DebugRecord>;
  findRecords(criteria: RecordSearchCriteria): Promise<DebugRecord[]>;
  generateAnalysisReport(): Promise<AnalysisReport>;
  getEvents(): Promise<DebugEvent[]>;
  cleanupExpiredRecords(): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * 记录搜索条件
 */
export interface RecordSearchCriteria {
  sessionId?: string;
  port?: number;
  moduleName?: string;
  startTime?: number;
  endTime?: number;
  hasError?: boolean;
  limit?: number;
}

/**
 * 记录错误类
 */
export class RecordError extends Error {
  constructor(recordId: string, message: string) {
    super(`Record operation failed for ${recordId}: ${message}`);
    this.name = 'RecordError';
  }
}

/**
 * Debug记录器实现
 */
export class DebugRecorderImpl extends EventEmitter implements DebugRecorder {
  private config: DebugConfig;
  private activeSessions: Map<string, DebugSession> = new Map();
  private pendingRecords: Map<string, Partial<DebugRecord>> = new Map();
  private moduleRecords: Map<string, Map<string, ModuleRecord[]>> = new Map();

  // 注入的依赖模块
  private filter: DebugFilter;
  private serializer: DebugSerializer;
  private storage: DebugStorageImpl;
  private analyzer: DebugAnalyzer;
  private collector: DebugCollectorImpl;

  constructor(config: DebugConfig) {
    super();
    this.config = config;

    // 初始化依赖模块
    this.filter = new DebugFilterImpl(config);
    this.serializer = new DebugSerializerImpl(config);
    this.storage = new DebugStorageImpl(config, this.serializer);
    this.analyzer = new DebugAnalyzerImpl();
    this.collector = new DebugCollectorImpl(config);

    // 设置模块间的事件转发
    this.setupEventForwarding();

    // 启动自动事件收集
    this.collector.startAutoFlush();
  }

  /**
   * 创建Debug会话
   */
  createSession(port: number, sessionId?: string): DebugSession {
    const now = Date.now();
    const actualSessionId = sessionId || `session-${this.formatReadableTime(now).replace(/[:\s]/g, '-')}`;

    const session: DebugSession = {
      sessionId: actualSessionId,
      port,
      startTime: now,
      startTimeReadable: this.formatReadableTime(now),
      requestCount: 0,
      errorCount: 0,
      activePipelines: [],
      metadata: {
        version: '4.0.0',
        config: this.config,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    this.activeSessions.set(actualSessionId, session);

    // 创建存储目录结构
    this.storage.ensureDirectoryStructure(port, actualSessionId).catch(error => {
      console.error('创建目录结构失败:', error);
    });

    // 保存会话信息
    this.storage.saveSession(session).catch(error => {
      console.error('保存会话信息失败:', error);
    });

    // 收集会话开始事件
    this.collector.collectSessionEvent('session-start', session);

    this.emit('session-created', {
      sessionId: actualSessionId,
      port,
      timestamp: now,
    });

    console.log(`📁 Debug会话已创建: ${actualSessionId}`);
    return session;
  }

  /**
   * 结束Debug会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new RecordError(sessionId, 'Session not found');
    }

    const now = Date.now();
    session.endTime = now;
    session.endTimeReadable = this.formatReadableTime(now);
    session.duration = now - session.startTime;

    try {
      // 保存所有待处理记录
      await this.flushPendingRecords();

      // 保存最终会话信息
      await this.storage.saveSession(session);

      // 收集会话结束事件
      this.collector.collectSessionEvent('session-end', session);

      this.activeSessions.delete(sessionId);

      this.emit('session-ended', {
        sessionId,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        timestamp: now,
      });
    } catch (error) {
      throw new RecordError(sessionId, `Failed to end session: ${error.message}`);
    }
  }

  /**
   * 记录流水线执行
   */
  recordPipelineExecution(requestId: string, pipeline: Pipeline, data: any): void {
    if (!this.config.enabled) return;

    try {
      // 过滤敏感数据 (添加null检查防止filter未定义错误)
      const filteredData = this.filter ? this.filter.filterRequest(data).filtered : data;

      // 获取或创建记录
      let record = this.pendingRecords.get(requestId);
      if (!record) {
        record = this.createBaseRecord(requestId, filteredData);
        this.pendingRecords.set(requestId, record);
      }

      // 更新流水线信息
      record.pipeline = {
        id: pipeline.id,
        provider: filteredData.provider || 'unknown',
        model: filteredData.model || 'unknown',
        modules: [],
      };

      // 收集流水线事件
      this.collector.collectPipelineEvent('pipeline-start', pipeline, requestId, record.sessionId!, filteredData);

      this.emit('pipeline-recorded', {
        requestId,
        pipelineId: pipeline.id,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`记录流水线执行失败 [${requestId}]:`, error);
    }
  }

  /**
   * 记录模块输入
   */
  recordModuleInput(moduleName: string, requestId: string, input: any): void {
    if (!this.config.enabled) return;

    try {
      const now = Date.now();

      // 过滤敏感数据 (添加null检查防止filter未定义错误)
      const filteredInput = this.filter ? this.filter.filterModuleInput(input).filtered : input;

      const moduleRecord: Partial<ModuleRecord> = {
        moduleName,
        startTime: now,
        startTimeReadable: this.formatReadableTime(now),
        input: filteredInput,
        metadata: {
          version: '4.0.0',
          config: this.config.modules[moduleName] || {},
        },
      };

      this.addModuleRecord(moduleName, requestId, moduleRecord);

      // 收集模块事件
      const sessionId = this.findSessionIdByRequestId(requestId);
      this.collector.collectModuleEvent('module-start', moduleName, requestId, sessionId, { input: filteredInput });

      this.emit('module-input-recorded', {
        moduleName,
        requestId,
        timestamp: now,
        dataSize: JQJsonHandler.stringifyJson(filteredInput, true).length,
      });
    } catch (error) {
      console.error(`记录模块输入失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块输出
   */
  recordModuleOutput(moduleName: string, requestId: string, output: any): void {
    if (!this.config.enabled) return;

    try {
      const now = Date.now();

      // 过滤敏感数据 (添加null检查防止filter未定义错误)
      const filteredOutput = this.filter ? this.filter.filterModuleOutput(output).filtered : output;

      // 查找对应的输入记录并更新
      const moduleRecords = this.getModuleRecords(moduleName, requestId);
      if (moduleRecords.length > 0) {
        const lastRecord = moduleRecords[moduleRecords.length - 1];
        lastRecord.output = filteredOutput;
        lastRecord.endTime = now;
        lastRecord.endTimeReadable = this.formatReadableTime(now);
        lastRecord.duration = now - lastRecord.startTime;
      }

      // 收集模块事件
      const sessionId = this.findSessionIdByRequestId(requestId);
      this.collector.collectModuleEvent('module-end', moduleName, requestId, sessionId, { output: filteredOutput });

      this.emit('module-output-recorded', {
        moduleName,
        requestId,
        timestamp: now,
        dataSize: JQJsonHandler.stringifyJson(filteredOutput, true).length,
      });
    } catch (error) {
      console.error(`记录模块输出失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块错误
   */
  recordModuleError(moduleName: string, requestId: string, error: RCCError): void {
    try {
      const now = Date.now();

      // 过滤错误信息 (添加null检查防止filter未定义错误)
      const filteredError = this.filter ? this.filter.filterError(error).filtered : error;

      // 查找对应的记录并添加错误信息
      const moduleRecords = this.getModuleRecords(moduleName, requestId);
      if (moduleRecords.length > 0) {
        const lastRecord = moduleRecords[moduleRecords.length - 1];
        lastRecord.error = filteredError;
        lastRecord.endTime = now;
        lastRecord.endTimeReadable = this.formatReadableTime(now);
        lastRecord.duration = now - lastRecord.startTime;
      }

      // 更新会话错误计数
      for (const session of this.activeSessions.values()) {
        if (this.belongsToSession(requestId, session)) {
          session.errorCount++;
          break;
        }
      }

      // 收集模块错误事件
      const sessionId = this.findSessionIdByRequestId(requestId);
      this.collector.collectModuleEvent('module-error', moduleName, requestId, sessionId, { error: filteredError });

      this.emit('module-error-recorded', {
        moduleName,
        requestId,
        error: filteredError.message,
        timestamp: now,
      });
    } catch (recordError) {
      console.error(`记录模块错误失败 [${moduleName}]:`, recordError);
    }
  }

  /**
   * 保存完整记录
   */
  async saveRecord(record: DebugRecord): Promise<void> {
    try {
      // 过滤记录中的敏感数据 (添加null检查防止filter未定义错误)
      const filteredRecord = {
        ...record,
        request: this.filter ? this.filter.filterRequest(record.request).filtered : record.request,
        response: record.response ? (this.filter ? this.filter.filterResponse(record.response).filtered : record.response) : undefined,
        error: record.error ? (this.filter ? this.filter.filterError(record.error).filtered : record.error) : undefined,
        pipeline: {
          ...record.pipeline,
          modules: record.pipeline.modules.map(module => ({
            ...module,
            input: this.filter ? this.filter.filterModuleInput(module.input).filtered : module.input,
            output: this.filter ? this.filter.filterModuleOutput(module.output).filtered : module.output,
            error: module.error ? (this.filter ? this.filter.filterError(module.error).filtered : module.error) : undefined,
          })),
        },
      };

      // 使用存储管理器保存
      await this.storage.saveRecord(filteredRecord);

      this.emit('record-saved', {
        requestId: record.requestId,
        timestamp: Date.now(),
      });
    } catch (error) {
      throw new RecordError(record.requestId, `Failed to save record: ${error.message}`);
    }
  }

  /**
   * 加载记录
   */
  async loadRecord(requestId: string): Promise<DebugRecord> {
    try {
      // 使用存储管理器加载
      const record = await this.storage.loadRecord(requestId);

      this.emit('record-loaded', {
        requestId,
        timestamp: Date.now(),
      });

      return record;
    } catch (error) {
      throw new RecordError(requestId, `Failed to load record: ${error.message}`);
    }
  }

  /**
   * 查找记录
   */
  async findRecords(criteria: RecordSearchCriteria): Promise<DebugRecord[]> {
    try {
      // 使用存储管理器查找
      return await this.storage.findRecords(criteria);
    } catch (error) {
      console.error('查找记录失败:', error);
      return [];
    }
  }

  /**
   * 清理过期记录
   */
  async cleanupExpiredRecords(): Promise<void> {
    if (this.config.retentionDays <= 0) return;

    try {
      const cleanedCount = await this.storage.cleanupExpiredData(this.config.retentionDays);

      if (cleanedCount > 0) {
        this.emit('records-cleaned', {
          cleanedSessions: cleanedCount,
          timestamp: Date.now(),
        });
        console.log(`✅ 清理完成，删除了 ${cleanedCount} 个过期会话`);
      }
    } catch (error) {
      console.error('清理过期记录失败:', error);
    }
  }

  /**
   * 生成分析报告
   */
  async generateAnalysisReport(): Promise<AnalysisReport> {
    try {
      const sessions = Array.from(this.activeSessions.values());
      const allRecords = await this.getAllRecords();

      return await this.analyzer.generateReport(sessions, allRecords);
    } catch (error) {
      console.error('生成分析报告失败:', error);
      throw new Error(`Failed to generate analysis report: ${error.message}`);
    }
  }

  /**
   * 获取事件数据
   */
  async getEvents(): Promise<DebugEvent[]> {
    try {
      return await this.collector.flushEvents();
    } catch (error) {
      console.error('获取事件数据失败:', error);
      return [];
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      // 停止事件收集
      this.collector.stopAutoFlush();

      // 保存所有待处理记录
      await this.flushPendingRecords();

      // 清理数据结构
      this.pendingRecords.clear();
      this.moduleRecords.clear();
      this.activeSessions.clear();

      this.emit('recorder-cleanup', {
        timestamp: Date.now(),
      });

      console.log('📁 Debug记录器清理完成');
    } catch (error) {
      console.error('清理资源失败:', error);
    }
  }

  // ===== Private Helper Methods =====

  private setupEventForwarding(): void {
    // 转发存储模块事件
    this.storage.on('record-saved', event => this.emit('record-saved', event));
    this.storage.on('session-saved', event => this.emit('session-saved', event));
    this.storage.on('storage-error', event => this.emit('storage-error', event));

    // 转发收集器事件
    this.collector.on('events-flushed', event => this.emit('events-flushed', event));
    this.collector.on('buffer-overflow', event => this.emit('buffer-overflow', event));

    // 转发分析器事件（如果有的话）
    // this.analyzer.on('analysis-completed', (event) => this.emit('analysis-completed', event));
  }

  private createBaseRecord(requestId: string, data: any): Partial<DebugRecord> {
    const now = Date.now();
    return {
      requestId,
      timestamp: now,
      readableTime: this.formatReadableTime(now),
      port: data.port || 3120,
      sessionId: this.findCurrentSessionId(data.port || 3120),
      request: {
        method: data.method || 'POST',
        url: data.url || '/v1/chat/completions',
        headers: data.headers || {},
        body: data.body || data,
      },
    };
  }

  private addModuleRecord(moduleName: string, requestId: string, moduleRecord: Partial<ModuleRecord>): void {
    if (!this.moduleRecords.has(moduleName)) {
      this.moduleRecords.set(moduleName, new Map());
    }

    const moduleMap = this.moduleRecords.get(moduleName)!;
    if (!moduleMap.has(requestId)) {
      moduleMap.set(requestId, []);
    }

    moduleMap.get(requestId)!.push(moduleRecord as ModuleRecord);
  }

  private getModuleRecords(moduleName: string, requestId: string): ModuleRecord[] {
    return this.moduleRecords.get(moduleName)?.get(requestId) || [];
  }

  private findSessionIdByRequestId(requestId: string): string {
    const record = this.pendingRecords.get(requestId);
    return record?.sessionId || 'unknown-session';
  }

  private formatReadableTime(timestamp: number): string {
    const date = new Date(timestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('zh-CN', { timeZone: timezone })} ${timezone}`;
  }

  private findCurrentSessionId(port: number): string {
    // 查找当前端口的活跃会话
    for (const session of this.activeSessions.values()) {
      if (session.port === port) {
        return session.sessionId;
      }
    }
    return `unknown-session-${Date.now()}`;
  }

  private belongsToSession(requestId: string, session: DebugSession): boolean {
    // 根据端口和时间范围判断请求是否属于指定会话
    const record = this.pendingRecords.get(requestId);
    return record && record.port === session.port;
  }

  private isRecordComplete(record: Partial<DebugRecord>): boolean {
    return Boolean(record.requestId && record.request && record.response);
  }

  private async flushPendingRecords(): Promise<void> {
    for (const [requestId, record] of this.pendingRecords) {
      if (this.isRecordComplete(record)) {
        try {
          await this.saveRecord(record as DebugRecord);
        } catch (error) {
          console.error(`保存待处理记录失败 [${requestId}]:`, error);
        }
      }
    }
    this.pendingRecords.clear();
  }

  private async getAllRecords(): Promise<DebugRecord[]> {
    try {
      return await this.storage.findRecords({});
    } catch (error) {
      console.error('获取所有记录失败:', error);
      return [];
    }
  }
}
