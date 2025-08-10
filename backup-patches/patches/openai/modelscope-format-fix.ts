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
      // 匹配ModelScope服务的模型（扩展模型识别）
      return model.includes('Qwen') || 
             model.includes('ZhipuAI') ||
             model.includes('GLM') ||
             model.includes('GLM-4.5') ||
             model.includes('glm-4.5') ||
             model.includes('Qwen3') ||
             model.includes('qwen3') ||
             model.includes('480B') ||
             model.includes('Coder');
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

    let patchedRequest = { ...request };
    
    // 🎯 ModelScope API可能需要特定的prompt处理
    if (patchedRequest.messages && Array.isArray(patchedRequest.messages)) {
      
      // 确保消息格式正确，特殊处理GLM-4.5和Qwen3-Coder
      patchedRequest.messages = patchedRequest.messages.map((msg: any) => ({
        role: msg.role,
        content: this.ensureStringContentForModelScope(msg.content, context.model)
      }));

      // 🔧 GLM-4.5和Qwen3-Coder特殊处理
      if (this.isGLMModel(context.model)) {
        patchedRequest = this.applyGLMSpecificPatches(patchedRequest, context);
      } else if (this.isQwen3CoderModel(context.model)) {
        patchedRequest = this.applyQwen3CoderSpecificPatches(patchedRequest, context);
      }

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
   * 确保内容是字符串格式（ModelScope专用）
   */
  private ensureStringContentForModelScope(content: any, model: string): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
        if (block.type === 'tool_use') {
          // GLM-4.5和Qwen3特殊工具调用格式转换
          return this.convertToolUseToModelScopeFormat(block, model);
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
   * 将工具调用转换为ModelScope格式
   */
  private convertToolUseToModelScopeFormat(toolBlock: any, model: string): string {
    if (this.isGLMModel(model)) {
      // GLM-4.5格式: Tool call: FunctionName({...})
      const functionName = toolBlock.name || 'unknown';
      const inputData = JSON.stringify(toolBlock.input || {});
      return `Tool call: ${functionName}(${inputData})`;
    } else if (this.isQwen3CoderModel(model)) {
      // Qwen3-Coder格式: 更倾向于结构化格式
      return JSON.stringify({
        type: 'tool_use',
        name: toolBlock.name,
        input: toolBlock.input
      });
    }
    
    // 默认格式
    return JSON.stringify(toolBlock);
  }

  /**
   * 检查是否为GLM模型
   */
  private isGLMModel(model: string): boolean {
    return Boolean(model && (
      model.toLowerCase().includes('glm') ||
      model.toLowerCase().includes('zhipuai')
    ));
  }

  /**
   * 检查是否为Qwen3-Coder模型
   */
  private isQwen3CoderModel(model: string): boolean {
    return Boolean(model && (
      model.toLowerCase().includes('qwen3') ||
      model.toLowerCase().includes('coder') ||
      model.toLowerCase().includes('480b')
    ));
  }

  /**
   * 应用GLM特定的补丁
   */
  private applyGLMSpecificPatches(request: any, context: any): any {
    const patchedRequest = { ...request };
    
    // GLM-4.5特殊要求
    if (!patchedRequest.temperature) {
      patchedRequest.temperature = 0.8; // GLM-4.5推荐温度
    }
    
    // GLM可能对工具调用有特殊要求
    if (patchedRequest.tools && Array.isArray(patchedRequest.tools)) {
      patchedRequest.tools = patchedRequest.tools.map((tool: any) => ({
        ...tool,
        // 确保函数描述存在
        function: {
          ...tool.function,
          description: tool.function?.description || `Function: ${tool.function?.name || 'unknown'}`
        }
      }));
    }

    this.logPatchApplied('GLM-specific', {
      temperature: patchedRequest.temperature,
      toolsCount: patchedRequest.tools?.length || 0,
      model: context.model
    });

    return patchedRequest;
  }

  /**
   * 应用Qwen3-Coder特定的补丁
   */
  private applyQwen3CoderSpecificPatches(request: any, context: any): any {
    const patchedRequest = { ...request };
    
    // Qwen3-Coder特殊要求
    if (!patchedRequest.temperature) {
      patchedRequest.temperature = 0.7; // Qwen3推荐温度
    }
    
    // Qwen3-Coder可能需要特定的消息格式
    if (patchedRequest.messages && Array.isArray(patchedRequest.messages)) {
      patchedRequest.messages = patchedRequest.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        // 确保system消息有适当的标识
        ...(msg.role === 'system' && { name: 'system' })
      }));
    }

    this.logPatchApplied('Qwen3-Coder-specific', {
      temperature: patchedRequest.temperature,
      messagesCount: patchedRequest.messages?.length || 0,
      model: context.model
    });

    return patchedRequest;
  }

  /**
   * 确保内容是字符串格式（原有方法保持向后兼容）
   */
  private ensureStringContent(content: any): string {
    return this.ensureStringContentForModelScope(content, '');
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