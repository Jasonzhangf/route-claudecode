/**
 * V3.0 Unified Input Processor
 * Handles multiple input formats (Anthropic, OpenAI, Gemini)
 * 
 * Project owner: Jason Zhang
 */

import { BaseRequest } from '../types/index.js';

export class UnifiedInputProcessor {
  constructor() {
    console.log('🔧 V3 UnifiedInputProcessor initialized');
  }

  canProcess(rawRequest: any): boolean {
    return !!(rawRequest && (rawRequest.messages || rawRequest.prompt));
  }

  async process(rawRequest: any): Promise<BaseRequest> {
    return this.processRequest(rawRequest);
  }

  async processRequest(rawRequest: any): Promise<BaseRequest> {
    // 🚨 Zero-fallback principle: Validate required fields explicitly
    if (!rawRequest.model) {
      throw new Error('Request missing required field: model');
    }
    if (!rawRequest.messages || !Array.isArray(rawRequest.messages)) {
      throw new Error('Request missing required field: messages (must be array)');
    }
    
    // Basic request processing - normalize to standard format
    const request: BaseRequest = {
      model: rawRequest.model,
      max_tokens: rawRequest.max_tokens || 1000,
      messages: rawRequest.messages,
      tools: rawRequest.tools || [],
      stream: rawRequest.stream || false
    };

    console.log('📥 V3 Input processed:', {
      model: request.model,
      messageCount: request.messages.length,
      hasTools: (request.tools?.length || 0) > 0,
      stream: request.stream
    });

    return request;
  }

  validateRequest(request: BaseRequest): boolean {
    if (!request.model) return false;
    if (!Array.isArray(request.messages)) return false;
    if (request.messages.length === 0) return false;
    
    return true;
  }
}