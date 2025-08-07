/**
 * 简化的Finish Reason处理器
 * 只做最基本的映射，不做多余的判断和推断
 */

/**
 * 基础的Finish Reason映射表
 */
const FINISH_REASON_MAPPING: Record<string, string> = {
  // OpenAI -> Anthropic
  'stop': 'end_turn',
  'length': 'max_tokens',
  'tool_calls': 'tool_use',
  'function_call': 'tool_use',
  'content_filter': 'stop_sequence',
};

/**
 * 将OpenAI finish reason映射为Anthropic stop reason
 */
export function mapFinishReason(finishReason: string, requestId?: string, hasToolCall?: boolean): string {
  if (!finishReason) {
    return 'end_turn';
  }

  // 🚨 紧急修复：如果检测到工具调用，优先返回tool_use
  if (hasToolCall && (finishReason === 'length' || finishReason === 'max_tokens')) {
    console.warn(`⚠️  Tool call detected with ${finishReason} finish_reason, mapping to tool_use`, { requestId });
    return 'tool_use';
  }

  const mappedReason = FINISH_REASON_MAPPING[finishReason];
  if (!mappedReason) {
    // 记录未知的finish reason但不抛出错误
    console.warn(`⚠️  Unknown finish reason '${finishReason}' encountered. Available: ${Object.keys(FINISH_REASON_MAPPING).join(', ')}`);
    if (requestId) {
      console.warn(`   Request ID: ${requestId}`);
    }
    
    // 根据finish reason的内容进行智能推断
    const lowerReason = finishReason.toLowerCase();
    
    // 尝试智能映射
    if (lowerReason.includes('stop') || lowerReason.includes('end') || lowerReason.includes('complete')) {
      console.warn(`   Mapping '${finishReason}' to 'end_turn' (stop-like)`);
      return 'end_turn';
    }
    if (lowerReason.includes('length') || lowerReason.includes('token') || lowerReason.includes('max')) {
      console.warn(`   Mapping '${finishReason}' to 'max_tokens' (length-like)`);
      return 'max_tokens';
    }
    if (lowerReason.includes('tool') || lowerReason.includes('function') || lowerReason.includes('call')) {
      console.warn(`   Mapping '${finishReason}' to 'tool_use' (tool-like)`);
      return 'tool_use';
    }
    if (lowerReason.includes('filter') || lowerReason.includes('content') || lowerReason.includes('safety')) {
      console.warn(`   Mapping '${finishReason}' to 'stop_sequence' (filter-like)`);
      return 'stop_sequence';
    }
    
    // 默认映射到end_turn并记录
    console.warn(`   Mapping unknown '${finishReason}' to 'end_turn' (default fallback)`);
    return 'end_turn';
  }

  return mappedReason;
}

/**
 * 将Anthropic stop reason映射为OpenAI finish reason
 */
export function mapStopReason(stopReason: string): string {
  if (!stopReason) {
    return 'stop';
  }

  // 创建反向映射
  const reverseMapping: Record<string, string> = {
    'end_turn': 'stop',
    'max_tokens': 'length',
    'tool_use': 'tool_calls',
    'stop_sequence': 'stop',
  };

  const mappedReason = reverseMapping[stopReason];
  if (!mappedReason) {
    throw new Error(`Unknown stop reason '${stopReason}'. Available: ${Object.keys(reverseMapping).join(', ')}`);
  }

  return mappedReason;
}

/**
 * 获取所有支持的finish reasons
 */
export function getSupportedFinishReasons(): string[] {
  return Object.keys(FINISH_REASON_MAPPING);
}

/**
 * 获取所有支持的stop reasons
 */
export function getSupportedStopReasons(): string[] {
  return Object.values(FINISH_REASON_MAPPING);
}
