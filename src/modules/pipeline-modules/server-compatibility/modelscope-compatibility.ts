/**
 * ModelScope兼容性模块 - Server Compatibility层
 * 
 * 核心功能:
 * - Anthropic工具格式 → OpenAI工具格式转换
 * - ModelScope API兼容性处理
 * - 严格错误处理：失败时立即抛出错误
 *
 * @author RCC v4.0
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { secureLogger } from '../../../utils/secure-logger';
import { RCCError, ValidationError, TransformError, ERROR_CODES } from '../../../types/error';

export interface ModelScopeCompatibilityConfig {
  preserveToolCalls: boolean;
  validateInputSchema: boolean;
  maxToolsPerRequest: number;
}

/**
 * ModelScope兼容性模块
 * 专门处理Anthropic → OpenAI工具格式转换
 */
export class ModelScopeCompatibilityModule extends EventEmitter implements ModuleInterface {
  private config: ModelScopeCompatibilityConfig;
  private currentStatus: ModuleStatus;
  private connections: Map<string, ModuleInterface> = new Map();

  constructor(config: ModelScopeCompatibilityConfig = {
    preserveToolCalls: true,
    validateInputSchema: true,
    maxToolsPerRequest: 20
  }) {
    super();
    this.config = config;
    this.currentStatus = {
      id: 'modelscope-compatibility',
      name: 'ModelScope Compatibility Module',
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'stopped',
      health: 'healthy',
    };
  }

  // ============================================================================
  // ModuleInterface 实现
  // ============================================================================

  getId(): string {
    return this.currentStatus.id;
  }

  getName(): string {
    return this.currentStatus.name;
  }

