/**
 * RCC v4.0 Enhanced Qwen Compatibility Module
 * 
 * 这是增强版的qwen兼容性处理模块，提供完整的双向字段转换
 * 
 * @author Enhanced Compatibility Analysis
 */

/**
 * Qwen字段映射配置
 */
const QWEN_FIELD_MAPPINGS = {
  // 请求字段映射
  request: {
    // 新增字段映射
    'stream': { supported: true, default: false },
    'stop': { supported: true, default: null },
    'presence_penalty': { supported: true, default: 0, min: -2, max: 2 },
    'frequency_penalty': { supported: true, default: 0, min: -2, max: 2 },
    'logit_bias': { supported: true, default: null },
    'user': { supported: true, default: null },
    'seed': { supported: true, default: null },
    'tools_choice': { supported: true, default: 'auto' },
    
    // 参数调整
    'temperature': { 
      supported: true, 
      default: 0.7, 
      min: 0, 
      max: 2.0, // qwen支持更广范围
      transform: (val: number) => Math.min(Math.max(val, 0), 2.0)
    },
    'top_p': { 
      supported: true, 
      default: 0.9, // qwen推荐值
      min: 0, 
      max: 1 
    },
    'max_tokens': { 
      supported: true, 
      default: 2048, 
      max: 262144 // qwen支持大token
    }
  },
  
  // 响应字段映射
  response: {
    // 新增字段映射
    'finish_reason': {
      mapping: {
        'tool_calls': 'tool_calls',
        'stop': 'stop',
        'length': 'length',
        'content_filter': 'content_filter'
      }
    },
    'usage': {
      mapping: {
        'prompt_tokens': 'prompt_tokens',
        'completion_tokens': 'completion_tokens',
        'total_tokens': 'total_tokens'
      }
    }
  },
  
  // HTTP头配置
  headers: {
    required: [
      'Content-Type',
      'Authorization',
      'User-Agent'
    ],
    qwenSpecific: [
      'X-DashScope-Async',
      'X-DashScope-SSE',
      'X-DashScope-Input-Language'
    ]
  }
};

/**
 * 增强的Qwen兼容性处理函数
 * 提供完整的双向字段转换和验证
 */
