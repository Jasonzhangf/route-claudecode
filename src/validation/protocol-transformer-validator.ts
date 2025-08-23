/**
 * Protocol-Transformer 双向格式验证器
 * 
 * 确保Transformer和Protocol模块之间数据格式的严格验证：
 * - Transformer → Protocol: 验证OpenAI格式（请求+工具调用）
 * - Protocol → Transformer: 验证Anthropic格式（响应+工具调用+finish_reason）
 * 
 * @author Jason Zhang
 * @version 1.0.0
 */

import { secureLogger } from '../utils/secure-logger';

/**
 * OpenAI请求格式接口（严格定义）
 */
export interface ValidOpenAIRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | {
    type: 'function';
    function: { name: string };
  };
}

/**
 * Anthropic响应格式接口（严格定义）
 */
export interface ValidAnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, any>;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  format: 'openai-request' | 'anthropic-response' | 'unknown';
  errors: string[];
  warnings: string[];
  summary: {
    hasRequiredFields: boolean;
    hasValidStructure: boolean;
    hasValidToolCalls: boolean;
    fieldCount: number;
  };
}

/**
 * Protocol-Transformer双向格式验证器
 */
export class ProtocolTransformerValidator {
  private readonly validatorId = 'protocol-transformer-validator';

  /**
   * 验证Transformer → Protocol的数据（必须是OpenAI格式）
   */
  public validateTransformerToProtocol(data: unknown, context: { requestId: string; step: string }): ValidationResult {
    secureLogger.info('🔍 [格式验证] Transformer → Protocol 验证开始', {
      requestId: context.requestId,
      step: context.step,
      dataType: typeof data,
      validatorId: this.validatorId
    });

    const result = this.validateOpenAIRequest(data, context);
    
    if (!result.isValid) {
      secureLogger.error('❌ [格式验证] Transformer → Protocol 验证失败', {
        requestId: context.requestId,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary
      });
    } else {
      secureLogger.info('✅ [格式验证] Transformer → Protocol 验证通过', {
        requestId: context.requestId,
        format: result.format,
        summary: result.summary
      });
    }

    return result;
  }

  /**
   * 验证Protocol → Transformer的数据（必须是Anthropic格式）
   */
  public validateProtocolToTransformer(data: unknown, context: { requestId: string; step: string }): ValidationResult {
    secureLogger.info('🔍 [格式验证] Protocol → Transformer 验证开始', {
      requestId: context.requestId,
      step: context.step,
      dataType: typeof data,
      validatorId: this.validatorId
    });

    const result = this.validateAnthropicResponse(data, context);
    
    if (!result.isValid) {
      secureLogger.error('❌ [格式验证] Protocol → Transformer 验证失败', {
        requestId: context.requestId,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary
      });
    } else {
      secureLogger.info('✅ [格式验证] Protocol → Transformer 验证通过', {
        requestId: context.requestId,
        format: result.format,
        summary: result.summary
      });
    }

    return result;
  }

