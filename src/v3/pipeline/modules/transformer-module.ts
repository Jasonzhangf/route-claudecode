/**
 * Transformer Pipeline Module
 * Anthropic ↔ Provider-Protocol 双向转换模块
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
import { transformationManager } from '../../transformer/manager.js';

/**
 * Transformer模块实现
 */
export class TransformerModule extends BasePipelineModule {
  private providerId: string = '';
  private model: string = '';
  private transformer: any = null;

  constructor(moduleId: string) {
    super(moduleId, ModuleType.TRANSFORMER);
  }

  // ==================== 生命周期实现 ====================

  protected async doInit(config: ModuleConfig): Promise<ModuleInitResult> {
    try {
      this.providerId = config.providerId;
      this.model = config.model;

      this.logInfo('Initializing transformer module', {
        providerId: this.providerId,
        model: this.model
      });

      // 初始化转换器
      this.transformer = await this.loadTransformer(config.config.type);

      const capabilities = [
        'anthropic-to-provider-protocol',
        'provider-protocol-to-anthropic',
        'bidirectional-conversion',
        'tool-call-mapping',
        'message-structure-conversion'
      ];

      return {
        success: true,
        capabilities,
        metadata: {
          supportedProviderTypes: ['openai', 'gemini', 'codewhisperer'],
          version: this.version
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
      this.logInfo('Connecting transformer module');
      
      // 验证transformer是否可用
      if (!this.transformer) {
        throw new Error('Transformer not initialized');
      }

      // 执行连接测试
      await this.performConnectionTest();

      this.logInfo('Transformer module connected successfully');
      return true;
    } catch (error) {
      this.logError('Transformer connection failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.logInfo('Disconnecting transformer module');
    // Transformer通常无需特殊断开逻辑
  }

  protected async doEnd(): Promise<void> {
    this.logInfo('Destroying transformer module');
    this.transformer = null;
  }

  // ==================== 核心处理逻辑 ====================

  protected async doProcess(input: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || 'unknown';
    
    try {
      // 解析输入请求格式
      const request = this.parseRequest(input);
      
      this.logDebug('Processing transformation request', {
        requestId,
        inputType: request.type,
        providerId: this.providerId,
        model: this.model
      });

      let result: any;

      if (request.type === 'anthropic') {
        // Anthropic → Provider-Protocol 转换
        result = await this.transformAnthropicToProviderProtocol(request, context);
      } else if (request.type === 'provider-protocol') {
        // Provider-Protocol → Anthropic 转换
        result = await this.transformProviderProtocolToAnthropic(request, context);
      } else {
        throw new Error(`Unsupported request type: ${request.type}`);
      }

      this.logDebug('Transformation completed successfully', {
        requestId,
        outputType: result.type
      });

      return this.createStandardResponse(result, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Transformation failed', { requestId, error: errorMessage });
      
      return this.createStandardResponse(null, false, {
        code: 'TRANSFORMATION_ERROR',
        message: errorMessage
      });
    }
  }

  // ==================== 转换逻辑实现 ====================

  private async transformAnthropicToProviderProtocol(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    const transformationContext = {
      provider: this.getProviderType(),
      direction: 'input' as const,
      requestId: context?.requestId,
      originalRequest: request.data
    };

    const transformedData = await transformationManager.transformInput(
      request.data,
      transformationContext
    );

    return {
      id: `transformed_${Date.now()}`,
      type: 'provider-protocol',
      model: this.model,
      data: transformedData,
      metadata: {
        originalType: 'anthropic',
        providerId: this.providerId,
        transformedAt: new Date().toISOString()
      }
    };
  }

  private async transformProviderProtocolToAnthropic(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    const transformationContext = {
      provider: this.getProviderType(),
      direction: 'output' as const,
      requestId: context?.requestId,
      originalRequest: request.metadata?.originalRequest
    };

    const transformedData = await transformationManager.transformOutput(
      request.data,
      transformationContext
    );

    return {
      id: `transformed_${Date.now()}`,
      type: 'anthropic',
      model: this.model,
      data: transformedData,
      metadata: {
        originalType: 'provider-protocol',
        providerId: this.providerId,
        transformedAt: new Date().toISOString()
      }
    };
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

      if (request.type === 'anthropic') {
        // 验证Anthropic格式
        if (!request.data.messages) {
          errors.push('Anthropic request must have messages');
        }
      } else if (request.type === 'provider-protocol') {
        // 验证Provider-Protocol格式
        if (!request.data.model) {
          warnings.push('Provider-protocol request should have model field');
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
      // 看起来像Anthropic格式
      type = 'anthropic';
    } else if (input.choices || input.model) {
      // 看起来像Provider-Protocol格式
      type = 'provider-protocol';
    } else {
      // 默认Provider-specific格式
      type = 'provider-specific';
    }

    return {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      model: this.model,
      data: input
    };
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

  private getProviderType(): string {
    // 根据providerId推断provider类型
    const providerType = this.config?.config?.type;
    if (providerType) {
      return providerType;
    }

    // 后备逻辑
    if (this.providerId.includes('openai') || this.providerId.includes('lmstudio')) {
      return 'openai';
    } else if (this.providerId.includes('gemini')) {
      return 'gemini';
    } else if (this.providerId.includes('codewhisperer')) {
      return 'codewhisperer';
    } else {
      return 'openai'; // 默认
    }
  }

  private async loadTransformer(providerType: string): Promise<any> {
    try {
      // 这里应该根据providerType加载相应的transformer
      // 目前使用现有的transformationManager
      return transformationManager;
    } catch (error) {
      throw new Error(`Failed to load transformer for ${providerType}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async performConnectionTest(): Promise<void> {
    // 执行简单的转换测试
    const testInput = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }]
    };

    try {
      const testRequest: StandardRequest = {
        id: 'test',
        type: 'anthropic',
        model: 'test-model',
        data: testInput
      };

      await this.doProcess(testRequest, { requestId: 'connection-test', timestamp: Date.now() });
      this.logDebug('Connection test passed');
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}