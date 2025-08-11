/**
 * 统一响应转换器
 * 项目所有者: Jason Zhang
 * 
 * 遵循核心原则: 模型发送什么我们就返回什么
 * - 不使用fallback机制
 * - 不设置默认值
 * - 保持响应的原始性
 */

import { logger } from '@/utils/logger';
import { AnthropicResponse, BaseRequest } from '@/types';

/**
 * 严格的finish reason映射表 - 只映射明确支持的类型
 */
const STRICT_FINISH_REASON_MAPPING: Record<string, string> = {
  // OpenAI -> Anthropic 标准映射
  'stop': 'end_turn',
  'length': 'max_tokens', 
  'tool_calls': 'tool_use',
  'function_call': 'tool_use',
  'content_filter': 'stop_sequence',
};

/**
 * 严格的stop reason映射表 - 只映射明确支持的类型
 */
const STRICT_STOP_REASON_MAPPING: Record<string, string> = {
  // Anthropic -> OpenAI 标准映射
  'end_turn': 'stop',
  'max_tokens': 'length',
  'tool_use': 'tool_calls',
  'stop_sequence': 'stop',
};

/**
 * OpenAI消息内容转换为Anthropic内容格式
 */
export function convertOpenAIMessageToAnthropicContent(message: any): any[] {
  const content: any[] = [];

  // 处理文本内容
  if (typeof message.content === 'string' && message.content.trim()) {
    content.push({ type: 'text', text: message.content });
  } else if (Array.isArray(message.content)) {
    message.content.forEach((block: any) => {
      if (block.type === 'text' && block.text) {
        content.push({ type: 'text', text: block.text });
      } else {
        content.push(block); // 保持其他类型不变
      }
    });
  } else if (message.content && typeof message.content !== 'string') {
    content.push({ type: 'text', text: String(message.content) });
  }

  // 处理工具调用
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    logger.debug('Converting OpenAI tool_calls to Anthropic tool_use format', {
      toolCallsCount: message.tool_calls.length,
      tools: message.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function?.name }))
    });

    message.tool_calls.forEach((toolCall: any, index: number) => {
      if (!toolCall.function?.name) {
        logger.warn('Skipping tool call without function name', { toolCall, index });
        return;
      }

      let parsedInput = {};
      if (toolCall.function.arguments) {
        try {
          parsedInput = JSON.parse(toolCall.function.arguments);
        } catch (error) {
          logger.warn('Failed to parse tool call arguments', {
            toolName: toolCall.function.name,
            arguments: toolCall.function.arguments,
            error: error instanceof Error ? error.message : String(error)
          });
          parsedInput = { arguments: toolCall.function.arguments };
        }
      }

      // 标准化工具ID格式
      let toolId = toolCall.id;
      if (!toolId || !toolId.startsWith('toolu_')) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 8);
        toolId = `toolu_${timestamp}_${random}`;
        
        logger.debug('Standardized tool ID format', {
          originalId: toolCall.id,
          standardizedId: toolId,
          toolName: toolCall.function.name
        });
      }

      content.push({
        type: 'tool_use',
        id: toolId,
        name: toolCall.function.name,
        input: parsedInput
      });
    });
  }

  // 如果没有任何内容，返回空文本块
  if (content.length === 0) {
    return [{ type: 'text', text: '' }];
  }

  return content;
}

/**
 * 标准化内容块为Anthropic格式
 */
export function normalizeToAnthropicContent(content: any): any[] {
  if (!content) return [];
  
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    return content.map(block => normalizeContentBlock(block));
  }

  if (typeof content === 'object') {
    return [normalizeContentBlock(content)];
  }

  return [{ type: 'text', text: String(content) }];
}

/**
 * 标准化单个内容块
 */
