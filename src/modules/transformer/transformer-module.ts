/**
 * Transformer Module Implementation
 *
 * 转换器模块的完整实现
 * 实现三阶段处理机制：req_in, req_process, req_out, response_in, response_process, response_out
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { BaseModule } from '../base-module-impl';
import { ModuleType } from '../../interfaces/module/base-module';
import { SecureAnthropicToOpenAITransformer, SecureTransformerConfig } from '../transformers/secure-anthropic-openai-transformer';
import { SecureTransformerFactory, SecureTransformerType, createSecureTransformerFactory } from '../transformers/transformer-factory';
import { secureLogger } from '../../utils/secure-logger';
import { TransformError, ValidationError } from '../../types/error';

/**
 * 转换器类型枚举
 */
export enum TransformerType {
  ANTHROPIC_TO_OPENAI = 'anthropic_to_openai',
  OPENAI_TO_ANTHROPIC = 'openai_to_anthropic',
  GEMINI_TO_OPENAI = 'gemini_to_openai',
  OPENAI_TO_GEMINI = 'openai_to_gemini'
}

/**
 * 转换器配置接口
 */
export interface TransformerConfig {
  // 基础配置
  type: TransformerType;
  securityConfig?: Partial<SecureTransformerConfig>;
  defaultMaxTokens?: number;
  
  // 模块配置
  enabled: boolean;
  priority: number;
  
  // 性能配置
  timeout?: number;
  retryAttempts?: number;
}

/**
 * 转换器模块实现
 */
export class TransformerModule extends BaseModule {
  protected config: TransformerConfig;
  
  // 转换器实例
  private transformer: SecureAnthropicToOpenAITransformer | null = null;
  private factory: SecureTransformerFactory | null = null;
  
  // 内部状态
  private processingQueue: Array<any> = [];
  private isProcessing: boolean = false;

