/**
 * 客户端输出验证器
 *
 * 确保所有输出数据符合Claude Code标准格式
 * 防止向客户端返回不完整或格式错误的数据
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

import { DataValidator, ValidationResult } from '../../utils/data-validator';
import { ErrorHandler } from '../../middleware/error-handler';
import { DebugManager } from '../../debug/debug-manager';
import {
  ClaudeCodeResponse,
  ClientOutputValidationError,
  CLAUDE_CODE_RESPONSE_SCHEMA,
} from '../schemas/claude-code-schemas';

/**
 * 输出验证错误类
 */
export class OutputValidationError extends Error {
  public readonly module = 'client.output.validation';
  public readonly code: string;
  public readonly field: string;
  public readonly path: string;
  public readonly expected: string;
  public readonly actual: string;
  public readonly value: any;
  public readonly details: ClientOutputValidationError;
  public readonly timestamp: number;

  constructor(
    field: string,
    path: string,
    expected: string,
    actual: string,
    value: any,
    message: string,
    code: string = 'OUTPUT_VALIDATION_FAILED'
  ) {
    super(message);
    this.name = 'OutputValidationError';
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

    Error.captureStackTrace(this, OutputValidationError);
  }

  /**
   * 获取详细的错误信息用于调试
   */
  getDetailedErrorInfo(): string {
    return [
      `🚫 Output Validation Failed at ${this.module}`,
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
    return `输出验证失败: 响应字段 '${this.field}' ${this.message}`;
  }
}

/**
 * 客户端输出验证器
 */
export class ClientOutputValidator {
  private errorHandler: ErrorHandler;
  private debugManager: DebugManager;
  private validationStats: Map<string, number> = new Map();

  constructor(errorHandler: ErrorHandler, debugManager: DebugManager) {
    this.errorHandler = errorHandler;
    this.debugManager = debugManager;
  }

  /**
   * 验证Claude Code响应
   */
  validateClaudeCodeResponse(response: any, requestId: string): ClaudeCodeResponse {
    const startTime = Date.now();

    try {
      // 记录验证开始
      this.debugManager.recordInput('client.output.validation', requestId, {
        type: 'output_validation_start',
        timestamp: new Date().toISOString(),
        data: { response },
      });

      // 执行严格验证
      const validationResult = DataValidator.validate(response, CLAUDE_CODE_RESPONSE_SCHEMA);

      if (!validationResult.isValid) {
        // 处理验证失败
        this.handleValidationFailure(validationResult, response, requestId);
      }

      // 额外的业务逻辑验证
      this.validateOutputBusinessLogic(response, requestId);

      // 验证成功，记录统计
      this.recordValidationSuccess('claude_code_response');

      const processingTime = Date.now() - startTime;

      this.debugManager.recordOutput('client.output.validation', requestId, {
        type: 'output_validation_success',
        timestamp: new Date().toISOString(),
        processingTime,
        data: { validatedResponse: validationResult.sanitizedData },
      });

      return validationResult.sanitizedData as ClaudeCodeResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 记录验证失败
      this.debugManager.recordError('client.output.validation', requestId, error);

      // 抛出错误
      throw error;
    }
  }

  /**
   * 验证API状态响应
   */
  validateStatusResponse(response: any): any {
    const statusSchema = {
      status: {
        type: 'string' as const,
        required: true,
        enum: ['healthy', 'degraded', 'unhealthy'],
      },
      timestamp: {
        type: 'string' as const,
        required: true,
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      },
      uptime: {
        type: 'number' as const,
        required: true,
      },
      version: {
        type: 'string' as const,
        required: true,
        minLength: 1,
        maxLength: 50,
      },
      requests: {
        type: 'object' as const,
        required: true,
        properties: {
          total: { type: 'number' as const, required: true },
          successful: { type: 'number' as const, required: true },
          failed: { type: 'number' as const, required: true },
        },
      },
    };

    const validationResult = DataValidator.validate(response, statusSchema);

    if (!validationResult.isValid) {
      this.handleValidationFailure(validationResult, response, 'status_response');
    }

    this.recordValidationSuccess('status_response');
    return validationResult.sanitizedData;
  }

