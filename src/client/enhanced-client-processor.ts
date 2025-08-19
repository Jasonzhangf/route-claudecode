/**
 * 增强型客户端处理器
 *
 * 集成了所有验收标准要求的功能：
 * 1. 完整的请求模拟能力
 * 2. 严格的输入输出验证
 * 3. 按端口的debug数据记录
 * 4. 完整的错误处理和记录
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

import { EventEmitter } from 'events';
import { ClientInputValidator, InputValidationError, ValidateInput } from './validation/input-validator';
import { ClientOutputValidator } from './validation/output-validator';
import { PortBasedDebugRecorder } from './debug/port-based-recorder';
import { ErrorHandler } from '../middleware/error-handler';
import { DebugManager, DebugManagerImpl } from '../debug/debug-manager';
import { ClaudeCodeRequest, ClaudeCodeResponse } from './schemas/claude-code-schemas';

/**
 * 处理结果接口
 */
export interface ProcessingResult {
  success: boolean;
  requestId: string;
  input?: ClaudeCodeRequest;
  output?: ClaudeCodeResponse;
  error?: Error;
  processingTime: number;
  validationStats: {
    inputValidation: { success: boolean; processingTime: number; errors?: string[] };
    outputValidation: { success: boolean; processingTime: number; errors?: string[] };
  };
  debugInfo: {
    port: number;
    recorded: boolean;
    recordPath?: string;
  };
}

/**
 * 处理器配置
 */
export interface ClientProcessorConfig {
  port: number;
  debugEnabled: boolean;
  debugDir?: string;
  strictValidation: boolean;
  recordAllRequests: boolean;
  maxProcessingTime?: number;
}

/**
 * 增强型客户端处理器
 *
 * 满足所有验收标准的完整实现
 */
export class EnhancedClientProcessor extends EventEmitter {
  private inputValidator: ClientInputValidator;
  private outputValidator: ClientOutputValidator;
  private debugRecorder: PortBasedDebugRecorder;
  private errorHandler: ErrorHandler;
  private debugManager: DebugManager;
  private config: ClientProcessorConfig;
  private processingStats: Map<string, number> = new Map();

  constructor(config: ClientProcessorConfig) {
    super();
    this.config = config;

    // 初始化核心组件
    this.errorHandler = new ErrorHandler();
    this.debugManager = new DebugManagerImpl();
    this.inputValidator = new ClientInputValidator(this.errorHandler, this.debugManager);
    this.outputValidator = new ClientOutputValidator(this.errorHandler, this.debugManager);
    this.debugRecorder = new PortBasedDebugRecorder(
      config.debugDir || './debug-logs',
      1000,
      24 * 60 * 60 * 1000 // 24小时
    );

    // 设置错误监听
    this.setupErrorHandling();
  }

