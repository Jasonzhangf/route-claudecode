/**
 * Request Lifecycle Logger with Individual Request Tracking
 * 按request单独文件记录全流程，支持时间分块和图形界面解析
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface RequestLifecycle {
  requestId: string;
  port: number;
  startTime: string;
  endTime?: string;
  responseTime?: number;
  provider: string;
  model: string;
  status: 'started' | 'completed' | 'failed';
  finishReason?: string;
  stages: RequestStage[];
}

interface RequestStage {
  stage: string;
  timestamp: string;
  beijingTimestamp: string;
  data?: any;
  duration?: number;
}

interface TimeBasedConfig {
  port: number;
  logDir?: string;
  timeBlockSize?: number; // minutes, default 5
  maxRetentionDays?: number;
}

export class RequestLifecycleLogger {
  private config: Required<TimeBasedConfig>;
  private baseLogDir: string;
  private portLogDir: string;
  private timeBlockSizeMs: number;
  private requestFiles: Map<string, fs.FileHandle> = new Map();
  private nodeResponseFiles: Map<string, fs.FileHandle> = new Map();
  private systemLogFile: fs.FileHandle | null = null;
  private stopReasonLogFile: fs.FileHandle | null = null;

  constructor(config: TimeBasedConfig) {
    this.config = {
      port: config.port,
      logDir: config.logDir || path.join(os.homedir(), '.route-claude-code', 'request-lifecycle-logs'),
      timeBlockSize: config.timeBlockSize || 5,
      maxRetentionDays: config.maxRetentionDays || 7
    };

    this.baseLogDir = this.config.logDir;
    this.portLogDir = path.join(this.baseLogDir, `port-${this.config.port}`);
    this.timeBlockSizeMs = this.config.timeBlockSize * 60 * 1000;

    this.initialize().catch(error => {
      console.error('Failed to initialize request lifecycle logger:', error);
    });
  }

  private async initialize(): Promise<void> {
    try {
      // Create base directories
      await fs.mkdir(this.baseLogDir, { recursive: true });
      await fs.mkdir(this.portLogDir, { recursive: true });
      
      // Initialize log files
      await this.initializeSystemLogFile();
      await this.initializeStopReasonLogFile();
      
      // 使用统一日志系统而不是直接console输出
      // console.log('Request lifecycle logger initialized');
    } catch (error) {
      console.error('Failed to initialize request lifecycle logger:', error);
    }
  }

  private getBeijingTimestamp(): string {
    const now = new Date();
    const beijingOffset = 8 * 60 * 60 * 1000;
    const beijingTime = new Date(now.getTime() + beijingOffset);
    
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  private getTimeBlockDirectory(timestamp?: string): string {
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeBlockMs = Math.floor(time.getTime() / this.timeBlockSizeMs) * this.timeBlockSizeMs;
    const timeBlockTime = new Date(timeBlockMs);
    
    const year = timeBlockTime.getFullYear();
    const month = String(timeBlockTime.getMonth() + 1).padStart(2, '0');
    const day = String(timeBlockTime.getDate()).padStart(2, '0');
    const hours = String(timeBlockTime.getHours()).padStart(2, '0');
    const minutes = String(timeBlockTime.getMinutes()).padStart(2, '0');
    
    return path.join(this.portLogDir, `timeblock-${year}${month}${day}-${hours}${minutes}`);
  }

  private async initializeSystemLogFile(): Promise<void> {
    const filename = `system-${this.getBeijingTimestamp()}.log`;
    const filepath = path.join(this.portLogDir, filename);
    
    this.systemLogFile = await fs.open(filepath, 'a');
    
    // Write header
    const header = {
      timestamp: new Date().toISOString(),
      beijingTimestamp: this.getBeijingTimestamp(),
      type: 'system_log_initialized',
      port: this.config.port
    };
    
    await this.systemLogFile.writeFile(JSON.stringify(header) + '\n');
  }

  private async initializeStopReasonLogFile(): Promise<void> {
    const filename = `stop-reason-${this.getBeijingTimestamp()}.log`;
    const filepath = path.join(this.portLogDir, filename);
    
    this.stopReasonLogFile = await fs.open(filepath, 'a');
    
    // Write header
    const header = {
      timestamp: new Date().toISOString(),
      beijingTimestamp: this.getBeijingTimestamp(),
      type: 'stop_reason_log_initialized',
      port: this.config.port
    };
    
    await this.stopReasonLogFile.writeFile(JSON.stringify(header) + '\n');
  }

  private async getRequestFileHandle(requestId: string): Promise<fs.FileHandle> {
    if (this.requestFiles.has(requestId)) {
      return this.requestFiles.get(requestId)!;
    }
    
    const filename = `request-${requestId}.jsonl`;
    const filepath = path.join(this.portLogDir, filename);
    
    const fileHandle = await fs.open(filepath, 'a');
    this.requestFiles.set(requestId, fileHandle);
    
    return fileHandle;
  }

  private async getNodeResponseFileHandle(timeBlockDir: string): Promise<fs.FileHandle> {
    const cacheKey = timeBlockDir;
    if (this.nodeResponseFiles.has(cacheKey)) {
      return this.nodeResponseFiles.get(cacheKey)!;
    }
    
    await fs.mkdir(timeBlockDir, { recursive: true });
    const filename = 'node-responses.jsonl';
    const filepath = path.join(timeBlockDir, filename);
    
    const fileHandle = await fs.open(filepath, 'a');
    this.nodeResponseFiles.set(cacheKey, fileHandle);
    
    return fileHandle;
  }

  /**
   * 开始记录请求生命周期
   */
  async startRequestLifecycle(
    requestId: string,
    provider: string,
    model: string,
    method: string,
    path: string,
    data?: any
  ): Promise<void> {
    try {
      const startTime = new Date().toISOString();
      const beijingTimestamp = this.getBeijingTimestamp();
      
      const lifecycle: RequestLifecycle = {
        requestId,
        port: this.config.port,
        startTime,
        provider,
        model,
        status: 'started',
        stages: [{
          stage: 'request_start',
          timestamp: startTime,
          beijingTimestamp,
          data: { method, path, ...data }
        }]
      };
      
      const fileHandle = await this.getRequestFileHandle(requestId);
      await fileHandle.writeFile(JSON.stringify(lifecycle) + '\n');
      
      // Log to system file
      if (this.systemLogFile) {
        await this.systemLogFile.writeFile(JSON.stringify({
          timestamp: startTime,
          beijingTimestamp,
          type: 'request_started',
          requestId,
          provider,
          model,
          method,
          path
        }) + '\n');
      }
      
      // 使用统一日志系统而不是直接console输出
      // console.log(`Request lifecycle started for ${requestId}`);
    } catch (error) {
      console.error('Failed to start request lifecycle:', error);
    }
  }

  /**
   * 记录请求阶段
   */
  async logRequestStage(
    requestId: string,
    stage: string,
    data?: any,
    duration?: number
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const beijingTimestamp = this.getBeijingTimestamp();
      
      const stageData: RequestStage = {
        stage,
        timestamp,
        beijingTimestamp,
        data,
        duration
      };
      
      const fileHandle = await this.getRequestFileHandle(requestId);
      
      // Read current lifecycle, add stage, and write back
      // For performance, we'll append a stage entry instead of rewriting the whole file
      const stageEntry = {
        type: 'stage',
        requestId,
        stage: stageData
      };
      
      await fileHandle.writeFile(JSON.stringify(stageEntry) + '\n');
      
    } catch (error) {
      console.error('Failed to log request stage:', error);
    }
  }

  /**
   * 记录节点响应（按时间分块）
   */
  async logNodeResponse(
    nodeId: string,
    response: any,
    metadata?: any
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const beijingTimestamp = this.getBeijingTimestamp();
      const timeBlockDir = this.getTimeBlockDirectory();
      
      const responseEntry = {
        timestamp,
        beijingTimestamp,
        nodeId,
        response,
        metadata,
        timeBlock: timeBlockDir.split('-').pop()
      };
      
      const fileHandle = await this.getNodeResponseFileHandle(timeBlockDir);
      await fileHandle.writeFile(JSON.stringify(responseEntry) + '\n');
      
    } catch (error) {
      console.error('Failed to log node response:', error);
    }
  }

  /**
   * 完成请求生命周期
   */
  async completeRequestLifecycle(
    requestId: string,
    status: number,
    responseTime: number,
    finishReason?: string,
    responseData?: any
  ): Promise<void> {
    try {
      const endTime = new Date().toISOString();
      const beijingTimestamp = this.getBeijingTimestamp();
      
      const completionEntry = {
        type: 'completion',
        requestId,
        endTime,
        beijingTimestamp,
        status,
        responseTime,
        finishReason,
        responseData
      };
      
      const fileHandle = await this.getRequestFileHandle(requestId);
      await fileHandle.writeFile(JSON.stringify(completionEntry) + '\n');
      
      // Log finish reason to separate file
      if (finishReason) {
        await this.logStopReason(requestId, finishReason, endTime, beijingTimestamp);
      }
      
      // Log to system file
      if (this.systemLogFile) {
        await this.systemLogFile.writeFile(JSON.stringify({
          timestamp: endTime,
          beijingTimestamp,
          type: 'request_completed',
          requestId,
          status,
          responseTime,
          finishReason
        }) + '\n');
      }
      
      // 使用统一日志系统而不是直接console输出
      // console.log(`Request lifecycle completed for ${requestId} in ${responseTime}ms`);
      
    } catch (error) {
      console.error('Failed to complete request lifecycle:', error);
    }
  }

  /**
   * 记录stop reason
   */
  private async logStopReason(
    requestId: string,
    finishReason: string,
    timestamp: string,
    beijingTimestamp: string
  ): Promise<void> {
    if (!this.stopReasonLogFile) return;
    
    const stopReasonEntry = {
      timestamp,
      beijingTimestamp,
      requestId,
      finishReason,
      port: this.config.port
    };
    
    await this.stopReasonLogFile.writeFile(JSON.stringify(stopReasonEntry) + '\n');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      // Close all request file handles
      for (const [requestId, fileHandle] of this.requestFiles) {
        await fileHandle.close();
      }
      this.requestFiles.clear();
      
      // Close all node response file handles
      for (const [timeBlockDir, fileHandle] of this.nodeResponseFiles) {
        await fileHandle.close();
      }
      this.nodeResponseFiles.clear();
      
      // Close system log file
      if (this.systemLogFile) {
        await this.systemLogFile.close();
        this.systemLogFile = null;
      }
      
      // Close stop reason log file
      if (this.stopReasonLogFile) {
        await this.stopReasonLogFile.close();
        this.stopReasonLogFile = null;
      }
      
      // 使用统一日志系统而不是直接console输出
      // console.log('Request lifecycle logger cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup request lifecycle logger:', error);
    }
  }
}