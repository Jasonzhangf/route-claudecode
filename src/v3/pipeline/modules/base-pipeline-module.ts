/**
 * Base Pipeline Module
 * 流水线模块基础实现类
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

import { EventEmitter } from 'events';
import {
  PipelineModule,
  ModuleStatus,
  ModuleType,
  ModuleConfig,
  ModuleInitResult,
  ProcessingContext,
  ValidationResult,
  ModuleMetrics,
  ModuleDebugInfo,
  DebugLogEntry,
  HotSwappable
} from '../interfaces/pipeline-module.js';

/**
 * 流水线模块基础抽象类
 */
export abstract class BasePipelineModule extends EventEmitter implements PipelineModule, HotSwappable {
  public readonly moduleId: string;
  public readonly moduleType: ModuleType;
  public readonly version: string = '3.1.0';

  protected status: ModuleStatus = ModuleStatus.UNINITIALIZED;
  protected config: ModuleConfig | null = null;
  protected debugEnabled: boolean = false;
  protected debugCallback: ((data: ModuleDebugInfo) => void) | null = null;
  
  protected metrics: ModuleMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgProcessingTime: 0,
    uptime: 0
  };

  protected debugLogs: DebugLogEntry[] = [];
  protected readonly maxDebugLogs = 1000;
  private startTime: number = Date.now();
  private activeRequests = new Set<string>();

  constructor(moduleId: string, moduleType: ModuleType) {
    super();
    this.moduleId = moduleId;
    this.moduleType = moduleType;
  }

  // ==================== 生命周期方法 ====================

  public async init(config: ModuleConfig): Promise<ModuleInitResult> {
    try {
      this.logDebug('Starting module initialization', { config });
      this.status = ModuleStatus.INITIALIZING;
      this.config = config;
      this.debugEnabled = config.debugEnabled;

      // 调用子类的初始化逻辑
      const result = await this.doInit(config);
      
      if (result.success) {
        this.status = ModuleStatus.INITIALIZED;
        this.logInfo('Module initialized successfully', { moduleId: this.moduleId });
      } else {
        this.status = ModuleStatus.ERROR;
        this.logError('Module initialization failed', { error: result.error });
      }

      return result;
    } catch (error) {
      this.status = ModuleStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Module initialization exception', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  public async connect(): Promise<boolean> {
    try {
      if (this.status !== ModuleStatus.INITIALIZED) {
        throw new Error(`Cannot connect from status: ${this.status}`);
      }

      this.logDebug('Starting module connection');
      this.status = ModuleStatus.CONNECTING;

      const connected = await this.doConnect();
      
      if (connected) {
        this.status = ModuleStatus.CONNECTED;
        this.logInfo('Module connected successfully');
      } else {
        this.status = ModuleStatus.ERROR;
        this.logError('Module connection failed');
      }

      return connected;
    } catch (error) {
      this.status = ModuleStatus.ERROR;
      this.logError('Module connection exception', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.logDebug('Starting module disconnection');
      this.status = ModuleStatus.DISCONNECTING;

      // 等待活跃请求完成
      await this.waitForCompletion(5000);

      await this.doDisconnect();
      
      this.status = ModuleStatus.DISCONNECTED;
      this.logInfo('Module disconnected successfully');
    } catch (error) {
      this.status = ModuleStatus.ERROR;
      this.logError('Module disconnection exception', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  public async end(): Promise<void> {
    try {
      this.logDebug('Starting module destruction');
      
      if (this.status === ModuleStatus.CONNECTED) {
        await this.disconnect();
      }

      await this.doEnd();
      
      this.status = ModuleStatus.DESTROYED;
      this.logInfo('Module destroyed successfully');
      this.removeAllListeners();
    } catch (error) {
      this.logError('Module destruction exception', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // ==================== 核心处理方法 ====================

  public async process(input: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      if (this.status !== ModuleStatus.CONNECTED) {
        throw new Error(`Cannot process from status: ${this.status}`);
      }

      this.activeRequests.add(requestId);
      this.status = ModuleStatus.PROCESSING;
      this.metrics.totalRequests++;

      // 输入校验
      const inputValidation = this.validateInput(input);
      if (!inputValidation.isValid) {
        throw new Error(`Input validation failed: ${inputValidation.errors?.join(', ')}`);
      }

      this.logDebug('Processing request', { requestId, inputType: typeof input });

      // 调用子类的处理逻辑
      const result = await this.doProcess(input, context);

      // 输出校验
      const outputValidation = this.validateOutput(result);
      if (!outputValidation.isValid) {
        this.logWarn('Output validation warnings', { warnings: outputValidation.warnings });
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      this.status = ModuleStatus.CONNECTED;
      
      this.logDebug('Request processed successfully', { 
        requestId, 
        processingTime,
        outputType: typeof result 
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      this.status = ModuleStatus.CONNECTED; // 恢复连接状态
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Request processing failed', { 
        requestId, 
        error: errorMessage,
        processingTime 
      });
      
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  // ==================== 校验方法 ====================

  public validateInput(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input === null || input === undefined) {
      errors.push('Input cannot be null or undefined');
    }

    // 调用子类的具体校验逻辑
    const specificValidation = this.doValidateInput(input);
    if (specificValidation.errors) {
      errors.push(...specificValidation.errors);
    }
    if (specificValidation.warnings) {
      warnings.push(...specificValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  public validateOutput(output: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 调用子类的具体校验逻辑
    const specificValidation = this.doValidateOutput(output);
    if (specificValidation.errors) {
      errors.push(...specificValidation.errors);
    }
    if (specificValidation.warnings) {
      warnings.push(...specificValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ==================== 状态管理 ====================

  public getStatus(): ModuleStatus {
    return this.status;
  }

  public isHealthy(): boolean {
    return this.status === ModuleStatus.CONNECTED || this.status === ModuleStatus.PROCESSING;
  }

  public getMetrics(): ModuleMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      lastProcessedAt: this.metrics.totalRequests > 0 ? new Date().toISOString() : undefined
    };
  }

  // ==================== Debug支持 ====================

  public enableDebug(): void {
    this.debugEnabled = true;
    this.logInfo('Debug enabled for module');
  }

  public disableDebug(): void {
    this.debugEnabled = false;
    this.logInfo('Debug disabled for module');
  }

  public getDebugInfo(): ModuleDebugInfo {
    return {
      moduleId: this.moduleId,
      moduleType: this.moduleType,
      timestamp: new Date().toISOString(),
      status: this.status,
      metrics: {
        processingTime: this.metrics.avgProcessingTime,
        successCount: this.metrics.successfulRequests,
        errorCount: this.metrics.failedRequests,
        avgResponseTime: this.metrics.avgProcessingTime
      },
      logs: [...this.debugLogs]
    };
  }

  public onDebugData(callback: (data: ModuleDebugInfo) => void): void {
    this.debugCallback = callback;
  }

  // ==================== 热插拔支持 ====================

  public async prepareForSwap(): Promise<boolean> {
    try {
      this.logInfo('Preparing module for hot swap');
      // 停止接受新请求，但不影响正在处理的请求
      return true;
    } catch (error) {
      this.logError('Failed to prepare for swap', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public canSwapNow(): boolean {
    return this.activeRequests.size === 0;
  }

  public getActiveRequests(): string[] {
    return Array.from(this.activeRequests);
  }

  public async waitForCompletion(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.activeRequests.size === 0;
  }

  // ==================== 抽象方法 - 子类必须实现 ====================

  protected abstract doInit(config: ModuleConfig): Promise<ModuleInitResult>;
  protected abstract doConnect(): Promise<boolean>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doEnd(): Promise<void>;
  protected abstract doProcess(input: any, context?: ProcessingContext): Promise<any>;
  protected abstract doValidateInput(input: any): ValidationResult;
  protected abstract doValidateOutput(output: any): ValidationResult;

  // ==================== 私有辅助方法 ====================

  private updateMetrics(success: boolean, processingTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均处理时间
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.avgProcessingTime = Math.round(
      (this.metrics.avgProcessingTime * (totalRequests - 1) + processingTime) / totalRequests
    );
  }

  private addDebugLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any, requestId?: string): void {
    const logEntry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      requestId
    };

    this.debugLogs.push(logEntry);
    
    // 保持日志数量在限制内
    if (this.debugLogs.length > this.maxDebugLogs) {
      this.debugLogs = this.debugLogs.slice(-this.maxDebugLogs);
    }

    // 触发debug回调
    if (this.debugCallback && this.debugEnabled) {
      this.debugCallback(this.getDebugInfo());
    }

    // 发出事件
    this.emit('debug', logEntry);
  }

  protected logDebug(message: string, data?: any, requestId?: string): void {
    this.addDebugLog('debug', message, data, requestId);
  }

  protected logInfo(message: string, data?: any, requestId?: string): void {
    this.addDebugLog('info', message, data, requestId);
  }

  protected logWarn(message: string, data?: any, requestId?: string): void {
    this.addDebugLog('warn', message, data, requestId);
  }

  protected logError(message: string, data?: any, requestId?: string): void {
    this.addDebugLog('error', message, data, requestId);
  }
}