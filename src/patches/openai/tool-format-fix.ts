/**
 * OpenAI-Compatible Provider 工具调用格式修复补丁
 * 修复第三方OpenAI兼容服务的工具调用格式问题
 */

import { BasePatch, PatchContext, PatchResult, PatchCondition } from '../types';

export class OpenAIToolFormatFixPatch implements BasePatch {
  name = 'openai-tool-format-fix';
  description = 'Fix tool call format for OpenAI-compatible providers';
  type = 'response' as const;
  priority = 10;
  
  condition: PatchCondition = {
    provider: 'openai',
    model: (model: string) => {
      // 支持OpenAI兼容服务的模型
      return model.includes('gpt') || 
             model.includes('claude') || 
             model.includes('gemini') ||
             model.includes('glm') ||
             model.includes('qwen') ||
             model.includes('deepseek');
    },
    enabled: () => process.env.RCC_PATCHES_OPENAI_TOOL_FORMAT_FIX !== 'false'
  };

  /**
   * 检查是否应该应用此补丁
   */
  shouldApply(context: PatchContext, data: any): boolean {
    // 检查是否是OpenAI provider且包含工具调用相关内容
    if (context.provider !== 'openai') {
      return false;
    }

    // 检查响应中是否有工具调用或工具定义
    const hasToolCalls = data?.choices?.some((c: any) => c.message?.tool_calls);
    const hasTools = data?.tools?.length > 0;
    const hasToolCallsInMessage = data?.choices?.some((c: any) => 
      c.message?.content && typeof c.message.content === 'string' && 
      c.message.content.includes('tool_calls')
    );

    return hasToolCalls || hasTools || hasToolCallsInMessage;
  }

  /**
   * 应用补丁
   */
  async apply(context: PatchContext, data: any): Promise<PatchResult> {
    const startTime = Date.now();
    
    try {
      const patchedData = await this.patchResponse(data, context);
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
   * 修复请求格式 - 确保工具调用格式正确
   */
  async patchRequest(request: any, context: any): Promise<any> {
    // 如果没有工具调用，直接返回
    if (!request.tools || request.tools.length === 0) {
      return request;
    }

    const patchedRequest = { ...request };
    
    // 修复工具定义格式
    if (patchedRequest.tools) {
      patchedRequest.tools = patchedRequest.tools.map((tool: any) => {
        if (tool.type === 'function' && tool.function) {
          return {
            type: 'function',
            function: {
              name: tool.function.name,
              description: tool.function.description || '',
              parameters: tool.function.parameters || { type: 'object', properties: {} }
            }
          };
        }
        return tool;
      });
    }

    // 确保模型名称符合OpenAI格式
    if (!patchedRequest.model || patchedRequest.model === 'default') {
      patchedRequest.model = 'gpt-3.5-turbo';
    }

    // 确保必要的参数
    if (!patchedRequest.max_tokens) {
      patchedRequest.max_tokens = 2000;
    }

    if (typeof patchedRequest.temperature === 'undefined') {
      patchedRequest.temperature = 0.7;
    }

    this.logPatchApplied('request', {
      originalToolsCount: request.tools?.length || 0,
      patchedToolsCount: patchedRequest.tools?.length || 0,
      modelFixed: request.model !== patchedRequest.model
    });

    return patchedRequest;
  }

  /**
   * 修复响应格式 - 确保工具调用响应格式正确
   */
  async patchResponse(response: any, context: any): Promise<any> {
    if (!response || !response.choices) {
      return response;
    }

    const patchedResponse = { ...response };
    
    // 修复每个choice中的工具调用格式
    patchedResponse.choices = patchedResponse.choices.map((choice: any) => {
      if (!choice.message) return choice;

      const message = { ...choice.message };
      
      // 修复工具调用格式
      if (message.tool_calls) {
        message.tool_calls = message.tool_calls.map((toolCall: any) => {
          // 确保工具调用有正确的ID
          if (!toolCall.id) {
            toolCall.id = `call_${Math.random().toString(36).substr(2, 9)}`;
          }

          // 确保function调用格式正确
          if (toolCall.type === 'function' && toolCall.function) {
            const func = toolCall.function;
            
            // 修复参数格式
            if (typeof func.arguments === 'string') {
              try {
                // 验证JSON格式
                JSON.parse(func.arguments);
              } catch (e) {
                // 如果JSON无效，尝试修复
                func.arguments = this.fixJsonString(func.arguments);
              }
            } else if (typeof func.arguments === 'object') {
              // 如果是对象，转换为字符串
              func.arguments = JSON.stringify(func.arguments);
            }
          }

          return toolCall;
        });
      }

      // 如果有工具调用，确保finish_reason正确
      if (message.tool_calls && message.tool_calls.length > 0) {
        choice.finish_reason = 'tool_calls';
      }

      return { ...choice, message };
    });

    this.logPatchApplied('response', {
      choicesCount: response.choices?.length || 0,
      toolCallsFound: patchedResponse.choices.some((c: any) => c.message?.tool_calls?.length > 0)
    });

    return patchedResponse;
  }

  /**
   * 修复流式响应 - 确保流式工具调用格式正确
   */
  async patchStreamingChunk(chunk: any, context: any): Promise<any> {
    if (!chunk || !chunk.choices) {
      return chunk;
    }

    const patchedChunk = { ...chunk };
    
    patchedChunk.choices = patchedChunk.choices.map((choice: any) => {
      if (!choice.delta) return choice;

      const delta = { ...choice.delta };
      
      // 修复流式工具调用
      if (delta.tool_calls) {
        delta.tool_calls = delta.tool_calls.map((toolCall: any) => {
          // 确保工具调用有正确的索引
          if (typeof toolCall.index === 'undefined') {
            toolCall.index = 0;
          }

          // 确保工具调用有ID
          if (!toolCall.id && toolCall.function?.name) {
            toolCall.id = `call_${Math.random().toString(36).substr(2, 9)}`;
          }

          return toolCall;
        });
      }

      // 如果有工具调用增量，设置正确的finish_reason
      if (delta.tool_calls && choice.finish_reason === null) {
        choice.finish_reason = 'tool_calls';
      }

      return { ...choice, delta };
    });

    return patchedChunk;
  }

  /**
   * 修复JSON字符串格式
   */
  private fixJsonString(jsonStr: string): string {
    try {
      // 尝试基本的JSON修复
      let fixed = jsonStr.trim();
      
      // 确保有正确的引号
      fixed = fixed.replace(/([{,]\s*)(\w+):/g, '$1"$2":');
      
      // 修复单引号
      fixed = fixed.replace(/'/g, '"');
      
      // 验证修复后的JSON
      JSON.parse(fixed);
      return fixed;
    } catch (e) {
      // 如果无法修复，返回空对象
      return '{}';
    }
  }

  /**
   * 记录补丁应用日志
   */
  private logPatchApplied(type: string, details: any): void {
    console.log(`[OpenAI Tool Format Fix] Applied to ${type}:`, details);
  }
}