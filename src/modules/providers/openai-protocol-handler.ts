/**
 * OpenAI Protocol处理器
 *
 * 基于官方 openai SDK 实现的OpenAI协议处理器
 *
 * @author Jason Zhang
 */

import OpenAI from 'openai';
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
 * OpenAI Protocol配置接口
 */
export interface OpenAIProtocolConfig {
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
  /** 启用流式响应 */
  enableStreaming: boolean;
  /** 启用工具调用 */
  enableToolCalls: boolean;
  /** 调试模式 */
  debug: boolean;
}

/**
 * OpenAI Protocol处理器实现
 */
export class OpenAIProtocolHandler extends EventEmitter implements ModuleInterface {
  protected readonly id: string = 'openai-protocol-handler';
  protected readonly name: string = 'OpenAI Protocol Handler';
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
    // 基础实现
    return input;
  }
  private protocolConfig: OpenAIProtocolConfig;
  private openaiClient!: OpenAI;

  constructor(id: string = 'openai-protocol-handler', config: Partial<OpenAIProtocolConfig> = {}) {
    super();

    this.protocolConfig = {
      apiKey: '',
      defaultModel: 'gpt-3.5-turbo',
      timeout: 30000,
      maxRetries: 3,
      enableStreaming: true,
      enableToolCalls: true,
      debug: false,
      ...config,
    };

    this.initializeClient();
  }

  /**
   * 初始化OpenAI客户端
   */
  private initializeClient(): void {
    if (!this.protocolConfig.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: this.protocolConfig.apiKey,
      timeout: this.protocolConfig.timeout,
      maxRetries: this.protocolConfig.maxRetries,
    };

    // 如果指定了自定义baseURL，则设置
    if (this.protocolConfig.baseURL) {
      clientConfig.baseURL = this.protocolConfig.baseURL;
    }

    this.openaiClient = new OpenAI(clientConfig);
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: Partial<OpenAIProtocolConfig>): Promise<void> {
    this.protocolConfig = { ...this.protocolConfig, ...config };

    // 重新初始化客户端
    this.initializeClient();

    if (this.protocolConfig.debug) {
      console.log(`[OpenAI Protocol] Configuration updated:`, {
        baseURL: this.protocolConfig.baseURL || 'https://api.openai.com/v1',
        model: this.protocolConfig.defaultModel,
        enableStreaming: this.protocolConfig.enableStreaming,
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
      const openaiRequest = await this.transformToOpenAI(input);

      // 2. 调用OpenAI API
      const openaiResponse = await this.callOpenAIAPI(openaiRequest);

      // 3. 转换响应格式
      const standardResponse = await this.transformFromOpenAI(openaiResponse, input);

      // 4. 更新指标
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime, true);

      if (this.protocolConfig.debug) {
        console.log(`[OpenAI Protocol] Request processed successfully in ${processingTime}ms`);
      }

      return standardResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime, false);

      if (this.protocolConfig.debug) {
        console.error(`[OpenAI Protocol] Request failed after ${processingTime}ms:`, error);
      }

      throw this.createProcessingError(error as Error, input);
    }
  }

  /**
   * 转换标准请求到OpenAI格式
   */
  private async transformToOpenAI(request: StandardRequest): Promise<OpenAI.Chat.ChatCompletionCreateParams> {
    const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
      model: request.model || this.protocolConfig.defaultModel,
      messages: this.transformMessages(request.messages),
    };

    // 可选参数
    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    if (request.max_tokens !== undefined) {
      openaiRequest.max_tokens = request.max_tokens;
    }

    // 注意：这里暂不支持stream，因为需要不同的返回类型处理

    // 处理工具调用
    if (request.tools && this.protocolConfig.enableToolCalls) {
      openaiRequest.tools = this.transformTools(request.tools);
      if (request.tool_choice) {
        openaiRequest.tool_choice = this.transformToolChoice(request.tool_choice);
      }
    }

    return openaiRequest;
  }

  /**
   * 转换消息格式
   */
  private transformMessages(messages: StandardRequest['messages']): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'system') {
        const systemMsg = msg as SystemMessage;
        return {
          role: 'system',
          content: systemMsg.content,
        };
      } else if (msg.role === 'user') {
        const userMsg = msg as UserMessage;
        // 简化处理：只支持文本内容，复杂内容转为JSON字符串
        const content = typeof userMsg.content === 'string' ? userMsg.content : JQJsonHandler.stringifyJson(userMsg.content);
        return {
          role: 'user',
          content: content,
        };
      } else if (msg.role === 'assistant') {
        const assistantMsg = msg as AssistantMessage;
        // 简化处理assistant消息内容
        const content =
          typeof assistantMsg.content === 'string'
            ? assistantMsg.content
            : assistantMsg.content
              ? JQJsonHandler.stringifyJson(assistantMsg.content)
              : null;

        const openaiMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: content,
        };

        // 处理工具调用
        if (assistantMsg.toolCalls && this.protocolConfig.enableToolCalls) {
          openaiMsg.tool_calls = assistantMsg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments:
                typeof tc.function.arguments === 'string'
                  ? tc.function.arguments
                  : JQJsonHandler.stringifyJson(tc.function.arguments),
            },
          }));
        }

        return openaiMsg;
      } else if (msg.role === 'tool') {
        const toolMsg = msg as ToolMessage;
        return {
          role: 'tool',
          content: toolMsg.content,
          tool_call_id: toolMsg.toolCallId!,
        };
      }

      throw new Error(`Unsupported message role: ${msg.role}`);
    });
  }

  /**
   * 转换工具定义
   */
  private transformTools(tools: StandardRequest['tools']): OpenAI.Chat.ChatCompletionTool[] {
    return tools!.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * 转换工具选择
   */
  private transformToolChoice(toolChoice: any): OpenAI.Chat.ChatCompletionToolChoiceOption {
    if (typeof toolChoice === 'string') {
      switch (toolChoice) {
        case 'auto':
          return 'auto';
        case 'none':
          return 'none';
        case 'required':
          return 'required';
        default:
          return 'auto';
      }
    }

    if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
      return {
        type: 'function',
        function: {
          name: toolChoice.function.name,
        },
      };
    }

    return 'auto';
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAIAPI(request: OpenAI.Chat.ChatCompletionCreateParams): Promise<OpenAI.Chat.ChatCompletion> {
    if (this.protocolConfig.debug) {
      console.log(`[OpenAI Protocol] API call with model: ${request.model}`);
    }

    try {
      const response = await this.openaiClient.chat.completions.create(request);

      if (this.protocolConfig.debug) {
        console.log(`[OpenAI Protocol] API call successful`);
      }

      // 确保返回的是ChatCompletion而不是Stream
      return response as OpenAI.Chat.ChatCompletion;
    } catch (error) {
      if (this.protocolConfig.debug) {
        console.error(`[OpenAI Protocol] API call failed:`, error);
      }
      throw error;
    }
  }

  /**
   * 转换OpenAI响应到标准格式
   */
  private async transformFromOpenAI(
    response: OpenAI.Chat.ChatCompletion,
    originalRequest: StandardRequest
  ): Promise<StandardResponse> {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in OpenAI response');
    }

    const choices: Choice[] = response.choices.map((choice, index) => {
      let message: Message;

      if (choice.message.role === 'assistant') {
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: choice.message.content || '',
        };

        // 处理工具调用
        if (choice.message.tool_calls && this.protocolConfig.enableToolCalls) {
          assistantMessage.toolCalls = choice.message.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.type === 'function' ? tc.function.name : '',
              arguments: tc.type === 'function' ? tc.function.arguments : '', // 保持为字符串格式
            },
          }));
        }

        message = assistantMessage;
      } else {
        // 处理其他类型的消息
        message = {
          role: choice.message.role as Message['role'],
          content: choice.message.content || '',
        };
      }

      return {
        index,
        message,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    });

    const usage: Usage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };

    const standardResponse: StandardResponse = {
      id: response.id,
      choices,
      usage,
      model: response.model,
      created: response.created,
      metadata: {
        requestId: originalRequest.id,
        provider: 'openai',
        model: response.model,
        originalFormat: 'openai',
        targetFormat: 'openai',
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
   * 映射结束原因
   */
  private mapFinishReason(reason: OpenAI.Chat.ChatCompletion.Choice['finish_reason']): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
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
    const processingError = new Error(`OpenAI Protocol processing failed: ${error.message}`);

    // 添加调试信息
    (processingError as any).originalError = error;
    (processingError as any).requestModel = request.model;
    (processingError as any).baseURL = this.protocolConfig.baseURL;

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
          baseURL: this.protocolConfig.baseURL || 'https://api.openai.com/v1',
          model: this.protocolConfig.defaultModel,
          requestsProcessed: this.metrics.requestsProcessed,
          averageProcessingTime: this.metrics.averageProcessingTime,
          errorRate: this.metrics.errorRate,
          enableStreaming: this.protocolConfig.enableStreaming,
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
  public getConfig(): OpenAIProtocolConfig {
    return { ...this.protocolConfig };
  }

  /**
   * 测试API连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.protocolConfig.defaultModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      };

      await this.callOpenAIAPI(testRequest);
      return true;
    } catch (error) {
      if (this.protocolConfig.debug) {
        console.error('[OpenAI Protocol] Connection test failed:', error);
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
