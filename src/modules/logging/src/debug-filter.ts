/**
 * Debug数据过滤器
 *
 * 负责敏感信息过滤、数据脱敏和隐私保护
 *
 * @author Jason Zhang
 */

import { DebugConfig } from './types/debug-types';

/**
 * 请求对象类型
 */
interface RequestLike {
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
}

/**
 * 响应对象类型
 */
interface ResponseLike {
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
}

/**
 * 错误对象类型
 */
interface ErrorLike {
  stack?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * 类型守卫函数
 */
function isRequestLike(obj: unknown): obj is RequestLike {
  return obj !== null && typeof obj === 'object';
}

function isResponseLike(obj: unknown): obj is ResponseLike {
  return obj !== null && typeof obj === 'object';
}

function isErrorLike(obj: unknown): obj is ErrorLike {
  return obj !== null && typeof obj === 'object';
}

function hasStringProperty(obj: unknown, prop: string): obj is Record<string, unknown> & { [K in typeof prop]: string } {
  return obj !== null && typeof obj === 'object' && prop in obj && typeof (obj as any)[prop] === 'string';
}

function hasProperty(obj: unknown, prop: string): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && prop in obj;
}

/**
 * 敏感字段配置
 */
export interface SensitiveFieldConfig {
  keyPatterns: RegExp[];
  valuePatterns: RegExp[];
  replacementText: string;
  strictMode: boolean;
}

/**
 * 过滤结果
 */
export interface FilterResult {
  filtered: unknown;
  hasChanges: boolean;
  sensitiveFields: string[];
}

/**
 * Debug数据过滤器接口
 */
export interface DebugFilter {
  filterRequest(request: unknown): FilterResult;
  filterResponse(response: unknown): FilterResult;
  filterError(error: unknown): FilterResult;
  filterModuleInput(input: unknown): FilterResult;
  filterModuleOutput(output: unknown): FilterResult;
  addSensitivePattern(pattern: RegExp): void;
  removeSensitivePattern(pattern: RegExp): void;
}

/**
 * Debug数据过滤器实现
 */
export class DebugFilterImpl implements DebugFilter {
  private config: DebugConfig;
  private sensitiveConfig: SensitiveFieldConfig;

  constructor(config: DebugConfig) {
    this.config = config;
    this.sensitiveConfig = this.createDefaultSensitiveConfig();
  }

