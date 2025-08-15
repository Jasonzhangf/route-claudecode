/**
 * 调试管理器实现
 * 
 * 提供调试会话管理、数据清理和导入导出功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { 
  IDebugManager,
  DebugSession,
  DebugConfig,
  DebugRecord,
  RecordType
} from '../interfaces/core/debug-interface';

/**
 * 调试管理器实现类
 */
export class DebugManager extends EventEmitter implements IDebugManager {
  private config: DebugConfig;
  private sessions: Map<string, DebugSession> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: DebugConfig) {
    super();
    this.config = config;
    
    if (config.autoCleanup) {
      this.setupAutoCleanup();
    }
  }

  /**
   * 创建Debug会话
   */
  async createSession(port: number): Promise<DebugSession> {
    const sessionId = this.generateSessionId();
    const sessionDir = join(this.config.storageDir, sessionId);

    // 创建会话存储目录
    await fs.mkdir(sessionDir, { recursive: true });

    const session: DebugSession = {
      id: sessionId,
      port,
      startTime: new Date(),
      recordCount: 0,
      requestCount: 0,
      errorCount: 0,
      storageDir: sessionDir,
      isActive: true
    };

    this.sessions.set(sessionId, session);

    // 创建会话元数据文件
    await this.saveSessionMetadata(session);

    this.emit('session-created', session);
    return session;
  }

  /**
   * 关闭Debug会话
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.isActive) {
      return;
    }

    // 更新会话状态
    const updatedSession: DebugSession = {
      ...session,
      endTime: new Date(),
      isActive: false
    };

    this.sessions.set(sessionId, updatedSession);

    // 保存最终的会话元数据
    await this.saveSessionMetadata(updatedSession);

    this.emit('session-closed', sessionId);
  }

  /**
   * 获取Debug会话
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * 获取所有会话（包括已关闭的）
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 更新会话统计
   */
  async updateSessionStats(sessionId: string, stats: {
    recordCount?: number;
    requestCount?: number;
    errorCount?: number;
  }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const updatedSession: DebugSession = {
      ...session,
      recordCount: stats.recordCount ?? session.recordCount,
      requestCount: stats.requestCount ?? session.requestCount,
      errorCount: stats.errorCount ?? session.errorCount
    };

    this.sessions.set(sessionId, updatedSession);
    await this.saveSessionMetadata(updatedSession);
  }

  /**
   * 清理过期数据
   */
  async cleanup(olderThanDays: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let removedRecords = 0;

    // 获取所有会话目录
    const storageDir = this.config.storageDir;
    
    try {
      const entries = await fs.readdir(storageDir, { withFileTypes: true });
      const sessionDirs = entries.filter(entry => entry.isDirectory());

      for (const sessionDir of sessionDirs) {
        const sessionPath = join(storageDir, sessionDir.name);
        
        try {
          // 检查会话是否过期
          const sessionExpired = await this.isSessionExpired(sessionPath, cutoffTime);
          
          if (sessionExpired) {
            // 计算被删除的记录数
            const recordCount = await this.countSessionRecords(sessionPath);
            removedRecords += recordCount;

            // 删除整个会话目录
            await fs.rm(sessionPath, { recursive: true, force: true });

            // 从内存中移除会话
            this.sessions.delete(sessionDir.name);

            console.log(`Cleaned up expired session: ${sessionDir.name}`);
          } else {
            // 清理会话内的过期记录
            const sessionRecordsRemoved = await this.cleanupSessionRecords(sessionPath, cutoffTime);
            removedRecords += sessionRecordsRemoved;
          }
        } catch (error) {
          console.error(`Error cleaning up session ${sessionDir.name}:`, error);
        }
      }

      this.emit('cleanup-completed', removedRecords);
      return removedRecords;
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * 导出会话数据
   */
  async exportSession(sessionId: string, format: 'json' | 'zip'): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `session-export-${sessionId}-${timestamp}`;

    switch (format) {
      case 'json':
        return this.exportSessionAsJson(session, baseFileName);
      case 'zip':
        return this.exportSessionAsZip(session, baseFileName);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 导入会话数据
   */
  async importSession(filePath: string): Promise<DebugSession> {
    const resolvedPath = resolve(filePath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error(`Path ${filePath} is not a file`);
      }

      // 根据文件扩展名确定导入方式
      if (filePath.endsWith('.json')) {
        return this.importSessionFromJson(resolvedPath);
      } else if (filePath.endsWith('.zip')) {
        return this.importSessionFromZip(resolvedPath);
      } else {
        throw new Error(`Unsupported import file format: ${filePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to import session from ${filePath}: ${error}`);
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStatistics(sessionId: string): Promise<{
    session: DebugSession;
    recordsByType: Record<RecordType, number>;
    recordsByHour: Array<{ hour: string; count: number }>;
    errorsByType: Record<string, number>;
    performanceMetrics: {
      averageResponseTime: number;
      p95ResponseTime: number;
      throughput: number;
    };
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 这里应该从存储中读取实际数据，现在返回模拟数据
    return {
      session,
      recordsByType: {
        [RecordType.REQUEST]: 150,
        [RecordType.RESPONSE]: 140,
        [RecordType.PIPELINE]: 280,
        [RecordType.ERROR]: 10,
        [RecordType.PERFORMANCE]: 150,
        [RecordType.SYSTEM]: 50
      },
      recordsByHour: [
        { hour: '2025-01-01T10:00:00Z', count: 45 },
        { hour: '2025-01-01T11:00:00Z', count: 52 },
        { hour: '2025-01-01T12:00:00Z', count: 38 }
      ],
      errorsByType: {
        'ValidationError': 5,
        'NetworkError': 3,
        'TimeoutError': 2
      },
      performanceMetrics: {
        averageResponseTime: 145.6,
        p95ResponseTime: 289.3,
        throughput: 12.5
      }
    };
  }

  /**
   * 保存会话元数据
   */
  private async saveSessionMetadata(session: DebugSession): Promise<void> {
    const metadataPath = join(session.storageDir, 'session.json');
    const metadata = {
      ...session,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * 检查会话是否已过期
   */
  private async isSessionExpired(sessionPath: string, cutoffTime: Date): Promise<boolean> {
    try {
      const metadataPath = join(sessionPath, 'session.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      const sessionEndTime = metadata.endTime ? new Date(metadata.endTime) : new Date(metadata.startTime);
      return sessionEndTime < cutoffTime;
    } catch (error) {
      // 如果无法读取元数据，检查目录修改时间
      const stats = await fs.stat(sessionPath);
      return stats.mtime < cutoffTime;
    }
  }

  /**
   * 统计会话记录数量
   */
  private async countSessionRecords(sessionPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(sessionPath, { withFileTypes: true });
      const recordFiles = entries.filter(entry => 
        entry.isFile() && 
        (entry.name.endsWith('.json') && entry.name !== 'session.json')
      );
      return recordFiles.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 清理会话内的过期记录
   */
  private async cleanupSessionRecords(sessionPath: string, cutoffTime: Date): Promise<number> {
    let removedCount = 0;

    try {
      const entries = await fs.readdir(sessionPath, { withFileTypes: true });
      const recordFiles = entries.filter(entry => 
        entry.isFile() && 
        entry.name.endsWith('.json') && 
        entry.name !== 'session.json'
      );

      for (const file of recordFiles) {
        const filePath = join(sessionPath, file.name);
        
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime < cutoffTime) {
            await fs.unlink(filePath);
            removedCount++;
          }
        } catch (error) {
          console.error(`Error cleaning up record file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up session records in ${sessionPath}:`, error);
    }

    return removedCount;
  }

  /**
   * 导出会话为JSON格式
   */
  private async exportSessionAsJson(session: DebugSession, baseFileName: string): Promise<string> {
    const exportPath = `${baseFileName}.json`;
    
    // 收集会话所有数据
    const sessionData = await this.collectSessionData(session);
    
    await fs.writeFile(exportPath, JSON.stringify(sessionData, null, 2));
    return exportPath;
  }

  /**
   * 导出会话为ZIP格式
   */
  private async exportSessionAsZip(session: DebugSession, baseFileName: string): Promise<string> {
    const exportPath = `${baseFileName}.zip`;
    
    // 创建gzip压缩的tar文件（简化实现）
    const sessionDataPath = `${baseFileName}-data.json`;
    const sessionData = await this.collectSessionData(session);
    await fs.writeFile(sessionDataPath, JSON.stringify(sessionData, null, 2));

    // 压缩文件
    const readStream = createReadStream(sessionDataPath);
    const writeStream = createWriteStream(exportPath);
    const gzipStream = createGzip();

    await pipeline(readStream, gzipStream, writeStream);

    // 清理临时文件
    await fs.unlink(sessionDataPath);

    return exportPath;
  }

  /**
   * 从JSON文件导入会话
   */
  private async importSessionFromJson(filePath: string): Promise<DebugSession> {
    const content = await fs.readFile(filePath, 'utf-8');
    const sessionData = JSON.parse(content);
    
    return this.restoreSessionData(sessionData);
  }

  /**
   * 从ZIP文件导入会话
   */
  private async importSessionFromZip(filePath: string): Promise<DebugSession> {
    const tempPath = `${filePath}.temp.json`;
    
    // 解压文件
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(tempPath);
    const gunzipStream = createGunzip();

    await pipeline(readStream, gunzipStream, writeStream);

    try {
      const session = await this.importSessionFromJson(tempPath);
      await fs.unlink(tempPath); // 清理临时文件
      return session;
    } catch (error) {
      await fs.unlink(tempPath); // 确保清理临时文件
      throw error;
    }
  }

  /**
   * 收集会话数据
   */
  private async collectSessionData(session: DebugSession): Promise<any> {
    const records: DebugRecord[] = [];
    
    try {
      const entries = await fs.readdir(session.storageDir, { withFileTypes: true });
      const recordFiles = entries.filter(entry => 
        entry.isFile() && 
        entry.name.endsWith('.json') && 
        entry.name !== 'session.json'
      );

      for (const file of recordFiles) {
        try {
          const filePath = join(session.storageDir, file.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const record = JSON.parse(content);
          records.push(record);
        } catch (error) {
          console.error(`Error reading record file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error collecting session data for ${session.id}:`, error);
    }

    return {
      session,
      records,
      exportTime: new Date().toISOString(),
      version: '4.0.0-alpha.1'
    };
  }

  /**
   * 恢复会话数据
   */
  private async restoreSessionData(sessionData: any): Promise<DebugSession> {
    const { session, records } = sessionData;
    
    // 创建新的会话ID以避免冲突
    const newSessionId = this.generateSessionId();
    const newSession: DebugSession = {
      ...session,
      id: newSessionId,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      storageDir: join(this.config.storageDir, newSessionId),
      isActive: false // 导入的会话默认为非活跃状态
    };

    // 创建会话目录
    await fs.mkdir(newSession.storageDir, { recursive: true });

    // 恢复记录文件
    for (const record of records) {
      const recordPath = join(newSession.storageDir, `${record.type}_${record.id}.json`);
      await fs.writeFile(recordPath, JSON.stringify(record, null, 2));
    }

    // 保存会话元数据
    await this.saveSessionMetadata(newSession);

    // 添加到内存中
    this.sessions.set(newSessionId, newSession);

    this.emit('session-imported', newSession);
    return newSession;
  }

  /**
   * 设置自动清理
   */
  private setupAutoCleanup(): void {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时

    this.cleanupTimer = setInterval(async () => {
      try {
        const removedCount = await this.cleanup(this.config.cleanupDays);
        console.log(`Auto cleanup completed: ${removedCount} records removed`);
      } catch (error) {
        console.error('Auto cleanup failed:', error);
        this.emit('error', error);
      }
    }, cleanupInterval);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.sessions.clear();
    this.removeAllListeners();
  }
}