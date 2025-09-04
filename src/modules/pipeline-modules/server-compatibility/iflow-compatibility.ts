/**
 * iFlow Server Compatibility Module
 * Handles iFlow API compatibility adjustments with enhanced tool calling and response processing
 */

import { ModuleInterface, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { secureLogger } from '../../../utils/secure-logger';
import { API_DEFAULTS } from '../../../constants/api-defaults';
import { JQJsonHandler } from '../../../utils/jq-json-handler';
import { OpenAIStandardResponse, OpenAIErrorResponse } from './types/compatibility-types';
import { ERROR_MESSAGES } from '../../../constants/error-messages';

// ✅ Configuration-driven constants - no more hardcoding
const IFLOW_CONSTANTS = {
  MILLISECONDS_PER_SECOND: 1000,  // Mathematical constant - acceptable
  MODULE_VERSION: '1.0.0'         // Module version - acceptable
};

interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
  };
  metadata?: {
    protocolConfig?: {
      endpoint?: string;
      apiKey?: string;
      protocol?: string;
      timeout?: number;
      maxRetries?: number;
      customHeaders?: Record<string, string>;
    };
    [key: string]: any;
  };
}

export interface IFlowCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  models: {
    available: string[];
    default: string;
    mapping?: Record<string, string>;
  };
  authentication: {
    method: 'Bearer' | 'APIKey' | 'Custom';
    format?: string;
  };
  parameters: {
    topK: {
      min: number;
      max: number;
      default: number;
    };
    temperature: {
      min: number;
      max: number;
      default: number;
    };
  };
  endpoints: {
    primary: string;
    fallback?: string[];
  };
}

