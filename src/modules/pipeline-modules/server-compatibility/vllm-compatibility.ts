/**
 * vLLM Server Compatibility Module
 *
 * vLLM OpenAI兼容性模块
 * 按照RCC v4.0架构规范实现
 *
 * @author Jason Zhang
 */

import { BasePipelineModule } from '../base-pipeline-module';
import { OpenAI } from 'openai';
import { PIPELINE_ERROR_MESSAGES } from '../../constants/src/pipeline-constants';

/**
 * vLLM配置接口
 */
export interface VLLMCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  models: string[];
  features: {
    chat: boolean;
    streaming: boolean;
    parallel: boolean;
  };
  vllmSpecific: {
    engineArgs?: Record<string, any>;
    modelPath?: string;
    tensorParallelSize?: number;
    gpuMemoryUtilization?: number;
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
 * vLLM特定请求格式
 */
export interface VLLMRequest extends StandardRequest {
  // vLLM特定参数
  top_k?: number;
  repetition_penalty?: number;
  length_penalty?: number;
  min_length?: number;
  use_beam_search?: boolean;
  best_of?: number;
  logprobs?: number;
  prompt_logprobs?: number;
  skip_special_tokens?: boolean;
  spaces_between_special_tokens?: boolean;
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
    logprobs?: any;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * vLLM兼容性模块
 */
export class VLLMCompatibilityModule extends BasePipelineModule {
  private readonly config: VLLMCompatibilityConfig;
  private openaiClient: OpenAI;

  constructor(config: VLLMCompatibilityConfig) {
    super('vllm-compatibility', 'vLLM Compatibility Module', 'server-compatibility' as any, '1.0.0');

    this.config = config;

    // 使用OpenAI SDK连接vLLM
    this.openaiClient = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'vllm', // vLLM通常不需要API密钥
      timeout: config.timeout,
    });

    console.log(`🚀 初始化vLLM兼容模块: ${config.baseUrl}`);
  }

  /**
   * 启动模块
   */
  protected async doStart(): Promise<void> {
    await this.testConnection();
    console.log(`✅ vLLM兼容模块启动成功`);
  }

  /**
   * 处理请求
   */
  protected async doProcess(input: StandardRequest): Promise<StandardResponse> {
    const startTime = Date.now();
    console.log(`🚀 vLLM兼容处理: ${input.model}`);

    try {
      // 验证输入
      this.validateStandardRequest(input);

      // 转换为vLLM特定格式
      const vllmRequest = this.adaptRequest(input);

      // 调用vLLM API
      const vllmResponse = await this.callVLLM(vllmRequest);

      // 转换响应为标准格式
      const standardResponse = this.adaptResponse(vllmResponse);

      const processingTime = Date.now() - startTime;
      console.log(`✅ vLLM兼容处理完成 (${processingTime}ms)`);

      return standardResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ vLLM兼容处理失败 (${processingTime}ms):`, error.message);
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
        features: this.config.features,
        vllmConfig: this.config.vllmSpecific,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`vLLM健康检查失败: ${error.message}`);
    }
  }

  /**
   * 验证标准请求
   */
  private validateStandardRequest(request: StandardRequest): void {
    if (!request.model) {
      throw new Error(PIPELINE_ERROR_MESSAGES.VALIDATION.MISSING_PARAMETER('model'));
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error(PIPELINE_ERROR_MESSAGES.VALIDATION.INVALID_MESSAGES);
    }

    // 检查模型是否支持（如果配置了具体模型）
    if (this.config.models.length > 0 && !this.config.models.includes(request.model)) {
      throw new Error(PIPELINE_ERROR_MESSAGES.VALIDATION.MODEL_NOT_SUPPORTED(request.model, this.config.models.join(', ')));
    }
  }

  /**
   * 标准请求 → vLLM特定格式
   */
  private adaptRequest(standardRequest: StandardRequest): VLLMRequest {
    const vllmRequest: VLLMRequest = {
      ...standardRequest,
    };

    // vLLM特定参数映射
    if (standardRequest.frequency_penalty !== undefined) {
      // vLLM使用repetition_penalty而不是frequency_penalty
      vllmRequest.repetition_penalty = 1.0 + standardRequest.frequency_penalty;
    }

    // vLLM的temperature范围通常是0-2
    if (standardRequest.temperature !== undefined) {
      vllmRequest.temperature = Math.max(0.001, Math.min(2.0, standardRequest.temperature));
    }

    // vLLM支持更精细的控制
    if (standardRequest.top_p !== undefined) {
      vllmRequest.top_p = standardRequest.top_p;
    }

    // vLLM特定的高性能参数
    if (this.config.features.parallel) {
      vllmRequest.use_beam_search = false; // 禁用beam search以提高并行性能
    }

    return vllmRequest;
  }

  /**
   * 调用vLLM API
   */
  private async callVLLM(request: VLLMRequest): Promise<any> {
    try {
      if (request.stream) {
        throw new Error(PIPELINE_ERROR_MESSAGES.PROCESSING.STREAMING_NOT_IMPLEMENTED);
      }

      // vLLM扩展参数
      const vllmParams: any = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stop: request.stop,
        stream: false,
      };

      // 添加vLLM特定参数
      if (request.top_k !== undefined) {
        vllmParams.top_k = request.top_k;
      }
      if (request.repetition_penalty !== undefined) {
        vllmParams.repetition_penalty = request.repetition_penalty;
      }
      if (request.length_penalty !== undefined) {
        vllmParams.length_penalty = request.length_penalty;
      }
      if (request.logprobs !== undefined) {
        vllmParams.logprobs = request.logprobs;
      }

      const response = await this.openaiClient.chat.completions.create(vllmParams);

      return response;
    } catch (error) {
      if (error.name === 'APIError') {
        throw new Error(`vLLM API错误: ${error.message}`);
      } else if (error.name === 'APIConnectionError') {
        throw new Error(`vLLM连接错误: ${error.message}`);
      } else if (error.name === 'APITimeoutError') {
        throw new Error(`vLLM请求超时: ${error.message}`);
      } else {
        throw new Error(`vLLM未知错误: ${error.message}`);
      }
    }
  }

  /**
   * vLLM响应 → 标准格式
   */
  private adaptResponse(vllmResponse: any): StandardResponse {
    const standardResponse: StandardResponse = {
      id: vllmResponse.id,
      object: vllmResponse.object,
      created: vllmResponse.created,
      model: vllmResponse.model,
      choices: vllmResponse.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
        },
        finish_reason: choice.finish_reason,
        logprobs: choice.logprobs, // vLLM可能返回logprobs
      })),
      usage: {
        prompt_tokens: vllmResponse.usage?.prompt_tokens || 0,
        completion_tokens: vllmResponse.usage?.completion_tokens || 0,
        total_tokens: vllmResponse.usage?.total_tokens || 0,
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
      console.log(`🔍 检测到 ${models.data.length} 个vLLM模型`);

      if (models.data.length === 0) {
        console.warn('⚠️ vLLM没有返回模型列表，但连接正常');
      }
    } catch (error) {
      throw new Error(`vLLM连接测试失败: ${error.message}`);
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
      console.warn('获取vLLM模型列表失败，使用配置中的模型列表');
      return this.config.models;
    }
  }

  /**
   * 获取vLLM特定信息
   */
  async getVLLMInfo(): Promise<any> {
    try {
      // vLLM可能提供特定的信息端点
      // 这里可以扩展获取GPU使用率、模型状态等信息
      return {
        config: this.config.vllmSpecific,
        models: await this.getSupportedModels(),
        features: this.config.features,
      };
    } catch (error) {
      console.warn('获取vLLM信息失败:', error.message);
      return null;
    }
  }
}