  /**
   * 处理Claude Code请求 - 满足所有验收标准
   *
   * 验收标准1: 通过单元测试模拟
   * 验收标准2: 输入阶段字段验证和详细错误处理
   * 验收标准3: 按端口保存debug数据
   * 验收标准4: 输出字段校验
   */
  @ValidateInput('claude_code_request')
  // @ValidateOutput('claude_code_response') // 注释掉不存在的装饰器
  async processClaudeCodeRequest(request: any, requestId?: string, metadata?: any): Promise<ProcessingResult> {
    const startTime = Date.now();
    const actualRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 初始化结果对象
    const result: ProcessingResult = {
      success: false,
      requestId: actualRequestId,
      processingTime: 0,
      validationStats: {
        inputValidation: { success: false, processingTime: 0 },
        outputValidation: { success: false, processingTime: 0 },
      },
      debugInfo: {
        port: this.config.port,
        recorded: false,
      },
    };

    try {
      // 触发处理开始事件
      this.emit('processing_start', { requestId: actualRequestId, port: this.config.port });

      // 阶段1: 记录请求开始 (验收标准3)
      if (this.config.recordAllRequests) {
        this.debugRecorder.recordRequestStart(this.config.port, actualRequestId, request, {
          ...metadata,
          userAgent: metadata?.userAgent || 'RCC-Client/4.0.0',
          clientIP: metadata?.clientIP || '127.0.0.1',
          timestamp: new Date().toISOString(),
        });
        result.debugInfo.recorded = true;
      }

      // 阶段2: 输入验证 (验收标准2)
      const inputValidationStart = Date.now();
      try {
        const validatedInput = this.inputValidator.validateClaudeCodeRequest(request, actualRequestId);
        result.input = validatedInput;
        result.validationStats.inputValidation = {
          success: true,
          processingTime: Date.now() - inputValidationStart,
        };

        this.emit('input_validation_success', {
          requestId: actualRequestId,
          processingTime: result.validationStats.inputValidation.processingTime,
        });
      } catch (inputError) {
        result.validationStats.inputValidation = {
          success: false,
          processingTime: Date.now() - inputValidationStart,
          errors: [inputError.message],
        };

        // 输入验证失败立即抛出详细错误 (验收标准2)
        this.emit('input_validation_error', {
          requestId: actualRequestId,
          error: inputError,
          details: (inputError as InputValidationError).details,
        });

        throw inputError;
      }

      // 阶段3: 业务处理 (这里模拟实际的API调用)
      const response = await this.simulateApiCall(result.input!, actualRequestId);

      // 阶段4: 输出验证 (验收标准4)
      const outputValidationStart = Date.now();
      try {
        const validatedOutput = this.outputValidator.validateClaudeCodeResponse(response, actualRequestId);
        result.output = validatedOutput;
        result.validationStats.outputValidation = {
          success: true,
          processingTime: Date.now() - outputValidationStart,
        };

        this.emit('output_validation_success', {
          requestId: actualRequestId,
          processingTime: result.validationStats.outputValidation.processingTime,
        });
      } catch (outputError) {
        result.validationStats.outputValidation = {
          success: false,
          processingTime: Date.now() - outputValidationStart,
          errors: [outputError.message],
        };

        this.emit('output_validation_error', {
          requestId: actualRequestId,
          error: outputError,
          details: (outputError as any).details,
        });

        throw outputError;
      }

      // 处理成功
      result.success = true;
      result.processingTime = Date.now() - startTime;

      // 记录成功处理 (验收标准3)
      if (this.config.recordAllRequests) {
        this.debugRecorder.recordRequestSuccess(
          this.config.port,
          actualRequestId,
          result.output,
          result.processingTime,
          result.validationStats.inputValidation,
          result.validationStats.outputValidation
        );
      }

      // 更新统计信息
      this.updateProcessingStats('success', result.processingTime);

      this.emit('processing_success', result);
      return result;
    } catch (error) {
      // 处理失败
      result.success = false;
      result.error = error as Error;
      result.processingTime = Date.now() - startTime;

      // 记录失败处理 (验收标准3)
      if (this.config.recordAllRequests) {
        this.debugRecorder.recordRequestFailure(
          this.config.port,
          actualRequestId,
          error as Error,
          result.processingTime,
          result.validationStats.inputValidation,
          result.validationStats.outputValidation
        );
      }

      // 更新统计信息
      this.updateProcessingStats('failure', result.processingTime);

      this.emit('processing_error', result);

      // 重新抛出错误以确保零静默失败
      throw error;
    }
  }

