/**
 * 字段转换引擎核心逻辑
 * 
 * 基于配置表的字段转换引擎核心实现
 * 支持动态规则应用、嵌套字段处理和上下文感知转换
 * 
 * @author RCC v4.0 - Configuration-Driven Architecture
 */

import { FieldTransformRule } from './routing-table-types';

/**
 * 字段转换错误类型
 */
export class FieldTransformError extends Error {
  constructor(
    message: string,
    public sourceModule: string,
    public fieldName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FieldTransformError';
  }
}

/**
 * 错误处理中心接口
 */
export interface ErrorHandlingCenter {
  handleError(error: FieldTransformError): void;
  reportUnknownField(module: string, fieldName: string, context: any): void;
}

/**
 * 默认错误处理实现
 */
export class DefaultErrorHandlingCenter implements ErrorHandlingCenter {
  handleError(error: FieldTransformError): void {
    console.error(`[${error.sourceModule}] 字段转换错误:`, {
      message: error.message,
      fieldName: error.fieldName,
      originalError: error.originalError?.message,
      timestamp: new Date().toISOString()
    });
    
    // 这里可以集成到项目的统一错误处理中心
    // 例如抛出到全局错误处理器或发送到监控系统
  }

  reportUnknownField(module: string, fieldName: string, context: any): void {
    const error = new FieldTransformError(
      `未知的字段 '${fieldName}'`,
      module,
      fieldName
    );
    this.handleError(error);
  }
}

// 全局错误处理实例
let globalErrorCenter: ErrorHandlingCenter = new DefaultErrorHandlingCenter();

/**
 * 设置全局错误处理中心
 */
export function setErrorHandlingCenter(center: ErrorHandlingCenter): void {
  globalErrorCenter = center;
}

/**
 * 获取全局错误处理中心
 */
export function getErrorHandlingCenter(): ErrorHandlingCenter {
  return globalErrorCenter;
}

/**
 * 字段路径工具类
 * 支持嵌套字段路径的解析和设置
 */
export class FieldPathUtil {
  /**
   * 从对象中获取嵌套字段的值
   * @param obj 目标对象
   * @param path 字段路径 (如 'user.profile.name' 或 'messages[0].content')
   * @returns 字段值
   */
  static getFieldValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') return undefined;
    
    // 处理数组索引路径 (如 'messages[0]')
    const arrayMatch = path.match(/^([^\[]+)\[(\d+)\](.*)$/);
    if (arrayMatch) {
      const fieldName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      const remainingPath = arrayMatch[3].startsWith('.') ? arrayMatch[3].substring(1) : arrayMatch[3];
      
      const array = obj[fieldName];
      if (!Array.isArray(array) || index >= array.length) return undefined;
      
      if (remainingPath) {
        return this.getFieldValue(array[index], remainingPath);
      }
      return array[index];
    }
    
    // 处理点号分隔的路径
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }

