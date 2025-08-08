/**
 * 统一响应验证模块
 * 项目所有者: Jason Zhang
 * 
 * 消除重复的静默失败检测逻辑，提供统一的响应验证接口
 * 遵循零硬编码、零Fallback、零静默失败原则
 */

import { BaseResponse } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 响应验证错误类型
 */
export class ResponseValidationError extends Error {
  constructor(
    message: string,
    public readonly requestId: string,
    public readonly provider: string,
    public readonly validationType: 'non-streaming' | 'streaming'
  ) {
    super(message);
    this.name = 'ResponseValidationError';
  }
}

/**
 * 流式块验证错误类型
 */
export class StreamChunkValidationError extends Error {
  constructor(
    message: string,
    public readonly requestId: string,
    public readonly provider: string,
    public readonly chunkIndex: number
  ) {
    super(message);
    this.name = 'StreamChunkValidationError';
  }
}

/**
 * 🚨 Critical: 验证非流式响应，防止静默失败
 * 统一的响应验证逻辑，消除重复代码
 */
export function validateNonStreamingResponse(
  response: BaseResponse, 
  requestId: string, 
  providerName: string
): void {
  // 验证响应对象存在
  if (!response) {
    const error = new ResponseValidationError(
      'Response is null or undefined - silent failure detected',
      requestId,
      providerName,
      'non-streaming'
    );
    console.error(`🚨 [${providerName}] SILENT FAILURE: Null response for ${requestId}`);
    throw error;
  }

  // 验证内容存在
  if (!response.content || response.content.length === 0) {
    const error = new ResponseValidationError(
      'Response has no content - potential silent failure',
      requestId,
      providerName,
      'non-streaming'
    );
    console.error(`🚨 [${providerName}] SILENT FAILURE: Empty content for ${requestId}`);
    throw error;
  }

  // 验证stop_reason存在
  if (!response.stop_reason) {
    const error = new ResponseValidationError(
      'Response missing stop_reason - potential silent failure',
      requestId,
      providerName,
      'non-streaming'
    );
    console.error(`🚨 [${providerName}] SILENT FAILURE: Missing stop_reason for ${requestId}`);
    throw error;
  }

  // 🚨 Critical: 检查fallback值（违反零fallback原则）
  if (response.stop_reason === 'unknown' || response.stop_reason === 'default') {
    const error = new ResponseValidationError(
      `Response has fallback stop_reason: ${response.stop_reason} - violates zero fallback principle`,
      requestId,
      providerName,
      'non-streaming'
    );
    console.error(`🚨 [${providerName}] FALLBACK VIOLATION: ${response.stop_reason} for ${requestId}`);
    throw error;
  }

  // 验证使用信息
  if (!response.usage) {
    logger.warn('Response missing usage information', {
      requestId,
      provider: providerName
    });
  }

  logger.debug('Non-streaming response validation passed', {
    requestId,
    provider: providerName,
    contentLength: response.content.length,
    stopReason: response.stop_reason,
    hasUsage: !!response.usage
  });
}

/**
 * 🚨 Critical: 验证流式chunk，防止静默失败
 * 统一的流式验证逻辑，消除重复代码
 */
export function validateStreamingChunk(
  chunk: any, 
  requestId: string, 
  providerName: string, 
  chunkIndex: number
): void {
  // 验证chunk存在
  if (!chunk) {
    const error = new StreamChunkValidationError(
      `Streaming chunk ${chunkIndex} is null/undefined - silent failure detected`,
      requestId,
      providerName,
      chunkIndex
    );
    console.error(`🚨 [${providerName}] STREAMING SILENT FAILURE: Null chunk ${chunkIndex} for ${requestId}`);
    throw error;
  }

  // 验证event类型存在
  if (!chunk.event) {
    const error = new StreamChunkValidationError(
      `Streaming chunk ${chunkIndex} missing event type - malformed chunk`,
      requestId,
      providerName,
      chunkIndex
    );
    console.error(`🚨 [${providerName}] STREAMING MALFORMED: Missing event in chunk ${chunkIndex} for ${requestId}`);
    throw error;
  }

  // 🚨 Critical: 检查fallback事件类型（违反零fallback原则）
  if (chunk.event === 'unknown' || chunk.event === 'default' || chunk.event === 'fallback') {
    const error = new StreamChunkValidationError(
      `Streaming chunk has fallback event: ${chunk.event} - violates zero fallback principle`,
      requestId,
      providerName,
      chunkIndex
    );
    console.error(`🚨 [${providerName}] STREAMING FALLBACK VIOLATION: ${chunk.event} in chunk ${chunkIndex} for ${requestId}`);
    throw error;
  }

  // 验证chunk数据结构（除了ping事件）
  if (chunk.event !== 'ping' && !chunk.data) {
    const error = new StreamChunkValidationError(
      `Streaming chunk ${chunkIndex} missing data - malformed chunk`,
      requestId,
      providerName,
      chunkIndex
    );
    console.error(`🚨 [${providerName}] STREAMING MALFORMED: Missing data in chunk ${chunkIndex} for ${requestId}`);
    throw error;
  }

  logger.trace(requestId, 'validation', 'Streaming chunk validation passed', {
    chunkIndex,
    event: chunk.event,
    hasData: !!chunk.data,
    provider: providerName
  });
}

/**
 * 验证流式请求是否产生了有效内容
 */
export function validateStreamingCompletion(
  chunkCount: number,
  hasValidContent: boolean,
  requestId: string,
  providerName: string
): void {
  if (chunkCount === 0) {
    const error = new StreamChunkValidationError(
      'Streaming request produced no chunks - potential silent failure',
      requestId,
      providerName,
      0
    );
    console.error(`🚨 [${providerName}] STREAMING SILENT FAILURE DETECTED:`);
    console.error(`   Request ID: ${requestId}`);
    console.error(`   Chunks: ${chunkCount}`);
    console.error(`   Valid Content: ${hasValidContent}`);
    console.error(`   RESULT: Throwing error to prevent silent failure`);
    throw error;
  }

  if (!hasValidContent) {
    logger.warn('Streaming request completed without valid content', {
      requestId,
      provider: providerName,
      chunkCount
    });
  }
}

/**
 * 检查是否为有效内容chunk
 */
export function isValidContentChunk(chunk: any): boolean {
  if (!chunk || !chunk.event) {
    return false;
  }

  const validContentEvents = [
    'content_block_delta',
    'content_block_start', 
    'message_start'
  ];

  return validContentEvents.includes(chunk.event);
}

/**
 * 提取finish reason从chunk
 */
export function extractFinishReasonFromChunk(chunk: any): string | undefined {
  if (chunk?.event === 'message_delta' && chunk?.data?.delta?.stop_reason) {
    return chunk.data.delta.stop_reason;
  }
  return undefined;
}

/**
 * 统一的错误处理函数
 */
export function handleProviderError(
  error: any,
  requestId: string,
  providerName: string,
  operationType: 'streaming' | 'non-streaming'
): never {
  const httpStatus = (error as any)?.response?.status || (error as any)?.status || 500;
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  console.error(`🚨 [${providerName}] ${operationType.toUpperCase()} REQUEST FAILED - NO SILENT FAILURE:`);
  console.error(`   Request ID: ${requestId}`);
  console.error(`   Status: ${httpStatus}`);
  console.error(`   Error: ${errorMessage}`);
  console.error(`   Provider: ${providerName}`);
  console.error(`   RESULT: Throwing error to client`);

  // 重新抛出原错误，确保错误类型和堆栈信息保持不变
  throw error;
}