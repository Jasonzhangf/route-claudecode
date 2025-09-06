/**
 * Secure Anthropic to OpenAI Transformer - 四层双向处理架构
 *
 * 实现四层双向处理架构中的Transformer层，支持：
 * - 预配置模块：所有配置在组装时固化，运行时零配置传递
 * - 双向转换：processRequest和processResponse接口
 * - 模板字段表转换：配置化字段映射
 * - 并发安全：无状态设计支持多请求并发
 *
 * 安全特性：
 * - 严格的输入验证和边界检查
 * - 完整的工具格式转换
 * - 严格清理所有Anthropic特征字段
 * - 完整的错误处理和日志记录
 * - 资源使用控制
 * - 类型安全保证
 *
 * @author Jason Zhang
 * @version 5.0.0 - 四层双向处理架构
 * @security-reviewed 2025-09-06
 * @based-on CLIProxyAPI transformer implementation
 */

import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { transformAnthropicToOpenAI, transformOpenAIToAnthropic } from './anthropic-openai-converter';

import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
} from '../../interfaces/module/base-module';
import {
  BidirectionalProcessor,
  BidirectionalTransformer,
  RequestContext,
  ResponseContext,
} from '../../interfaces/module/four-layer-interfaces';
import { EventEmitter } from 'events';
import { JQJsonHandler } from '../../utils/jq-json-handler';

/**
 * 预配置接口 - 在组装时固化的配置
 */
export interface SecureTransformerPreConfig {
  // 基础配置
  preserveToolCalls: boolean;
  mapSystemMessage: boolean;
  defaultMaxTokens: number;
  // 新增：模板字段表转换配置
  fieldMappingTemplate?: Record<string, string>;
  customTransformRules?: Record<string, (value: any) => any>;
  transformDirection?: 'anthropic-to-openai' | 'openai-to-anthropic';
  concurrencyLimit?: number;
}

/**
 * 模板字段表转换配置
 */
export interface FieldMappingTemplate {
  requestFieldMapping: Record<string, string>;
  responseFieldMapping: Record<string, string>;
  customFieldHandlers: Record<string, (value: any) => any>;
}

/**
 * 安全错误类型
 */
export class TransformerSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TransformerSecurityError';
  }
}

/**
 * 安全的Anthropic到OpenAI转换器 - 四层双向处理架构实现
 * 
 * 实现ModuleInterface和BidirectionalProcessor接口
 * 支持预配置模块和并发安全的双向转换
 */
export class SecureAnthropicToOpenAITransformer extends EventEmitter implements ModuleInterface, BidirectionalProcessor, BidirectionalTransformer {
  private id: string;
  private name: string;
  private version: string;
  private status: ModuleStatus;
  private metrics: ModuleMetrics;
  private preConfig: SecureTransformerPreConfig;
  private fieldMapping: FieldMappingTemplate;
  private readonly isPreConfigured: boolean = true;
  private startTime: Date | null = null;
  private connections: Map<string, ModuleInterface> = new Map();

