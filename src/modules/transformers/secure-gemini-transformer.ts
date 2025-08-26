/**
 * Secure Gemini Transformer
 * 
 * 基于RCC4架构的真正Gemini转换器
 * 处理Anthropic ↔ Gemini协议的双向转换
 * 基于已验证的cloudcode-pa.googleapis.com API格式
 * 
 * @author RCC4 System 
 * @version 1.0.0
 */

import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
  IValidationResult,
} from '../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { SecureTransformerConfig, TransformerSecurityError, TransformerValidationError } from './secure-anthropic-openai-transformer';

/**
 * Gemini请求接口（基于验证的API格式）
 */
interface GeminiRequest {
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
}

/**
 * Gemini响应接口（基于实际API响应）
 */
interface GeminiResponse {
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
 * Anthropic请求接口（简化版）
 */
interface AnthropicRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<any>;
  }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, any>;
  }>;
  stream?: boolean;
}

/**
 * Anthropic响应接口（简化版）
 */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  stop_reason: string;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 真正的Gemini安全转换器
 */
export class SecureGeminiTransformer extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'secure-gemini-transformer';
  private readonly name: string = 'Secure Gemini Transformer';
  private readonly type: ModuleType = ModuleType.TRANSFORMER;
  private readonly version: string = '1.0.0';
  private status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';

  private readonly config: SecureTransformerConfig;
  private readonly metrics: ModuleMetrics;
  private readonly defaultProjectId: string = 'neat-achievment-gvmxc';

  constructor(config: Partial<SecureTransformerConfig> = {}) {
    super();

    this.config = Object.freeze({
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      maxTokens: config.maxTokens || 8192,
      ...config,
    });

    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
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

  async configure(config: Partial<SecureTransformerConfig>): Promise<void> {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration object');
    }
  }

  async start(): Promise<void> {
    this.status = 'running';
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.emit('stopped');
  }

  /**
   * 主要的处理方法 - 执行双向转换
   */
  async process(input: unknown): Promise<GeminiRequest | AnthropicResponse> {
    if (this.status !== 'running') {
      throw new Error('Transformer not in running state');
    }

    console.log('🔥 [GEMINI TRANSFORMER] Processing input...', {
      type: typeof input,
      hasModel: !!(input as any)?.model,
      hasMessages: !!(input as any)?.messages
    });

    const startTime = Date.now();
    
    try {
      this.metrics.requestsProcessed++;
      
      const result = this.performTransformation(input);
      
      // 更新指标
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
        this.metrics.requestsProcessed;

      return result;
    } catch (error) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestsProcessed - 1) + 1) / this.metrics.requestsProcessed;
      throw error;
    }
  }

  async reset(): Promise<void> {
    this.metrics.requestsProcessed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.errorRate = 0;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
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

  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event);
    return this;
  }

  // ============================================================================
  // 核心转换逻辑
  // ============================================================================

  private performTransformation(input: unknown): GeminiRequest | AnthropicResponse {
    if (this.isAnthropicRequest(input)) {
      console.log('🔄 [GEMINI TRANSFORMER] Converting Anthropic → Gemini');
      return this.transformAnthropicToGemini(input as AnthropicRequest);
    } else if (this.isGeminiResponse(input)) {
      console.log('🔄 [GEMINI TRANSFORMER] Converting Gemini → Anthropic');
      return this.transformGeminiToAnthropic(input);
    } else {
      console.error('❌ [GEMINI TRANSFORMER] Unsupported input format');
      throw new TransformerValidationError(
        'Unsupported input format for Gemini transformer',
        ['Input must be Anthropic request or Gemini response'],
        { inputType: typeof input }
      );
    }
  }

  /**
   * 转换Anthropic请求到Gemini格式
   */
  private transformAnthropicToGemini(request: AnthropicRequest): GeminiRequest {
    console.log('🔄 [GEMINI TRANSFORMER] Anthropic → Gemini conversion');
    
    // 验证基本字段
    if (!request.model || !request.messages) {
      throw new TransformerValidationError(
        'Invalid Anthropic request',
        ['Missing model or messages'],
        { request }
      );
    }

    // 映射模型名称（基于验证的模型）
    const geminiModel = this.mapAnthropicToGeminiModel(request.model);
    
    // 转换消息格式
    const contents = this.convertAnthropicMessagesToGeminiContents(request.messages, request.system);
    
    // 转换工具定义
    const tools = request.tools ? this.convertAnthropicToolsToGeminiTools(request.tools) : undefined;

    // 构建Gemini请求（基于验证的格式）
    const geminiRequest: GeminiRequest = {
      project: this.defaultProjectId,
      request: {
        contents,
        ...(tools && { tools }),
        generationConfig: {
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.max_tokens !== undefined && { 
            maxOutputTokens: Math.min(request.max_tokens, this.config.maxTokens) 
          }),
          ...(request.top_p !== undefined && { topP: request.top_p }),
          ...(request.top_k !== undefined && { topK: request.top_k }),
          thinkingConfig: {
            include_thoughts: false,
            thinkingBudget: 0
          }
        }
      },
      model: geminiModel
    };

    console.log('✅ [GEMINI TRANSFORMER] Anthropic → Gemini conversion completed', {
      originalModel: request.model,
      geminiModel,
      messageCount: contents.length
    });

    return geminiRequest;
  }

  /**
   * 转换Gemini响应到Anthropic格式
   */
  private transformGeminiToAnthropic(response: any): AnthropicResponse {
    console.log('🔄 [GEMINI TRANSFORMER] Gemini → Anthropic conversion');
    
    // 处理数组格式的流式响应（基于验证的响应格式）
    let processedResponse: GeminiResponse;
    if (Array.isArray(response)) {
      processedResponse = this.mergeGeminiStreamResponses(response);
    } else if (response.response) {
      // 处理包装在response字段中的响应
      processedResponse = response.response;
    } else {
      processedResponse = response as GeminiResponse;
    }

    if (!processedResponse.candidates || processedResponse.candidates.length === 0) {
      throw new TransformerValidationError(
        'Invalid Gemini response',
        ['No candidates found in response'],
        { response }
      );
    }

    const candidate = processedResponse.candidates[0];
    const content = this.convertGeminiContentToAnthropicContent(candidate.content);

    // 构建Anthropic响应
    const anthropicResponse: AnthropicResponse = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229', // 映射回Anthropic模型名
      content,
      stop_reason: this.mapGeminiFinishReasonToAnthropicStopReason(candidate.finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: processedResponse.usageMetadata?.promptTokenCount || 0,
        output_tokens: processedResponse.usageMetadata?.candidatesTokenCount || 0
      }
    };

    console.log('✅ [GEMINI TRANSFORMER] Gemini → Anthropic conversion completed');

    return anthropicResponse;
  }

  // ============================================================================
  // 辅助转换方法
  // ============================================================================

  private mapAnthropicToGeminiModel(anthropicModel: string): string {
    const modelMap: Record<string, string> = {
      'claude-3-haiku-20240307': 'gemini-2.5-flash',
      'claude-3-sonnet-20240229': 'gemini-2.5-flash',
      'claude-3-opus-20240229': 'gemini-2.5-pro',
      'claude-3-5-sonnet-20240620': 'gemini-2.5-flash',
      'claude-3-5-sonnet-20241022': 'gemini-2.5-flash',
      'claude-sonnet-4-20250514': 'gemini-2.5-flash'
    };
    
    return modelMap[anthropicModel] || 'gemini-2.5-flash';
  }

  private convertAnthropicMessagesToGeminiContents(messages: any[], systemPrompt?: string): any[] {
    const contents = [];
    let systemText = systemPrompt || '';

    for (const message of messages) {
      if (message.role === 'system') {
        // 收集系统消息
        if (typeof message.content === 'string') {
          systemText += (systemText ? '\n' : '') + message.content;
        }
        continue;
      }

      if (message.role === 'user') {
        let text = '';
        
        // 将系统消息添加到第一个用户消息中
        if (systemText && contents.length === 0) {
          text = systemText + '\n';
          systemText = ''; // 清空避免重复
        }

        if (typeof message.content === 'string') {
          text += message.content;
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'text' && part.text) {
              text += part.text;
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text }]
        });

      } else if (message.role === 'assistant') {
        let text = '';
        
        if (typeof message.content === 'string') {
          text = message.content;
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'text' && part.text) {
              text += part.text;
            }
          }
        }

        contents.push({
          role: 'model',
          parts: [{ text }]
        });
      }
    }

    return contents;
  }

  private convertAnthropicToolsToGeminiTools(anthropicTools: any[]): any[] {
    return [{
      functionDeclarations: anthropicTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }))
    }];
  }

  private mergeGeminiStreamResponses(responses: any[]): GeminiResponse {
    let fullText = '';
    let finalResponse = null;

    for (const item of responses) {
      const response = item.response || item;
      
      if (response.candidates && response.candidates[0]) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              fullText += part.text;
            }
          }
        }

        if (candidate.finishReason || response.usageMetadata) {
          finalResponse = response;
        }
      }
    }

    return {
      candidates: [{
        content: {
          role: 'model',
          parts: [{ text: fullText }]
        },
        finishReason: finalResponse?.candidates?.[0]?.finishReason || 'STOP'
      }],
      usageMetadata: finalResponse?.usageMetadata
    };
  }

  private convertGeminiContentToAnthropicContent(geminiContent: any): any[] {
    const content = [];

    if (geminiContent.parts) {
      for (const part of geminiContent.parts) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text
          });
        }
        
        if (part.functionCall) {
          content.push({
            type: 'tool_use',
            id: `tool_${Date.now()}`,
            name: part.functionCall.name,
            input: part.functionCall.args
          });
        }
      }
    }

    return content.length > 0 ? content : [{ type: 'text', text: '' }];
  }

  private mapGeminiFinishReasonToAnthropicStopReason(geminiReason?: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence'
    };

    return reasonMap[geminiReason || 'STOP'] || 'end_turn';
  }

  // ============================================================================
  // 类型判断方法
  // ============================================================================

  private isAnthropicRequest(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const obj = input as any;
    
    return (
      typeof obj.model === 'string' &&
      Array.isArray(obj.messages) &&
      obj.messages.every((msg: any) => 
        typeof msg.role === 'string' && 
        ['user', 'assistant', 'system'].includes(msg.role)
      )
    );
  }

  private isGeminiResponse(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    
    // 检查是否是数组格式的流式响应
    if (Array.isArray(input)) {
      return input.some(item => 
        item && 
        typeof item === 'object' && 
        (item.response?.candidates || item.candidates)
      );
    }
    
    // 检查是否是单个响应
    const obj = input as any;
    return !!(
      (obj.candidates && Array.isArray(obj.candidates)) ||
      (obj.response && obj.response.candidates && Array.isArray(obj.response.candidates))
    );
  }
}

/**
 * 工厂函数
 */
export function createSecureGeminiTransformer(config: Partial<SecureTransformerConfig> = {}): SecureGeminiTransformer {
  return new SecureGeminiTransformer(config);
}