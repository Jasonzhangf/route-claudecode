/**
 * Gemini Protocol Module
 *
 * Protocol模块：负责Gemini协议控制转换（流式 ↔ 非流式）
 * 按照RCC v4.0六层架构设计实现
 *
 * @author RCC4 System
 * @version 1.0.0
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';

/**
 * Gemini流式请求格式
 */
export interface GeminiStreamRequest {
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
    };
  };
  model: string;
  stream: true;
}

/**
 * Gemini非流式请求格式
 */
export interface GeminiNonStreamRequest {
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
    };
  };
  model: string;
  stream?: false;
}

/**
 * Gemini流式响应块
 */
export interface GeminiStreamChunk {
  response: {
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
  };
}

/**
 * Gemini非流式响应格式
 */
export interface GeminiNonStreamResponse {
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
 * Gemini流式响应完整累积结果
 */
export interface GeminiStreamResponse {
  chunks: GeminiStreamChunk[];
  aggregatedResponse: GeminiNonStreamResponse;
}

/**
 * Gemini协议模块
 */
export class GeminiProtocolModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'gemini-protocol-module';
  private readonly name: string = 'Gemini Protocol Module';
  private readonly type: ModuleType = ModuleType.PROTOCOL;
  private readonly version: string = '1.0.0';
  private status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  
  private readonly metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };

  constructor() {
    super();
    console.log(`🌐 初始化Gemini协议模块`);
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
    console.log('🔧 配置Gemini协议模块');
  }

  async start(): Promise<void> {
    this.status = 'running';
    console.log('▶️ Gemini协议模块启动');
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    console.log('⏹️ Gemini协议模块停止');
    this.emit('stopped');
  }

  async reset(): Promise<void> {
    this.metrics.requestsProcessed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.errorRate = 0;
    console.log('🔄 Gemini协议模块已重置');
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    console.log('🧹 Gemini协议模块已清理');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'running',
      details: {
        status: this.status,
        metrics: this.metrics
      }
    };
  }

  // ============================================================================
  // 核心协议转换逻辑
  // ============================================================================

  /**
   * 处理协议转换
   * 支持：流式请求 → 非流式请求 和 非流式响应 → 流式响应
   */
  async process(
    input: GeminiStreamRequest | GeminiNonStreamRequest | GeminiNonStreamResponse
  ): Promise<GeminiNonStreamRequest | GeminiStreamResponse> {
    if (this.status !== 'running') {
      throw new Error('Gemini协议模块未运行');
    }

    const startTime = Date.now();
    this.metrics.requestsProcessed++;

    try {
      if (this.isGeminiStreamRequest(input)) {
        console.log(`🌊 转换Gemini流式请求 → 非流式请求`);
        const result = this.convertToNonStreaming(input as GeminiStreamRequest);
        this.updateMetrics(startTime);
        console.log(`✅ Gemini流式→非流式转换完成`);
        return result;
        
      } else if (this.isGeminiNonStreamRequest(input)) {
        console.log(`➡️ Gemini非流式请求直接传递`);
        this.updateMetrics(startTime);
        console.log(`✅ Gemini非流式请求处理完成`);
        return input as GeminiNonStreamRequest;
        
      } else if (this.isGeminiNonStreamResponse(input)) {
        console.log(`🔄 转换Gemini非流式响应 → 流式响应`);
        const result = this.convertToStreaming(input as GeminiNonStreamResponse);
        this.updateMetrics(startTime);
        console.log(`✅ Gemini非流式→流式转换完成`);
        return result;
        
      } else {
        throw new Error('不支持的Gemini输入格式');
      }
    } catch (error) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestsProcessed - 1) + 1) / this.metrics.requestsProcessed;
      console.error(`❌ Gemini协议转换失败:`, error.message);
      throw error;
    }
  }

  // ============================================================================
  // 类型判断方法
  // ============================================================================

  private isGeminiStreamRequest(input: any): boolean {
    return !!(
      input &&
      input.project &&
      input.request &&
      Array.isArray(input.request.contents) &&
      input.model &&
      input.stream === true
    );
  }

  private isGeminiNonStreamRequest(input: any): boolean {
    return !!(
      input &&
      input.project &&
      input.request &&
      Array.isArray(input.request.contents) &&
      input.model &&
      (input.stream === false || input.stream === undefined)
    );
  }

  private isGeminiNonStreamResponse(input: any): boolean {
    return !!(
      input &&
      Array.isArray(input.candidates) &&
      input.candidates.length > 0 &&
      input.candidates[0].content &&
      Array.isArray(input.candidates[0].content.parts)
    );
  }

  // ============================================================================
  // 转换方法
  // ============================================================================

  /**
   * Gemini流式请求 → 非流式请求
   */
  private convertToNonStreaming(streamRequest: GeminiStreamRequest): GeminiNonStreamRequest {
    console.log('🔄 Gemini协议转换: stream=true → stream=false');
    
    const nonStreamRequest: GeminiNonStreamRequest = {
      project: streamRequest.project,
      request: {
        contents: streamRequest.request.contents,
        ...(streamRequest.request.tools && { tools: streamRequest.request.tools }),
        ...(streamRequest.request.generationConfig && { generationConfig: streamRequest.request.generationConfig })
      },
      model: streamRequest.model,
      stream: false
    };

    return nonStreamRequest;
  }

  /**
   * Gemini非流式响应 → 流式响应
   */
  private convertToStreaming(nonStreamResponse: GeminiNonStreamResponse): GeminiStreamResponse {
    console.log('🔄 Gemini协议转换: 生成流式chunks');
    
    const chunks: GeminiStreamChunk[] = [];
    const candidate = nonStreamResponse.candidates[0];
    
    if (!candidate) {
      throw new Error('Gemini响应缺少candidates');
    }

    // 生成开始chunk (role)
    const startChunk: GeminiStreamChunk = {
      response: {
        candidates: [{
          content: {
            role: 'model',
            parts: []
          }
        }]
      }
    };
    chunks.push(startChunk);

    // 处理文本内容
    for (const part of candidate.content.parts) {
      if (part.text) {
        // 将文本分割成多个chunk模拟流式传输
        const text = part.text;
        const chunkSize = Math.max(1, Math.ceil(text.length / 8)); // 分成约8个chunk

        for (let i = 0; i < text.length; i += chunkSize) {
          const textPart = text.slice(i, i + chunkSize);
          const textChunk: GeminiStreamChunk = {
            response: {
              candidates: [{
                content: {
                  role: 'model',
                  parts: [{ text: textPart }]
                }
              }]
            }
          };
          chunks.push(textChunk);
        }
      }

      // 处理函数调用
      if (part.functionCall) {
        const functionChunk: GeminiStreamChunk = {
          response: {
            candidates: [{
              content: {
                role: 'model',
                parts: [{ functionCall: part.functionCall }]
              }
            }]
          }
        };
        chunks.push(functionChunk);
      }
    }

    // 生成结束chunk (包含finishReason和usage)
    const endChunk: GeminiStreamChunk = {
      response: {
        candidates: [{
          content: {
            role: 'model',
            parts: []
          },
          finishReason: candidate.finishReason || 'STOP'
        }],
        ...(nonStreamResponse.usageMetadata && { usageMetadata: nonStreamResponse.usageMetadata })
      }
    };
    chunks.push(endChunk);

    console.log(`🌊 Gemini协议转换: 生成${chunks.length}个流式chunk`);

    return {
      chunks,
      aggregatedResponse: nonStreamResponse
    };
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private updateMetrics(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
      this.metrics.requestsProcessed;
  }

  /**
   * EventEmitter方法返回this以支持链式调用
   */
  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event);
    return this;
  }
}

/**
 * 工厂函数
 */
export function createGeminiProtocolModule(): GeminiProtocolModule {
  return new GeminiProtocolModule();
}