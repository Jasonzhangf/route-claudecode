/**
 * LMStudio Tool Compatibility Preprocessor
 * 在预处理阶段完成LMStudio工具调用格式的兼容性处理
 * 
 * Project owner: Jason Zhang
 */

export class LMStudioToolCompatibility {
  constructor() {
    this.processorName = 'LMStudioToolCompatibility';
    this.version = '1.0.0';
  }

  /**
   * 预处理请求，确保工具格式兼容LMStudio
   */
  preprocessRequest(request, context = {}) {
    if (!request || !request.tools || !Array.isArray(request.tools)) {
      return request;
    }

    console.log(`🔧 [${this.processorName}] 预处理LMStudio工具兼容性`);

    const processedRequest = {
      ...request,
      tools: this.normalizeTools(request.tools, context)
    };

    console.log(`✅ [${this.processorName}] 工具预处理完成，共处理 ${request.tools.length} 个工具`);
    return processedRequest;
  }

  /**
   * 标准化工具格式为LMStudio兼容格式
   */
  normalizeTools(tools, context) {
    return tools.map((tool, index) => {
      try {
        return this.normalizeToolDefinition(tool, index, context);
      } catch (error) {
        console.warn(`⚠️  工具 ${index} 标准化失败: ${error.message}`);
        return this.createFallbackTool(tool, index);
      }
    });
  }

  /**
   * 标准化单个工具定义
   */
  normalizeToolDefinition(tool, index, context) {
    // 如果已经是正确的OpenAI格式
    if (tool.type === 'function' && tool.function) {
      return this.validateAndCleanTool(tool);
    }

    // 转换Anthropic格式到OpenAI格式
    if (tool.name && tool.input_schema) {
      return {
        type: 'function',
        function: {
          name: this.sanitizeToolName(tool.name),
          description: tool.description || `Tool ${tool.name}`,
          parameters: this.normalizeSchema(tool.input_schema)
        }
      };
    }

    // 处理不规范格式
    if (typeof tool === 'string') {
      console.warn(`⚠️  发现字符串类型工具定义: ${tool}`);
      return this.createFunctionFromString(tool, index);
    }

    // 处理缺少必要字段的工具
    const toolName = tool.function?.name || tool.name || `unknown_tool_${index}`;
    return {
      type: 'function',
      function: {
        name: this.sanitizeToolName(toolName),
        description: tool.description || tool.function?.description || 'No description provided',
        parameters: this.normalizeSchema(tool.input_schema || tool.function?.parameters || {})
      }
    };
  }

  /**
   * 验证和清理工具定义
   */
  validateAndCleanTool(tool) {
    const cleaned = {
      type: 'function',
      function: {
        name: this.sanitizeToolName(tool.function.name),
        description: tool.function.description || 'No description provided',
        parameters: this.normalizeSchema(tool.function.parameters || {})
      }
    };

    // 移除LMStudio不支持的字段
    if (cleaned.function.parameters.additionalProperties !== undefined) {
      delete cleaned.function.parameters.additionalProperties;
    }

    return cleaned;
  }

  /**
   * 标准化参数schema
   */
  normalizeSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    const normalized = {
      type: schema.type || 'object',
      properties: schema.properties || {},
      required: schema.required || []
    };

    // 确保properties中的每个字段都有type
    Object.keys(normalized.properties).forEach(key => {
      const prop = normalized.properties[key];
      if (typeof prop === 'object' && !prop.type) {
        prop.type = 'string'; // 默认为string类型
      }
    });

    return normalized;
  }

  /**
   * 清理工具名称，确保符合LMStudio要求
   */
  sanitizeToolName(name) {
    if (!name || typeof name !== 'string') {
      return 'unnamed_function';
    }

    // 移除特殊字符，只保留字母、数字和下划线
    const sanitized = name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_$&') // 确保以字母或下划线开始，保留原字符
      .replace(/_+/g, '_') // 压缩多个连续下划线
      .toLowerCase();

    return sanitized || 'unnamed_function';
  }

  /**
   * 从字符串创建函数定义
   */
  createFunctionFromString(toolString, index) {
    const functionName = this.sanitizeToolName(toolString);
    return {
      type: 'function',
      function: {
        name: functionName,
        description: `Function derived from string: ${toolString}`,
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Function input'
            }
          },
          required: ['input']
        }
      }
    };
  }

  /**
   * 创建fallback工具定义
   */
  createFallbackTool(originalTool, index) {
    return {
      type: 'function',
      function: {
        name: `fallback_tool_${index}`,
        description: 'Fallback tool created due to parsing error',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Generic input parameter'
            }
          },
          required: []
        }
      }
    };
  }

  /**
   * 后处理响应，将LMStudio响应转换回标准格式
   */
  postprocessResponse(response, originalRequest, context = {}) {
    if (!response || !response.choices || !response.choices[0]) {
      return response;
    }

    const message = response.choices[0].message;
    if (!message || !message.tool_calls) {
      return response;
    }

    console.log(`🔧 [${this.processorName}] 后处理LMStudio工具调用响应`);

    // 验证工具调用格式
    const validatedToolCalls = message.tool_calls.map((toolCall, index) => {
      return this.validateToolCallResponse(toolCall, index);
    });

    // 更新响应
    const processedResponse = {
      ...response,
      choices: [{
        ...response.choices[0],
        message: {
          ...message,
          tool_calls: validatedToolCalls
        }
      }]
    };

    console.log(`✅ [${this.processorName}] 工具调用响应后处理完成，共处理 ${validatedToolCalls.length} 个调用`);
    return processedResponse;
  }

  /**
   * 验证工具调用响应格式
   */
  validateToolCallResponse(toolCall, index) {
    if (!toolCall.function || !toolCall.function.name) {
      console.warn(`⚠️  工具调用 ${index} 缺少必要字段`);
      return {
        id: toolCall.id || `call_${Date.now()}_${index}`,
        type: 'function',
        function: {
          name: 'unknown_function',
          arguments: toolCall.function?.arguments || '{}'
        }
      };
    }

    // 验证arguments格式
    let parsedArgs = {};
    try {
      parsedArgs = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      console.warn(`⚠️  工具调用 ${index} arguments解析失败: ${error.message}`);
      parsedArgs = {};
    }

    return {
      id: toolCall.id || `call_${Date.now()}_${index}`,
      type: 'function',
      function: {
        name: toolCall.function.name,
        arguments: typeof parsedArgs === 'object' ? JSON.stringify(parsedArgs) : '{}'
      }
    };
  }

  /**
   * 获取处理器信息
   */
  getInfo() {
    return {
      name: this.processorName,
      version: this.version,
      description: 'LMStudio工具调用兼容性预处理器',
      supportedOperations: ['preprocessRequest', 'postprocessResponse'],
      inputFormats: ['anthropic', 'openai'],
      outputFormats: ['openai-lmstudio-compatible']
    };
  }
}

export default LMStudioToolCompatibility;