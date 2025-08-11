/**
 * Gemini响应格式修复补丁
 * 修复Gemini API响应格式与标准格式的差异
 */

import { ResponsePatch, PatchContext, PatchResult } from '../types';

export class GeminiResponseFormatFixPatch implements ResponsePatch {
  name = 'gemini-response-format-fix';
  description = 'Fix Gemini API response format differences';
  type = 'response' as const;
  priority = 10;
  
  condition = {
    provider: 'gemini' as const,
    model: (model: string) => {
      return model.includes('gemini') || 
             model.includes('bison') ||
             model.includes('palm');
    },
    enabled: () => process.env.RCC_PATCHES_GEMINI_RESPONSE_FORMAT_FIX !== 'false'
  };

  shouldApply(context: PatchContext, data: any): boolean {
    // 检查是否是Gemini响应且需要格式修复
    if (context.provider !== 'gemini') {
      return false;
    }

    // 检查是否有Gemini特有的响应结构
    return this.hasGeminiSpecificStructure(data);
  }

  async apply(context: PatchContext, data: any): Promise<PatchResult> {
    const startTime = Date.now();
    
    try {
      const fixedData = this.fixGeminiResponse(data);
      
      return {
        success: true,
        data: fixedData,
        applied: true,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: {
          originalStructure: this.getResponseStructure(data),
          fixedStructure: this.getResponseStructure(fixedData)
        }
      };
    } catch (error) {
      return {
        success: false,
        data,
        applied: false,
        patchName: this.name,
        duration: Date.now() - startTime,
        metadata: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      };
    }
  }

  /**
   * 检查是否有Gemini特有的响应结构
   */
  private hasGeminiSpecificStructure(data: any): boolean {
    // 检查Gemini API的特有字段
    return !!(
      data?.candidates ||
      data?.promptFeedback ||
      data?.filters ||
      (data?.parts && Array.isArray(data.parts))
    );
  }

  /**
   * 修复Gemini响应格式
   */
  private fixGeminiResponse(data: any): any {
    // 如果已经是标准格式，直接返回
    if (data.choices && Array.isArray(data.choices)) {
      return data;
    }

    const fixedData: any = {
      id: data.id || `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || 'gemini-pro',
      choices: []
    };

    // 处理candidates字段
    if (data.candidates && Array.isArray(data.candidates)) {
      fixedData.choices = data.candidates.map((candidate: any, index: number) => {
        const choice: any = {
          index,
          message: {
            role: 'assistant',
            content: ''
          },
          finish_reason: this.mapFinishReason(candidate.finishReason)
        };

        // 处理content
        if (candidate.content && candidate.content.parts) {
          const textParts = candidate.content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text);
          
          choice.message.content = textParts.join('\n');

          // 处理function calls
          const functionCalls = candidate.content.parts
            .filter((part: any) => part.functionCall);
          
          if (functionCalls.length > 0) {
            choice.message.tool_calls = functionCalls.map((part: any, callIndex: number) => ({
              id: `call_${Math.random().toString(36).substr(2, 9)}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {})
              }
            }));
            choice.finish_reason = 'tool_calls';
          }
        }

        return choice;
      });
    }

    // 处理usage信息
    if (data.usageMetadata) {
      fixedData.usage = {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0
      };
    }

    return fixedData;
  }

  /**
   * 映射finish reason
   */
  private mapFinishReason(geminiReason: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop'
    };

    return reasonMap[geminiReason] || 'stop';
  }

  /**
   * 获取响应结构信息
   */
  private getResponseStructure(data: any): any {
    return {
      hasChoices: !!data?.choices,
      hasCandidates: !!data?.candidates,
      hasUsage: !!data?.usage,
      hasUsageMetadata: !!data?.usageMetadata,
      topLevelKeys: Object.keys(data || {})
    };
  }
}