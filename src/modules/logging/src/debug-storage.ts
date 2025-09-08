/**
 * Debug存储管理器
 *
 * 负责Debug数据的文件存储、检索和管理
 *
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { DebugRecord, DebugSession, DebugConfig } from './types/debug-types';
import { DebugSerializer } from './debug-serializer';
import { RCCError, RCCErrorCode } from '../../error-handler';
import {
  DEBUG_STORAGE_DIRS,
  DEBUG_FILE_PREFIXES,
  DEBUG_FILE_EXTENSIONS,
  DEBUG_METADATA_TYPES,
  DEBUG_EVENT_NAMES,
  DEBUG_OPERATIONS,
  DEBUG_ERROR_MESSAGES,
  DEBUG_TIMEZONE,
  DEBUG_VERSION
} from './constants';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

/**
 * 存储统计信息
 */
export interface StorageStatistics {
  totalSessions: number;
  totalRecords: number;
  totalSize: number;
  oldestRecord: number;
  newestRecord: number;
  compressionRatio: number;
}

/**
 * 存储选项
 */
export interface StorageOptions {
  enableCompression: boolean;
  createBackups: boolean;
  validateOnRead: boolean;
  autoCleanup: boolean;
}

/**
 * 搜索条件
 */
interface RecordSearchCriteria {
  sessionId?: string;
  port?: number;
  moduleName?: string;
  startTime?: number;
  endTime?: number;
  hasError?: boolean;
  limit?: number;
}

/**
 * Debug存储管理器接口
 */
export interface DebugStorage {
  saveRecord(record: DebugRecord): Promise<void>;
  loadRecord(requestId: string): Promise<DebugRecord>;
  saveSession(session: DebugSession): Promise<void>;
  loadSession(sessionId: string, port: number): Promise<DebugSession>;
  findRecords(criteria: RecordSearchCriteria): Promise<DebugRecord[]>;
  deleteRecord(requestId: string): Promise<void>;
  deleteSession(sessionId: string, port: number): Promise<void>;
  getStorageStatistics(): Promise<StorageStatistics>;
  cleanupExpiredData(retentionDays: number): Promise<number>;
  ensureDirectoryStructure(port: number, sessionId: string): Promise<void>;
  
  // 增强的日志保存功能
  saveStartupModuleOutput(moduleName: string, input: any, output: any, processingTime: number, errors?: string[]): Promise<void>;
  savePipelineRequest(port: number, sessionId: string, pipelineId: string, requestId: string, routeModel: string, input: any, layerInputs: any[]): Promise<void>;
  savePipelineResponse(port: number, sessionId: string, pipelineId: string, requestId: string, processingTime: number, response: any, layerOutputs: any[]): Promise<void>;
}

/**
 * Debug存储管理器实现
 */
export class DebugStorageImpl extends EventEmitter implements DebugStorage {
  private config: DebugConfig;
  private basePath: string;
  private serializer: DebugSerializer;
  private options: StorageOptions;

  constructor(config: DebugConfig, serializer: DebugSerializer) {
    super();
    this.config = config;
    this.basePath = this.expandHomePath(config.storageBasePath);
    this.serializer = serializer;
    this.options = {
      enableCompression: config.compressionEnabled,
      createBackups: false,
      validateOnRead: true,
      autoCleanup: true,
    };

    // 确保基础目录存在
    this.ensureDirectoryExists(this.basePath);
  }

  /**
   * 保存Debug记录
   */
  async saveRecord(record: DebugRecord): Promise<void> {
    try {
      const recordPath = this.getRequestPath(record.port, record.requestId);

      // 确保目录存在
      await this.ensureDirectoryExists(path.dirname(recordPath));

      // 序列化记录
      const serialized = await this.serializer.serializeRecord(record);

      // 检查文件大小
      if (serialized.originalSize > this.config.maxRecordSize) {
        throw new Error(`Record size exceeds limit: ${serialized.originalSize} > ${this.config.maxRecordSize}`);
      }

      // 写入文件
      await writeFile(recordPath, serialized.data);

      // 创建备份（如果启用）
      if (this.options.createBackups) {
        await this.createBackup(recordPath, serialized.data);
      }

      this.emit('record-saved', {
        requestId: record.requestId,
        path: recordPath,
        size: serialized.compressedSize,
        compressionRatio: serialized.compressionRatio,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'saveRecord',
        recordId: record.requestId,
        error: error.message,
      });
      throw new Error(`Failed to save record: ${error.message}`);
    }
  }