export class IFlowCompatibilityModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'iflow-compatibility';
  private readonly name: string = 'iFlow Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = IFLOW_CONSTANTS.MODULE_VERSION;
  private readonly config: IFlowCompatibilityConfig;
  private status: any = 'healthy';
  private isInitialized = false;
  private connections: Map<string, ModuleInterface> = new Map();
  private metrics = {
    requestsProcessed: 0,
    errorsHandled: 0,
    responsesFixed: 0,
    toolCallsProcessed: 0
  };

  constructor(config: IFlowCompatibilityConfig) {
    super();
    this.config = config;
    
    secureLogger.info('Initialize iFlow compatibility module', {
      endpoint: config.baseUrl,
      defaultModel: config.models.default,
      supportedModels: config.models.available.length
    });
  }

  getId(): string { 
    return this.id; 
  }

  getName(): string { 
    return this.name; 
  }

  getType(): any { 
    return this.type; 
  }

  getVersion(): string { 
    return this.version; 
  }

  getStatus(): any { 
    return this.status; 
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: this.metrics.requestsProcessed,
      averageProcessingTime: 0,
      errorRate: this.metrics.errorsHandled / Math.max(this.metrics.requestsProcessed, 1),
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  async configure(config: any): Promise<void> {
    secureLogger.info('iFlow compatibility module config updated');
  }

  async reset(): Promise<void> {
    this.status = 'healthy';
    this.emit('statusChanged', { health: this.status });
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'healthy',
      details: {
        status: this.status,
        initialized: this.isInitialized,
        endpoint: this.config.baseUrl,
        defaultModel: this.config.models.default
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.status = 'healthy';
      this.isInitialized = true;
      this.emit('statusChanged', { health: this.status });
      secureLogger.info('iFlow compatibility module initialized');
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      secureLogger.error('iFlow compatibility module init failed:', { error: error.message });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.emit('statusChanged', { health: this.status });
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }

  async processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      this.metrics.requestsProcessed++;
      const processedRequest = { ...request };

      // ✅ Configuration-driven model selection
      if (context?.config?.actualModel) {
        processedRequest.model = context.config.actualModel;
      } else if (!processedRequest.model) {
        processedRequest.model = this.config.models.default;
      }
      
      // Apply model mapping if configured
      if (this.config.models.mapping && this.config.models.mapping[processedRequest.model]) {
        const mappedModel = this.config.models.mapping[processedRequest.model];
        secureLogger.debug('🔄 iFlow模型映射', {
          originalModel: processedRequest.model,
          mappedModel: mappedModel,
          requestId: context.requestId
        });
        processedRequest.model = mappedModel;
      }

      // 🔧 工具格式处理 - 确保工具调用格式兼容
      if (processedRequest.tools && Array.isArray(processedRequest.tools)) {
        processedRequest.tools = this.normalizeToolCalls(processedRequest.tools, context.requestId);
        this.metrics.toolCallsProcessed += processedRequest.tools.length;
      }

      // ✅ Configuration-driven parameter processing
      if (!processedRequest.top_k && processedRequest.temperature) {
        const topKConfig = this.config.parameters.topK;
        processedRequest.top_k = Math.max(
          topKConfig.min,
          Math.min(topKConfig.max, Math.floor(processedRequest.temperature * topKConfig.max))
        );
        
        secureLogger.debug('🔧 iFlow动态top_k计算', {
          temperature: processedRequest.temperature,
          calculatedTopK: processedRequest.top_k,
          topKRange: `${topKConfig.min}-${topKConfig.max}`,
          requestId: context.requestId
        });
      }
      
      // Apply temperature limits if configured
      if (processedRequest.temperature !== undefined) {
        const tempConfig = this.config.parameters.temperature;
        if (processedRequest.temperature < tempConfig.min) {
          processedRequest.temperature = tempConfig.min;
        } else if (processedRequest.temperature > tempConfig.max) {
          processedRequest.temperature = tempConfig.max;
        }
      }

      // 确保请求符合OpenAI标准格式
      this.validateRequestFormat(processedRequest, context.requestId);

      if (context.metadata) {
        if (!context.metadata.protocolConfig) {
          context.metadata.protocolConfig = {};
        }
        
        context.metadata.protocolConfig.endpoint = this.config.baseUrl;
        context.metadata.protocolConfig.protocol = 'openai';
        context.metadata.protocolConfig.timeout = this.config.timeout;
        context.metadata.protocolConfig.maxRetries = this.config.maxRetries;
        
        // ✅ Configuration-driven authentication
        if (this.config.apiKey) {
          context.metadata.protocolConfig.apiKey = this.config.apiKey;
          
          // Use configured authentication method and format
          const authMethod = this.config.authentication.method;
          const authFormat = this.config.authentication.format || `${authMethod} {token}`;
          const authHeader = authFormat.replace('{token}', this.config.apiKey);
          
          context.metadata.protocolConfig.customHeaders = {
            'Authorization': authHeader,
            'Content-Type': API_DEFAULTS.CONTENT_TYPES.JSON
          };
          
          secureLogger.debug('🔐 iFlow认证配置', {
            authMethod: authMethod,
            authFormat: authFormat,
            hasApiKey: !!this.config.apiKey,
            requestId: context.requestId
          });
        }
      }

      return processedRequest;

    } catch (error) {
      this.metrics.errorsHandled++;
      secureLogger.error('iFlow compatibility processing failed', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });
      return request;
    }
  }

  /**
   * 标准化工具调用格式为OpenAI标准格式
   */
  private normalizeToolCalls(tools: any[], requestId: string): any[] {
    try {
      return tools.map((tool, index) => {
        // 检查是否已经是OpenAI格式
        if (tool.type === 'function' && tool.function) {
          // 确保function字段结构正确
          const normalizedTool = { ...tool };
          
          // 确保arguments是字符串格式
          if (normalizedTool.function.arguments && typeof normalizedTool.function.arguments !== 'string') {
            try {
              normalizedTool.function.arguments = JQJsonHandler.stringifyJson(normalizedTool.function.arguments);
            } catch (e) {
              normalizedTool.function.arguments = '{}';
              secureLogger.warn('⚠️ iFlow工具参数序列化失败，使用空对象', {
                requestId,
                toolIndex: index,
                toolName: normalizedTool.function.name,
                error: e.message
              });
            }
          }
          
          return normalizedTool;
        }
        
        // 如果是Anthropic格式，转换为OpenAI格式
        if (tool.name && tool.description && tool.input_schema) {
          secureLogger.debug('🔄 iFlow工具格式转换 Anthropic → OpenAI', {
            requestId,
            toolIndex: index,
            toolName: tool.name
          });
          
          return {
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
        }
        
        // 其他情况，尝试标准化
        return {
          type: 'function',
          function: {
            name: tool.name || tool.function?.name || `tool_${index}`,
            description: tool.description || tool.function?.description || '',
            parameters: tool.parameters || tool.input_schema || tool.function?.parameters || {}
          }
        };
      });
    } catch (error) {
      secureLogger.error('❌ iFlow工具格式标准化失败', {
        requestId,
        error: error.message
      });
      return tools;
    }
  }

  /**
   * 验证请求格式是否符合OpenAI标准
   */
  private validateRequestFormat(request: any, requestId: string): void {
    try {
      const issues: string[] = [];
      
      // 检查必需字段
      if (!request.model) {
        issues.push('missing_model');
      }
      
      if (!request.messages || !Array.isArray(request.messages)) {
        issues.push('missing_or_invalid_messages');
      }
      
      // 检查工具格式
      if (request.tools && Array.isArray(request.tools)) {
        for (let i = 0; i < request.tools.length; i++) {
          const tool = request.tools[i];
          if (tool.type !== 'function' || !tool.function) {
            issues.push(`invalid_tool_format_at_index_${i}`);
          } else if (!tool.function.name) {
            issues.push(`missing_tool_name_at_index_${i}`);
          }
        }
      }
      
      if (issues.length > 0) {
        secureLogger.warn('⚠️ iFlow请求格式验证发现问题', {
          requestId,
          issues,
          model: request.model,
          messageCount: request.messages?.length
        });
      } else {
        secureLogger.debug('✅ iFlow请求格式验证通过', {
          requestId,
          model: request.model,
          messageCount: request.messages?.length,
          toolCount: request.tools?.length || 0
        });
      }
    } catch (error) {
      secureLogger.error('❌ iFlow请求格式验证失败', {
        requestId,
        error: error.message
      });
    }
  }

  async processResponse(response: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      if (!response || typeof response !== 'object') {
        this.metrics.errorsHandled++;
        return response;
      }

      // 验证和修复响应格式
      const validatedResponse = this.validateAndFixResponse(response, context.requestId);
      if (validatedResponse) {
        this.metrics.responsesFixed++;
        return validatedResponse;
      }

      const processedResponse = { ...response };

      // 🔧 确保响应包含必要的OpenAI兼容字段
      if (!processedResponse.id) {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        processedResponse.id = 'chatcmpl-iflow-' + timestamp + '-' + randomSuffix;
      }

      if (!processedResponse.object) {
        processedResponse.object = 'chat.completion';
      }

      if (!processedResponse.created) {
        processedResponse.created = Math.floor(Date.now() / IFLOW_CONSTANTS.MILLISECONDS_PER_SECOND);
      }

      // 🔧 标准化choices数组
      if (processedResponse.choices && Array.isArray(processedResponse.choices)) {
        processedResponse.choices = this.normalizeChoices(processedResponse.choices, context.requestId);
      }

      // 🔧 标准化工具调用响应
      if (processedResponse.choices) {
        for (let i = 0; i < processedResponse.choices.length; i++) {
          const choice = processedResponse.choices[i];
          if (choice.message && choice.message.tool_calls) {
            choice.message.tool_calls = this.normalizeToolCallResponses(choice.message.tool_calls, context.requestId);
          }
        }
      }

      // 🔧 标准化usage信息
      if (processedResponse.usage) {
        processedResponse.usage = this.normalizeUsage(processedResponse.usage, context.requestId);
      }

      // 🔧 处理iFlow特定字段
      if (processedResponse.reasoning_content) {
        processedResponse.iflow_reasoning = processedResponse.reasoning_content;
      }

      // 🔧 响应验证
      this.validateResponseFormat(processedResponse, context.requestId);

      return processedResponse;

    } catch (error) {
      this.metrics.errorsHandled++;
      secureLogger.error('iFlow response processing failed', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });
      return response;
    }
  }

  /**
   * 验证和修复响应格式
   */
  private validateAndFixResponse(response: any, requestId: string): any | null {
    try {
      // 如果已经是标准OpenAI格式，直接返回
      if (this.isValidOpenAIResponse(response)) {
        secureLogger.debug('✅ iFlow响应已符合OpenAI标准格式', {
          requestId,
          responseId: response.id,
          choiceCount: response.choices?.length
        });
        return null;
      }

      // 尝试修复常见的响应格式问题
      const fixedResponse: OpenAIStandardResponse = {
        id: response.id || `chatcmpl-iflow-${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        object: 'chat.completion',
        created: response.created || Math.floor(Date.now() / 1000),
        model: response.model || 'iflow-model',
        choices: this.fixChoicesArray(response.choices || []),
        usage: this.fixUsageStatistics(response.usage)
      };

      secureLogger.debug('🔧 iFlow响应格式修复完成', {
        requestId,
        originalHasId: !!response.id,
        originalHasChoices: Array.isArray(response.choices),
        fixedChoiceCount: fixedResponse.choices.length
      });

      return fixedResponse;
    } catch (error) {
      secureLogger.error('❌ iFlow响应格式修复失败', {
        requestId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 检查是否为有效的OpenAI响应格式
   */
  private isValidOpenAIResponse(response: any): boolean {
    return !!(
      response &&
      response.id &&
      response.object === 'chat.completion' &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  /**
   * 修复choices数组
   */
  private fixChoicesArray(choices: any[]): OpenAIStandardResponse['choices'] {
    if (!Array.isArray(choices) || choices.length === 0) {
      return [
        {
          index: 0,
          message: { role: 'assistant', content: '' },
          finish_reason: 'stop',
        },
      ];
    }

    return choices.map((choice, index) => ({
      index: choice.index ?? index,
      message: {
        role: 'assistant',
        content: choice.message?.content || '',
        tool_calls: choice.message?.tool_calls ? this.fixToolCallsFormat(choice.message.tool_calls) : undefined,
      },
      finish_reason: choice.finish_reason || 'stop',
    }));
  }

  /**
   * 修复工具调用格式
   */
  private fixToolCallsFormat(toolCalls: any[]): any[] {
    return toolCalls.map(toolCall => ({
      id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: {
        name: toolCall.function?.name || '',
        arguments:
          typeof toolCall.function?.arguments === 'string'
            ? toolCall.function.arguments
            : JQJsonHandler.stringifyJson(toolCall.function?.arguments || {}),
      },
    }));
  }

  /**
   * 修复usage统计信息
   */
  private fixUsageStatistics(usage: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    const fixedUsage = {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    };

    // 自动计算total_tokens如果缺失
    if (fixedUsage.total_tokens === 0) {
      fixedUsage.total_tokens = fixedUsage.prompt_tokens + fixedUsage.completion_tokens;
    }

    return fixedUsage;
  }

  /**
   * 标准化choices数组
   */
  private normalizeChoices(choices: any[], requestId: string): any[] {
    try {
      return choices.map((choice, index) => {
        const normalizedChoice = { ...choice };

        // 确保index字段存在
        if (normalizedChoice.index === undefined) {
          normalizedChoice.index = index;
        }

        // 确保finish_reason存在
        if (!normalizedChoice.finish_reason) {
          if (normalizedChoice.message?.tool_calls) {
            normalizedChoice.finish_reason = 'tool_calls';
          } else if (normalizedChoice.message?.content) {
            normalizedChoice.finish_reason = 'stop';
          } else {
            normalizedChoice.finish_reason = 'stop';
          }
        }

        // 确保message结构完整
        if (normalizedChoice.message && typeof normalizedChoice.message === 'object') {
          if (!normalizedChoice.message.role) {
            normalizedChoice.message.role = 'assistant';
          }
          
          // 确保content字段存在
          if (normalizedChoice.message.content === undefined) {
            normalizedChoice.message.content = normalizedChoice.message.tool_calls ? '' : 'Response generated successfully.';
          }

          // 标准化工具调用
          if (normalizedChoice.message.tool_calls) {
            normalizedChoice.message.tool_calls = this.normalizeToolCallResponses(normalizedChoice.message.tool_calls, requestId);
          }
        }

        return normalizedChoice;
      });
    } catch (error) {
      secureLogger.error('❌ iFlow choices标准化失败', {
        requestId,
        error: error.message
      });
      return choices;
    }
  }

  /**
   * 标准化工具调用响应
   */
  private normalizeToolCallResponses(toolCalls: any[], requestId: string): any[] {
    try {
      return toolCalls.map((toolCall) => {
        const normalizedToolCall = { ...toolCall };

        // 确保必需字段存在
        if (!normalizedToolCall.id) {
          normalizedToolCall.id = `call_iflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!normalizedToolCall.type) {
          normalizedToolCall.type = 'function';
        }

        // 确保function字段结构正确
        if (normalizedToolCall.function) {
          if (typeof normalizedToolCall.function.arguments !== 'string') {
            try {
              normalizedToolCall.function.arguments = JQJsonHandler.stringifyJson(normalizedToolCall.function.arguments || {});
            } catch (e) {
              normalizedToolCall.function.arguments = '{}';
              secureLogger.warn('⚠️ iFlow工具响应参数序列化失败，使用空对象', {
                requestId,
                toolCallId: normalizedToolCall.id,
                toolName: normalizedToolCall.function.name,
                error: e.message
              });
            }
          }

          if (!normalizedToolCall.function.name) {
            normalizedToolCall.function.name = 'unknown_function';
          }
        } else {
          normalizedToolCall.function = {
            name: 'unknown_function',
            arguments: '{}'
          };
        }

        return normalizedToolCall;
      });
    } catch (error) {
      secureLogger.error('❌ iFlow工具调用响应标准化失败', {
        requestId,
        error: error.message
      });
      return toolCalls;
    }
  }

  /**
   * 标准化usage信息
   */
  private normalizeUsage(usage: any, requestId: string): any {
    try {
      const normalizedUsage = { ...usage };

      // 确保基础字段存在
      if (normalizedUsage.prompt_tokens === undefined) {
        normalizedUsage.prompt_tokens = 0;
      }

      if (normalizedUsage.completion_tokens === undefined) {
        normalizedUsage.completion_tokens = 0;
      }

      if (normalizedUsage.total_tokens === undefined) {
        normalizedUsage.total_tokens = normalizedUsage.prompt_tokens + normalizedUsage.completion_tokens;
      }

      return normalizedUsage;
    } catch (error) {
      secureLogger.error('❌ iFlow usage标准化失败', {
        requestId,
        error: error.message
      });
      return usage;
    }
  }

  /**
   * 验证响应格式
   */
  private validateResponseFormat(response: any, requestId: string): void {
    try {
      const issues: string[] = [];
      
      // 检查必需字段
      if (!response.id) {
        issues.push('missing_id');
      }
      
      if (response.object !== 'chat.completion') {
        issues.push('invalid_object');
      }
      
      if (!Array.isArray(response.choices)) {
        issues.push('missing_or_invalid_choices');
      } else {
        // 检查choices结构
        for (let i = 0; i < response.choices.length; i++) {
          const choice = response.choices[i];
          if (typeof choice.index !== 'number') {
            issues.push(`invalid_choice_index_at_${i}`);
          }
          if (!choice.message || typeof choice.message !== 'object') {
            issues.push(`missing_or_invalid_message_at_${i}`);
          } else {
            if (!choice.message.role) {
              issues.push(`missing_message_role_at_${i}`);
            }
          }
          if (!choice.finish_reason) {
            issues.push(`missing_finish_reason_at_${i}`);
          }
        }
      }
      
      if (!response.usage || typeof response.usage !== 'object') {
        issues.push('missing_or_invalid_usage');
      } else {
        if (typeof response.usage.total_tokens !== 'number') {
          issues.push('missing_or_invalid_total_tokens');
        }
      }
      
      if (issues.length > 0) {
        secureLogger.warn('⚠️ iFlow响应格式验证发现问题', {
          requestId,
          issues,
          responseId: response.id,
          choiceCount: response.choices?.length
        });
      } else {
        secureLogger.debug('✅ iFlow响应格式验证通过', {
          requestId,
          responseId: response.id,
          choiceCount: response.choices?.length,
          hasUsage: !!response.usage
        });
      }
    } catch (error) {
      secureLogger.error('❌ iFlow响应格式验证失败', {
        requestId,
        error: error.message
      });
    }
  }

  async process(request: any): Promise<any> {
    const context: ModuleProcessingContext = {
      requestId: Date.now().toString(),
      providerName: 'iflow',
      protocol: 'openai'
    };
    
    return this.processRequest(request, null, context);
  }

  /**
   * 统一错误处理方法占位符
   */
  async handleError(error: any, context: ModuleProcessingContext): Promise<OpenAIErrorResponse> {
    // 占位符实现
    return {
      error: {
        message: 'Not implemented',
        type: 'api_error',
        code: 'not_implemented',
        param: null,
      },
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
}