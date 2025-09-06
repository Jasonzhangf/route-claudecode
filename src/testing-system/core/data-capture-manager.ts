/**
 * 数据捕获管理器 - 完整实现
 * 负责管理四层流水线的数据采集、存储和分析
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { PipelineInterceptor, InterceptedData, PipelineLayer, InterceptorConfig } from './pipeline-interceptor';
import { getEnhancedErrorHandler, ValidationError } from '../../modules/error-handler/src/enhanced-error-handler';
import { secureLogger } from '../../modules/error-handler/src/utils/secure-logger';

// 数据存储配置
export interface DataStorageConfig {
  storageDirectory: string;
  maxFileSize: number;
  rotationInterval: number;
  compressionEnabled: boolean;
  retentionDays: number;
}

// 捕获会话
export interface CaptureSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  requestIds: string[];
  metadata: {
    testType: string;
    category: string;
    description?: string;
  };
}

// 分析结果
export interface AnalysisResult {
  sessionId: string;
  totalRequests: number;
  averageProcessingTime: number;
  layerPerformance: Record<string, number>;
  errorRate: number;
  memoryUsage: {
    average: number;
    peak: number;
  };
  recommendations: string[];
}

// 数据捕获管理器特定错误类型
class CaptureSessionError extends ValidationError {
  constructor(message: string, sessionId?: string) {
    super(`Capture session error: ${message}`, { sessionId });
  }
}

class DataStorageError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Data storage error: ${message}`, details);
  }
}

class AnalysisError extends ValidationError {
  constructor(message: string, sessionId?: string) {
    super(`Analysis error: ${message}`, { sessionId });
  }
}

/**
 * 数据捕获管理器实现
 */
export class DataCaptureManager extends EventEmitter {
  private interceptor: PipelineInterceptor;
  private storageConfig: DataStorageConfig;
  private errorHandler = getEnhancedErrorHandler();
  private activeSessions: Map<string, CaptureSession> = new Map();
  private captureBuffer: Map<string, InterceptedData[]> = new Map();

  constructor(
    interceptorConfig: InterceptorConfig,
    storageConfig: DataStorageConfig
  ) {
    super();
    
    this.interceptor = new PipelineInterceptor(interceptorConfig);
    this.storageConfig = {
      storageDirectory: join(process.cwd(), 'test-capture-data'),
      maxFileSize: 100 * 1024 * 1024, // 100MB
      rotationInterval: 24 * 60 * 60 * 1000, // 24小时
      compressionEnabled: true,
      retentionDays: 30,
      ...storageConfig
    };

    this.setupEventHandlers();
    this.initializeStorage();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.interceptor.on('beforeLayer', this.handleBeforeLayer.bind(this));
    this.interceptor.on('afterLayer', this.handleAfterLayer.bind(this));
    this.interceptor.on('error', this.handleError.bind(this));
  }

  /**
   * 初始化存储目录
   */
  private async initializeStorage(): Promise<void> {
    await fs.mkdir(this.storageConfig.storageDirectory, { recursive: true });
    secureLogger.info('Data capture storage initialized', {
      directory: this.storageConfig.storageDirectory
    });
  }

