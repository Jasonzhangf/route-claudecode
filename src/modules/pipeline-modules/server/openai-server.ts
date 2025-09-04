/**
 * OpenAI Server Module
 *
 * Server模块：标准服务器协议处理，使用官方SDK
 * 按照RCC v4.0四层架构设计实现
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';
import {
  ThirdPartyServiceErrorHandler,
  handleOpenAIError,
} from '../../../middleware/third-party-service-error-handler';
import { JQJsonHandler } from '../../../utils/jq-json-handler';

/**
 * 服务器请求格式（标准OpenAI格式）
 */
export interface ServerRequest {
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
 * 服务器响应格式（标准OpenAI格式）
 */
export interface ServerResponse {
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
 * OpenAI服务器配置
 */
export interface OpenAIServerConfig {
  baseURL?: string;
  apiKey?: string;
  organization?: string;
  project?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  skipAuthentication?: boolean;
  multiKeyAuth?: {
    enabled: boolean;
    strategy: 'round-robin' | 'random';
    apiKeys: string[];
  };
}

/**
 * OpenAI服务器模块
 */
export class OpenAIServerModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'openai-server-module';
  private readonly name: string = 'OpenAI Server Module';
  private readonly type: any = 'server';
  private readonly version: string = '1.0.0';
  private readonly config: OpenAIServerConfig;
  private openaiClient: OpenAI;
  private status: any = 'healthy';
  private isInitialized = false;
  private currentKeyIndex = 0; // 用于round-robin策略
  private connections: Map<string, ModuleInterface> = new Map();

