import {
  RequestProcessor,
  ProcessingStatus,
  ProcessingMetrics,
  ProcessingError,
  RCCRequest,
  RCCResponse,
  RequestPriority,
} from './types';
import { ErrorHandler } from '../../middleware/error-handler';
import { defaultProviderMapper } from '../../utils/provider-mapper';
import { API_DEFAULTS } from '../../constants/api-defaults';
import { JQJsonHandler } from '../../utils/jq-json-handler';

export interface RequestProcessorConfig {
  requestId: string;
  sessionId: string;
  conversationId: string;
  request: RCCRequest;
  priority?: RequestPriority;
}

export class RequestProcessorImpl implements RequestProcessor {
  public readonly requestId: string;
  public readonly sessionId: string;
  public readonly conversationId: string;
  public readonly request: RCCRequest;
  public readonly createdAt: Date;
  public response?: RCCResponse;
  public status: ProcessingStatus;
  public startedAt?: Date;
  public completedAt?: Date;
  public error?: ProcessingError;

  private priority: RequestPriority;
  private retryCount = 0;
  private abortController?: AbortController;

  constructor(config: RequestProcessorConfig) {
    this.requestId = config.requestId;
    this.sessionId = config.sessionId;
    this.conversationId = config.conversationId;
    this.request = config.request;
    this.priority = config.priority || 'medium';
    this.status = 'pending';
    this.createdAt = new Date();
  }

  async process(): Promise<RCCResponse> {
    if (this.status !== 'pending') {
      throw new Error(`Cannot process request in status: ${this.status}`);
    }

    this.status = 'processing';
    this.startedAt = new Date();
    this.abortController = new AbortController();

    try {
      console.log(`[${this.sessionId}/${this.conversationId}] Processing request ${this.requestId}`);

      // 执行实际的请求处理，不使用mockup
      this.response = await this.executeRequest();

      this.status = 'completed';
      this.completedAt = new Date();

      console.log(
        `[${this.sessionId}/${this.conversationId}] Request ${this.requestId} completed in ${this.getProcessingTime()}ms`
      );

      return this.response;
    } catch (error) {
      this.status = 'failed';
      this.error = this.createProcessingError(error);

      console.error(`[${this.sessionId}/${this.conversationId}] Request ${this.requestId} failed:`, error);

      // 通过标准错误处理器处理
      ErrorHandler.handle(error, {
        module: 'request-processor',
        operation: 'process',
        context: {
          requestId: this.requestId,
          sessionId: this.sessionId,
          conversationId: this.conversationId,
        },
      });

      throw error;
    }
  }

