/**
 * Max Token Preprocessing Module
 * 最大Token预处理模块
 * Owner: Jason Zhang
 * 
 * 提供多种max token处理策略：
 * 1. 动态截断历史记录
 * 2. 路由重定向到long context模型
 * 3. Long context模型压缩
 */

export interface MaxTokenStrategy {
  name: string;
  enabled: boolean;
  priority: number;
}

export interface DynamicTruncationConfig extends MaxTokenStrategy {
  name: 'dynamic_truncation';
  truncatePosition: 'head' | 'tail' | 'middle';
  tokenRatio: number; // 截断比例，默认0.95 (95%)
  preserveSystemPrompt: boolean;
  preserveLatestMessages: number; // 保留最新N条消息
  enableSimplifiedTools: boolean; // 使用简化工具提示
}

export interface RouteRedirectionConfig extends MaxTokenStrategy {
  name: 'route_redirection';
  longContextCategory: string; // 重定向到的长上下文类别
  tokenThreshold: number; // 触发重定向的token阈值
}

export interface LongContextCompressionConfig extends MaxTokenStrategy {
  name: 'long_context_compression';
  compressionRatio: number; // 压缩比例
  compressionModel: string; // 用于压缩的模型
}

export interface MaxTokenPreprocessorConfig {
  enabled: boolean;
  strategies: {
    dynamicTruncation: DynamicTruncationConfig;
    routeRedirection: RouteRedirectionConfig;
    longContextCompression: LongContextCompressionConfig;
  };
}

export interface Message {
  role: string;
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface PreprocessedRequest {
  messages: Message[];
  model: string;
  max_tokens?: number;
  temperature?: number;
  tools?: any[];
  redirectedCategory?: string;
  appliedStrategies: string[];
  originalTokenCount: number;
  processedTokenCount: number;
}

export interface TokenAnalysis {
  totalTokens: number;
  systemTokens: number;
  userTokens: number;
  assistantTokens: number;
  toolTokens: number;
  exceedsLimit: boolean;
  exceedsBy: number;
}

export class MaxTokenPreprocessor {
  private config: MaxTokenPreprocessorConfig;

  constructor(config: MaxTokenPreprocessorConfig) {
    this.config = config;
  }

  /**
   * 主要预处理入口
   */
  async preprocessRequest(
    request: any,
    maxTokenLimit: number,
    routingCategory?: string
  ): Promise<PreprocessedRequest> {
    if (!this.config.enabled) {
      return {
        ...request,
        appliedStrategies: [],
        originalTokenCount: 0,
        processedTokenCount: 0
      };
    }

    const tokenAnalysis = this.analyzeTokens(request);
    const appliedStrategies: string[] = [];

    let processedRequest = { ...request };

    // 如果不超过限制，直接返回
    if (!tokenAnalysis.exceedsLimit || tokenAnalysis.totalTokens <= maxTokenLimit) {
      return {
        ...processedRequest,
        appliedStrategies,
        originalTokenCount: tokenAnalysis.totalTokens,
        processedTokenCount: tokenAnalysis.totalTokens
      };
    }

    // 按优先级应用策略
    const enabledStrategies = this.getEnabledStrategiesByPriority();

    for (const strategy of enabledStrategies) {
      switch (strategy.name) {
        case 'route_redirection':
          const redirectResult = this.applyRouteRedirection(
            processedRequest, 
            tokenAnalysis, 
            this.config.strategies.routeRedirection
          );
          if (redirectResult.applied) {
            processedRequest = redirectResult.request;
            appliedStrategies.push('route_redirection');
          }
          break;

        case 'dynamic_truncation':
          const truncationResult = this.applyDynamicTruncation(
            processedRequest,
            tokenAnalysis,
            maxTokenLimit,
            this.config.strategies.dynamicTruncation
          );
          if (truncationResult.applied) {
            processedRequest = truncationResult.request;
            appliedStrategies.push('dynamic_truncation');
            tokenAnalysis.totalTokens = truncationResult.newTokenCount;
          }
          break;

        case 'long_context_compression':
          const compressionResult = await this.applyLongContextCompression(
            processedRequest,
            tokenAnalysis,
            this.config.strategies.longContextCompression
          );
          if (compressionResult.applied) {
            processedRequest = compressionResult.request;
            appliedStrategies.push('long_context_compression');
            tokenAnalysis.totalTokens = compressionResult.newTokenCount;
          }
          break;
      }

      // 如果已经在限制内，停止应用策略
      if (tokenAnalysis.totalTokens <= maxTokenLimit) {
        break;
      }
    }

    return {
      ...processedRequest,
      appliedStrategies,
      originalTokenCount: this.analyzeTokens(request).totalTokens,
      processedTokenCount: tokenAnalysis.totalTokens
    };
  }

