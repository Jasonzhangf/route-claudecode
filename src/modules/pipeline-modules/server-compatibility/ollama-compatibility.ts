/**
 * Ollama Server Compatibility Module
 *
 * Ollama OpenAI兼容性模块
 * 按照RCC v4.0架构规范实现
 *
 * @author Jason Zhang
 */

import { BasePipelineModule } from '../base-pipeline-module';
import { OpenAI } from 'openai';

/**
 * Ollama配置接口
 */
export interface OllamaCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  models: string[];
  features: {
    chat: boolean;
    embedding: boolean;
    streaming: boolean;
  };
}

/**
 * 标准请求接口
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
}

/**
 * Ollama特定请求格式
 */
export interface OllamaRequest extends StandardRequest {
  // Ollama特定参数
  top_k?: number;
  repeat_penalty?: number;
  num_predict?: number;
  tfs_z?: number;
  typical_p?: number;
  seed?: number;
}

/**
 * 标准响应接口
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
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Ollama兼容性模块
 */
export class OllamaCompatibilityModule extends BasePipelineModule {
  private readonly config: OllamaCompatibilityConfig;
  private openaiClient: OpenAI;

  constructor(config: OllamaCompatibilityConfig) {
    super('ollama-compatibility', 'Ollama Compatibility Module', 'server-compatibility' as any, '1.0.0');

    this.config = config;

    // 使用OpenAI SDK连接Ollama
    this.openaiClient = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'ollama', // Ollama通常不需要API密钥
      timeout: config.timeout,
    });

    console.log(`🦙 初始化Ollama兼容模块: ${config.baseUrl}`);
  }

  /**
   * 启动模块
   */
  protected async doStart(): Promise<void> {
    await this.testConnection();
    console.log(`✅ Ollama兼容模块启动成功`);
  }

  /**
   * 处理请求
   */
  protected async doProcess(input: StandardRequest): Promise<StandardResponse> {
    const startTime = Date.now();
    console.log(`🦙 Ollama兼容处理: ${input.model}`);

    try {
      // 验证输入
      this.validateStandardRequest(input);

      // 转换为Ollama特定格式
      const ollamaRequest = this.adaptRequest(input);

      // 调用Ollama API
      const ollamaResponse = await this.callOllama(ollamaRequest);

      // 转换响应为标准格式
      const standardResponse = this.adaptResponse(ollamaResponse);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Ollama兼容处理完成 (${processingTime}ms)`);

      return standardResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Ollama兼容处理失败 (${processingTime}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  protected async doHealthCheck(): Promise<any> {
    try {
      await this.testConnection();
      return {
        status: 'healthy',
        endpoint: this.config.baseUrl,
        models: this.config.models,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Ollama健康检查失败: ${error.message}`);
    }
  }

  /**
   * 验证标准请求
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
   * 标准请求 → Ollama特定格式
   */
  private adaptRequest(standardRequest: StandardRequest): OllamaRequest {
    const ollamaRequest: OllamaRequest = {
      ...standardRequest,
    };

    // Ollama特定参数映射
    if (standardRequest.max_tokens !== undefined) {
      ollamaRequest.num_predict = standardRequest.max_tokens;
    }

    // Ollama的temperature范围是0-2
    if (standardRequest.temperature !== undefined) {
      ollamaRequest.temperature = Math.max(0, Math.min(2, standardRequest.temperature));
    }

    // Ollama特定参数
    if (standardRequest.top_p !== undefined) {
      ollamaRequest.top_p = standardRequest.top_p;
    }

    return ollamaRequest;
  }

  /**
   * 调用Ollama API
   */
  private async callOllama(request: OllamaRequest): Promise<any> {
    try {
      if (request.stream) {
        throw new Error('流式处理暂未实现');
      }

      const response = await this.openaiClient.chat.completions.create({
        model: request.model,
        messages: request.messages as any,
        max_tokens: request.num_predict,
        temperature: request.temperature,
        top_p: request.top_p,
        stop: request.stop,
        stream: false,
      });

      return response;
    } catch (error) {
      if (error.name === 'APIError') {
        throw new Error(`Ollama API错误: ${error.message}`);
      } else if (error.name === 'APIConnectionError') {
        throw new Error(`Ollama连接错误: ${error.message}`);
      } else if (error.name === 'APITimeoutError') {
        throw new Error(`Ollama请求超时: ${error.message}`);
      } else {
        throw new Error(`Ollama未知错误: ${error.message}`);
      }
    }
  }

  /**
   * Ollama响应 → 标准格式
   */
  private adaptResponse(ollamaResponse: any): StandardResponse {
    const standardResponse: StandardResponse = {
      id: ollamaResponse.id,
      object: ollamaResponse.object,
      created: ollamaResponse.created,
      model: ollamaResponse.model,
      choices: ollamaResponse.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
        },
        finish_reason: choice.finish_reason,
      })),
      usage: {
        prompt_tokens: ollamaResponse.usage?.prompt_tokens || 0,
        completion_tokens: ollamaResponse.usage?.completion_tokens || 0,
        total_tokens: ollamaResponse.usage?.total_tokens || 0,
      },
    };

    return standardResponse;
  }

  /**
   * 测试连接
   */
  private async testConnection(): Promise<void> {
    try {
      const models = await this.openaiClient.models.list();
      console.log(`🔍 检测到 ${models.data.length} 个Ollama模型`);

      if (models.data.length === 0) {
        throw new Error('Ollama没有可用模型');
      }
    } catch (error) {
      throw new Error(`Ollama连接测试失败: ${error.message}`);
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
      console.warn('获取Ollama模型列表失败，使用配置中的模型列表');
      return this.config.models;
    }
  }
}
