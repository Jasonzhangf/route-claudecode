/**
 * V3.0 Anthropic Output Processor
 * Handles response formatting to Anthropic-compatible format
 * 
 * Project owner: Jason Zhang
 */

import { BaseResponse } from '../types/index.js';
import { StandardProcessor, ProcessingContext, LayerCapabilities } from '../shared/layer-interface.js';

export class AnthropicOutputProcessor implements StandardProcessor {
  readonly name = 'anthropic-output-processor';
  readonly version = '3.0.1';
  readonly layerType = 'post-processor' as const;
  readonly dependencies: string[] = [];

  private port: number;

  constructor(port: number) {
    this.port = port;
    console.log(`📤 V3 AnthropicOutputProcessor initialized for port ${port}`);
  }

  async process(input: any, context: ProcessingContext): Promise<any> {
    return this.processResponse(input, null, context);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getCapabilities(): LayerCapabilities {
    return {
      supportedOperations: ['post-process', 'validate-format', 'anthropic-format'],
      inputTypes: ['any-response'],
      outputTypes: ['anthropic-response'],
      dependencies: [],
      version: this.version
    };
  }

  async initialize(config?: any): Promise<void> {
    // 初始化处理器
  }

  async cleanup(): Promise<void> {
    // 清理资源
  }

  async processResponse(response: any, originalRequest: any, context: ProcessingContext): Promise<BaseResponse> {
    // Post-processor: 只做校验和微调，不做格式转换
    // 🚨 Zero-fallback principle: 在v3.0.1架构下，Post-processor接收预转换的数据，但仍需验证关键字段
    
    // 基本字段验证（允许合理默认值，因为数据来自Transformer层）
    const anthropicResponse: BaseResponse = {
      id: response.id || `msg-v3-${Date.now()}`,
      type: response.type || 'message',
      role: response.role || 'assistant',
      content: response.content || [{ type: 'text', text: '' }],
      model: response.model || (() => { 
        console.warn('⚠️  Post-processor: Missing model field from Transformer, using fallback');
        return 'v3-default'; 
      })(),
      stop_reason: this.validateStopReason(response),
      usage: response.usage || {
        input_tokens: 0,
        output_tokens: 0
      }
    };

    console.log('📤 V3 Output processed:', {
      id: anthropicResponse.id,
      model: anthropicResponse.model,
      contentLength: JSON.stringify(anthropicResponse.content).length
    });

    return anthropicResponse;
  }

  /**
   * Post-processor校验：检查stop_reason与content的一致性并校正
   */
  private validateStopReason(response: any): string {
    const currentStopReason = response.stop_reason || 'end_turn';
    
    // 检查是否有工具调用但stop_reason不是tool_use
    if (response.content && Array.isArray(response.content)) {
      const hasToolUse = response.content.some((item: any) => item.type === 'tool_use');
      
      if (hasToolUse && currentStopReason !== 'tool_use') {
        console.log('📤 Post-processor校正: 发现工具调用但stop_reason不是tool_use，已校正');
        return 'tool_use';
      }
      
      if (!hasToolUse && currentStopReason === 'tool_use') {
        console.log('📤 Post-processor校正: stop_reason是tool_use但无工具调用，已校正为end_turn');
        return 'end_turn';
      }
    }
    
    return currentStopReason;
  }
}