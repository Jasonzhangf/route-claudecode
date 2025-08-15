/**
 * Provider-Protocol Pipeline Module
 * Provider-Protocol层 - 第三方API通信模块
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
 * Provider-Protocol模块实现
 */
export class ProviderProtocolModule extends BasePipelineModule {
  private providerId: string = '';
  private model: string = '';
  private providerClient: any = null;
  private providerConfig: any = null;

  constructor(moduleId: string) {
    super(moduleId, ModuleType.PROVIDER_PROTOCOL);
  }

  // ==================== 生命周期实现 ====================

  protected async doInit(config: ModuleConfig): Promise<ModuleInitResult> {
    try {
      this.providerId = config.providerId;
      this.model = config.model;
      this.providerConfig = config.config;

      this.logInfo('Initializing provider-protocol module', {
        providerId: this.providerId,
        model: this.model,
        providerType: this.providerConfig.type
      });

      // 初始化Provider客户端
      this.providerClient = await this.createProviderClient(this.providerConfig);

      const capabilities = [
        'provider-api-communication',
        'request-forwarding', 
        'response-handling',
        'error-handling',
        'timeout-management'
      ];

      return {
        success: true,
        capabilities,
        metadata: {
          supportedProviders: ['openai', 'gemini', 'codewhisperer', 'anthropic'],
          version: this.version,
          timeout: this.providerConfig.timeout || 30000
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
      this.logInfo('Connecting provider-protocol module');

      // 验证Provider客户端是否可用
      if (!this.providerClient) {
        throw new Error('Provider client not initialized');
      }

      // 执行连接测试
      await this.performConnectionTest();

      this.logInfo('Provider-protocol module connected successfully');
      return true;
    } catch (error) {
      this.logError('Provider-protocol connection failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.logInfo('Disconnecting provider-protocol module');
    
    // 清理连接
    if (this.providerClient && typeof this.providerClient.disconnect === 'function') {
      try {
        await this.providerClient.disconnect();
      } catch (error) {
        this.logWarn('Error during provider client disconnection', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  protected async doEnd(): Promise<void> {
    this.logInfo('Destroying provider-protocol module');
    
    // 清理资源
    if (this.providerClient && typeof this.providerClient.destroy === 'function') {
      try {
        await this.providerClient.destroy();
      } catch (error) {
        this.logWarn('Error during provider client destruction', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    this.providerClient = null;
    this.providerConfig = null;
  }

  // ==================== 核心处理逻辑 ====================

  protected async doProcess(input: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || 'unknown';
    
    try {
      // 解析输入请求格式
      const request = this.parseRequest(input);
      
      this.logDebug('Processing provider-protocol request', {
        requestId,
        providerId: this.providerId,
        model: this.model,
        requestType: request.type
      });

      let result: any;

      if (request.type === 'provider-protocol') {
        // 发送到第三方Provider
        result = await this.sendToProvider(request, context);
      } else if (request.type === 'provider-specific') {
        // 处理Provider特定格式的响应
        result = await this.processProviderResponse(request, context);
      } else {
        throw new Error(`Unsupported request type for provider-protocol: ${request.type}`);
      }

      this.logDebug('Provider-protocol processing completed', {
        requestId,
        responseType: result.type
      });

      return this.createStandardResponse(result, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('Provider-protocol processing failed', { requestId, error: errorMessage });
      
      return this.createStandardResponse(null, false, {
        code: 'PROVIDER_PROTOCOL_ERROR',
        message: errorMessage,
        details: {
          providerId: this.providerId,
          model: this.model
        }
      });
    }
  }

  // ==================== Provider通信逻辑 ====================

  private async sendToProvider(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logDebug('Sending request to provider', {
        providerId: this.providerId,
        model: this.model,
        requestId: context?.requestId
      });

      // 调用Provider客户端
      const providerResponse = await this.providerClient.sendRequest(request.data, {
        model: this.model,
        timeout: this.providerConfig.timeout || 30000,
        requestId: context?.requestId
      });

      const processingTime = Date.now() - startTime;

      this.logDebug('Provider response received', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        responseType: typeof providerResponse
      });

      return {
        id: `provider_resp_${Date.now()}`,
        type: 'provider-specific',
        model: this.model,
        data: providerResponse,
        metadata: {
          originalType: 'provider-protocol',
          providerId: this.providerId,
          processingTime,
          receivedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('Provider request failed', {
        providerId: this.providerId,
        model: this.model,
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async processProviderResponse(request: StandardRequest, context?: ProcessingContext): Promise<any> {
    // 这个方法处理从Provider返回的响应
    // 主要用于响应流向：Provider → Provider-Protocol → Transformer
    
    this.logDebug('Processing provider-specific response', {
      providerId: this.providerId,
      model: this.model,
      requestId: context?.requestId
    });

    // 对Provider响应进行标准化处理
    const processedData = await this.standardizeProviderResponse(request.data);

    return {
      id: `processed_${Date.now()}`,
      type: 'provider-protocol',
      model: this.model,
      data: processedData,
      metadata: {
        originalType: 'provider-specific',
        providerId: this.providerId,
        processedAt: new Date().toISOString()
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

      if (request.type === 'provider-protocol') {
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
      // 看起来像Anthropic格式 - 不应该在这里处理
      type = 'anthropic';
    } else if (input.choices || input.model) {
      // 看起来像Provider响应
      type = 'provider-specific';
    } else {
      // 默认为Provider-Protocol格式
      type = 'provider-protocol';
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

  private async createProviderClient(config: any): Promise<any> {
    try {
      // 根据provider类型创建对应的客户端
      switch (config.type) {
        case 'openai':
          return await this.createOpenAIClient(config);
        case 'gemini':
          return await this.createGeminiClient(config);
        case 'codewhisperer':
          return await this.createCodeWhispererClient(config);
        case 'anthropic':
          return await this.createAnthropicClient(config);
        default:
          throw new Error(`Unsupported provider type: ${config.type}`);
      }
    } catch (error) {
      throw new Error(`Failed to create provider client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createOpenAIClient(config: any): Promise<any> {
    // 使用真实的OpenAI客户端 - 绝对不允许Mock！
    try {
      // 动态导入OpenAI client factory
      const { createOpenAIClient } = await import('../../provider-protocol/openai/client-factory.js');
      
      this.logDebug('Creating REAL OpenAI client', { 
        endpoint: config.endpoint,
        type: config.type 
      });
      
      // 创建真实的OpenAI客户端
      const provider = createOpenAIClient(config, this.providerId);
      
      return {
        sendRequest: async (data: any, options: any) => {
          this.logDebug('REAL OpenAI client sending request', { 
            model: options.model,
            endpoint: config.endpoint 
          });
          
          // 调用真实的OpenAI Provider的sendRequest方法
          const response = await provider.sendRequest(data);
          
          this.logDebug('REAL OpenAI client response received', { 
            hasContent: !!response?.content?.[0]?.text,
            responseType: typeof response,
            contentLength: response?.content?.length
          });
          
          return response;
        },
        disconnect: async () => {
          // OpenAI provider 没有 disconnect 方法，跳过
        },
        destroy: async () => {
          // OpenAI provider 没有 destroy 方法，跳过
        }
      };
    } catch (error) {
      this.logError('CRITICAL: Failed to create real OpenAI client - NO MOCK FALLBACK ALLOWED!', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      // 绝对不允许Mock - 直接抛出错误
      throw new Error(`CRITICAL: OpenAI client creation failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createGeminiClient(config: any): Promise<any> {
    // 使用真实的Gemini客户端 - 绝对不允许Mock！
    try {
      const { createGeminiClient } = await import('../../provider-protocol/gemini/client-factory.js');
      
      this.logDebug('Creating REAL Gemini client', { 
        endpoint: config.endpoint,
        type: config.type 
      });
      
      const provider = createGeminiClient(config, this.providerId);
      
      return {
        sendRequest: async (data: any, options: any) => {
          this.logDebug('REAL Gemini client sending request', { 
            model: options.model,
            endpoint: config.endpoint 
          });
          
          const response = await provider.sendRequest(data);
          
          this.logDebug('REAL Gemini client response received', { 
            hasContent: !!response?.candidates?.[0]?.content?.parts?.[0]?.text,
            responseType: typeof response
          });
          
          return response;
        },
        disconnect: async () => {
          if (typeof provider.disconnect === 'function') {
            await provider.disconnect();
          }
        },
        destroy: async () => {
          if (typeof provider.destroy === 'function') {
            await provider.destroy();
          }
        }
      };
    } catch (error) {
      this.logError('CRITICAL: Failed to create real Gemini client - NO MOCK FALLBACK ALLOWED!', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`CRITICAL: Gemini client creation failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createCodeWhispererClient(config: any): Promise<any> {
    // 使用真实的CodeWhisperer客户端 - 绝对不允许Mock！
    try {
      const { CodewhispererClientFactory } = await import('../../provider-protocol/codewhisperer/client-factory.js');
      
      this.logDebug('Creating REAL CodeWhisperer client', { 
        endpoint: config.endpoint,
        type: config.type 
      });
      
      const provider = CodewhispererClientFactory.createValidatedClient(config, this.providerId);
      
      return {
        sendRequest: async (data: any, options: any) => {
          this.logDebug('REAL CodeWhisperer client sending request', { 
            model: options.model 
          });
          
          const response = await provider.sendRequest(data);
          
          this.logDebug('REAL CodeWhisperer client response received', { 
            hasContent: !!response?.content?.[0]?.text,
            responseType: typeof response
          });
          
          return response;
        },
        disconnect: async () => {
          // CodeWhisperer provider 可能没有 disconnect 方法，跳过
        },
        destroy: async () => {
          // CodeWhisperer provider 可能没有 destroy 方法，跳过
        }
      };
    } catch (error) {
      this.logError('CRITICAL: Failed to create real CodeWhisperer client - NO MOCK FALLBACK ALLOWED!', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`CRITICAL: CodeWhisperer client creation failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createAnthropicClient(config: any): Promise<any> {
    // 抛出详细的未实现错误信息 - 绝对不允许Mock！
    const errorDetails = {
      module: 'ProviderProtocolModule',
      method: 'createAnthropicClient',
      providerId: this.providerId,
      reason: 'Anthropic direct API client not implemented',
      endpoint: config.endpoint,
      type: config.type,
      alternatives: [
        'Use OpenAI-compatible providers (type: "openai")',
        'Use CodeWhisperer providers (type: "codewhisperer")', 
        'Use Gemini providers (type: "gemini")',
        'Configure an OpenAI-compatible proxy for Anthropic API'
      ],
      documentation: 'See config examples for OpenAI-compatible provider setup',
      supportedProviders: ['openai', 'gemini', 'codewhisperer']
    };

    this.logError('NOT_IMPLEMENTED: Anthropic direct client not available', errorDetails);
    
    throw new Error(`API_500_NOT_IMPLEMENTED: Anthropic direct client not implemented in ${errorDetails.module}.${errorDetails.method}. Reason: ${errorDetails.reason}. Use alternatives: ${errorDetails.alternatives.join(', ')}`);
  }

  private async standardizeProviderResponse(responseData: any): Promise<any> {
    // 标准化不同Provider的响应格式 - 实际实现
    
    this.logDebug('Standardizing provider response', {
      providerId: this.providerId,
      responseType: typeof responseData,
      hasContent: !!responseData?.content,
      hasChoices: !!responseData?.choices
    });

    // 如果已经是Anthropic格式，直接返回
    if (responseData?.content && Array.isArray(responseData.content)) {
      return responseData;
    }

    // 如果是OpenAI格式，转换为Anthropic格式
    if (responseData?.choices && Array.isArray(responseData.choices)) {
      const choice = responseData.choices[0];
      if (!choice) {
        throw new Error('API_500_NOT_IMPLEMENTED: Empty choices array in provider response');
      }

      const content: any[] = [];
      
      // 处理文本内容
      if (choice.message?.content) {
        content.push({
          type: 'text',
          text: choice.message.content
        });
      }

      // 处理工具调用
      if (choice.message?.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        }
      }

      return {
        id: responseData.id || `standardized_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: content.length > 0 ? content : [{
          type: 'text',
          text: 'No content in provider response'
        }],
        model: this.model,
        stop_reason: this.mapFinishReason(choice.finish_reason),
        usage: {
          input_tokens: responseData.usage?.prompt_tokens || 0,
          output_tokens: responseData.usage?.completion_tokens || 0
        }
      };
    }

    // 未知格式的响应
    this.logError('Unknown provider response format', {
      responseData: JSON.stringify(responseData, null, 2)
    });
    
    throw new Error('API_500_NOT_IMPLEMENTED: Unknown provider response format cannot be standardized');
  }

  private mapFinishReason(finishReason: string | undefined): string {
    switch (finishReason) {
      case 'stop': return 'end_turn';
      case 'length': return 'max_tokens';
      case 'tool_calls': return 'tool_use';
      case 'content_filter': return 'stop_sequence';
      default: return 'end_turn';
    }
  }

  private async performConnectionTest(): Promise<void> {
    // 执行简单的连接测试
    const testRequest: StandardRequest = {
      id: 'connection-test',
      type: 'provider-protocol',
      model: 'test-model',
      data: {
        model: 'test-model',
        messages: [{ role: 'user', content: 'connection test' }],
        max_tokens: 1
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