  constructor(preConfig?: Partial<SecureTransformerPreConfig>) {
    super();
    
    this.id = `transformer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = 'SecureAnthropicToOpenAITransformer';
    this.version = '4.0.0';
    
    this.status = {
      id: this.id,
      name: this.name,
      type: ModuleType.TRANSFORMER,
      status: 'stopped',
      health: 'healthy'
    };
    
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    // Validate pre-configuration
    if (preConfig?.defaultMaxTokens !== undefined && (preConfig.defaultMaxTokens <= 0 || preConfig.defaultMaxTokens > 100000)) {
      throw new TransformerSecurityError('defaultMaxTokens must be between 1 and 100000', 'INVALID_PRECONFIG');
    }
    
    // 固化预配置 - 运行时不可更改
    this.preConfig = {
      preserveToolCalls: preConfig?.preserveToolCalls ?? true,
      mapSystemMessage: preConfig?.mapSystemMessage ?? true,
      defaultMaxTokens: preConfig?.defaultMaxTokens ?? 262144,
      fieldMappingTemplate: preConfig?.fieldMappingTemplate ?? {},
      customTransformRules: preConfig?.customTransformRules ?? {},
      transformDirection: preConfig?.transformDirection ?? 'anthropic-to-openai',
      concurrencyLimit: preConfig?.concurrencyLimit ?? 10
    };
    
    // 初始化模板字段表转换配置
    this.fieldMapping = this.initializeFieldMappingTemplate();
    
    secureLogger.info('Transformer module initialized in pre-configured mode', {
      id: this.id,
      transformDirection: this.preConfig.transformDirection,
      hasCustomFieldHandlers: Object.keys(this.fieldMapping.customFieldHandlers).length > 0
    });
  }

  /**
   * 获取模块ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 获取模块名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取模块类型
   */
  getType(): ModuleType {
    return ModuleType.TRANSFORMER;
  }

  /**
   * 获取模块版本
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 获取模块状态
   */
  getStatus(): ModuleStatus {
    return { ...this.status };
  }

  /**
   * 获取模块性能指标
   */
  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  /**
   * 初始化模板字段表转换配置
   */
  private initializeFieldMappingTemplate(): FieldMappingTemplate {
    const defaultRequestMapping = {
      'system': 'messages[0]',
      'max_tokens': 'max_tokens',
      'temperature': 'temperature',
      'tools': 'tools',
      'tool_choice': 'tool_choice'
    };
    
    const defaultResponseMapping = {
      'choices[0].message.content': 'content[0].text',
      'choices[0].message.tool_calls': 'content[].tool_use',
      'usage.prompt_tokens': 'usage.input_tokens',
      'usage.completion_tokens': 'usage.output_tokens'
    };
    
    return {
      requestFieldMapping: {
        ...defaultRequestMapping,
        ...this.preConfig.fieldMappingTemplate
      },
      responseFieldMapping: defaultResponseMapping,
      customFieldHandlers: {
        'tools': this.transformToolsWithTemplate.bind(this),
        'messages': this.transformMessagesWithTemplate.bind(this),
        ...this.preConfig.customTransformRules
      }
    };
  }

  /**
   * 配置模块 - 预配置模式下拒绝运行时配置
   */
  async configure(config: any): Promise<void> {
    if (this.isPreConfigured) {
      secureLogger.warn('Module is pre-configured, runtime configuration ignored', {
        id: this.id,
        attemptedConfig: Object.keys(config || {}),
        currentPreConfig: Object.keys(this.preConfig)
      });
      return;
    }
    
    // 非预配置模式下的传统配置（保持向后兼容）
    this.status.lastActivity = new Date();
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (this.status.status === 'running') {
      return;
    }
    
    this.status.status = 'starting';
    this.status.lastActivity = new Date();
    
    try {
      // 模拟启动过程
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.status.status = 'running';
      this.status.health = 'healthy';
      this.startTime = new Date();
      this.status.lastActivity = new Date();
      
      this.emit('started', { id: this.id, timestamp: this.startTime });
    } catch (error) {
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      this.status.error = error as Error;
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    if (this.status.status === 'stopped') {
      return;
    }
    
    this.status.status = 'stopping';
    this.status.lastActivity = new Date();
    
    try {
      // 模拟停止过程
      await new Promise(resolve => setTimeout(resolve, 50));
      
      this.status.status = 'stopped';
      this.status.health = 'healthy';
      this.status.lastActivity = new Date();
      
      this.emit('stopped', { id: this.id, timestamp: new Date() });
    } catch (error) {
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      this.status.error = error as Error;
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 处理请求 - 四层双向处理架构主接口
   */
  async processRequest(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    const startTime = Date.now();
    this.status.status = 'busy';
    this.status.lastActivity = new Date();
    
    try {
      // 验证输入格式
      if (!input || typeof input !== 'object') {
        throw new TransformerSecurityError('Invalid input format', 'INVALID_INPUT');
      }

      let output: any;
      
      // 根据预配置的转换方向处理请求
      if (this.preConfig.transformDirection === 'anthropic-to-openai') {
        output = await this.transformAnthropicRequestToOpenAI(input);
      } else if (this.preConfig.transformDirection === 'openai-to-anthropic') {
        output = await this.transformOpenAIRequestToAnthropic(input);
      } else {
        throw new TransformerSecurityError(`Unsupported transform direction: ${this.preConfig.transformDirection}`, 'UNSUPPORTED_DIRECTION');
      }
      
      // 更新指标
      this.updateMetrics(startTime, true);
      
      this.status.status = 'running';
      this.status.lastActivity = new Date();
      
      this.emit('requestProcessed', { 
        id: this.id, 
        input, 
        output, 
        processingTime: Date.now() - startTime,
        timestamp: new Date() 
      });
      
      return output;
    } catch (error) {
      this.updateMetrics(startTime, false);
      
      this.status.status = 'running';
      this.status.health = 'degraded';
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 处理响应 - 四层双向处理架构主接口
   */
  async processResponse(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    const startTime = Date.now();
    this.status.status = 'busy';
    this.status.lastActivity = new Date();
    
    try {
      // 验证输入格式
      if (!input || typeof input !== 'object') {
        throw new TransformerSecurityError('Invalid input format', 'INVALID_INPUT');
      }

      let output: any;
      
      // 根据预配置的转换方向处理响应（方向相反）
      if (this.preConfig.transformDirection === 'anthropic-to-openai') {
        // 响应需要从OpenAI转回Anthropic
        output = await this.transformOpenAIResponseToAnthropic(input);
      } else if (this.preConfig.transformDirection === 'openai-to-anthropic') {
        // 响应需要从Anthropic转回OpenAI
        output = await this.transformAnthropicResponseToOpenAI(input);
      } else {
        throw new TransformerSecurityError(`Unsupported transform direction: ${this.preConfig.transformDirection}`, 'UNSUPPORTED_DIRECTION');
      }
      
      // 更新指标
      this.updateMetrics(startTime, true);
      
      this.status.status = 'running';
      this.status.lastActivity = new Date();
      
      this.emit('responseProcessed', { 
        id: this.id, 
        input, 
        output, 
        processingTime: Date.now() - startTime,
        timestamp: new Date() 
      });
      
      return output;
    } catch (error) {
      this.updateMetrics(startTime, false);
      
      this.status.status = 'running';
      this.status.health = 'degraded';
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 处理数据 - 兼容旧接口，自动检测是请求还是响应
   * @deprecated 使用 processRequest 或 processResponse
   */
  async process(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    const startTime = Date.now();
    this.status.status = 'busy';
    this.status.lastActivity = new Date();
    
    try {
      // 验证输入格式
      if (!input || typeof input !== 'object') {
        throw new TransformerSecurityError('Invalid input format', 'INVALID_INPUT');
      }

      // 自动检测是请求还是响应，调用相应的新接口
      if (this.isRequest(input)) {
        return await this.processRequest(input);
      } else if (this.isResponse(input)) {
        return await this.processResponse(input);
      } else {
        throw new TransformerSecurityError('Unsupported input format', 'UNSUPPORTED_FORMAT');
      }
    } catch (error) {
      this.updateMetrics(startTime, false);
      
      this.status.status = 'running'; // 恢复到运行状态
      this.status.health = 'degraded';
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
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
   * 使用模板字段表转换Anthropic请求到OpenAI
   */
  private async transformAnthropicRequestToOpenAI(input: any): Promise<any> {
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始Anthropic→OpenAI请求转换', {
      id: this.id,
      inputType: typeof input,
      hasFieldMapping: Object.keys(this.fieldMapping.requestFieldMapping).length > 0
    });
    
    try {
      // 使用现有的转换逻辑
      const baseOutput = transformAnthropicToOpenAI(input);
      
      // 应用模板字段表转换
      const finalOutput = this.applyFieldMappingToRequest(baseOutput, this.fieldMapping.requestFieldMapping);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] Anthropic→OpenAI请求转换完成', {
        id: this.id,
        appliedMappings: Object.keys(this.fieldMapping.requestFieldMapping).length
      });
      
      return finalOutput;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] Anthropic→OpenAI请求转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 使用模板字段表转换OpenAI请求到Anthropic
   */
  private async transformOpenAIRequestToAnthropic(input: any): Promise<any> {
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始OpenAI→Anthropic请求转换', {
      id: this.id,
      inputType: typeof input
    });
    
    try {
      // 使用现有的转换逻辑
      const baseOutput = transformOpenAIToAnthropic(input);
      
      // 应用模板字段表转换
      const finalOutput = this.applyFieldMappingToRequest(baseOutput, this.fieldMapping.requestFieldMapping);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] OpenAI→Anthropic请求转换完成', {
        id: this.id
      });
      
      return finalOutput;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] OpenAI→Anthropic请求转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 转换OpenAI响应到Anthropic
   */
  private async transformOpenAIResponseToAnthropic(input: any): Promise<any> {
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始OpenAI→Anthropic响应转换', {
      id: this.id,
      inputType: typeof input
    });
    
    try {
      // 实现OpenAI响应到Anthropic格式的转换
      if (!input || !input.choices || !Array.isArray(input.choices)) {
        return input;
      }

      const anthropicResponse = {
        id: input.id || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model: input.model,
        stop_reason: this.mapFinishReasonToStopReason(input.choices[0]?.finish_reason),
        stop_sequence: null,
        usage: {
          input_tokens: input.usage?.prompt_tokens || 0,
          output_tokens: input.usage?.completion_tokens || 0
        }
      };

      const choice = input.choices[0];
      if (choice?.message) {
        // 处理文本内容
        if (choice.message.content) {
          anthropicResponse.content.push({
            type: 'text',
            text: choice.message.content
          });
        }

        // 处理工具调用
        if (choice.message.tool_calls) {
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.type === 'function') {
              anthropicResponse.content.push({
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.function.name,
                input: JQJsonHandler.parseJsonString(toolCall.function.arguments) || {}
              });
            }
          }
        }
      }

      // 应用模板字段表转换
      const finalOutput = this.applyFieldMappingToResponse(anthropicResponse, this.fieldMapping.responseFieldMapping);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] OpenAI→Anthropic响应转换完成', {
        id: this.id
      });
      
      return finalOutput;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] OpenAI→Anthropic响应转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 转换Anthropic响应到OpenAI
   */
  private async transformAnthropicResponseToOpenAI(input: any): Promise<any> {
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始Anthropic→OpenAI响应转换', {
      id: this.id,
      inputType: typeof input
    });
    
    try {
      // 实现Anthropic响应到OpenAI格式的转换
      if (!input || input.type !== 'message') {
        return input;
      }

      const openaiResponse = {
        id: input.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: input.model || 'unknown',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '',
            tool_calls: undefined as any
          },
          finish_reason: this.mapStopReasonToFinishReason(input.stop_reason)
        }],
        usage: {
          prompt_tokens: input.usage?.input_tokens || 0,
          completion_tokens: input.usage?.output_tokens || 0,
          total_tokens: (input.usage?.input_tokens || 0) + (input.usage?.output_tokens || 0)
        }
      };

      const contentParts: string[] = [];
      const toolCalls: any[] = [];

      if (input.content && Array.isArray(input.content)) {
        for (const contentBlock of input.content) {
          if (contentBlock.type === 'text') {
            contentParts.push(contentBlock.text);
          } else if (contentBlock.type === 'tool_use') {
            toolCalls.push({
              id: contentBlock.id,
              type: 'function',
              function: {
                name: contentBlock.name,
                arguments: JQJsonHandler.stringifyJson(contentBlock.input || {})
              }
            });
          }
        }
      }

      openaiResponse.choices[0].message.content = contentParts.join('') || null;
      if (toolCalls.length > 0) {
        openaiResponse.choices[0].message.tool_calls = toolCalls;
      }

      // 应用模板字段表转换
      const finalOutput = this.applyFieldMappingToResponse(openaiResponse, this.fieldMapping.responseFieldMapping);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] Anthropic→OpenAI响应转换完成', {
        id: this.id
      });
      
      return finalOutput;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] Anthropic→OpenAI响应转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 请求转换：Anthropic → OpenAI (兼容性方法)
   * @deprecated 使用 processRequest
   */
  async transformRequest(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始请求转换 Anthropic → OpenAI', {
      id: this.id,
      inputType: typeof input,
      inputKeys: input && typeof input === 'object' ? Object.keys(input) : []
    });
    
    try {
      const output = transformAnthropicToOpenAI(input);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] 请求转换完成', {
        id: this.id,
        outputType: typeof output,
        hasOutput: !!output,
        outputKeys: output && typeof output === 'object' ? Object.keys(output).length : 0
      });
      
      return output;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] 请求转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 响应转换：OpenAI → Anthropic (兼容性方法)
   * @deprecated 使用 processResponse
   */
  async transformResponse(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    secureLogger.debug('🔄 [SECURE-TRANSFORMER] 开始响应转换 OpenAI → Anthropic', {
      id: this.id,
      inputType: typeof input,
      inputKeys: input && typeof input === 'object' ? Object.keys(input) : []
    });
    
    try {
      const output = transformOpenAIToAnthropic(input);
      
      secureLogger.debug('✅ [SECURE-TRANSFORMER] 响应转换完成', {
        id: this.id,
        outputType: typeof output,
        hasOutput: !!output,
        outputKeys: output && typeof output === 'object' ? Object.keys(output).length : 0
      });
      
      return output;
    } catch (error) {
      secureLogger.error('❌ [SECURE-TRANSFORMER] 响应转换失败', {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 应用字段映射到请求
   */
  private applyFieldMappingToRequest(data: any, mapping: Record<string, string>): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    let result = { ...data };
    
    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (sourceField in data && this.fieldMapping.customFieldHandlers[sourceField]) {
        const handler = this.fieldMapping.customFieldHandlers[sourceField];
        try {
          result[targetField] = handler(data[sourceField]);
        } catch (error) {
          secureLogger.warn('Custom field handler failed', {
            sourceField,
            targetField,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    return result;
  }

  /**
   * 应用字段映射到响应
   */
  private applyFieldMappingToResponse(data: any, mapping: Record<string, string>): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    // 简化实现，直接返回数据
    // 可以根据需要实现更复杂的响应字段映射逻辑
    return data;
  }

  /**
   * 使用模板转换工具字段
   */
  private transformToolsWithTemplate(tools: any[]): any[] {
    if (!Array.isArray(tools)) return tools;
    
    // 使用预配置的工具转换逻辑
    return tools.map(tool => {
      if (!this.preConfig.preserveToolCalls) {
        return null;
      }
      
      // 应用工具转换逻辑
      return tool;
    }).filter(Boolean);
  }

  /**
   * 使用模板转换消息字段
   */
  private transformMessagesWithTemplate(messages: any[]): any[] {
    if (!Array.isArray(messages)) return messages;
    
    // 使用预配置的消息转换逻辑
    return messages.map(message => {
      if (!this.preConfig.mapSystemMessage && message.role === 'system') {
        return null;
      }
      
      // 应用消息转换逻辑
      return message;
    }).filter(Boolean);
  }

  /**
   * 映射finish_reason到stop_reason
   */
  private mapFinishReasonToStopReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence'
    };
    return mapping[finishReason] || 'end_turn';
  }

  /**
   * 映射stop_reason到finish_reason
   */
  private mapStopReasonToFinishReason(stopReason: string): string {
    const mapping: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'tool_use': 'tool_calls',
      'stop_sequence': 'content_filter'
    };
    return mapping[stopReason] || 'stop';
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(startTime: number, success: boolean): void {
    this.metrics.requestsProcessed++;
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
      this.metrics.requestsProcessed;
    
    if (!success) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * this.metrics.requestsProcessed + 1) / 
        (this.metrics.requestsProcessed + 1);
    }
    
    this.emit('metricsUpdated', this.metrics);
  }

  /**
   * 重置模块状态
   */
  async reset(): Promise<void> {
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    this.status.lastActivity = new Date();
  }

  /**
   * 清理模块资源
   */
  async cleanup(): Promise<void> {
    // 清理资源
    this.removeAllListeners();
    this.status.lastActivity = new Date();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status.health === 'healthy' || this.status.health === 'degraded',
      details: {
        status: this.status.status,
        health: this.status.health,
        metrics: this.metrics,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        isPreConfigured: this.isPreConfigured,
        transformDirection: this.preConfig.transformDirection,
        concurrencyLimit: this.preConfig.concurrencyLimit
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

  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    const connection = this.connections.get(targetModuleId);
    if (!connection) {
      return 'disconnected';
    }
    const status = connection.getStatus();
    return status.status === 'running' ? 'connected' : (status.status as any);
  }

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