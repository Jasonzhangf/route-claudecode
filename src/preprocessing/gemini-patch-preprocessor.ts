/**
 * Gemini预处理器
 * 处理Gemini API的兼容性预处理
 * Project owner: Jason Zhang
 */

import { BaseRequest } from '../types';
import { logger } from '../utils/logger';
import { createPatchManager } from '../patches/registry';

export interface GeminiPreprocessorOptions {
  enableModelNormalization?: boolean;
  enableSystemMessageHandling?: boolean;
  enableParameterValidation?: boolean;
}

/**
 * Gemini兼容性预处理器
 * 处理Gemini特有的格式兼容性问题
 */
export class GeminiPatchPreprocessor {
  private patchManager = createPatchManager();
  
  constructor(private options: GeminiPreprocessorOptions = {}) {
    // 默认启用所有预处理功能
    this.options = {
      enableModelNormalization: true,
      enableSystemMessageHandling: true,
      enableParameterValidation: true,
      ...options
    };
  }

  /**
   * 预处理Gemini请求
   */
  async preprocessRequest(request: BaseRequest): Promise<BaseRequest> {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Preprocessing request for Gemini', {
      originalModel: request.model,
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools
    }, requestId, 'gemini-preprocessor');

    let processedRequest = { ...request };

    // 1. 模型名称标准化
    if (this.options.enableModelNormalization) {
      processedRequest = this.normalizeModelName(processedRequest, requestId);
    }

    // 2. 处理系统消息
    if (this.options.enableSystemMessageHandling) {
      processedRequest = this.handleSystemMessages(processedRequest, requestId);
    }

    // 3. 参数验证和清理
    if (this.options.enableParameterValidation) {
      processedRequest = this.validateAndCleanParameters(processedRequest, requestId);
    }

    // 4. 应用补丁系统
    processedRequest = await this.applyPatches(processedRequest, requestId);

    logger.debug('Gemini preprocessing completed', {
      originalModel: request.model,
      processedModel: processedRequest.model,
      messageCount: processedRequest.messages?.length || 0
    }, requestId, 'gemini-preprocessor');

    return processedRequest;
  }

  /**
   * 标准化模型名称
   */
  private normalizeModelName(request: BaseRequest, requestId: string): BaseRequest {
    let modelName = request.model;
    
    // 移除常见的前缀
    const prefixesToRemove = ['google/', 'gemini/', 'google-'];
    for (const prefix of prefixesToRemove) {
      if (modelName.startsWith(prefix)) {
        modelName = modelName.substring(prefix.length);
        break;
      }
    }

    // 标准化版本号格式
    const versionMappings: Record<string, string> = {
      'gemini-pro-latest': 'gemini-2.5-pro',
      'gemini-flash-latest': 'gemini-2.5-flash',
      'gemini-pro': 'gemini-2.5-pro',
      'gemini-flash': 'gemini-2.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash'
    };

    if (versionMappings[modelName]) {
      modelName = versionMappings[modelName];
      logger.debug('Normalized Gemini model name', {
        original: request.model,
        normalized: modelName
      }, requestId, 'gemini-preprocessor');
    }

    return {
      ...request,
      model: modelName
    };
  }

  /**
   * 处理系统消息
   * Gemini API不直接支持system角色，需要转换为用户消息
   */
  private handleSystemMessages(request: BaseRequest, requestId: string): BaseRequest {
    if (!request.messages || request.messages.length === 0) {
      return request;
    }

    const processedMessages = [...request.messages];
    let hasSystemMessage = false;

    // 查找系统消息
    for (let i = 0; i < processedMessages.length; i++) {
      const message = processedMessages[i];
      if (message.role === 'system') {
        hasSystemMessage = true;
        
        // 将系统消息转换为用户消息（添加前缀标识）
        processedMessages[i] = {
          ...message,
          role: 'user',
          content: typeof message.content === 'string' 
            ? `[System Instructions] ${message.content}`
            : message.content // 数组格式保持不变
        };
        
        logger.debug('Converted system message to user message', {
          messageIndex: i,
          originalRole: 'system',
          convertedRole: 'user'
        }, requestId, 'gemini-preprocessor');
      }
    }

    if (hasSystemMessage) {
      return {
        ...request,
        messages: processedMessages
      };
    }

    return request;
  }

  /**
   * 验证和清理参数
   */
  private validateAndCleanParameters(request: BaseRequest, requestId: string): BaseRequest {
    const processedRequest = { ...request };

    // 验证max_tokens范围
    if (processedRequest.max_tokens) {
      if (processedRequest.max_tokens > 8192) {
        logger.warn('Gemini max_tokens exceeds limit, capping at 8192', {
          originalMaxTokens: processedRequest.max_tokens,
          cappedMaxTokens: 8192
        }, requestId, 'gemini-preprocessor');
        processedRequest.max_tokens = 8192;
      }
    }

    // 验证temperature范围
    if (processedRequest.temperature !== undefined) {
      if (processedRequest.temperature < 0 || processedRequest.temperature > 2) {
        const cappedTemp = Math.max(0, Math.min(2, processedRequest.temperature));
        logger.warn('Gemini temperature out of range, adjusting', {
          originalTemperature: processedRequest.temperature,
          adjustedTemperature: cappedTemp
        }, requestId, 'gemini-preprocessor');
        processedRequest.temperature = cappedTemp;
      }
    }

    // 清理工具定义中的不支持字段
    if (processedRequest.tools && Array.isArray(processedRequest.tools)) {
      processedRequest.tools = processedRequest.tools.map(tool => {
        if (tool.function && tool.function.parameters) {
          // 移除Gemini不支持的JSON Schema字段
          const cleanedParameters = this.cleanJsonSchema(tool.function.parameters);
          return {
            ...tool,
            function: {
              ...tool.function,
              parameters: cleanedParameters
            }
          };
        }
        return tool;
      });
    }

    return processedRequest;
  }

  /**
   * 清理JSON Schema以兼容Gemini
   */
  private cleanJsonSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const cleaned = { ...schema };

    // 移除Gemini不支持的字段
    const unsupportedFields = [
      'additionalProperties',
      'minLength',
      'maxLength',
      'pattern',
      'format',
      'const',
      'enum',
      'anyOf',
      'oneOf',
      'allOf',
      'not'
    ];

    unsupportedFields.forEach(field => {
      if (field in cleaned) {
        delete cleaned[field];
      }
    });

    // 递归清理嵌套对象
    if (cleaned.properties && typeof cleaned.properties === 'object') {
      for (const key in cleaned.properties) {
        cleaned.properties[key] = this.cleanJsonSchema(cleaned.properties[key]);
      }
    }

    if (cleaned.items && typeof cleaned.items === 'object') {
      cleaned.items = this.cleanJsonSchema(cleaned.items);
    }

    return cleaned;
  }

  /**
   * 应用补丁系统
   */
  private async applyPatches(request: BaseRequest, requestId: string): Promise<BaseRequest> {
    try {
      // 应用Gemini特定的补丁
      const mockProvider = { name: 'gemini', type: 'gemini' } as any;
      const patched = await this.patchManager.applyRequestPatches(request, mockProvider, request.model);

      if (patched !== request) {
        logger.debug('Applied Gemini request patches', {
          model: request.model,
          hasChanges: true
        }, requestId, 'gemini-preprocessor');
      }

      return patched;
    } catch (error) {
      logger.warn('Failed to apply Gemini request patches', {
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'gemini-preprocessor');
      
      // 如果补丁应用失败，返回原始请求
      return request;
    }
  }

  /**
   * 获取预处理统计信息
   */
  getStats() {
    return {
      name: 'GeminiPatchPreprocessor',
      options: this.options,
      patchManager: this.patchManager.getStats?.() || null
    };
  }
}

/**
 * 便捷函数：创建Gemini预处理器
 */
export function createGeminiPreprocessor(options?: GeminiPreprocessorOptions): GeminiPatchPreprocessor {
  return new GeminiPatchPreprocessor(options);
}

/**
 * 便捷函数：预处理Gemini请求
 */
export async function preprocessGeminiRequest(
  request: BaseRequest, 
  options?: GeminiPreprocessorOptions
): Promise<BaseRequest> {
  const preprocessor = createGeminiPreprocessor(options);
  return await preprocessor.preprocessRequest(request);
}