/**
 * Debug记录器
 * 
 * 负责Debug数据的存储、检索和管理
 * 
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { DebugRecord, DebugSession, ModuleRecord, DebugConfig } from './types/debug-types';
import { RCCError } from '../types/error';
import { Pipeline } from '../pipeline/types';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

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
  private basePath: string;
  private activeSessions: Map<string, DebugSession> = new Map();
  private pendingRecords: Map<string, Partial<DebugRecord>> = new Map();
  private moduleRecords: Map<string, Map<string, ModuleRecord[]>> = new Map(); // moduleName -> requestId -> records

  constructor(config: DebugConfig) {
    super();
    this.config = config;
    this.basePath = this.expandHomePath(config.storageBasePath);
    
    // 确保存储目录存在
    this.ensureDirectoryExists(this.basePath);
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    this.activeSessions.set(actualSessionId, session);

    // 创建会话目录
    const sessionPath = this.getSessionPath(port, actualSessionId);
    this.ensureDirectoryExists(sessionPath);
    this.ensureDirectoryExists(path.join(sessionPath, 'requests'));
    this.ensureDirectoryExists(path.join(sessionPath, 'pipelines'));

    // 保存会话信息
    this.saveSessionInfo(session);

    // 更新当前活跃会话软链接
    this.updateCurrentSessionLink(port, actualSessionId);

    this.emit('session-created', {
      sessionId: actualSessionId,
      port,
      timestamp: now
    });

    console.log(`📁 Debug会话目录已创建: ${sessionPath}`);
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
      // 保存最终会话信息
      await this.saveSessionInfo(session);
      
      // 生成会话摘要
      await this.generateSessionSummary(session);
      
      this.activeSessions.delete(sessionId);

      this.emit('session-ended', {
        sessionId,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        timestamp: now
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
      // 获取或创建记录
      let record = this.pendingRecords.get(requestId);
      if (!record) {
        record = this.createBaseRecord(requestId, data);
        this.pendingRecords.set(requestId, record);
      }

      // 更新流水线信息
      record.pipeline = {
        id: pipeline.id,
        provider: data.provider || 'unknown',
        model: data.model || 'unknown',
        modules: []
      };

      this.emit('pipeline-recorded', {
        requestId,
        pipelineId: pipeline.id,
        timestamp: Date.now()
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
      const moduleRecord: Partial<ModuleRecord> = {
        moduleName,
        startTime: now,
        startTimeReadable: this.formatReadableTime(now),
        input,
        metadata: {
          version: '4.0.0',
          config: this.config.modules[moduleName] || {}
        }
      };

      this.addModuleRecord(moduleName, requestId, moduleRecord);

      this.emit('module-input-recorded', {
        moduleName,
        requestId,
        timestamp: now,
        dataSize: JSON.stringify(input).length
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
      
      // 查找对应的输入记录并更新
      const moduleRecords = this.getModuleRecords(moduleName, requestId);
      if (moduleRecords.length > 0) {
        const lastRecord = moduleRecords[moduleRecords.length - 1];
        lastRecord.output = output;
        lastRecord.endTime = now;
        lastRecord.endTimeReadable = this.formatReadableTime(now);
        lastRecord.duration = now - lastRecord.startTime;
      }

      this.emit('module-output-recorded', {
        moduleName,
        requestId,
        timestamp: now,
        dataSize: JSON.stringify(output).length
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
      
      // 查找对应的记录并添加错误信息
      const moduleRecords = this.getModuleRecords(moduleName, requestId);
      if (moduleRecords.length > 0) {
        const lastRecord = moduleRecords[moduleRecords.length - 1];
        lastRecord.error = error;
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

      this.emit('module-error-recorded', {
        moduleName,
        requestId,
        error: error.message,
        timestamp: now
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
      const sessionPath = this.findSessionPathByRecord(record);
      const recordPath = path.join(sessionPath, 'requests', `req_${record.requestId}.json`);
      
      // 检查文件大小
      const recordData = JSON.stringify(record, null, 2);
      if (recordData.length > this.config.maxRecordSize) {
        throw new RecordError(record.requestId, `Record size exceeds limit: ${recordData.length} > ${this.config.maxRecordSize}`);
      }

      await writeFile(recordPath, recordData);

      this.emit('record-saved', {
        requestId: record.requestId,
        path: recordPath,
        size: recordData.length,
        timestamp: Date.now()
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
      // 在所有会话中搜索记录
      const recordPath = await this.findRecordPath(requestId);
      if (!recordPath) {
        throw new RecordError(requestId, 'Record not found');
      }

      const data = await readFile(recordPath, 'utf-8');
      const record = JSON.parse(data) as DebugRecord;

      this.emit('record-loaded', {
        requestId,
        path: recordPath,
        timestamp: Date.now()
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
    const results: DebugRecord[] = [];

    try {
      const searchPaths = await this.getSearchPaths(criteria);
      
      for (const searchPath of searchPaths) {
        const records = await this.scanRecordsInPath(searchPath, criteria);
        results.push(...records);
      }

      // 按时间排序并限制数量
      results.sort((a, b) => b.timestamp - a.timestamp);
      
      if (criteria.limit && results.length > criteria.limit) {
        return results.slice(0, criteria.limit);
      }

      return results;

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

    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    try {
      const ports = await this.getPortDirectories();
      
      for (const port of ports) {
        const portPath = path.join(this.basePath, `port-${port}`);
        const sessions = await readdir(portPath);

        for (const sessionDir of sessions) {
          if (!sessionDir.startsWith('session-')) continue;

          const sessionPath = path.join(portPath, sessionDir);
          const sessionStat = await stat(sessionPath);

          if (sessionStat.mtime.getTime() < cutoffTime) {
            await this.removeDirectory(sessionPath);
            cleanedCount++;
            console.log(`🗑️ 已清理过期会话: ${sessionDir}`);
          }
        }
      }

      if (cleanedCount > 0) {
        this.emit('records-cleaned', {
          cleanedSessions: cleanedCount,
          timestamp: Date.now()
        });
        console.log(`✅ 清理完成，删除了 ${cleanedCount} 个过期会话`);
      }

    } catch (error) {
      console.error('清理过期记录失败:', error);
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 保存所有待处理记录
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
    this.moduleRecords.clear();
    this.activeSessions.clear();

    this.emit('recorder-cleanup', {
      timestamp: Date.now()
    });

    console.log('📁 Debug记录器清理完成');
  }

  // ===== Private Helper Methods =====

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
        body: data.body || data
      }
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

  private formatReadableTime(timestamp: number): string {
    const date = new Date(timestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('zh-CN', { timeZone: timezone })} ${timezone}`;
  }

  private expandHomePath(filepath: string): string {
    if (filepath.startsWith('~/')) {
      return path.join(os.homedir(), filepath.slice(2));
    }
    return filepath;
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private getSessionPath(port: number, sessionId: string): string {
    return path.join(this.basePath, `port-${port}`, sessionId);
  }

  private async saveSessionInfo(session: DebugSession): Promise<void> {
    const sessionPath = this.getSessionPath(session.port, session.sessionId);
    const sessionFile = path.join(sessionPath, 'session.json');
    
    await writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  private updateCurrentSessionLink(port: number, sessionId: string): void {
    const currentDir = path.join(this.basePath, 'current');
    this.ensureDirectoryExists(currentDir);

    const linkPath = path.join(currentDir, `port-${port}`);
    const targetPath = path.join('..', `port-${port}`, sessionId);

    // 删除旧链接
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }

    // 创建新的符号链接
    try {
      fs.symlinkSync(targetPath, linkPath);
    } catch (error) {
      // 在不支持符号链接的系统上静默失败
      console.warn(`无法创建符号链接: ${error.message}`);
    }
  }

  private async generateSessionSummary(session: DebugSession): Promise<void> {
    const sessionPath = this.getSessionPath(session.port, session.sessionId);
    const summaryPath = path.join(sessionPath, 'summary.json');

    // 收集会话统计信息
    const summary = {
      session: {
        id: session.sessionId,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount
      },
      statistics: {
        // 这里可以添加更详细的统计信息
        totalRequests: session.requestCount,
        totalErrors: session.errorCount,
        successRate: session.requestCount > 0 ? ((session.requestCount - session.errorCount) / session.requestCount) * 100 : 0
      }
    };

    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  private findSessionPathByRecord(record: DebugRecord): string {
    return this.getSessionPath(record.port, record.sessionId);
  }

  private async findRecordPath(requestId: string): Promise<string | null> {
    // 简化实现：在所有会话中搜索
    try {
      const ports = await this.getPortDirectories();
      
      for (const port of ports) {
        const portPath = path.join(this.basePath, `port-${port}`);
        const sessions = await readdir(portPath);

        for (const sessionDir of sessions) {
          const requestsPath = path.join(portPath, sessionDir, 'requests');
          if (fs.existsSync(requestsPath)) {
            const recordPath = path.join(requestsPath, `req_${requestId}.json`);
            if (fs.existsSync(recordPath)) {
              return recordPath;
            }
          }
        }
      }
    } catch (error) {
      console.error('查找记录路径失败:', error);
    }

    return null;
  }

  private async getPortDirectories(): Promise<number[]> {
    if (!fs.existsSync(this.basePath)) return [];

    const entries = await readdir(this.basePath);
    return entries
      .filter(entry => entry.startsWith('port-'))
      .map(entry => parseInt(entry.replace('port-', '')))
      .filter(port => !isNaN(port));
  }

  private async getSearchPaths(criteria: RecordSearchCriteria): Promise<string[]> {
    const paths: string[] = [];

    if (criteria.port) {
      const portPath = path.join(this.basePath, `port-${criteria.port}`);
      if (fs.existsSync(portPath)) {
        if (criteria.sessionId) {
          const sessionPath = path.join(portPath, criteria.sessionId, 'requests');
          if (fs.existsSync(sessionPath)) {
            paths.push(sessionPath);
          }
        } else {
          const sessions = await readdir(portPath);
          for (const session of sessions) {
            const requestsPath = path.join(portPath, session, 'requests');
            if (fs.existsSync(requestsPath)) {
              paths.push(requestsPath);
            }
          }
        }
      }
    } else {
      // 搜索所有端口
      const ports = await this.getPortDirectories();
      for (const port of ports) {
        const portPath = path.join(this.basePath, `port-${port}`);
        const sessions = await readdir(portPath);
        for (const session of sessions) {
          const requestsPath = path.join(portPath, session, 'requests');
          if (fs.existsSync(requestsPath)) {
            paths.push(requestsPath);
          }
        }
      }
    }

    return paths;
  }

  private async scanRecordsInPath(dirPath: string, criteria: RecordSearchCriteria): Promise<DebugRecord[]> {
    const records: DebugRecord[] = [];

    try {
      const files = await readdir(dirPath);
      
      for (const file of files) {
        if (!file.startsWith('req_') || !file.endsWith('.json')) continue;

        const filePath = path.join(dirPath, file);
        const data = await readFile(filePath, 'utf-8');
        const record = JSON.parse(data) as DebugRecord;

        if (this.matchesCriteria(record, criteria)) {
          records.push(record);
        }
      }
    } catch (error) {
      console.error(`扫描记录失败 [${dirPath}]:`, error);
    }

    return records;
  }

  private matchesCriteria(record: DebugRecord, criteria: RecordSearchCriteria): boolean {
    if (criteria.startTime && record.timestamp < criteria.startTime) return false;
    if (criteria.endTime && record.timestamp > criteria.endTime) return false;
    if (criteria.hasError !== undefined && Boolean(record.error) !== criteria.hasError) return false;
    if (criteria.moduleName) {
      const hasModule = record.pipeline?.modules?.some(m => m.moduleName === criteria.moduleName);
      if (!hasModule) return false;
    }
    return true;
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const entryStat = await stat(entryPath);
      
      if (entryStat.isDirectory()) {
        await this.removeDirectory(entryPath);
      } else {
        await unlink(entryPath);
      }
    }
    
    fs.rmdirSync(dirPath);
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
    // 简化实现：根据时间判断
    const record = this.pendingRecords.get(requestId);
    return record && record.port === session.port;
  }

  private isRecordComplete(record: Partial<DebugRecord>): boolean {
    return Boolean(record.requestId && record.request && record.response);
  }
}