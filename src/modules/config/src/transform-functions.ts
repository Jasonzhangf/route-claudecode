/**
 * 字段转换函数库
 * 
 * 实现RCC v4.0中所有通用的字段转换逻辑
 */

import { JQJsonHandler } from '../../error-handler/src/utils/jq-json-handler';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { FieldTransformFunction } from './routing-table-types';

/**
 * 转换函数库 - 包含所有通用的字段转换逻辑
 */
export class TransformFunctions {
  
  /** 直接映射转换 */
  static directMap: FieldTransformFunction = (value: any) => value;

  /** 字符串转换 */
  static toString: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  /** 数字转换 */
  static toNumber: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  /** 布尔值转换 */
  static toBoolean: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  };

  /** 范围限制 */
  static rangeLimit(min: number, max: number): FieldTransformFunction {
    return (value: any) => {
      if (value === null || value === undefined) return min;
      const num = Number(value);
      if (isNaN(num)) return min;
      return Math.max(min, Math.min(max, num));
    };
  }

  /** 数组转换 */
  static toArray: FieldTransformFunction = (value: any) => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  };

  /** 对象转换 */
  static toObject: FieldTransformFunction = (value: any) => {
    if (typeof value === 'object' && value !== null) return value;
    if (value === null || value === undefined) return {};
    try {
      const parsed = JSON.parse(String(value));
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };

  /** JSON字符串化 */
  static jsonStringify: FieldTransformFunction = (value: any) => {
    return JQJsonHandler.stringifyJson(value);
  };

  /** JSON解析 */
  static jsonParse: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return null;
    return JQJsonHandler.parseJsonString(String(value));
  };

  /** Anthropic系统消息转换 */
  static anthropicSystemToOpenAI: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .filter(part => part && part.type === 'text' && part.text)
        .map(part => part.text)
        .join(' ');
    }
    return String(value);
  };

  /** Anthropic工具转换 */
  static anthropicToolsToOpenAI: FieldTransformFunction = (value: any, context: any) => {
    if (!Array.isArray(value)) return [];
    
    return value.map(tool => {
      if (!tool || typeof tool !== 'object') {
        return {
          type: 'function',
          function: {
            name: 'unknown',
            description: '',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        };
      }
      
      return {
        type: 'function',
        function: {
          name: String(tool.name || 'unknown'),
          description: String(tool.description || ''),
          parameters: tool.input_schema && typeof tool.input_schema === 'object' 
            ? tool.input_schema 
            : {
                type: 'object',
                properties: {},
                required: []
              }
        }
      };
    });
  };

  /** Anthropic消息转换 - 支持复杂内容结构 */
  static anthropicMessagesToOpenAI: FieldTransformFunction = (value: any, context: any) => {
    if (!Array.isArray(value)) return [];

    const openaiMessages: any[] = [];
    const systemMessages: string[] = [];

    for (const message of value) {
      if (!message || !message.role) continue;

      if (message.role === 'system') {
        const systemContent = TransformFunctions.anthropicSystemToOpenAI(message.content, {});
        if (systemContent) {
          systemMessages.push(systemContent);
        }
      } else {
        const openaiMessage: any = {
          role: message.role,
          content: ''
        };

        // 处理复杂内容结构 (支持Anthropic的content数组)
        if (message.content) {
          if (typeof message.content === 'string') {
            // 简单字符串内容
            openaiMessage.content = message.content;
          } else if (Array.isArray(message.content)) {
            // 复杂内容数组结构处理
            const textParts: string[] = [];
            const toolCalls: any[] = [];
            
            for (const contentBlock of message.content) {
              if (!contentBlock || !contentBlock.type) continue;
              
              switch (contentBlock.type) {
                case 'text':
                  // 文本内容块
                  if (contentBlock.text) {
                    textParts.push(contentBlock.text);
                  }
                  break;
                  
                case 'tool_use':
                  // 工具使用块 - 转换为OpenAI的tool_calls格式
                  if (contentBlock.id && contentBlock.name) {
                    toolCalls.push({
                      id: contentBlock.id,
                      type: 'function',
                      function: {
                        name: contentBlock.name,
                        arguments: typeof contentBlock.input === 'object' 
                          ? JSON.stringify(contentBlock.input) 
                          : contentBlock.input || '{}'
                      }
                    });
                  }
                  break;
                  
                case 'tool_result':
                  // 工具结果块 - 转换为OpenAI的tool role格式
                  const toolResultMessage = {
                    role: 'tool',
                    tool_call_id: contentBlock.tool_use_id || '',
                    content: typeof contentBlock.content === 'object' 
                      ? JSON.stringify(contentBlock.content) 
                      : String(contentBlock.content || '')
                  };
                  openaiMessages.push(toolResultMessage);
                  break;
                  
                default:
                  // 未知类型，作为文本处理
                  if (contentBlock.text) {
                    textParts.push(contentBlock.text);
                  }
                  break;
              }
            }
            
            // 构建最终消息
            if (textParts.length > 0) {
              openaiMessage.content = textParts.join('');
            }
            
            if (toolCalls.length > 0) {
              openaiMessage.tool_calls = toolCalls;
              // 如果有tool_calls但content为空，设置为空字符串
              if (!openaiMessage.content) {
                openaiMessage.content = '';
              }
            }
            
            // 如果既没有内容也没有工具调用，设置默认内容
            if (!openaiMessage.content && !openaiMessage.tool_calls) {
              openaiMessage.content = '';
            }
          } else {
            // 其他情况转为字符串
            openaiMessage.content = String(message.content);
          }
        }

        openaiMessages.push(openaiMessage);
      }
    }

    // 在开头添加系统消息
    if (systemMessages.length > 0) {
      openaiMessages.unshift({
        role: 'system',
        content: systemMessages.join(' ')
      });
    }

    return openaiMessages;
  };

  /** 工具选择转换 */
  static toolChoiceTransform: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return 'auto';
    
    if (typeof value === 'string') {
      switch (value.toLowerCase()) {
        case 'auto': return 'auto';
        case 'none': return 'none';
        case 'required': return 'required';
        case 'any': return 'required';
        default: return 'auto';
      }
    }

    if (typeof value === 'object' && value.name) {
      return {
        type: 'function',
        function: { name: String(value.name) }
      };
    }

    if (typeof value === 'object' && value.function?.name) {
      return {
        type: 'function',
        function: { name: String(value.function.name) }
      };
    }

    return 'auto';
  };

  /** Thinking/Reasoning字段转换 */
  static thinkingToReasoning: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return undefined;
    
    if (typeof value === 'boolean') {
      // 布尔值转换为推理对象
      return {
        type: value ? 'enabled' : 'disabled',
        budget_tokens: 0
      };
    }
    
    if (typeof value === 'object' && value !== null) {
      // 对象格式，直接转换为reasoning格式
      return {
        type: value.type || 'enabled',
        budget_tokens: Number(value.budget_tokens) || 0,
        ...(value.max_tokens !== undefined && { max_tokens: Number(value.max_tokens) }),
        ...(value.temperature !== undefined && { temperature: Number(value.temperature) })
      };
    }
    
    if (typeof value === 'string') {
      // 字符串值，尝试解析为JSON
      try {
        const parsed = JSON.parse(value);
        return TransformFunctions.thinkingToReasoning(parsed, {});
      } catch {
        // 解析失败，作为布尔值处理
        return {
          type: value.toLowerCase() === 'true' ? 'enabled' : 'disabled',
          budget_tokens: 0
        };
      }
    }
    
    // 数字值作为budget_tokens处理
    if (typeof value === 'number') {
      return {
        type: 'enabled',
        budget_tokens: Math.max(0, value)
      };
    }
    
    // 其他情况，启用推理
    return {
      type: 'enabled',
      budget_tokens: 0
    };
  };

  /** Reasoning/Thinking字段逆向转换 */
  static reasoningToThinking: FieldTransformFunction = (value: any) => {
    if (value === null || value === undefined) return undefined;
    
    if (typeof value === 'object' && value !== null) {
      return {
        type: value.type || 'enabled',
        budget_tokens: Number(value.budget_tokens) || 0,
        ...(value.max_tokens !== undefined && { max_tokens: value.max_tokens }),
        ...(value.temperature !== undefined && { temperature: value.temperature })
      };
    }
    
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return TransformFunctions.reasoningToThinking(parsed, {});
      } catch {
        return {
          type: 'enabled',
          budget_tokens: 0
        };
      }
    }
    
    // 布尔值转换
    if (typeof value === 'boolean') {
      return {
        type: value ? 'enabled' : 'disabled',
        budget_tokens: 0
      };
    }
    
    // 默认返回简单对象
    return {
      type: 'enabled',
      budget_tokens: 0
    };
  };

  /** 停止序列转换 */
  static stopSequencesToStop: FieldTransformFunction = (value: any) => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    if (typeof value === 'string') return [value];
    return [String(value)];
  };

  /** 模型名映射 */
  static modelMapping(mapping: Record<string, string>): FieldTransformFunction {
    return (value: any) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      return mapping[stringValue] || stringValue;
    };
  }

  /** 默认值设置 */
  static withDefault(defaultValue: any): FieldTransformFunction {
    return (value: any) => {
      return value !== undefined && value !== null ? value : defaultValue;
    };
  }
}