/**
 * Anthropic Protocol处理器
 *
 * 基于官方 @anthropic-ai/sdk 实现的Anthropic协议处理器
 *
 * @author Jason Zhang
 */

import Anthropic from '@anthropic-ai/sdk';
import { getProviderRequestTimeout } from '../../constants';
import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
} from '../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { StandardRequest } from '../../interfaces/standard/request';
import { StandardResponse, Choice, Usage, FinishReason } from '../../interfaces/standard/response';
import {
  Message,
  ToolCall,
  AssistantMessage,
  UserMessage,
  SystemMessage,
  ToolMessage,
} from '../../interfaces/standard/message';
import { Tool } from '../../interfaces/standard/tool';
import JQJsonHandler from '../../../error-handler/src/utils/jq-json-handler';
/**
 * Anthropic Protocol配置接口
 */
export interface AnthropicProtocolConfig {
  /** API密钥 */
  apiKey: string;
  /** API端点URL (可选，默认使用官方端点) */
  baseURL?: string;
  /** 默认模型 */
  defaultModel: string;
  /** 请求超时(毫秒) */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 启用工具调用 */
  enableToolCalls: boolean;
  /** 调试模式 */
  debug: boolean;
}

/**
 * Anthropic Protocol处理器实现
 */
export class AnthropicProtocolHandler extends EventEmitter implements ModuleInterface {
  protected readonly id: string = 'anthropic-protocol-handler';
  protected readonly name: string = 'Anthropic Protocol Handler';
  protected readonly type: ModuleType = ModuleType.PROTOCOL;
  protected readonly version: string = '1.0.0';
  protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  protected metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };
  private processingTimes: number[] = [];
  private errors: Error[] = [];

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
    return { id: this.id, name: this.name, type: this.type, status: this.status, health: 'healthy' };
  }
  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }
  async configure(config: any): Promise<void> {}
  async start(): Promise<void> {
    this.status = 'running';
  }
  async stop(): Promise<void> {
    this.status = 'stopped';
  }
  async reset(): Promise<void> {}
  async cleanup(): Promise<void> {}
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
  }
  async process(input: any): Promise<any> {
    return this.handleRequest(input);
  }

  private async handleRequest(input: any): Promise<any> {
    return input;
  }
  private protocolConfig: AnthropicProtocolConfig;
  private anthropicClient!: Anthropic;

  constructor(id: string = 'anthropic-protocol-handler', config: Partial<AnthropicProtocolConfig> = {}) {
    super();

    this.protocolConfig = {
      apiKey: '',
      defaultModel: 'claude-3-sonnet-20240229',
      timeout: getProviderRequestTimeout(),
      maxRetries: 3,
      enableToolCalls: true,
      debug: false,
      ...config,
    };

    this.initializeClient();
  }

  /**
   * 初始化Anthropic客户端
   */
  private initializeClient(): void {
    if (!this.protocolConfig.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const clientConfig: any = {
      apiKey: this.protocolConfig.apiKey,
      timeout: this.protocolConfig.timeout,
      maxRetries: this.protocolConfig.maxRetries,
    };

    // 如果指定了自定义baseURL，则设置
    if (this.protocolConfig.baseURL) {
      clientConfig.baseURL = this.protocolConfig.baseURL;
    }

    this.anthropicClient = new Anthropic(clientConfig);
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: Partial<AnthropicProtocolConfig>): Promise<void> {
    this.protocolConfig = { ...this.protocolConfig, ...config };

    // 重新初始化客户端
    this.initializeClient();

    if (this.protocolConfig.debug) {
      console.log(`[Anthropic Protocol] Configuration updated:`, {
        baseURL: this.protocolConfig.baseURL || 'https://api.anthropic.com',
        model: this.protocolConfig.defaultModel,
        enableToolCalls: this.protocolConfig.enableToolCalls,
      });
    }
  }

  /**
   * 主要处理逻辑
   */
  protected async onProcess(input: StandardRequest): Promise<StandardResponse> {
    const startTime = Date.now();

    try {
      // 1. 转换请求格式
      const anthropicRequest = await this.transformToAnthropic(input);

      // 2. 调用Anthropic API
      const anthropicResponse = await this.callAnthropicAPI(anthropicRequest);

      // 3. 转换响应格式
      const standardResponse = await this.transformFromAnthropic(anthropicResponse, input);

      // 4. 更新指标
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime, true);

      if (this.protocolConfig.debug) {
        console.log(`[Anthropic Protocol] Request processed successfully in ${processingTime}ms`);
      }

      return standardResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime, false);

      if (this.protocolConfig.debug) {
        console.error(`[Anthropic Protocol] Request failed after ${processingTime}ms:`, error);
      }

      throw this.createProcessingError(error as Error, input);
    }
  }

  /**
   * 转换标准请求到Anthropic格式
   */
  private async transformToAnthropic(request: StandardRequest): Promise<Anthropic.MessageCreateParams> {
    const anthropicRequest: Anthropic.MessageCreateParams = {
      model: request.model || this.protocolConfig.defaultModel,
      messages: this.transformMessages(request.messages),
      max_tokens: request.max_tokens || 4096,
    };

    // 可选参数
    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      anthropicRequest.top_p = request.top_p;
    }

    if (request.system) {
      anthropicRequest.system = request.system;
    }

    if (request.stop) {
      anthropicRequest.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
    }

    // 处理工具调用
    if (request.tools && this.protocolConfig.enableToolCalls) {
      anthropicRequest.tools = this.transformTools(request.tools);

      if (request.tool_choice) {
        anthropicRequest.tool_choice = this.transformToolChoice(request.tool_choice);
      }
    }

    return anthropicRequest;
  }

  /**
   * 转换消息格式
   */
  private transformMessages(messages: StandardRequest['messages']): Anthropic.MessageParam[] {
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      // 跳过system消息，因为Anthropic在顶级system字段中处理
      if (message.role === 'system') {
        continue;
      }

      if (message.role === 'user') {
        const userMessage = message as UserMessage;
        anthropicMessages.push({
          role: 'user',
          content: this.transformMessageContent(userMessage.content),
        });
      } else if (message.role === 'assistant') {
        const assistantMessage = message as AssistantMessage;
        const content: Anthropic.MessageParam['content'] = [];

        // 添加文本内容
        if (assistantMessage.content) {
          if (typeof assistantMessage.content === 'string') {
            content.push({
              type: 'text',
              text: assistantMessage.content,
            });
          }
        }

        // 添加工具调用
        if (assistantMessage.toolCalls && this.protocolConfig.enableToolCalls) {
          for (const toolCall of assistantMessage.toolCalls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input:
                typeof toolCall.function.arguments === 'string'
                  ? JQJsonHandler.parseJsonString(toolCall.function.arguments)
                  : toolCall.function.arguments || {},
            });
          }
        }

        anthropicMessages.push({
          role: 'assistant',
          content:
            content.length === 1 && content[0] && content[0].type === 'text' ? (content[0] as any).text || '' : content,
        });
      } else if (message.role === 'tool') {
        const toolMessage = message as ToolMessage;
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolMessage.toolCallId!,
              content: toolMessage.content,
            },
          ],
        });
      }
    }

    return anthropicMessages;
  }

  /**
   * 转换消息内容
   */
  private transformMessageContent(content: string | any[]): string | Anthropic.ContentBlock[] {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text') {
          return {
            type: 'text' as const,
            text: block.text,
          };
        } else if (block.type === 'image') {
          return {
            type: 'image' as const,
            source: block.source,
          };
        }
        return block;
      });
    }

    return String(content);
  }

  /**
   * 转换工具定义
   */
  private transformTools(tools: StandardRequest['tools']): Anthropic.Tool[] {
    return tools!.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: {
        type: 'object',
        properties: tool.function.parameters.properties || {},
        required: tool.function.parameters.required || [],
      } as any,
    }));
  }

  /**
   * 转换工具选择
   */
  private transformToolChoice(toolChoice: any): Anthropic.MessageCreateParams['tool_choice'] {
    if (typeof toolChoice === 'string') {
      switch (toolChoice) {
        case 'auto':
          return { type: 'auto' };
        case 'none':
          return undefined; // Anthropic 没有 "none" 选项
        case 'required':
          return { type: 'any' };
        default:
          return { type: 'auto' };
      }
    }

    if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
      return {
        type: 'tool',
        name: toolChoice.function.name,
      };
    }

    return { type: 'auto' };
  }

  /**
   * 调用Anthropic API
   */
  private async callAnthropicAPI(request: Anthropic.MessageCreateParams): Promise<Anthropic.Message> {
    if (this.protocolConfig.debug) {
      console.log(`[Anthropic Protocol] API call with model: ${request.model}`);
    }

    try {
      const response = await this.anthropicClient.messages.create(request);

      if (this.protocolConfig.debug) {
        console.log(`[Anthropic Protocol] API call successful`);
      }

      // 确保返回的是Message类型而不是Stream
      if ('stream' in response) {
        throw new Error('Streaming responses not supported in this handler');
      }

      return response as Anthropic.Message;
    } catch (error) {
      if (this.protocolConfig.debug) {
        console.error(`[Anthropic Protocol] API call failed:`, error);
      }
      throw error;
    }
  }

  /**
   * 转换Anthropic响应到标准格式
   */
  private async transformFromAnthropic(
    response: Anthropic.Message,
    originalRequest: StandardRequest
  ): Promise<StandardResponse> {
    const choices: Choice[] = [
      {
        index: 0,
        message: this.transformAnthropicMessage(response),
        finishReason: this.mapStopReason(response.stop_reason),
      },
    ];

    const usage: Usage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    const standardResponse: StandardResponse = {
      id: response.id,
      choices,
      usage,
      model: response.model,
      created: Math.floor(Date.now() / 1000),
      metadata: {
        requestId: originalRequest.id,
        provider: 'anthropic',
        model: response.model,
        originalFormat: 'anthropic',
        targetFormat: 'anthropic',
        processingSteps: ['validate', 'transform', 'call_api', 'transform_back'],
        performance: {
          totalTime: Date.now() - originalRequest.timestamp.getTime(),
          apiCallTime: 0, // 会在调用时设置
          transformationTime: 0,
          validationTime: 0,
          retryCount: 0,
        },
      },
      timestamp: new Date(),
    };

    return standardResponse;
  }

  /**
   * 转换Anthropic消息到标准格式
   */
  private transformAnthropicMessage(anthropicMessage: Anthropic.Message): Message {
    const message: AssistantMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [],
    };

    // 处理内容
    const textBlocks: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of anthropicMessage.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: typeof block.input === 'string' ? block.input : JQJsonHandler.stringifyJson(block.input),
          },
        });
      }
    }

    message.content = textBlocks.join('\n').trim();
    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }

    return message;
  }

  /**
   * 映射停止原因
   */
  private mapStopReason(reason: Anthropic.Message['stop_reason']): FinishReason {
    switch (reason) {
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

  /**
   * 更新处理指标
   */
  private updateProcessingMetrics(processingTime: number, success: boolean): void {
    this.metrics.requestsProcessed++;
    this.metrics.lastProcessedAt = new Date();

    if (success) {
      this.processingTimes.push(processingTime);

      // 保持最近100次的处理时间
      if (this.processingTimes.length > 100) {
        this.processingTimes = this.processingTimes.slice(-100);
      }

      // 计算平均处理时间
      this.metrics.averageProcessingTime =
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    } else {
      this.errors.push(new Error(`Processing failed after ${processingTime}ms`));

      // 保持最近50个错误
      if (this.errors.length > 50) {
        this.errors = this.errors.slice(-50);
      }
    }

    // 计算错误率
    this.metrics.errorRate = this.errors.length / Math.max(this.metrics.requestsProcessed, 1);
  }

  /**
   * 创建处理错误
   */
  private createProcessingError(error: Error, request: StandardRequest): Error {
    const processingError = new Error(`Anthropic Protocol processing failed: ${error.message}`);

    // 添加调试信息
    (processingError as any).originalError = error;
    (processingError as any).requestModel = request.model;
    (processingError as any).baseURL = this.protocolConfig.baseURL || 'https://api.anthropic.com';

    return processingError;
  }

  /**
   * 健康检查
   */
  protected async onHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // 检查配置有效性
      if (!this.protocolConfig.apiKey) {
        return {
          healthy: false,
          details: { error: 'No API key configured' },
        };
      }

      // 检查错误率
      if (this.metrics.errorRate > 0.5) {
        return {
          healthy: false,
          details: {
            error: 'High error rate',
            errorRate: this.metrics.errorRate,
            recentErrors: this.errors.slice(-5).map(e => e.message),
          },
        };
      }

      // 检查平均响应时间
      if (this.metrics.averageProcessingTime > this.protocolConfig.timeout * 0.8) {
        return {
          healthy: false,
          details: {
            error: 'High response time',
            averageTime: this.metrics.averageProcessingTime,
            timeout: this.protocolConfig.timeout,
          },
        };
      }

      return {
        healthy: true,
        details: {
          baseURL: this.protocolConfig.baseURL || 'https://api.anthropic.com',
          model: this.protocolConfig.defaultModel,
          requestsProcessed: this.metrics.requestsProcessed,
          averageProcessingTime: this.metrics.averageProcessingTime,
          errorRate: this.metrics.errorRate,
          enableToolCalls: this.protocolConfig.enableToolCalls,
          sdkVersion: 'official',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AnthropicProtocolConfig {
    return { ...this.protocolConfig };
  }

  /**
   * 测试API连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: Anthropic.MessageCreateParams = {
        model: this.protocolConfig.defaultModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      };

      await this.callAnthropicAPI(testRequest);
      return true;
    } catch (error) {
      if (this.protocolConfig.debug) {
        console.error('[Anthropic Protocol] Connection test failed:', error);
      }
      return false;
    }
  }

  // ModuleInterface连接管理方法
  private connections: Map<string, ModuleInterface> = new Map();

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
