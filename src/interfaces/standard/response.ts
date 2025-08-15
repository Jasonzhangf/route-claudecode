/**
 * 标准响应数据结构接口
 * 
 * 定义系统内部使用的标准化响应格式
 * 
 * @author Jason Zhang
 */

import { Message } from './message';

/**
 * 标准响应接口
 */
export interface StandardResponse {
  readonly id: string;
  readonly choices: Choice[];
  readonly usage?: Usage;
  readonly model?: string;
  readonly created?: number;
  readonly metadata: ResponseMetadata;
  readonly timestamp: Date;
}

/**
 * 选择项
 */
export interface Choice {
  readonly index: number;
  readonly message: Message;
  readonly finishReason: FinishReason;
  readonly logprobs?: LogProbs;
}

/**
 * 完成原因
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';

/**
 * 对数概率信息
 */
export interface LogProbs {
  tokens: string[];
  tokenLogprobs: number[];
  topLogprobs: Record<string, number>[];
  textOffset: number[];
}

/**
 * 使用统计
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptTokensDetails?: {
    cachedTokens?: number;
  };
  completionTokensDetails?: {
    reasoningTokens?: number;
  };
}

/**
 * 响应元数据
 */
export interface ResponseMetadata {
  requestId: string;
  provider: string;
  model: string;
  originalFormat: 'anthropic' | 'openai' | 'gemini';
  targetFormat: 'anthropic' | 'openai' | 'gemini';
  processingSteps: string[];
  performance: ResponsePerformanceMetrics;
  quality?: ResponseQualityMetrics;
  transformations?: TransformationLog[];
}

/**
 * 响应性能指标
 */
export interface ResponsePerformanceMetrics {
  totalTime: number;
  apiCallTime: number;
  transformationTime: number;
  validationTime: number;
  retryCount: number;
  cacheHit?: boolean;
}

/**
 * 响应质量指标
 */
export interface ResponseQualityMetrics {
  coherenceScore?: number;
  relevanceScore?: number;
  safetyScore?: number;
  toxicityScore?: number;
  factualityScore?: number;
}

/**
 * 转换日志
 */
export interface TransformationLog {
  step: string;
  input: any;
  output: any;
  transformationTime: number;
  warnings?: string[];
  errors?: string[];
}

/**
 * 流式响应接口
 */
export interface StreamResponse {
  id: string;
  choices: StreamChoice[];
  created?: number;
  model?: string;
  metadata?: Partial<ResponseMetadata>;
}

/**
 * 流式选择项
 */
export interface StreamChoice {
  index: number;
  delta: MessageDelta;
  finishReason?: FinishReason;
  logprobs?: LogProbs;
}

/**
 * 消息增量
 */
export interface MessageDelta {
  role?: 'assistant';
  content?: string;
  toolCalls?: ToolCallDelta[];
}

/**
 * 工具调用增量
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * 可变的标准响应接口（用于构建器）
 */
interface MutableStandardResponse {
  id: string;
  choices: Choice[];
  usage?: Usage;
  model?: string;
  created?: number;
  metadata: ResponseMetadata;
  timestamp: Date;
}

/**
 * 标准响应构建器
 */
export class StandardResponseBuilder {
  private response: Partial<MutableStandardResponse> = {};
  
  constructor(id: string) {
    this.response = {
      id,
      choices: [],
      timestamp: new Date(),
      metadata: {
        requestId: '',
        provider: '',
        model: '',
        originalFormat: 'anthropic',
        targetFormat: 'anthropic',
        processingSteps: [],
        performance: {
          totalTime: 0,
          apiCallTime: 0,
          transformationTime: 0,
          validationTime: 0,
          retryCount: 0
        }
      }
    };
  }
  
  /**
   * 设置选择项列表
   */
  setChoices(choices: Choice[]): this {
    this.response.choices = choices;
    return this;
  }
  
  /**
   * 添加选择项
   */
  addChoice(choice: Choice): this {
    if (!this.response.choices) {
      this.response.choices = [];
    }
    this.response.choices.push(choice);
    return this;
  }
  