  /**
   * 验证OpenAI请求格式
   */
  private validateOpenAIRequest(data: unknown, context: { requestId: string }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let hasRequiredFields = true;
    let hasValidStructure = true;
    let hasValidToolCalls = true;

    try {
      // 基本类型检查
      if (!data || typeof data !== 'object') {
        errors.push('数据必须是对象类型');
        return this.createValidationResult(false, 'unknown', errors, warnings, {
          hasRequiredFields: false,
          hasValidStructure: false,
          hasValidToolCalls: false,
          fieldCount: 0
        });
      }

      const request = data as any;
      const fieldCount = Object.keys(request).length;

      // 检查必需字段
      if (!request.model || typeof request.model !== 'string') {
        errors.push('缺少必需字段：model (string)');
        hasRequiredFields = false;
      }

      if (!request.messages || !Array.isArray(request.messages)) {
        errors.push('缺少必需字段：messages (array)');
        hasRequiredFields = false;
        hasValidStructure = false;
      } else {
        // 验证消息结构
        for (const [index, message] of request.messages.entries()) {
          if (!message || typeof message !== 'object') {
            errors.push(`消息 ${index}: 必须是对象`);
            hasValidStructure = false;
            continue;
          }

          if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
            errors.push(`消息 ${index}: role 必须是 system/user/assistant/tool`);
            hasValidStructure = false;
          }

          // 验证工具调用
          if (message.tool_calls && Array.isArray(message.tool_calls)) {
            for (const [toolIndex, toolCall] of message.tool_calls.entries()) {
              if (!this.validateOpenAIToolCall(toolCall)) {
                errors.push(`消息 ${index}, 工具调用 ${toolIndex}: 格式无效`);
                hasValidToolCalls = false;
              }
            }
          }

          // 验证tool消息的特殊字段
          if (message.role === 'tool') {
            if (!message.tool_call_id || typeof message.tool_call_id !== 'string') {
              errors.push(`消息 ${index}: tool消息必须有 tool_call_id`);
              hasValidStructure = false;
            }
          }
        }
      }

      // 验证工具定义
      if (request.tools && Array.isArray(request.tools)) {
        for (const [index, tool] of request.tools.entries()) {
          if (!this.validateOpenAIToolDefinition(tool)) {
            errors.push(`工具定义 ${index}: 格式无效`);
            hasValidToolCalls = false;
          }
        }
      }

      // 检查可选字段的类型
      if (request.max_tokens !== undefined && typeof request.max_tokens !== 'number') {
        warnings.push('max_tokens 应该是数字类型');
      }

      if (request.temperature !== undefined && typeof request.temperature !== 'number') {
        warnings.push('temperature 应该是数字类型');
      }

      if (request.stream !== undefined && typeof request.stream !== 'boolean') {
        warnings.push('stream 应该是布尔类型');
      }

      // 🔒 CRITICAL: Protocol层必须严格遵循OpenAI API标准
      // 根据CLAUDE.md架构规范，Protocol层之后禁止任何非OpenAI标准字段
      
      // 检查是否存在非OpenAI标准的字段
      const openaiStandardFields = new Set([
        'model', 'messages', 'temperature', 'max_tokens', 'top_p', 'top_k',
        'frequency_penalty', 'presence_penalty', 'stop', 'stream', 'tools', 
        'tool_choice', 'functions', 'function_call', 'response_format',
        'seed', 'logit_bias', 'user', 'n'
      ]);

      const requestFields = Object.keys(request);
      for (const field of requestFields) {
        if (!openaiStandardFields.has(field)) {
          errors.push(`Protocol层检测到非OpenAI标准字段: ${field}。严禁任何自定义字段，包括__internal等`);
          hasValidStructure = false;
        }
      }

      // 特别检查__internal字段（最严重的违规）
      if ('__internal' in request) {
        errors.push('严重违规：Protocol层包含__internal字段，严重违反OpenAI API标准！');
        hasValidStructure = false;
      }

      // 检查Anthropic特征字段
      const anthropicFields = ['system', 'max_tokens_to_sample', 'anthropic_version', 'input_schema'];
      for (const field of anthropicFields) {
        if (field in request && field !== 'max_tokens') { // max_tokens在OpenAI中是合法的
          errors.push(`检测到Anthropic特征字段: ${field}，Protocol层必须是纯OpenAI格式`);
          hasValidStructure = false;
        }
      }

      const isValid = errors.length === 0;
      
      secureLogger.debug('🔍 [OpenAI请求验证] 详细结果', {
        requestId: context.requestId,
        isValid,
        fieldCount,
        hasMessages: !!request.messages,
        messageCount: Array.isArray(request.messages) ? request.messages.length : 0,
        hasTools: !!request.tools,
        toolCount: Array.isArray(request.tools) ? request.tools.length : 0,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return this.createValidationResult(isValid, 'openai-request', errors, warnings, {
        hasRequiredFields,
        hasValidStructure,
        hasValidToolCalls,
        fieldCount
      });

    } catch (error) {
      errors.push(`验证过程异常: ${error.message}`);
      secureLogger.error('🚨 [OpenAI请求验证] 验证异常', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      return this.createValidationResult(false, 'unknown', errors, warnings, {
        hasRequiredFields: false,
        hasValidStructure: false,
        hasValidToolCalls: false,
        fieldCount: 0
      });
    }
  }

  /**
   * 验证Anthropic响应格式
   */
  private validateAnthropicResponse(data: unknown, context: { requestId: string }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let hasRequiredFields = true;
    let hasValidStructure = true;
    let hasValidToolCalls = true;

    try {
      // 基本类型检查
      if (!data || typeof data !== 'object') {
        errors.push('数据必须是对象类型');
        return this.createValidationResult(false, 'unknown', errors, warnings, {
          hasRequiredFields: false,
          hasValidStructure: false,
          hasValidToolCalls: false,
          fieldCount: 0
        });
      }

      const response = data as any;
      const fieldCount = Object.keys(response).length;

      // 检查必需字段
      if (!response.id || typeof response.id !== 'string') {
        errors.push('缺少必需字段：id (string)');
        hasRequiredFields = false;
      }

      if (response.type !== 'message') {
        errors.push('type 字段必须是 "message"');
        hasRequiredFields = false;
      }

      if (response.role !== 'assistant') {
        errors.push('role 字段必须是 "assistant"');
        hasRequiredFields = false;
      }

      if (!response.model || typeof response.model !== 'string') {
        errors.push('缺少必需字段：model (string)');
        hasRequiredFields = false;
      }

      // 验证stop_reason
      const validStopReasons = ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use'];
      if (!response.stop_reason || !validStopReasons.includes(response.stop_reason)) {
        errors.push(`stop_reason 必须是以下之一: ${validStopReasons.join(', ')}`);
        hasRequiredFields = false;
      }

      // 验证content数组
      if (!response.content || !Array.isArray(response.content)) {
        errors.push('缺少必需字段：content (array)');
        hasRequiredFields = false;
        hasValidStructure = false;
      } else {
        for (const [index, contentItem] of response.content.entries()) {
          if (!contentItem || typeof contentItem !== 'object') {
            errors.push(`内容项 ${index}: 必须是对象`);
            hasValidStructure = false;
            continue;
          }

          if (!contentItem.type || !['text', 'tool_use'].includes(contentItem.type)) {
            errors.push(`内容项 ${index}: type 必须是 text 或 tool_use`);
            hasValidStructure = false;
          }

          // 验证工具使用
          if (contentItem.type === 'tool_use') {
            if (!this.validateAnthropicToolUse(contentItem)) {
              errors.push(`内容项 ${index}: tool_use 格式无效`);
              hasValidToolCalls = false;
            }
          }

          // 验证文本内容
          if (contentItem.type === 'text') {
            if (!contentItem.text || typeof contentItem.text !== 'string') {
              warnings.push(`内容项 ${index}: text类型应该有 text 字段`);
            }
          }
        }
      }

      // 验证usage字段
      if (!response.usage || typeof response.usage !== 'object') {
        errors.push('缺少必需字段：usage (object)');
        hasRequiredFields = false;
      } else {
        if (typeof response.usage.input_tokens !== 'number') {
          errors.push('usage.input_tokens 必须是数字');
          hasValidStructure = false;
        }
        if (typeof response.usage.output_tokens !== 'number') {
          errors.push('usage.output_tokens 必须是数字');
          hasValidStructure = false;
        }
      }

      const isValid = errors.length === 0;
      
      secureLogger.debug('🔍 [Anthropic响应验证] 详细结果', {
        requestId: context.requestId,
        isValid,
        fieldCount,
        hasContent: !!response.content,
        contentCount: Array.isArray(response.content) ? response.content.length : 0,
        stopReason: response.stop_reason,
        hasUsage: !!response.usage,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return this.createValidationResult(isValid, 'anthropic-response', errors, warnings, {
        hasRequiredFields,
        hasValidStructure,
        hasValidToolCalls,
        fieldCount
      });

    } catch (error) {
      errors.push(`验证过程异常: ${error.message}`);
      secureLogger.error('🚨 [Anthropic响应验证] 验证异常', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      return this.createValidationResult(false, 'unknown', errors, warnings, {
        hasRequiredFields: false,
        hasValidStructure: false,
        hasValidToolCalls: false,
        fieldCount: 0
      });
    }
  }

  /**
   * 验证OpenAI工具调用格式
   */
  private validateOpenAIToolCall(toolCall: any): boolean {
    return !!(
      toolCall &&
      typeof toolCall === 'object' &&
      typeof toolCall.id === 'string' &&
      toolCall.type === 'function' &&
      toolCall.function &&
      typeof toolCall.function === 'object' &&
      typeof toolCall.function.name === 'string' &&
      typeof toolCall.function.arguments === 'string'
    );
  }

  /**
   * 验证OpenAI工具定义格式
   */
  private validateOpenAIToolDefinition(tool: any): boolean {
    return !!(
      tool &&
      typeof tool === 'object' &&
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function === 'object' &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.description === 'string' &&
      tool.function.parameters &&
      typeof tool.function.parameters === 'object'
    );
  }

  /**
   * 验证Anthropic工具使用格式
   */
  private validateAnthropicToolUse(toolUse: any): boolean {
    return !!(
      toolUse &&
      typeof toolUse === 'object' &&
      toolUse.type === 'tool_use' &&
      typeof toolUse.id === 'string' &&
      typeof toolUse.name === 'string' &&
      toolUse.input &&
      typeof toolUse.input === 'object'
    );
  }

  /**
   * 创建验证结果对象
   */
  private createValidationResult(
    isValid: boolean,
    format: ValidationResult['format'],
    errors: string[],
    warnings: string[],
    summary: ValidationResult['summary']
  ): ValidationResult {
    return {
      isValid,
      format,
      errors: [...errors],
      warnings: [...warnings],
      summary: { ...summary }
    };
  }

  /**
   * 获取验证器信息
   */
  public getValidatorInfo(): { id: string; version: string; supportedFormats: string[] } {
    return {
      id: this.validatorId,
      version: '1.0.0',
      supportedFormats: ['openai-request', 'anthropic-response']
    };
  }
}

/**
 * 默认验证器实例
 */
export const protocolTransformerValidator = new ProtocolTransformerValidator();