/**
 * 数据验证器
 * 提供运行时数据验证功能
 */

export interface ValidationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  enum?: string[] | number[];
  properties?: ValidationSchema | { [key: string]: ValidationSchema };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DataValidator {
  static validate(data: any, schema: ValidationSchema | { [key: string]: ValidationSchema }): ValidationResult {
    const errors: string[] = [];

    try {
      this.validateValue(data, schema, '', errors);
    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateValue(
    value: any,
    schema: ValidationSchema | { [key: string]: ValidationSchema },
    path: string,
    errors: string[]
  ): void {
    // 如果schema没有type字段，说明这是一个对象schema
    if (!('type' in schema)) {
      if (typeof value !== 'object' || value === null) {
        errors.push(`${path || 'root'}: Expected object`);
        return;
      }

      for (const [key, subSchema] of Object.entries(schema)) {
        const subPath = path ? `${path}.${key}` : key;
        this.validateValue(value[key], subSchema, subPath, errors);
      }
      return;
    }

    // 检查required
    if (schema.required && (value === undefined || value === null)) {
      errors.push(`${path || 'field'}: Required field is missing`);
      return;
    }

    // 如果值为undefined且不是required，跳过其他检查
    if (value === undefined && !schema.required) {
      return;
    }

    // 类型检查
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${path || 'field'}: Expected string, got ${typeof value}`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push(`${path || 'field'}: Expected number, got ${typeof value}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${path || 'field'}: Expected boolean, got ${typeof value}`);
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${path || 'field'}: Expected object, got ${typeof value}`);
        } else if (schema.properties) {
          // 验证对象属性
          if (typeof schema.properties === 'object' && 'type' in schema.properties) {
            // 单一属性模式
            for (const key in value) {
              this.validateValue(value[key], schema.properties, `${path}.${key}`, errors);
            }
          } else {
            // 多属性模式
            for (const [key, subSchema] of Object.entries(schema.properties as { [key: string]: ValidationSchema })) {
              this.validateValue(value[key], subSchema, `${path}.${key}`, errors);
            }
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${path || 'field'}: Expected array, got ${typeof value}`);
        } else if (schema.properties) {
          // 验证数组元素
          value.forEach((item, index) => {
            this.validateValue(item, schema.properties!, `${path}[${index}]`, errors);
          });
        }
        break;
    }

    // 枚举检查
    if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
      errors.push(`${path || 'field'}: Value must be one of: ${schema.enum.join(', ')}`);
    }
  }
}

// 装饰器
export function ValidateInput(schema: { [key: string]: ValidationSchema }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // 简单的参数验证 - 在实际应用中应该更复杂
      const validation = DataValidator.validate(args[0], schema);
      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export function ValidateOutput(schema: ValidationSchema) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const validation = DataValidator.validate(result, schema);
      if (!validation.isValid) {
        throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
      }
      return result;
    };

    return descriptor;
  };
}