  /**
   * 设置使用统计
   */
  setUsage(usage: Usage): this {
    this.response.usage = usage;
    return this;
  }
  
  /**
   * 设置模型名称
   */
  setModel(model: string): this {
    this.response.model = model;
    return this;
  }
  
  /**
   * 设置创建时间
   */
  setCreated(created: number): this {
    this.response.created = created;
    return this;
  }
  
  /**
   * 设置元数据
   */
  setMetadata(metadata: Partial<ResponseMetadata>): this {
    this.response.metadata = { ...this.response.metadata!, ...metadata };
    return this;
  }
  
  /**
   * 添加处理步骤
   */
  addProcessingStep(step: string): this {
    if (!this.response.metadata) {
      this.response.metadata = {} as ResponseMetadata;
    }
    if (!this.response.metadata.processingSteps) {
      this.response.metadata.processingSteps = [];
    }
    this.response.metadata.processingSteps.push(step);
    return this;
  }
  
  /**
   * 设置性能指标
   */
  setPerformanceMetrics(metrics: Partial<ResponsePerformanceMetrics>): this {
    if (!this.response.metadata) {
      this.response.metadata = {} as ResponseMetadata;
    }
    this.response.metadata.performance = { 
      ...this.response.metadata.performance, 
      ...metrics 
    };
    return this;
  }
  
  /**
   * 构建响应
   */
  build(): StandardResponse {
    // 验证必需字段
    if (!this.response.id || !this.response.choices || !this.response.metadata) {
      throw new Error('Missing required fields in StandardResponse');
    }
    
    return this.response as StandardResponse;
  }
  
  /**
   * 从Anthropic格式创建
   */
  static fromAnthropic(anthropicResponse: any): StandardResponseBuilder {
    const builder = new StandardResponseBuilder(anthropicResponse.id);
    
    // 转换选择项
    const choices: Choice[] = [{
      index: 0,
      message: {
        role: 'assistant',
        content: anthropicResponse.content || []
      },
      finishReason: mapAnthropicStopReason(anthropicResponse.stop_reason)
    }];
    
    builder.setChoices(choices);
    
    if (anthropicResponse.usage) {
      builder.setUsage({
        promptTokens: anthropicResponse.usage.input_tokens || 0,
        completionTokens: anthropicResponse.usage.output_tokens || 0,
        totalTokens: (anthropicResponse.usage.input_tokens || 0) + (anthropicResponse.usage.output_tokens || 0)
      });
    }
    
    if (anthropicResponse.model) {
      builder.setModel(anthropicResponse.model);
    }
    
    builder.setMetadata({
      originalFormat: 'anthropic',
      targetFormat: 'anthropic'
    });
    
    return builder;
  }
  
  /**
   * 从OpenAI格式创建
   */
  static fromOpenAI(openaiResponse: any): StandardResponseBuilder {
    const builder = new StandardResponseBuilder(openaiResponse.id);
    
    // 转换选择项
    const choices: Choice[] = openaiResponse.choices?.map((choice: any) => ({
      index: choice.index,
      message: choice.message,
      finishReason: choice.finish_reason,
      logprobs: choice.logprobs
    })) || [];
    
    builder.setChoices(choices);
    
    if (openaiResponse.usage) {
      builder.setUsage(openaiResponse.usage);
    }
    
    if (openaiResponse.model) {
      builder.setModel(openaiResponse.model);
    }
    
    if (openaiResponse.created) {
      builder.setCreated(openaiResponse.created);
    }
    
    builder.setMetadata({
      originalFormat: 'openai',
      targetFormat: 'openai'
    });
    
    return builder;
  }
}

/**
 * 映射Anthropic停止原因
 */
function mapAnthropicStopReason(anthropicReason: string): FinishReason {
  switch (anthropicReason) {
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    case 'stop_sequence':
      return 'stop';
    default:
      return 'stop';
  }
}