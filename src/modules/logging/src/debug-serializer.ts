/**
 * Debug数据序列化器
 *
 * 负责数据序列化、格式转换和数据压缩
 *
 * @author Jason Zhang
 */

import * as zlib from 'zlib';
import { promisify } from 'util';
import { DebugRecord, ModuleRecord, DebugSession, DebugConfig } from './types/debug-types';
import JQJsonHandler from '../../error-handler/src/utils/jq-json-handler';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * 序列化选项
 */
export interface SerializationOptions {
  compression: boolean;
  prettyPrint: boolean;
  maxSize: number;
  includeMetadata: boolean;
}

/**
 * 序列化结果
 */
export interface SerializationResult {
  data: string | Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  metadata: {
    compressed: boolean;
    encoding: 'utf8' | 'gzip';
    timestamp: number;
  };
}

/**
 * 反序列化结果
 */
export interface DeserializationResult<T> {
  data: T;
  metadata: {
    originalSize: number;
    wasCompressed: boolean;
    timestamp: number;
  };
}

/**
 * Debug数据序列化器接口
 */
export interface DebugSerializer {
  serializeRecord(record: DebugRecord, options?: Partial<SerializationOptions>): Promise<SerializationResult>;
  deserializeRecord(data: string | Buffer): Promise<DeserializationResult<DebugRecord>>;
  serializeSession(session: DebugSession, options?: Partial<SerializationOptions>): Promise<SerializationResult>;
  deserializeSession(data: string | Buffer): Promise<DeserializationResult<DebugSession>>;
  serializeModuleRecord(
    moduleRecord: ModuleRecord,
    options?: Partial<SerializationOptions>
  ): Promise<SerializationResult>;
  deserializeModuleRecord(data: string | Buffer): Promise<DeserializationResult<ModuleRecord>>;
  calculateSize(obj: unknown): number;
  validateDataIntegrity(data: unknown): boolean;
}

/**
 * Debug数据序列化器实现
 */
export class DebugSerializerImpl implements DebugSerializer {
  private config: DebugConfig;
  private defaultOptions: SerializationOptions;

  constructor(config: DebugConfig) {
    this.config = config;
    this.defaultOptions = {
      compression: config.compressionEnabled,
      prettyPrint: false,
      maxSize: config.maxRecordSize,
      includeMetadata: true,
    };
  }

  /**
   * 序列化Debug记录
   */
  async serializeRecord(record: DebugRecord, options?: Partial<SerializationOptions>): Promise<SerializationResult> {
    const opts = { ...this.defaultOptions, ...options };

    // 验证记录完整性
    if (!this.validateRecord(record)) {
      throw new Error('Invalid debug record structure');
    }

    return this.serializeObject(record, opts);
  }

  /**
   * 反序列化Debug记录
   */
  async deserializeRecord(data: string | Buffer): Promise<DeserializationResult<DebugRecord>> {
    const result = await this.deserializeObject<DebugRecord>(data);

    // 验证反序列化后的记录
    if (!this.validateRecord(result.data)) {
      throw new Error('Deserialized debug record is invalid');
    }

    return result;
  }

  /**
   * 序列化Debug会话
   */
  async serializeSession(session: DebugSession, options?: Partial<SerializationOptions>): Promise<SerializationResult> {
    const opts = { ...this.defaultOptions, ...options };

    // 验证会话完整性
    if (!this.validateSession(session)) {
      throw new Error('Invalid debug session structure');
    }

    return this.serializeObject(session, opts);
  }

  /**
   * 反序列化Debug会话
   */
  async deserializeSession(data: string | Buffer): Promise<DeserializationResult<DebugSession>> {
    const result = await this.deserializeObject<DebugSession>(data);

    // 验证反序列化后的会话
    if (!this.validateSession(result.data)) {
      throw new Error('Deserialized debug session is invalid');
    }

    return result;
  }

  /**
   * 序列化模块记录
   */
  async serializeModuleRecord(
    moduleRecord: ModuleRecord,
    options?: Partial<SerializationOptions>
  ): Promise<SerializationResult> {
    const opts = { ...this.defaultOptions, ...options };

    // 验证模块记录完整性
    if (!this.validateModuleRecord(moduleRecord)) {
      throw new Error('Invalid module record structure');
    }

    return this.serializeObject(moduleRecord, opts);
  }

  /**
   * 反序列化模块记录
   */
  async deserializeModuleRecord(data: string | Buffer): Promise<DeserializationResult<ModuleRecord>> {
    const result = await this.deserializeObject<ModuleRecord>(data);

    // 验证反序列化后的模块记录
    if (!this.validateModuleRecord(result.data)) {
      throw new Error('Deserialized module record is invalid');
    }

    return result;
  }

  /**
   * 计算对象大小（字节）
   */
  calculateSize(obj: unknown): number {
    return Buffer.byteLength(JQJsonHandler.stringifyJson(obj, true), 'utf8');
  }