  constructor(config: TransformerConfig) {
    super(
      `transformer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'TransformerModule',
      ModuleType.TRANSFORMER,
      '1.0.0'
    );
    
    // 验证配置
    this.validateConfig(config);
    this.config = { ...config };
  }

  /**
   * 验证配置
   */
  private validateConfig(config: TransformerConfig): void {
    if (!config.type) {
      throw new ValidationError('Transformer type is required', { module: this.getName() });
    }
    
    if (!Object.values(TransformerType).includes(config.type)) {
      throw new ValidationError(`Invalid transformer type: ${config.type}`, { 
        module: this.getName(), 
        type: config.type 
      });
    }
    
    if (config.defaultMaxTokens !== undefined && config.defaultMaxTokens <= 0) {
      throw new ValidationError('defaultMaxTokens must be greater than 0', { 
        module: this.getName(), 
        defaultMaxTokens: config.defaultMaxTokens 
      });
    }
  }

  /**
   * 配置处理
   */
  protected async onConfigure(config: any): Promise<void> {
    this.validateConfig(config);
    this.config = { ...this.config, ...config };
    
    // 如果模块正在运行，重新初始化转换器
    if (this.status === 'running' && this.transformer) {
      await this.transformer.cleanup();
      await this.initializeTransformer();
    }
  }

  /**
   * 初始化转换器
   */
  private async initializeTransformer(): Promise<void> {
    if (!this.config.enabled) {
      throw new TransformError('Transformer module is disabled', { moduleId: this.getId() });
    }

    // 创建工厂实例
    this.factory = createSecureTransformerFactory({
      defaultSecurityConfig: this.config.securityConfig || {
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: this.config.defaultMaxTokens || 8192
      },
      allowDeprecated: false,
      securityAuditMode: true,
      enableSecurityLogging: true
    });

    // 创建转换器实例
    const transformerType = this.mapTransformerType(this.config.type);
    this.transformer = await this.factory.createTransformer(transformerType, this.config.securityConfig) as SecureAnthropicToOpenAITransformer;
    
    // 启动转换器
    await this.transformer.start();
  }

  /**
   * 映射转换器类型
   */
  private mapTransformerType(type: TransformerType): SecureTransformerType {
    switch (type) {
      case TransformerType.ANTHROPIC_TO_OPENAI:
        return SecureTransformerType.ANTHROPIC_TO_OPENAI;
      case TransformerType.OPENAI_TO_ANTHROPIC:
        return SecureTransformerType.ANTHROPIC_TO_OPENAI; // 反向使用
      default:
        return SecureTransformerType.ANTHROPIC_TO_OPENAI;
    }
  }

  /**
   * 启动处理
   */
  protected async onStart(): Promise<void> {
    if (this.config.enabled) {
      await this.initializeTransformer();
    }
  }

  /**
   * 停止处理
   */
  protected async onStop(): Promise<void> {
    // 停止转换器
    if (this.transformer) {
      await this.transformer.stop();
      await this.transformer.cleanup();
      this.transformer = null;
    }

    // 清理工厂
    if (this.factory) {
      await this.factory.cleanup();
      this.factory = null;
    }
  }

  /**
   * 处理逻辑
   */
  protected async onProcess(input: any): Promise<any> {
    if (!this.config.enabled) {
      throw new TransformError('Transformer module is disabled', { moduleId: this.getId() });
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
    // 清理队列
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * 清理处理
   */
  protected async onCleanup(): Promise<void> {
    // 清理转换器资源
    if (this.transformer) {
      await this.transformer.cleanup();
      this.transformer = null;
    }

    // 清理工厂资源
    if (this.factory) {
      await this.factory.cleanup();
      this.factory = null;
    }
  }

  /**
   * 健康检查处理
   */
  protected async onHealthCheck(): Promise<any> {
    const baseHealth = await super.onHealthCheck();
    
    const isTransformerHealthy = this.transformer ? 
      (await this.transformer.healthCheck()).healthy : 
      !this.config.enabled; // 如果模块禁用，则认为是健康的

    return {
      ...baseHealth,
      transformerHealthy: isTransformerHealthy,
      enabled: this.config.enabled,
      type: this.config.type
    };
  }

  /**
   * 处理请求进入阶段
   */
  private async handleRequestIn(input: any): Promise<any> {
    // 在请求进入时进行预处理和验证
    if (!this.transformer) {
      throw new TransformError('Transformer not initialized', { moduleId: this.getId() });
    }

    // 对请求数据进行预处理
    const processedRequest = {
      ...input,
      metadata: {
        ...input.metadata,
        transformer: {
          id: this.getId(),
          timestamp: new Date().toISOString(),
          stage: 'req_in'
        }
      }
    };

    return {
      ...processedRequest,
      transformed: false
    };
  }

  /**
   * 处理请求处理阶段
   */
  private async handleRequestProcess(input: any): Promise<any> {
    // 在请求处理阶段执行实际的转换
    if (!this.transformer) {
      throw new TransformError('Transformer not initialized', { moduleId: this.getId() });
    }

    // 执行转换
    const transformedData = await this.transformer.process(input.request || input.data || input);
    
    return {
      ...input,
      request: transformedData,
      transformed: true,
      metadata: {
        ...input.metadata,
        transformer: {
          ...input.metadata?.transformer,
          stage: 'req_process',
          transformedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 处理请求输出阶段
   */
  private async handleRequestOut(input: any): Promise<any> {
    // 在请求输出阶段进行最后的处理和验证
    if (!this.transformer) {
      throw new TransformError('Transformer not initialized', { moduleId: this.getId() });
    }

    // 验证转换后的数据格式
    const requestData = input.request || input.data || input;
    
    // 确保数据格式正确
    const validatedData = {
      ...requestData,
      // 确保必要的字段存在
      model: requestData.model || 'default-model',
      messages: Array.isArray(requestData.messages) ? requestData.messages : []
    };

    return {
      ...input,
      request: validatedData,
      metadata: {
        ...input.metadata,
        transformer: {
          ...input.metadata?.transformer,
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
        transformer: {
          ...input.metadata?.transformer,
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
    // 在响应处理阶段进行处理（可能需要反向转换）
    if (!this.transformer) {
      throw new TransformError('Transformer not initialized', { moduleId: this.getId() });
    }

    const responseData = input.response || input.data || input;
    
    // 如果需要反向转换（OpenAI到Anthropic），可以在这里实现
    // 当前版本主要处理Anthropic到OpenAI的转换
    
    return {
      ...input,
      response: responseData,
      metadata: {
        ...input.metadata,
        transformer: {
          ...input.metadata?.transformer,
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
    // 在响应输出阶段进行最后的处理和清理
    const responseData = input.response || input.data || input;
    
    // 确保响应格式正确
    const formattedResponse = {
      ...responseData,
      // 可以在这里添加响应格式化逻辑
    };

    return {
      ...input,
      response: formattedResponse,
      metadata: {
        ...input.metadata,
        transformer: {
          ...input.metadata?.transformer,
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
    // 默认处理方法，直接执行转换
    if (!this.transformer) {
      throw new TransformError('Transformer not initialized', { moduleId: this.getId() });
    }

    const result = await this.transformer.process(input);
    
    return result;
  }
}