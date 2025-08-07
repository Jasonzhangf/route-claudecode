
/**
 * 🔧 流式响应message_stop事件修复
 * 确保在工具调用场景下正确发送结束事件
 */

// 修复建议1: 在流式响应处理中检查工具调用状态
function shouldFilterMessageStop(hasToolCalls, stopReason) {
  // 如果有工具调用且stop_reason已经被修复为tool_use，允许message_stop通过
  if (hasToolCalls && stopReason === 'tool_use') {
    return false; // 不过滤，允许事件通过
  }
  
  // 如果没有工具调用但stop_reason是end_turn，也应该允许通过
  if (!hasToolCalls && stopReason === 'end_turn') {
    return false; // 不过滤，允许事件通过
  }
  
  // 其他情况按原逻辑处理
  return true; // 过滤掉
}

// 修复建议2: 在流式响应结束时发送正确的事件
function generateStreamEndEvent(hasToolCalls, stopReason) {
  if (hasToolCalls) {
    return {
      event: 'message_stop',
      data: {
        type: 'message_stop'
      }
    };
  } else {
    return {
      event: 'message_stop', 
      data: {
        type: 'message_stop'
      }
    };
  }
}

// 修复建议3: 同步预处理器检测结果
function syncToolCallDetectionToStreaming(preprocessingResult, streamingContext) {
  if (preprocessingResult.hasTools) {
    streamingContext.hasToolCalls = true;
    streamingContext.correctedStopReason = preprocessingResult.correctedStopReason;
  }
}