function normalizeContentBlock(block: any): any {
  if (typeof block === 'string') {
    return { type: 'text', text: block };
  }

  if (!block || typeof block !== 'object') {
    return { type: 'text', text: String(block) };
  }

  // 已经是正确格式
  if (block.type && (block.text || block.id || block.content)) {
    return block;
  }

  // 转换常见格式
  if (block.content && !block.type) {
    return { type: 'text', text: block.content };
  }

  if (block.message && !block.type) {
    return { type: 'text', text: block.message };
  }

  // 默认转换为文本块
  return { type: 'text', text: JSON.stringify(block) };
}

/**
 * 严格的finish reason映射 - 不使用fallback
 * @param finishReason 原始finish reason
 * @returns 映射后的stop reason，如果无法映射则抛出错误
 */
export function mapFinishReasonStrict(finishReason?: string): string {
  if (!finishReason) {
    throw new Error('mapFinishReasonStrict: finishReason is required but was undefined/empty - this indicates a potential silent failure upstream');
  }

  if (finishReason === 'unknown') {
    throw new Error(`mapFinishReasonStrict: received 'unknown' finish reason - this indicates a provider connection issue that should be handled upstream`);
  }

  const mappedReason = STRICT_FINISH_REASON_MAPPING[finishReason];
  if (!mappedReason) {
    throw new Error(`mapFinishReasonStrict: Unknown finish reason '${finishReason}' - no mapping available. Supported: ${Object.keys(STRICT_FINISH_REASON_MAPPING).join(', ')}`);
  }

  return mappedReason;
}

/**
 * 严格的stop reason映射 - 不使用fallback
 * @param stopReason 原始stop reason
 * @returns 映射后的finish reason，如果无法映射则抛出错误
 */
export function mapStopReasonStrict(stopReason?: string): string {
  if (!stopReason) {
    throw new Error('mapStopReasonStrict: stopReason is required but was undefined/empty - this indicates a potential silent failure upstream');
  }

  if (stopReason === 'unknown') {
    throw new Error(`mapStopReasonStrict: received 'unknown' stop reason - this indicates a provider connection issue that should be handled upstream`);
  }

  const mappedReason = STRICT_STOP_REASON_MAPPING[stopReason];
  if (!mappedReason) {
    throw new Error(`mapStopReasonStrict: Unknown stop reason '${stopReason}' - no mapping available. Supported: ${Object.keys(STRICT_STOP_REASON_MAPPING).join(', ')}`);
  }

  return mappedReason;
}

/**
 * 将OpenAI格式响应转换为Anthropic格式
 * 严格遵循"模型发送什么就返回什么"原则
 */