  /**
   * 验证数据完整性
   */
  validateDataIntegrity(data: unknown): boolean {
    try {
      // 检查基本结构
      if (!data || typeof data !== 'object') {
        return false;
      }

      // 检查循环引用
      JQJsonHandler.stringifyJson(data, true);

      return true;
    } catch (error) {
      return false;
    }
  }

  // ===== Private Helper Methods =====

  private async serializeObject(obj: unknown, options: SerializationOptions): Promise<SerializationResult> {
    try {
      // 预处理对象（移除循环引用等）
      const processedObj = this.preprocessObject(obj);

      // JSON序列化
      const jsonString = options.prettyPrint ? JQJsonHandler.stringifyJson(processedObj, false) : JQJsonHandler.stringifyJson(processedObj, true);

      const originalSize = Buffer.byteLength(jsonString, 'utf8');

      // 检查大小限制
      if (originalSize > options.maxSize) {
        throw new Error(`Serialized data size (${originalSize}) exceeds limit (${options.maxSize})`);
      }

      let finalData: string | Buffer = jsonString;
      let compressedSize = originalSize;
      let encoding: 'utf8' | 'gzip' = 'utf8';

      // 压缩（如果启用且有益）
      if (options.compression && originalSize > 1024) {
        // 只压缩大于1KB的数据
        const compressed = await gzip(jsonString);

        // 只有在压缩有显著效果时才使用压缩数据
        if (compressed.length < originalSize * 0.8) {
          finalData = compressed;
          compressedSize = compressed.length;
          encoding = 'gzip';
        }
      }

      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      return {
        data: finalData,
        originalSize,
        compressedSize,
        compressionRatio,
        metadata: {
          compressed: encoding === 'gzip',
          encoding,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      throw new Error(`Serialization failed: ${error.message}`);
    }
  }

  private async deserializeObject<T>(data: string | Buffer): Promise<DeserializationResult<T>> {
    try {
      let jsonString: string;
      let wasCompressed = false;
      let originalSize: number;

      if (Buffer.isBuffer(data)) {
        // 尝试解压缩
        try {
          const decompressed = await gunzip(data);
          jsonString = decompressed.toString('utf8');
          wasCompressed = true;
          originalSize = decompressed.length;
        } catch {
          // 如果解压缩失败，尝试直接解析为字符串
          jsonString = data.toString('utf8');
          originalSize = data.length;
        }
      } else {
        jsonString = data;
        originalSize = Buffer.byteLength(jsonString, 'utf8');
      }

      // JSON反序列化
      const obj = JQJsonHandler.parseJsonString(jsonString) as T;

      // 后处理对象（恢复特殊类型等）
      const processedObj = this.postprocessObject<T>(obj);

      return {
        data: processedObj,
        metadata: {
          originalSize,
          wasCompressed,
          timestamp: Date.now(),
        },
      };
    } catch (error: any) {
      throw new Error(`Deserialization failed: ${error.message}`);
    }
  }

  private preprocessObject(obj: unknown): unknown {
    const seen = new WeakSet<object>();

    const process = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object') {
        return value;
      }

      // 检查循环引用
      if (seen.has(value as object)) {
        return '[Circular Reference]';
      }
      seen.add(value as object);

      // 处理Date对象
      if (value instanceof Date) {
        return {
          __type: 'Date',
          __value: value.toISOString(),
        };
      }

      // 处理Error对象
      if (value instanceof Error) {
        return {
          __type: 'Error',
          __value: {
            name: value.name,
            message: value.message,
            stack: value.stack,
          },
        };
      }

      // 处理数组
      if (Array.isArray(value)) {
        return value.map(process);
      }

      // 处理普通对象
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = process(val);
      }

      return result;
    };

    return process(obj);
  }

  private postprocessObject<T>(obj: T): T {
    const process = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object') {
        return value;
      }

      // 类型转换以访问属性
      const objValue = value as Record<string, unknown>;

      // 恢复特殊类型
      if (objValue.__type === 'Date' && objValue.__value) {
        return new Date(objValue.__value as string) as unknown as T;
      }

      if (objValue.__type === 'Error' && objValue.__value) {
        const errorObj = objValue.__value as Record<string, unknown>;
        const error = new Error(errorObj.message as string);
        error.name = errorObj.name as string;
        error.stack = errorObj.stack as string;
        return error as unknown as T;
      }

      // 处理数组
      if (Array.isArray(value)) {
        return value.map(process) as unknown as T;
      }

      // 处理普通对象
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = process(val);
      }

      return result as unknown as T;
    };

    return process(obj) as T;
  }

  private validateRecord(record: DebugRecord): boolean {
    return Boolean(
      record &&
        record.requestId &&
        record.timestamp &&
        record.sessionId &&
        record.request &&
        typeof record.port === 'number'
    );
  }

  private validateSession(session: DebugSession): boolean {
    return Boolean(
      session &&
        session.sessionId &&
        session.startTime &&
        typeof session.port === 'number' &&
        typeof session.requestCount === 'number'
    );
  }

  private validateModuleRecord(moduleRecord: ModuleRecord): boolean {
    return Boolean(moduleRecord && moduleRecord.moduleName && moduleRecord.startTime && moduleRecord.metadata);
  }
}