  /**
   * 在对象中设置嵌套字段的值
   * @param obj 目标对象
   * @param path 字段路径
   * @param value 要设置的值
   */
  static setFieldValue(obj: any, path: string, value: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    // 处理数组索引路径
    const arrayMatch = path.match(/^([^\[]+)\[(\d+)\](.*)$/);
    if (arrayMatch) {
      const fieldName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      const remainingPath = arrayMatch[3].startsWith('.') ? arrayMatch[3].substring(1) : arrayMatch[3];
      
      if (!obj[fieldName]) {
        obj[fieldName] = [];
      }
      
      if (!Array.isArray(obj[fieldName])) {
        obj[fieldName] = [obj[fieldName]];
      }
      
      while (obj[fieldName].length <= index) {
        obj[fieldName].push({});
      }
      
      if (remainingPath) {
        this.setFieldValue(obj[fieldName][index], remainingPath, value);
      } else {
        obj[fieldName][index] = value;
      }
      return;
    }
    
    // 处理点号分隔的路径
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || current[part] === null || current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}

/**
 * 字段转换引擎核心类
 */
export class FieldTransformEngineCore {
  /**
   * 应用单个转换规则
   * @param rule 转换规则
   * @param sourceData 源数据
   * @param targetData 目标数据
   * @param context 转换上下文
   */
  static applyRule(
    rule: FieldTransformRule, 
    sourceData: any, 
    targetData: any, 
    context: any = {}
  ): void {
    try {
      // 提取源字段值
      let value = FieldPathUtil.getFieldValue(sourceData, rule.source);
      
      // 检查字段是否存在，如果不存在且不是必需字段，报告未知字段
      if (value === undefined && context.strictMode !== false) {
        const moduleName = context.module || 'field-transform';
        getErrorHandlingCenter().reportUnknownField(moduleName, rule.source, {
          sourceData,
          targetData,
          context
        });
      }
      
      // 如果字段不存在且有默认值，使用默认值
      if ((value === undefined || value === null) && rule.defaultValue !== undefined) {
        value = rule.defaultValue;
      }
      
      // 如果是必需字段且没有值，抛出错误
      if (rule.required && (value === undefined || value === null)) {
        const error = new FieldTransformError(
          `Required field '${rule.source}' is missing`,
          context.module || 'field-transform',
          rule.source
        );
        getErrorHandlingCenter().handleError(error);
        throw error;
      }
      
      // 应用转换函数
      if (rule.transform && value !== undefined && value !== null) {
        const transformContext = {
          ...context,
          sourceField: rule.source,
          targetField: rule.target,
          sourceValue: value
        };
        try {
          value = rule.transform(value, transformContext);
        } catch (transformError) {
          const error = new FieldTransformError(
            `Transform failed for field '${rule.source}': ${transformError instanceof Error ? transformError.message : String(transformError)}`,
            context.module || 'field-transform',
            rule.source,
            transformError instanceof Error ? transformError : new Error(String(transformError))
          );
          getErrorHandlingCenter().handleError(error);
          throw error;
        }
      } else if (rule.required && (value === undefined || value === null)) {
        // 如果没有转换函数但字段必需，使用fallback值
        if (rule.fallbackValue !== undefined) {
          value = rule.fallbackValue;
        }
      }
      
      // 设置目标字段值
      if (value !== undefined) {
        try {
          FieldPathUtil.setFieldValue(targetData, rule.target, value);
        } catch (setError) {
          const error = new FieldTransformError(
            `Failed to set target field '${rule.target}': ${setError instanceof Error ? setError.message : String(setError)}`,
            context.module || 'field-transform',
            rule.source,
            setError instanceof Error ? setError : new Error(String(setError))
          );
          getErrorHandlingCenter().handleError(error);
          throw error;
        }
      }
    } catch (error) {
      // 如果转换失败且有fallback值，使用fallback值
      if (rule.fallbackValue !== undefined) {
        try {
          FieldPathUtil.setFieldValue(targetData, rule.target, rule.fallbackValue);
        } catch (fallbackErr) {
          const fallbackError = new FieldTransformError(
            `Fallback failed for field '${rule.source}': ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
            context.module || 'field-transform',
            rule.source,
            fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr))
          );
          getErrorHandlingCenter().handleError(fallbackError);
          throw fallbackError;
        }
      } else {
        if (error instanceof FieldTransformError) {
          throw error;
        }
        const wrappedError = new FieldTransformError(
          `Field transformation failed for '${rule.source}': ${error instanceof Error ? error.message : String(error)}`,
          context.module || 'field-transform',
          rule.source,
          error instanceof Error ? error : new Error(String(error))
        );
        getErrorHandlingCenter().handleError(wrappedError);
        throw wrappedError;
      }
    }
  }

  /**
   * 应用多个转换规则
   * @param rules 转换规则数组
   * @param sourceData 源数据
   * @param targetData 目标数据
   * @param context 转换上下文
   */
  static applyRules(
    rules: FieldTransformRule[], 
    sourceData: any, 
    targetData: any, 
    context: any = {}
  ): void {
    for (const rule of rules) {
      this.applyRule(rule, sourceData, targetData, context);
    }
  }

  /**
   * 执行完整的字段转换流程
   * @param rules 转换规则
   * @param inputData 输入数据
   * @param context 转换上下文
   * @returns 转换后的数据
   */
  static transform(
    rules: FieldTransformRule[], 
    inputData: any, 
    context: any = {}
  ): any {
    const outputData = { ...inputData };
    
    // 应用所有转换规则
    this.applyRules(rules, inputData, outputData, context);
    
    // 添加元数据
    if (!outputData.metadata) {
      outputData.metadata = {};
    }
    outputData.metadata = {
      ...outputData.metadata,
      transformationApplied: true,
      rulesApplied: rules.length,
      timestamp: new Date().toISOString(),
      context: context
    };
    
    return outputData;
  }

  /**
   * 提取字段值（支持嵌套路径）
   */
  static extractFieldValue(obj: any, path: string): any {
    return FieldPathUtil.getFieldValue(obj, path);
  }

  /**
   * 设置字段值（支持嵌套路径）
   */
  static setFieldValue(obj: any, path: string, value: any): void {
    FieldPathUtil.setFieldValue(obj, path, value);
  }
}

export default {
  FieldPathUtil,
  FieldTransformEngineCore,
  FieldTransformError,
  DefaultErrorHandlingCenter,
  setErrorHandlingCenter,
  getErrorHandlingCenter
};

