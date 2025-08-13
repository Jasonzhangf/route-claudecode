/**
 * V3.0 Anthropic Output Processor
 * Handles response formatting to Anthropic-compatible format
 * 
 * Project owner: Jason Zhang
 */

import { BaseResponse } from '../types/index.js';

export class AnthropicOutputProcessor {
  private port: number;

  constructor(port: number) {
    this.port = port;
    console.log(`📤 V3 AnthropicOutputProcessor initialized for port ${port}`);
  }

  async process(response: any, request?: any): Promise<BaseResponse> {
    return this.processResponse(response, 'default');
  }

  async processResponse(response: any, requestId: string): Promise<BaseResponse> {
    // Post-processor: 只做校验和微调，不做格式转换
    const anthropicResponse: BaseResponse = {
      id: response.id || `msg-v3-${Date.now()}`,
      type: response.type || 'message',
      role: response.role || 'assistant',
      content: response.content || [{ type: 'text', text: '' }],
      model: response.model || 'v3-default',
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