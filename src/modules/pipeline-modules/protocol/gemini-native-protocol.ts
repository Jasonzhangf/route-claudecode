/**
 * 原生Gemini协议处理器 - 独立Protocol实现
 * 
 * 基于用户指导：每个protocol独立实现，不修改现有OpenAI设计
 * 
 * 架构原则：
 * - 独立处理Gemini原生格式请求和响应
 * - 不依赖OpenAI Protocol的验证逻辑
 * - 支持Gemini特有的工具调用格式和参数配置
 * - 完全独立的错误处理和验证机制
 * 
 * @author RCC4 System - Multi-Protocol Architecture
 * @version 1.0.0
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { secureLogger } from '../../../utils/secure-logger';
import { GEMINI_PROTOCOL_ERRORS } from '../../../constants/error-messages';

/**
 * Gemini原生请求格式
 */
export interface GeminiNativeRequest {
  project: string;
  request: {
    contents: Array<{
      role: 'user' | 'model';
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, any>;
        };
      }>;
    }>;
    tools?: Array<{
      functionDeclarations: Array<{
        name: string;
        description: string;
        parameters: {
          type: string;
          properties: Record<string, any>;
          required?: string[];
        };
      }>;
    }>;
    generationConfig?: {
      temperature?: number;
      maxOutputTokens?: number;
      topP?: number;
      topK?: number;
      thinkingConfig?: {
        include_thoughts: boolean;
        thinkingBudget: number;
      };
    };
  };
  model: string;
  stream?: boolean;
}

/**
 * Gemini原生响应格式
 */
