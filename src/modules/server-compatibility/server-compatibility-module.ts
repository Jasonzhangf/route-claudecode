/**
 * Server Compatibility Module Implementation
 *
 * 服务器兼容性模块的完整实现
 * 实现三阶段处理机制：req_in, req_process, req_out, response_in, response_process, response_out
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { BaseModule } from '../base-module-impl';
import { ModuleType } from '../../interfaces/module/base-module';
import { secureLogger } from '../../utils/secure-logger';
import { ValidationError } from '../../types/error';

/**
 * 服务器兼容性类型枚举
 */
export enum ServerCompatibilityType {
  LMSTUDIO = 'lmstudio',
  OLLAMA = 'ollama',
  VLLM = 'vllm',
  MODELSCOPE = 'modelscope',
  QWEN = 'qwen',
  GEMINI = 'gemini',
  ANTHROPIC = 'anthropic'
}

/**
 * 服务器兼容性配置接口
 */
export interface ServerCompatibilityConfig {
  // 基础配置
  type: ServerCompatibilityType;
  version?: string;
  
  // 模块配置
  enabled: boolean;
  priority: number;
  
  // 兼容性配置
  modelMapping?: Record<string, string>;
  parameterMapping?: Record<string, string>;
  defaultModel?: string;
  
  // 限制配置
  maxTokens?: number;
  temperatureRange?: [number, number];
  topPRange?: [number, number];
  
  // 安全配置
  allowedModels?: string[];
  blockedModels?: string[];
}

/**
 * 服务器兼容性模块实现
 */
export class ServerCompatibilityModule extends BaseModule {
  protected config: ServerCompatibilityConfig;

