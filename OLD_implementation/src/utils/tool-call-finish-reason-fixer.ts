/**
 * Tool Call Finish Reason Fixer
 * 统一修复所有工具调用相关的finish reason问题
 */

/**
 * 检查响应是否包含工具调用
 */
export function hasToolCalls(data: any): boolean {
  // 检查Anthropic格式的tool_use
  if (data?.content && Array.isArray(data.content)) {
    const hasToolUse = data.content.some((block: any) => block.type === 'tool_use');
    if (hasToolUse) return true;
  }

  // 检查OpenAI格式的tool_calls
  if (data?.choices && Array.isArray(data.choices)) {
    const hasOpenAIToolCalls = data.choices.some((choice: any) => 
      choice.message?.tool_calls && choice.message.tool_calls.length > 0
    );
    if (hasOpenAIToolCalls) return true;
  }

  // 检查直接的tool_calls字段
  if (data?.tool_calls && Array.isArray(data.tool_calls) && data.tool_calls.length > 0) {
    return true;
  }

  return false;
}

/**
 * 检查文本内容是否包含工具调用模式
 */
export function hasToolCallInText(data: any): boolean {
  if (!data?.content && !data?.choices) return false;

  // 检查Anthropic格式的文本内容
  if (data.content && Array.isArray(data.content)) {
    const hasToolInText = data.content.some((block: any) => {
      if (block.type !== 'text' || !block.text) return false;

      // 检查各种工具调用模式
      const patterns = [
        /Tool\s+call:\s*\w+\s*\(/i,                                    // GLM-4.5格式: Tool call: FunctionName(
        /\{\s*"type"\s*:\s*"tool_use"\s*,/i,                         // Anthropic JSON格式
        /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i,                       // Anthropic ID格式
        /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i,             // Anthropic工具格式
        /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i                    // 直接调用格式
      ];

      return patterns.some(pattern => pattern.test(block.text));
    });
    if (hasToolInText) return true;
  }

  // 检查OpenAI格式的文本内容  
  if (data.choices && Array.isArray(data.choices)) {
    const hasToolInChoices = data.choices.some((choice: any) => {
      const content = choice.message?.content;
      if (typeof content !== 'string') return false;

      // 使用相同的模式检查
      const patterns = [
        /Tool\s+call:\s*\w+\s*\(/i,
        /"function"\s*:\s*\{\s*"name"/i,                             // OpenAI函数调用
        /"tool_calls"\s*:\s*\[/i                                     // OpenAI工具调用数组
      ];

      return patterns.some(pattern => pattern.test(content));
    });
    if (hasToolInChoices) return true;
  }

  return false;
}

/**
 * 修复finish reason为正确的工具调用状态
 * @param data 响应数据
 * @param targetFormat 目标格式 ('anthropic' | 'openai')
 * @returns 更新后的数据
 */
export function fixToolCallFinishReason(data: any, targetFormat: 'anthropic' | 'openai' = 'anthropic'): any {
  if (!data) return data;

  const result = { ...data };
  const hasTools = hasToolCalls(result) || hasToolCallInText(result);

  if (!hasTools) {
    return result;
  }

  // 根据目标格式设置正确的finish reason
  if (targetFormat === 'anthropic') {
    result.stop_reason = 'tool_use';
  } else {
    // OpenAI格式处理
    if (result.choices && Array.isArray(result.choices)) {
      result.choices = result.choices.map((choice: any) => ({
        ...choice,
        finish_reason: 'tool_calls'
      }));
    }
    if (result.finish_reason !== undefined) {
      result.finish_reason = 'tool_calls';
    }
  }

  return result;
}

/**
 * 获取工具调用数量
 */
export function countToolCalls(data: any): number {
  let count = 0;

  // 计算Anthropic格式的tool_use
  if (data?.content && Array.isArray(data.content)) {
    count += data.content.filter((block: any) => block.type === 'tool_use').length;
  }

  // 计算OpenAI格式的tool_calls
  if (data?.choices && Array.isArray(data.choices)) {
    data.choices.forEach((choice: any) => {
      if (choice.message?.tool_calls) {
        count += choice.message.tool_calls.length;
      }
    });
  }

  // 计算直接的tool_calls
  if (data?.tool_calls && Array.isArray(data.tool_calls)) {
    count += data.tool_calls.length;
  }

  return count;
}

/**
 * 生成调试信息
 */
export function generateToolCallDebugInfo(data: any): string {
  const toolCount = countToolCalls(data);
  const hasDirectTools = hasToolCalls(data);
  const hasTextTools = hasToolCallInText(data);
  
  return `Tools: ${toolCount}, Direct: ${hasDirectTools}, Text: ${hasTextTools}`;
}