  /**
   * 分析请求的token使用情况
   */
  private analyzeTokens(request: any): TokenAnalysis {
    const messages = request.messages || [];
    let totalTokens = 0;
    let systemTokens = 0;
    let userTokens = 0;
    let assistantTokens = 0;
    let toolTokens = 0;

    // 简化的token计算 (实际应该使用tokenizer)
    for (const message of messages) {
      const messageTokens = this.estimateTokens(message.content || '');
      totalTokens += messageTokens;

      switch (message.role) {
        case 'system':
          systemTokens += messageTokens;
          break;
        case 'user':
          userTokens += messageTokens;
          break;
        case 'assistant':
          assistantTokens += messageTokens;
          break;
        case 'tool':
          toolTokens += messageTokens;
          break;
      }

      // 计算工具调用的tokens
      if (message.tool_calls) {
        const toolCallTokens = this.estimateTokens(JSON.stringify(message.tool_calls));
        totalTokens += toolCallTokens;
        toolTokens += toolCallTokens;
      }
    }

    // 添加工具定义的tokens
    if (request.tools) {
      const toolDefTokens = this.estimateTokens(JSON.stringify(request.tools));
      totalTokens += toolDefTokens;
      toolTokens += toolDefTokens;
    }

    const maxTokens = request.max_tokens || 4096;
    const exceedsLimit = totalTokens > maxTokens;

    return {
      totalTokens,
      systemTokens,
      userTokens,
      assistantTokens,
      toolTokens,
      exceedsLimit,
      exceedsBy: exceedsLimit ? totalTokens - maxTokens : 0
    };
  }

  /**
   * 简化的token估算 (实际应该使用准确的tokenizer)
   */
  private estimateTokens(text: string): number {
    // 简化估算: 1 token ≈ 4 characters for most models
    return Math.ceil(text.length / 4);
  }

