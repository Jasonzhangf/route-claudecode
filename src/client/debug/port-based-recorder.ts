/**
 * 按端口分组的Debug数据记录器
 *
 * 将所有请求和响应数据按端口保存，便于调试和验证
 * 支持实际数据验证和早期漏洞发现
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataValidator } from '../../utils/data-validator';
import { DEBUG_RECORD_SCHEMA } from '../schemas/claude-code-schemas';
import { InputValidationError } from '../validation/input-validator';
import { OutputValidationError } from '../validation/output-validator';

/**
 * Debug记录数据结构
 */
export interface DebugRecord {
  timestamp: string;
  port: number;
  requestId: string;
  input?: any;
  output?: any;
  processingTime?: number;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
    details?: any;
  };
  validation?: {
    inputValidation?: {
      success: boolean;
      errors?: any[];
      processingTime?: number;
    };
    outputValidation?: {
      success: boolean;
      errors?: any[];
      processingTime?: number;
    };
  };
  metadata?: {
    userAgent?: string;
    clientIP?: string;
    sessionId?: string;
    conversationId?: string;
  };
}

/**
 * 端口统计信息
 */
export interface PortStats {
  port: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  inputValidationErrors: number;
  outputValidationErrors: number;
  averageProcessingTime: number;
  firstRequestTime: string;
  lastRequestTime: string;
  diskUsage: number; // bytes
}

/**
 * 按端口分组的Debug记录器
 */
export class PortBasedDebugRecorder {
  private baseDebugDir: string;
  private maxRecordsPerFile: number;
  private maxFileAge: number; // 毫秒
  private portStats: Map<number, PortStats> = new Map();
  private currentFileHandles: Map<number, fs.WriteStream> = new Map();

  constructor(
    baseDebugDir: string = './debug-logs',
    maxRecordsPerFile: number = 1000,
    maxFileAge: number = 24 * 60 * 60 * 1000 // 24小时
  ) {
    this.baseDebugDir = baseDebugDir;
    this.maxRecordsPerFile = maxRecordsPerFile;
    this.maxFileAge = maxFileAge;

    // 确保基础目录存在
    this.ensureDirectoryExists(baseDebugDir);

    // 启动清理任务
    this.startCleanupTask();
  }

  /**
   * 记录请求开始
   */
  recordRequestStart(port: number, requestId: string, input: any, metadata?: any): void {
    const record: DebugRecord = {
      timestamp: new Date().toISOString(),
      port,
      requestId,
      input,
      metadata,
    };

    this.writeRecord(port, record);
    this.updatePortStats(port, 'request_start');
  }

  /**
   * 记录请求成功完成
   */
  recordRequestSuccess(
    port: number,
    requestId: string,
    output: any,
    processingTime: number,
    inputValidation?: any,
    outputValidation?: any
  ): void {
    const record: DebugRecord = {
      timestamp: new Date().toISOString(),
      port,
      requestId,
      output,
      processingTime,
      validation: {
        inputValidation,
        outputValidation,
      },
    };

    this.writeRecord(port, record);
    this.updatePortStats(port, 'request_success', processingTime);
  }

  /**
   * 记录请求失败
   */
  recordRequestFailure(
    port: number,
    requestId: string,
    error: Error,
    processingTime?: number,
    inputValidation?: any,
    outputValidation?: any
  ): void {
    const record: DebugRecord = {
      timestamp: new Date().toISOString(),
      port,
      requestId,
      processingTime,
      error: {
        name: error.constructor.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
        details: (error as any).details,
      },
      validation: {
        inputValidation,
        outputValidation,
      },
    };

    this.writeRecord(port, record);
    this.updatePortStats(port, 'request_failure', processingTime);

    // 如果是验证错误，更新相应统计
    if (error instanceof InputValidationError) {
      this.updatePortStats(port, 'input_validation_error');
    } else if (error instanceof OutputValidationError) {
      this.updatePortStats(port, 'output_validation_error');
    }
  }

