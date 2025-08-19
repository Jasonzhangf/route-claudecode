/**
 * Debug数据过滤器
 *
 * 负责敏感信息过滤、数据脱敏和隐私保护
 *
 * @author Jason Zhang
 */

import { DebugConfig } from './types/debug-types';

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
  filtered: any;
  hasChanges: boolean;
  sensitiveFields: string[];
}

/**
 * Debug数据过滤器接口
 */
export interface DebugFilter {
  filterRequest(request: any): FilterResult;
  filterResponse(response: any): FilterResult;
  filterError(error: any): FilterResult;
  filterModuleInput(input: any): FilterResult;
  filterModuleOutput(output: any): FilterResult;
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
  filterRequest(request: any): FilterResult {
    const filtered = this.deepClone(request);
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    // 过滤headers中的敏感信息
    if (filtered.headers) {
      const headerResult = this.filterHeaders(filtered.headers);
      filtered.headers = headerResult.filtered;
      sensitiveFields.push(...headerResult.sensitiveFields.map(f => `headers.${f}`));
      hasChanges = hasChanges || headerResult.hasChanges;
    }

    // 过滤body中的敏感信息
    if (filtered.body) {
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
  filterResponse(response: any): FilterResult {
    const filtered = this.deepClone(response);
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    // 过滤headers
    if (filtered.headers) {
      const headerResult = this.filterHeaders(filtered.headers);
      filtered.headers = headerResult.filtered;
      sensitiveFields.push(...headerResult.sensitiveFields.map(f => `headers.${f}`));
      hasChanges = hasChanges || headerResult.hasChanges;
    }

    // 过滤body
    if (filtered.body) {
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
  filterError(error: any): FilterResult {
    const filtered = this.deepClone(error);
    const sensitiveFields: string[] = [];
    let hasChanges = false;

    // 过滤堆栈信息中的敏感路径
    if (filtered.stack) {
      const stackResult = this.filterStackTrace(filtered.stack);
      filtered.stack = stackResult.filtered;
      if (stackResult.hasChanges) {
        sensitiveFields.push('stack');
        hasChanges = true;
      }
    }

    // 过滤错误消息中的敏感信息
    if (filtered.message) {
      const messageResult = this.filterString(filtered.message);
      filtered.message = messageResult.filtered;
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
  filterModuleInput(input: any): FilterResult {
    return this.filterObject(input, 'input');
  }

  /**
   * 过滤模块输出
   */
  filterModuleOutput(output: any): FilterResult {
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

  private filterObject(obj: any, basePath: string): FilterResult {
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

  private filterArray(arr: any[], basePath: string): FilterResult {
    const filtered: any[] = [];
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

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }
}
