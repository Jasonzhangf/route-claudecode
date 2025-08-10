/**
 * 纯净OpenAI API处理器 - 遵循跨节点耦合约束
 * 项目所有者: Jason Zhang
 * 
 * 只负责纯粹的OpenAI API调用，不包含任何transformer逻辑
 * Transformer转换应在Provider外部完成
 */

import OpenAI from 'openai';
import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 纯净API处理配置接口
 */
export interface PureAPIHandlerConfig {
  providerName: string;
  openaiClient: OpenAI;
}

/**
 * 纯净的OpenAI API处理类 - 零跨节点耦合
 * 假设接收的请求已经是OpenAI格式，返回原始OpenAI响应
 */
export class PureOpenAIAPIHandler {
  private config: PureAPIHandlerConfig;

  constructor(config: PureAPIHandlerConfig) {
    this.config = config;
  }

  /**
   * 纯净的非流式API调用 - 假设请求已转换为OpenAI格式
   */
  async callAPI(openaiRequest: any, requestId: string): Promise<any> {
    try {
      logger.debug('Pure OpenAI API call', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        messageCount: openaiRequest.messages?.length || 0,
        requestId,
        provider: this.config.providerName
      }, requestId, 'pure-api-handler');

      // 🎯 纯粹的OpenAI API调用，不做任何转换
      const rawResponse = await this.config.openaiClient.chat.completions.create(openaiRequest);
      
      logger.debug('Pure OpenAI API response received', {
        responseId: rawResponse.id,
        model: rawResponse.model,
        hasChoices: !!(rawResponse.choices && rawResponse.choices.length > 0),
        requestId,
        provider: this.config.providerName
      }, requestId, 'pure-api-handler');

      return rawResponse;

    } catch (error) {
      logger.error('Pure OpenAI API call failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.config.providerName,
        model: openaiRequest?.model,
        requestId
      }, requestId, 'pure-api-handler');

      throw error;
    }
  }

  /**
   * 纯净的流式API调用 - 假设请求已转换为OpenAI格式
   */
  async *callStreamingAPI(openaiRequest: any, requestId: string): AsyncIterable<any> {
    try {
      openaiRequest.stream = true; // 确保流式标志

      logger.debug('Pure OpenAI streaming API call', {
        model: openaiRequest.model,
        hasTools: !!(openaiRequest.tools && openaiRequest.tools.length > 0),
        requestId,
        provider: this.config.providerName
      }, requestId, 'pure-api-handler');

      // 🎯 纯粹的流式OpenAI API调用
      const stream = await this.config.openaiClient.chat.completions.create(openaiRequest) as any;

      for await (const chunk of stream) {
        // 直接传递原始chunk，不做任何转换
        yield chunk;
      }

      logger.debug('Pure OpenAI streaming completed', {
        requestId,
        provider: this.config.providerName
      }, requestId, 'pure-api-handler');

    } catch (error) {
      logger.error('Pure OpenAI streaming API call failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: this.config.providerName,
        model: openaiRequest?.model,
        requestId
      }, requestId, 'pure-api-handler');

      throw error;
    }
  }

  /**
   * 获取provider名称
   */
  get providerName(): string {
    return this.config.providerName;
  }
}

/**
 * 创建纯净API处理器
 */
export function createPureAPIHandler(config: PureAPIHandlerConfig): PureOpenAIAPIHandler {
  return new PureOpenAIAPIHandler(config);
}