/**
 * OpenAI Protocol Module
 *
 * Protocol模块：负责协议控制转换（流式 ↔ 非流式）
 * 按照RCC v4.0四层架构设计实现
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
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
 * OpenAI协议模块
 */
export class OpenAIProtocolModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'openai-protocol-module';
  private readonly name: string = 'OpenAI Protocol Module';
  private readonly type: any = 'protocol';
  private readonly version: string = '1.0.0';
  private status: ModuleStatus['health'] = 'healthy';
  private connections: Map<string, ModuleInterface> = new Map();

  constructor() {
    super();
    console.log(`🌐 初始化OpenAI协议模块`);
  }

  // 移除重复的ModuleInterface实现

  /**
   * 处理协议转换
   * 支持：流式请求 → 非流式请求 和 非流式响应 → 流式响应
   */
  async process(
    input: StreamRequest | NonStreamRequest | NonStreamResponse
  ): Promise<NonStreamRequest | StreamResponse> {
    const startTime = Date.now();

    try {
      if (this.isStreamRequest(input)) {
        console.log(`🌊 转换流式请求 → 非流式请求`);
        const result = this.convertToNonStreaming(input as StreamRequest);
        const processingTime = Date.now() - startTime;
        console.log(`✅ 流式→非流式转换完成 (${processingTime}ms)`);
        return result;
      } else if (this.isNonStreamRequest(input)) {
        console.log(`➡️ 非流式请求直接传递`);
        const processingTime = Date.now() - startTime;
        console.log(`✅ 非流式请求处理完成 (${processingTime}ms)`);
        return input as NonStreamRequest;
      } else if (this.isNonStreamResponse(input)) {
        console.log(`🔄 转换非流式响应 → 流式响应`);
        const result = this.convertToStreaming(input as NonStreamResponse);
        const processingTime = Date.now() - startTime;
        console.log(`✅ 非流式→流式转换完成 (${processingTime}ms)`);
        return result;
      } else {
        throw new Error('不支持的输入格式');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 协议转换失败 (${processingTime}ms):`, error.message);
      throw error;
    }
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
      throw new Error('缺少model参数');
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('缺少messages参数或格式无效');
    }

    if (request.stream !== true) {
      throw new Error('stream参数必须为true');
    }

    for (const message of request.messages) {
      if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new Error(`无效的消息角色: ${message.role}`);
      }
      if (!message.content || typeof message.content !== 'string') {
        throw new Error('消息内容不能为空');
      }
    }

    return true;
  }

  /**
   * 验证非流式响应格式
   */
  validateNonStreamResponse(response: NonStreamResponse): boolean {
    if (!response.id || typeof response.id !== 'string') {
      throw new Error('缺少响应ID');
    }

    if (response.object !== 'chat.completion') {
      throw new Error('无效的响应对象类型');
    }

    if (!Array.isArray(response.choices) || response.choices.length === 0) {
      throw new Error('缺少响应choices');
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      throw new Error('缺少usage信息');
    }

    return true;
  }

  /**
   * 聚合流式chunk为完整响应
   * 用于将多个chunk重新组合成完整的响应
   */
  aggregateStreamChunks(chunks: StreamChunk[]): NonStreamResponse {
    if (chunks.length === 0) {
      throw new Error('chunk列表不能为空');
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
    return ModuleType.PROTOCOL;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.PROTOCOL,
      status: 'running',
      health: this.status,
    };
  }

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

  async start(): Promise<void> {
    // Start logic
  }

  async stop(): Promise<void> {
    // Stop logic
  }

  async reset(): Promise<void> {
    // Reset logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
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
}
