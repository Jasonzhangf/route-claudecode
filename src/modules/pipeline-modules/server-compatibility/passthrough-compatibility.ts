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
  maxTokens?: number;
  enhanceTool?: boolean;
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
    this.config = {
      mode: 'passthrough',
      enhanceTool: true,
      ...config
    };
    
    // 动态设置maxTokens，支持配置文件覆盖，默认128K
    if (!this.config.maxTokens) {
      this.config.maxTokens = 131072; // 默认128K tokens限制
    }
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

  async initialize(): Promise<void> {
    // 初始化透传兼容性模块
    this.currentStatus.status = 'starting';
    console.log('🔧 [Passthrough兼容模块] 初始化完成');
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
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

    console.log('🔄 [Passthrough兼容模块] 处理OpenAI格式请求:');
    console.log('   输入模型:', request.model);
    console.log('   消息数量:', request.messages?.length || 0);

    // 🔧 关键修复：如果模型名是映射模型名（如"default"），需要转换为实际的模型名
    // 通过__internal配置获取实际使用的模型名
    let actualModel = request.model;
    
    if (request.__internal && request.__internal.actualModel) {
      actualModel = request.__internal.actualModel;
      console.log('   🔄 模型名映射: 映射模型', request.model, '-> 实际模型', actualModel);
    }

    // 创建处理后的请求，使用实际的模型名
    let processedRequest = {
      ...request,
      model: actualModel
    };

    // 🔧 新增：根据maxTokens限制请求大小，防止JSON过大被API拒绝
    if (this.config.maxTokens && typeof this.config.maxTokens === 'number') {
      processedRequest = await this.limitRequestSize(processedRequest, this.config.maxTokens);
    }

    console.log('   输出模型:', processedRequest.model);
    console.log('   透传模式: 保持OpenAI格式，更新模型名，限制请求大小');

    return processedRequest;
  }

  /**
   * 根据maxTokens限制请求大小，防止JSON过大
   */
  private async limitRequestSize(request: StandardRequest, maxTokens: number): Promise<StandardRequest> {
    // 粗略估算JSON大小（字符数近似token数）
    const requestJson = JSON.stringify(request);
    const estimatedTokens = requestJson.length / 4; // 粗略估算：4字符≈1token
    
    console.log(`   📏 请求大小检查: ${requestJson.length} 字符, 估算 ${Math.round(estimatedTokens)} tokens, 限制 ${maxTokens} tokens`);
    
    if (estimatedTokens <= maxTokens) {
      console.log('   ✅ 请求大小在限制范围内，无需截断');
      return request;
    }

    console.log('   ⚠️ 请求过大，开始截断处理...');
    
    // 创建副本进行截断
    const truncatedRequest = { ...request };
    
    // 1. 优先截断tools数组（通常是最大的部分）
    if (truncatedRequest.tools && Array.isArray(truncatedRequest.tools)) {
      const originalToolsLength = truncatedRequest.tools.length;
      // 保留前50%的工具，或最多10个
      const maxTools = Math.min(Math.floor(originalToolsLength * 0.5), 10);
      if (truncatedRequest.tools.length > maxTools) {
        truncatedRequest.tools = truncatedRequest.tools.slice(0, maxTools);
        console.log(`   🔧 截断工具数组: ${originalToolsLength} -> ${truncatedRequest.tools.length}`);
      }
    }
    
    // 2. 检查截断后的大小
    const truncatedJson = JSON.stringify(truncatedRequest);
    const newEstimatedTokens = truncatedJson.length / 4;
    
    console.log(`   📏 截断后大小: ${truncatedJson.length} 字符, 估算 ${Math.round(newEstimatedTokens)} tokens`);
    
    // 3. 如果还是太大，进一步截断消息内容
    if (newEstimatedTokens > maxTokens && truncatedRequest.messages) {
      for (let i = 0; i < truncatedRequest.messages.length; i++) {
        const message = truncatedRequest.messages[i];
        if (message.content && typeof message.content === 'string') {
          // 截断字符串内容到最多2000字符
          if (message.content.length > 2000) {
            message.content = message.content.substring(0, 2000) + '... [内容已截断]';
            console.log(`   ✂️ 截断消息 ${i} 内容: 长度限制到2000字符`);
          }
        }
      }
    }
    
    const finalJson = JSON.stringify(truncatedRequest);
    const finalEstimatedTokens = finalJson.length / 4;
    
    console.log(`   ✅ 最终请求大小: ${finalJson.length} 字符, 估算 ${Math.round(finalEstimatedTokens)} tokens`);
    
    return truncatedRequest;
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
