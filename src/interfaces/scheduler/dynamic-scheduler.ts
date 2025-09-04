/**
 * 动态调度器接口 - Dynamic Scheduler Interface
 *
 * RCC v4.0 架构重构核心组件
 *
 * 职责：
 * 1. 运行时请求调度
 * 2. 负载均衡决策
 * 3. 错误处理和流水线状态管理
 * 4. 与初始化系统完全分离
 *
 * 设计原则：
 * - 外部只能访问核心调度方法
 * - 运行时专用：只处理活跃流水线的调度
 * - 状态隔离：不保存任何初始化状态
 *
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { CompletePipeline } from '../../pipeline/pipeline-manager-types';
import { secureLogger } from '../../utils/secure-logger';

/**
 * 调度请求接口
 */
export interface ScheduleRequest {
  /** 请求ID */
  requestId: string;
  /** 模型名称 */
  model: string;
  /** 请求数据 */
  request: any;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high';
  /** 超时时间 (毫秒) */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}

/**
 * 调度响应接口
 */
export interface ScheduleResponse {
  /** 请求ID */
  requestId: string;
  /** 选中的流水线ID */
  pipelineId: string;
  /** 响应数据 */
  response: any;
  /** 处理时间 (毫秒) */
  processingTime: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 负载均衡策略 */
  strategy?: string;
}

/**
 * 流水线状态接口
 */
export interface PipelineHealthStatus {
  /** 流水线ID */
  pipelineId: string;
  /** 是否可用 */
  isAvailable: boolean;
  /** 是否被拉黑 */
  isBlacklisted: boolean;
  /** 错误计数 */
  errorCount: number;
  /** 最后错误时间 */
  lastErrorTime?: number;
  /** 拉黑截止时间 */
  blacklistUntil?: number;
  /** 健康状态 */
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * 负载均衡策略枚举
 */
export enum LoadBalanceStrategy {
  /** 轮询 */
  ROUND_ROBIN = 'round_robin',
  /** 最少连接 */
  LEAST_CONNECTIONS = 'least_connections',
  /** 随机 */
  RANDOM = 'random',
  /** 优先级 */
  PRIORITY_BASED = 'priority_based'
}

/**
 * 动态调度器错误类
 */
export class DynamicSchedulerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DynamicSchedulerError';
  }
}

/**
 * 动态调度器接口
 *
 * 职责：
 * 1. 运行时请求调度
 * 2. 负载均衡决策
 * 3. 流水线健康状态管理
 * 4. 错误处理和恢复
 *
 * 与初始化器完全分离：
 * - 不处理配置解析
 * - 不创建新流水线
 * - 只调度已存在的活跃流水线
 */
export interface DynamicScheduler extends EventEmitter {
  
  /**
   * 调度请求 - 核心调度接口
   *
   * 根据负载均衡策略选择合适的流水线执行请求
   * 处理流水线错误、重试和状态管理
   *
   * @param request 调度请求
   * @returns 调度响应
   * @throws DynamicSchedulerError 调度失败时抛出
   */
  scheduleRequest(request: ScheduleRequest): Promise<ScheduleResponse>;
  
  /**
   * 注册流水线到调度器
   *
   * 在初始化完成后调用，将创建的流水线注册到调度器
   * 调度器将管理这些流水线的健康状态和负载均衡
   *
   * @param pipeline 完整流水线实例
   * @param category 流水线分类 (通常是模型名称)
   */
  registerPipeline(pipeline: CompletePipeline, category: string): void;
  
  /**
   * 移除流水线
   *
   * 当流水线被销毁时调用，从调度器中移除
   *
   * @param pipelineId 流水线ID
   */
  unregisterPipeline(pipelineId: string): void;
  
  /**
   * 获取负载均衡统计信息
   *
   * 返回当前调度器的状态信息，用于监控
   *
   * @returns 统计信息
   */
  getSchedulerStats(): {
    /** 总流水线数 */
    totalPipelines: number;
    /** 可用流水线数 */
    availablePipelines: number;
    /** 被拉黑的流水线数 */
    blacklistedPipelines: number;
    /** 分类数 */
    categoriesCount: number;
    /** 当前负载均衡策略 */
    strategy: LoadBalanceStrategy;
    /** 最后调度时间 */
    lastScheduleTime?: number;
  };
  
  /**
   * 获取流水线健康状态
   *
   * 返回指定流水线的健康状态信息
   *
   * @param pipelineId 流水线ID
   * @returns 健康状态
   */
  getPipelineHealth(pipelineId: string): PipelineHealthStatus | null;
  
  /**
   * 获取分类下的所有流水线状态
   *
   * 返回指定分类下所有流水线的健康状态
   *
   * @param category 分类名称
   * @returns 健康状态数组
   */
  getCategoryPipelineHealth(category: string): PipelineHealthStatus[];
  
  /**
   * 清理调度器资源
   *
   * 停止所有定时任务，清理资源
   */
  cleanup(): Promise<void>;
}