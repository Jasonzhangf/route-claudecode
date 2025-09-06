/**
 * OpenAI Protocol Module - 四层双向处理架构实现
 *
 * Protocol模块：负责协议控制转换（流式 ↔ 非流式）
 * 按照RCC v4.0四层双向处理架构设计实现：
 * - 预配置模块：所有配置在组装时固化
 * - 双向处理：processRequest和processResponse接口
 * - 协议内控制：流式↔非流式转换、参数验证、错误处理
 * - 并发安全：无状态设计支持多请求并发
 *
 * @author Jason Zhang
 * @version 2.0.0 - 四层双向处理架构
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../interfaces/module/base-module';
import { BidirectionalProtocolProcessor, RequestContext, ResponseContext } from '../../interfaces/module/four-layer-interfaces';
import { EventEmitter } from 'events';

/**
 * 流式请求格式
 */
export interface StreamRequest {
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
  stream: true;
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
 * 非流式请求格式
 */
export interface NonStreamRequest {
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
  stream?: false;
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
 * 流式响应块
 */
export interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: null | 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
}

/**
 * 非流式响应格式
 */
export interface NonStreamResponse {
  id: string;
  object: 'chat.completion';
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
 * 流式响应完整累积结果
 */
export interface StreamResponse {
  chunks: StreamChunk[];
  aggregatedResponse: NonStreamResponse;
}

/**
 * 协议错误类型
 */
export class ProtocolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/**
 * 四层双向协议控制器接口
 */
export interface BidirectionalProtocolController {
  processRequest(input: any): Promise<any>;
  processResponse(input: any): Promise<any>;
  validateProtocol(data: any): boolean;
  handleProtocolError(error: any): any;
}

/**
 * 协议预配置接口
 */
export interface ProtocolPreConfig {
  enableStreamConversion?: boolean;
  enableProtocolValidation?: boolean;
  defaultStreamMode?: boolean;
  maxRequestSize?: number;
  timeout?: number;
  concurrencyLimit?: number;
}

/**
 * 协议控制器接口 - 兼容性保持
 * @deprecated 使用 BidirectionalProtocolController
 */
export interface ProtocolController extends BidirectionalProtocolController {}

/**
 * OpenAI协议模块 - 四层双向处理架构实现
 * 支持完整的协议内控制机制和预配置模块
 */
export class OpenAIProtocolModule extends EventEmitter implements ModuleInterface, BidirectionalProtocolController, ProtocolController {
  private readonly id: string = 'openai-protocol-module';
  private readonly name: string = 'OpenAI Protocol Module';
  private readonly type: ModuleType = ModuleType.PROTOCOL;
  private readonly version: string = '2.0.0';
  private preConfig: ProtocolPreConfig;
  private status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  private connections: Map<string, ModuleInterface> = new Map();
  private readonly isPreConfigured: boolean = true;
  private metrics = {
    requestsProcessed: 0,
    responsesProcessed: 0,
    errorsHandled: 0,
    streamConversions: 0,
    nonStreamConversions: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0
  };

  constructor(preConfig?: ProtocolPreConfig) {
    super();
    
    // 固化预配置 - 运行时不可更改
    this.preConfig = {
      enableStreamConversion: preConfig?.enableStreamConversion ?? true,
      enableProtocolValidation: preConfig?.enableProtocolValidation ?? true,
      defaultStreamMode: preConfig?.defaultStreamMode ?? false,
      maxRequestSize: preConfig?.maxRequestSize ?? 10 * 1024 * 1024, // 10MB
      timeout: preConfig?.timeout ?? 30000,
      concurrencyLimit: preConfig?.concurrencyLimit ?? 20
    };
    
    console.log(`🌐 初始化OpenAI协议模块 (预配置模式)`, {
      enableStreamConversion: this.preConfig.enableStreamConversion,
      enableProtocolValidation: this.preConfig.enableProtocolValidation,
      defaultStreamMode: this.preConfig.defaultStreamMode
    });
  }