export function convertOpenAIResponseToAnthropic(
  response: any,
  originalRequest: BaseRequest,
  requestId: string
): AnthropicResponse {
  const choice = response.choices?.[0];
  if (!choice) {
    throw new Error('No choices in OpenAI response');
  }

  const content = convertOpenAIMessageToAnthropicContent(choice.message);
  
  let mappedStopReason: string | undefined;
  
  // 尝试严格映射finish reason，如果失败则记录错误
  if (choice.finish_reason) {
    try {
      mappedStopReason = mapFinishReasonStrict(choice.finish_reason);
    } catch (error) {
      // 映射失败是严重错误，应该抛出而不是静默忽略
      const errorMessage = `Failed to map OpenAI finish_reason '${choice.finish_reason}' to Anthropic stop_reason: ${error instanceof Error ? error.message : String(error)}`;
      logger.error('Critical: finish_reason mapping failed', {
        originalFinishReason: choice.finish_reason,
        error: errorMessage,
        requestId,
        model: originalRequest.model,
        provider: originalRequest.metadata?.targetProvider
      }, requestId, 'response-converter');
      
      // 抛出错误以防止静默失败
      throw new Error(`${errorMessage}. This indicates a system integration issue that must be fixed.`);
    }
  }

  const anthropicResponse: AnthropicResponse = {
    content: content,
    id: response.id || `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
    model: originalRequest.metadata?.originalModel || originalRequest.model,
    role: 'assistant',
    type: 'message',
    stop_sequence: undefined,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0
    }
  };

  // 只有在成功映射时才设置stop_reason
  if (mappedStopReason) {
    anthropicResponse.stop_reason = mappedStopReason;
  }
  
  logger.debug('Converted OpenAI response to Anthropic format', {
    originalFinishReason: choice.finish_reason,
    mappedStopReason: mappedStopReason || 'undefined',
    contentBlocks: content.length,
    requestId
  }, requestId, 'response-converter');

  return anthropicResponse;
}

/**
 * 验证并标准化已有的Anthropic格式响应
 */
export function validateAndNormalizeAnthropicResponse(
  response: any,
  originalRequest: BaseRequest,
  requestId: string
): AnthropicResponse {
  const content = normalizeToAnthropicContent(response.content);
  
  const normalized: AnthropicResponse = {
    content: content,
    id: response.id || `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
    model: originalRequest.metadata?.originalModel || originalRequest.model,
    role: 'assistant',
    type: 'message',
    stop_sequence: response.stop_sequence || undefined,
    usage: {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0
    }
  };

  // 保持原有的stop_reason，除非它是'unknown'
  if (response.stop_reason && response.stop_reason !== 'unknown') {
    normalized.stop_reason = response.stop_reason;
  }

  logger.debug('Validated and normalized Anthropic response', {
    id: normalized.id,
    contentBlocks: normalized.content.length,
    originalStopReason: response.stop_reason,
    finalStopReason: normalized.stop_reason || 'undefined',
    requestId
  }, requestId, 'response-converter');

  return normalized;
}

/**
 * 从各种格式转换为Anthropic响应
 */
export function convertToAnthropicResponse(
  response: any,
  originalRequest: BaseRequest,
  requestId: string
): AnthropicResponse {
  // OpenAI格式
  if (response.choices && Array.isArray(response.choices)) {
    return convertOpenAIResponseToAnthropic(response, originalRequest, requestId);
  }

  // 已经是Anthropic格式
  if (response && response.role === 'assistant' && Array.isArray(response.content)) {
    return validateAndNormalizeAnthropicResponse(response, originalRequest, requestId);
  }

  // 内容数组格式
  if (Array.isArray(response)) {
    const content = normalizeToAnthropicContent(response);
    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model,
      content: content,
      stop_sequence: undefined,
      usage: {
        input_tokens: 0,
        output_tokens: Math.ceil(JSON.stringify(content).length / 4)
      }
    };
  }

  // 简单文本格式
  if (typeof response === 'string') {
    const content = [{ type: 'text', text: response }];
    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model,
      content: content,
      stop_sequence: undefined,
      usage: {
        input_tokens: 0,
        output_tokens: Math.ceil(response.length / 4)
      }
    };
  }

  // 结构化响应格式
  if (response && typeof response === 'object' && response.content) {
    const content = normalizeToAnthropicContent(response.content);
    const result: AnthropicResponse = {
      id: response.id || `msg_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
      type: 'message',
      role: 'assistant',
      model: originalRequest.metadata?.originalModel || originalRequest.model,
      content: content,
      stop_sequence: response.stop_sequence || undefined,
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || Math.ceil(JSON.stringify(content).length / 4)
      }
    };

    // 只有在有效的stop_reason时才设置
    if (response.stop_reason && response.stop_reason !== 'unknown') {
      result.stop_reason = response.stop_reason;
    }

    return result;
  }

  throw new Error(`Unsupported response format for conversion: ${typeof response}`);
}

/**
 * 获取支持的finish reasons
 */
export function getSupportedFinishReasons(): string[] {
  return Object.keys(STRICT_FINISH_REASON_MAPPING);
}

/**
 * 获取支持的stop reasons
 */
export function getSupportedStopReasons(): string[] {
  return Object.values(STRICT_FINISH_REASON_MAPPING);
}