/**
 * CodeWhisperer Preprocessor - 兼容性处理
 * 处理CodeWhisperer特定的兼容性问题和修复
 * 项目所有者: Jason Zhang
 */

import { BaseRequest } from '@/types';
import { logger } from '@/utils/logger';

export class CodeWhispererPreprocessor {
  public readonly name = 'codewhisperer';

  /**
   * 应用兼容性修复
   */
  applyCompatibilityFixes(request: BaseRequest): BaseRequest {
    let processedRequest = { ...request };

    // 应用ProfileArn修复
    processedRequest = this.applyProfileArnFix(processedRequest);

    // 应用模型名标准化
    processedRequest = this.standardizeModelName(processedRequest);

    // 应用消息格式修复
    processedRequest = this.fixMessageFormat(processedRequest);

    logger.debug('CodeWhisperer compatibility fixes applied', {
      requestId: request.metadata?.requestId,
      model: processedRequest.model,
      hasProfileArn: !!(processedRequest.metadata as any)?.profileArn
    });

    return processedRequest;
  }

  /**
   * 修复ProfileArn问题
   * 🎯 关键修复：防止profileArn为undefined时调用substring导致错误
   */
  private applyProfileArnFix(request: BaseRequest): BaseRequest {
    const metadata = request.metadata as any;
    
    if (metadata && typeof metadata.profileArn !== 'undefined') {
      // 🚨 零Fallback原则：不使用默认值，而是明确处理
      if (metadata.profileArn === null || metadata.profileArn === undefined || metadata.profileArn === '') {
        // 明确标记为非社交认证模式
        metadata.profileArnStatus = 'N/A (authMethod!=social)';
        logger.debug('ProfileArn processed for non-social auth', {
          originalValue: metadata.profileArn,
          processedStatus: metadata.profileArnStatus
        });
      } else if (typeof metadata.profileArn === 'string') {
        // 安全截取profileArn
        metadata.profileArnStatus = metadata.profileArn.length > 50 
          ? metadata.profileArn.substring(0, 50) + '...'
          : metadata.profileArn;
        logger.debug('ProfileArn safely truncated', {
          originalLength: metadata.profileArn.length,
          truncated: metadata.profileArn.length > 50
        });
      }
    }

    return request;
  }

  /**
   * 标准化模型名
   */
  private standardizeModelName(request: BaseRequest): BaseRequest {
    const modelMapping: Record<string, string> = {
      'claude-sonnet-4': 'CLAUDE_SONNET_4_20250514_V1_0',
      'claude-3-7-sonnet': 'CLAUDE_3_7_SONNET',
      'claude-3-5-sonnet': 'CLAUDE_3_5_SONNET'
    };

    if (modelMapping[request.model]) {
      const originalModel = request.model;
      request.model = modelMapping[request.model];
      
      // 保存原始模型名用于响应映射
      if (!request.metadata) {
        request.metadata = {
          requestId: `cw_${Date.now()}`
        };
      }
      request.metadata.originalModel = originalModel;

      logger.debug('Model name standardized for CodeWhisperer', {
        original: originalModel,
        standardized: request.model
      });
    }

    return request;
  }

  /**
   * 修复消息格式
   */
  private fixMessageFormat(request: BaseRequest): BaseRequest {
    if (!request.messages || !Array.isArray(request.messages)) {
      return request;
    }

    // 确保消息格式符合CodeWhisperer要求
    request.messages = request.messages.map(message => {
      const fixedMessage = { ...message };

      // 处理内容格式
      if (typeof fixedMessage.content === 'string') {
        // 字符串内容保持不变
        return fixedMessage;
      }

      if (Array.isArray(fixedMessage.content)) {
        // 数组内容进行格式检查
        fixedMessage.content = fixedMessage.content.map(block => {
          if (block.type === 'text' && typeof block.text === 'string') {
            return block;
          }
          if (block.type === 'tool_use' && block.id && block.name) {
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input || {}
            };
          }
          return block;
        });
      }

      return fixedMessage;
    });

    return request;
  }

  /**
   * 验证请求完整性
   * 🚨 零静默失败：确保所有必要字段存在
   */
  validateRequest(request: BaseRequest): void {
    // 验证基本字段
    if (!request.model) {
      throw new Error('CodeWhisperer request missing required field: model');
    }

    if (!request.messages || !Array.isArray(request.messages)) {
      throw new Error('CodeWhisperer request missing required field: messages');
    }

    if (request.messages.length === 0) {
      throw new Error('CodeWhisperer request messages array is empty');
    }

    // 验证消息格式
    for (const [index, message] of request.messages.entries()) {
      if (!message.role) {
        throw new Error(`CodeWhisperer request message[${index}] missing role`);
      }

      if (!message.content) {
        throw new Error(`CodeWhisperer request message[${index}] missing content`);
      }

      // 验证角色值
      const validRoles = ['user', 'assistant', 'system'];
      if (!validRoles.includes(message.role)) {
        throw new Error(`CodeWhisperer request message[${index}] has invalid role: ${message.role}`);
      }
    }

    // 验证工具格式（如果存在）
    if (request.tools && Array.isArray(request.tools)) {
      for (const [index, tool] of request.tools.entries()) {
        if (!tool.name) {
          throw new Error(`CodeWhisperer request tool[${index}] missing name`);
        }
        if (!tool.description) {
          throw new Error(`CodeWhisperer request tool[${index}] missing description`);
        }
        if (!tool.input_schema) {
          throw new Error(`CodeWhisperer request tool[${index}] missing input_schema`);
        }
      }
    }

    logger.debug('CodeWhisperer request validation passed', {
      model: request.model,
      messageCount: request.messages.length,
      hasTools: !!(request.tools && request.tools.length > 0)
    });
  }

  /**
   * 处理认证相关的预处理
   */
  processAuthentication(request: BaseRequest, authConfig: any): BaseRequest {
    if (!request.metadata) {
      request.metadata = {
        requestId: `cw_auth_${Date.now()}`
      };
    }

    // 处理profileArn相关逻辑
    if (authConfig.profileArn) {
      (request.metadata as any).profileArn = authConfig.profileArn;
    }

    // 处理认证方法
    if (authConfig.authMethod) {
      (request.metadata as any).authMethod = authConfig.authMethod;
    }

    return request;
  }
}

/**
 * 创建CodeWhisperer预处理器实例
 */
export function createCodeWhispererPreprocessor(): CodeWhispererPreprocessor {
  return new CodeWhispererPreprocessor();
}