/**
 * 四层双向处理流水线拦截器 - 完整实现
 * 支持实时数据捕获、性能监控和错误追踪
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { getEnhancedErrorHandler, ValidationError } from '../../modules/error-handler/src/enhanced-error-handler';

// 流水线层次定义
export enum PipelineLayer {
  TRANSFORMER = 'transformer',
  PROTOCOL = 'protocol', 
  SERVER_COMPATIBILITY = 'serverCompatibility',
  SERVER = 'server'
}

// 拦截点类型
export enum InterceptionPoint {
  BEFORE_LAYER = 'before_layer',
  AFTER_LAYER = 'after_layer',
  ON_ERROR = 'on_error',
  ON_COMPLETE = 'on_complete'
}

// 拦截数据接口
export interface InterceptedData {
  requestId: string;
  layer: PipelineLayer;
  point: InterceptionPoint;
  timestamp: number;
  data: any;
  metadata: {
    processingTime?: number;
    memorySnapshot?: NodeJS.MemoryUsage;
    error?: Error;
    success: boolean;
  };
}

// 流水线拦截器配置
export interface InterceptorConfig {
  enablePerformanceTracking: boolean;
  enableMemoryTracking: boolean;
  enableErrorTracking: boolean;
  enableDataCapture: boolean;
  maxCaptureSize: number;
  captureFilter?: (data: any) => boolean;
}

// 数据捕获错误
class DataCaptureError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Data capture failed: ${message}`, details);
  }
}

// 性能跟踪错误
class PerformanceTrackingError extends ValidationError {
  constructor(message: string, details?: any) {
    super(`Performance tracking failed: ${message}`, details);
  }
}

/**
 * 流水线拦截器核心实现
 * 负责在四层处理流程中进行实时数据拦截和记录
 */
export class PipelineInterceptor extends EventEmitter {
  private config: InterceptorConfig;
  private interceptedData: Map<string, InterceptedData[]> = new Map();
  private performanceMarkers: Map<string, number> = new Map();
  private errorHandler = getEnhancedErrorHandler();

  constructor(config: InterceptorConfig) {
    super();
    this.config = {
      enablePerformanceTracking: true,
      enableMemoryTracking: true,
      enableErrorTracking: true,
      enableDataCapture: true,
      maxCaptureSize: 10 * 1024 * 1024, // 10MB默认限制
      ...config
    };
  }

  /**
   * 创建拦截包装器，用于包装流水线层处理函数
   */
  public createLayerWrapper<T, R>(
    layer: PipelineLayer,
    processor: (input: T) => Promise<R>
  ): (input: T) => Promise<R> {
    return async (input: T): Promise<R> => {
      const requestId = this.generateRequestId(input);
      const startTime = performance.now();

      await this.interceptBefore(requestId, layer, input);

      const result = await processor(input).catch(async (error) => {
        const endTime = performance.now();
        await this.interceptError(requestId, layer, error, endTime - startTime);
        throw error;
      });

      const endTime = performance.now();
      await this.interceptAfter(requestId, layer, result, endTime - startTime);

      return result;
    };
  }

  /**
   * 处理前拦截
   */
  private async interceptBefore(requestId: string, layer: PipelineLayer, data: any): Promise<void> {
    if (!this.config.enableDataCapture) return;

    const interceptedData: InterceptedData = {
      requestId,
      layer,
      point: InterceptionPoint.BEFORE_LAYER,
      timestamp: Date.now(),
      data: await this.captureDataSafely(data),
      metadata: {
        memorySnapshot: this.config.enableMemoryTracking ? process.memoryUsage() : undefined,
        success: true
      }
    };

    this.storeInterceptedData(requestId, interceptedData);
    this.performanceMarkers.set(`${requestId}-${layer}-start`, performance.now());

    // 发射事件
    this.emit('beforeLayer', interceptedData);
  }

  /**
   * 处理后拦截
   */
  private async interceptAfter(
    requestId: string, 
    layer: PipelineLayer, 
    data: any, 
    processingTime: number
  ): Promise<void> {
    if (!this.config.enableDataCapture) return;

    const interceptedData: InterceptedData = {
      requestId,
      layer,
      point: InterceptionPoint.AFTER_LAYER,
      timestamp: Date.now(),
      data: await this.captureDataSafely(data),
      metadata: {
        processingTime: this.config.enablePerformanceTracking ? processingTime : undefined,
        memorySnapshot: this.config.enableMemoryTracking ? process.memoryUsage() : undefined,
        success: true
      }
    };

    this.storeInterceptedData(requestId, interceptedData);

    // 发射事件
    this.emit('afterLayer', interceptedData);
  }

