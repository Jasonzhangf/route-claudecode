/**
 * 客户端输入验证器
 *
 * 提供严格的输入验证，在输入阶段就发现和处理错误
 * 支持详细的错误定位和调试信息
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

import { DataValidator, ValidationResult } from '../../utils/data-validator';
import { ErrorHandler } from '../../middleware/error-handler';
import { DebugManager } from '../../debug/debug-manager';
import {
  ClaudeCodeRequest,
  ClientInputValidationError,
  CLAUDE_CODE_REQUEST_SCHEMA,
  CLIENT_CONFIG_SCHEMA,
} from '../schemas/claude-code-schemas';

/**
 * 输入验证错误类
 */
export class InputValidationError extends Error {
  public readonly module = 'client.input.validation';
  public readonly code: string;
  public readonly field: string;
  public readonly path: string;
  public readonly expected: string;
  public readonly actual: string;
  public readonly value: any;
  public readonly details: ClientInputValidationError;
  public readonly timestamp: number;

  constructor(
    field: string,
    path: string,
    expected: string,
    actual: string,
    value: any,
    message: string,
    code: string = 'INPUT_VALIDATION_FAILED'
  ) {
    super(message);
    this.name = 'InputValidationError';
    this.code = code;
    this.field = field;
    this.path = path;
    this.expected = expected;
    this.actual = actual;
    this.value = value;
    this.timestamp = Date.now();

    this.details = {
      module: this.module,
      field,
      expected,
      actual,
      value,
      path,
      message,
      code,
      timestamp: this.timestamp,
    };

    Error.captureStackTrace(this, InputValidationError);
  }

  /**
   * 获取详细的错误信息用于调试
   */
  getDetailedErrorInfo(): string {
    return [
      `🚫 Input Validation Failed at ${this.module}`,
      `📍 Field: ${this.field}`,
      `🛤️  Path: ${this.path}`,
      `✅ Expected: ${this.expected}`,
      `❌ Actual: ${this.actual}`,
      `💾 Value: ${JSON.stringify(this.value, null, 2)}`,
      `📝 Message: ${this.message}`,
      `🏷️  Code: ${this.code}`,
      `⏰ Timestamp: ${new Date(this.timestamp).toISOString()}`,
    ].join('\n');
  }

  /**
   * 获取用户友好的错误信息
   */
  getUserFriendlyMessage(): string {
    return `输入验证失败: 字段 '${this.field}' ${this.message}`;
  }
}

/**
 * 客户端输入验证器
 */
export class ClientInputValidator {
  private errorHandler: ErrorHandler;
  private debugManager: DebugManager;
  private validationStats: Map<string, number> = new Map();

  constructor(errorHandler: ErrorHandler, debugManager: DebugManager) {
    this.errorHandler = errorHandler;
    this.debugManager = debugManager;
  }

  /**
   * 验证Claude Code请求
   */
  validateClaudeCodeRequest(request: any, requestId: string): ClaudeCodeRequest {
    const startTime = Date.now();

    try {
      // 记录验证开始
      this.debugManager.recordInput('client.input.validation', requestId, {
        type: 'validation_start',
        timestamp: new Date().toISOString(),
        data: { request },
      });

      // 执行严格验证
      const validationResult = DataValidator.validate(request, CLAUDE_CODE_REQUEST_SCHEMA);

      if (!validationResult.isValid) {
        // 处理验证失败
        this.handleValidationFailure(validationResult, request, requestId);
      }

      // 额外的业务逻辑验证
      this.validateBusinessLogic(request, requestId);

      // 验证成功，记录统计
      this.recordValidationSuccess('claude_code_request');

      const processingTime = Date.now() - startTime;

      this.debugManager.recordOutput('client.input.validation', requestId, {
        type: 'validation_success',
        timestamp: new Date().toISOString(),
        processingTime,
        data: { sanitizedRequest: validationResult.sanitizedData },
      });

      return validationResult.sanitizedData as ClaudeCodeRequest;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 记录验证失败
      this.debugManager.recordError('client.input.validation', requestId, error as any);

      // 抛出错误
      throw error;
    }
  }

  /**
   * 验证客户端配置
   */
  validateClientConfig(config: any): any {
    const validationResult = DataValidator.validate(config, CLIENT_CONFIG_SCHEMA);

    if (!validationResult.isValid) {
      this.handleValidationFailure(validationResult, config, 'config_validation');
    }

    this.recordValidationSuccess('client_config');
    return validationResult.sanitizedData;
  }

  /**
   * 处理验证失败
   */
  private handleValidationFailure(validationResult: ValidationResult, originalData: any, requestId: string): never {
    const firstError = validationResult.errors[0];
    const errorParts = this.parseValidationError(firstError);

    // 创建详细的验证错误
    const validationError = new InputValidationError(
      errorParts.field,
      errorParts.path,
      errorParts.expected,
      errorParts.actual,
      errorParts.value,
      errorParts.message,
      'FIELD_VALIDATION_FAILED'
    );

    // 记录验证失败统计
    this.recordValidationFailure(errorParts.field);

    // 使用错误处理器处理
    this.errorHandler.handleError(validationError, {
      module: 'client.input.validation',
      operation: 'validate_input',
      requestId,
      timestamp: new Date(),
      additionalData: {
        originalData,
        allErrors: validationResult.errors,
        validationStats: Object.fromEntries(this.validationStats),
      },
    });

    // 抛出错误
    throw validationError;
  }

