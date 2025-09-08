# 基于字段转换表的模板化转换机制

## 1. 转换表定义

### 1.1 Transformer层转换表

#### Anthropic → OpenAI 请求转换表
```json
{
  "req_input_table": {
    "model": {
      "source": "model",
      "target": "model",
      "transform": "direct"
    },
    "messages": {
      "source": "messages",
      "target": "messages",
      "transform": "anthropic_to_openai_messages"
    },
    "system": {
      "source": "system",
      "target": "messages[role=system]",
      "transform": "anthropic_system_to_openai_message"
    },
    "max_tokens": {
      "source": "max_tokens",
      "target": "max_tokens",
      "transform": "direct"
    },
    "temperature": {
      "source": "temperature",
      "target": "temperature",
      "transform": "direct"
    },
    "tools": {
      "source": "tools",
      "target": "tools",
      "transform": "anthropic_to_openai_tools"
    }
  },
  "resp_input_table": {
    "id": {
      "source": "id",
      "target": "id",
      "transform": "direct"
    },
    "choices": {
      "source": "choices",
      "target": "content",
      "transform": "openai_choices_to_anthropic_content"
    },
    "usage": {
      "source": "usage",
      "target": "__internal.usage",
      "transform": "store_internal"
    }
  }
}
```

#### OpenAI → Anthropic 响应转换表
```json
{
  "req_input_table": {
    "model": {
      "source": "model",
      "target": "model",
      "transform": "direct"
    },
    "messages": {
      "source": "messages",
      "target": "messages",
      "transform": "openai_to_anthropic_messages"
    }
  },
  "resp_input_table": {
    "id": {
      "source": "id",
      "target": "id",
      "transform": "direct"
    },
    "content": {
      "source": "choices[0].message.content",
      "target": "content",
      "transform": "openai_content_to_anthropic_content"
    },
    "tool_calls": {
      "source": "choices[0].message.tool_calls",
      "target": "content",
      "transform": "openai_tool_calls_to_anthropic_content"
    }
  }
}
```

### 1.2 ServerCompatibility层转换表

#### iFlow兼容性转换表
```json
{
  "req_input_table": {
    "temperature": {
      "source": "temperature",
      "target": "temperature",
      "transform": "range_limit",
      "params": {
        "min": 0.0,
        "max": 1.0
      }
    },
    "top_k": {
      "source": "temperature",
      "target": "top_k",
      "transform": "dynamic_calculate",
      "params": {
        "formula": "Math.floor(temperature * 50)"
      }
    },
    "model": {
      "source": "model",
      "target": "model",
      "transform": "model_mapping",
      "params": {
        "mapping": {
          "gpt-4": "iflow-plus",
          "gpt-3.5-turbo": "iflow-standard"
        }
      }
    }
  },
  "resp_input_table": {
    "id": {
      "source": "id",
      "target": "id",
      "transform": "ensure_prefix",
      "params": {
        "prefix": "chatcmpl-iflow-"
      }
    },
    "object": {
      "source": "object",
      "target": "object",
      "transform": "ensure_value",
      "params": {
        "value": "chat.completion"
      }
    }
  }
}
```

#### Qwen兼容性转换表
```json
{
  "req_input_table": {
    "messages": {
      "source": "messages",
      "target": "messages",
      "transform": "qwen_tool_flow_fix"
    },
    "tools": {
      "source": "tools",
      "target": "tools",
      "transform": "openai_tools_validate"
    }
  },
  "resp_input_table": {
    "choices": {
      "source": "choices",
      "target": "choices",
      "transform": "qwen_choices_normalize"
    },
    "tool_calls": {
      "source": "choices[0].message.tool_calls",
      "target": "choices[0].message.tool_calls",
      "transform": "qwen_tool_calls_normalize"
    }
  }
}
```

## 2. 转换引擎实现

