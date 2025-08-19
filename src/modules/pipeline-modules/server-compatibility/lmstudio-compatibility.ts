/**
 * LM Studio Server Compatibility Module
 *
 * 按照RCC v4.0架构规范实现的LM Studio兼容性模块
 * 作为Server-Compatibility层处理LM Studio特定的OpenAI API变种
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';

/**
 * LM Studio配置接口
 */
export interface LMStudioCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  models: string[];
  maxTokens?: Record<string, number>; // 每个模型的最大token限制
}

/**
 * 标准协议请求接口（OpenAI格式）
 */
export interface StandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * LM Studio特定请求格式
 */
export interface LMStudioRequest extends StandardRequest {
  // LM Studio可能有一些特定的参数
  top_k?: number;
  repeat_penalty?: number;
  system_prompt?: string;
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
      role: 'assistant';
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LM Studio特定响应格式
 */
export interface LMStudioResponse extends StandardResponse {
  // LM Studio可能有额外的响应字段
  metadata?: {
    server_version?: string;
    model_path?: string;
  };
}

/**
 * LM Studio Server Compatibility Module实现
 */
export class LMStudioCompatibilityModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'lmstudio-compatibility';
  private readonly name: string = 'LM Studio Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = '1.0.0';
  private readonly config: LMStudioCompatibilityConfig;
  private openaiClient: OpenAI;
  private status: any = 'healthy';
  private isInitialized = false;

