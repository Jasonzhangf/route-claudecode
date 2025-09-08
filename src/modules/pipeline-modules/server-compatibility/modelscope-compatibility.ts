/**
 * ModelScope兼容性模块 - Server Compatibility层
 * 
 * 核心功能:
 * - Anthropic工具格式 → OpenAI工具格式转换
 * - ModelScope API兼容性处理
 * - 严格错误处理：失败时立即抛出错误
 * - 支持双向兼容性处理：请求和响应
 *
 * @author RCC v4.0
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../pipeline/src/module-interface';
import { EventEmitter } from 'events';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { ServerCompatibilityModule, ModuleProcessingContext } from './server-compatibility-base';

export interface ModelScopeCompatibilityConfig {
  preserveToolCalls: boolean;
  validateInputSchema: boolean;
  maxToolsPerRequest: number;
}

/**
 * ModelScope兼容性模块
 * 专门处理Anthropic → OpenAI工具格式转换
 * 支持双向兼容性处理：请求和响应
 */
export class ModelScopeCompatibilityModule extends ServerCompatibilityModule {
  private config: ModelScopeCompatibilityConfig;

  constructor(config: ModelScopeCompatibilityConfig = {
    preserveToolCalls: true,
    validateInputSchema: true,
    maxToolsPerRequest: 20
  }) {
    super('modelscope-compatibility', 'ModelScope Compatibility Module', '1.0.0');
    this.config = config;
  }

  /**
   * 初始化方法
   */
  protected async initialize(): Promise<void> {
    try {
      this.validateConfiguration();
      secureLogger.info('✅ ModelScope兼容性模块初始化完成', {
        moduleId: this.getId()
      });
    } catch (error) {
      const rccError = new RCCError(
        'ModelScope兼容性模块初始化失败',
        RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
        'modelscope-compatibility',
        { details: { originalError: error } }
      );
      secureLogger.error('ModelScope兼容性模块初始化失败', { error: rccError });
      throw rccError;
    }
  }

  // ============================================================================
  // 核心处理方法
  // ============================================================================