export function applyEnhancedQwenCompatibility(inputData: any, pipeline: any): any {
  const compatibilityData = { ...inputData };
  
  // 1. 基础参数验证和调整
  const mappings = QWEN_FIELD_MAPPINGS.request;
  
  // 处理每个支持的字段
  Object.keys(mappings).forEach(field => {
    const mapping = mappings[field as keyof typeof mappings];
    
    if (mapping.supported) {
      // 应用默认值
      if (compatibilityData[field] === undefined || compatibilityData[field] === null) {
        compatibilityData[field] = mapping.default;
      }
      
      // 应用参数范围限制
      if (mapping.min !== undefined && mapping.max !== undefined) {
        const value = compatibilityData[field];
        if (Array.isArray(value)) {
          compatibilityData[field] = value.map(v => 
            Math.min(Math.max(v, mapping.min), mapping.max)
          );
        } else if (typeof value === 'number') {
          compatibilityData[field] = Math.min(Math.max(value, mapping.min), mapping.max);
        }
      }
      
      // 应用转换函数
      if (mapping.transform && typeof mapping.transform === 'function') {
        compatibilityData[field] = mapping.transform(compatibilityData[field]);
      }
    }
  });
  
  // 2. qwen特定的HTTP头处理
  compatibilityData.headers = {
    ...compatibilityData.headers,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${pipeline.apiKey}`,
    'User-Agent': 'RCC-v4.0-Enhanced-Qwen-Compatibility',
    'X-DashScope-Async': 'enable' // qwen流式支持
  };
  
  // 3. 工具调用特殊处理
  if (compatibilityData.tools && Array.isArray(compatibilityData.tools)) {
    // qwen工具调用优化
    compatibilityData.tools = compatibilityData.tools.map((tool: any) => ({
      ...tool,
      // qwen需要更详细的工具描述
      function: {
        ...tool.function,
        // 添加qwen特定的参数验证
        parameters: {
          ...tool.function.parameters,
          // qwen需要明确的参数描述
          additionalProperties: false,
          strict: true
        }
      }
    }));
  }
  
  // 4. 流式传输特殊处理
  if (compatibilityData.stream === true) {
    compatibilityData.headers = {
      ...compatibilityData.headers,
      'X-DashScope-SSE': 'enable',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    };
  }
  
  // 5. 多模态支持（如果有）
  if (compatibilityData.messages) {
    compatibilityData.messages = compatibilityData.messages.map((msg: any) => {
      // 处理多模态内容
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((content: any) => {
            if (content.type === 'image') {
              // qwen图像格式特殊处理
              return {
                type: 'image_url',
                image_url: {
                  url: content.source.url,
                  detail: content.source.detail || 'auto'
                }
              };
            }
            return content;
          })
        };
      }
      return msg;
    });
  }
  
  return {
    ...compatibilityData,
    metadata: {
      ...compatibilityData.metadata,
      layer: 'server-compatibility-enhanced',
      provider: 'qwen',
      compatibilityApplied: true,
      fieldMappingsApplied: Object.keys(mappings).length,
      enhancedFeatures: [
        'streaming-support',
        'tool-calling-enhanced',
        'multimodal-ready',
        'parameter-validation'
      ],
      processed: true
    }
  };
}

/**
 * 响应转换函数 - 将qwen响应转换为OpenAI标准格式
 */
export function convertQwenResponseToOpenAI(qwenResponse: any): any {
  const openAIResponse = {
    id: qwenResponse.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: qwenResponse.created || Math.floor(Date.now() / 1000),
    model: qwenResponse.model || 'unknown',
    choices: [],
    usage: qwenResponse.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
  
  // 转换选择项
  if (qwenResponse.choices && Array.isArray(qwenResponse.choices)) {
    openAIResponse.choices = qwenResponse.choices.map((choice: any) => ({
      index: choice.index || 0,
      message: {
        role: 'assistant',
        content: choice.message?.content || '',
        tool_calls: convertToolCalls(choice.message?.tool_calls)
      },
      finish_reason: convertFinishReason(choice.finish_reason),
      logprobs: null
    }));
  }
  
  return openAIResponse;
}

/**
 * 工具调用转换辅助函数
 */
function convertToolCalls(toolCalls: any[]): any[] {
  if (!toolCalls || !Array.isArray(toolCalls)) {
    return [];
  }
  
  return toolCalls.map((toolCall: any) => ({
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: typeof toolCall.function.arguments === 'string' 
        ? toolCall.function.arguments 
        : JSON.stringify(toolCall.function.arguments)
    }
  }));
}

/**
 * 完成原因转换辅助函数
 */
function convertFinishReason(finishReason: string): string {
  const mapping = QWEN_FIELD_MAPPINGS.response.finish_reason.mapping;
  return mapping[finishReason as keyof typeof mapping] || finishReason;
}

/**
 * 字段验证函数
 */
export function validateQwenRequest(requestData: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 验证必填字段
  if (!requestData.model) {
    errors.push('Model field is required');
  }
  
  if (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0) {
    errors.push('Messages field is required and must be a non-empty array');
  }
  
  // 验证参数范围
  const mappings = QWEN_FIELD_MAPPINGS.request;
  
  Object.keys(mappings).forEach(field => {
    const mapping = mappings[field as keyof typeof mappings];
    
    if (mapping.supported && requestData[field] !== undefined) {
      const value = requestData[field];
      
      if (mapping.min !== undefined && mapping.max !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v, i) => {
            if (typeof v === 'number' && (v < mapping.min || v > mapping.max)) {
              warnings.push(`${field}[${i}] = ${v} is outside recommended range [${mapping.min}, ${mapping.max}]`);
            }
          });
        } else if (typeof value === 'number' && (value < mapping.min || value > mapping.max)) {
          warnings.push(`${field} = ${value} is outside recommended range [${mapping.min}, ${mapping.max}]`);
        }
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  applyEnhancedQwenCompatibility,
  convertQwenResponseToOpenAI,
  validateQwenRequest,
  QWEN_FIELD_MAPPINGS
};