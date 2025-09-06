/**
 * LM Studio Server Compatibility Module - 四层双向处理架构实现
 *
 * 按照RCC v4.0四层双向处理架构规范实现的LM Studio兼容性模块
 * 作为Server-Compatibility层处理LM Studio特定的OpenAI API变种
 * 支持：
 * - 预配置模块：所有配置在组装时固化，运行时零配置传递
 * - 双向处理：processRequest和processResponse接口
 * - OpenAI格式内转换：仅处理OpenAI格式到Provider特定调整
 * - 并发安全：无状态设计支持多请求并发
 *
 * @author Jason Zhang
 * @version 2.0.0 - 四层双向处理架构
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../interfaces/module/base-module';
import { BidirectionalCompatibilityProcessor, RequestContext, ResponseContext } from '../../interfaces/module/four-layer-interfaces';
import { EventEmitter } from 'events';
import { OpenAI } from 'openai';
import { JQJsonHandler } from '../../utils/jq-json-handler';
/**
 * LM Studio预配置接口 - 在组装时固化的配置
 */
export interface LMStudioCompatibilityPreConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  models: string[];
  maxTokens?: Record<string, number>; // 每个模型的最大token限制
  // 新增：双向处理配置
  enableRequestProcessing?: boolean;
  enableResponseProcessing?: boolean;
  modelMappingRules?: Record<string, string>;
  parameterLimits?: Record<string, any>;
  concurrencyLimit?: number;
}

/**
 * LM Studio配置接口 - 兼容性保持
 * @deprecated 使用 LMStudioCompatibilityPreConfig
 */
export interface LMStudioCompatibilityConfig extends LMStudioCompatibilityPreConfig {}

/**
 * 标准协议请求接口（OpenAI格式）
 */
export interface StandardRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * LM Studio特定请求格式
 */
export interface LMStudioRequest extends StandardRequest {
  // LM Studio可能有一些特定的参数
  top_k?: number;
  repeat_penalty?: number;
  system_prompt?: string;
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
      role: 'assistant';
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LM Studio特定响应格式
 */
export interface LMStudioResponse extends StandardResponse {
  // LM Studio可能有额外的响应字段
  metadata?: {
    server_version?: string;
    model_path?: string;
  };
}

/**
 * LM Studio Server Compatibility Module实现 - 四层双向处理架构
 */
export class LMStudioCompatibilityModule extends EventEmitter implements ModuleInterface, BidirectionalCompatibilityProcessor {
  private readonly id: string = 'lmstudio-compatibility';
  private readonly name: string = 'LM Studio Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = '2.0.0';
  private readonly preConfig: LMStudioCompatibilityPreConfig;
  private readonly isPreConfigured: boolean = true;
  private openaiClient: OpenAI;
  private status: any = 'healthy';
  private isInitialized = false;
  private connections: Map<string, ModuleInterface> = new Map();
  private metrics = {
    requestsProcessed: 0,
    responsesProcessed: 0,
    errorsHandled: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0
  };

  constructor(preConfig: LMStudioCompatibilityPreConfig) {
    super();
    
    // 固化预配置 - 运行时不可更改
    this.preConfig = {
      baseUrl: preConfig.baseUrl,
      apiKey: preConfig.apiKey,
      timeout: preConfig.timeout,
      maxRetries: preConfig.maxRetries,
      retryDelay: preConfig.retryDelay,
      models: Array.isArray(preConfig.models) ? [...preConfig.models] : [], // 深拷贝避免外部修改
      maxTokens: preConfig.maxTokens ? { ...preConfig.maxTokens } : undefined,
      enableRequestProcessing: preConfig.enableRequestProcessing ?? true,
      enableResponseProcessing: preConfig.enableResponseProcessing ?? true,
      modelMappingRules: preConfig.modelMappingRules ? { ...preConfig.modelMappingRules } : {},
      parameterLimits: preConfig.parameterLimits ? { ...preConfig.parameterLimits } : {},
      concurrencyLimit: preConfig.concurrencyLimit ?? 10
    };

    // 使用官方OpenAI SDK连接LM Studio
    this.openaiClient = new OpenAI({
      baseURL: this.preConfig.baseUrl,
      apiKey: this.preConfig.apiKey || 'lm-studio', // LM Studio通常不需要真实的API Key
      timeout: this.preConfig.timeout,
    });

    console.log(`🔧 初始化LM Studio兼容模块 (预配置模式): ${this.preConfig.baseUrl}`, {
      enableRequestProcessing: this.preConfig.enableRequestProcessing,
      enableResponseProcessing: this.preConfig.enableResponseProcessing,
      modelsCount: this.preConfig.models.length,
      concurrencyLimit: this.preConfig.concurrencyLimit
    });
  }

