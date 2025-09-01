/**
 * Anthropic to OpenAI Protocol Converter
 *
 * 基于CLIProxyAPI实现的完整Anthropic ↔ OpenAI协议转换器
 * 修复所有格式验证问题，确保Protocol层接收到纯OpenAI格式
 *
 * @author Jason Zhang
 * @version 1.0.0
 * @based-on CLIProxyAPI transformer implementation
 */

import { JQJsonHandler } from '../../utils/jq-json-handler';

/**
 * 核心转换方法: Anthropic → OpenAI
 * 基于CLIProxyAPI的实现模式
 */
export function transformAnthropicToOpenAI(anthropicRequest: any): any {
  const openaiRequest: any = {};

  // 1. 基本字段映射
  if (anthropicRequest.model) {
    openaiRequest.model = anthropicRequest.model;
  }

  if (typeof anthropicRequest.max_tokens === 'number') {
    openaiRequest.max_tokens = anthropicRequest.max_tokens;
  } else {
    openaiRequest.max_tokens = 4096;
  }

  if (typeof anthropicRequest.temperature === 'number') {
    openaiRequest.temperature = anthropicRequest.temperature;
  }

  if (typeof anthropicRequest.top_p === 'number') {
    openaiRequest.top_p = anthropicRequest.top_p;
  }

  if (anthropicRequest.stop_sequences && Array.isArray(anthropicRequest.stop_sequences)) {
    openaiRequest.stop = anthropicRequest.stop_sequences;
  }

  if (typeof anthropicRequest.stream === 'boolean') {
    openaiRequest.stream = anthropicRequest.stream;
  }

  // 2. 消息转换
  openaiRequest.messages = [];

  // 处理系统消息
  if (anthropicRequest.system) {
    openaiRequest.messages.push({
      role: 'system',
      content: anthropicRequest.system
    });
  }

  // 处理消息数组
  if (anthropicRequest.messages && Array.isArray(anthropicRequest.messages)) {
    for (const message of anthropicRequest.messages) {
      const openaiMessage = convertAnthropicMessage(message);
      if (openaiMessage) {
        openaiRequest.messages.push(openaiMessage);
      }
    }
  }

  // 3. 工具定义转换 (最关键的部分)
  if (anthropicRequest.tools && Array.isArray(anthropicRequest.tools)) {
    openaiRequest.tools = [];
    for (const anthropicTool of anthropicRequest.tools) {
      const openaiTool = convertAnthropicTool(anthropicTool);
      if (openaiTool) {
        openaiRequest.tools.push(openaiTool);
      }
    }
  }

  // 4. 工具选择转换
  if (anthropicRequest.tool_choice) {
    if (anthropicRequest.tool_choice === 'auto') {
      openaiRequest.tool_choice = 'auto';
    } else if (anthropicRequest.tool_choice === 'any') {
      openaiRequest.tool_choice = 'required';
    } else if (typeof anthropicRequest.tool_choice === 'object' && anthropicRequest.tool_choice.name) {
      openaiRequest.tool_choice = {
        type: 'function',
        function: { name: anthropicRequest.tool_choice.name }
      };
    }
  }

  return openaiRequest;
}

/**
 * 转换Anthropic消息到OpenAI格式
 */
function convertAnthropicMessage(anthropicMessage: any): any {
  if (!anthropicMessage || !anthropicMessage.role) {
    return null;
  }

  const openaiMessage: any = {
    role: anthropicMessage.role
  };

  // 处理内容
  if (anthropicMessage.content) {
    if (typeof anthropicMessage.content === 'string') {
      openaiMessage.content = anthropicMessage.content;
    } else if (Array.isArray(anthropicMessage.content)) {
      // 处理Anthropic的内容数组
      const textParts = [];
      const toolCalls = [];

      for (const part of anthropicMessage.content) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text);
        } else if (part.type === 'tool_use' && part.name) {
          // 转换工具调用
          toolCalls.push({
            id: part.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: part.name,
              arguments: JQJsonHandler.stringifyJson(part.input || {})
            }
          });
        }
      }

      // 设置内容和工具调用
      openaiMessage.content = textParts.join(' ') || null;
      if (toolCalls.length > 0) {
        openaiMessage.tool_calls = toolCalls;
      }
    }
  }

  return openaiMessage;
}

/**
 * 转换Anthropic工具到OpenAI格式
 * 这是解决16个工具定义验证失败的关键方法
 */
function convertAnthropicTool(anthropicTool: any): any {
  if (!anthropicTool || !anthropicTool.name) {
    return null;
  }

  // Anthropic格式: {name, description, input_schema}
  // OpenAI格式: {type: "function", function: {name, description, parameters}}
  const openaiTool = {
    type: 'function',
    function: {
      name: anthropicTool.name,
      description: anthropicTool.description || '',
      parameters: anthropicTool.input_schema || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  };

  return openaiTool;
}