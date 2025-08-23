/**
 * Passthrough兼容性模块 - 用于OpenAI兼容的API直接透传
 *
 * 这个模块不做任何转换，直接透传请求，适用于：
 * - ModelScope API (OpenAI兼容)
 * - Gemini API (在转换后)
 * - 其他标准OpenAI兼容的API
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { ModuleProcessingContext } from '../../../config/unified-config-manager';
import { EventEmitter } from 'events';

export interface PassthroughCompatibilityConfig {
  mode: 'passthrough';
  maxTokens?: number;
  enhanceTool?: boolean;
  [key: string]: any;
}

/**
 * 标准协议请求接口（OpenAI格式）
 */
export interface StandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: any[];  // 添加tools属性支持
  [key: string]: any;
}

/**
 * 标准协议响应接口
 */
export interface StandardResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PassthroughCompatibilityModule extends EventEmitter implements ModuleInterface {
  private config: PassthroughCompatibilityConfig;
  private currentStatus: ModuleStatus;

  constructor(config: PassthroughCompatibilityConfig = { mode: 'passthrough' }) {
    super();
    this.config = {
      mode: 'passthrough',
      enhanceTool: true,
      ...config
    };
    
    // 动态设置maxTokens，支持配置文件覆盖，默认128K
    if (!this.config.maxTokens) {
      this.config.maxTokens = 131072; // 默认128K tokens限制
    }
    this.currentStatus = {
      id: 'passthrough-compatibility',
      name: 'Passthrough Compatibility Module',
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'stopped',
      health: 'healthy',
    };
  }

  getId(): string {
    return this.currentStatus.id;
  }

  getName(): string {
    return this.currentStatus.name;
  }

  getType(): ModuleType {
    return this.currentStatus.type;
  }

  getVersion(): string {
    return '1.0.0';
  }

  getStatus(): ModuleStatus {
    return { ...this.currentStatus };
  }

  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  async initialize(): Promise<void> {
    // 初始化透传兼容性模块
    this.currentStatus.status = 'starting';
    console.log('🔧 [Passthrough兼容模块] 初始化完成');
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
  }

  async start(): Promise<void> {
    this.currentStatus.status = 'starting';
    // 模块启动完成
    this.currentStatus.status = 'running';
    this.currentStatus.lastActivity = new Date();
  }

  async stop(): Promise<void> {
    this.currentStatus.status = 'stopping';
    // 模块停止完成
    this.currentStatus.status = 'stopped';
  }

  async reset(): Promise<void> {
    this.currentStatus.status = 'stopped';
    this.currentStatus.health = 'healthy';
    this.currentStatus.error = undefined;
  }

  async cleanup(): Promise<void> {
    // 模块清理完成
    this.currentStatus.status = 'stopped';
    this.removeAllListeners();
  }

