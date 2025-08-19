/**
 * 标准请求数据结构接口
 *
 * 定义系统内部使用的标准化请求格式
 *
 * @author Jason Zhang
 */

import { Message } from './message';
import { Tool } from './tool';

/**
 * 标准请求接口
 */
export interface StandardRequest {
  readonly id: string;
  readonly model: string;
  readonly messages: Message[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly max_tokens?: number; // 兼容Anthropic格式
  readonly top_p?: number; // 兼容Anthropic格式
  readonly stream?: boolean;
  readonly system?: string; // Anthropic系统消息
  readonly tools?: Tool[];
  readonly toolChoice?: ToolChoice;
  readonly tool_choice?: ToolChoice; // 兼容Anthropic格式
  readonly stop?: string | string[];
  readonly metadata: RequestMetadata;
  readonly timestamp: Date;
}

/**
 * 工具选择设置
 */
export type ToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

/**
 * 请求元数据
 */
export interface RequestMetadata {
  originalFormat: 'anthropic' | 'openai' | 'gemini';
  targetFormat: 'anthropic' | 'openai' | 'gemini';
  provider: string;
  category: string;
  priority?: number;
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  debugEnabled?: boolean;
  captureLevel?: 'basic' | 'full';
  processingSteps?: string[];
  routingHints?: RoutingHints;
  performance?: PerformanceMetrics;
}

/**
 * 路由提示
 */
export interface RoutingHints {
  preferredProvider?: string;
  excludeProviders?: string[];
  requireFeatures?: string[];
  maxLatency?: number;
  costPreference?: 'low' | 'medium' | 'high';
  qualityPreference?: 'fast' | 'balanced' | 'best';
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  startTime: Date;
  routingTime?: number;
  preprocessingTime?: number;
  apiCallTime?: number;
  postprocessingTime?: number;
  totalTime?: number;
  retryCount?: number;
}

/**
 * 可变的标准请求接口（用于构建器）
 */
interface MutableStandardRequest {
  id: string;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  stop?: string | string[];
  metadata: RequestMetadata;
  timestamp: Date;
}

/**
 * 标准请求构建器
 */
export class StandardRequestBuilder {
  private request: Partial<MutableStandardRequest> = {};

  constructor(id: string, model: string) {
    this.request = {
      id,
      model,
      messages: [],
      timestamp: new Date(),
      metadata: {
        originalFormat: 'anthropic',
        targetFormat: 'anthropic',
        provider: '',
        category: 'default',
        processingSteps: [],
      },
    };
  }

  /**
   * 设置消息列表
   */
  setMessages(messages: Message[]): this {
    this.request.messages = messages;
    return this;
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): this {
    if (!this.request.messages) {
      this.request.messages = [];
    }
    this.request.messages.push(message);
    return this;
  }

  /**
   * 设置温度参数
   */
  setTemperature(temperature: number): this {
    this.request.temperature = temperature;
    return this;
  }

  /**
   * 设置最大令牌数
   */
  setMaxTokens(maxTokens: number): this {
    this.request.maxTokens = maxTokens;
    return this;
  }

  /**
   * 设置流式模式
   */
  setStream(stream: boolean): this {
    this.request.stream = stream;
    return this;
  }

  /**
   * 设置工具列表
   */
  setTools(tools: Tool[]): this {
    this.request.tools = tools;
    return this;
  }

  /**
   * 设置工具选择
   */
  setToolChoice(toolChoice: ToolChoice): this {
    this.request.toolChoice = toolChoice;
    return this;
  }

  /**
   * 设置停止词
   */
  setStop(stop: string | string[]): this {
    this.request.stop = stop;
    return this;
  }

  /**
   * 设置元数据
   */
  setMetadata(metadata: Partial<RequestMetadata>): this {
    this.request.metadata = { ...this.request.metadata!, ...metadata };
    return this;
  }

  /**
   * 设置路由提示
   */
  setRoutingHints(hints: RoutingHints): this {
    if (!this.request.metadata) {
      this.request.metadata = {} as RequestMetadata;
    }
    this.request.metadata.routingHints = hints;
    return this;
  }

  /**
   * 构建请求
   */
  build(): StandardRequest {
    // 验证必需字段
    if (!this.request.id || !this.request.model || !this.request.messages || !this.request.metadata) {
      throw new Error('Missing required fields in StandardRequest');
    }

    return this.request as StandardRequest;
  }

  /**
   * 从Anthropic格式创建
   */
  static fromAnthropic(anthropicRequest: any): StandardRequestBuilder {
    const builder = new StandardRequestBuilder(anthropicRequest.id || generateRequestId(), anthropicRequest.model);

    builder
      .setMessages(anthropicRequest.messages || [])
      .setMaxTokens(anthropicRequest.max_tokens)
      .setTemperature(anthropicRequest.temperature)
      .setStream(anthropicRequest.stream || false)
      .setMetadata({
        originalFormat: 'anthropic',
        targetFormat: 'anthropic',
        provider: '',
        category: 'default',
      });

    if (anthropicRequest.tools) {
      builder.setTools(anthropicRequest.tools);
    }

    if (anthropicRequest.tool_choice) {
      builder.setToolChoice(anthropicRequest.tool_choice);
    }

    return builder;
  }

  /**
   * 从OpenAI格式创建
   */
  static fromOpenAI(openaiRequest: any): StandardRequestBuilder {
    const builder = new StandardRequestBuilder(openaiRequest.id || generateRequestId(), openaiRequest.model);

    builder
      .setMessages(openaiRequest.messages || [])
      .setMaxTokens(openaiRequest.max_tokens)
      .setTemperature(openaiRequest.temperature)
      .setStream(openaiRequest.stream || false)
      .setMetadata({
        originalFormat: 'openai',
        targetFormat: 'openai',
        provider: '',
        category: 'default',
      });

    if (openaiRequest.tools) {
      builder.setTools(openaiRequest.tools);
    }

    if (openaiRequest.tool_choice) {
      builder.setToolChoice(openaiRequest.tool_choice);
    }

    if (openaiRequest.stop) {
      builder.setStop(openaiRequest.stop);
    }

    return builder;
  }
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