  /**
   * 处理验证失败
   */
  private handleValidationFailure(validationResult: ValidationResult, originalData: any, requestId: string): never {
    const firstError = validationResult.errors[0];
    const errorParts = this.parseValidationError(firstError);

    // 创建详细的验证错误
    const validationError = new OutputValidationError(
      errorParts.field,
      errorParts.path,
      errorParts.expected,
      errorParts.actual,
      errorParts.value,
      errorParts.message,
      'OUTPUT_FIELD_VALIDATION_FAILED'
    );

    // 记录验证失败统计
    this.recordValidationFailure(errorParts.field);

    // 使用错误处理器处理
    this.errorHandler.handleError(validationError, {
      module: 'client.output.validation',
      operation: 'validate_output',
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
   * 输出业务逻辑验证
   */
  private validateOutputBusinessLogic(response: any, requestId: string): void {
    // 验证内容一致性
    if (response.content && Array.isArray(response.content)) {
      for (let i = 0; i < response.content.length; i++) {
        const content = response.content[i];

        // text类型内容必须有text字段
        if (content.type === 'text' && (!content.text || content.text.length === 0)) {
          throw new OutputValidationError(
            `content[${i}].text`,
            `content[${i}].text`,
            'non-empty string',
            'empty or missing',
            content.text,
            'text content cannot be empty',
            'EMPTY_TEXT_CONTENT'
          );
        }

        // tool_use类型内容必须有id和name
        if (content.type === 'tool_use') {
          if (!content.id) {
            throw new OutputValidationError(
              `content[${i}].id`,
              `content[${i}].id`,
              'non-empty string',
              'missing',
              content.id,
              'tool_use content must have id',
              'MISSING_TOOL_ID'
            );
          }

          if (!content.name) {
            throw new OutputValidationError(
              `content[${i}].name`,
              `content[${i}].name`,
              'non-empty string',
              'missing',
              content.name,
              'tool_use content must have name',
              'MISSING_TOOL_NAME'
            );
          }
        }
      }
    }

    // 验证使用统计的合理性
    if (response.usage) {
      if (response.usage.input_tokens < 0) {
        throw new OutputValidationError(
          'usage.input_tokens',
          'usage.input_tokens',
          'non-negative number',
          `${response.usage.input_tokens}`,
          response.usage.input_tokens,
          'input_tokens cannot be negative',
          'NEGATIVE_INPUT_TOKENS'
        );
      }

      if (response.usage.output_tokens < 0) {
        throw new OutputValidationError(
          'usage.output_tokens',
          'usage.output_tokens',
          'non-negative number',
          `${response.usage.output_tokens}`,
          response.usage.output_tokens,
          'output_tokens cannot be negative',
          'NEGATIVE_OUTPUT_TOKENS'
        );
      }
    }

    // 验证stop_reason和content的一致性
    if (response.stop_reason === 'tool_use') {
      const hasToolUse = response.content?.some((c: any) => c.type === 'tool_use');
      if (!hasToolUse) {
        throw new OutputValidationError(
          'stop_reason',
          'stop_reason',
          'tool_use with tool_use content',
          'tool_use without tool_use content',
          response.stop_reason,
          'stop_reason is tool_use but no tool_use content found',
          'INCONSISTENT_STOP_REASON'
        );
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
 * 输出验证装饰器
 *
 * 使用方法:
 * @ValidateOutput('claude_code_response')
 * async processRequest(request: any): Promise<any>
 */
export function ValidateOutput(validationType: 'claude_code_response' | 'status_response') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 调用原始方法获取结果
      const result = await originalMethod.apply(this, args);

      const validator = this.outputValidator as ClientOutputValidator;

      if (!validator) {
        throw new Error('ClientOutputValidator not initialized. Ensure outputValidator is injected.');
      }

      // 获取请求ID (假设在第二个参数或从上下文生成)
      const requestId = args[1] || `${propertyKey}_${Date.now()}`;

      // 根据验证类型选择验证方法
      let validatedOutput;
      if (validationType === 'claude_code_response') {
        validatedOutput = validator.validateClaudeCodeResponse(result, requestId);
      } else if (validationType === 'status_response') {
        validatedOutput = validator.validateStatusResponse(result);
      } else {
        throw new Error(`Unknown validation type: ${validationType}`);
      }

      // 返回验证后的数据
      return validatedOutput;
    };

    return descriptor;
  };
}