  async process(request: StandardRequest, context?: ModuleProcessingContext): Promise<StandardRequest> {
    this.currentStatus.lastActivity = new Date();

    console.log('🔄 [Passthrough兼容模块] Context模式处理OpenAI格式请求:');
    console.log('   输入模型:', request.model);
    console.log('   消息数量:', request.messages?.length || 0);

    // 🎯 Architecture Engineer设计：通过Context获取实际模型名，避免__internal对象
    let actualModel = request.model;
    
    if (context?.config?.actualModel) {
      actualModel = context.config.actualModel;
      console.log('   🔄 Context模型名映射: 映射模型', request.model, '-> 实际模型', actualModel);
    } else {
      console.log('   ⚠️ [Context警告] 未提供Context或actualModel，使用原始模型名:', actualModel);
    }

    // 🎯 Architecture Engineer设计：创建纯净的处理后请求，不包含任何内部字段
    let processedRequest = {
      ...request,
      model: actualModel
    };
    
    // 移除任何可能的内部字段，确保输出纯净
    delete (processedRequest as any).__internal;
    delete (processedRequest as any).anthropic;
    delete (processedRequest as any)._metadata;
    delete (processedRequest as any)._config;

    // 🔧 新增：Anthropic → OpenAI 工具格式转换（基于Qwen模块）
    if (processedRequest.tools && Array.isArray(processedRequest.tools) && processedRequest.tools.length > 0) {
      try {
        if (this.isAnthropicToolsFormat(processedRequest.tools)) {
          processedRequest.tools = this.convertAnthropicToOpenAI(processedRequest.tools);
          console.log('🔄 [Passthrough] Anthropic → OpenAI 工具格式转换完成:', processedRequest.tools.length, '个工具');
        } else if (this.isOpenAIToolsFormat(processedRequest.tools)) {
          console.log('⚡ [Passthrough] 已为OpenAI格式，无需转换:', processedRequest.tools.length, '个工具');
        } else {
          // 尝试修复不完整的OpenAI格式
          processedRequest.tools = this.fixIncompleteOpenAIFormat(processedRequest.tools);
          console.log('🔧 [Passthrough] 修复不完整的OpenAI工具格式:', processedRequest.tools.length, '个工具');
        }
      } catch (error) {
        console.error('❌ [Passthrough] 工具格式转换失败:', error.message);
        // 如果转换失败，移除tools以确保API成功
        delete processedRequest.tools;
        console.log('⚠️ [Passthrough] 已移除tools数组以确保API调用成功');
      }
    }

    // 🔧 移除不必要的截断逻辑 - 让API自行处理大小限制
    // 注释掉截断功能，避免破坏完整的JSON结构
    // if (this.config.maxTokens && typeof this.config.maxTokens === 'number') {
    //   processedRequest = await this.limitRequestSize(processedRequest, this.config.maxTokens);
    // }

    console.log('   输出模型:', processedRequest.model);
    console.log('   透传模式: 保持OpenAI格式，Context更新模型名，限制请求大小');
    console.log('   Context信息:', {
      requestId: context?.requestId,
      providerName: context?.providerName,
      serverCompatibility: context?.config?.serverCompatibility
    });

    return processedRequest;
  }

  /**
   * 根据maxTokens限制请求大小，防止JSON过大
   */
  private async limitRequestSize(request: StandardRequest, maxTokens: number): Promise<StandardRequest> {
    // 粗略估算JSON大小（字符数近似token数）
    const requestJson = JSON.stringify(request);
    const estimatedTokens = requestJson.length / 4; // 粗略估算：4字符≈1token
    
    console.log(`   📏 请求大小检查: ${requestJson.length} 字符, 估算 ${Math.round(estimatedTokens)} tokens, 限制 ${maxTokens} tokens`);
    
    if (estimatedTokens <= maxTokens) {
      console.log('   ✅ 请求大小在限制范围内，无需截断');
      return request;
    }

    console.log('   ⚠️ 请求过大，开始截断处理...');
    
    // 创建副本进行截断
    const truncatedRequest = { ...request };
    
    // 1. 优先截断tools数组（通常是最大的部分）
    if (truncatedRequest.tools && Array.isArray(truncatedRequest.tools)) {
      const originalToolsLength = truncatedRequest.tools.length;
      // 保留前50%的工具，或最多10个
      const maxTools = Math.min(Math.floor(originalToolsLength * 0.5), 10);
      if (truncatedRequest.tools.length > maxTools) {
        truncatedRequest.tools = truncatedRequest.tools.slice(0, maxTools);
        console.log(`   🔧 截断工具数组: ${originalToolsLength} -> ${truncatedRequest.tools.length}`);
      }
    }
    
    // 2. 检查截断后的大小
    const truncatedJson = JSON.stringify(truncatedRequest);
    const newEstimatedTokens = truncatedJson.length / 4;
    
    console.log(`   📏 截断后大小: ${truncatedJson.length} 字符, 估算 ${Math.round(newEstimatedTokens)} tokens`);
    
    // 3. 如果还是太大，进一步截断消息内容
    if (newEstimatedTokens > maxTokens && truncatedRequest.messages) {
      for (let i = 0; i < truncatedRequest.messages.length; i++) {
        const message = truncatedRequest.messages[i];
        if (message.content && typeof message.content === 'string') {
          // 截断字符串内容到最多2000字符
          if (message.content.length > 2000) {
            message.content = message.content.substring(0, 2000) + '... [内容已截断]';
            console.log(`   ✂️ 截断消息 ${i} 内容: 长度限制到2000字符`);
          }
        }
      }
    }
    
    const finalJson = JSON.stringify(truncatedRequest);
    const finalEstimatedTokens = finalJson.length / 4;
    
    console.log(`   ✅ 最终请求大小: ${finalJson.length} 字符, 估算 ${Math.round(finalEstimatedTokens)} tokens`);
    
    return truncatedRequest;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const healthy = this.currentStatus.status === 'running';
    return {
      healthy,
      details: {
        status: this.currentStatus.status,
        mode: this.config.mode,
        lastActivity: this.currentStatus.lastActivity,
      },
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastProcessedAt: this.currentStatus.lastActivity,
    };
  }

