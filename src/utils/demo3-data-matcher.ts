/**
 * Demo3兼容模型映射和数据匹配器
 * 确保与Demo3 AIClient-2-API完全一致的输入输出逻辑
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';

export interface Demo3ModelMapping {
  // Demo3使用的标准模型名称
  'claude-sonnet-4': 'CLAUDE_SONNET_4_20250514_V1_0';
  'claude-3-7-sonnet': 'CLAUDE_3_7_SONNET';
  'claude-3-5-sonnet': 'CLAUDE_3_5_SONNET';
  'claude-3-sonnet-20240229': 'CLAUDE_SONNET_4_20250514_V1_0'; // Demo3默认映射
}

export interface Demo3RequestFormat {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      id?: string;
      name?: string;
      input?: any;
      tool_use_id?: string;
      content?: any;
    }>;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties: any;
      required?: string[];
    };
  }>;
  stream?: boolean;
  temperature?: number;
}

export interface Demo3ResponseFormat {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class Demo3DataMatcher {
  private readonly modelMapping: Record<string, string> = {
    'claude-sonnet-4': 'CLAUDE_SONNET_4_20250514_V1_0',
    'claude-3-7-sonnet': 'CLAUDE_3_7_SONNET',
    'claude-3-5-sonnet': 'CLAUDE_3_5_SONNET',
    'claude-3-sonnet-20240229': 'CLAUDE_SONNET_4_20250514_V1_0',
    // 逆向映射 - 当收到CodeWhisperer标准名时的匹配
    'CLAUDE_SONNET_4_20250514_V1_0': 'CLAUDE_SONNET_4_20250514_V1_0',
    'CLAUDE_3_7_SONNET': 'CLAUDE_3_7_SONNET',
    'CLAUDE_3_5_SONNET': 'CLAUDE_3_5_SONNET'
  };

  /**
   * 🎯 关键方法：将任意请求转换为Demo3精确格式
   */
  transformToDemo3Format(request: any): Demo3RequestFormat {
    const demo3Request: Demo3RequestFormat = {
      model: this.mapModelToDemo3(request.model),
      max_tokens: request.max_tokens || 131072,
      messages: this.transformMessages(request.messages),
      stream: request.stream || false
    };

    // 处理温度参数
    if (typeof request.temperature === 'number') {
      demo3Request.temperature = request.temperature;
    }

    // 🎯 关键：Demo3工具格式转换
    if (request.tools && Array.isArray(request.tools)) {
      demo3Request.tools = this.transformToolsToDemo3Format(request.tools);
    }

    logger.debug('Request transformed to Demo3 format', {
      originalModel: request.model,
      demo3Model: demo3Request.model,
      messageCount: demo3Request.messages.length,
      hasTools: !!(demo3Request.tools && demo3Request.tools.length > 0)
    });

    return demo3Request;
  }

  /**
   * 🎯 关键方法：将Demo3响应转换回标准格式
   */
  transformFromDemo3Format(demo3Response: Demo3ResponseFormat): any {
    const standardResponse = {
      id: demo3Response.id,
      type: demo3Response.type,
      role: demo3Response.role,
      content: this.transformContentFromDemo3(demo3Response.content),
      model: demo3Response.model, // 保持Demo3的模型名
      stop_reason: this.mapStopReasonFromDemo3(demo3Response.stop_reason),
      stop_sequence: demo3Response.stop_sequence,
      usage: demo3Response.usage
    };

    logger.debug('Response transformed from Demo3 format', {
      demo3Id: demo3Response.id,
      contentBlocks: standardResponse.content.length,
      stopReason: standardResponse.stop_reason
    });

    return standardResponse;
  }

  /**
   * Demo3模型名映射
   */
  private mapModelToDemo3(modelName: string): string {
    // 如果已经是Demo3格式的完整模型名，直接返回
    if (modelName.includes('CLAUDE_') && modelName.includes('_V')) {
      return modelName;
    }

    // 查找映射表
    const mapped = this.modelMapping[modelName];
    if (mapped) {
      logger.debug('Model mapped to Demo3 format', {
        original: modelName,
        mapped
      });
      return mapped;
    }

    // 默认映射到最新的Sonnet模型
    logger.warn('Unknown model name, using default Demo3 model', {
      original: modelName,
      fallback: 'CLAUDE_SONNET_4_20250514_V1_0'
    });
    
    return 'CLAUDE_SONNET_4_20250514_V1_0';
  }

  /**
   * 消息格式转换 - 确保与Demo3一致
   */
  private transformMessages(messages: any[]): Demo3RequestFormat['messages'] {
    return messages.map(message => {
      const transformedMessage: any = {
        role: message.role,
        content: message.content
      };

      // 🎯 Demo3特殊处理：确保内容格式正确
      if (Array.isArray(message.content)) {
        transformedMessage.content = message.content.map((block: any) => {
          if (block.type === 'text') {
            return { type: 'text', text: block.text };
          }
          if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input || {}
            };
          }
          if (block.type === 'tool_result') {
            return {
              type: 'tool_result',
              tool_use_id: block.tool_use_id,
              content: block.content
            };
          }
          return block;
        });
      }

      return transformedMessage;
    });
  }

  /**
   * 🎯 关键：工具格式转换为Demo3格式
   */
  private transformToolsToDemo3Format(tools: any[]): Demo3RequestFormat['tools'] {
    return tools.map(tool => {
      // 处理OpenAI格式的工具
      if (tool.type === 'function' && tool.function) {
        return {
          name: tool.function.name,
          description: tool.function.description,
          input_schema: {
            type: tool.function.parameters?.type || 'object',
            properties: tool.function.parameters?.properties || {},
            required: tool.function.parameters?.required || []
          }
        };
      }

      // 处理已经是Anthropic格式的工具
      if (tool.name && tool.description) {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema || tool.parameters || {
            type: 'object',
            properties: {}
          }
        };
      }

      // 兜底处理
      logger.warn('Unknown tool format, using default structure', { tool });
      return {
        name: tool.name || 'unknown_tool',
        description: tool.description || 'Unknown tool',
        input_schema: {
          type: 'object',
          properties: {}
        }
      };
    });
  }

  /**
   * Demo3内容格式转换
   */
  private transformContentFromDemo3(content: Demo3ResponseFormat['content']): any[] {
    return content.map(block => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input
        };
      }
      return block;
    });
  }

  /**
   * Stop reason映射
   */
  private mapStopReasonFromDemo3(stopReason: Demo3ResponseFormat['stop_reason']): string {
    const mapping: Record<string, string> = {
      'end_turn': 'end_turn',
      'max_tokens': 'max_tokens', 
      'tool_use': 'tool_use',
      'stop_sequence': 'stop_sequence'
    };

    return mapping[stopReason] || stopReason;
  }

  /**
   * 🎯 验证Demo3请求格式完整性
   */
  validateDemo3Request(request: Demo3RequestFormat): void {
    // 必需字段验证
    if (!request.model) {
      throw new Error('Demo3 request missing required field: model');
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Demo3 request missing or empty messages array');
    }

    if (!request.max_tokens || typeof request.max_tokens !== 'number') {
      throw new Error('Demo3 request missing or invalid max_tokens');
    }

    // 消息格式验证
    for (const [index, message] of request.messages.entries()) {
      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        throw new Error(`Demo3 request message[${index}] has invalid role: ${message.role}`);
      }

      if (!message.content) {
        throw new Error(`Demo3 request message[${index}] missing content`);
      }
    }

    // 工具格式验证
    if (request.tools) {
      for (const [index, tool] of request.tools.entries()) {
        if (!tool.name || typeof tool.name !== 'string') {
          throw new Error(`Demo3 request tool[${index}] missing or invalid name`);
        }

        if (!tool.description || typeof tool.description !== 'string') {
          throw new Error(`Demo3 request tool[${index}] missing or invalid description`);
        }

        if (!tool.input_schema || typeof tool.input_schema !== 'object') {
          throw new Error(`Demo3 request tool[${index}] missing or invalid input_schema`);
        }
      }
    }

    logger.debug('Demo3 request validation passed', {
      model: request.model,
      messageCount: request.messages.length,
      hasTools: !!(request.tools && request.tools.length > 0)
    });
  }

  /**
   * 🎯 验证Demo3响应格式完整性
   */
  validateDemo3Response(response: Demo3ResponseFormat): void {
    // 必需字段验证
    if (!response.id || typeof response.id !== 'string') {
      throw new Error('Demo3 response missing or invalid id');
    }

    if (response.type !== 'message') {
      throw new Error(`Demo3 response invalid type: ${response.type}, expected 'message'`);
    }

    if (response.role !== 'assistant') {
      throw new Error(`Demo3 response invalid role: ${response.role}, expected 'assistant'`);
    }

    if (!response.content || !Array.isArray(response.content)) {
      throw new Error('Demo3 response missing or invalid content array');
    }

    if (!response.model || typeof response.model !== 'string') {
      throw new Error('Demo3 response missing or invalid model');
    }

    if (!response.stop_reason || !['end_turn', 'max_tokens', 'tool_use', 'stop_sequence'].includes(response.stop_reason)) {
      throw new Error(`Demo3 response invalid stop_reason: ${response.stop_reason}`);
    }

    if (!response.usage || typeof response.usage.input_tokens !== 'number' || typeof response.usage.output_tokens !== 'number') {
      throw new Error('Demo3 response missing or invalid usage statistics');
    }

    logger.debug('Demo3 response validation passed', {
      id: response.id,
      contentBlocks: response.content.length,
      stopReason: response.stop_reason
    });
  }

  /**
   * 🎯 获取Demo3支持的模型列表
   */
  getSupportedModels(): string[] {
    return Object.values(this.modelMapping);
  }

  /**
   * 🎯 检查模型是否被Demo3支持
   */
  isModelSupported(modelName: string): boolean {
    return Object.keys(this.modelMapping).includes(modelName) || 
           Object.values(this.modelMapping).includes(modelName);
  }

  /**
   * 🎯 创建模拟Demo3测试请求
   */
  createDemo3TestRequest(): Demo3RequestFormat {
    return {
      model: 'CLAUDE_SONNET_4_20250514_V1_0',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: 'Hello, can you help me with a simple task?' }
      ],
      tools: [{
        name: 'get_current_time',
        description: 'Get the current time',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }],
      stream: false
    };
  }

  /**
   * 🎯 创建模拟Demo3测试响应
   */
  createDemo3TestResponse(): Demo3ResponseFormat {
    return {
      id: 'msg_demo3_test_123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello! I\'d be happy to help you with your task. How can I assist you today?'
        }
      ],
      model: 'CLAUDE_SONNET_4_20250514_V1_0',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 23,
        output_tokens: 19
      }
    };
  }
}

/**
 * 全局Demo3数据匹配器实例
 */
export const demo3DataMatcher = new Demo3DataMatcher();