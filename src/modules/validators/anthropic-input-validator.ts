/**
 * Anthropic输入验证模块
 *
 * 验证输入是否符合Anthropic API标准格式
 *
 * @author Jason Zhang
 */

import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
} from '../interfaces/module/base-module';
import { IValidationResult } from '../types/src/index';
import { EventEmitter } from 'events';

/**
 * Anthropic输入验证模块配置
 */
export interface AnthropicInputValidatorConfig {
  strictMode: boolean;
  allowExtraFields: boolean;
  maxMessagesLength: number;
  maxMessageLength: number;
  maxToolsLength: number;
}

/**
 * Anthropic输入验证模块
 */
export class AnthropicInputValidator extends EventEmitter implements ModuleInterface {
  protected readonly id: string = 'anthropic-input-validator';
  protected readonly name: string = 'Anthropic Input Validator';
  protected readonly type: ModuleType = ModuleType.VALIDATION;
  protected readonly version: string = '1.0.0';
  protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  protected connections: Map<string, ModuleInterface> = new Map();
  protected config: AnthropicInputValidatorConfig = {
    strictMode: true,
    allowExtraFields: false,
    maxMessagesLength: Number.MAX_SAFE_INTEGER,
    maxMessageLength: Number.MAX_SAFE_INTEGER,
    maxToolsLength: Number.MAX_SAFE_INTEGER,
  };
  protected metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };
  private validatorConfig: AnthropicInputValidatorConfig;

  constructor(config: Partial<AnthropicInputValidatorConfig> = {}) {
    super();

    this.validatorConfig = {
      strictMode: true,
      allowExtraFields: false,
      maxMessagesLength: Number.MAX_SAFE_INTEGER,
      maxMessageLength: Number.MAX_SAFE_INTEGER,
      maxToolsLength: Number.MAX_SAFE_INTEGER,
      ...config,
    };
  }

  // 实现ModuleInterface接口方法
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
      status: this.status,
      health: this.status === 'running' ? 'healthy' : 'unhealthy',
      lastActivity: this.metrics.lastProcessedAt,
    };
  }

  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  async configure(config: any): Promise<void> {
    this.validatorConfig = { ...this.validatorConfig, ...config };
  }

  async start(): Promise<void> {
    this.status = 'starting';
    this.status = 'running';
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.status = 'stopping';
    this.status = 'stopped';
    this.emit('stopped');
  }

  async reset(): Promise<void> {
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'running',
      details: {
        status: this.status,
        metrics: this.metrics,
      },
    };
  }

  async process(input: any): Promise<any> {
    const startTime = Date.now();
    try {
      const result = await this.validateInput(input);
      this.updateMetrics(Date.now() - startTime, false);
      return result;
    } catch (error) {
      this.updateMetrics(Date.now() - startTime, true);
      throw error;
    }
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.requestsProcessed++;
    this.metrics.lastProcessedAt = new Date();

    // 更新平均处理时间
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.requestsProcessed;

    // 更新错误率
    if (isError) {
      this.metrics.errorRate =
        (this.metrics.errorRate * (this.metrics.requestsProcessed - 1) + 1) / this.metrics.requestsProcessed;
    } else {
      this.metrics.errorRate =
        (this.metrics.errorRate * (this.metrics.requestsProcessed - 1)) / this.metrics.requestsProcessed;
    }
  }

  private async validateInput(input: any): Promise<IValidationResult> {
    // 原有的验证逻辑
    if (!input) {
      return { isValid: false, errors: ['Input is required'] };
    }

    const errors: string[] = [];

    try {
      this.validateBasicStructure(input);
      this.validateRequiredFields(input);

      if (input.messages) {
        this.validateMessages(input.messages);
      }

      if (input.tools) {
        this.validateTools(input.tools);
      }

      this.validateParameterRanges(input);

      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: Partial<AnthropicInputValidatorConfig>): Promise<void> {
    this.validatorConfig = { ...this.validatorConfig, ...config };
  }

  /**
   * 处理输入验证
   */
  protected async onProcess(input: any): Promise<any> {
    if (!input) {
      throw new Error('Input is required');
    }

    // 验证基本结构
    this.validateBasicStructure(input);

    // 验证必需字段
    this.validateRequiredFields(input);

    // 验证消息格式
    if (input.messages) {
      this.validateMessages(input.messages);
    }

    // 验证工具格式
    if (input.tools) {
      this.validateTools(input.tools);
    }

    // 验证参数范围
    this.validateParameterRanges(input);

    // 在严格模式下验证额外字段
    if (this.validatorConfig.strictMode && !this.validatorConfig.allowExtraFields) {
      this.validateNoExtraFields(input);
    }

    return input;
  }

  /**
   * 验证基本结构
   */
  private validateBasicStructure(input: any): void {
    if (typeof input !== 'object') {
      throw new Error('Input must be an object');
    }

    if (Array.isArray(input)) {
      throw new Error('Input cannot be an array');
    }
  }

  /**
   * 验证必需字段
   */
  private validateRequiredFields(input: any): void {
    const requiredFields = ['model', 'messages'];

    for (const field of requiredFields) {
      if (!(field in input)) {
        throw new Error(`Missing required field: ${field}`);
      }

      if (input[field] === null || input[field] === undefined) {
        throw new Error(`Field ${field} cannot be null or undefined`);
      }
    }

    // 验证model字段
    if (typeof input.model !== 'string' || !input.model.trim()) {
      throw new Error('Model must be a non-empty string');
    }

    // 验证messages字段
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }
  }

  /**
   * 验证消息格式
   */
  private validateMessages(messages: any[]): void {
    if (messages.length > this.validatorConfig.maxMessagesLength) {
      throw new Error(`Too many messages: ${messages.length} > ${this.validatorConfig.maxMessagesLength}`);
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (!message || typeof message !== 'object') {
        throw new Error(`Message at index ${i} must be an object`);
      }

      // 验证role字段
      if (!message.role || typeof message.role !== 'string') {
        throw new Error(`Message at index ${i} must have a valid role`);
      }

      const validRoles = ['user', 'assistant', 'system'];
      if (!validRoles.includes(message.role)) {
        throw new Error(`Message at index ${i} has invalid role: ${message.role}`);
      }

      // 验证content字段
      if (!message.content) {
        throw new Error(`Message at index ${i} must have content`);
      }

      if (typeof message.content === 'string') {
        if (message.content.length > this.validatorConfig.maxMessageLength) {
          throw new Error(
            `Message content at index ${i} is too long: ${message.content.length} > ${this.validatorConfig.maxMessageLength}`
          );
        }
      } else if (Array.isArray(message.content)) {
        this.validateMessageContentBlocks(message.content, i);
      } else {
        throw new Error(`Message content at index ${i} must be string or array`);
      }
    }
  }

  /**
   * 验证消息内容块
   */
  private validateMessageContentBlocks(contentBlocks: any[], messageIndex: number): void {
    for (let i = 0; i < contentBlocks.length; i++) {
      const block = contentBlocks[i];

      if (!block || typeof block !== 'object') {
        throw new Error(`Content block ${i} in message ${messageIndex} must be an object`);
      }

      if (!block.type || typeof block.type !== 'string') {
        throw new Error(`Content block ${i} in message ${messageIndex} must have a type`);
      }

      const validBlockTypes = ['text', 'image', 'tool_use', 'tool_result'];
      if (!validBlockTypes.includes(block.type)) {
        throw new Error(`Content block ${i} in message ${messageIndex} has invalid type: ${block.type}`);
      }

      // 根据类型验证特定字段
      switch (block.type) {
        case 'text':
          if (!block.text || typeof block.text !== 'string') {
            throw new Error(`Text block ${i} in message ${messageIndex} must have text field`);
          }
          break;

        case 'image':
          if (!block.source || typeof block.source !== 'object') {
            throw new Error(`Image block ${i} in message ${messageIndex} must have source field`);
          }
          break;

        case 'tool_use':
          if (!block.id || typeof block.id !== 'string') {
            throw new Error(`Tool use block ${i} in message ${messageIndex} must have id field`);
          }
          if (!block.name || typeof block.name !== 'string') {
            throw new Error(`Tool use block ${i} in message ${messageIndex} must have name field`);
          }
          break;

        case 'tool_result':
          if (!block.tool_use_id || typeof block.tool_use_id !== 'string') {
            throw new Error(`Tool result block ${i} in message ${messageIndex} must have tool_use_id field`);
          }
          break;
      }
    }
  }

  /**
   * 验证工具格式
   */
  private validateTools(tools: any[]): void {
    if (tools.length > this.validatorConfig.maxToolsLength) {
      throw new Error(`Too many tools: ${tools.length} > ${this.validatorConfig.maxToolsLength}`);
    }

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];

      if (!tool || typeof tool !== 'object') {
        throw new Error(`Tool at index ${i} must be an object`);
      }

      // 验证name字段
      if (!tool.name || typeof tool.name !== 'string') {
        throw new Error(`Tool at index ${i} must have a name`);
      }

      // 验证description字段
      if (tool.description && typeof tool.description !== 'string') {
        throw new Error(`Tool at index ${i} description must be a string`);
      }

      // 验证input_schema字段
      if (!tool.input_schema || typeof tool.input_schema !== 'object') {
        throw new Error(`Tool at index ${i} must have an input_schema`);
      }

      // 验证input_schema类型
      if (tool.input_schema.type !== 'object') {
        throw new Error(`Tool at index ${i} input_schema type must be 'object'`);
      }
    }
  }

  /**
   * 验证参数范围
   */
  private validateParameterRanges(input: any): void {
    // 验证max_tokens
    if (input.max_tokens !== undefined) {
      if (!Number.isInteger(input.max_tokens) || input.max_tokens <= 0) {
        throw new Error('max_tokens must be a positive integer');
      }

      if (input.max_tokens > 100000) {
        throw new Error('max_tokens cannot exceed 100000');
      }
    }

    // 验证temperature
    if (input.temperature !== undefined) {
      if (typeof input.temperature !== 'number') {
        throw new Error('temperature must be a number');
      }

      if (input.temperature < 0 || input.temperature > 1) {
        throw new Error('temperature must be between 0 and 1');
      }
    }

    // 验证top_p
    if (input.top_p !== undefined) {
      if (typeof input.top_p !== 'number') {
        throw new Error('top_p must be a number');
      }

      if (input.top_p < 0 || input.top_p > 1) {
        throw new Error('top_p must be between 0 and 1');
      }
    }

    // 验证stop sequences
    if (input.stop !== undefined) {
      if (typeof input.stop === 'string') {
        // 单个停止序列
        if (input.stop.length === 0) {
          throw new Error('stop sequence cannot be empty');
        }
      } else if (Array.isArray(input.stop)) {
        // 多个停止序列
        if (input.stop.length === 0) {
          throw new Error('stop sequences array cannot be empty');
        }

        for (let i = 0; i < input.stop.length; i++) {
          if (typeof input.stop[i] !== 'string' || input.stop[i].length === 0) {
            throw new Error(`stop sequence at index ${i} must be a non-empty string`);
          }
        }

        if (input.stop.length > 4) {
          throw new Error('cannot have more than 4 stop sequences');
        }
      } else {
        throw new Error('stop must be a string or array of strings');
      }
    }
  }

  /**
   * 验证无额外字段
   */
  private validateNoExtraFields(input: any): void {
    const allowedFields = [
      'model',
      'messages',
      'max_tokens',
      'temperature',
      'top_p',
      'top_k',
      'stop',
      'stream',
      'system',
      'tools',
      'tool_choice',
      'metadata',
    ];

    for (const field in input) {
      if (!allowedFields.includes(field)) {
        throw new Error(`Unexpected field in strict mode: ${field}`);
      }
    }
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