  /**
   * 加载Debug记录
   */
  async loadRecord(requestId: string): Promise<DebugRecord> {
    try {
      const recordPath = await this.findRecordPath(requestId);
      if (!recordPath) {
        throw new Error('Record not found');
      }

      const data = await readFile(recordPath);
      const deserialized = await this.serializer.deserializeRecord(data);

      // 验证记录（如果启用）
      if (this.options.validateOnRead && !this.serializer.validateDataIntegrity(deserialized.data)) {
        throw new Error('Record validation failed');
      }

      this.emit('record-loaded', {
        requestId,
        path: recordPath,
        wasCompressed: deserialized.metadata.wasCompressed,
        timestamp: Date.now(),
      });

      return deserialized.data;
    } catch (error) {
      this.emit('storage-error', {
        operation: 'loadRecord',
        recordId: requestId,
        error: error.message,
      });
      throw new Error(`Failed to load record: ${error.message}`);
    }
  }

  /**
   * 保存Debug会话
   */
  async saveSession(session: DebugSession): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(session.port, session.sessionId);
      const sessionFile = path.join(sessionPath, `session-${session.sessionId}.json`);

      // 确保目录存在
      await this.ensureDirectoryExists(sessionPath);
      await this.ensureDirectoryExists(path.join(sessionPath, 'requests'));
      await this.ensureDirectoryExists(path.join(sessionPath, 'pipelines'));
      await this.ensureDirectoryExists(path.join(sessionPath, 'startup'));

      // 序列化会话
      const serialized = await this.serializer.serializeSession(session);

      // 写入文件
      await writeFile(sessionFile, serialized.data);

