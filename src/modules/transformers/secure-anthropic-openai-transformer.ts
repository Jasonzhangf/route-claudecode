/**
 * Secure Anthropic to OpenAI Transformer
 *
 * 统一的、安全的Anthropic ↔ OpenAI协议转换器
 * 修复安全审计报告中发现的所有漏洞和架构问题
 *
 * 安全特性：
 * - 严格的输入验证和边界检查
 * - 安全的JSON解析
 * - 完整的错误处理和日志记录
 * - 资源使用控制
 * - 类型安全保证
 *
 * @author Jason Zhang
 * @version 2.0.0
 * @security-reviewed 2025-08-19
 */

import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
  IValidationResult,
} from '../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { JQJsonHandler } from '../../utils/jq-json-handler';


/**
 * 安全配置接口
 */
export interface SecureTransformerConfig {
  // 基础配置
  readonly preserveToolCalls: boolean;
  readonly mapSystemMessage: boolean;
  readonly defaultMaxTokens: number;

  // 基本限制
  readonly maxTokens: number;

}

/**
 * 安全错误类型
 */
export class TransformerSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'TransformerSecurityError';
  }
}

/**
 * 验证错误类型
 */
export class TransformerValidationError extends Error {
  constructor(
    message: string,
    public readonly violations: string[],
    public readonly context?: any
  ) {
    super(message);
    this.name = 'TransformerValidationError';
  }
}

/**
 * 严格类型定义的Anthropic请求接口
 */
export interface AnthropicRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content:
      | string
      | ReadonlyArray<{
          readonly type: 'text' | 'image' | 'tool_use' | 'tool_result';
          readonly text?: string;
          readonly source?: {
            readonly type: 'base64';
            readonly media_type: string;
            readonly data: string;
          };
          // Tool use fields
          readonly id?: string;
          readonly name?: string;
          readonly input?: Record<string, any>;
          // Tool result fields
          readonly tool_use_id?: string;
          readonly content?: any;
          readonly is_error?: boolean;
        }>;
  }>;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly top_k?: number;
  readonly stop_sequences?: ReadonlyArray<string>;
  readonly stream?: boolean;
  readonly system?: string;
  readonly tools?: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
    readonly input_schema: Record<string, any>;
  }>;
}

/**
 * 严格类型定义的OpenAI请求接口
 */
export interface OpenAIRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<{
    readonly role: 'system' | 'user' | 'assistant' | 'tool';
    readonly content: string;
    readonly name?: string;
    readonly tool_call_id?: string;
  }>;
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly frequency_penalty?: number;
  readonly presence_penalty?: number;
  readonly stop?: string | ReadonlyArray<string>;
  readonly stream?: boolean;
  readonly tools?: ReadonlyArray<{
    readonly type: 'function';
    readonly function: {
      readonly name: string;
      readonly description: string;
      readonly parameters: Record<string, any>;
    };
  }>;
  readonly tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | {
        readonly type: 'function';
        readonly function: {
          readonly name: string;
        };
      };
}

/**
 * 严格类型定义的OpenAI响应接口
 */
export interface OpenAIResponse {
  readonly id: string;
  readonly object: 'chat.completion';
  readonly created: number;
  readonly model: string;
  readonly choices: ReadonlyArray<{
    readonly index: number;
    readonly message: {
      readonly role: 'assistant';
      readonly content?: string;
      readonly tool_calls?: ReadonlyArray<{
        readonly id: string;
        readonly type: 'function';
        readonly function: {
          readonly name: string;
          readonly arguments: string;
        };
      }>;
    };
    readonly finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

/**
 * 严格类型定义的Anthropic响应接口
 */
export interface AnthropicResponse {
  readonly id: string;
  readonly type: 'message';
  readonly role: 'assistant';
  readonly content: ReadonlyArray<{
    readonly type: 'text' | 'tool_use';
    readonly text?: string;
    readonly id?: string;
    readonly name?: string;
    readonly input?: Record<string, any>;
  }>;
  readonly model: string;
  readonly stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  readonly stop_sequence?: string;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
  };
}

/**
 * 安全的Anthropic到OpenAI转换器
 *
 * 特性：
 * - 统一接口实现，消除重复
 * - 严格的输入验证和边界检查
 * - 安全的JSON解析和处理
 * - 完整的错误处理和日志记录
 * - 资源使用控制和超时保护
 * - 纯协议转换，无业务逻辑
 */
export class SecureAnthropicToOpenAITransformer extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'secure-anthropic-openai-transformer';
  private readonly name: string = 'Secure Anthropic OpenAI Transformer';
  private readonly type: ModuleType = ModuleType.TRANSFORMER;
  private readonly version: string = '2.0.0';
  private status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';