  private async executeRequest(): Promise<RCCResponse> {
    // 这里实现真实的请求处理逻辑，通过路由器转发给Provider
    const requestId = this.generateResponseId();
    const startTime = Date.now();

    try {
      // 从请求中提取目标Provider信息
      const targetProvider = this.extractTargetProvider();

      // 调用Provider Manager执行请求
      const providerResponse = await this.callProvider(targetProvider);

      // 构建标准RCC响应
      const response: RCCResponse = {
        id: requestId,
        status: providerResponse.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.requestId,
          'X-Session-ID': this.sessionId,
          'X-Conversation-ID': this.conversationId,
          'X-Processing-Time': (Date.now() - startTime).toString(),
          ...providerResponse.headers,
        },
        body: providerResponse.body,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };

      return response;
    } catch (error) {
      // 创建错误响应
      const response: RCCResponse = {
        id: requestId,
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.requestId,
          'X-Session-ID': this.sessionId,
          'X-Conversation-ID': this.conversationId,
          'X-Processing-Time': (Date.now() - startTime).toString(),
        },
        body: {
          error: {
            code: 'PROCESSING_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            requestId: this.requestId,
          },
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };

      throw error;
    }
  }

  private extractTargetProvider(): string {
    // 解析请求体以获取模型信息
    let modelName: string | undefined;
    if (this.request.body) {
      try {
        const body = typeof this.request.body === 'string' ? JQJsonHandler.parseJsonString(this.request.body) : this.request.body;
        modelName = body.model;
      } catch (error) {
        console.warn(`Failed to parse request body: ${error}`);
      }
    }

    // 使用配置驱动的Provider映射器
    return defaultProviderMapper.extractTargetProvider({
      headers: this.request.headers,
      url: this.request.url,
      model: modelName,
    });
  }

  private async callProvider(provider: string): Promise<any> {
    // 这里应该调用实际的Provider Manager
    // 为了避免循环依赖，现在使用简化的HTTP调用实现

    const providerConfig = await this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    // 构建Provider请求
    const providerRequest = {
      method: this.request.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: providerConfig.apiKey ? `Bearer ${providerConfig.apiKey}` : undefined,
        ...this.request.headers,
      },
      body: this.request.body,
      signal: this.abortController?.signal,
    };

    // 发送到Provider
    const response = await fetch(providerConfig.baseUrl + this.request.url, providerRequest);

    let responseBody;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType?.includes('text/')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.arrayBuffer();
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    };
  }

  private async getProviderConfig(provider: string): Promise<any> {
    // 使用配置驱动的Provider配置获取
    // 在实际实现中应该通过ConfigManager获取完整配置
    const resolvedProvider = defaultProviderMapper.resolveProviderAlias(provider);
    
    // 从API_DEFAULTS获取基础配置
    const providerConfigs: Record<string, any> = {
      openai: {
        baseUrl: process.env.OPENAI_BASE_URL || API_DEFAULTS.PROVIDERS.OPENAI.BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
      },
      anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL || API_DEFAULTS.PROVIDERS.ANTHROPIC.BASE_URL,
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      gemini: {
        baseUrl: process.env.GEMINI_BASE_URL || API_DEFAULTS.PROVIDERS.GEMINI.BASE_URL,
        apiKey: process.env.GOOGLE_API_KEY,
      },
      lmstudio: {
        baseUrl: process.env.LMSTUDIO_BASE_URL || API_DEFAULTS.PROVIDERS.LMSTUDIO.BASE_URL,
        apiKey: null,
      },
    };

    return providerConfigs[resolvedProvider] || providerConfigs.openai;
  }

  private createProcessingError(error: any): ProcessingError {
    return {
      code: this.extractErrorCode(error),
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      retryable: this.isRetryableError(error),
      context: {
        requestId: this.requestId,
        sessionId: this.sessionId,
        conversationId: this.conversationId,
        retryCount: this.retryCount,
      },
    };
  }

  private extractErrorCode(error: any): string {
    if (error instanceof Error) {
      // HTTP错误
      if (error.message.includes('404')) return 'NOT_FOUND';
      if (error.message.includes('401')) return 'UNAUTHORIZED';
      if (error.message.includes('403')) return 'FORBIDDEN';
      if (error.message.includes('500')) return 'INTERNAL_SERVER_ERROR';
      if (error.message.includes('502')) return 'BAD_GATEWAY';
      if (error.message.includes('503')) return 'SERVICE_UNAVAILABLE';
      if (error.message.includes('504')) return 'GATEWAY_TIMEOUT';

      // 网络错误
      if (error.message.includes('ECONNREFUSED')) return 'CONNECTION_REFUSED';
      if (error.message.includes('ETIMEDOUT')) return 'TIMEOUT';
      if (error.message.includes('ENOTFOUND')) return 'DNS_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 网络错误通常可重试
      if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return true;
      }

      // 临时服务器错误可重试
      if (message.includes('503') || message.includes('502') || message.includes('504')) {
        return true;
      }

      // 认证错误和客户端错误通常不可重试
      if (message.includes('401') || message.includes('403') || message.includes('400')) {
        return false;
      }
    }

    return true; // 默认可重试
  }

  getMetrics(): ProcessingMetrics {
    const processingTime = this.getProcessingTime();
    const queueWaitTime = this.getQueueWaitTime();
    const totalTime = this.getTotalTime();

    return {
      requestId: this.requestId,
      processingTime,
      queueWaitTime,
      totalTime,
      errorCount: this.status === 'failed' ? 1 : 0,
      retryCount: this.retryCount,
    };
  }

  private getProcessingTime(): number | undefined {
    if (this.startedAt && (this.completedAt || this.status === 'processing')) {
      const endTime = this.completedAt || new Date();
      return endTime.getTime() - this.startedAt.getTime();
    }
    return undefined;
  }

  private getQueueWaitTime(): number | undefined {
    if (this.startedAt) {
      return this.startedAt.getTime() - this.createdAt.getTime();
    }
    return undefined;
  }

  private getTotalTime(): number | undefined {
    if (this.completedAt || this.status === 'failed') {
      const endTime = this.completedAt || new Date();
      return endTime.getTime() - this.createdAt.getTime();
    }
    return undefined;
  }

  async abort(): Promise<void> {
    if (this.status === 'completed' || this.status === 'failed' || this.status === 'aborted') {
      return; // 已经完成的请求无法取消
    }

    console.log(`[${this.sessionId}/${this.conversationId}] Aborting request ${this.requestId}`);

    this.status = 'aborted';

    // 取消HTTP请求
    if (this.abortController) {
      this.abortController.abort();
    }

    this.error = {
      code: 'REQUEST_ABORTED',
      message: 'Request was aborted',
      timestamp: new Date(),
      retryable: false,
      context: { requestId: this.requestId },
    };
  }

  private generateResponseId(): string {
    return `res_${this.requestId}_${Date.now()}`;
  }

  // 获取请求优先级（用于队列排序）
  getPriority(): RequestPriority {
    return this.priority;
  }

  // 增加重试计数
  incrementRetryCount(): void {
    this.retryCount++;
  }

  // 重置状态（用于重试）
  reset(): void {
    this.status = 'pending';
    this.startedAt = undefined;
    this.completedAt = undefined;
    this.response = undefined;
    this.error = undefined;
    this.abortController = undefined;
  }
}