export interface GeminiNativeResponse {
  candidates: Array<{
    content: {
      role: 'model';
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, any>;
        };
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * 原生Gemini协议处理器
 */
export class GeminiNativeProtocolModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'gemini-native-protocol';
  private readonly name: string = 'Gemini Native Protocol Module';
  private readonly type: ModuleType = ModuleType.PROTOCOL;
  private readonly version: string = '1.0.0';
  private status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  private connections: Map<string, ModuleInterface> = new Map();
  
  private readonly metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  constructor() {
    super();
    secureLogger.info('🔷 [GEMINI NATIVE PROTOCOL] 初始化独立Gemini协议处理器', {
      moduleId: this.id,
      version: this.version
    });
  }

  // ============================================================================
  // ModuleInterface 实现
  // ============================================================================

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      health: this.status === 'running' ? 'healthy' : 'unhealthy',
      lastActivity: new Date(),
    };
  }

  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  async configure(config: any): Promise<void> {
    secureLogger.info('🔧 [GEMINI NATIVE PROTOCOL] 配置协议模块', {
      configKeys: Object.keys(config || {})
    });
  }

  async start(): Promise<void> {
    this.status = 'running';
    secureLogger.info('▶️ [GEMINI NATIVE PROTOCOL] 启动协议模块');
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    secureLogger.info('⏹️ [GEMINI NATIVE PROTOCOL] 停止协议模块');
    this.emit('stopped');
  }

  async reset(): Promise<void> {
    this.metrics.requestsProcessed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.errorRate = 0;
    secureLogger.info('🔄 [GEMINI NATIVE PROTOCOL] 重置协议模块');
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    secureLogger.info('🧹 [GEMINI NATIVE PROTOCOL] 清理协议模块');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'running',
      details: {
        status: this.status,
        metrics: this.metrics,
        protocolType: 'gemini-native'
      }
    };
  }

  // ModuleInterface连接管理方法
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  hasConnection(moduleId: string): boolean {
    return this.connections.has(moduleId);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // 模块间通信方法
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      // 发送消息到目标模块
      targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
      });
      return Promise.resolve({ success: true, targetModuleId, message, type });
    }
    return Promise.resolve({ success: false, targetModuleId, message, type });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.on('moduleMessage', (data: any) => {
      listener(data.fromModuleId, data.message, data.type);
    });
  }

  // ============================================================================
  // 核心协议处理逻辑
  // ============================================================================

  /**
   * 处理Gemini原生格式请求
   */
  async process(input: any): Promise<any> {
    // 从input中提取参数
    const request = input.request || input;
    const routingDecision = input.routingDecision;
    const context = input.context;
    if (this.status !== 'running') {
      throw new GeminiProtocolNotRunningError(GEMINI_PROTOCOL_ERRORS.MODULE_NOT_RUNNING);
    }

    const startTime = Date.now();
    this.metrics.requestsProcessed++;

    try {
      secureLogger.info('🔷 [GEMINI NATIVE PROTOCOL] 处理Gemini原生请求', {
        requestId: context.requestId,
        hasProject: !!input.project,
        hasContents: !!input.request?.contents,
        contentsCount: input.request?.contents?.length || 0,
        hasTools: !!input.request?.tools,
        toolsCount: input.request?.tools?.length || 0,
        model: input.model,
        stream: input.stream
      });

      // 验证Gemini格式
      this.validateGeminiRequest(input);

      // 提取provider信息
      const selectedPipelineId = routingDecision.selectedPipeline || routingDecision.availablePipelines[0];
      const providerType = this.extractProviderFromPipelineId(selectedPipelineId);
      const providers = context.metadata?.config?.providers || [];
      const matchingProvider = providers.find((p: any) => p.name === providerType);

      if (!matchingProvider) {
        throw new GeminiProviderNotFoundError(`${GEMINI_PROTOCOL_ERRORS.PROVIDER_NOT_FOUND}: ${providerType}`, {
          providerType,
          availableProviders: providers.map((p: any) => p.name)
        });
      }

      // 应用provider特定配置
      const processedRequest = this.applyProviderSpecificConfig(input, matchingProvider, routingDecision);

      // 保存协议配置到上下文
      context.metadata.protocolConfig = {
        protocol: 'gemini',
        providerType,
        endpoint: matchingProvider.api_base_url,
        apiKey: matchingProvider.api_key,
        serverCompatibility: matchingProvider.serverCompatibility,
        originalModel: input.model,
        processedModel: processedRequest.model
      };

      this.updateMetrics(startTime);

      secureLogger.info('✅ [GEMINI NATIVE PROTOCOL] Gemini原生请求处理完成', {
        requestId: context.requestId,
        providerType,
        originalModel: input.model,
        processedModel: processedRequest.model,
        processingTime: Date.now() - startTime
      });

      return processedRequest;

    } catch (error) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestsProcessed - 1) + 1) / this.metrics.requestsProcessed;
      secureLogger.error('❌ [GEMINI NATIVE PROTOCOL] 协议处理失败', {
        requestId: context?.requestId,
        error: error.message,
        stack: error.stack,
        errorType: error.constructor.name
      });
      throw error;
    }
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private validateGeminiRequest(request: GeminiNativeRequest): void {
    if (!request) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.REQUEST_NULL);
    }

    if (!request.project) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.MISSING_PROJECT);
    }

    if (!request.request) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.MISSING_REQUEST);
    }

    if (!Array.isArray(request.request.contents)) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.INVALID_CONTENTS);
    }

    if (request.request.contents.length === 0) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.EMPTY_CONTENTS);
    }

    if (!request.model) {
      throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.MISSING_MODEL);
    }

    // 验证contents格式
    for (const content of request.request.contents) {
      if (!content.role || !['user', 'model'].includes(content.role)) {
        throw new GeminiRequestValidationError(`${GEMINI_PROTOCOL_ERRORS.INVALID_ROLE}: ${content.role}`);
      }

      if (!Array.isArray(content.parts)) {
        throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.INVALID_PARTS);
      }

      for (const part of content.parts) {
        if (!part.text && !part.functionCall) {
          throw new GeminiRequestValidationError(GEMINI_PROTOCOL_ERRORS.MISSING_CONTENT);
        }
      }
    }

    secureLogger.debug('✅ [GEMINI NATIVE PROTOCOL] 请求格式验证通过', {
      project: request.project,
      model: request.model,
      contentsCount: request.request.contents.length,
      hasTools: !!request.request.tools
    });
  }

  private applyProviderSpecificConfig(
    request: GeminiNativeRequest, 
    provider: any, 
    routingDecision: any
  ): GeminiNativeRequest {
    const processedRequest = { ...request };

    // 应用模型映射
    if (routingDecision && routingDecision.selectedPipeline) {
      const modelMapping = this.extractModelFromPipelineId(routingDecision.selectedPipeline);
      if (modelMapping) {
        processedRequest.model = modelMapping;
        secureLogger.info('🔧 [GEMINI NATIVE PROTOCOL] 应用模型映射', {
          originalModel: request.model,
          mappedModel: modelMapping,
          pipeline: routingDecision.selectedPipeline
        });
      }
    }

    // 应用serverCompatibility配置
    if (provider.serverCompatibility?.options) {
      const options = provider.serverCompatibility.options;
      
      if (options.maxTokens && processedRequest.request.generationConfig) {
        const originalMaxTokens = processedRequest.request.generationConfig.maxOutputTokens;
        processedRequest.request.generationConfig.maxOutputTokens = Math.min(
          originalMaxTokens || options.maxTokens,
          options.maxTokens
        );
        
        secureLogger.info('🔧 [GEMINI NATIVE PROTOCOL] 应用maxTokens限制', {
          originalMaxTokens,
          appliedMaxTokens: processedRequest.request.generationConfig.maxOutputTokens,
          providerLimit: options.maxTokens
        });
      }

      // 应用工具增强配置
      if (options.enhanceTool && processedRequest.request.tools) {
        secureLogger.info('🔧 [GEMINI NATIVE PROTOCOL] 启用工具增强模式', {
          toolsCount: processedRequest.request.tools.length
        });
      }
    }

    return processedRequest;
  }

  private extractProviderFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    
    // 处理Gemini CLI provider特殊格式
    if (parts.length >= 2 && parts[0] === 'gemini' && parts[1] === 'cli') {
      return 'gemini-cli';
    }
    
    return parts[0] || 'unknown';
  }

  private extractModelFromPipelineId(pipelineId: string): string | null {
    const parts = pipelineId.split('-');
    
    // Pipeline ID格式: "gemini-cli-gemini-2.5-flash-key0"
    // 需要提取 "gemini-2.5-flash" 部分
    if (parts.length >= 5 && parts[0] === 'gemini' && parts[1] === 'cli') {
      // gemini-2.5-flash 由 parts[2], parts[3], parts[4] 组成
      return `${parts[2]}-${parts[3]}-${parts[4]}`;
    }
    
    // 通用格式: "provider-model-key0" 
    if (parts.length >= 2) {
      // 去掉最后的key部分，剩余的作为模型名
      const modelParts = parts.slice(1, -1);
      if (modelParts.length > 0) {
        return modelParts.join('-');
      }
    }
    
    return null;
  }

  private updateMetrics(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
      this.metrics.requestsProcessed;
  }

  // ============================================================================
  // EventEmitter 方法重写
  // ============================================================================

  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event);
    return this;
  }
}

// ============================================================================
// 错误类定义
// ============================================================================

export class GeminiProtocolError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'GeminiProtocolError';
  }
}

export class GeminiProtocolNotRunningError extends GeminiProtocolError {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiProtocolNotRunningError';
  }
}

export class GeminiRequestValidationError extends GeminiProtocolError {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRequestValidationError';
  }
}

export class GeminiProviderNotFoundError extends GeminiProtocolError {
  constructor(message: string, details?: any) {
    super(message, details);
    this.name = 'GeminiProviderNotFoundError';
  }
}

/**
 * 工厂函数
 */
export function createGeminiNativeProtocolModule(): GeminiNativeProtocolModule {
  return new GeminiNativeProtocolModule();
}