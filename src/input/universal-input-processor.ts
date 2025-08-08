/**
 * Universal Input Processor
 * 统一输入处理器，处理各种格式的输入请求
 */

import { BaseRequest } from '@/types';
import { logger } from '@/utils/logger';

export class UniversalInputProcessor {
  constructor(private port?: number) {}

  /**
   * 处理输入请求
   */
  async process(rawRequest: any): Promise<BaseRequest> {
    try {
      // 如果已经是BaseRequest格式，直接返回
      if (this.isBaseRequest(rawRequest)) {
        return rawRequest as BaseRequest;
      }

      // 转换为BaseRequest格式
      const baseRequest: BaseRequest = {
        model: rawRequest.model || 'claude-3-5-sonnet-20241022',
        messages: rawRequest.messages || [],
        max_tokens: rawRequest.max_tokens || 131072,
        temperature: rawRequest.temperature,
        stream: rawRequest.stream || false,
        system: rawRequest.system,
        tools: rawRequest.tools,
        metadata: {
          ...rawRequest.metadata,
          originalModel: rawRequest.model
        }
      };

      return baseRequest;
    } catch (error) {
      logger.error('Universal input processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 检查是否为BaseRequest格式
   */
  private isBaseRequest(request: any): boolean {
    return request && 
           typeof request === 'object' &&
           typeof request.model === 'string' &&
           Array.isArray(request.messages);
  }
}

export function createUniversalInputProcessor(port?: number): UniversalInputProcessor {
  return new UniversalInputProcessor(port);
}