  /**
   * 过滤请求数据
   */
  filterRequest(request: unknown): FilterResult {
    const filtered = this.deepClone(request) as RequestLike;
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    if (!isRequestLike(filtered)) {
      return { filtered, hasChanges: false, sensitiveFields: [] };
    }

    // 过滤headers中的敏感信息
    if (filtered.headers && typeof filtered.headers === 'object' && filtered.headers !== null) {
      const headersRecord = filtered.headers;
      // Check if all values are strings and keys are strings
      const isStringRecord = Object.entries(headersRecord).every(([k, v]) => 
        typeof k === 'string' && typeof v === 'string'
      );
      if (isStringRecord) {
        const headerResult = this.filterHeaders(headersRecord as Record<string, string>);
        filtered.headers = headerResult.filtered as Record<string, string>;
        sensitiveFields.push(...headerResult.sensitiveFields.map(f => `headers.${f}`));
        hasChanges = hasChanges || headerResult.hasChanges;
      }
    }

    // 过滤body中的敏感信息
    if (hasProperty(filtered, 'body')) {
      const bodyResult = this.filterObject(filtered.body, 'body');
      filtered.body = bodyResult.filtered;
      sensitiveFields.push(...bodyResult.sensitiveFields);
      hasChanges = hasChanges || bodyResult.hasChanges;
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  /**
   * 过滤响应数据
   */
  filterResponse(response: unknown): FilterResult {
    const filtered = this.deepClone(response) as ResponseLike;
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    if (!isResponseLike(filtered)) {
      return { filtered, hasChanges: false, sensitiveFields: [] };
    }

    // 过滤headers
    if (filtered.headers && typeof filtered.headers === 'object' && filtered.headers !== null) {
      const headersRecord = filtered.headers;
      // Check if all values are strings and keys are strings
      const isStringRecord = Object.entries(headersRecord).every(([k, v]) => 
        typeof k === 'string' && typeof v === 'string'
      );
      if (isStringRecord) {
        const headerResult = this.filterHeaders(headersRecord as Record<string, string>);
        filtered.headers = headerResult.filtered as Record<string, string>;
        sensitiveFields.push(...headerResult.sensitiveFields.map(f => `headers.${f}`));
        hasChanges = hasChanges || headerResult.hasChanges;
      }
    }

    // 过滤body
    if (hasProperty(filtered, 'body')) {
      const bodyResult = this.filterObject(filtered.body, 'body');
      filtered.body = bodyResult.filtered;
      sensitiveFields.push(...bodyResult.sensitiveFields);
      hasChanges = hasChanges || bodyResult.hasChanges;
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  /**
   * 过滤错误信息
   */
  filterError(error: unknown): FilterResult {
    const filtered = this.deepClone(error) as ErrorLike;
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    if (!isErrorLike(filtered)) {
      return { filtered, hasChanges: false, sensitiveFields: [] };
    }

    // 过滤堆栈信息中的敏感路径
    if (hasStringProperty(filtered, 'stack')) {
      const stackResult = this.filterStackTrace(filtered.stack as string);
      filtered.stack = stackResult.filtered as string;
      if (stackResult.hasChanges) {
        sensitiveFields.push('stack');
        hasChanges = true;
      }
    }

    // 过滤错误消息中的敏感信息
    if (hasStringProperty(filtered, 'message')) {
      const messageResult = this.filterString(filtered.message as string);
      filtered.message = messageResult.filtered as string;
      if (messageResult.hasChanges) {
        sensitiveFields.push('message');
        hasChanges = true;
      }
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  /**
   * 过滤模块输入
   */
  filterModuleInput(input: unknown): FilterResult {
    return this.filterObject(input, 'input');
  }

  /**
   * 过滤模块输出
   */
  filterModuleOutput(output: unknown): FilterResult {
    return this.filterObject(output, 'output');
  }

  /**
   * 添加敏感信息模式
   */
  addSensitivePattern(pattern: RegExp): void {
    this.sensitiveConfig.keyPatterns.push(pattern);
  }

  /**
   * 移除敏感信息模式
   */
  removeSensitivePattern(pattern: RegExp): void {
    const index = this.sensitiveConfig.keyPatterns.findIndex(p => p.source === pattern.source);
    if (index !== -1) {
      this.sensitiveConfig.keyPatterns.splice(index, 1);
    }
  }

  // ===== Private Helper Methods =====

  private createDefaultSensitiveConfig(): SensitiveFieldConfig {
    return {
      keyPatterns: [
        /api[_\-]?key/i,
        /authorization/i,
        /password/i,
        /secret/i,
        /token/i,
        /credential/i,
        /private[_\-]?key/i,
        /session[_\-]?id/i,
        /cookie/i,
        /x-api-key/i,
        /bearer/i,
      ],
      valuePatterns: [
        /sk-[a-zA-Z0-9]{20,}/, // OpenAI API keys
        /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 encoded tokens
        /^[a-f0-9]{32,}$/i, // Hex tokens
        /\b[A-Za-z0-9]{20,}\b/, // Generic long alphanumeric strings
      ],
      replacementText: '[FILTERED]',
      strictMode: true,
    };
  }

  private filterHeaders(headers: Record<string, string>): FilterResult {
    const filtered = { ...headers };
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveKey(key) || this.isSensitiveValue(value)) {
        filtered[key] = this.sensitiveConfig.replacementText;
        sensitiveFields.push(key);
        hasChanges = true;
      }
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  private filterObject(obj: unknown, basePath: string): FilterResult {
    if (obj === null || obj === undefined) {
      return { filtered: obj, hasChanges: false, sensitiveFields: [] };
    }

    if (typeof obj === 'string') {
      return this.filterString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return { filtered: obj, hasChanges: false, sensitiveFields: [] };
    }

    if (Array.isArray(obj)) {
      return this.filterArray(obj, basePath);
    }

    if (typeof obj === 'object') {
      return this.filterObjectInternal(obj, basePath);
    }

    return { filtered: obj, hasChanges: false, sensitiveFields: [] };
  }

  private filterArray(arr: unknown[], basePath: string): FilterResult {
    const filtered: unknown[] = [];
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    for (let i = 0; i < arr.length; i++) {
      const result = this.filterObject(arr[i], `${basePath}[${i}]`);
      filtered.push(result.filtered);
      sensitiveFields.push(...result.sensitiveFields);
      hasChanges = hasChanges || result.hasChanges;
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  private filterObjectInternal(obj: Record<string, any>, basePath: string): FilterResult {
    const filtered: Record<string, any> = {};
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    for (const [key, value] of Object.entries(obj)) {
      const keyPath = basePath ? `${basePath}.${key}` : key;

      if (this.isSensitiveKey(key)) {
        filtered[key] = this.sensitiveConfig.replacementText;
        sensitiveFields.push(keyPath);
        hasChanges = true;
      } else {
        const result = this.filterObject(value, keyPath);
        filtered[key] = result.filtered;
        sensitiveFields.push(...result.sensitiveFields);
        hasChanges = hasChanges || result.hasChanges;
      }
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields,
    };
  }

  private filterString(str: string): FilterResult {
    let filtered = str;
    let hasChanges = false;

    // 检查字符串值是否包含敏感信息
    for (const pattern of this.sensitiveConfig.valuePatterns) {
      if (pattern.test(filtered)) {
        filtered = this.sensitiveConfig.replacementText;
        hasChanges = true;
        break;
      }
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields: hasChanges ? ['value'] : [],
    };
  }

  private filterStackTrace(stack: string): FilterResult {
    let filtered = stack;
    let hasChanges = false;

    // 过滤堆栈中的敏感路径信息
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir && filtered.includes(homeDir)) {
      filtered = filtered.replace(new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~');
      hasChanges = true;
    }

    // 过滤绝对路径
    filtered = filtered.replace(/\/[^\/\s]+(?:\/[^\/\s]+)*\/([^\/\s]+\.js|[^\/\s]+\.ts)/g, '.../$1');
    if (filtered !== stack) {
      hasChanges = true;
    }

    return {
      filtered,
      hasChanges,
      sensitiveFields: [],
    };
  }

  private isSensitiveKey(key: string): boolean {
    return this.sensitiveConfig.keyPatterns.some(pattern => pattern.test(key));
  }

  private isSensitiveValue(value: string): boolean {
    if (typeof value !== 'string') return false;
    return this.sensitiveConfig.valuePatterns.some(pattern => pattern.test(value));
  }

  private deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;
    for (const key in objRecord) {
      if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
        cloned[key] = this.deepClone(objRecord[key]);
      }
    }

    return cloned;
  }
}
