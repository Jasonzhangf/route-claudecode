/**
 * Max Tokens错误处理模块 - 集中处理token限制问题
 * Project Owner: Jason Zhang
 * 
 * 当收到max_tokens/length stop_reason时的智能处理方案
 * Option 1: 滚动截断处理机制 (当前实现)
 * Option 2: LongContext模型压缩 (预留接口)
 */

import { logger } from './logger';
import { BaseRequest } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

export interface MaxTokensHandlingConfig {
  strategy: 'rolling_truncation' | 'longcontext_compression';
  rollingTruncation: {
    historyRetentionPercent: number; // 保留历史记录的百分比 (默认80%)
    useSimplifiedPrompt: boolean; // 是否使用简化版系统提示词
    simplifiedPromptPath: string; // 简化提示词配置文件路径
  };
  longcontextCompression?: {
    enabled: boolean;
    recentHistoryPercent: number; // 保留为原文的最新历史百分比 (默认20%)
    compressionModel: string; // 用于压缩的长上下文模型
    compressionEndpoint: string; // 压缩服务端点
  };
}

export interface TruncationResult {
  success: boolean;
  originalTokens: number;
  reducedTokens: number;
  truncatedRequest: BaseRequest;
  strategy: string;
  details: {
    systemPromptReduced: boolean;
    historyMessagesRemoved: number;
    totalMessagesRemaining: number;
  };
}