  /**
   * 解析验证错误信息
   */
  private parseValidationError(errorMessage: string): {
    field: string;
    path: string;
    expected: string;
    actual: string;
    value: any;
    message: string;
  } {
    // 解析错误信息格式: "字段 'field.path' 类型不匹配，期望: string, 实际: number"
    const fieldMatch = errorMessage.match(/字段 '([^']+)'/);
    const typeMatch = errorMessage.match(/期望: ([^,]+), 实际: ([^,]+)/);
    const lengthMatch = errorMessage.match(/长度不能(小于|大于) (\d+)/);
    const enumMatch = errorMessage.match(/必须是枚举值之一: (.+)/);

    const field = fieldMatch ? fieldMatch[1] : 'unknown';
    const path = field;

    let expected = 'valid value';
    let actual = 'invalid value';

    if (typeMatch) {
      expected = typeMatch[1];
      actual = typeMatch[2];
    } else if (lengthMatch) {
      expected = `length ${lengthMatch[1]} ${lengthMatch[2]}`;
      actual = 'invalid length';
    } else if (enumMatch) {
      expected = `one of: ${enumMatch[1]}`;
      actual = 'invalid enum value';
    }

    return {
      field,
      path,
      expected,
      actual,
      value: 'see originalData',
      message: errorMessage,
    };
  }

  /**
   * 业务逻辑验证
   */
  private validateBusinessLogic(request: any, requestId: string): void {
    // 验证model和max_tokens的组合
    if (request.model === 'claude-3-haiku-20240307' && request.max_tokens > 4096) {
      throw new InputValidationError(
        'max_tokens',
        'max_tokens',
        '≤ 4096 for claude-3-haiku',
        `${request.max_tokens}`,
        request.max_tokens,
        'claude-3-haiku model only supports max_tokens up to 4096',
        'MODEL_TOKEN_LIMIT_EXCEEDED'
      );
    }

    // 验证工具定义的一致性
    if (request.tools && request.tool_choice?.type === 'tool') {
      const toolName = request.tool_choice.name;
      const toolExists = request.tools.some((tool: any) => tool.name === toolName);

      if (!toolExists) {
        throw new InputValidationError(
          'tool_choice.name',
          'tool_choice.name',
          'existing tool name',
          toolName,
          toolName,
          `tool '${toolName}' specified in tool_choice but not defined in tools array`,
          'TOOL_NOT_FOUND'
        );
      }
    }

    // 验证消息序列的合理性
    if (request.messages && Array.isArray(request.messages)) {
      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];

        // 检查连续的同角色消息
        if (i > 0 && request.messages[i - 1].role === message.role) {
          throw new InputValidationError(
            `messages[${i}].role`,
            `messages[${i}].role`,
            'alternating roles',
            `consecutive ${message.role}`,
            message.role,
            `consecutive messages with role '${message.role}' are not allowed`,
            'INVALID_MESSAGE_SEQUENCE'
          );
        }
      }
    }
  }

  /**
   * 记录验证成功统计
   */
  private recordValidationSuccess(type: string): void {
    const key = `${type}_success`;
    this.validationStats.set(key, (this.validationStats.get(key) || 0) + 1);
  }

  /**
   * 记录验证失败统计
   */
  private recordValidationFailure(field: string): void {
    const key = `${field}_failure`;
    this.validationStats.set(key, (this.validationStats.get(key) || 0) + 1);
  }

  /**
   * 获取验证统计信息
   */
  getValidationStats(): Record<string, number> {
    return Object.fromEntries(this.validationStats);
  }

  /**
   * 重置验证统计
   */
  resetValidationStats(): void {
    this.validationStats.clear();
  }
}

/**
 * 输入验证装饰器
 *
 * 使用方法:
 * @ValidateInput('claude_code_request')
 * async processRequest(request: any): Promise<any>
 */
export function ValidateInput(validationType: 'claude_code_request' | 'client_config') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const validator = this.inputValidator as ClientInputValidator;

      if (!validator) {
        throw new Error('ClientInputValidator not initialized. Ensure inputValidator is injected.');
      }

      // 获取请求ID (假设在第二个参数或从上下文生成)
      const requestId = args[1] || `${propertyKey}_${Date.now()}`;

      // 根据验证类型选择验证方法
      let validatedInput;
      if (validationType === 'claude_code_request') {
        validatedInput = validator.validateClaudeCodeRequest(args[0], requestId);
      } else if (validationType === 'client_config') {
        validatedInput = validator.validateClientConfig(args[0]);
      } else {
        throw new Error(`Unknown validation type: ${validationType}`);
      }

      // 用验证后的数据替换原始输入
      args[0] = validatedInput;

      // 调用原始方法
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