  /**
   * 记录完整的请求-响应对
   */
  recordCompleteTransaction(
    port: number,
    requestId: string,
    input: any,
    output?: any,
    error?: Error,
    processingTime?: number,
    metadata?: any
  ): void {
    const record: DebugRecord = {
      timestamp: new Date().toISOString(),
      port,
      requestId,
      input,
      output,
      processingTime,
      metadata,
    };

    if (error) {
      record.error = {
        name: error.constructor.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
        details: (error as any).details,
      };
    }

    // 验证记录数据
    const validationResult = DataValidator.validate(record, DEBUG_RECORD_SCHEMA);
    if (!validationResult.isValid) {
      console.warn('Debug record validation failed:', validationResult.errors);
      // 继续记录，但添加验证错误信息
      record.metadata = {
        ...record.metadata,
        validationErrors: validationResult.errors,
      } as any;
    }

    this.writeRecord(port, record);

    if (error) {
      this.updatePortStats(port, 'request_failure', processingTime);
    } else {
      this.updatePortStats(port, 'request_success', processingTime);
    }
  }

  /**
   * 根据实际数据进行验证
   */
  validateRecordedData(
    port: number,
    validationRules?: any
  ): {
    valid: boolean;
    errors: string[];
    stats: {
      totalRecords: number;
      validRecords: number;
      invalidRecords: number;
    };
  } {
    const portDir = this.getPortDirectory(port);
    const errors: string[] = [];
    let totalRecords = 0;
    let validRecords = 0;
    let invalidRecords = 0;

    try {
      const files = fs.readdirSync(portDir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        const filePath = path.join(portDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (let i = 0; i < lines.length; i++) {
          totalRecords++;

          try {
            const record = JSON.parse(lines[i]) as DebugRecord;

            // 基础结构验证
            const structureValidation = DataValidator.validate(record, DEBUG_RECORD_SCHEMA);
            if (!structureValidation.isValid) {
              invalidRecords++;
              errors.push(`${file}:${i + 1} - Structure validation failed: ${structureValidation.errors.join(', ')}`);
              continue;
            }

            // 如果有输入数据，验证输入格式
            if (record.input) {
              try {
                // 这里可以添加具体的输入验证逻辑
                validRecords++;
              } catch (inputError) {
                invalidRecords++;
                errors.push(`${file}:${i + 1} - Input validation failed: ${inputError.message}`);
              }
            }

            // 如果有输出数据，验证输出格式
            if (record.output) {
              try {
                // 这里可以添加具体的输出验证逻辑
                validRecords++;
              } catch (outputError) {
                invalidRecords++;
                errors.push(`${file}:${i + 1} - Output validation failed: ${outputError.message}`);
              }
            }

            // 自定义验证规则
            if (validationRules) {
              try {
                this.applyCustomValidation(record, validationRules);
                validRecords++;
              } catch (customError) {
                invalidRecords++;
                errors.push(`${file}:${i + 1} - Custom validation failed: ${customError.message}`);
              }
            }
          } catch (parseError) {
            invalidRecords++;
            errors.push(`${file}:${i + 1} - JSON parse error: ${parseError.message}`);
          }
        }
      }
    } catch (dirError) {
      errors.push(`Directory read error: ${dirError.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      stats: {
        totalRecords,
        validRecords,
        invalidRecords,
      },
    };
  }

  /**
   * 获取端口统计信息
   */
  getPortStats(port: number): PortStats | null {
    return this.portStats.get(port) || null;
  }

  /**
   * 获取所有端口统计信息
   */
  getAllPortStats(): PortStats[] {
    return Array.from(this.portStats.values());
  }

  /**
   * 获取端口的所有记录
   */
  getPortRecords(port: number, limit?: number): DebugRecord[] {
    const portDir = this.getPortDirectory(port);
    const records: DebugRecord[] = [];

    try {
      const files = fs
        .readdirSync(portDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort()
        .reverse(); // 最新的文件在前

      for (const file of files) {
        if (limit && records.length >= limit) break;

        const filePath = path.join(portDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines.reverse()) {
          // 最新的记录在前
          if (limit && records.length >= limit) break;

          try {
            const record = JSON.parse(line) as DebugRecord;
            records.push(record);
          } catch (parseError) {
            console.warn(`Failed to parse debug record: ${parseError.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read port records: ${error.message}`);
    }

    return records;
  }

  /**
   * 清理旧的debug文件
   */
  cleanupOldFiles(): void {
    const cutoffTime = Date.now() - this.maxFileAge;

    try {
      const portDirs = fs
        .readdirSync(this.baseDebugDir)
        .filter(dir => dir.startsWith('port-') && fs.statSync(path.join(this.baseDebugDir, dir)).isDirectory());

      for (const portDir of portDirs) {
        const portPath = path.join(this.baseDebugDir, portDir);
        const files = fs.readdirSync(portPath);

        for (const file of files) {
          const filePath = path.join(portPath, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old debug file: ${filePath}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup old debug files: ${error.message}`);
    }
  }

  /**
   * 写入记录到文件
   */
  private writeRecord(port: number, record: DebugRecord): void {
    const portDir = this.getPortDirectory(port);
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${timestamp}.jsonl`;
    const filePath = path.join(portDir, fileName);

    try {
      // 追加模式写入JSONL格式
      const recordLine = JSON.stringify(record) + '\n';
      fs.appendFileSync(filePath, recordLine, 'utf8');
    } catch (error) {
      console.error(`Failed to write debug record for port ${port}:`, error.message);
    }
  }

  /**
   * 获取端口目录
   */
  private getPortDirectory(port: number): string {
    const portDir = path.join(this.baseDebugDir, `port-${port}`);
    this.ensureDirectoryExists(portDir);
    return portDir;
  }

  /**
   * 确保目录存在
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 更新端口统计
   */
  private updatePortStats(
    port: number,
    operation:
      | 'request_start'
      | 'request_success'
      | 'request_failure'
      | 'input_validation_error'
      | 'output_validation_error',
    processingTime?: number
  ): void {
    let stats = this.portStats.get(port);

    if (!stats) {
      stats = {
        port,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        inputValidationErrors: 0,
        outputValidationErrors: 0,
        averageProcessingTime: 0,
        firstRequestTime: new Date().toISOString(),
        lastRequestTime: new Date().toISOString(),
        diskUsage: 0,
      };
      this.portStats.set(port, stats);
    }

    switch (operation) {
      case 'request_start':
        stats.totalRequests++;
        stats.lastRequestTime = new Date().toISOString();
        break;

      case 'request_success':
        stats.successfulRequests++;
        if (processingTime) {
          stats.averageProcessingTime =
            (stats.averageProcessingTime * (stats.successfulRequests - 1) + processingTime) / stats.successfulRequests;
        }
        break;

      case 'request_failure':
        stats.failedRequests++;
        break;

      case 'input_validation_error':
        stats.inputValidationErrors++;
        break;

      case 'output_validation_error':
        stats.outputValidationErrors++;
        break;
    }

    // 更新磁盘使用量
    this.updateDiskUsage(port, stats);
  }

  /**
   * 更新磁盘使用量
   */
  private updateDiskUsage(port: number, stats: PortStats): void {
    try {
      const portDir = this.getPortDirectory(port);
      const files = fs.readdirSync(portDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(portDir, file);
        const fileStats = fs.statSync(filePath);
        totalSize += fileStats.size;
      }

      stats.diskUsage = totalSize;
    } catch (error) {
      console.warn(`Failed to calculate disk usage for port ${port}: ${error.message}`);
    }
  }

  /**
   * 应用自定义验证规则
   */
  private applyCustomValidation(record: DebugRecord, validationRules: any): void {
    // 这里可以实现自定义的验证逻辑
    // 例如检查特定字段的值、格式、业务逻辑等

    if (validationRules.requireInput && !record.input) {
      throw new Error('Input data is required but missing');
    }

    if (validationRules.requireOutput && !record.output && !record.error) {
      throw new Error('Output data is required but missing (and no error occurred)');
    }

    if (
      validationRules.maxProcessingTime &&
      record.processingTime &&
      record.processingTime > validationRules.maxProcessingTime
    ) {
      throw new Error(
        `Processing time ${record.processingTime}ms exceeds maximum ${validationRules.maxProcessingTime}ms`
      );
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每小时执行一次清理
    setInterval(
      () => {
        this.cleanupOldFiles();
      },
      60 * 60 * 1000
    );
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 关闭所有文件句柄
    for (const [port, handle] of this.currentFileHandles) {
      try {
        handle.end();
      } catch (error) {
        console.warn(`Failed to close file handle for port ${port}: ${error.message}`);
      }
    }

    this.currentFileHandles.clear();
    this.portStats.clear();
  }
}