      this.emit('session-saved', {
        sessionId: session.sessionId,
        path: sessionFile,
        size: serialized.compressedSize,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'saveSession',
        sessionId: session.sessionId,
        error: error.message,
      });
      throw new Error(`Failed to save session: ${error.message}`);
    }
  }

  /**
   * 加载Debug会话
   */
  async loadSession(sessionId: string, port: number): Promise<DebugSession> {
    try {
      const sessionPath = this.getSessionPath(port, sessionId);
      const sessionFile = path.join(sessionPath, `session-${sessionId}.json`);

      if (!fs.existsSync(sessionFile)) {
        throw new Error('Session not found');
      }

      const data = await readFile(sessionFile);
      const deserialized = await this.serializer.deserializeSession(data);

      this.emit('session-loaded', {
        sessionId,
        path: sessionFile,
        timestamp: Date.now(),
      });

      return deserialized.data;
    } catch (error) {
      this.emit('storage-error', {
        operation: 'loadSession',
        sessionId,
        error: error.message,
      });
      throw new Error(`Failed to load session: ${error.message}`);
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
      this.emit('storage-error', {
        operation: 'findRecords',
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 删除记录
   */
  async deleteRecord(requestId: string): Promise<void> {
    try {
      const recordPath = await this.findRecordPath(requestId);
      if (!recordPath) {
        throw new Error('Record not found');
      }

      await unlink(recordPath);

      // 删除备份（如果存在）
      const backupPath = recordPath + '.bak';
      if (fs.existsSync(backupPath)) {
        await unlink(backupPath);
      }

      this.emit('record-deleted', {
        requestId,
        path: recordPath,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'deleteRecord',
        recordId: requestId,
        error: error.message,
      });
      throw new Error(`Failed to delete record: ${error.message}`);
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, port: number): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(port, sessionId);

      if (!fs.existsSync(sessionPath)) {
        throw new Error('Session not found');
      }

      await this.removeDirectory(sessionPath);

      this.emit('session-deleted', {
        sessionId,
        port,
        path: sessionPath,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'deleteSession',
        sessionId,
        error: error.message,
      });
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStatistics(): Promise<StorageStatistics> {
    try {
      let totalSessions = 0;
      let totalRecords = 0;
      let totalSize = 0;
      let oldestRecord = Date.now();
      let newestRecord = 0;
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;

      const ports = await this.getPortDirectories();

      for (const port of ports) {
        const portPath = path.join(this.basePath, `port-${port}`);
        const sessions = await readdir(portPath);

        for (const sessionDir of sessions) {
          if (!sessionDir.startsWith('session-')) continue;

          totalSessions++;

          const requestsPath = path.join(portPath, sessionDir, 'requests');
          if (fs.existsSync(requestsPath)) {
            const files = await readdir(requestsPath);

            for (const file of files) {
              if (!file.startsWith('req_') || !file.endsWith('.json')) continue;

              totalRecords++;

              const filePath = path.join(requestsPath, file);
              const fileStat = await stat(filePath);
              totalSize += fileStat.size;

              // 更新时间范围
              if (fileStat.mtime.getTime() < oldestRecord) {
                oldestRecord = fileStat.mtime.getTime();
              }
              if (fileStat.mtime.getTime() > newestRecord) {
                newestRecord = fileStat.mtime.getTime();
              }

              // 计算压缩比（如果可能）
              try {
                const data = await readFile(filePath);
                const deserialized = await this.serializer.deserializeRecord(data);
                totalOriginalSize += deserialized.metadata.originalSize;
                totalCompressedSize += fileStat.size;
              } catch {
                // 忽略错误，使用文件大小作为原始大小
                totalOriginalSize += fileStat.size;
                totalCompressedSize += fileStat.size;
              }
            }
          }
        }
      }

      const compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;

      return {
        totalSessions,
        totalRecords,
        totalSize,
        oldestRecord: totalRecords > 0 ? oldestRecord : 0,
        newestRecord: totalRecords > 0 ? newestRecord : 0,
        compressionRatio,
      };
    } catch (error) {
      this.emit('storage-error', {
        operation: 'getStorageStatistics',
        error: error.message,
      });

      return {
        totalSessions: 0,
        totalRecords: 0,
        totalSize: 0,
        oldestRecord: 0,
        newestRecord: 0,
        compressionRatio: 1,
      };
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(retentionDays: number): Promise<number> {
    if (retentionDays <= 0) return 0;

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
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

            this.emit('session-cleaned', {
              sessionId: sessionDir,
              port,
              path: sessionPath,
              timestamp: Date.now(),
            });
          }
        }
      }

      this.emit('cleanup-completed', {
        cleanedSessions: cleanedCount,
        cutoffTime,
        timestamp: Date.now(),
      });

      return cleanedCount;
    } catch (error) {
      this.emit('storage-error', {
        operation: 'cleanupExpiredData',
        error: error.message,
      });
      throw new Error(`Failed to cleanup expired data: ${error.message}`);
    }
  }

  /**
   * 确保目录结构存在
   */
  async ensureDirectoryStructure(port: number, sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(port, sessionId);

    await this.ensureDirectoryExists(sessionPath);
    await this.ensureDirectoryExists(path.join(sessionPath, 'requests'));
    await this.ensureDirectoryExists(path.join(sessionPath, 'pipelines'));
    await this.ensureDirectoryExists(path.join(sessionPath, 'startup'));

    // 更新当前会话链接
    this.updateCurrentSessionLink(port, sessionId);
  }

  // ===== Private Helper Methods =====

  private expandHomePath(filepath: string): string {
    if (filepath.startsWith('~/')) {
      return path.join(os.homedir(), filepath.slice(2));
    }
    return filepath;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private getSessionPath(port: number, sessionId: string): string {
    return path.join(this.basePath, `port-${port}`, sessionId);
  }

  private getRequestPath(port: number, requestId: string): string {
    return path.join(this.basePath, `port-${port}`, 'requests', `req_${requestId}.json`);
  }

  private getPipelineRequestPath(port: number, sessionId: string, pipelineId: string, requestId: string): string {
    return path.join(this.basePath, `port-${port}`, sessionId, 'pipelines', `pipeline-request-${pipelineId}-${requestId}.json`);
  }

  private getPipelineResponsePath(port: number, sessionId: string, pipelineId: string, requestId: string): string {
    return path.join(this.basePath, `port-${port}`, sessionId, 'pipelines', `pipeline-response-${pipelineId}-${requestId}.json`);
  }

  private async createBackup(originalPath: string, data: string | Buffer): Promise<void> {
    const backupPath = originalPath + '.bak';
    await writeFile(backupPath, data);
  }

  private async findRecordPath(requestId: string): Promise<string | null> {
    try {
      const ports = await this.getPortDirectories();

      for (const port of ports) {
        const recordPath = this.getRequestPath(port, requestId);
        if (fs.existsSync(recordPath)) {
          return recordPath;
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
      
      if (!files || files.length === 0) {
        return records;
      }

      for (const file of files) {
        if (!file.startsWith('req_') || !file.endsWith('.json')) continue;

        const filePath = path.join(dirPath, file);
        const record = await this.loadRecord(file.replace('req_', '').replace('.json', ''));

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

  /**
   * 保存启动阶段模块输出到独立文件
   * @param moduleName 模块名称
   * @param input 输入数据
   * @param output 输出数据
   * @param processingTime 处理时间
   * @param errors 错误列表（可选）
   */
  async saveStartupModuleOutput(moduleName: string, input: any, output: any, processingTime: number, errors?: string[]): Promise<void> {
    try {
      // 确保startup目录存在
      const startupDir = path.join(this.basePath, 'startup');
      await this.ensureDirectoryExists(startupDir);

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${moduleName.toLowerCase()}-result-${timestamp}.json`;
      const filepath = path.join(startupDir, filename);

      // 创建日志数据
      const logData = {
        timestamp: new Date().toISOString(),
        module: moduleName,
        input,
        output,
        processingTime,
        errors: errors || []
      };

      // 写入文件
      await writeFile(filepath, JSON.stringify(logData, null, 2));

      this.emit('startup-module-saved', {
        moduleName,
        path: filepath,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'saveStartupModuleOutput',
        moduleName,
        error: error.message,
      });
      // 使用RCCError处理错误
      const rccError = new RCCError(
        `Failed to save startup module output for ${moduleName}`, 
        RCCErrorCode.UNKNOWN_ERROR,
        'debug-storage'
      );
      throw rccError;
    }
  }

  /**
   * 保存执行阶段流水线请求到会话目录
   * @param port 监听端口
   * @param sessionId 会话ID
   * @param pipelineId 流水线ID
   * @param requestId 请求ID
   * @param routeModel 路由模型
   * @param input 输入数据
   * @param layerInputs 各层输入数据
   */
  async savePipelineRequest(port: number, sessionId: string, pipelineId: string, requestId: string, routeModel: string, input: any, layerInputs: any[]): Promise<void> {
    try {
      // 确保会话目录和pipelines子目录存在
      const sessionPath = this.getSessionPath(port, sessionId);
      const pipelinesDir = path.join(sessionPath, 'pipelines');
      await this.ensureDirectoryExists(pipelinesDir);

      // 生成文件路径
      const filepath = this.getPipelineRequestPath(port, sessionId, pipelineId, requestId);

      // 创建日志数据
      const logData = {
        timestamp: new Date().toISOString(),
        pipelineId,
        requestId,
        routeModel,
        input,
        layerInputs
      };

      // 写入文件
      await writeFile(filepath, JSON.stringify(logData, null, 2));

      this.emit('pipeline-request-saved', {
        pipelineId,
        requestId,
        path: filepath,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'savePipelineRequest',
        pipelineId,
        requestId,
        error: error.message,
      });
      // 使用RCCError处理错误
      const rccError = new RCCError(
        `Failed to save pipeline request for pipeline ${pipelineId}, request ${requestId}`, 
        RCCErrorCode.UNKNOWN_ERROR,
        'debug-storage'
      );
      throw rccError;
    }
  }

  /**
   * 保存执行阶段流水线响应到会话目录
   * @param port 监听端口
   * @param sessionId 会话ID
   * @param pipelineId 流水线ID
   * @param requestId 请求ID
   * @param processingTime 处理时间
   * @param response 响应数据
   * @param layerOutputs 各层输出数据
   */
  async savePipelineResponse(port: number, sessionId: string, pipelineId: string, requestId: string, processingTime: number, response: any, layerOutputs: any[]): Promise<void> {
    try {
      // 确保会话目录和pipelines子目录存在
      const sessionPath = this.getSessionPath(port, sessionId);
      const pipelinesDir = path.join(sessionPath, 'pipelines');
      await this.ensureDirectoryExists(pipelinesDir);

      // 生成文件路径
      const filepath = this.getPipelineResponsePath(port, sessionId, pipelineId, requestId);

      // 创建日志数据
      const logData = {
        timestamp: new Date().toISOString(),
        pipelineId,
        requestId,
        processingTime,
        response,
        layerOutputs
      };

      // 写入文件
      await writeFile(filepath, JSON.stringify(logData, null, 2));

      this.emit('pipeline-response-saved', {
        pipelineId,
        requestId,
        path: filepath,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.emit('storage-error', {
        operation: 'savePipelineResponse',
        pipelineId,
        requestId,
        error: error.message,
      });
      // 使用RCCError处理错误
      const rccError = new RCCError(
        `Failed to save pipeline response for pipeline ${pipelineId}, request ${requestId}`, 
        RCCErrorCode.UNKNOWN_ERROR,
        'debug-storage'
      );
      throw rccError;
    }
  }
}
