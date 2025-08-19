/**
 * Passthrough兼容性模块 - 用于OpenAI兼容的API直接透传
 *
 * 这个模块不做任何转换，直接透传请求，适用于：
 * - ModelScope API (OpenAI兼容)
 * - Gemini API (在转换后)
 * - 其他标准OpenAI兼容的API
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';

export interface PassthroughCompatibilityConfig {
  mode: 'passthrough';
  [key: string]: any;
}

/**
 * 标准协议请求接口（OpenAI格式）
 */
export interface StandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  [key: string]: any;
}

/**
 * 标准协议响应接口
 */
export interface StandardResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PassthroughCompatibilityModule extends EventEmitter implements ModuleInterface {
  private config: PassthroughCompatibilityConfig;
  private currentStatus: ModuleStatus;

  constructor(config: PassthroughCompatibilityConfig = { mode: 'passthrough' }) {
    super();
    this.config = config;
    this.currentStatus = {
      id: 'passthrough-compatibility',
      name: 'Passthrough Compatibility Module',
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'stopped',
      health: 'healthy',
    };
  }

  getId(): string {
    return this.currentStatus.id;
  }

  getName(): string {
    return this.currentStatus.name;
  }

  getType(): ModuleType {
    return this.currentStatus.type;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getStatus(): ModuleStatus {
    return { ...this.currentStatus };
  }

  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  async start(): Promise<void> {
    this.currentStatus.status = 'starting';
    // 模块启动完成
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
  }

  async stop(): Promise<void> {
    this.currentStatus.status = 'stopping';
    // 模块停止完成
    this.currentStatus.status = 'stopped';
  }

  async reset(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.currentStatus.health = 'healthy';
    this.currentStatus.error = undefined;
  }

  async cleanup(): Promise<void> {
    // 模块清理完成
    this.currentStatus.status = 'stopped';
    this.removeAllListeners();
  }

  async process(request: StandardRequest): Promise<StandardRequest> {
    this.currentStatus.lastActivity = new Date();

    // Passthrough模块：请求已经是OpenAI格式，直接透传请求到下一个模块
    // 不做任何转换，直接返回原始请求

    console.log('🔄 [Passthrough兼容模块] 透传OpenAI格式请求:');
    console.log('   模型:', request.model);
    console.log('   消息数量:', request.messages?.length || 0);
    console.log('   透传模式: 直接返回原始请求，无需格式转换');

    // 直接返回原始请求，不包装
    return request;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const healthy = this.currentStatus.status === 'running';
    return {
      healthy,
      details: {
        status: this.currentStatus.status,
        mode: this.config.mode,
        lastActivity: this.currentStatus.lastActivity,
      },
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastProcessedAt: this.currentStatus.lastActivity,
    };
  }
}