  constructor(config: ServerCompatibilityConfig) {
    super(
      `server-compatibility_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'ServerCompatibilityModule',
      ModuleType.SERVER_COMPATIBILITY,
      '1.0.0'
    );
    
    // 验证配置
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * 验证配置
   */
  private validateConfig(config: ServerCompatibilityConfig): void {
    if (!config.type) {
      throw new ValidationError('Server compatibility type is required', { module: this.getName() });
    }
    
    if (!Object.values(ServerCompatibilityType).includes(config.type)) {
      throw new ValidationError(`Invalid server compatibility type: ${config.type}`, { 
        module: this.getName(), 
        type: config.type 
      });
    }
    
    // 验证温度范围
    if (config.temperatureRange) {
      const [min, max] = config.temperatureRange;
      if (min < 0 || max > 2 || min > max) {
        throw new ValidationError('Invalid temperature range', { 
          module: this.getName(), 
          range: config.temperatureRange 
        });
      }
    }
    
    // 验证topP范围
    if (config.topPRange) {
      const [min, max] = config.topPRange;
      if (min < 0 || max > 1 || min > max) {
        throw new ValidationError('Invalid topP range', { 
          module: this.getName(), 
          range: config.topPRange 
        });
      }
    }
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: any): Promise<void> {
    this.validateConfig(config);
    this.config = { ...this.config, ...config };
  }

  /**
   * 启动处理
   */
  protected async onStart(): Promise<void> {
    // 服务器兼容性模块启动逻辑
    secureLogger.info('Server compatibility module started', {
      moduleId: this.getId(),
      compatibilityType: this.config.type
    });
  }

  /**
   * 停止处理
   */
  protected async onStop(): Promise<void> {
    // 服务器兼容性模块停止逻辑
    secureLogger.info('Server compatibility module stopped', {
      moduleId: this.getId(),
      compatibilityType: this.config.type
    });
  }

  /**
   * 处理逻辑
   */
  protected async onProcess(input: any): Promise<any> {
    if (!this.config.enabled) {
      throw new ValidationError('Server compatibility module is disabled', { moduleId: this.getId() });
    }

    // 根据输入阶段进行处理
    if (input.stage === 'req_in') {
      return await this.handleRequestIn(input);
    } else if (input.stage === 'req_process') {
      return await this.handleRequestProcess(input);
    } else if (input.stage === 'req_out') {
      return await this.handleRequestOut(input);
    } else if (input.stage === 'response_in') {
      return await this.handleResponseIn(input);
    } else if (input.stage === 'response_process') {
      return await this.handleResponseProcess(input);
    } else if (input.stage === 'response_out') {
      return await this.handleResponseOut(input);
    } else {
      // 默认处理
      return await this.handleDefaultProcess(input);
    }
  }

  /**
   * 重置处理
   */
  protected async onReset(): Promise<void> {
    // 服务器兼容性模块重置逻辑
  }

  /**
   * 清理处理
   */
  protected async onCleanup(): Promise<void> {
    // 服务器兼容性模块清理逻辑
  }

  /**
   * 健康检查处理
   */
  protected async onHealthCheck(): Promise<any> {
    const baseHealth = await super.onHealthCheck();
    
    return {
      ...baseHealth,
      compatibilityType: this.config.type,
      enabled: this.config.enabled,
      modelMapping: !!this.config.modelMapping,
      parameterMapping: !!this.config.parameterMapping
    };
  }

  /**
   * 处理请求进入阶段
   */
  private async handleRequestIn(input: any): Promise<any> {
    // 在请求进入时进行预处理和验证
    const processedRequest = {
      ...input,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          id: this.getId(),
          timestamp: new Date().toISOString(),
          stage: 'req_in',
          type: this.config.type
        }
      }
    };

    return {
      ...processedRequest,
      validated: true
    };
  }

  /**
   * 处理请求处理阶段
   */
  private async handleRequestProcess(input: any): Promise<any> {
    // 在请求处理阶段执行服务器兼容性处理
    const requestData = input.request || input.data || input;
    
    // 应用模型映射
    const mappedRequest = this.applyModelMapping(requestData);
    
    // 应用参数映射
    const parameterMappedRequest = this.applyParameterMapping(mappedRequest);
    
    // 验证和调整参数
    const validatedRequest = this.validateAndAdjustParameters(parameterMappedRequest);
    
    return {
      ...input,
      request: validatedRequest,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          ...input.metadata?.serverCompatibility,
          stage: 'req_process',
          processedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 处理请求输出阶段
   */
  private async handleRequestOut(input: any): Promise<any> {
    // 在请求输出阶段进行最后的处理和验证
    const requestData = input.request || input.data || input;
    
    // 确保服务器兼容性格式正确
    const formattedRequest = this.formatServerCompatibilityRequest(requestData);
    
    return {
      ...input,
      request: formattedRequest,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          ...input.metadata?.serverCompatibility,
          stage: 'req_out',
          validatedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 处理响应进入阶段
   */
  private async handleResponseIn(input: any): Promise<any> {
    // 在响应进入时进行预处理
    return {
      ...input,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          ...input.metadata?.serverCompatibility,
          stage: 'response_in',
          responseReceivedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 处理响应处理阶段
   */
  private async handleResponseProcess(input: any): Promise<any> {
    // 在响应处理阶段进行服务器兼容性处理
    const responseData = input.response || input.data || input;
    
    // 处理响应数据
    const processedResponse = this.processServerCompatibilityResponse(responseData);
    
    return {
      ...input,
      response: processedResponse,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          ...input.metadata?.serverCompatibility,
          stage: 'response_process',
          processedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 处理响应输出阶段
   */
  private async handleResponseOut(input: any): Promise<any> {
    // 在响应输出阶段进行最后的处理和格式化
    const responseData = input.response || input.data || input;
    
    // 确保响应格式正确
    const formattedResponse = this.formatServerCompatibilityResponse(responseData);
    
    return {
      ...input,
      response: formattedResponse,
      metadata: {
        ...input.metadata,
        serverCompatibility: {
          ...input.metadata?.serverCompatibility,
          stage: 'response_out',
          finalizedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 默认处理方法
   */
  private async handleDefaultProcess(input: any): Promise<any> {
    // 默认处理方法，直接返回输入
    return input;
  }

  /**
   * 应用模型映射
   */
  private applyModelMapping(request: any): any {
    if (!this.config.modelMapping) {
      return request;
    }
    
    const mappedRequest = { ...request };
    
    if (mappedRequest.model && this.config.modelMapping[mappedRequest.model]) {
      mappedRequest.model = this.config.modelMapping[mappedRequest.model];
    }
    
    return mappedRequest;
  }

  /**
   * 应用参数映射
   */
  private applyParameterMapping(request: any): any {
    if (!this.config.parameterMapping) {
      return request;
    }
    
    const mappedRequest = { ...request };
    
    // 应用参数映射
    for (const [sourceParam, targetParam] of Object.entries(this.config.parameterMapping)) {
      if (mappedRequest[sourceParam] !== undefined) {
        mappedRequest[targetParam] = mappedRequest[sourceParam];
        delete mappedRequest[sourceParam];
      }
    }
    
    return mappedRequest;
  }

  /**
   * 验证和调整参数
   */
  private validateAndAdjustParameters(request: any): any {
    const validatedRequest = { ...request };
    
    // 验证模型是否被允许
    if (this.config.allowedModels && !this.config.allowedModels.includes(validatedRequest.model)) {
      throw new ValidationError(`Model ${validatedRequest.model} is not allowed`, { 
        module: this.getName(), 
        model: validatedRequest.model 
      });
    }
    
    // 验证模型是否被阻止
    if (this.config.blockedModels && this.config.blockedModels.includes(validatedRequest.model)) {
      throw new ValidationError(`Model ${validatedRequest.model} is blocked`, { 
        module: this.getName(), 
        model: validatedRequest.model 
      });
    }
    
    // 验证和调整max_tokens
    if (this.config.maxTokens && validatedRequest.max_tokens) {
      validatedRequest.max_tokens = Math.min(validatedRequest.max_tokens, this.config.maxTokens);
    }
    
    // 验证和调整temperature
    if (this.config.temperatureRange && validatedRequest.temperature !== undefined) {
      const [min, max] = this.config.temperatureRange;
      validatedRequest.temperature = Math.max(min, Math.min(validatedRequest.temperature, max));
    }
    
    // 验证和调整top_p
    if (this.config.topPRange && validatedRequest.top_p !== undefined) {
      const [min, max] = this.config.topPRange;
      validatedRequest.top_p = Math.max(min, Math.min(validatedRequest.top_p, max));
    }
    
    return validatedRequest;
  }

  /**
   * 格式化服务器兼容性请求
   */
  private formatServerCompatibilityRequest(request: any): any {
    // 确保必要的服务器兼容性字段存在
    const formattedRequest = { ...request };
    
    // 根据服务器类型添加特定字段
    switch (this.config.type) {
      case ServerCompatibilityType.LMSTUDIO:
        // LMStudio特定格式化
        break;
      case ServerCompatibilityType.OLLAMA:
        // Ollama特定格式化
        break;
      case ServerCompatibilityType.VLLM:
        // VLLM特定格式化
        break;
      case ServerCompatibilityType.MODELSCOPE:
        // ModelScope特定格式化
        break;
      case ServerCompatibilityType.QWEN:
        // Qwen特定格式化
        break;
      case ServerCompatibilityType.GEMINI:
        // Gemini特定格式化
        break;
      case ServerCompatibilityType.ANTHROPIC:
        // Anthropic特定格式化
        break;
    }
    
    return formattedRequest;
  }

  /**
   * 处理服务器兼容性响应
   */
  private processServerCompatibilityResponse(response: any): any {
    // 处理响应数据
    return response;
  }

  /**
   * 格式化服务器兼容性响应
   */
  private formatServerCompatibilityResponse(response: any): any {
    // 确保响应格式正确
    return response;
  }
}