  // ModuleInterface实现

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'running',
      health: this.status,
    };
  }

  /**
   * 初始化模块
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 初始化LM Studio兼容模块 (预配置模式)...`);
    console.log(`   端点: ${this.preConfig.baseUrl}`);
    console.log(`   支持模型: ${this.preConfig.models.join(', ')}`);
    console.log(`   启用请求处理: ${this.preConfig.enableRequestProcessing}`);
    console.log(`   启用响应处理: ${this.preConfig.enableResponseProcessing}`);

    try {
      // 测试连接LM Studio
      await this.testConnection();

      this.status = 'healthy';
      this.isInitialized = true;

      this.emit('statusChanged', { health: this.status });
      console.log(`✅ LM Studio兼容模块初始化完成`);
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      console.error(`❌ LM Studio兼容模块初始化失败:`, error.message);
      throw error;
    }
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    console.log(`▶️ LM Studio兼容模块已启动 (预配置模式)`);
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    this.status = 'unhealthy';
    this.emit('statusChanged', { health: this.status });
    console.log(`⏹️ LM Studio兼容模块已停止`);
  }

  /**
   * 处理请求 - 四层双向处理架构主接口
   * 将标准OpenAI协议请求适配为LM Studio兼容格式
   */
  async processRequest(input: StandardRequest): Promise<StandardRequest> {
    const startTime = Date.now();
    
    try {
      // 检查是否启用请求处理
      if (!this.preConfig.enableRequestProcessing) {
        console.log(`➡️ LM Studio请求处理已禁用，直接传递`);
        this.updateRequestMetrics(Date.now() - startTime, true);
        return input;
      }
      
      if (!this.isInitialized) {
        throw new Error('LM Studio兼容模块未初始化');
      }

      console.log(`🔄 LM Studio兼容处理 (请求): ${input.model}`);

      // 验证输入
      this.validateStandardRequest(input);

      // 适配请求以确保LM Studio兼容性
      const adaptedRequest = this.adaptRequestForLMStudio(input);

      this.updateRequestMetrics(Date.now() - startTime, true);
      console.log(`✅ LM Studio请求兼容处理完成 (${Date.now() - startTime}ms)`);

      this.emit('requestProcessed', {
        processingTime: Date.now() - startTime,
        success: true,
        model: input.model,
      });

      // 返回适配后的请求格式，让Server层负责实际API调用
      return adaptedRequest;
    } catch (error) {
      this.updateRequestMetrics(Date.now() - startTime, false);
      const processingTime = Date.now() - startTime;
      console.error(`❌ LM Studio请求兼容处理失败 (${processingTime}ms):`, error.message);

      this.emit('requestProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: input.model,
      });

      throw error;
    }
  }

  /**
   * 处理响应 - 四层双向处理架构主接口
   * 适配LM Studio响应以确保标准OpenAI兼容性
   */
  async processResponse(input: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 检查是否启用响应处理
      if (!this.preConfig.enableResponseProcessing) {
        console.log(`➡️ LM Studio响应处理已禁用，直接传递`);
        this.updateResponseMetrics(Date.now() - startTime, true);
        return input;
      }
      
      if (!this.isInitialized) {
        throw new Error('LM Studio兼容模块未初始化');
      }

      console.log(`🔄 LM Studio兼容处理 (响应)`);

      // 适配响应以确保标准OpenAI兼容性
      const adaptedResponse = this.adaptLMStudioResponseToStandard(input);

      this.updateResponseMetrics(Date.now() - startTime, true);
      console.log(`✅ LM Studio响应兼容处理完成 (${Date.now() - startTime}ms)`);

      this.emit('responseProcessed', {
        processingTime: Date.now() - startTime,
        success: true
      });

      return adaptedResponse;
    } catch (error) {
      this.updateResponseMetrics(Date.now() - startTime, false);
      const processingTime = Date.now() - startTime;
      console.error(`❌ LM Studio响应兼容处理失败 (${processingTime}ms):`, error.message);

      this.emit('responseProcessed', {
        processingTime,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 处理请求 - 兼容旧接口
   * @deprecated 使用 processRequest
   */
  async process(input: StandardRequest): Promise<StandardRequest> {
    // 调用新的双向处理接口
    return await this.processRequest(input);
  }

  /**
   * 适配请求以确保LM Studio兼容性
   */
  private adaptRequestForLMStudio(input: StandardRequest): StandardRequest {
    // 🔧 关键修复：将虚拟模型映射到实际的LM Studio模型
    const actualModel = this.mapVirtualModelToActual(input.model);
    
    // 应用max_tokens限制
    const modelMaxTokens = this.getModelMaxTokens(actualModel);

    // 克隆输入以避免修改原始对象
    const adaptedRequest: StandardRequest = {
      ...input,
      model: actualModel, // 使用实际模型名称
      max_tokens: Math.min(input.max_tokens || modelMaxTokens, modelMaxTokens),
    };

    // 🔧 关键修复：转换消息内容格式以确保LM Studio兼容性
    if (adaptedRequest.messages && Array.isArray(adaptedRequest.messages)) {
      adaptedRequest.messages = adaptedRequest.messages
        .filter(msg => {
          // 安全检查：确保msg对象存在且不为null/undefined
          if (!msg || typeof msg !== 'object') {
            return false;
          }
          
          // 检查是否有有效的role
          if (!msg.role || typeof msg.role !== 'string') {
            return false;
          }
          
          // 支持多种content格式，但需要进行转换
          if (typeof msg.content === 'string') {
            return msg.content.trim().length > 0; // 字符串必须非空
          } else if (Array.isArray(msg.content) || (msg.content && typeof msg.content === 'object')) {
            return true; // 复杂内容需要转换
          }
          
          // 如果content为null/undefined，检查是否是特殊类型消息（如工具响应）
          return msg.tool_call_id || msg.name; // 工具响应消息可能没有content但有tool_call_id
        })
        .map(msg => this.convertMessageContentForLMStudio(msg));
      
      // 🔧 关键修复：如果过滤后messages为空，抛出错误而不是设置空数组
      if (adaptedRequest.messages.length === 0) {
        throw new Error('所有消息都无效或为空，无法处理请求');
      }
    } else {
      // 如果messages不是数组或不存在，抛出错误
      throw new Error('缺少有效的messages参数');
    }

    // 🔧 关键修复：确保tools格式正确适配LM Studio
    if (adaptedRequest.tools && Array.isArray(adaptedRequest.tools)) {
      adaptedRequest.tools = this.validateAndFixToolsForLMStudio(adaptedRequest.tools);
    }

    // 🔧 关键修复：确保tool_choice格式正确
    if (adaptedRequest.tool_choice) {
      adaptedRequest.tool_choice = this.validateAndFixToolChoiceForLMStudio(adaptedRequest.tool_choice);
    }

    console.log(
      `🔧 LM Studio适配完成: max_tokens=${adaptedRequest.max_tokens}, messages=${adaptedRequest.messages?.length || 0}, tools=${adaptedRequest.tools?.length || 0}`
    );
    return adaptedRequest;
  }

  /**
   * 转换消息内容格式以确保LM Studio兼容性
   */
  private convertMessageContentForLMStudio(msg: any): any {
    // 如果已经是字符串格式，直接返回
    if (typeof msg.content === 'string') {
      return msg;
    }

    // 处理复杂内容格式（如Claude Code的tool_use格式）
    let convertedContent = '';

    if (Array.isArray(msg.content)) {
      // 处理数组格式的内容
      for (const contentBlock of msg.content) {
        if (!contentBlock || typeof contentBlock !== 'object') {
          continue;
        }

        if (contentBlock.type === 'text' && contentBlock.text) {
          // 文本内容块
          convertedContent += contentBlock.text + '\n';
        } else if (contentBlock.type === 'tool_use') {
          // 工具使用内容块 - 转换为文本描述
          const toolName = contentBlock.name || 'unknown_tool';
          const toolInput = contentBlock.input || {};
          convertedContent += `[Tool Call: ${toolName}] `;
          
          // 将工具输入转换为可读的描述
          if (typeof toolInput === 'object' && Object.keys(toolInput).length > 0) {
            convertedContent += JQJsonHandler.stringifyJson(toolInput);
          }
          convertedContent += '\n';
        } else if (contentBlock.type === 'tool_result') {
          // 工具结果内容块
          const result = contentBlock.content || contentBlock.result || 'No result';
          convertedContent += `[Tool Result] ${result}\n`;
        } else {
          // 未知类型的内容块，尝试提取文本
          const textContent = contentBlock.text || contentBlock.content || JQJsonHandler.stringifyJson(contentBlock);
          convertedContent += textContent + '\n';
        }
      }
    } else if (msg.content && typeof msg.content === 'object') {
      // 处理对象格式的内容
      if (msg.content.text) {
        convertedContent = msg.content.text;
      } else if (msg.content.content) {
        convertedContent = msg.content.content;
      } else {
        // fallback: 转换整个对象为JSON字符串
        convertedContent = JQJsonHandler.stringifyJson(msg.content);
      }
    }

    // 清理内容，移除多余的换行符
    convertedContent = convertedContent.trim();
    
    // 如果转换后仍然为空，提供默认内容
    if (!convertedContent) {
      convertedContent = '[Empty content]';
    }

    console.log(`🔧 消息内容转换: ${msg.role} - ${convertedContent.substring(0, 100)}${convertedContent.length > 100 ? '...' : ''}`);

    return {
      ...msg,
      content: convertedContent
    };
  }

  /**
   * 验证和修复工具格式以确保LM Studio兼容性
   */
  private validateAndFixToolsForLMStudio(tools: any[]): any[] {
    if (!tools || !Array.isArray(tools)) {
      return [];
    }

    return tools.map((tool, index) => {
      // 检查工具的基本结构
      if (!tool || typeof tool !== 'object') {
        console.warn(`🔧 工具 ${index} 格式无效，跳过`);
        return null;
      }

      // 确保工具有正确的OpenAI格式
      const fixedTool: any = {
        type: 'function', // 强制设置为 'function'
      };

      // 处理function字段
      if (tool.function && typeof tool.function === 'object') {
        // 如果已经有function字段，验证其格式
        fixedTool.function = {
          name: tool.function.name || `tool_${index}`,
          description: tool.function.description || 'Auto-generated tool',
          parameters: tool.function.parameters || { type: 'object', properties: {} },
        };
      } else if (tool.name) {
        // 如果是Anthropic格式，转换为OpenAI格式
        fixedTool.function = {
          name: tool.name,
          description: tool.description || 'Auto-converted from Anthropic format',
          parameters: tool.input_schema || { type: 'object', properties: {} },
        };
      } else {
        // 无法识别的格式，创建默认工具
        console.warn(`🔧 工具 ${index} 格式无法识别，使用默认格式`);
        fixedTool.function = {
          name: `unknown_tool_${index}`,
          description: 'Unknown tool format, auto-generated',
          parameters: { type: 'object', properties: {} },
        };
      }

      // 验证必需字段
      if (!fixedTool.function.name || typeof fixedTool.function.name !== 'string') {
        console.warn(`🔧 工具 ${index} 缺少有效的name字段，跳过`);
        return null;
      }

      console.log(`🔧 工具 ${index} 修复完成: ${fixedTool.function.name}`);
      return fixedTool;
    }).filter(tool => tool !== null); // 过滤掉无效工具
  }

  /**
   * 验证和修复tool_choice格式以确保LM Studio兼容性
   */
  private validateAndFixToolChoiceForLMStudio(toolChoice: any): any {
    // 如果是字符串类型的简单选择
    if (typeof toolChoice === 'string') {
      const validChoices = ['none', 'auto', 'required'];
      if (validChoices.includes(toolChoice)) {
        return toolChoice;
      }
      console.warn(`🔧 无效的tool_choice字符串: ${toolChoice}，使用auto`);
      return 'auto';
    }

    // 如果是对象格式（指定特定函数）
    if (typeof toolChoice === 'object' && toolChoice !== null) {
      if (toolChoice.type === 'function' && toolChoice.function && toolChoice.function.name) {
        return toolChoice;
      }
      console.warn(`🔧 无效的tool_choice对象格式，使用auto`);
      return 'auto';
    }

    // 默认返回auto
    console.warn(`🔧 未知的tool_choice格式，使用auto`);
    return 'auto';
  }

  /**
   * 验证标准协议请求
   */
  private validateStandardRequest(request: StandardRequest): void {
    if (!request.model) {
      throw new Error('缺少model参数');
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('缺少messages参数或格式无效');
    }

    // 🔧 关键修复：检查映射后的实际模型是否支持
    const actualModel = this.mapVirtualModelToActual(request.model);
    if (!this.preConfig.models.includes(actualModel)) {
      throw new Error(`映射后的模型 ${actualModel} (来自虚拟模型 ${request.model}) 不在支持列表中: ${this.preConfig.models.join(', ')}`);
    }
  }

  /**
   * 标准协议 → LM Studio特定格式
   */
  private adaptRequest(standardRequest: StandardRequest): LMStudioRequest {
    const lmstudioRequest: LMStudioRequest = {
      ...standardRequest,
    };

    // LM Studio特定的参数映射
    if (standardRequest.temperature !== undefined) {
      // LM Studio可能对temperature有特定的范围要求
      lmstudioRequest.temperature = Math.max(0.01, Math.min(2.0, standardRequest.temperature));
    }

    // 如果有系统消息，可能需要特殊处理
    const systemMessage = standardRequest.messages.find(m => m.role === 'system');
    if (systemMessage) {
      lmstudioRequest.system_prompt = systemMessage.content;
    }

    return lmstudioRequest;
  }

  /**
   * 从配置文件获取模型的最大输出token限制
   */
  private getModelMaxTokens(model: string): number {
    // 🔧 FIXED: 移除token限制 - 不再限制输出token数量
    // 返回用户请求的max_tokens，或者不设置限制
    return undefined; // 让模型自行决定输出长度
  }

  /**
   * 调用LM Studio API（使用官方OpenAI SDK）
   */
  private async callLMStudio(request: LMStudioRequest): Promise<LMStudioResponse> {
    try {
      if (request.stream) {
        // 流式处理
        throw new Error('流式处理暂未实现'); // TODO: 实现流式处理
      } else {
        // 非流式处理
        // 🔧 FIXED: 移除token限制 - 直接传递用户请求的max_tokens
        const response = await this.openaiClient.chat.completions.create({
          model: request.model,
          messages: request.messages as any,
          max_tokens: request.max_tokens, // 直接使用用户请求的值，不做限制
          temperature: request.temperature,
          top_p: request.top_p,
          frequency_penalty: request.frequency_penalty,
          presence_penalty: request.presence_penalty,
          stop: request.stop,
          tools: request.tools,
          tool_choice: request.tool_choice,
          stream: false,
        });

        return response as LMStudioResponse;
      }
    } catch (error) {
      if (error.name === 'APIError') {
        throw new Error(`LM Studio API错误: ${error.message}`);
      } else if (error.name === 'APIConnectionError') {
        throw new Error(`LM Studio连接错误: ${error.message}`);
      } else if (error.name === 'APITimeoutError') {
        throw new Error(`LM Studio请求超时: ${error.message}`);
      } else {
        throw new Error(`LM Studio未知错误: ${error.message}`);
      }
    }
  }

  /**
   * LM Studio响应 → 标准协议格式
   */
  private adaptResponse(lmstudioResponse: LMStudioResponse): StandardResponse {
    // LM Studio的响应通常已经符合OpenAI标准，但可能需要一些清理
    const standardResponse: StandardResponse = {
      id: lmstudioResponse.id,
      object: lmstudioResponse.object,
      created: lmstudioResponse.created,
      model: lmstudioResponse.model,
      choices: lmstudioResponse.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
        finish_reason: choice.finish_reason,
      })),
      usage: {
        prompt_tokens: lmstudioResponse.usage.prompt_tokens,
        completion_tokens: lmstudioResponse.usage.completion_tokens,
        total_tokens: lmstudioResponse.usage.total_tokens,
      },
    };

    return standardResponse;
  }

  /**
   * 测试与LM Studio的连接
   */
  private async testConnection(): Promise<void> {
    try {
      // 获取模型列表来测试连接
      const models = await this.openaiClient.models.list();
      console.log(`🔍 检测到 ${models.data.length} 个LM Studio模型`);

      if (models.data.length === 0) {
        throw new Error('LM Studio没有加载任何模型');
      }
    } catch (error) {
      throw new Error(`LM Studio连接测试失败: ${error.message}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const startTime = Date.now();

    try {
      await this.testConnection();
      const responseTime = Date.now() - startTime;

      this.status = 'healthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: true, details: { responseTime } };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: false, details: { responseTime, error: error.message } };
    }
  }

  /**
   * 获取支持的模型列表
   */
  async getSupportedModels(): Promise<string[]> {
    try {
      const models = await this.openaiClient.models.list();
      return models.data.map(model => model.id);
    } catch (error) {
      console.warn('获取LM Studio模型列表失败，使用配置中的模型列表');
      return this.preConfig.models;
    }
  }

  /**
   * 更新请求处理指标
   */
  private updateRequestMetrics(processingTime: number, success: boolean): void {
    this.metrics.requestsProcessed++;
    this.updateCommonMetrics(processingTime, success);
  }

  /**
   * 更新响应处理指标
   */
  private updateResponseMetrics(processingTime: number, success: boolean): void {
    this.metrics.responsesProcessed++;
    this.updateCommonMetrics(processingTime, success);
  }

  /**
   * 更新通用指标
   */
  private updateCommonMetrics(processingTime: number, success: boolean): void {
    this.metrics.totalProcessingTime += processingTime;
    const totalOperations = this.metrics.requestsProcessed + this.metrics.responsesProcessed;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / Math.max(totalOperations, 1);
    
    if (!success) {
      this.metrics.errorsHandled++;
    }
  }

  /**
   * 适配LM Studio响应到标准OpenAI格式
   */
  private adaptLMStudioResponseToStandard(lmstudioResponse: any): any {
    try {
      // 如果响应已经是标准OpenAI格式，直接返回
      if (this.isStandardOpenAIResponse(lmstudioResponse)) {
        console.log(`✅ LM Studio响应已是标准格式`);
        return lmstudioResponse;
      }

      // 处理LM Studio特定的响应格式
      const standardResponse = {
        ...lmstudioResponse,
        // 确保usage字段格式正确
        usage: this.normalizeUsageField(lmstudioResponse.usage),
        // 确保choices字段格式正确
        choices: this.normalizeChoicesField(lmstudioResponse.choices)
      };

      console.log(`🔧 LM Studio响应已标准化`);
      return standardResponse;
    } catch (error) {
      console.warn(`⚠️ LM Studio响应适配失败，返回原始响应:`, error.message);
      return lmstudioResponse;
    }
  }

  /**
   * 检查是否为标准OpenAI响应格式
   */
  private isStandardOpenAIResponse(response: any): boolean {
    return response && 
           response.choices && 
           Array.isArray(response.choices) && 
           response.usage &&
           typeof response.usage.total_tokens === 'number';
  }

  /**
   * 标准化usage字段
   */
  private normalizeUsageField(usage: any): any {
    if (!usage) {
      return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    return {
      prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
      completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
      total_tokens: usage.total_tokens || 
                   (usage.prompt_tokens || usage.input_tokens || 0) + 
                   (usage.completion_tokens || usage.output_tokens || 0)
    };
  }

  /**
   * 标准化choices字段
   */
  private normalizeChoicesField(choices: any[]): any[] {
    if (!Array.isArray(choices)) {
      return [];
    }

    return choices.map(choice => ({
      ...choice,
      // 确保finish_reason字段存在
      finish_reason: choice.finish_reason || 'stop'
    }));
  }

  /**
   * 将虚拟模型映射到实际的LM Studio模型 - 使用预配置的映射规则
   */
  private mapVirtualModelToActual(virtualModel: string): string {
    // 使用预配置的模型映射规则
    const customMapping = this.preConfig.modelMappingRules || {};
    if (customMapping[virtualModel]) {
      console.log(`🔄 自定义虚拟模型映射: ${virtualModel} -> ${customMapping[virtualModel]}`);
      return customMapping[virtualModel];
    }

    // 默认虚拟模型到实际模型的映射
    const defaultModelMapping: Record<string, string> = {
      'default': this.preConfig.models[0] || 'llama-3.1-8b-instruct',
      'reasoning': this.preConfig.models[0] || 'llama-3.1-8b-instruct', 
      'longContext': this.preConfig.models[0] || 'llama-3.1-8b-instruct',
      'webSearch': this.preConfig.models[0] || 'llama-3.1-8b-instruct',
      'background': this.preConfig.models[0] || 'llama-3.1-8b-instruct',
    };

    // 如果是虚拟模型，返回映射的实际模型
    if (defaultModelMapping[virtualModel]) {
      console.log(`🔄 虚拟模型映射: ${virtualModel} -> ${defaultModelMapping[virtualModel]}`);
      return defaultModelMapping[virtualModel];
    }

    // 如果已经是实际模型名称，直接返回
    if (this.preConfig.models.includes(virtualModel)) {
      return virtualModel;
    }

    // 如果都不匹配，返回默认模型
    console.warn(`⚠️ 未知模型 ${virtualModel}，使用默认模型 ${this.preConfig.models[0]}`);
    return this.preConfig.models[0] || 'llama-3.1-8b-instruct';
  }

  // Missing ModuleInterface methods
  getMetrics(): ModuleMetrics {
    const totalOperations = this.metrics.requestsProcessed + this.metrics.responsesProcessed;
    return {
      requestsProcessed: totalOperations,
      averageProcessingTime: this.metrics.averageProcessingTime,
      errorRate: this.metrics.errorsHandled / Math.max(totalOperations, 1),
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  async configure(config: any): Promise<void> {
    // 预配置模式：拒绝运行时配置更改
    if (this.isPreConfigured) {
      console.warn('LM Studio Compatibility module is pre-configured, runtime configuration ignored', {
        moduleId: this.id,
        attemptedConfig: Object.keys(config || {}),
        currentPreConfig: Object.keys(this.preConfig)
      });
      return;
    }
    
    // 非预配置模式下的传统配置（保持向后兼容）
    console.log('LM Studio Compatibility module configured (legacy mode)');
  }

  async reset(): Promise<void> {
    // Reset logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }

  // ModuleInterface连接管理方法
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  hasConnection(moduleId: string): boolean {
    return this.connections.has(moduleId);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // 模块间通信方法
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      // 发送消息到目标模块
      targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
      });
      return Promise.resolve({ success: true, targetModuleId, message, type });
    }
    return Promise.resolve({ success: false, targetModuleId, message, type });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.on('moduleMessage', (data: any) => {
      listener(data.fromModuleId, data.message, data.type);
    });
  }
  
  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    const connection = this.connections.get(targetModuleId);
    if (!connection) {
      return 'disconnected';
    }
    const status = connection.getStatus();
    return status.status === 'running' ? 'connected' : status.status as any;
  }
  
  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      const status = targetModule.getStatus();
      const metrics = targetModule.getMetrics();
      return status.status === 'running' && status.health === 'healthy';
    } catch (error) {
      return false;
    }
  }
}
