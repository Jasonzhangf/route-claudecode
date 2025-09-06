/**
 * Debug事件收集器
 *
 * 负责调试事件的收集、缓冲和批量处理
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecord, ModuleRecord, DebugSession, DebugConfig } from './types/debug-types';
import { RCCError, ValidationError, TransformError, AuthError, ERROR_CODES } from '../../error-handler';
import JQJsonHandler from '../../error-handler/src/utils/jq-json-handler';
import { AssembledPipeline } from '../../pipeline/src/assembly-types';

/**
 * 事件类型
 */
export type DebugEventType =
  | 'session-start'
  | 'session-end'
  | 'request-start'
  | 'request-end'
  | 'module-start'
  | 'module-end'
  | 'module-error'
  | 'pipeline-start'
  | 'pipeline-end'
  | 'pipeline-error';

/**
 * Debug事件
 */
export interface DebugEvent {
  id: string;
  type: DebugEventType;
  timestamp: number;
  sessionId: string;
  requestId?: string;
  moduleName?: string;
  pipelineId?: string;
  data: any;
  metadata: {
    port: number;
    source: string;
    version: string;
  };
}

/**
 * 事件缓冲配置
 */
export interface BufferConfig {
  maxSize: number;
  flushInterval: number;
  flushOnSize: number;
  enableBatching: boolean;
}

/**
 * 事件统计
 */
export interface EventStatistics {
  totalEvents: number;
  eventsByType: Map<DebugEventType, number>;
  eventsPerSecond: number;
  bufferUtilization: number;
  lastFlushTime: number;
}

/**
 * Debug事件收集器接口
 */
export interface DebugCollector {
  collectSessionEvent(type: 'session-start' | 'session-end', session: DebugSession): void;
  collectRequestEvent(type: 'request-start' | 'request-end', requestId: string, sessionId: string, data: any): void;
  collectModuleEvent(
    type: 'module-start' | 'module-end' | 'module-error',
    moduleName: string,
    requestId: string,
    sessionId: string,
    data: any
  ): void;
  collectPipelineEvent(
    type: 'pipeline-start' | 'pipeline-end' | 'pipeline-error',
    pipeline: AssembledPipeline,
    requestId: string,
    sessionId: string,
    data: any
  ): void;
  flushEvents(): Promise<DebugEvent[]>;
  getStatistics(): EventStatistics;
  clearBuffer(): void;
  startAutoFlush(): void;
  stopAutoFlush(): void;
}

/**
 * Debug事件收集器实现
 */
export class DebugCollectorImpl extends EventEmitter implements DebugCollector {
  private config: DebugConfig;
  private bufferConfig: BufferConfig;
  private eventBuffer: DebugEvent[] = [];
  private eventCount = 0;
  private eventCountByType = new Map<DebugEventType, number>();
  private autoFlushTimer?: NodeJS.Timeout;
  private lastFlushTime = Date.now();
  private startTime = Date.now();

  constructor(config: DebugConfig) {
    super();
    this.config = config;
    this.bufferConfig = {
      maxSize: 1000,
      flushInterval: 5000, // 5秒
      flushOnSize: 100,
      enableBatching: true,
    };

    // 初始化事件类型计数器
    this.initializeEventCounters();
  }

