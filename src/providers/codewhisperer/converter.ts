/**
 * CodeWhisperer Request Converter - 重构优化版本
 * 基于demo2兼容性设计，消除硬编码和优化性能
 * 项目所有者: Jason Zhang
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import {
  AnthropicRequest,
  AnthropicRequestMessage,
  AnthropicSystemMessage,
  AnthropicTool,
  ContentBlock,
  CodeWhispererRequest,
  CodeWhispererTool,
  HistoryUserMessage,
  HistoryAssistantMessage,
  CodeWhispererConfig,
  RequestValidationResult,
  createCodeWhispererConfig,
  validateConfig,
} from './types';

export class CodeWhispererConverter {
  private readonly config: CodeWhispererConfig;
  private readonly fallbackContent = 'answer for user qeustion'; // 保持demo2原始拼写错误

  constructor(config?: CodeWhispererConfig) {
    this.config = config || createCodeWhispererConfig();
    
    if (!validateConfig(this.config)) {
      throw new Error('无效的CodeWhisperer配置');
    }
    
    logger.debug('CodeWhispererConverter初始化完成', {
      endpoint: this.config.endpoint,
      origin: this.config.origin,
    });
  }

  /**
   * 提取消息文本内容 - 优化版本
   */
  private extractMessageContent(content: any): string {
    // 快速路径：字符串类型
    if (typeof content === 'string') {
      return content.length === 0 ? this.fallbackContent : content;
    }

    // 数组类型处理
    if (Array.isArray(content)) {
      return this.processContentBlocks(content);
    }

    // 其他类型处理
    return this.handleUnknownContent(content);
  }

  /**
   * 处理内容块数组
   */
  private processContentBlocks(content: any[]): string {
    const texts: string[] = [];
    
    for (const block of content) {
      if (typeof block === 'string') {
        texts.push(block);
        continue;
      }

      if (this.isValidContentBlock(block)) {
        const text = this.extractTextFromBlock(block as ContentBlock);
        if (text) texts.push(text);
      }
    }

    return texts.length > 0 ? texts.join('\n') : this.fallbackContent;
  }

  /**
   * 验证内容块有效性
   */
  private isValidContentBlock(block: any): boolean {
    return block && typeof block === 'object' && 'type' in block;
  }

  /**
   * 从内容块提取文本
   */
  private extractTextFromBlock(block: ContentBlock): string | null {
    switch (block.type) {
      case 'tool_result':
        return block.content || null;
      case 'text':
        return block.text || null;
      default:
        return null;
    }
  }

  /**
   * 处理未知内容类型
   */
  private handleUnknownContent(content: any): string {
    try {
      const jsonStr = JSON.stringify(content);
      logger.debug('未知消息内容格式', { 
        contentType: typeof content,
        content: jsonStr.substring(0, 200) // 只记录前200字符
      });
      return this.fallbackContent;
    } catch (error) {
      logger.warn('内容序列化失败', { error: error instanceof Error ? error.message : String(error) });
      return this.fallbackContent;
    }
  }

  /**
   * 构建CodeWhisperer请求 - 重构优化版本
   */
  public async buildCodeWhispererRequest(anthropicReq: AnthropicRequest, profileArn: string, authMethod?: string): Promise<CodeWhispererRequest> {
    const debugInfo = this.createDebugInfo(anthropicReq);
    logger.debug('开始构建CodeWhisperer请求', debugInfo);

    // 获取最后一条消息内容
    const lastMessage = anthropicReq.messages[anthropicReq.messages.length - 1];
    const messageContent = this.extractMessageContent(lastMessage.content);

    // 构建基础请求结构
    const cwReq: CodeWhispererRequest = {
      conversationState: {
        chatTriggerType: this.config.chatTriggerType,
        conversationId: uuidv4(),
        currentMessage: {
          userInputMessage: {
            content: messageContent,
            modelId: anthropicReq.model, // 路由引擎已完成模型映射
            origin: this.config.origin,
            userInputMessageContext: {
              // 🔑 关键：demo2兼容性 - 必须为空对象
            },
          },
        },
        history: [],
      },
      // ✅ 修复：初始化时设置空字符串，后面根据authMethod条件更新
      profileArn: '',
    };

    // 🔧 关键修复：CodeWhisperer支持工具调用，正确转换工具定义
    // 完全按照demo3的逻辑：toolsContext包装 + 条件检查
    let toolsContext: { tools?: CodeWhispererTool[] } = {};
    if (anthropicReq.tools && Array.isArray(anthropicReq.tools) && anthropicReq.tools.length > 0) {
      const convertedTools = this.convertTools(anthropicReq.tools);
      toolsContext = {
        tools: convertedTools
      };
    }
    
    // 🚨 关键修复：按照demo3的条件检查逻辑设置工具字段
    const contextData = {
      tools: Object.keys(toolsContext).length > 0 ? toolsContext.tools : null,
      toolResults: null  // demo3要求始终存在
    };
    
    // 直接设置整个userInputMessageContext，避免类型问题
    (cwReq.conversationState.currentMessage.userInputMessage as any).userInputMessageContext = contextData;
    
    logger.debug('工具字段设置完成 (demo3精确兼容)', {
      hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      toolsContextKeys: Object.keys(toolsContext),
      toolsFieldValue: contextData.tools,
      toolResultsFieldValue: contextData.toolResults,
      strategy: 'demo3-exact-match'
    });

    // 构建历史消息 - 优化版本
    const hasHistory = this.shouldBuildHistory(anthropicReq);
    if (hasHistory) {
      (cwReq.conversationState as any).history = this.buildMessageHistory(anthropicReq);
    }

    // 🚨 关键修复：按照demo3的逻辑，只有当authMethod为'social'时才添加profileArn
    // 这是导致400错误的根本原因！
    if (authMethod === 'social') {
      (cwReq as any).profileArn = profileArn;
      logger.debug('添加profileArn到请求根级别 (authMethod=social)', { 
        authMethod,
        profileArn: profileArn ? profileArn.substring(0, 50) + '...' : 'undefined',
        strategy: 'demo3-conditional-logic'
      });
    } else {
      // ✅ 修复：明确设置profileArn为undefined，与demo3逻辑完全一致
      (cwReq as any).profileArn = undefined;
      logger.debug('设置profileArn为undefined (authMethod!=social)', { 
        authMethod,
        strategy: 'demo3-exact-match'
      });
    }

    const buildResult = this.createBuildResult(cwReq);
    logger.debug('CodeWhisperer请求构建完成', buildResult);

    return cwReq;
  }

  /**
   * 转换工具定义到 CodeWhisperer 格式
   * 基于 demo3 的工具转换策略，添加默认值处理
   */
  private convertTools(anthropicTools: AnthropicTool[]): CodeWhispererTool[] {
    const cwTools: CodeWhispererTool[] = anthropicTools.map(tool => ({
      toolSpecification: {
        name: tool.name,
        description: tool.description || "",           // ✅ 修复：添加默认空字符串
        inputSchema: {
          json: tool.input_schema || {}              // ✅ 修复：添加默认空对象
        }
      }
    }));

    logger.debug('工具转换完成', {
      inputToolCount: anthropicTools.length,
      outputToolCount: cwTools.length,
      toolNames: cwTools.map(t => t.toolSpecification.name)
    });

    return cwTools;
  }

  /**
   * 创建调试信息
   */
  private createDebugInfo(anthropicReq: AnthropicRequest) {
    return {
      model: anthropicReq.model,
      messageCount: anthropicReq.messages.length,
      hasTools: !!(anthropicReq.tools && anthropicReq.tools.length > 0),
      hasSystem: !!(anthropicReq.system && anthropicReq.system.length > 0),
    };
  }

  /**
   * 判断是否需要构建历史消息
   */
  private shouldBuildHistory(anthropicReq: AnthropicRequest): boolean {
    return (anthropicReq.system && anthropicReq.system.length > 0) || anthropicReq.messages.length > 1;
  }

  /**
   * 构建消息历史
   */
  private buildMessageHistory(anthropicReq: AnthropicRequest): (HistoryUserMessage | HistoryAssistantMessage)[] {
    const history: (HistoryUserMessage | HistoryAssistantMessage)[] = [];

    // 处理系统消息
    this.processSystemMessages(anthropicReq, history);

    // 处理常规消息历史
    this.processRegularMessages(anthropicReq, history);

    logger.debug('已构建历史消息', {
      historyLength: history.length,
      systemMessageCount: anthropicReq.system?.length || 0,
      regularMessageCount: anthropicReq.messages.length - 1,
    });

    return history;
  }

  /**
   * 处理系统消息
   */
  private processSystemMessages(anthropicReq: AnthropicRequest, history: (HistoryUserMessage | HistoryAssistantMessage)[]): void {
    if (!anthropicReq.system || anthropicReq.system.length === 0) return;

    const defaultAssistantMsg: HistoryAssistantMessage = {
      assistantResponseMessage: {
        content: 'I will follow these instructions',
        toolUses: [],
      },
    };

    for (const sysMsg of anthropicReq.system) {
      const userMsg: HistoryUserMessage = {
        userInputMessage: {
          content: sysMsg.text,
          modelId: anthropicReq.model,
          origin: this.config.origin,
        },
      };
      history.push(userMsg, defaultAssistantMsg);
    }
  }

  /**
   * 处理常规消息历史
   */
  private processRegularMessages(anthropicReq: AnthropicRequest, history: (HistoryUserMessage | HistoryAssistantMessage)[]): void {
    for (let i = 0; i < anthropicReq.messages.length - 1; i++) {
      const message = anthropicReq.messages[i];
      
      if (message.role === 'user') {
        const userMsg: HistoryUserMessage = {
          userInputMessage: {
            content: this.extractMessageContent(message.content),
            modelId: anthropicReq.model,
            origin: this.config.origin,
          },
        };
        history.push(userMsg);

        // 检查是否有对应的助手回复
        const nextMessage = anthropicReq.messages[i + 1];
        if (i + 1 < anthropicReq.messages.length - 1 && nextMessage?.role === 'assistant') {
          const assistantMsg: HistoryAssistantMessage = {
            assistantResponseMessage: {
              content: this.extractMessageContent(nextMessage.content),
              toolUses: [],
            },
          };
          history.push(assistantMsg);
          i++; // 跳过已处理的助手消息
        }
      }
    }
  }

  /**
   * 创建构建结果信息
   */
  private createBuildResult(cwReq: CodeWhispererRequest) {
    return {
      conversationId: cwReq.conversationState.conversationId,
      contentLength: cwReq.conversationState.currentMessage.userInputMessage.content.length,
      historyLength: cwReq.conversationState.history.length,
      modelId: cwReq.conversationState.currentMessage.userInputMessage.modelId,
      profileArn: cwReq.profileArn.substring(0, 50) + '...', // 只显示前50字符
    };
  }

  /**
   * 验证请求格式 - 重构优化版本
   */
  public validateRequest(cwReq: CodeWhispererRequest): RequestValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 分层验证
      this.validateBasicFields(cwReq, errors);
      this.validateConversationState(cwReq, errors);
      this.validateUserInputMessage(cwReq, errors, warnings);

      const isValid = errors.length === 0;
      
      if (isValid) {
        logger.debug('请求格式验证通过', {
          conversationId: cwReq.conversationState.conversationId,
          modelId: cwReq.conversationState.currentMessage.userInputMessage.modelId,
          contentLength: cwReq.conversationState.currentMessage.userInputMessage.content.length,
          warningCount: warnings.length
        });
      } else {
        logger.error('请求格式验证失败', { errors, warnings });
      }

      return { isValid, errors, warnings };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('验证过程异常', { error: errorMessage });
      return {
        isValid: false,
        errors: [`验证过程异常: ${errorMessage}`],
        warnings
      };
    }
  }

  /**
   * 验证基本字段
   */
  private validateBasicFields(cwReq: CodeWhispererRequest, errors: string[]): void {
    if (!cwReq.profileArn) {
      errors.push('缺少profileArn');
    }
    if (!cwReq.conversationState) {
      errors.push('缺少conversationState');
    }
  }

  /**
   * 验证对话状态
   */
  private validateConversationState(cwReq: CodeWhispererRequest, errors: string[]): void {
    if (!cwReq.conversationState) return;

    const state = cwReq.conversationState;
    if (!state.conversationId) {
      errors.push('缺少conversationId');
    }
    if (!state.currentMessage) {
      errors.push('缺少currentMessage');
    }
    if (!state.chatTriggerType) {
      errors.push('缺少chatTriggerType');
    }
  }

  /**
   * 验证用户输入消息
   */
  private validateUserInputMessage(cwReq: CodeWhispererRequest, errors: string[], warnings: string[]): void {
    const userInput = cwReq.conversationState?.currentMessage?.userInputMessage;
    if (!userInput) {
      errors.push('缺少userInputMessage');
      return;
    }

    if (!userInput.content) {
      errors.push('缺少userInputMessage.content');
    } else if (userInput.content.length > 50000) {
      warnings.push('消息内容过长，可能影响性能');
    }

    if (!userInput.modelId) {
      errors.push('缺少userInputMessage.modelId');
    }

    if (!userInput.origin) {
      errors.push('缺少userInputMessage.origin');
    }

    if (!userInput.userInputMessageContext) {
      errors.push('缺少userInputMessageContext');
    }
  }

  /**
   * 简化的验证方法（向后兼容）
   */
  public validateRequestLegacy(cwReq: CodeWhispererRequest): boolean {
    const result = this.validateRequest(cwReq);
    return result.isValid;
  }
}