  getType(): ModuleType {
    return this.currentStatus.type;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getStatus(): ModuleStatus {
    return { ...this.currentStatus };
  }

  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  async initialize(): Promise<void> {
    this.currentStatus.status = 'starting';
    
    try {
      this.validateConfiguration();
      this.currentStatus.status = 'running';
      this.currentStatus.lastActivity = new Date();
      
      secureLogger.info('✅ ModelScope兼容性模块初始化完成', {
        moduleId: this.getId()
      });
    } catch (error) {
      const rccError = new RCCError(
        'ModelScope兼容性模块初始化失败',
        ERROR_CODES.PIPELINE_INIT_FAILED,
        'modelscope-compatibility',
        { originalError: error }
      );
      secureLogger.error('ModelScope兼容性模块初始化失败', { error: rccError });
      throw rccError;
    }
  }

  async start(): Promise<void> {
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
  }

  async stop(): Promise<void> {
    this.currentStatus.status = 'stopped';
  }

  async reset(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.currentStatus.health = 'healthy';
    this.currentStatus.error = undefined;
  }

  async cleanup(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.removeAllListeners();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const healthy = this.currentStatus.status === 'running';
    return {
      healthy,
      details: {
        status: this.currentStatus.status,
        lastActivity: this.currentStatus.lastActivity,
      },
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastProcessedAt: this.currentStatus.lastActivity,
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

  // ============================================================================
  // 核心处理方法
  // ============================================================================

  /**
   * 处理请求 - 主入口点
   */
  async process(request: any): Promise<any> {
    this.currentStatus.lastActivity = new Date();

    secureLogger.debug('🔄 ModelScope兼容模块开始处理', {
      hasTools: !!request.tools,
      toolsCount: Array.isArray(request.tools) ? request.tools.length : 0,
      model: request.model,
      requestKeys: Object.keys(request)
    });

    let processedRequest = { ...request };

    // 转换工具格式（如果有工具）
    if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
      processedRequest = await this.transformToolsFormat(processedRequest);
    }

    // 🔧 关键修复：从__internal对象中获取Protocol层映射的真实模型名
    if (request.__internal && request.__internal.actualModel) {
      processedRequest.model = request.__internal.actualModel;
      secureLogger.debug('✅ 从__internal获取Protocol层映射的模型名', {
        originalModel: request.model,
        actualModel: processedRequest.model,
        hasInternal: !!request.__internal
      });
    } else if (request.model && request.model !== 'default') {
      processedRequest.model = request.model;
      secureLogger.debug('✅ 保留原始请求中的模型名', {
        model: processedRequest.model
      });
    } else {
      secureLogger.warn('⚠️ 未找到有效的模型名，将使用default', {
        requestModel: request.model,
        hasInternal: !!request.__internal,
        internalKeys: request.__internal ? Object.keys(request.__internal) : []
      });
    }
    
    secureLogger.info('✅ ModelScope兼容模块处理完成', {
      originalToolsCount: request.tools?.length || 0,
      processedToolsCount: processedRequest.tools?.length || 0,
      model: processedRequest.model
    });

    return processedRequest;
  }

  // ============================================================================
  // 工具格式转换
  // ============================================================================

  /**
   * 转换工具格式
   */
  private async transformToolsFormat(request: any): Promise<any> {
    if (!this.config.preserveToolCalls || !request.tools) {
      return request;
    }

    const processedRequest = { ...request };
    
    try {
      // 检测并转换工具格式
      if (this.isAnthropicToolsFormat(request.tools)) {
        processedRequest.tools = this.convertAnthropicToOpenAI(request.tools);
        secureLogger.info('🔄 Anthropic → OpenAI 工具格式转换完成', {
          originalCount: request.tools.length,
          convertedCount: processedRequest.tools.length
        });
      } else if (this.isOpenAIToolsFormat(request.tools)) {
        secureLogger.debug('⚡ 已为OpenAI格式，无需转换');
      } else {
        const unknownFormatError = new TransformError(
          '不支持的工具格式',
          { toolsCount: request.tools.length, firstTool: request.tools[0] }
        );
        secureLogger.error('不支持的工具格式', { error: unknownFormatError });
        throw unknownFormatError;
      }

      // 验证转换结果
      if (this.config.validateInputSchema) {
        this.validateTools(processedRequest.tools);
      }

      return processedRequest;

    } catch (error) {
      const transformError = new TransformError(
        '工具格式转换失败',
        { originalError: error, toolsCount: request.tools.length }
      );
      secureLogger.error('工具格式转换失败', { error: transformError });
      throw transformError;
    }
  }

  /**
   * 检查是否为Anthropic工具格式
   */
  private isAnthropicToolsFormat(tools: any[]): boolean {
    return tools.every(tool => 
      tool &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      tool.input_schema &&
      typeof tool.input_schema === 'object' &&
      !tool.type && // OpenAI格式会有type: 'function'
      !tool.function // OpenAI格式会有function字段
    );
  }

  /**
   * 检查是否为OpenAI工具格式
   */
  private isOpenAIToolsFormat(tools: any[]): boolean {
    return tools.every(tool =>
      tool &&
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.description === 'string' &&
      tool.function.parameters &&
      typeof tool.function.parameters === 'object'
    );
  }

  /**
   * 转换Anthropic工具格式为OpenAI格式
   */
  private convertAnthropicToOpenAI(tools: any[]): any[] {
    const convertedTools: any[] = [];

    for (const [index, tool] of tools.entries()) {
      try {
        if (!this.isValidAnthropicTool(tool)) {
          const invalidToolError = new ValidationError(
            `工具${index}不符合Anthropic格式`,
            { toolIndex: index, tool }
          );
          secureLogger.error('无效的Anthropic工具', { error: invalidToolError });
          throw invalidToolError;
        }

        const openaiTool = {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: {
              type: tool.input_schema.type || 'object',
              properties: tool.input_schema.properties || {},
              required: tool.input_schema.required || []
            }
          }
        };

        convertedTools.push(openaiTool);
        
        secureLogger.debug('✅ 工具转换成功', {
          toolName: tool.name,
          index
        });

      } catch (error) {
        const rccError = new RCCError(
          '单个工具转换失败',
          ERROR_CODES.TRANSFORM_FAILED,
          'modelscope-compatibility',
          { originalError: error, toolIndex: index, toolName: tool?.name }
        );
        secureLogger.error('单个工具转换失败', { error: rccError });
        throw rccError;
      }
    }

    return convertedTools;
  }

  /**
   * 验证Anthropic工具
   */
  private isValidAnthropicTool(tool: any): boolean {
    return tool &&
           typeof tool.name === 'string' &&
           tool.name.length > 0 &&
           typeof tool.description === 'string' &&
           tool.input_schema &&
           typeof tool.input_schema === 'object';
  }

  /**
   * 验证工具列表
   */
  private validateTools(tools: any[]): void {
    if (tools.length > this.config.maxToolsPerRequest) {
      const tooManyToolsError = new ValidationError(
        `工具数量${tools.length}超过最大限制${this.config.maxToolsPerRequest}`,
        { toolsCount: tools.length, maxAllowed: this.config.maxToolsPerRequest }
      );
      secureLogger.error('工具数量超限', { error: tooManyToolsError });
      throw tooManyToolsError;
    }

    for (const [index, tool] of tools.entries()) {
      if (!this.isValidOpenAITool(tool)) {
        const validationError = new ValidationError(
          `工具${index}验证失败`,
          { toolIndex: index, toolName: tool?.function?.name }
        );
        secureLogger.error('工具验证失败', { error: validationError });
        throw validationError;
      }
    }
  }

  /**
   * 验证OpenAI工具
   */
  private isValidOpenAITool(tool: any): boolean {
    return tool &&
           tool.type === 'function' &&
           tool.function &&
           typeof tool.function.name === 'string' &&
           tool.function.name.length > 0 &&
           typeof tool.function.description === 'string' &&
           tool.function.parameters &&
           typeof tool.function.parameters === 'object';
  }

  /**
   * 验证配置
   */
  private validateConfiguration(): void {
    if (typeof this.config.maxToolsPerRequest !== 'number' || this.config.maxToolsPerRequest <= 0) {
      const validationError = new ValidationError(
        'Invalid maxToolsPerRequest configuration',
        { config: this.config }
      );
      secureLogger.error('配置验证失败', { error: validationError });
      throw validationError;
    }
  }
}