  constructor(config: OpenAIServerConfig) {
    super();
    this.config = config;

    // 获取要使用的API Key
    const apiKey = this.getApiKey();

    // 使用官方OpenAI SDK
    this.openaiClient = new OpenAI({
      baseURL: config.baseURL,
      apiKey: apiKey,
      organization: config.organization,
      project: config.project,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });

    if (config.multiKeyAuth?.enabled) {
      console.log(
        `🌐 初始化OpenAI服务器模块: ${config.baseURL || 'https://api.openai.com'} (多Key认证: ${config.multiKeyAuth.apiKeys.length}个Key)`
      );
    } else {
      console.log(`🌐 初始化OpenAI服务器模块: ${config.baseURL || 'https://api.openai.com'}`);
    }
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
      type: ModuleType.SERVER,
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

    console.log(`🚀 初始化OpenAI服务器模块...`);

    try {
      // 测试认证
      await this.authenticate();

      this.status = 'healthy';
      this.isInitialized = true;

      this.emit('statusChanged', { health: this.status });
      console.log(`✅ OpenAI服务器模块初始化完成`);
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      console.error(`❌ OpenAI服务器模块初始化失败:`, error.message);
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
    console.log(`▶️ OpenAI服务器模块已启动`);
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    this.status = 'unhealthy';
    this.emit('statusChanged', { health: this.status });
    console.log(`⏹️ OpenAI服务器模块已停止`);
  }

  /**
   * 处理服务器请求
   */
  async process(input: ServerRequest): Promise<ServerResponse> {
    if (!this.isInitialized) {
      throw new Error('OpenAI服务器模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🌐 OpenAI服务器处理开始: ${input?.model}`);
    console.log(`🔍 Server层接收到的input详细结构:`, JQJsonHandler.stringifyJson(input, false));

    try {
      // 验证请求
      this.validateServerRequest(input);

      // 发送请求到OpenAI
      const response = await this.sendRequest(input);

      const processingTime = Date.now() - startTime;
      console.log(`✅ OpenAI服务器处理完成 (${processingTime}ms)`);

      this.emit('requestProcessed', {
        processingTime,
        success: true,
        model: input.model,
        tokensUsed: response.usage.total_tokens,
      });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OpenAI服务器处理失败 (${processingTime}ms):`, error.message);

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
   * 认证检查
   */
  async authenticate(): Promise<boolean> {
    // 如果配置中禁用了认证检查，直接跳过
    if (this.config.skipAuthentication === true) {
      console.log(`⏭️ 已跳过认证检查 (skipAuthentication=true)`);
      return true;
    }

    try {
      // 获取模型列表来测试认证
      const models = await this.openaiClient.models.list();
      console.log(`🔐 OpenAI认证成功 (${models.data.length} 个模型可用)`);
      return true;
    } catch (error) {
      // 使用统一的第三方服务错误处理器 - 服务器错误原样回报
      const { standardizedError } = handleOpenAIError(
        error,
        'authentication',
        this.config.baseURL,
        {
          requestId: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          moduleId: this.id,
          operation: 'authenticate',
        },
        false
      ); // false = 服务器错误，保持原状态码

      throw standardizedError;
    }
  }

  /**
   * 健康检查
   */
  async checkHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.authenticate();
      const responseTime = Date.now() - startTime;

      this.status = 'healthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: false, responseTime, error: error.message };
    }
  }

  /**
   * 发送请求到OpenAI服务器
   */
  private async sendRequest(request: ServerRequest, retryCount: number = 0): Promise<ServerResponse> {
    try {
      if (request.stream) {
        throw new Error('流式请求在Server模块不应该出现 - 应该在Protocol模块处理');
      }

      const response = await this.openaiClient.chat.completions.create({
        model: request.model,
        messages: request.messages as any,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
        tools: request.tools,
        tool_choice: request.tool_choice,
        stream: false,
      });

      return response as ServerResponse;
    } catch (error) {
      // 检查是否为认证错误且启用了多Key认证
      if (
        error.name === 'APIError' &&
        (error.message.includes('401') || error.message.includes('Unauthorized')) &&
        this.config.multiKeyAuth?.enabled &&
        this.config.multiKeyAuth.apiKeys?.length > 1 &&
        retryCount < this.config.multiKeyAuth.apiKeys.length - 1
      ) {
        console.warn(`⚠️  认证失败，尝试轮换API Key (第${retryCount + 1}次重试)`);

        try {
          this.rotateApiKey();
          return await this.sendRequest(request, retryCount + 1);
        } catch (rotationError) {
          console.error('🔄 API Key轮换失败:', rotationError.message);
        }
      }

      // 使用统一的第三方服务错误处理器 - 服务器错误原样回报
      const { standardizedError } = handleOpenAIError(
        error,
        request.model,
        this.config.baseURL,
        {
          requestId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          moduleId: this.id,
          operation: 'sendRequest',
        },
        false
      ); // false = 服务器错误，保持原状态码

      throw standardizedError;
    }
  }

  /**
   * 验证服务器请求格式
   */
  private validateServerRequest(request: ServerRequest): void {
    // Debug: 检查request结构 - 详细输出
    console.log(`🔍 Server层验证输入详细结构:`);
    console.log(`   - Request type: ${typeof request}`);
    console.log(`   - Request constructor: ${request?.constructor?.name}`);
    console.log(`   - Request keys: ${request ? Object.keys(request) : 'null/undefined'}`);
    console.log(`   - Has model: ${!!request?.model}`);
    console.log(`   - Model value: ${request?.model}`);
    console.log(`   - Has messages: ${!!request?.messages}`);
    console.log(`   - Messages type: ${typeof request?.messages}`);
    console.log(`   - Messages is array: ${Array.isArray(request?.messages)}`);
    console.log(`   - Messages length: ${Array.isArray(request?.messages) ? request.messages.length : 'not array'}`);
    console.log(`   - Full request: ${JQJsonHandler.stringifyJson(request, false)}`);

    // 立即检查messages的真实性
    console.log('🚨 URGENT DEBUG: 检查messages的各种访问方式');
    console.log(`   - request.messages: ${request.messages}`);
    console.log(`   - request['messages']: ${request['messages']}`);
    console.log(`   - 'messages' in request: ${'messages' in request}`);
    console.log(`   - request.hasOwnProperty('messages'): ${request.hasOwnProperty('messages')}`);
    console.log(
      `   - Object.prototype.hasOwnProperty.call(request, 'messages'): ${Object.prototype.hasOwnProperty.call(request, 'messages')}`
    );
    console.log(`   - Object.getOwnPropertyNames(request): ${Object.getOwnPropertyNames(request)}`);
    console.log(
      `   - Object.getOwnPropertyDescriptor(request, 'messages'): ${JQJsonHandler.stringifyJson(Object.getOwnPropertyDescriptor(request, 'messages'))}`
    );

    if (!request) {
      throw new Error('请求对象为空');
    }

    if (!request.model) {
      throw new Error('缺少model参数');
    }

    // 详细调试消息验证条件
    console.log('🔍 详细消息验证调试:');
    console.log(`   - request.messages 存在: ${!!request.messages}`);
    console.log(`   - request.messages 类型: ${typeof request.messages}`);
    console.log(`   - request.messages 是数组: ${Array.isArray(request.messages)}`);
    console.log(`   - request.messages 长度: ${request.messages ? request.messages.length : 'undefined'}`);
    console.log(
      `   - request.messages 构造函数: ${request.messages ? request.messages.constructor.name : 'undefined'}`
    );

    const messagesExists = !!request.messages;
    const messagesIsArray = Array.isArray(request.messages);
    const messagesHasLength = request.messages && request.messages.length > 0;

    console.log(`   - 条件1 (!request.messages): ${!request.messages}`);
    console.log(`   - 条件2 (!Array.isArray): ${!Array.isArray(request.messages)}`);
    console.log(`   - 条件3 (length === 0): ${request.messages ? request.messages.length === 0 : 'no messages'}`);

    if (!messagesExists) {
      throw new Error('缺少messages字段');
    }

    if (!messagesIsArray) {
      throw new Error(`messages字段不是数组，类型是: ${typeof request.messages}`);
    }

    if (!messagesHasLength) {
      throw new Error(`messages数组为空，长度: ${request.messages.length}`);
    }

    // 过滤有效的消息 - 改进版本，处理更多边缘情况
    const validMessages = (request.messages && Array.isArray(request.messages) ? request.messages : []).filter(
      (message, index) => {
        // Debug: 检查每个消息的详细结构
        console.log(`🔍 Server层消息验证 [${index}]:`);
        console.log(`   - Message type: ${typeof message}`);
        console.log(`   - Message keys: ${message ? Object.keys(message) : 'null/undefined'}`);
        console.log(`   - Role: ${message?.role}`);
        console.log(`   - Content type: ${typeof message?.content}`);
        console.log(`   - Content length: ${message?.content ? message.content.length : 'no content'}`);
        console.log(
          `   - Content preview: ${message?.content ? message.content.substring(0, 100) + '...' : 'no content'}`
        );

        // 安全检查：确保message对象存在且不为null/undefined
        if (!message || typeof message !== 'object') {
          console.log(`   ❌ 消息 [${index}] 不是有效对象`);
          return false;
        }

        if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
          console.log(`   ❌ 消息 [${index}] 角色无效: ${message.role}`);
          return false;
        }

        // 改进的内容验证 - 更宽松的检查
        if (message.content === null || message.content === undefined) {
          console.log(`   ❌ 消息 [${index}] 内容为空`);
          return false;
        }

        if (typeof message.content !== 'string') {
          console.log(`   ❌ 消息 [${index}] 内容不是字符串类型: ${typeof message.content}`);
          return false;
        }

        // 只检查内容不为完全空白，允许长内容
        if (message.content.trim().length === 0) {
          console.log(`   ❌ 消息 [${index}] 内容为空白字符串`);
          return false;
        }

        console.log(`   ✅ 消息 [${index}] 验证通过`);
        return true;
      }
    );

    if (validMessages.length === 0) {
      throw new Error('没有找到有效的消息内容');
    }

    // 更新request的messages为有效消息
    request.messages = validMessages;

    // 验证工具定义
    if (request.tools) {
      for (const tool of request.tools) {
        // 安全检查：确保tool对象存在且不为null/undefined
        if (!tool || typeof tool !== 'object') {
          continue; // 跳过无效的tool对象
        }
        if (tool.type !== 'function') {
          throw new Error(`不支持的工具类型: ${tool.type}`);
        }
        // 安全检查：确保tool.function存在
        if (!tool.function || typeof tool.function !== 'object') {
          throw new Error('工具函数定义无效');
        }
        if (!tool.function.name) {
          throw new Error('工具函数缺少名称');
        }
        if (!tool.function.description) {
          throw new Error('工具函数缺少描述');
        }
      }
    }

    // 验证参数范围
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw new Error('temperature参数必须在0-2之间');
    }

    if (request.top_p !== undefined && (request.top_p < 0 || request.top_p > 1)) {
      throw new Error('top_p参数必须在0-1之间');
    }

    if (request.max_tokens !== undefined && request.max_tokens < 1) {
      throw new Error('max_tokens参数必须大于0');
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.openaiClient.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      console.warn('获取OpenAI模型列表失败，使用默认列表');
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  /**
   * 估算token数量（简化版）
   */
  estimateTokens(text: string): number {
    // 简化的token估算：大约4个字符 = 1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 获取当前使用的API Key
   */
  private getApiKey(): string {
    // 如果启用了多Key认证
    if (this.config.multiKeyAuth?.enabled && this.config.multiKeyAuth.apiKeys?.length > 0) {
      const apiKeys = this.config.multiKeyAuth.apiKeys;

      if (this.config.multiKeyAuth.strategy === 'random') {
        // 随机选择策略
        const randomIndex = Math.floor(Math.random() * apiKeys.length);
        const selectedKey = apiKeys[randomIndex];
        console.log(`🔑 使用随机API Key (索引: ${randomIndex})`);
        return selectedKey;
      } else {
        // 默认使用round-robin策略
        const selectedKey = apiKeys[this.currentKeyIndex];
        console.log(`🔑 使用轮询API Key (索引: ${this.currentKeyIndex}/${apiKeys.length})`);
        return selectedKey;
      }
    }

    // 使用单个API Key
    if (this.config.apiKey) {
      console.log('🔑 使用单个API Key');
      return this.config.apiKey;
    }

    throw new Error('未配置API Key：请设置apiKey或启用multiKeyAuth');
  }

  /**
   * 轮换到下一个API Key（用于认证失败后的重试）
   */
  private rotateApiKey(): string {
    if (!this.config.multiKeyAuth?.enabled || !this.config.multiKeyAuth.apiKeys?.length) {
      throw new Error('多Key认证未启用，无法轮换');
    }

    const apiKeys = this.config.multiKeyAuth.apiKeys;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % apiKeys.length;

    console.log(`🔄 轮换到下一个API Key (索引: ${this.currentKeyIndex})`);

    // 更新OpenAI客户端的API Key
    this.openaiClient = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: apiKeys[this.currentKeyIndex],
      organization: this.config.organization,
      project: this.config.project,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    return apiKeys[this.currentKeyIndex];
  }

  /**
   * 获取模型限制信息
   */
  getModelLimits(modelName: string): { maxTokens: number; maxRequestTokens: number } {
    const limits: Record<string, { maxTokens: number; maxRequestTokens: number }> = {
      'gpt-4': { maxTokens: 8192, maxRequestTokens: 6000 },
      'gpt-4-turbo': { maxTokens: 128000, maxRequestTokens: 100000 },
      'gpt-3.5-turbo': { maxTokens: 16384, maxRequestTokens: 12000 },
      'gpt-4o': { maxTokens: 128000, maxRequestTokens: 100000 },
      'gpt-4o-mini': { maxTokens: 128000, maxRequestTokens: 100000 },
    };

    return limits[modelName] || { maxTokens: 8192, maxRequestTokens: 6000 };
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