  /**
   * 收集会话事件
   */
  collectSessionEvent(type: 'session-start' | 'session-end', session: DebugSession): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId: session.sessionId,
      data: {
        port: session.port,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
      },
      metadata: {
        port: session.port,
        source: 'session-manager',
        version: '4.0.0',
      },
    };

    this.addEvent(event);
  }

  /**
   * 收集请求事件
   */
  collectRequestEvent(type: 'request-start' | 'request-end', requestId: string, sessionId: string, data: any): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId,
      requestId,
      data: this.sanitizeEventData(data),
      metadata: {
        port: data.port,
        source: 'request-handler',
        version: '4.0.0',
      },
    };

    this.addEvent(event);
  }

  /**
   * 收集模块事件
   */
  collectModuleEvent(
    type: 'module-start' | 'module-end' | 'module-error',
    moduleName: string,
    requestId: string,
    sessionId: string,
    data: any
  ): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId,
      requestId,
      moduleName,
      data: this.sanitizeEventData(data),
      metadata: {
        port: data.port,
        source: moduleName,
        version: '4.0.0',
      },
    };

    this.addEvent(event);
  }

  /**
   * 收集流水线事件
   */
  collectPipelineEvent(
    type: 'pipeline-start' | 'pipeline-end' | 'pipeline-error',
    pipeline: AssembledPipeline,
    requestId: string,
    sessionId: string,
    data: any
  ): void {
    const event: DebugEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId,
      requestId,
      pipelineId: pipeline.pipelineId,
      data: {
        pipelineId: pipeline.pipelineId,
        modules: pipeline.modules?.map(m => (typeof m === 'string' ? m : (m as any)?.name || 'unknown')) || [],
        ...this.sanitizeEventData(data),
      },
      metadata: {
        port: data.port,
        source: 'pipeline-manager',
        version: '4.0.0',
      },
    };

    this.addEvent(event);
  }

  /**
   * 刷新事件缓冲区
   */
  async flushEvents(): Promise<DebugEvent[]> {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.lastFlushTime = Date.now();

    if (events.length > 0) {
      this.emit('events-flushed', {
        eventCount: events.length,
        timestamp: this.lastFlushTime,
      });
    }

    return events;
  }

  /**
   * 获取事件统计信息
   */
  getStatistics(): EventStatistics {
    const now = Date.now();
    const timeElapsed = (now - this.startTime) / 1000; // 秒
    const eventsPerSecond = timeElapsed > 0 ? this.eventCount / timeElapsed : 0;
    const bufferUtilization = this.eventBuffer.length / this.bufferConfig.maxSize;

    return {
      totalEvents: this.eventCount,
      eventsByType: new Map(this.eventCountByType),
      eventsPerSecond,
      bufferUtilization,
      lastFlushTime: this.lastFlushTime,
    };
  }

  /**
   * 清空缓冲区
   */
  clearBuffer(): void {
    this.eventBuffer = [];
    this.emit('buffer-cleared', {
      timestamp: Date.now(),
    });
  }

  /**
   * 启动自动刷新
   */
  startAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
    }

    this.autoFlushTimer = setInterval(async () => {
      try {
        const events = await this.flushEvents();
        if (events.length > 0) {
          this.emit('auto-flush', {
            eventCount: events.length,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        this.emit('flush-error', {
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }, this.bufferConfig.flushInterval);

    this.emit('auto-flush-started', {
      interval: this.bufferConfig.flushInterval,
      timestamp: Date.now(),
    });
  }

  /**
   * 停止自动刷新
   */
  stopAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = undefined;
    }

    this.emit('auto-flush-stopped', {
      timestamp: Date.now(),
    });
  }

  // ===== Private Helper Methods =====

  private addEvent(event: DebugEvent): void {
    if (!this.config.enabled) return;

    // 检查缓冲区大小
    if (this.eventBuffer.length >= this.bufferConfig.maxSize) {
      // 移除最旧的事件
      this.eventBuffer.shift();
      this.emit('buffer-overflow', {
        removedEventId: event.id,
        timestamp: Date.now(),
      });
    }

    this.eventBuffer.push(event);
    this.eventCount++;

    // 更新事件类型计数
    const currentCount = this.eventCountByType.get(event.type) || 0;
    this.eventCountByType.set(event.type, currentCount + 1);

    // 检查是否需要触发刷新
    if (this.bufferConfig.enableBatching && this.eventBuffer.length >= this.bufferConfig.flushOnSize) {
      this.flushEvents().catch(error => {
        this.emit('flush-error', {
          error: error.message,
          timestamp: Date.now(),
        });
      });
    }

    this.emit('event-collected', {
      eventId: event.id,
      eventType: event.type,
      bufferSize: this.eventBuffer.length,
      timestamp: Date.now(),
    });
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeEventData(data: any): any {
    if (!data) return {};

    // 创建数据副本以避免修改原始数据
    const sanitized = this.deepClone(data);

    // 移除敏感信息
    this.removeSensitiveData(sanitized);

    // 限制数据大小
    return this.limitDataSize(sanitized);
  }

  private removeSensitiveData(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    const sensitiveKeys = [
      'password',
      'token',
      'key',
      'secret',
      'credential',
      'authorization',
      'api-key',
      'x-api-key',
      'cookie',
    ];

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          this.removeSensitiveData(obj[key]);
        }
      }
    }
  }

  private limitDataSize(data: any): any {
    // 🔧 FIXED: 移除数据大小限制 - 保持完整的调试数据
    // 不再截断调试数据，保留完整信息用于问题诊断
    return data;
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  private initializeEventCounters(): void {
    const eventTypes: DebugEventType[] = [
      'session-start',
      'session-end',
      'request-start',
      'request-end',
      'module-start',
      'module-end',
      'module-error',
      'pipeline-start',
      'pipeline-end',
      'pipeline-error',
    ];

    for (const type of eventTypes) {
      this.eventCountByType.set(type, 0);
    }
  }
}
