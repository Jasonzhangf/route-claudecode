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
export function mapFinishReason(finishReason: string): string {
  if (!finishReason) {
    return 'end_turn';
  }

  const mappedReason = FINISH_REASON_MAPPING[finishReason];
  if (!mappedReason) {
    throw new Error(`Unknown finish reason '${finishReason}'. Available: ${Object.keys(FINISH_REASON_MAPPING).join(', ')}`);
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