  /**
   * 开始捕获会话
   */
  public async startCaptureSession(
    sessionId: string,
    metadata: { testType: string; category: string; description?: string }
  ): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      throw new CaptureSessionError(`Session already exists`, sessionId);
    }

    const session: CaptureSession = {
      sessionId,
      startTime: Date.now(),
      requestIds: [],
      metadata
    };

    this.activeSessions.set(sessionId, session);
    this.captureBuffer.set(sessionId, []);

    secureLogger.info('Capture session started', { sessionId, metadata });
    this.emit('sessionStarted', session);
  }

  /**
   * 结束捕获会话
   */
  public async endCaptureSession(sessionId: string): Promise<AnalysisResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new CaptureSessionError(`Session not found`, sessionId);
    }

    session.endTime = Date.now();
    
    // 保存会话数据
    await this.saveSessionData(sessionId);
    
    // 分析会话数据
    const analysisResult = await this.analyzeSessionData(sessionId);
    
    // 清理内存中的数据
    this.captureBuffer.delete(sessionId);
    this.activeSessions.delete(sessionId);

    secureLogger.info('Capture session ended', { sessionId, analysisResult });
    this.emit('sessionEnded', { session, analysisResult });

    return analysisResult;
  }

  /**
   * 创建层包装器
   */
  public createLayerWrapper<T, R>(
    layer: PipelineLayer,
    processor: (input: T) => Promise<R>
  ): (input: T) => Promise<R> {
    return this.interceptor.createLayerWrapper(layer, processor);
  }

  /**
   * 获取活跃会话
   */
  public getActiveSessions(): CaptureSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 获取会话数据
   */
  public getSessionData(sessionId: string): InterceptedData[] {
    return this.captureBuffer.get(sessionId) || [];
  }

  /**
   * 处理层处理前事件
   */
  private handleBeforeLayer(data: InterceptedData): void {
    this.addDataToActiveSessions(data);
  }

  /**
   * 处理层处理后事件
   */
  private handleAfterLayer(data: InterceptedData): void {
    this.addDataToActiveSessions(data);
  }

  /**
   * 处理错误事件
   */
  private handleError(data: InterceptedData): void {
    this.addDataToActiveSessions(data);
    
    // 记录错误到错误处理系统
    if (data.metadata.error) {
      this.errorHandler.handleRCCError(data.metadata.error as any, {
        requestId: data.requestId,
        layerName: data.layer
      });
    }
  }

  /**
   * 将数据添加到活跃会话
   */
  private addDataToActiveSessions(data: InterceptedData): void {
    for (const [sessionId, session] of this.activeSessions) {
      const sessionBuffer = this.captureBuffer.get(sessionId);
      if (sessionBuffer) {
        sessionBuffer.push(data);
        
        // 更新会话的请求ID列表
        if (!session.requestIds.includes(data.requestId)) {
          session.requestIds.push(data.requestId);
        }
      }
    }
  }

  /**
   * 保存会话数据到文件
   */
  private async saveSessionData(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    const data = this.captureBuffer.get(sessionId);
    
    if (!session || !data) {
      throw new DataStorageError(`Session data not found for ${sessionId}`);
    }

    const filename = `${sessionId}-${Date.now()}.json`;
    const filepath = join(this.storageConfig.storageDirectory, filename);

    const sessionData = {
      session,
      capturedData: data,
      stats: {
        totalDataPoints: data.length,
        uniqueRequests: session.requestIds.length,
        duration: (session.endTime || Date.now()) - session.startTime
      }
    };

    // 确保目录存在
    await fs.mkdir(dirname(filepath), { recursive: true });
    
    // 写入文件
    await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2));
    
    secureLogger.info('Session data saved', { sessionId, filepath });
  }

  /**
   * 分析会话数据
   */
  private async analyzeSessionData(sessionId: string): Promise<AnalysisResult> {
    const data = this.captureBuffer.get(sessionId) || [];
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new AnalysisError(`Session not found`, sessionId);
    }

    // 计算性能指标
    const processingTimes: number[] = [];
    const layerTimes: Record<string, number[]> = {};
    const memoryUsages: number[] = [];
    let errorCount = 0;

    for (const item of data) {
      if (item.metadata.processingTime) {
        processingTimes.push(item.metadata.processingTime);
        
        if (!layerTimes[item.layer]) {
          layerTimes[item.layer] = [];
        }
        layerTimes[item.layer].push(item.metadata.processingTime);
      }

      if (item.metadata.memorySnapshot) {
        memoryUsages.push(item.metadata.memorySnapshot.heapUsed);
      }

      if (!item.metadata.success) {
        errorCount++;
      }
    }

    // 计算平均值
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    const layerPerformance: Record<string, number> = {};
    for (const [layer, times] of Object.entries(layerTimes)) {
      layerPerformance[layer] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    const averageMemory = memoryUsages.length > 0
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
      : 0;

    const peakMemory = memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;

    // 生成建议
    const recommendations = this.generateRecommendations({
      averageProcessingTime,
      layerPerformance,
      errorRate: data.length > 0 ? errorCount / data.length : 0,
      averageMemory,
      peakMemory
    });

    return {
      sessionId,
      totalRequests: session.requestIds.length,
      averageProcessingTime,
      layerPerformance,
      errorRate: data.length > 0 ? errorCount / data.length : 0,
      memoryUsage: {
        average: averageMemory,
        peak: peakMemory
      },
      recommendations
    };
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(metrics: {
    averageProcessingTime: number;
    layerPerformance: Record<string, number>;
    errorRate: number;
    averageMemory: number;
    peakMemory: number;
  }): string[] {
    const recommendations: string[] = [];

    // 处理时间建议
    if (metrics.averageProcessingTime > 1000) {
      recommendations.push('Processing time is high, consider optimizing pipeline performance');
    }

    // 层性能建议
    for (const [layer, time] of Object.entries(metrics.layerPerformance)) {
      if (time > 500) {
        recommendations.push(`${layer} layer processing time is high, consider optimization`);
      }
    }

    // 错误率建议
    if (metrics.errorRate > 0.1) {
      recommendations.push('Error rate is high, review error handling logic');
    }

    // 内存使用建议
    if (metrics.peakMemory > 512 * 1024 * 1024) { // 512MB
      recommendations.push('Memory usage is high, consider optimizing memory management');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance metrics are within acceptable ranges');
    }

    return recommendations;
  }

  /**
   * 清理过期数据
   */
  public async cleanupExpiredData(): Promise<number> {
    const cutoffTime = Date.now() - (this.storageConfig.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    const files = await fs.readdir(this.storageConfig.storageDirectory);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filepath = join(this.storageConfig.storageDirectory, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }
    }

    secureLogger.info('Expired data cleaned up', { deletedCount });
    return deletedCount;
  }

  /**
   * 获取存储统计信息
   */
  public async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    const files = await fs.readdir(this.storageConfig.storageDirectory);
    let totalSize = 0;
    let oldestTime = Number.MAX_SAFE_INTEGER;
    let newestTime = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filepath = join(this.storageConfig.storageDirectory, file);
        const stats = await fs.stat(filepath);
        
        totalSize += stats.size;
        oldestTime = Math.min(oldestTime, stats.mtime.getTime());
        newestTime = Math.max(newestTime, stats.mtime.getTime());
      }
    }

    return {
      totalFiles: files.filter(f => f.endsWith('.json')).length,
      totalSize,
      oldestFile: oldestTime === Number.MAX_SAFE_INTEGER ? null : new Date(oldestTime),
      newestFile: newestTime === 0 ? null : new Date(newestTime)
    };
  }
}