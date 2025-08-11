/**
 * ModelScope API 格式修复补丁
 * 修复ModelScope API的特殊参数要求
 */

import { BasePatch, PatchContext, PatchResult, PatchCondition } from '../types';

export class ModelScopeFormatFixPatch implements BasePatch {
  name = 'modelscope-format-fix';
  description = 'Fix ModelScope API specific parameter requirements';
  type = 'request' as const;
  priority = 15;
  
  condition: PatchCondition = {
    provider: 'openai',
    model: (model: string) => {
      // 匹配ModelScope服务的模型
      return model.includes('Qwen') || 
             model.includes('ZhipuAI') ||
             model.includes('GLM');
    },
    enabled: () => process.env.RCC_PATCHES_MODELSCOPE_FORMAT_FIX !== 'false'
  };

  /**
   * 检查是否应该应用此补丁
   */
  shouldApply(context: PatchContext, data: any): boolean {
    // 检查是否是OpenAI provider且有ModelScope相关模型
    if (context.provider !== 'openai') {
      return false;
    }

    // 检查是否有消息数据
    return data && (data.messages || data.prompt);
  }

  /**
   * 应用补丁
   */
  async apply(context: PatchContext, data: any): Promise<PatchResult> {
    const startTime = Date.now();
    
    try {
      const patchedData = await this.patchRequest(data, context);
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: patchedData,
        applied: true,
        patchName: this.name,
        duration,
        metadata: { 
          originalData: data,
          provider: context.provider
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        data: data,
        applied: false,
        patchName: this.name,
        duration,
        metadata: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }

  /**
   * 修复请求格式 - 确保ModelScope API要求的参数格式
   */
  async patchRequest(request: any, context: any): Promise<any> {
    if (!request) {
      return request;
    }

    const patchedRequest = { ...request };
    
    // 🎯 ModelScope API可能需要特定的prompt处理
    if (patchedRequest.messages && Array.isArray(patchedRequest.messages)) {
      
      // 确保消息格式正确
      patchedRequest.messages = patchedRequest.messages.map((msg: any) => ({
        role: msg.role,
        content: this.ensureStringContent(msg.content)
      }));

      // 🔧 一些ModelScope服务可能需要prompt参数而不是messages
      // 如果API要求prompt格式，我们也提供一个
      const promptText = this.buildPromptFromMessages(patchedRequest.messages);
      if (promptText) {
        patchedRequest.prompt = promptText;
      }
    }

    // 确保必要的参数存在
    if (!patchedRequest.max_tokens) {
      patchedRequest.max_tokens = 4096;
    }

    if (typeof patchedRequest.temperature === 'undefined') {
      patchedRequest.temperature = 0.7;
    }

    // 🎯 确保stream参数正确设置
    if (typeof patchedRequest.stream === 'undefined') {
      patchedRequest.stream = true; // 默认使用流式
    }

    this.logPatchApplied('request', {
      messageCount: patchedRequest.messages?.length || 0,
      hasPrompt: !!patchedRequest.prompt,
      model: patchedRequest.model,
      stream: patchedRequest.stream
    });

    return patchedRequest;
  }

  /**
   * 确保内容是字符串格式
   */
  private ensureStringContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
        return '';
      }).filter(text => text.trim()).join('\n');
    }

    if (typeof content === 'object' && content !== null) {
      if (content.text) {
        return content.text;
      }
      return JSON.stringify(content);
    }

    return String(content);
  }

  /**
   * 从messages构建prompt字符串（作为备用）
   */
  private buildPromptFromMessages(messages: any[]): string {
    if (!Array.isArray(messages) || messages.length === 0) {
      return '';
    }

    return messages.map(msg => {
      const role = msg.role;
      const content = msg.content;
      
      switch (role) {
        case 'system':
          return `System: ${content}`;
        case 'user':
          return `User: ${content}`;
        case 'assistant':
          return `Assistant: ${content}`;
        default:
          return `${role}: ${content}`;
      }
    }).join('\n\n');
  }

  /**
   * 记录补丁应用日志
   */
  private logPatchApplied(type: string, details: any): void {
    console.log(`[ModelScope Format Fix] Applied to ${type}:`, details);
  }
}