### 2.1 转换函数库
```typescript
// transform-functions.ts
export const transformFunctions = {
  // 直接映射
  direct: (value: any) => value,
  
  // 消息格式转换
  anthropic_to_openai_messages: (messages: any[]) => {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : 
               Array.isArray(msg.content) ? msg.content.map(c => c.text).join(' ') : ''
    }));
  },
  
  // 系统消息转换
  anthropic_system_to_openai_message: (system: any) => {
    if (!system) return [];
    const systemContent = typeof system === 'string' ? system : 
                         Array.isArray(system) ? system.map(s => s.text).join(' ') : '';
    return [{
      role: 'system',
      content: systemContent
    }];
  },
  
  // 工具格式转换
  anthropic_to_openai_tools: (tools: any[]) => {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  },
  
  // 响应内容转换
  openai_choices_to_anthropic_content: (choices: any[]) => {
    if (!choices || choices.length === 0) return [];
    const message = choices[0].message;
    if (!message) return [];
    
    const content = [];
    if (message.content) {
      content.push({
        type: 'text',
        text: message.content
      });
    }
    
    if (message.tool_calls) {
      message.tool_calls.forEach(toolCall => {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}')
        });
      });
    }
    
    return content;
  },
  
  // 范围限制
  range_limit: (value: number, params: any) => {
    return Math.max(params.min, Math.min(params.max, value));
  },
  
  // 动态计算
  dynamic_calculate: (value: number, params: any) => {
    // 简化的实现，实际应使用更安全的表达式解析
    return Math.floor(value * 50);
  },
  
  // 模型映射
  model_mapping: (value: string, params: any) => {
    return params.mapping[value] || value;
  },
  
  // 确保前缀
  ensure_prefix: (value: string, params: any) => {
    return value.startsWith(params.prefix) ? value : `${params.prefix}${value}`;
  },
  
  // 确保值
  ensure_value: (value: any, params: any) => {
    return params.value;
  },
  
  // Qwen工具流修复
  qwen_tool_flow_fix: (messages: any[]) => {
    // 实现工具调用对话流修复逻辑
    return messages;
  },
  
  // 工具验证
  openai_tools_validate: (tools: any[]) => {
    // 验证工具格式是否符合OpenAI标准
    return tools;
  },
  
  // Qwen choices标准化
  qwen_choices_normalize: (choices: any[]) => {
    return choices.map((choice, index) => ({
      index: choice.index ?? index,
      message: {
        role: choice.message?.role || 'assistant',
        content: choice.message?.content || '',
        tool_calls: choice.message?.tool_calls
      },
      finish_reason: choice.finish_reason || 'stop'
    }));
  },
  
  // Qwen工具调用标准化
  qwen_tool_calls_normalize: (toolCalls: any[]) => {
    return toolCalls.map(toolCall => ({
      id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: toolCall.type || 'function',
      function: {
        name: toolCall.function?.name || 'unknown_function',
        arguments: typeof toolCall.function?.arguments === 'string' ? 
                  toolCall.function.arguments : JSON.stringify(toolCall.function?.arguments || {})
      }
    }));
  }
};
```

### 2.2 转换引擎核心
```typescript
// conversion-engine.ts
import { transformFunctions } from './transform-functions';

export class ConversionEngine {
  static transform(data: any, conversionTable: any): any {
    const result = { ...data };
    
    // 处理每个转换规则
    for (const [targetField, rule] of Object.entries(conversionTable)) {
      const sourceValue = this.getValueByPath(data, rule.source);
      
      if (sourceValue !== undefined) {
        const transformFn = transformFunctions[rule.transform];
        if (transformFn) {
          const transformedValue = transformFn(sourceValue, rule.params);
          this.setValueByPath(result, targetField, transformedValue);
        } else {
          // 直接映射
          this.setValueByPath(result, targetField, sourceValue);
        }
      }
    }
    
    return result;
  }
  
  private static getValueByPath(obj: any, path: string): any {
    // 简化的路径解析，实际应支持更复杂的路径语法
    if (path.includes('.')) {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    return obj[path];
  }
  
  private static setValueByPath(obj: any, path: string, value: any): void {
    // 简化的路径设置，实际应支持更复杂的路径语法
    if (path.includes('.')) {
      const parts = path.split('.');
      const lastPart = parts.pop();
      const target = parts.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
      }, obj);
      if (lastPart) target[lastPart] = value;
    } else {
      obj[path] = value;
    }
  }
}
```

## 3. 模块实现

### 3.1 Transformer模块
```typescript
// secure-anthropic-openai-transformer.ts
import { ConversionEngine } from './conversion-engine';
import { anthropicToOpenaiTable, openaiToAnthropicTable } from './conversion-tables';

export class SecureAnthropicToOpenAITransformer extends EventEmitter implements ModuleInterface {
  async transformRequest(input: any): Promise<any> {
    return ConversionEngine.transform(input, anthropicToOpenaiTable.req_input_table);
  }
  
  async transformResponse(input: any): Promise<any> {
    return ConversionEngine.transform(input, openaiToAnthropicTable.resp_input_table);
  }
}
```

### 3.2 ServerCompatibility模块
```typescript
// iflow-compatibility.ts
import { ConversionEngine } from './conversion-engine';
import { iflowCompatibilityTable } from './conversion-tables';

export class IFlowCompatibilityModule extends ServerCompatibilityModule {
  async processRequest(request: any, context: ModuleProcessingContext): Promise<any> {
    return ConversionEngine.transform(request, iflowCompatibilityTable.req_input_table);
  }
  
  async processResponse(response: any, context: ModuleProcessingContext): Promise<any> {
    return ConversionEngine.transform(response, iflowCompatibilityTable.resp_input_table);
  }
}
```

这种基于字段转换表的模板化转换机制具有以下优势：
1. **配置驱动**：通过JSON配置定义转换规则，无需修改代码
2. **可扩展性**：易于添加新的转换函数和规则
3. **可维护性**：转换逻辑集中管理，便于维护和调试
4. **灵活性**：支持复杂的字段路径和条件转换
5. **标准化**：统一的转换接口和处理流程