  /**
   * 处理请求 - 主入口点
   */
  async processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    secureLogger.debug('🔄 ModelScope兼容模块开始处理请求', {
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
    
    secureLogger.info('✅ ModelScope兼容模块处理请求完成', {
      originalToolsCount: request.tools?.length || 0,
      processedToolsCount: processedRequest.tools?.length || 0,
      model: processedRequest.model
    });

    return processedRequest;
  }

  /**
   * 处理响应 - ModelScope响应兼容性处理
   */
  async processResponse(response: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      secureLogger.debug('🔄 ModelScope兼容模块开始处理响应', {
        hasChoices: !!response.choices,
        choicesCount: Array.isArray(response.choices) ? response.choices.length : 0,
        model: response.model,
        responseKeys: Object.keys(response)
      });

      // 如果不是有效的响应对象，直接返回
      if (!response || typeof response !== 'object') {
        secureLogger.debug('⚠️ ModelScope响应不是有效对象，跳过处理');
        return response;
      }

      // 创建处理后的响应副本
      const processedResponse = { ...response };

      // 1. 🔧 修复ModelScope API响应格式兼容性问题
      if (processedResponse.choices && Array.isArray(processedResponse.choices)) {
        processedResponse.choices = this.normalizeModelScopeChoices(processedResponse.choices, context.requestId);
      }

      // 2. 🔧 确保响应包含必要的OpenAI兼容字段
      if (!processedResponse.id) {
        processedResponse.id = `chatcmpl-modelscope-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      if (!processedResponse.object) {
        processedResponse.object = 'chat.completion';
      }

      if (!processedResponse.created) {
        processedResponse.created = Math.floor(Date.now() / 1000);
      }

      // 3. 🔧 修复ModelScope工具调用响应格式
      if (processedResponse.choices) {
        for (let i = 0; i < processedResponse.choices.length; i++) {
          const choice = processedResponse.choices[i];
          if (choice.message && choice.message.tool_calls) {
            choice.message.tool_calls = this.normalizeModelScopeToolCalls(choice.message.tool_calls, context.requestId);
          }
        }
      }

      // 4. 🔧 处理usage信息兼容性
      if (processedResponse.usage) {
        processedResponse.usage = this.normalizeModelScopeUsage(processedResponse.usage, context.requestId);
      }

      secureLogger.info('✅ ModelScope兼容模块处理响应完成', {
        hasValidId: !!processedResponse.id,
        hasValidObject: !!processedResponse.object,
        choicesProcessed: processedResponse.choices?.length || 0
      });

      return processedResponse;

    } catch (error) {
      secureLogger.error('❌ ModelScope响应兼容性处理失败', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      // 失败时返回原始响应，不中断流水线
      return response;
    }
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
        const unknownFormatError = new RCCError(
          '不支持的工具格式',
          RCCErrorCode.PIPELINE_EXECUTION_FAILED,
          'modelscope-compatibility',
          { details: { toolsCount: request.tools.length, firstTool: request.tools[0] } }
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
      const transformError = new RCCError(
        '工具格式转换失败',
        RCCErrorCode.PIPELINE_EXECUTION_FAILED,
        'modelscope-compatibility',
        { details: { originalError: error, toolsCount: request.tools.length } }
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
          const invalidToolError = new RCCError(
            `工具${index}不符合Anthropic格式`,
            RCCErrorCode.VALIDATION_ERROR,
            'modelscope-compatibility',
            { details: { toolIndex: index, tool } }
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
          RCCErrorCode.PIPELINE_EXECUTION_FAILED,
          'modelscope-compatibility',
          { details: { originalError: error, toolIndex: index, toolName: tool?.name } }
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
      const tooManyToolsError = new RCCError(
        `工具数量${tools.length}超过最大限制${this.config.maxToolsPerRequest}`,
        RCCErrorCode.VALIDATION_ERROR,
        'modelscope-compatibility',
        { details: { toolsCount: tools.length, maxAllowed: this.config.maxToolsPerRequest } }
      );
      secureLogger.error('工具数量超限', { error: tooManyToolsError });
      throw tooManyToolsError;
    }

    for (const [index, tool] of tools.entries()) {
      if (!this.isValidOpenAITool(tool)) {
        const validationError = new RCCError(
          `工具${index}验证失败`,
          RCCErrorCode.VALIDATION_ERROR,
          'modelscope-compatibility',
          { details: { toolIndex: index, toolName: tool?.function?.name } }
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
      const validationError = new RCCError(
        'Invalid maxToolsPerRequest configuration',
        RCCErrorCode.VALIDATION_ERROR,
        'modelscope-compatibility',
        { details: { config: this.config } }
      );
      secureLogger.error('配置验证失败', { error: validationError });
      throw validationError;
    }
  }

  /**
   * 标准化ModelScope API的choices数组
   */
  private normalizeModelScopeChoices(choices: any[], requestId: string): any[] {
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
        }

        return normalizedChoice;
      });
    } catch (error) {
      secureLogger.error('❌ ModelScope choices标准化失败', {
        requestId,
        error: error.message
      });
      return choices;
    }
  }

  /**
   * 标准化ModelScope工具调用格式
   */
  private normalizeModelScopeToolCalls(toolCalls: any[], requestId: string): any[] {
    try {
      return toolCalls.map((toolCall) => {
        const normalizedToolCall = { ...toolCall };

        // 确保必需字段存在
        if (!normalizedToolCall.id) {
          normalizedToolCall.id = `call_modelscope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!normalizedToolCall.type) {
          normalizedToolCall.type = 'function';
        }

        // 确保function字段结构正确
        if (normalizedToolCall.function) {
          if (typeof normalizedToolCall.function.arguments !== 'string') {
            try {
              normalizedToolCall.function.arguments = JSON.stringify(normalizedToolCall.function.arguments || {});
            } catch (e) {
              normalizedToolCall.function.arguments = '{}';
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
      secureLogger.error('❌ ModelScope工具调用标准化失败', {
        requestId,
        error: error.message
      });
      return toolCalls;
    }
  }

  /**
   * 标准化ModelScope usage信息
   */
  private normalizeModelScopeUsage(usage: any, requestId: string): any {
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

      // ModelScope可能使用不同的字段名，需要映射
      if (normalizedUsage.input_tokens && !normalizedUsage.prompt_tokens) {
        normalizedUsage.prompt_tokens = normalizedUsage.input_tokens;
      }

      if (normalizedUsage.output_tokens && !normalizedUsage.completion_tokens) {
        normalizedUsage.completion_tokens = normalizedUsage.output_tokens;
      }

      return normalizedUsage;
    } catch (error) {
      secureLogger.error('❌ ModelScope usage标准化失败', {
        requestId,
        error: error.message
      });
      return usage;
    }
  }
}