  /**
   * 错误拦截
   */
  private async interceptError(
    requestId: string,
    layer: PipelineLayer,
    error: Error,
    processingTime: number
  ): Promise<void> {
    if (!this.config.enableErrorTracking) return;

    const interceptedData: InterceptedData = {
      requestId,
      layer,
      point: InterceptionPoint.ON_ERROR,
      timestamp: Date.now(),
      data: null,
      metadata: {
        processingTime: this.config.enablePerformanceTracking ? processingTime : undefined,
        memorySnapshot: this.config.enableMemoryTracking ? process.memoryUsage() : undefined,
        error,
        success: false
      }
    };

    this.storeInterceptedData(requestId, interceptedData);

    // 记录错误到错误处理系统
    await this.errorHandler.handleRCCError(error as any, {
      requestId,
      layerName: layer,
      totalTime: processingTime
    });

    // 发射事件
    this.emit('error', interceptedData);
  }

  /**
   * 获取指定请求的所有拦截数据
   */
  public getInterceptedData(requestId: string): InterceptedData[] {
    return this.interceptedData.get(requestId) || [];
  }

  /**
   * 获取所有拦截数据
   */
  public getAllInterceptedData(): Map<string, InterceptedData[]> {
    return new Map(this.interceptedData);
  }

  /**
   * 清理指定请求的拦截数据
   */
  public clearRequestData(requestId: string): void {
    this.interceptedData.delete(requestId);
    // 清理性能标记
    for (const key of this.performanceMarkers.keys()) {
      if (key.startsWith(requestId)) {
        this.performanceMarkers.delete(key);
      }
    }
  }

  /**
   * 清理所有拦截数据
   */
  public clearAllData(): void {
    this.interceptedData.clear();
    this.performanceMarkers.clear();
  }

  /**
   * 获取性能统计信息
   */
  public getPerformanceStats(requestId: string): {
    totalTime: number;
    layerTimes: Record<string, number>;
  } {
    const layerTimes: Record<string, number> = {};
    let totalTime = 0;

    for (const layer of Object.values(PipelineLayer)) {
      const startKey = `${requestId}-${layer}-start`;
      const endMarker = this.findEndMarker(requestId, layer);
      
      if (this.performanceMarkers.has(startKey) && endMarker) {
        const layerTime = endMarker - (this.performanceMarkers.get(startKey) || 0);
        layerTimes[layer] = layerTime;
        totalTime += layerTime;
      }
    }

    return { totalTime, layerTimes };
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(input: any): string {
    // 尝试从输入中提取请求ID
    if (input && typeof input === 'object') {
      if (input.requestId) return input.requestId;
      if (input.id) return input.id;
      if (input.metadata && input.metadata.requestId) return input.metadata.requestId;
    }
    
    // 生成新的请求ID
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 安全捕获数据，支持大小限制和过滤
   */
  private async captureDataSafely(data: any): Promise<any> {
    if (!this.config.enableDataCapture) return null;
    
    // 应用过滤器
    if (this.config.captureFilter && !this.config.captureFilter(data)) {
      return null;
    }

    const serialized = JSON.stringify(data);
    
    // 检查大小限制
    if (serialized.length > this.config.maxCaptureSize) {
      return {
        __truncated: true,
        __originalSize: serialized.length,
        __maxSize: this.config.maxCaptureSize,
        __preview: serialized.substring(0, this.config.maxCaptureSize / 2) + '...'
      };
    }

    return data;
  }

  /**
   * 存储拦截数据
   */
  private storeInterceptedData(requestId: string, data: InterceptedData): void {
    if (!this.interceptedData.has(requestId)) {
      this.interceptedData.set(requestId, []);
    }
    this.interceptedData.get(requestId)!.push(data);
  }

  /**
   * 查找层处理结束标记
   */
  private findEndMarker(requestId: string, layer: PipelineLayer): number | null {
    const data = this.getInterceptedData(requestId);
    const afterLayerData = data.find(d => 
      d.layer === layer && d.point === InterceptionPoint.AFTER_LAYER
    );
    
    if (afterLayerData) {
      return afterLayerData.timestamp;
    }

    // 检查是否有错误标记
    const errorData = data.find(d => 
      d.layer === layer && d.point === InterceptionPoint.ON_ERROR
    );
    
    return errorData ? errorData.timestamp : null;
  }

  /**
   * 导出拦截数据为JSON格式
   */
  public exportData(requestId?: string): string {
    const dataToExport = requestId 
      ? { [requestId]: this.getInterceptedData(requestId) }
      : Object.fromEntries(this.interceptedData);

    return JSON.stringify(dataToExport, null, 2);
  }

  /**
   * 获取内存使用统计
   */
  public getMemoryStats(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * 获取拦截器状态
   */
  public getStatus(): {
    active: boolean;
    config: InterceptorConfig;
    stats: {
      totalRequests: number;
      activeRequests: number;
      totalMemory: number;
    };
  } {
    return {
      active: true,
      config: this.config,
      stats: {
        totalRequests: this.interceptedData.size,
        activeRequests: Array.from(this.interceptedData.values())
          .filter(data => data.some(d => d.point !== InterceptionPoint.ON_COMPLETE)).length,
        totalMemory: process.memoryUsage().heapUsed
      }
    };
  }
}