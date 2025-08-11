/**
 * 简化的Finish Reason处理器 - 已弃用
 * 项目所有者: Jason Zhang
 * 
 * ⚠️  此文件已被 src/transformers/response-converter.ts 替代
 * 保留此文件仅为向后兼容性，建议使用新的转换器
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
 * @deprecated 使用 response-converter.ts 中的 mapFinishReasonStrict 替代
 */
export function mapFinishReason(finishReason: string, requestId?: string, hasToolCall?: boolean): string {
  console.warn('⚠️  mapFinishReason is deprecated, use response-converter.ts instead');
  
  if (!finishReason) {
    return 'end_turn';
  }

  const mappedReason = FINISH_REASON_MAPPING[finishReason];
  if (!mappedReason) {
    console.warn(`⚠️  Unknown finish reason '${finishReason}' encountered. Available: ${Object.keys(FINISH_REASON_MAPPING).join(', ')}`);
    if (requestId) {
      console.warn(`   Request ID: ${requestId}`);
    }
    
    // 移除智能推断和fallback，直接抛出错误
    throw new Error(`Unknown finish reason '${finishReason}' - no mapping available and fallback disabled. Use response-converter.ts for proper handling.`);
  }

  return mappedReason;
}

/**
 * 将Anthropic stop reason映射为OpenAI finish reason
 * @deprecated 使用 response-converter.ts 中的 mapStopReasonStrict 替代
 */
export function mapStopReason(stopReason: string): string {
  console.warn('⚠️  mapStopReason is deprecated, use response-converter.ts instead');
  
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
    throw new Error(`Unknown stop reason '${stopReason}'. Available: ${Object.keys(reverseMapping).join(', ')}. Use response-converter.ts for proper handling.`);
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