export class MaxTokensErrorHandlingModule {
  private config!: MaxTokensHandlingConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'max-tokens-handling.json');
    this.loadConfiguration();
  }

  /**
   * 加载配置文件
   */
  private loadConfiguration(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
        logger.debug('Max tokens handling configuration loaded', {
          configPath: this.configPath,
          strategy: this.config.strategy
        });
      } else {
        // 创建默认配置
        this.config = this.getDefaultConfig();
        this.saveConfiguration();
        logger.info('Created default max tokens handling configuration', {
          configPath: this.configPath
        });
      }
    } catch (error) {
      logger.error('Failed to load max tokens handling configuration', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): MaxTokensHandlingConfig {
    return {
      strategy: 'rolling_truncation',
      rollingTruncation: {
        historyRetentionPercent: 80,
        useSimplifiedPrompt: true,
        simplifiedPromptPath: path.join(process.cwd(), 'config', 'simplified-system-prompt.json')
      },
      longcontextCompression: {
        enabled: false,
        recentHistoryPercent: 20,
        compressionModel: 'claude-3-haiku', // 用于压缩的高效模型
        compressionEndpoint: '/v1/chat/completions'
      }
    };
  }

  /**
   * 保存配置文件
   */
  private saveConfiguration(): void {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      logger.debug('Max tokens handling configuration saved', {
        configPath: this.configPath
      });
    } catch (error) {
      logger.error('Failed to save max tokens handling configuration', error);
    }
  }

  /**
   * 处理max tokens错误 - 主入口
   */
  async handleMaxTokensError(
    originalRequest: BaseRequest,
    errorDetails: any,
    requestId: string
  ): Promise<TruncationResult> {
    logger.info('🔧 [MAX-TOKENS] Starting max tokens error handling', {
      strategy: this.config.strategy,
      originalModel: originalRequest.model,
      requestId
    });

    try {
      switch (this.config.strategy) {
        case 'rolling_truncation':
          return await this.handleRollingTruncation(originalRequest, requestId);
          
        case 'longcontext_compression':
          if (this.config.longcontextCompression?.enabled) {
            return await this.handleLongcontextCompression(originalRequest, requestId);
          } else {
            // 降级到滚动截断
            logger.warn('LongContext compression disabled, falling back to rolling truncation');
            return await this.handleRollingTruncation(originalRequest, requestId);
          }
          
        default:
          throw new Error(`Unknown max tokens handling strategy: ${this.config.strategy}`);
      }
    } catch (error) {
      logger.error('Max tokens error handling failed', error, requestId, 'max-tokens-handler');
      throw error;
    }
  }

  /**
   * Option 1: 滚动截断处理
   */
  private async handleRollingTruncation(
    originalRequest: BaseRequest,
    requestId: string
  ): Promise<TruncationResult> {
    const config = this.config.rollingTruncation;
    let truncatedRequest = JSON.parse(JSON.stringify(originalRequest)); // 深拷贝
    
    const originalTokens = this.estimateTokens(originalRequest);
    let systemPromptReduced = false;
    let historyMessagesRemoved = 0;

    logger.debug('🔧 [ROLLING-TRUNCATION] Starting truncation process', {
      originalTokens,
      historyRetentionPercent: config.historyRetentionPercent,
      useSimplifiedPrompt: config.useSimplifiedPrompt,
      requestId
    });

    // 1. 简化系统提示词 (如果启用)
    if (config.useSimplifiedPrompt) {
      const simplifiedSystemPrompt = await this.getSimplifiedSystemPrompt();
      if (simplifiedSystemPrompt && truncatedRequest.metadata?.system) {
        const originalSystemLength = JSON.stringify(truncatedRequest.metadata.system).length;
        truncatedRequest.metadata.system = simplifiedSystemPrompt;
        const newSystemLength = JSON.stringify(simplifiedSystemPrompt).length;
        
        systemPromptReduced = newSystemLength < originalSystemLength;
        logger.info('🔧 [ROLLING-TRUNCATION] System prompt simplified', {
          originalLength: originalSystemLength,
          newLength: newSystemLength,
          reductionPercent: Math.round((1 - newSystemLength / originalSystemLength) * 100),
          requestId
        });
      }
    }

    // 2. 历史记录截断
    if (truncatedRequest.messages && truncatedRequest.messages.length > 1) {
      const totalMessages = truncatedRequest.messages.length;
      const messagesToKeep = Math.max(1, Math.ceil(totalMessages * (config.historyRetentionPercent / 100)));
      
      // 保留最新的消息（通常最后一个是用户的当前请求）
      const messagesToRemove = totalMessages - messagesToKeep;
      if (messagesToRemove > 0) {
        // 从最旧的消息开始移除，但保留第一条（通常是系统消息或重要上下文）
        const startIndex = Math.max(1, Math.min(messagesToRemove, totalMessages - messagesToKeep));
        truncatedRequest.messages = [
          ...truncatedRequest.messages.slice(0, 1), // 保留第一条消息
          ...truncatedRequest.messages.slice(startIndex + messagesToRemove) // 保留最新的消息
        ];
        
        historyMessagesRemoved = messagesToRemove;
        logger.info('🔧 [ROLLING-TRUNCATION] History messages truncated', {
          originalMessages: totalMessages,
          messagesRemoved: historyMessagesRemoved,
          remainingMessages: truncatedRequest.messages.length,
          requestId
        });
      }
    }

    const reducedTokens = this.estimateTokens(truncatedRequest);
    const reductionPercent = Math.round((1 - reducedTokens / originalTokens) * 100);

    logger.info('🔧 [ROLLING-TRUNCATION] Truncation completed', {
      originalTokens,
      reducedTokens,
      reductionPercent,
      systemPromptReduced,
      historyMessagesRemoved,
      requestId
    });

    return {
      success: true,
      originalTokens,
      reducedTokens,
      truncatedRequest,
      strategy: 'rolling_truncation',
      details: {
        systemPromptReduced,
        historyMessagesRemoved,
        totalMessagesRemaining: truncatedRequest.messages?.length || 0
      }
    };
  }

  /**
   * Option 2: LongContext模型压缩 (预留实现)
   */
  private async handleLongcontextCompression(
    originalRequest: BaseRequest,
    requestId: string
  ): Promise<TruncationResult> {
    // TODO: 实现LongContext模型压缩逻辑
    logger.warn('🔧 [LONGCONTEXT-COMPRESSION] Not implemented yet, falling back to rolling truncation');
    return await this.handleRollingTruncation(originalRequest, requestId);
  }

  /**
   * 获取简化版系统提示词
   */
  private async getSimplifiedSystemPrompt(): Promise<any | null> {
    const config = this.config.rollingTruncation;
    
    try {
      if (fs.existsSync(config.simplifiedPromptPath)) {
        const promptData = fs.readFileSync(config.simplifiedPromptPath, 'utf8');
        return JSON.parse(promptData);
      } else {
        // 创建默认简化提示词文件
        const defaultPrompt = this.createDefaultSimplifiedPrompt();
        await this.saveSimplifiedPrompt(defaultPrompt);
        return defaultPrompt;
      }
    } catch (error) {
      logger.error('Failed to load simplified system prompt', error);
      return null;
    }
  }

  /**
   * 创建默认简化系统提示词
   */
  private createDefaultSimplifiedPrompt(): any {
    return {
      type: "text",
      text: "You are Claude, an AI assistant. Be helpful, harmless, and honest. Use available tools when needed."
    };
  }

  /**
   * 保存简化版系统提示词
   */
  private async saveSimplifiedPrompt(prompt: any): Promise<void> {
    const config = this.config.rollingTruncation;
    
    try {
      const promptDir = path.dirname(config.simplifiedPromptPath);
      if (!fs.existsSync(promptDir)) {
        fs.mkdirSync(promptDir, { recursive: true });
      }

      fs.writeFileSync(config.simplifiedPromptPath, JSON.stringify(prompt, null, 2), 'utf8');
      logger.info('Default simplified system prompt created', {
        path: config.simplifiedPromptPath
      });
    } catch (error) {
      logger.error('Failed to save simplified system prompt', error);
    }
  }

  /**
   * 估算请求的token数量
   */
  private estimateTokens(request: BaseRequest): number {
    let totalChars = 0;

    // 计算消息内容
    if (request.messages) {
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((block: any) => {
            if (block.text) totalChars += block.text.length;
            if (block.content) totalChars += JSON.stringify(block.content).length;
          });
        }
      });
    }

    // 计算系统提示词
    if (request.metadata?.system) {
      totalChars += JSON.stringify(request.metadata.system).length;
    }

    // 计算工具定义
    if (request.metadata?.tools) {
      totalChars += JSON.stringify(request.metadata.tools).length;
    }

    // 估算：~4个字符等于1个token
    return Math.ceil(totalChars / 4);
  }

  /**
   * 获取当前配置
   */
  getConfig(): MaxTokensHandlingConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<MaxTokensHandlingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfiguration();
    logger.info('Max tokens handling configuration updated', {
      strategy: this.config.strategy
    });
  }
}

export default MaxTokensErrorHandlingModule;