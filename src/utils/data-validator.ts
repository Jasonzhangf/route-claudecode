/**
 * Data Validator Utility
 *
 * 通用数据验证工具，确保所有模块输入输出数据的完整性
 *
 * @author Claude Code
 * @version 1.0.0
 */

import { secureLogger } from './secure-logger';

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    pattern?: RegExp;
    enum?: any[];
    properties?: ValidationSchema;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

/**
 * 单个验证规则定义
 */
export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: RegExp;
  enum?: any[];
  properties?: ValidationSchema;
}

/**
 * 数据验证器类
 */
export class DataValidator {
  /**
   * 验证数据是否符合指定模式
   */
  static validate(data: any, schema: ValidationSchema, path: string = ''): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    // 检查必需字段
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      const fullPath = path ? `${path}.${fieldName}` : fieldName;
      const fieldValue = data?.[fieldName];

      // 检查必需字段
      if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
        errors.push(`字段 '${fullPath}' 是必需的`);
        continue;
      }

      // 如果字段不存在且非必需，跳过验证
      if (fieldValue === undefined || fieldValue === null) {
        sanitizedData[fieldName] = fieldValue;
        continue;
      }

      // 类型验证
      if (!this.validateType(fieldValue, fieldSchema.type, fullPath, errors)) {
        continue;
      }

      // 字符串特有验证
      if (fieldSchema.type === 'string') {
        this.validateString(fieldValue, fieldSchema, fullPath, errors);
      }

      // 数字特有验证
      if (fieldSchema.type === 'number') {
        this.validateNumber(fieldValue, fieldSchema, fullPath, errors);
      }

      // 数组特有验证
      if (fieldSchema.type === 'array') {
        this.validateArray(fieldValue, fieldSchema, fullPath, errors);
      }

      // 对象特有验证
      if (fieldSchema.type === 'object' && fieldSchema.properties) {
        const nestedResult = this.validate(fieldValue, fieldSchema.properties, fullPath);
        if (!nestedResult.isValid) {
          errors.push(...nestedResult.errors);
        }
      }

      // 枚举验证
      if (fieldSchema.enum && !fieldSchema.enum.includes(fieldValue)) {
        errors.push(`字段 '${fullPath}' 的值必须是枚举值之一: ${fieldSchema.enum.join(', ')}`);
      }

      // 模式验证
      if (fieldSchema.pattern && typeof fieldValue === 'string' && !fieldSchema.pattern.test(fieldValue)) {
        errors.push(`字段 '${fullPath}' 不符合模式要求: ${fieldSchema.pattern}`);
      }

      sanitizedData[fieldName] = fieldValue;
    }

    // 检查额外字段（如果schema不允许额外字段）
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const schemaKeys = Object.keys(schema);
      const dataKeys = Object.keys(data);
      const extraKeys = dataKeys.filter(key => !schemaKeys.includes(key));

      if (extraKeys.length > 0) {
        // 在生产环境中记录警告而不是错误
        secureLogger.warn('发现额外字段', {
          extraFields: extraKeys,
          schemaKeys,
          dataKeys,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    };
  }

  /**
   * 类型验证
   */
  private static validateType(value: any, expectedType: string, path: string, errors: string[]): boolean {
    const actualType = this.getActualType(value);

    if (actualType !== expectedType) {
      errors.push(`字段 '${path}' 类型不匹配，期望: ${expectedType}, 实际: ${actualType}`);
      return false;
    }

    return true;
  }

  /**
   * 获取实际类型
   */
  private static getActualType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * 字符串验证
   */
  private static validateString(value: any, schema: any, path: string, errors: string[]): void {
    if (typeof value !== 'string') return;

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`字段 '${path}' 长度不能小于 ${schema.minLength} 个字符`);
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`字段 '${path}' 长度不能大于 ${schema.maxLength} 个字符`);
    }
  }

  /**
   * 数字验证
   */
  private static validateNumber(value: any, schema: any, path: string, errors: string[]): void {
    if (typeof value !== 'number') return;

    // 这里可以添加更多数字验证逻辑
  }

  /**
   * 数组验证
   */
  private static validateArray(value: any, schema: any, path: string, errors: string[]): void {
    if (!Array.isArray(value)) return;

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`字段 '${path}' 项目数量不能少于 ${schema.minItems} 个`);
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`字段 '${path}' 项目数量不能多于 ${schema.maxItems} 个`);
    }

    // 如果有嵌套属性定义，验证每个数组元素
    if (schema.properties) {
      value.forEach((item: any, index: number) => {
        const itemPath = `${path}[${index}]`;
        const itemResult = this.validate(item, schema.properties, itemPath);
        if (!itemResult.isValid) {
          errors.push(...itemResult.errors);
        }
      });
    }
  }

  /**
   * 创建验证装饰器
   */
  static createValidator(schema: ValidationSchema): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        // 验证所有参数
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const result = DataValidator.validate(arg, schema);

          if (!result.isValid) {
            const error = new Error(`参数验证失败: ${result.errors.join(', ')}`);
            secureLogger.error('数据验证失败', {
              method: propertyKey.toString(),
              argumentIndex: i,
              errors: result.errors,
              data: arg,
            });
            throw error;
          }
        }

        // 调用原始方法
        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }
}

/**
 * 输入验证装饰器
 */
export function ValidateInput(schema: ValidationSchema) {
  return DataValidator.createValidator(schema);
}

/**
 * 输出验证装饰器
 */
export function ValidateOutput(schema: ValidationSchema) {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 调用原始方法获取结果
      const result = await originalMethod.apply(this, args);

      // 验证输出
      const validationResult = DataValidator.validate(result, schema);

      if (!validationResult.isValid) {
        const error = new Error(`输出验证失败: ${validationResult.errors.join(', ')}`);
        secureLogger.error('输出验证失败', {
          method: propertyKey.toString(),
          errors: validationResult.errors,
          data: result,
        });
        throw error;
      }

      return result;
    };

    return descriptor;
  };
}