  /**
   * 模拟API调用 - 支持单元测试 (验收标准1)
   */
  private async simulateApiCall(request: ClaudeCodeRequest, requestId: string): Promise<ClaudeCodeResponse> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    // 生成模拟响应
    const response: ClaudeCodeResponse = {
      id: `msg_${requestId}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: this.generateMockResponseText(request),
        },
      ],
      model: request.model,
      stop_reason: 'end_turn',
      usage: {
        input_tokens: this.estimateTokens(JSON.stringify(request.messages)),
        output_tokens: this.estimateTokens('mock response text'),
      },
    };

    return response;
  }

  /**
   * 生成模拟响应文本
   */
  private generateMockResponseText(request: ClaudeCodeRequest): string {
    const lastMessage = request.messages[request.messages.length - 1];
    const userContent = typeof lastMessage.content === 'string' ? lastMessage.content : 'complex content';

    return `I understand you're asking about: "${userContent}". This is a mock response generated by the Enhanced Client Processor for testing purposes. Model: ${request.model}, Max tokens: ${request.max_tokens}.`;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 获取处理器状态和统计信息
   */
  getProcessorStatus(): {
    config: ClientProcessorConfig;
    stats: Record<string, number>;
    portStats: any;
    validationStats: {
      input: Record<string, number>;
      output: Record<string, number>;
    };
  } {
    return {
      config: this.config,
      stats: Object.fromEntries(this.processingStats),
      portStats: this.debugRecorder.getPortStats(this.config.port),
      validationStats: {
        input: this.inputValidator.getValidationStats(),
        output: this.outputValidator.getValidationStats(),
      },
    };
  }

  /**
   * 验证记录的数据 (验收标准3)
   */
  validateRecordedData(validationRules?: any): {
    valid: boolean;
    errors: string[];
    stats: { totalRecords: number; validRecords: number; invalidRecords: number };
  } {
    return this.debugRecorder.validateRecordedData(this.config.port, validationRules);
  }

  /**
   * 获取端口记录 (验收标准3)
   */
  getPortRecords(limit?: number): any[] {
    return this.debugRecorder.getPortRecords(this.config.port, limit);
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.processingStats.clear();
    this.inputValidator.resetValidationStats();
    this.outputValidator.resetValidationStats();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 监听验证错误
    this.on('input_validation_error', data => {
      console.error(`❌ Input validation failed for request ${data.requestId}:`, data.details);
    });

    this.on('output_validation_error', data => {
      console.error(`❌ Output validation failed for request ${data.requestId}:`, data.details);
    });

    // 监听处理错误
    this.on('processing_error', result => {
      console.error(`❌ Processing failed for request ${result.requestId}:`, result.error?.message);
    });
  }

  /**
   * 更新处理统计
   */
  private updateProcessingStats(type: 'success' | 'failure', processingTime: number): void {
    // 更新总体统计
    const totalKey = `total_${type}`;
    this.processingStats.set(totalKey, (this.processingStats.get(totalKey) || 0) + 1);

    // 更新平均处理时间
    const timeKey = `avg_processing_time_${type}`;
    const currentAvg = this.processingStats.get(timeKey) || 0;
    const count = this.processingStats.get(totalKey) || 1;
    const newAvg = (currentAvg * (count - 1) + processingTime) / count;
    this.processingStats.set(timeKey, newAvg);

    // 更新最大处理时间
    const maxKey = `max_processing_time_${type}`;
    const currentMax = this.processingStats.get(maxKey) || 0;
    this.processingStats.set(maxKey, Math.max(currentMax, processingTime));
  }

  /**
   * 销毁处理器，清理资源
   */
  destroy(): void {
    this.debugRecorder.destroy();
    this.removeAllListeners();
    this.processingStats.clear();
  }
}

/**
 * 创建增强型客户端处理器的工厂函数
 */
export function createEnhancedClientProcessor(config: Partial<ClientProcessorConfig> = {}): EnhancedClientProcessor {
  const defaultConfig: ClientProcessorConfig = {
    port: 5506,
    debugEnabled: true,
    debugDir: './debug-logs',
    strictValidation: true,
    recordAllRequests: true,
    maxProcessingTime: 30000,
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new EnhancedClientProcessor(finalConfig);
}

/**
 * 导出验证相关的错误类型，便于外部使用
 */
export { InputValidationError, ValidateInput } from './validation/input-validator';

export { ClientOutputValidator } from './validation/output-validator';