  constructor(config: LMStudioCompatibilityConfig) {
    super();
    this.config = config;

    // 使用官方OpenAI SDK连接LM Studio
    this.openaiClient = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'lm-studio', // LM Studio通常不需要真实的API Key
      timeout: config.timeout,
    });

    console.log(`🔧 初始化LM Studio兼容模块: ${config.baseUrl}`);
  }

  // ModuleInterface实现

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'running',
      health: this.status,
    };
  }

  /**
   * 初始化模块
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 初始化LM Studio兼容模块...`);
    console.log(`   端点: ${this.config.baseUrl}`);
    console.log(`   支持模型: ${this.config.models.join(', ')}`);

    try {
      // 测试连接LM Studio
      await this.testConnection();

      this.status = 'healthy';
      this.isInitialized = true;

      this.emit('statusChanged', { health: this.status });
      console.log(`✅ LM Studio兼容模块初始化完成`);
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      console.error(`❌ LM Studio兼容模块初始化失败:`, error.message);
      throw error;
    }
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    console.log(`▶️ LM Studio兼容模块已启动`);
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    this.status = 'unhealthy';
    this.emit('statusChanged', { health: this.status });
    console.log(`⏹️ LM Studio兼容模块已停止`);
  }

  /**
   * 处理请求 - 核心功能
   * 将标准OpenAI协议请求适配为LM Studio兼容格式，但仍返回请求格式给下一层
   */
  async process(input: StandardRequest): Promise<StandardRequest> {
    if (!this.isInitialized) {
      throw new Error('LM Studio兼容模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🔄 LM Studio兼容处理: ${input.model}`);

    try {
      // 验证输入
      this.validateStandardRequest(input);

      // 适配请求以确保LM Studio兼容性
      const adaptedRequest = this.adaptRequestForLMStudio(input);

      const processingTime = Date.now() - startTime;
      console.log(`✅ LM Studio兼容处理完成 (${processingTime}ms)`);

      this.emit('requestProcessed', {
        processingTime,
        success: true,
        model: input.model,
      });

      // 返回适配后的请求格式，让Server层负责实际API调用
      return adaptedRequest;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ LM Studio兼容处理失败 (${processingTime}ms):`, error.message);

      this.emit('requestProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: input.model,
      });

      throw error;
    }
  }

  /**
   * 适配请求以确保LM Studio兼容性
   */
  private adaptRequestForLMStudio(input: StandardRequest): StandardRequest {
    // 应用max_tokens限制
    const modelMaxTokens = this.getModelMaxTokens(input.model);

    // 克隆输入以避免修改原始对象
    const adaptedRequest: StandardRequest = {
      ...input,
      max_tokens: Math.min(input.max_tokens || modelMaxTokens, modelMaxTokens),
    };

    // 确保messages格式正确
    if (adaptedRequest.messages && Array.isArray(adaptedRequest.messages)) {
      adaptedRequest.messages = adaptedRequest.messages.filter(msg => {
        // 安全检查：确保msg对象存在且不为null/undefined
        if (!msg || typeof msg !== 'object') {
          return false;
        }
        return msg.content && typeof msg.content === 'string' && msg.content.trim() && msg.role;
      });
    } else {
      // 如果messages不是数组，初始化为空数组
      adaptedRequest.messages = [];
    }

    console.log(
      `🔧 LM Studio适配完成: max_tokens=${adaptedRequest.max_tokens}, messages=${adaptedRequest.messages?.length || 0}`
    );
    return adaptedRequest;
  }

  /**
   * 验证标准协议请求
   */
  private validateStandardRequest(request: StandardRequest): void {
    if (!request.model) {
      throw new Error('缺少model参数');
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('缺少messages参数或格式无效');
    }

    // 检查模型是否支持
    if (!this.config.models.includes(request.model)) {
      throw new Error(`模型 ${request.model} 不在支持列表中: ${this.config.models.join(', ')}`);
    }
  }

  /**
   * 标准协议 → LM Studio特定格式
   */
  private adaptRequest(standardRequest: StandardRequest): LMStudioRequest {
    const lmstudioRequest: LMStudioRequest = {
      ...standardRequest,
    };

    // LM Studio特定的参数映射
    if (standardRequest.temperature !== undefined) {
      // LM Studio可能对temperature有特定的范围要求
      lmstudioRequest.temperature = Math.max(0.01, Math.min(2.0, standardRequest.temperature));
    }

    // 如果有系统消息，可能需要特殊处理
    const systemMessage = standardRequest.messages.find(m => m.role === 'system');
    if (systemMessage) {
      lmstudioRequest.system_prompt = systemMessage.content;
    }

    return lmstudioRequest;
  }

  /**
   * 从配置文件获取模型的最大输出token限制
   */
  private getModelMaxTokens(model: string): number {
    // 从配置中获取模型的maxTokens设置
    if (this.config && this.config.maxTokens && this.config.maxTokens[model]) {
      // 使用保守的输出token限制，约为总上下文的1/4，确保不超限
      const contextLimit = this.config.maxTokens[model];
      return Math.min(contextLimit / 4, 4096); // 最大4096输出tokens
    }

    // 如果配置中没有找到，使用保守的默认值
    return 1024;
  }

  /**
   * 调用LM Studio API（使用官方OpenAI SDK）
   */
  private async callLMStudio(request: LMStudioRequest): Promise<LMStudioResponse> {
    try {
      if (request.stream) {
        // 流式处理
        throw new Error('流式处理暂未实现'); // TODO: 实现流式处理
      } else {
        // 非流式处理
        // 限制max_tokens防止超出LM Studio上下文长度
        const modelMaxTokens = this.getModelMaxTokens(request.model);
        const limitedMaxTokens = request.max_tokens ? Math.min(request.max_tokens, modelMaxTokens) : modelMaxTokens;

        const response = await this.openaiClient.chat.completions.create({
          model: request.model,
          messages: request.messages as any,
          max_tokens: limitedMaxTokens,
          temperature: request.temperature,
          top_p: request.top_p,
          frequency_penalty: request.frequency_penalty,
          presence_penalty: request.presence_penalty,
          stop: request.stop,
          tools: request.tools,
          tool_choice: request.tool_choice,
          stream: false,
        });

        return response as LMStudioResponse;
      }
    } catch (error) {
      if (error.name === 'APIError') {
        throw new Error(`LM Studio API错误: ${error.message}`);
      } else if (error.name === 'APIConnectionError') {
        throw new Error(`LM Studio连接错误: ${error.message}`);
      } else if (error.name === 'APITimeoutError') {
        throw new Error(`LM Studio请求超时: ${error.message}`);
      } else {
        throw new Error(`LM Studio未知错误: ${error.message}`);
      }
    }
  }

  /**
   * LM Studio响应 → 标准协议格式
   */
  private adaptResponse(lmstudioResponse: LMStudioResponse): StandardResponse {
    // LM Studio的响应通常已经符合OpenAI标准，但可能需要一些清理
    const standardResponse: StandardResponse = {
      id: lmstudioResponse.id,
      object: lmstudioResponse.object,
      created: lmstudioResponse.created,
      model: lmstudioResponse.model,
      choices: lmstudioResponse.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
        finish_reason: choice.finish_reason,
      })),
      usage: {
        prompt_tokens: lmstudioResponse.usage.prompt_tokens,
        completion_tokens: lmstudioResponse.usage.completion_tokens,
        total_tokens: lmstudioResponse.usage.total_tokens,
      },
    };

    return standardResponse;
  }

  /**
   * 测试与LM Studio的连接
   */
  private async testConnection(): Promise<void> {
    try {
      // 获取模型列表来测试连接
      const models = await this.openaiClient.models.list();
      console.log(`🔍 检测到 ${models.data.length} 个LM Studio模型`);

      if (models.data.length === 0) {
        throw new Error('LM Studio没有加载任何模型');
      }
    } catch (error) {
      throw new Error(`LM Studio连接测试失败: ${error.message}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const startTime = Date.now();

    try {
      await this.testConnection();
      const responseTime = Date.now() - startTime;

      this.status = 'healthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: true, details: { responseTime } };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: false, details: { responseTime, error: error.message } };
    }
  }

  /**
   * 获取支持的模型列表
   */
  async getSupportedModels(): Promise<string[]> {
    try {
      const models = await this.openaiClient.models.list();
      return models.data.map(model => model.id);
    } catch (error) {
      console.warn('获取LM Studio模型列表失败，使用配置中的模型列表');
      return this.config.models;
    }
  }

  // Missing ModuleInterface methods
  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async configure(config: any): Promise<void> {
    // Configuration logic
  }

  async reset(): Promise<void> {
    // Reset logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