  /**
   * 处理请求 - 四层双向处理架构主接口
   */
  async processRequest(input: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 预配置验证
      if (!this.preConfig.enableProtocolValidation) {
        console.log(`➡️ 协议验证已禁用，直接传递请求`);
        this.updateRequestMetrics(Date.now() - startTime, true);
        return input;
      }
      
      // 验证协议格式
      this.validateProtocol(input);
      
      // 处理流式控制（如果启用）
      if (this.preConfig.enableStreamConversion && this.isStreamRequest(input)) {
        console.log(`🌊 协议控制: 流式请求 → 非流式请求`);
        const result = this.convertToNonStreaming(input as StreamRequest);
        this.metrics.streamConversions++;
        this.updateRequestMetrics(Date.now() - startTime, true);
        console.log(`✅ 协议流式控制完成 (${Date.now() - startTime}ms)`);
        return result;
      } else if (this.isNonStreamRequest(input)) {
        console.log(`➡️ 协议控制: 非流式请求直接传递`);
        this.updateRequestMetrics(Date.now() - startTime, true);
        console.log(`✅ 协议请求处理完成 (${Date.now() - startTime}ms)`);
        return input;
      } else {
        throw new ProtocolError('不支持的请求格式', 'UNSUPPORTED_REQUEST_FORMAT');
      }
    } catch (error) {
      this.updateRequestMetrics(Date.now() - startTime, false);
      const processingTime = Date.now() - startTime;
      console.error(`❌ 协议请求处理失败 (${processingTime}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 处理响应 - 四层双向处理架构主接口
   */
  async processResponse(input: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 预配置验证
      if (!this.preConfig.enableProtocolValidation) {
        console.log(`➡️ 协议验证已禁用，直接传递响应`);
        this.updateResponseMetrics(Date.now() - startTime, true);
        return input;
      }
      
      // 验证协议格式
      this.validateProtocol(input);
      
      // 处理流式控制（如果启用）
      if (this.preConfig.enableStreamConversion && this.isNonStreamResponse(input)) {
        console.log(`🔄 协议控制: 非流式响应 → 流式响应`);
        const result = this.convertToStreaming(input as NonStreamResponse);
        this.metrics.streamConversions++;
        this.updateResponseMetrics(Date.now() - startTime, true);
        console.log(`✅ 协议响应流式控制完成 (${Date.now() - startTime}ms)`);
        return result;
      } else if (this.isStreamResponse(input)) {
        console.log(`➡️ 协议控制: 流式响应直接传递`);
        this.updateResponseMetrics(Date.now() - startTime, true);
        console.log(`✅ 协议响应处理完成 (${Date.now() - startTime}ms)`);
        return input;
      } else {
        throw new ProtocolError('不支持的响应格式', 'UNSUPPORTED_RESPONSE_FORMAT');
      }
    } catch (error) {
      this.updateResponseMetrics(Date.now() - startTime, false);
      const processingTime = Date.now() - startTime;
      console.error(`❌ 协议响应处理失败 (${processingTime}ms):`, error.message);
      throw error;
    }
  }

  /**
   * 处理协议转换 - 兼容旧接口
   * @deprecated 使用 processRequest 或 processResponse
   */
  async process(
    input: StreamRequest | NonStreamRequest | NonStreamResponse
  ): Promise<NonStreamRequest | StreamResponse> {
    // 自动检测是请求还是响应，调用相应的新接口
    if (this.isRequest(input)) {
      return await this.processRequest(input);
    } else if (this.isResponse(input)) {
      return await this.processResponse(input);
    } else {
      throw new ProtocolError('不支持的输入格式', 'UNSUPPORTED_FORMAT');
    }
  }



  /**
   * 协议验证 - 基于预配置的验证规则
   */
  validateProtocol(data: any): boolean {
    // 如果禁用了协议验证，直接返回true
    if (!this.preConfig.enableProtocolValidation) {
      return true;
    }
    
    if (!data || typeof data !== 'object') {
      throw new ProtocolError('无效的协议数据格式', 'INVALID_PROTOCOL_DATA');
    }
    
    // 检查请求大小限制
    const dataSize = JSON.stringify(data).length;
    if (dataSize > this.preConfig.maxRequestSize!) {
      throw new ProtocolError(
        `请求大小超出限制: ${dataSize} > ${this.preConfig.maxRequestSize}`, 
        'REQUEST_SIZE_EXCEEDED'
      );
    }
    
    // 验证必需字段
    if (this.isRequest(data)) {
      if (!data.model || typeof data.model !== 'string') {
        throw new ProtocolError('缺少或无效的model字段', 'INVALID_MODEL_FIELD');
      }
      
      if (!Array.isArray(data.messages)) {
        throw new ProtocolError('缺少或无效的messages字段', 'INVALID_MESSAGES_FIELD');
      }
    } else if (this.isResponse(data)) {
      if (!data.id || typeof data.id !== 'string') {
        throw new ProtocolError('缺少或无效的id字段', 'INVALID_ID_FIELD');
      }
      
      if (!data.object || !['chat.completion', 'chat.completion.chunk'].includes(data.object)) {
        throw new ProtocolError('缺少或无效的object字段', 'INVALID_OBJECT_FIELD');
      }
    }
    
    return true;
  }

  /**
   * 协议错误处理
   */
  handleProtocolError(error: any): any {
    this.metrics.errorsHandled++;
    
    if (error instanceof ProtocolError) {
      console.error(`❌ 协议错误 [${error.code}]: ${error.message}`);
      // 返回标准化错误格式
      return {
        error: {
          type: 'protocol_error',
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    } else {
      console.error(`❌ 未知协议错误: ${error.message}`);
      // 返回通用错误格式
      return {
        error: {
          type: 'unknown_error',
          code: 'UNKNOWN_PROTOCOL_ERROR',
          message: error.message
        }
      };
    }
  }

  /**
   * 判断是否为请求
   */
  private isRequest(input: any): boolean {
    return input && (
      input.messages !== undefined || 
      input.model !== undefined || 
      input.system !== undefined ||
      input.tools !== undefined
    );
  }

  /**
   * 判断是否为响应
   */
  private isResponse(input: any): boolean {
    return input && (
      input.choices !== undefined || 
      input.id !== undefined || 
      input.object !== undefined ||
      input.usage !== undefined
    );
  }

  /**
   * 判断是否为流式请求
   */
  private isStreamRequest(input: any): boolean {
    return input && input.stream === true && Array.isArray(input.messages);
  }

  /**
   * 判断是否为非流式请求
   */
  private isNonStreamRequest(input: any): boolean {
    return (
      input &&
      Array.isArray(input.messages) &&
      typeof input.model === 'string' &&
      (input.stream === false || input.stream === undefined)
    );
  }

  /**
   * 判断是否为非流式响应
   * 支持标准OpenAI格式和ModelScope兼容格式
   */
  private isNonStreamResponse(input: any): boolean {
    // 基本结构检查
    if (!input || !Array.isArray(input.choices)) {
      return false;
    }

    // 检查object字段（可选）
    const hasValidObject = !input.object || input.object === 'chat.completion';

    // 检查usage字段的多种格式
    const hasValidUsage =
      input.usage &&
      // 标准OpenAI格式
      (typeof input.usage.total_tokens === 'number' ||
        // ModelScope格式（有时可能缺少total_tokens但有其他tokens）
        (typeof input.usage.prompt_tokens === 'number' && typeof input.usage.completion_tokens === 'number') ||
        // 其他兼容格式
        (typeof input.usage.input_tokens === 'number' && typeof input.usage.output_tokens === 'number'));

    // 检查响应的其他标识符
    const hasResponseIdentifiers = input.id || input.created || input.model;

    return hasValidObject && hasValidUsage && hasResponseIdentifiers;
  }

  /**
   * 判断是否为流式响应
   */
  private isStreamResponse(input: any): boolean {
    return input && Array.isArray(input.chunks) && input.aggregatedResponse;
  }

  /**
   * 流式请求 → 非流式请求
   */
  convertToNonStreaming(streamRequest: StreamRequest): NonStreamRequest {
    // 验证输入
    this.validateStreamRequest(streamRequest);

    const nonStreamRequest: NonStreamRequest = {
      model: streamRequest.model,
      messages: streamRequest.messages,
      max_tokens: streamRequest.max_tokens,
      temperature: streamRequest.temperature,
      top_p: streamRequest.top_p,
      frequency_penalty: streamRequest.frequency_penalty,
      presence_penalty: streamRequest.presence_penalty,
      stop: streamRequest.stop,
      stream: false, // 转换为非流式
      tools: streamRequest.tools,
      tool_choice: streamRequest.tool_choice,
    };

    console.log(`🔄 协议转换: stream=true → stream=false`);
    return nonStreamRequest;
  }

  /**
   * 非流式响应 → 流式响应
   */
  convertToStreaming(nonStreamResponse: NonStreamResponse): StreamResponse {
    // 验证输入
    this.validateNonStreamResponse(nonStreamResponse);

    const chunks: StreamChunk[] = [];
    const choice = nonStreamResponse.choices[0]; // 取第一个选择

    // 生成开始chunk
    const startChunk: StreamChunk = {
      id: nonStreamResponse.id,
      object: 'chat.completion.chunk',
      created: nonStreamResponse.created,
      model: nonStreamResponse.model,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        },
      ],
    };
    chunks.push(startChunk);

    // 处理内容
    if (choice.message.content) {
      // 将内容分割成多个chunk模拟流式传输
      const content = choice.message.content;
      const chunkSize = Math.max(1, Math.ceil(content.length / 10)); // 分成大约10个chunk

      for (let i = 0; i < content.length; i += chunkSize) {
        const contentPart = content.slice(i, i + chunkSize);
        const contentChunk: StreamChunk = {
          id: nonStreamResponse.id,
          object: 'chat.completion.chunk',
          created: nonStreamResponse.created,
          model: nonStreamResponse.model,
          choices: [
            {
              index: 0,
              delta: { content: contentPart },
              finish_reason: null,
            },
          ],
        };
        chunks.push(contentChunk);
      }
    }

    // 处理工具调用
    if (choice.message.tool_calls) {
      for (let i = 0; i < choice.message.tool_calls.length; i++) {
        const toolCall = choice.message.tool_calls[i];

        // 工具调用开始chunk
        const toolStartChunk: StreamChunk = {
          id: nonStreamResponse.id,
          object: 'chat.completion.chunk',
          created: nonStreamResponse.created,
          model: nonStreamResponse.model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: i,
                    id: toolCall.id,
                    type: 'function',
                    function: { name: toolCall.function.name },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        chunks.push(toolStartChunk);

        // 工具参数chunk
        const toolArgsChunk: StreamChunk = {
          id: nonStreamResponse.id,
          object: 'chat.completion.chunk',
          created: nonStreamResponse.created,
          model: nonStreamResponse.model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: i,
                    function: { arguments: toolCall.function.arguments },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        chunks.push(toolArgsChunk);
      }
    }

    // 结束chunk
    const endChunk: StreamChunk = {
      id: nonStreamResponse.id,
      object: 'chat.completion.chunk',
      created: nonStreamResponse.created,
      model: nonStreamResponse.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: choice.finish_reason,
        },
      ],
    };
    chunks.push(endChunk);

    console.log(`🌊 协议转换: 生成${chunks.length}个流式chunk`);

    return {
      chunks,
      aggregatedResponse: nonStreamResponse,
    };
  }

  /**
   * 验证流式请求格式
   */
  validateStreamRequest(request: StreamRequest): boolean {
    if (!request.model || typeof request.model !== 'string') {
      throw new ProtocolError('缺少model参数', 'MISSING_MODEL');
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new ProtocolError('缺少messages参数或格式无效', 'INVALID_MESSAGES');
    }

    if (request.stream !== true) {
      throw new ProtocolError('stream参数必须为true', 'INVALID_STREAM_FLAG');
    }

    for (const message of request.messages) {
      if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new ProtocolError(`无效的消息角色: ${message.role}`, 'INVALID_MESSAGE_ROLE');
      }
      if (!message.content || typeof message.content !== 'string') {
        throw new ProtocolError('消息内容不能为空', 'EMPTY_MESSAGE_CONTENT');
      }
    }

    return true;
  }

  /**
   * 验证非流式响应格式
   */
  validateNonStreamResponse(response: NonStreamResponse): boolean {
    if (!response.id || typeof response.id !== 'string') {
      throw new ProtocolError('缺少响应ID', 'MISSING_RESPONSE_ID');
    }

    if (response.object !== 'chat.completion') {
      throw new ProtocolError('无效的响应对象类型', 'INVALID_RESPONSE_OBJECT');
    }

    if (!Array.isArray(response.choices) || response.choices.length === 0) {
      throw new ProtocolError('缺少响应choices', 'MISSING_RESPONSE_CHOICES');
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      throw new ProtocolError('缺少usage信息', 'MISSING_USAGE_INFO');
    }

    return true;
  }

  /**
   * 聚合流式chunk为完整响应
   * 用于将多个chunk重新组合成完整的响应
   */
  aggregateStreamChunks(chunks: StreamChunk[]): NonStreamResponse {
    if (chunks.length === 0) {
      throw new ProtocolError('chunk列表不能为空', 'EMPTY_CHUNKS_LIST');
    }

    const firstChunk = chunks[0];
    let content = '';
    const toolCalls: any[] = [];
    let finishReason: string = 'stop';

    // 聚合所有chunk的内容
    for (const chunk of chunks) {
      const choice = chunk.choices[0];
      if (choice.delta.content) {
        content += choice.delta.content;
      }

      if (choice.delta.tool_calls) {
        // 处理工具调用（简化版）
        for (const toolCall of choice.delta.tool_calls) {
          if (toolCall.id && toolCall.function?.name) {
            toolCalls.push({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments || '',
              },
            });
          }
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    const aggregatedResponse: NonStreamResponse = {
      id: firstChunk.id,
      object: 'chat.completion',
      created: firstChunk.created,
      model: firstChunk.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content || undefined,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finish_reason: finishReason as any,
        },
      ],
      usage: {
        prompt_tokens: 0, // 需要从外部计算
        completion_tokens: 0, // 需要从外部计算
        total_tokens: 0, // 需要从外部计算
      },
    };

    return aggregatedResponse;
  }

  // ModuleInterface 实现
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
      type: this.type,
      status: 'running',
      health: this.status,
    };
  }

  getMetrics(): ModuleMetrics {
    const totalOperations = this.metrics.requestsProcessed + this.metrics.responsesProcessed;
    return {
      requestsProcessed: totalOperations,
      averageProcessingTime: this.metrics.averageProcessingTime,
      errorRate: this.metrics.errorsHandled / Math.max(totalOperations, 1),
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  async configure(config: any): Promise<void> {
    // 预配置模式：拒绝运行时配置更改
    if (this.isPreConfigured) {
      console.warn('Protocol module is pre-configured, runtime configuration ignored', {
        moduleId: this.id,
        attemptedConfig: Object.keys(config || {}),
        currentPreConfig: Object.keys(this.preConfig)
      });
      return;
    }
    
    // 非预配置模式下的传统配置（保持向后兼容）
    console.log('Protocol module configured (legacy mode)');
  }

  async start(): Promise<void> {
    // Start logic
  }

  async stop(): Promise<void> {
    // Stop logic
  }

  async reset(): Promise<void> {
    this.metrics = {
      requestsProcessed: 0,
      responsesProcessed: 0,
      errorsHandled: 0,
      streamConversions: 0,
      nonStreamConversions: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * 更新请求处理指标
   */
  private updateRequestMetrics(processingTime: number, success: boolean): void {
    this.metrics.requestsProcessed++;
    this.updateCommonMetrics(processingTime, success);
  }

  /**
   * 更新响应处理指标
   */
  private updateResponseMetrics(processingTime: number, success: boolean): void {
    this.metrics.responsesProcessed++;
    this.updateCommonMetrics(processingTime, success);
  }

  /**
   * 更新通用指标
   */
  private updateCommonMetrics(processingTime: number, success: boolean): void {
    this.metrics.totalProcessingTime += processingTime;
    const totalOperations = this.metrics.requestsProcessed + this.metrics.responsesProcessed;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / Math.max(totalOperations, 1);
    
    if (!success) {
      this.metrics.errorsHandled++;
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
    this.removeAllListeners();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { 
      healthy: this.status === 'healthy' || this.status === 'degraded', 
      details: { 
        status: this.status,
        metrics: this.metrics,
        preConfig: this.preConfig,
        isPreConfigured: this.isPreConfigured,
        capabilities: {
          streamConversion: this.preConfig.enableStreamConversion,
          protocolValidation: this.preConfig.enableProtocolValidation,
          concurrencyLimit: this.preConfig.concurrencyLimit
        }
      } 
    };
  }

  // ModuleInterface连接管理方法
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  hasConnection(moduleId: string): boolean {
    return this.connections.has(moduleId);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // 模块间通信方法
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      // 发送消息到目标模块
      targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
      });
      return Promise.resolve({ success: true, targetModuleId, message, type });
    }
    return Promise.resolve({ success: false, targetModuleId, message, type });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.on('moduleMessage', (data: any) => {
      listener(data.fromModuleId, data.message, data.type);
    });
  }
  
  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    const connection = this.connections.get(targetModuleId);
    if (!connection) {
      return 'disconnected';
    }
    const status = connection.getStatus();
    return status.status === 'running' ? 'connected' : status.status as any;
  }
  
  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      const status = targetModule.getStatus();
      const metrics = targetModule.getMetrics();
      return status.status === 'running' && status.health === 'healthy';
    } catch (error) {
      return false;
    }
  }
}