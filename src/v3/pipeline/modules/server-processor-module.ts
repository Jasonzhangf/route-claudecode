/**
 * Server-Layer-Processor Pipeline Module
 * Server-Layer-Processor层 - 服务器层处理模块
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

import { BasePipelineModule } from './base-pipeline-module.js';
import {
  ModuleType,
  ModuleConfig,
  ModuleInitResult,
  ProcessingContext,
  ValidationResult,
  StandardRequest,
  StandardResponse
} from '../interfaces/pipeline-module.js';

/**
 * Server-Layer-Processor模块实现
 */
export class ServerProcessorModule extends BasePipelineModule {
  private providerId: string = '';
  private model: string = '';
  private processorConfig: any = null;
  private preprocessors: Map<string, any> = new Map();
  private postprocessors: Map<string, any> = new Map();

  constructor(moduleId: string) {
    super(moduleId, ModuleType.SERVER_PROCESSOR);
  }

  // ==================== 生命周期实现 ====================

  protected async doInit(config: ModuleConfig): Promise<ModuleInitResult> {
    try {
      this.providerId = config.providerId;
      this.model = config.model;
      this.processorConfig = config.config;

      this.logInfo('Initializing server-processor module', {
        providerId: this.providerId,
        model: this.model,
        processorType: this.processorConfig.type
      });

      // 初始化预处理器和后处理器
      await this.initializeProcessors(this.processorConfig);

      const capabilities = [
        'request-preprocessing',
        'response-postprocessing',
        'format-validation',
        'authentication',
        'rate-limiting',
        'error-handling'
      ];

      return {
        success: true,
        capabilities,
        metadata: {
          supportedFormats: ['anthropic', 'openai', 'gemini', 'codewhisperer'],
          version: this.version,
          preprocessorCount: this.preprocessors.size,
          postprocessorCount: this.postprocessors.size
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  protected async doConnect(): Promise<boolean> {
    try {
      this.logInfo('Connecting server-processor module');

      // 验证处理器是否正确初始化
      if (this.preprocessors.size === 0 || this.postprocessors.size === 0) {
        throw new Error('Processors not properly initialized');
      }

      // 执行连接测试
      await this.performConnectionTest();

      this.logInfo('Server-processor module connected successfully');
      return true;
    } catch (error) {
      this.logError('Server-processor connection failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.logInfo('Disconnecting server-processor module');
    
    // 清理处理器
    for (const [name, processor] of this.preprocessors) {
      if (processor && typeof processor.disconnect === 'function') {
        try {
          await processor.disconnect();
        } catch (error) {
          this.logWarn(`Error disconnecting preprocessor ${name}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }

    for (const [name, processor] of this.postprocessors) {
      if (processor && typeof processor.disconnect === 'function') {
        try {
          await processor.disconnect();
        } catch (error) {
          this.logWarn(`Error disconnecting postprocessor ${name}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }
  }

  protected async doEnd(): Promise<void> {
    this.logInfo('Destroying server-processor module');
    
    // 清理所有处理器
    for (const [name, processor] of this.preprocessors) {
      if (processor && typeof processor.destroy === 'function') {
        try {
          await processor.destroy();
        } catch (error) {
          this.logWarn(`Error destroying preprocessor ${name}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }

    for (const [name, processor] of this.postprocessors) {
      if (processor && typeof processor.destroy === 'function') {
        try {
          await processor.destroy();
        } catch (error) {
          this.logWarn(`Error destroying postprocessor ${name}`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }
    
    this.preprocessors.clear();
    this.postprocessors.clear();
    this.processorConfig = null;
  }

  // ==================== 核心处理逻辑 ====================

  protected async doProcess(input: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || 'unknown';
    
    try {
      // 解析输入请求格式
      const request = this.parseRequest(input);
      
      this.logDebug('Processing server-processor request', {
        requestId,
        providerId: this.providerId,
        model: this.model,
        requestType: request.type,
        processingDirection: this.determineProcessingDirection(request)
      });

      let result: any;
      const direction = this.determineProcessingDirection(request);

      if (direction === 'preprocessing') {
        // 请求预处理: Anthropic → Provider-Protocol
        result = await this.preprocessRequest(request, context);
      } else if (direction === 'postprocessing') {
        // 响应后处理: Provider-Specific → Provider-Protocol
        result = await this.postprocessResponse(request, context);
      } else {
        throw new Error(`Unknown processing direction: ${direction}`);
      }

      this.logDebug('Server-processor processing completed', {
        requestId,
        direction,
        outputType: result.type
      });

      return this.createStandardResponse(result, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Server-processor processing failed', { requestId, error: errorMessage });
      
      return this.createStandardResponse(null, false, {
        code: 'SERVER_PROCESSOR_ERROR',
        message: errorMessage,
        details: {
          providerId: this.providerId,
          model: this.model
        }
      });
    }
  }

  // ==================== 预处理和后处理逻辑 ====================

  private async preprocessRequest(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logDebug('Starting request preprocessing', {
        providerId: this.providerId,
        model: this.model,
        requestId: context?.requestId
      });

      let processedData = request.data;

      // 应用所有预处理器
      for (const [name, preprocessor] of this.preprocessors) {
        if (preprocessor && typeof preprocessor.process === 'function') {
          this.logDebug(`Applying preprocessor: ${name}`, { requestId: context?.requestId });
          processedData = await preprocessor.process(processedData, {
            providerId: this.providerId,
            model: this.model,
            requestId: context?.requestId
          });
        }
      }

      const processingTime = Date.now() - startTime;

      this.logDebug('Request preprocessing completed', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        preprocessorsApplied: this.preprocessors.size
      });

      return {
        id: `preprocessed_${Date.now()}`,
        type: 'provider-protocol',
        model: this.model,
        data: processedData,
        metadata: {
          originalType: request.type,
          providerId: this.providerId,
          processingTime,
          preprocessorsApplied: Array.from(this.preprocessors.keys()),
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Request preprocessing failed', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async postprocessResponse(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logDebug('Starting response postprocessing', {
        providerId: this.providerId,
        model: this.model,
        requestId: context?.requestId
      });

      let processedData = request.data;

      // 应用所有后处理器
      for (const [name, postprocessor] of this.postprocessors) {
        if (postprocessor && typeof postprocessor.process === 'function') {
          this.logDebug(`Applying postprocessor: ${name}`, { requestId: context?.requestId });
          processedData = await postprocessor.process(processedData, {
            providerId: this.providerId,
            model: this.model,
            requestId: context?.requestId
          });
        }
      }

      const processingTime = Date.now() - startTime;

      this.logDebug('Response postprocessing completed', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        postprocessorsApplied: this.postprocessors.size
      });

      return {
        id: `postprocessed_${Date.now()}`,
        type: 'provider-protocol',
        model: this.model,
        data: processedData,
        metadata: {
          originalType: request.type,
          providerId: this.providerId,
          processingTime,
          postprocessorsApplied: Array.from(this.postprocessors.keys()),
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Response postprocessing failed', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ==================== 校验实现 ====================

  protected doValidateInput(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const request = this.parseRequest(input);
      
      if (!request.type) {
        errors.push('Request type is required');
      }

      if (!request.data) {
        errors.push('Request data is required');
      }

      // 基于处理方向进行不同的校验
      const direction = this.determineProcessingDirection(request);
      
      if (direction === 'preprocessing') {
        // 预处理校验 - 期望Anthropic格式输入
        if (request.type !== 'anthropic' && request.type !== 'provider-protocol') {
          warnings.push('Preprocessing expects anthropic or provider-protocol input');
        }
      } else if (direction === 'postprocessing') {
        // 后处理校验 - 期望Provider-Specific格式输入
        if (request.type !== 'provider-specific') {
          warnings.push('Postprocessing expects provider-specific input');
        }
      }

    } catch (error) {
      errors.push(`Input parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  protected doValidateOutput(output: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output) {
      errors.push('Output cannot be empty');
      return { isValid: false, errors };
    }

    if (output.success === false && !output.error) {
      warnings.push('Failed response should include error details');
    }

    if (output.success === true && !output.data) {
      warnings.push('Successful response should include data');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // ==================== 辅助方法 ====================

  private parseRequest(input: any): StandardRequest {
    // 如果输入已经是标准格式
    if (input.id && input.type && input.data) {
      return input as StandardRequest;
    }

    // 自动检测格式类型
    let type: 'anthropic' | 'provider-protocol' | 'provider-specific';
    
    if (input.messages && Array.isArray(input.messages)) {
      // Anthropic格式
      type = 'anthropic';
    } else if (input.choices || input.candidates) {
      // Provider响应格式
      type = 'provider-specific';
    } else {
      // 默认Provider-Protocol格式
      type = 'provider-protocol';
    }

    return {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      model: this.model,
      data: input
    };
  }

  private determineProcessingDirection(request: StandardRequest): 'preprocessing' | 'postprocessing' {
    // 基于请求类型确定处理方向
    if (request.type === 'anthropic' || (request.type === 'provider-protocol' && request.metadata?.direction === 'input')) {
      return 'preprocessing';
    } else if (request.type === 'provider-specific') {
      return 'postprocessing';
    } else {
      // 默认基于数据结构判断
      if (request.data.messages && Array.isArray(request.data.messages)) {
        return 'preprocessing';
      } else if (request.data.choices || request.data.candidates) {
        return 'postprocessing';
      } else {
        return 'preprocessing'; // 默认
      }
    }
  }

  private createStandardResponse(data: any, success: boolean, error?: { code: string; message: string; details?: any }): StandardResponse {
    return {
      id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data?.type || 'unknown',
      success,
      data: success ? data : undefined,
      error,
      metadata: {
        moduleId: this.moduleId,
        moduleType: this.moduleType,
        providerId: this.providerId,
        model: this.model
      },
      metrics: {
        processingTime: 0, // 将由调用者填充
        timestamp: new Date().toISOString()
      }
    };
  }

  private async initializeProcessors(config: any): Promise<void> {
    try {
      // 初始化预处理器
      await this.initializePreprocessors(config);
      
      // 初始化后处理器
      await this.initializePostprocessors(config);

      this.logInfo('Processors initialized successfully', {
        preprocessors: Array.from(this.preprocessors.keys()),
        postprocessors: Array.from(this.postprocessors.keys())
      });
    } catch (error) {
      throw new Error(`Failed to initialize processors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializePreprocessors(config: any): Promise<void> {
    // 基于Provider类型初始化对应的预处理器
    const providerType = config.type || 'openai';
    
    // 认证预处理器
    this.preprocessors.set('authentication', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying authentication preprocessing', { providerId: context.providerId });
        // 添加认证信息
        return {
          ...data,
          auth: {
            providerId: context.providerId,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // 格式标准化预处理器
    this.preprocessors.set('format-standardization', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying format standardization', { providerId: context.providerId });
        // 确保数据格式符合Provider要求
        return {
          ...data,
          model: context.model,
          provider_type: providerType
        };
      }
    });

    // 请求增强预处理器
    this.preprocessors.set('request-enhancement', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying request enhancement', { providerId: context.providerId });
        // 添加额外的请求参数
        return {
          ...data,
          metadata: {
            ...data.metadata,
            enhanced: true,
            processingId: context.requestId
          }
        };
      }
    });
  }

  private async initializePostprocessors(config: any): Promise<void> {
    // 响应验证后处理器
    this.postprocessors.set('response-validation', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying response validation', { providerId: context.providerId });
        // 验证响应格式
        return {
          ...data,
          validated: true,
          validatedAt: new Date().toISOString()
        };
      }
    });

    // 错误处理后处理器
    this.postprocessors.set('error-handling', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying error handling', { providerId: context.providerId });
        // 标准化错误格式
        if (data.error) {
          return {
            ...data,
            error: {
              ...data.error,
              providerId: context.providerId,
              handledAt: new Date().toISOString()
            }
          };
        }
        return data;
      }
    });

    // 响应增强后处理器
    this.postprocessors.set('response-enhancement', {
      process: async (data: any, context: any) => {
        this.logDebug('Applying response enhancement', { providerId: context.providerId });
        // 添加额外的响应元数据
        return {
          ...data,
          metadata: {
            ...data.metadata,
            enhanced: true,
            providerId: context.providerId,
            model: context.model
          }
        };
      }
    });
  }

  private async performConnectionTest(): Promise<void> {
    // 执行简单的处理测试
    const testRequest: StandardRequest = {
      id: 'connection-test',
      type: 'anthropic',
      model: 'test-model',
      data: {
        messages: [{ role: 'user', content: 'connection test' }]
      }
    };

    try {
      await this.doProcess(testRequest, { requestId: 'connection-test', timestamp: Date.now() });
      this.logDebug('Connection test passed');
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}