  /**
   * 按优先级获取启用的策略
   */
  private getEnabledStrategiesByPriority(): MaxTokenStrategy[] {
    const strategies = Object.values(this.config.strategies);
    return strategies
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 应用路由重定向策略
   */
  private applyRouteRedirection(
    request: any,
    tokenAnalysis: TokenAnalysis,
    config: RouteRedirectionConfig
  ): { applied: boolean; request: any } {
    if (!config.enabled || tokenAnalysis.totalTokens < config.tokenThreshold) {
      return { applied: false, request };
    }

    return {
      applied: true,
      request: {
        ...request,
        redirectedCategory: config.longContextCategory
      }
    };
  }

  /**
   * 应用动态截断策略
   */
  private applyDynamicTruncation(
    request: any,
    tokenAnalysis: TokenAnalysis,
    maxTokenLimit: number,
    config: DynamicTruncationConfig
  ): { applied: boolean; request: any; newTokenCount: number } {
    if (!config.enabled) {
      return { applied: false, request, newTokenCount: tokenAnalysis.totalTokens };
    }

    const messages = [...(request.messages || [])];
    const targetTokenCount = Math.floor(maxTokenLimit * config.tokenRatio);

    let processedMessages = messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // 保留最新的N条消息
    const latestMessages = nonSystemMessages.slice(-config.preserveLatestMessages);
    const truncatableMessages = nonSystemMessages.slice(0, -config.preserveLatestMessages);

    let currentTokens = this.calculateMessagesTokens([...systemMessages, ...latestMessages]);

    // 根据截断位置处理
    switch (config.truncatePosition) {
      case 'head':
        // 从头部开始移除旧消息
        while (currentTokens > targetTokenCount && truncatableMessages.length > 0) {
          truncatableMessages.shift();
          currentTokens = this.calculateMessagesTokens([...systemMessages, ...truncatableMessages, ...latestMessages]);
        }
        break;

      case 'tail':
        // 从尾部开始移除 (但保留最新消息)
        while (currentTokens > targetTokenCount && truncatableMessages.length > 0) {
          truncatableMessages.pop();
          currentTokens = this.calculateMessagesTokens([...systemMessages, ...truncatableMessages, ...latestMessages]);
        }
        break;

      case 'middle':
        // 从中间开始移除
        while (currentTokens > targetTokenCount && truncatableMessages.length > 0) {
          const middleIndex = Math.floor(truncatableMessages.length / 2);
          truncatableMessages.splice(middleIndex, 1);
          currentTokens = this.calculateMessagesTokens([...systemMessages, ...truncatableMessages, ...latestMessages]);
        }
        break;
    }

    processedMessages = [...systemMessages, ...truncatableMessages, ...latestMessages];

    // 如果启用了简化工具提示，替换工具定义
    let processedTools = request.tools;
    if (config.enableSimplifiedTools && request.tools) {
      processedTools = this.simplifyToolDefinitions(request.tools);
    }

    return {
      applied: true,
      request: {
        ...request,
        messages: processedMessages,
        tools: processedTools
      },
      newTokenCount: this.calculateMessagesTokens(processedMessages) + 
        (processedTools ? this.estimateTokens(JSON.stringify(processedTools)) : 0)
    };
  }

  /**
   * 计算消息列表的总token数
   */
  private calculateMessagesTokens(messages: Message[]): number {
    return messages.reduce((total, message) => {
      let messageTokens = this.estimateTokens(message.content || '');
      if (message.tool_calls) {
        messageTokens += this.estimateTokens(JSON.stringify(message.tool_calls));
      }
      return total + messageTokens;
    }, 0);
  }

  /**
   * 简化工具定义
   */
  private simplifyToolDefinitions(tools: any[]): any[] {
    return tools.map(tool => ({
      type: tool.type,
      function: {
        name: tool.function?.name,
        description: tool.function?.description?.substring(0, 100) + '...',
        parameters: {
          type: 'object',
          properties: Object.keys(tool.function?.parameters?.properties || {}).reduce((acc: any, key) => {
            acc[key] = { type: 'string', description: 'Parameter' };
            return acc;
          }, {}),
          required: tool.function?.parameters?.required || []
        }
      }
    }));
  }

  /**
   * 应用长上下文压缩策略
   */
  private async applyLongContextCompression(
    request: any,
    tokenAnalysis: TokenAnalysis,
    config: LongContextCompressionConfig
  ): Promise<{ applied: boolean; request: any; newTokenCount: number }> {
    if (!config.enabled) {
      return { applied: false, request, newTokenCount: tokenAnalysis.totalTokens };
    }

    // TODO: 实现实际的压缩逻辑
    // 这里需要调用压缩模型来压缩历史对话
    
    const compressedMessages = await this.compressMessages(
      request.messages,
      config.compressionRatio,
      config.compressionModel
    );

    const newTokenCount = this.calculateMessagesTokens(compressedMessages);

    return {
      applied: true,
      request: {
        ...request,
        messages: compressedMessages
      },
      newTokenCount
    };
  }

  /**
   * 压缩消息 (占位符实现)
   */
  private async compressMessages(
    messages: Message[],
    ratio: number,
    compressionModel: string
  ): Promise<Message[]> {
    // TODO: 实现实际的压缩逻辑
    // 现在只是简单地截断内容
    return messages.map(message => {
      if (message.role === 'user' || message.role === 'assistant') {
        const originalLength = message.content?.length || 0;
        const targetLength = Math.floor(originalLength * ratio);
        return {
          ...message,
          content: message.content?.substring(0, targetLength) + '...'
        };
      }
      return message;
    });
  }

  /**
   * 获取默认配置
   */
  static getDefaultConfig(): MaxTokenPreprocessorConfig {
    return {
      enabled: true,
      strategies: {
        dynamicTruncation: {
          name: 'dynamic_truncation',
          enabled: true,
          priority: 2,
          truncatePosition: 'head',
          tokenRatio: 0.95,
          preserveSystemPrompt: true,
          preserveLatestMessages: 2,
          enableSimplifiedTools: true
        },
        routeRedirection: {
          name: 'route_redirection',
          enabled: true,
          priority: 1,
          longContextCategory: 'longcontext',
          tokenThreshold: 3000
        },
        longContextCompression: {
          name: 'long_context_compression',
          enabled: false,
          priority: 3,
          compressionRatio: 0.7,
          compressionModel: 'gemini-2.5-pro'
        }
      }
    };
  }
}