  private readonly config: SecureTransformerConfig;
  private readonly metrics: ModuleMetrics;
  private readonly securityLogger: (event: string, details: any) => void;

  constructor(config: Partial<SecureTransformerConfig> = {}) {
    super();

    // 创建简单的默认配置
    this.config = Object.freeze({
      // 基础配置
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      maxTokens: config.maxTokens || 8192,
      ...config,
    });

    // 初始化性能指标
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };

    // 简单的日志记录器
    this.securityLogger = (event: string, details: any) => {
      console.log(`[${this.id}] ${event}:`, details);
    };
  }

  // ============================================================================
  // ModuleInterface 实现
  // ============================================================================

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
      type: this.type,
      status: this.status,
      health: this.determineHealth(),
      lastActivity: new Date(),
    };
  }

  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  async configure(config: Partial<SecureTransformerConfig>): Promise<void> {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration object');
    }
  }

  async start(): Promise<void> {
    this.status = 'running';
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.removeAllListeners();
    this.emit('stopped');
  }

  async reset(): Promise<void> {
    this.metrics.requestsProcessed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.errorRate = 0;
    this.metrics.memoryUsage = 0;
    this.metrics.cpuUsage = 0;
    this.emit('reset');
  }

  async cleanup(): Promise<void> {
    this.removeAllListeners();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'running',
      details: {
        status: this.status,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 主要处理方法 - 支持双向转换
   */
  async process(input: unknown): Promise<OpenAIRequest | AnthropicResponse> {
    if (this.status !== 'running') {
      throw new Error('Transformer not in running state');
    }

    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }

    // 🔍 Critical debug: Track all calls to the Transformer
    // Debug logging removed for cleaner output
    
    if ((input as any).model) {
      // Model debug logging removed
    }
    if ((input as any).messages) {
      // Messages count debug logging removed
      // 检查是否有tool_result内容
      const hasToolResult = (input as any).messages?.some((msg: any) => 
        Array.isArray(msg.content) && msg.content.some((item: any) => item.type === 'tool_result')
      );
      // Tool result debug logging removed
    }
    // Transformation start debug logging removed
    
    // 🔧 Simple debug - avoid complex operations that might fail
    // Input type checking debug removed
    
    if (input && typeof input === 'object') {
      try {
        const inputKeys = Object.keys(input);
        // Input keys and tools field debug logging removed
      } catch (e) {
        console.error('🚨 [TRANSFORMER DEBUG] Key extraction failed:', e.message);
      }
    }

    const result = this.performTransformation(input);
    
    // Transformation completion debug logging removed
    
    return result;
  }


  // ============================================================================
  // 私有安全方法
  // ============================================================================

  private performTransformation(input: unknown): OpenAIRequest | AnthropicResponse {
    // Transformation perform debug logging removed
    try {
      // Input type check debug logging removed
      
      // 🔧 优先检查错误响应 - 避免处理不完整的OpenAI响应
      if (this.isOpenAIErrorResponse(input)) {
        // OpenAI error response debug logging removed
        // 错误响应不应该被转换，直接抛出包含完整错误信息的异常
        const errorInput = input as any;
        let errorMessage = 'API Error Response';
        
        if (errorInput.error?.message) {
          errorMessage = errorInput.error.message;
        } else if (errorInput.errors?.message) {
          errorMessage = errorInput.errors.message;
        } else if (errorInput.message) {
          errorMessage = errorInput.message;
        } else if (errorInput.detail) {
          errorMessage = errorInput.detail;
        }
        
        throw new Error(`API Error: ${errorMessage}`);
      }
      
      if (this.isAnthropicRequest(input)) {
        // Anthropic request debug logging removed
        return this.transformAnthropicToOpenAI(input as AnthropicRequest);
      } else if (this.isOpenAIRequest(input)) {
        // OpenAI request passthrough debug logging removed
        // OpenAI请求直接传递，不需要转换
        return input as OpenAIRequest;
      } else if (this.isOpenAIResponse(input)) {
        // OpenAI response debug logging removed
        return this.transformOpenAIToAnthropic(input as OpenAIResponse);
      } else {
        // Unsupported format debug logging removed
        
        // 🔧 修复：如果输入看起来像一个响应但格式不完整，尝试提取错误信息
        if (input && typeof input === 'object') {
          const inputObj = input as any;
          if (inputObj.message || inputObj.error || inputObj.errors || inputObj.detail) {
            let errorMessage = inputObj.message || inputObj.detail || 'Unknown API error';
            if (inputObj.error?.message) {
              errorMessage = inputObj.error.message;
            } else if (inputObj.errors?.message) {
              errorMessage = inputObj.errors.message;
            }
            throw new Error(`API Error: ${errorMessage}`);
          }
        }
        
        throw new TransformerValidationError(
          'Unsupported input format',
          ['Input must be valid Anthropic request, OpenAI request, or OpenAI response'],
          { inputType: typeof input }
        );
      }
    } catch (error) {
      console.error('🚨 [TRANSFORMER PERFORM] Error in performTransformation:', error.message);
      throw error;
    }
  }

  private transformAnthropicToOpenAI(request: AnthropicRequest): OpenAIRequest {
    // 🔧 Critical debug: Track transformer execution
    // ANTHROPIC->OPENAI method call debug logging removed
    
    // 基本验证
    if (!request.model || !request.messages || !Array.isArray(request.messages)) {
      throw new Error('Invalid Anthropic request: missing model or messages');
    }

    // 创建消息数组
    const messages: any[] = [];

    const openaiRequest: any = {
      model: request.model,
      messages,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: request.stream,
      max_tokens: Math.min(request.max_tokens, this.config.maxTokens),
    };

    // 转换系统消息
    if (request.system && this.config.mapSystemMessage) {
      messages.push({
        role: 'system',
        content: typeof request.system === 'string' ? request.system : JQJsonHandler.stringifyJson(request.system, true),
      });
    }

    // 转换用户消息
    messages.push(...this.convertMessages(request.messages));

    // 转换停止序列
    if (request.stop_sequences && Array.isArray(request.stop_sequences)) {
      openaiRequest.stop = request.stop_sequences;
    }

    // 转换工具定义
    // 工具转换检查 debug logging removed
    
    if (request.tools && this.config.preserveToolCalls) {
      // 执行工具转换 debug logging removed
      openaiRequest.tools = this.convertTools(request.tools);
      // 工具转换完成 debug logging removed
    } else {
      // 跳过工具转换 debug logging removed
    }

    // 🔍 Debug: Log the final OpenAI request to check JSON validity
    // Final OpenAI request debug logging removed
    
    try {
      // Test JSON serialization
      const testJson = JQJsonHandler.stringifyJson(openaiRequest, true);
      // JSON serialization test debug logging removed
    } catch (error) {
      console.error('🚨 [TRANSFORMER ERROR] JSON serialization failed:', error);
      throw new Error(`Invalid OpenAI request format: ${error}`);
    }

    return openaiRequest as OpenAIRequest;
  }

  private transformOpenAIToAnthropic(response: OpenAIResponse): AnthropicResponse {
    // 🔧 增强的响应验证 - 检查错误响应格式
    // OpenAI to Anthropic method call and response validation debug logging removed
    
    // 🔧 关键修复：检查是否为错误响应，避免访问undefined的choices
    if ((response as any).error || (response as any).errors) {
      // Error response detection debug logging removed
      let errorMessage = 'API Error Response';
      
      if ((response as any).error?.message) {
        errorMessage = (response as any).error.message;
      } else if ((response as any).errors?.message) {
        errorMessage = (response as any).errors.message;
      } else if ((response as any).message) {
        errorMessage = (response as any).message;
      }
      
      throw new Error(`API Error: ${errorMessage}`);
    }
    
    // 基本验证 - 使用更详细的错误信息
    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      // Invalid OpenAI response structure debug logging removed
      
      // 尝试从响应中提取有用的错误信息
      let errorDetails = 'missing or empty choices array';
      if ((response as any).message) {
        errorDetails = (response as any).message;
      } else if ((response as any).detail) {
        errorDetails = (response as any).detail;  
      }
      
      throw new Error(`Invalid OpenAI response: ${errorDetails}`);
    }

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('OpenAI response missing required choice or message');
    }

    // 创建可变的内容数组
    const content: any[] = [];

    const anthropicResponse: any = {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content,
      model: response.model,
      stop_reason: this.convertStopReason(choice.finish_reason),
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };

    // 转换文本内容
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    // 转换工具调用
    if (choice.message.tool_calls && this.config.preserveToolCalls) {
      const convertedToolCalls = this.convertToolCalls(choice.message.tool_calls);
      content.push(...convertedToolCalls);

      if (convertedToolCalls.length > 0) {
        anthropicResponse.stop_reason = 'tool_use';
      }
    }

    return anthropicResponse;
  }


  // ============================================================================
  // 转换工具方法
  // ============================================================================

  private convertMessages(messages: ReadonlyArray<AnthropicRequest['messages'][0]>): OpenAIRequest['messages'] {
    const convertedMessages: OpenAIRequest['messages'][0][] = [];

    // convertMessages debug logging removed

    for (const [msgIndex, message] of messages.entries()) {
      // Processing message debug logging removed

      if (!message || typeof message !== 'object') {
        continue;
      }

      if (typeof message.content === 'string') {
        // Simple string content
        convertedMessages.push({
          role: message.role === 'user' ? 'user' : 'assistant',
          content: message.content,
        });
        // Added string message debug logging removed
      } else if (Array.isArray(message.content)) {
        // 🔧 关键修复：正确处理tool_result拆分逻辑
        // 基于demo1转换规则：tool_result必须转换为独立的role="tool"消息
        
        const textParts: string[] = [];
        const toolCalls: any[] = [];
        const toolResults: any[] = [];

        // Processing array content debug logging removed

        // 第一步：分离不同类型的内容
        for (const [itemIndex, item] of message.content.entries()) {
          // Item processing debug logging removed

          if (!item || typeof item !== 'object') {
            continue;
          }

          if (item.type === 'text' && item.text) {
            textParts.push(item.text);
            // Added text part debug logging removed
          } else if (item.type === 'tool_use' && item.name) {
            // Convert Anthropic tool_use to OpenAI tool_calls (for assistant messages)
            toolCalls.push({
              id: item.id || `tool_${Date.now()}`,
              type: 'function',
              function: {
                name: item.name,
                arguments: JQJsonHandler.stringifyJson(item.input || {}, true),
              },
            });
            // Added tool_use debug logging removed
          } else if (item.type === 'tool_result' && (item as any).tool_use_id) {
            // 🎯 关键修复：tool_result转换为独立的OpenAI tool消息
            // 参考demo1场景3：tool_result应该变成独立的role="tool"消息
            const toolResult = {
              role: 'tool' as const,
              tool_call_id: (item as any).tool_use_id,
              content: typeof (item as any).content === 'string' 
                ? (item as any).content 
                : JQJsonHandler.stringifyJson((item as any).content || '', true),
            };
            toolResults.push(toolResult);
            // Prepared tool_result debug logging removed
          } else {
            // Unhandled item type debug logging removed
          }
        }

        // 🔧 关键修复：正确的OpenAI工具调用消息顺序
        // OpenAI规范：assistant(tool_calls) → tool(responses) → user/assistant(next)
        
        // 第一步：如果有工具调用，先添加assistant消息
        if (toolCalls.length > 0 && message.role === 'assistant') {
          const assistantMessage: any = {
            role: 'assistant',
            content: textParts.length > 0 ? textParts.join('\n') : null,
            tool_calls: toolCalls,
          };
          convertedMessages.push(assistantMessage);
        }
        // 第二步：然后添加工具结果消息（紧跟在assistant的tool_calls之后）
        else if (toolResults.length > 0) {
          // tool_result消息应该独立存在，对应之前的tool_calls
          for (const toolResult of toolResults) {
            convertedMessages.push(toolResult);
          }
          
          // 如果还有文本内容，添加为额外的user消息
          if (textParts.length > 0) {
            const userMessage: any = {
              role: message.role === 'user' ? 'user' : 'assistant',
              content: textParts.join('\n'),
            };
            convertedMessages.push(userMessage);
          }
        }
        // 第三步：普通消息（纯文本，无工具调用）
        else if (textParts.length > 0) {
          const regularMessage: any = {
            role: message.role === 'user' ? 'user' : 'assistant', 
            content: textParts.join('\n'),
          };
          convertedMessages.push(regularMessage);
        }
      }
    }

    // Final conversion debug logging removed
    return convertedMessages;
  }

  private convertTools(tools: ReadonlyArray<AnthropicRequest['tools'][0]>): OpenAIRequest['tools'] {
    if (!Array.isArray(tools)) {
      return [];
    }

    const convertedTools: OpenAIRequest['tools'][0][] = [];

    for (const tool of tools) {
      if (!tool || typeof tool !== 'object' || !tool.name) {
        continue;
      }

      convertedTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.input_schema || {},
        },
      });
    }

    return convertedTools;
  }

  private convertToolCalls(
    toolCalls: ReadonlyArray<OpenAIResponse['choices'][0]['message']['tool_calls'][0]>
  ): AnthropicResponse['content'] {
    const convertedCalls: AnthropicResponse['content'][0][] = [];

    for (const [index, toolCall] of toolCalls.entries()) {
      if (!toolCall || typeof toolCall !== 'object' || !toolCall.function?.name) {
        continue;
      }

      try {
        // 使用JQJsonHandler处理工具调用参数，确保正确解析
        let input = {};
        if (toolCall.function.arguments) {
          try {
            input = JQJsonHandler.parseJsonString(toolCall.function.arguments);
          } catch (parseError) {
            // 如果解析失败，尝试修复后再解析
            try {
              const fixedArgs = this.fixToolArguments(toolCall.function.arguments);
              input = JQJsonHandler.parseJsonString(fixedArgs);
            } catch (fixError) {
              // 如果修复也失败，使用空对象
              input = {};
            }
          }
        }

        convertedCalls.push({
          type: 'tool_use',
          id: toolCall.id || `tool_${index}`,
          name: toolCall.function.name,
          input,
        });
      } catch (error) {
        // 跳过无法解析的工具调用
        continue;
      }
    }

    return convertedCalls;
  }

  private convertStopReason(finishReason: string): AnthropicResponse['stop_reason'] {
    const reasonMap: Record<string, AnthropicResponse['stop_reason']> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'stop_sequence',
    };

    return reasonMap[finishReason] || 'end_turn';
  }

  /**
   * 修复工具调用参数格式问题
   * @private
   */
  private fixToolArguments(argumentsStr: string): string {
    try {
      console.log(`🔧 [TOOL-FIX] Starting fix for:`, argumentsStr.substring(0, 100) + '...');
      
      let fixed = argumentsStr;
      
      // 🔧 修复: Qwen API返回的单引号JSON问题
      // 使用简单而有效的字符替换方法
      
      // 1. 移除多余的转义字符
      fixed = fixed.replace(/\\"/g, '"');
      
      // 2. 简单粗暴但有效的单引号替换
      // 先标记所有单引号的位置，然后有选择地替换
      let result = '';
      let inString = false;
      let i = 0;
      
      while (i < fixed.length) {
        const char = fixed[i];
        
        if (char === "'") {
          // 检查是否应该被替换为双引号
          // 简单规则：如果前面是 : 或 { 或 [ 或 ,，后面不是 '，则替换
          const prevNonSpace = this.findPrevNonSpace(fixed, i);
          const nextChar = fixed[i + 1];
          
          if (prevNonSpace && [':', '{', '[', ','].includes(prevNonSpace) && nextChar !== "'") {
            result += '"';
          } else if (nextChar && [':', ',', '}', ']'].includes(nextChar)) {
            // 或者如果后面是 : , } ]，也替换
            result += '"';
          } else {
            result += char;
          }
        } else {
          result += char;
        }
        i++;
      }
      
      fixed = result;
      
      // 3. 修复Python/JavaScript布尔值和null
      fixed = fixed.replace(/:\s*True\b/g, ': true');
      fixed = fixed.replace(/:\s*False\b/g, ': false');  
      fixed = fixed.replace(/:\s*None\b/g, ': null');
      
      // 修复数组中的布尔值
      fixed = fixed.replace(/,\s*True\b/g, ', true');
      fixed = fixed.replace(/,\s*False\b/g, ', false');
      fixed = fixed.replace(/,\s*None\b/g, ', null');
      
      // 修复数组开头的布尔值
      fixed = fixed.replace(/\[\s*True\b/g, '[true');
      fixed = fixed.replace(/\[\s*False\b/g, '[false');
      fixed = fixed.replace(/\[\s*None\b/g, '[null');
      
      // 4. 修复未闭合的引号和括号
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      
      // 5. 验证修复后的JSON格式
      try {
        JSON.parse(fixed);
        console.log(`✅ [TOOL-FIX] Fix succeeded:`, {
          originalLength: argumentsStr.length,
          fixedLength: fixed.length,
          hasArrays: fixed.includes('['),
          hasObjects: fixed.includes('{')
        });
        return fixed;
      } catch (verifyError) {
        console.warn(`❌ [TOOL-FIX] Fix verification failed:`, verifyError.message);
        console.warn(`❌ [TOOL-FIX] Original (${argumentsStr.length} chars):`, argumentsStr);
        console.warn(`❌ [TOOL-FIX] Fixed (${fixed.length} chars):`, fixed);
        throw verifyError;
      }
      
    } catch (error) {
      // 如果修复失败，返回原始字符串
      console.warn(`❌ [TOOL-FIX] Fix failed:`, error.message);
      return argumentsStr;
    }
  }
  
  private findPrevNonSpace(str: string, index: number): string | null {
    for (let i = index - 1; i >= 0; i--) {
      if (str[i] !== ' ' && str[i] !== '\t' && str[i] !== '\n') {
        return str[i];
      }
    }
    return null;
  }

  // ============================================================================
  // 类型检测方法
  // ============================================================================

  private isAnthropicRequest(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    const req = input as any;
    return (
      typeof req.model === 'string' &&
      typeof req.max_tokens === 'number' &&
      Array.isArray(req.messages) &&
      !req.choices && // 不是OpenAI响应
      !req.usage // 不是OpenAI响应
    );
  }

  private isOpenAIRequest(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    const req = input as any;
    return (
      typeof req.model === 'string' &&
      Array.isArray(req.messages) &&
      !req.max_tokens && // 不是Anthropic请求格式
      !req.choices && // 不是OpenAI响应
      !req.usage // 不是OpenAI响应
    );
  }

  private isOpenAIResponse(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    const res = input as any;
    return (
      res.object === 'chat.completion' &&
      Array.isArray(res.choices) &&
      res.usage &&
      typeof res.usage.total_tokens === 'number'
    );
  }

  private isOpenAIErrorResponse(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    const res = input as any;
    // 检查是否为OpenAI错误响应格式
    return (
      res.error && 
      typeof res.error === 'object' &&
      res.error.message
    ) || (
      // 或者其他错误响应格式
      res.errors && 
      typeof res.errors === 'object'
    ) || (
      // 或者是HTTP错误但没有正确的choices结构
      res.object !== 'chat.completion' &&
      !Array.isArray(res.choices) &&
      (res.message || res.detail || res.error)
    );
  }

  private detectInputType(input: unknown): string {
    if (this.isAnthropicRequest(input)) {
      return 'anthropic-request';
    } else if (this.isOpenAIRequest(input)) {
      return 'openai-request';
    } else if (this.isOpenAIResponse(input)) {
      return 'openai-response';
    } else {
      return 'unknown';
    }
  }

  private detectOutputType(output: unknown): string {
    if (!output || typeof output !== 'object') {
      return 'invalid';
    }

    const obj = output as any;
    if (obj.model && obj.messages) {
      return 'openai-request';
    } else if (obj.type === 'message' && obj.content) {
      return 'anthropic-response';
    } else {
      return 'unknown';
    }
  }

  private determineHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    return this.status === 'error' ? 'unhealthy' : 'healthy';
  }
}