  // ============================================================================
  // 工具格式转换方法（基于Qwen模块实现）
  // ============================================================================

  /**
   * 检查是否为Anthropic工具格式
   */
  private isAnthropicToolsFormat(tools: any[]): boolean {
    return tools.every(tool => 
      tool &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      tool.input_schema &&
      typeof tool.input_schema === 'object' &&
      !tool.type && // OpenAI格式会有type: 'function'
      !tool.function // OpenAI格式会有function字段
    );
  }

  /**
   * 检查是否为OpenAI工具格式
   */
  private isOpenAIToolsFormat(tools: any[]): boolean {
    return tools.every(tool =>
      tool &&
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.description === 'string' &&
      tool.function.parameters &&
      typeof tool.function.parameters === 'object'
    );
  }

  /**
   * 转换Anthropic工具格式为OpenAI格式
   */
  private convertAnthropicToOpenAI(tools: any[]): any[] {
    const convertedTools: any[] = [];

    for (const [index, tool] of tools.entries()) {
      try {
        if (!this.isValidAnthropicTool(tool)) {
          throw new Error(`工具${index}不符合Anthropic格式: ${tool?.name || 'unknown'}`);
        }

        const openaiTool = {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: {
              type: tool.input_schema.type || 'object',
              properties: tool.input_schema.properties || {},
              required: tool.input_schema.required || []
            }
          }
        };

        convertedTools.push(openaiTool);
        
        console.log('✅ [Passthrough] 工具转换成功:', tool.name, 'index:', index);

      } catch (error) {
        console.error('❌ [Passthrough] 单个工具转换失败:', {
          error: error.message,
          toolIndex: index,
          toolName: tool?.name
        });
        throw new Error(`工具转换失败(${index}): ${error.message}`);
      }
    }

    return convertedTools;
  }

  /**
   * 修复不完整的OpenAI格式工具
   */
  private fixIncompleteOpenAIFormat(tools: any[]): any[] {
    return tools.map((tool: any, index: number) => {
      if (tool && typeof tool === 'object') {
        // 确保工具对象格式正确
        const fixedTool = {
          type: tool.type || 'function',
          function: tool.function || {}
        };
        
        // 确保function有必需字段
        if (!fixedTool.function.name) {
          fixedTool.function.name = tool.name || `tool_${index}`;
        }
        if (!fixedTool.function.description) {
          fixedTool.function.description = tool.description || '';
        }
        if (!fixedTool.function.parameters) {
          fixedTool.function.parameters = tool.parameters || tool.input_schema || {};
        }
        
        return fixedTool;
      }
      return tool;
    }).filter(tool => tool !== null && tool !== undefined);
  }

  /**
   * 验证Anthropic工具
   */
  private isValidAnthropicTool(tool: any): boolean {
    return tool &&
           typeof tool.name === 'string' &&
           tool.name.length > 0 &&
           typeof tool.description === 'string' &&
           tool.input_schema &&
           typeof tool.input_schema === 'object';
  }
}
