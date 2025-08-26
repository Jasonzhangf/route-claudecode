/**
 * Response Compatibility Fixer - 响应兼容性修复器
 *
 * 提供各种Provider的响应格式修复功能
 *
 * @author Jason Zhang
 */

import { OpenAIStandardResponse, DebugRecorder } from './enhanced-compatibility';
import { JQJsonHandler } from '../../../utils/jq-json-handler';

/**
 * LM Studio 响应修复器
 */
export class LMStudioResponseFixer {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  async fixResponse(response: any): Promise<OpenAIStandardResponse> {
    const fixStartTime = Date.now();
    const requestId = this.generateRequestId();

    this.debugRecorder.recordInput('lmstudio-response-fixer', requestId, {
      original_response: response,
      response_analysis: this.analyzeResponseStructure(response),
      fixes_needed: this.identifyNeededFixes(response),
      processing_start_time: fixStartTime,
    });

    try {
      // 1. 必需字段补全
      const fixedResponse: OpenAIStandardResponse = {
        id: response.id || `chatcmpl-lms-${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        object: 'chat.completion',
        created: response.created || Math.floor(Date.now() / 1000),
        model: response.model || 'local-model',
        choices: this.fixChoicesArray(response.choices || []),
        usage: this.fixUsageStatistics(response.usage),
        system_fingerprint: response.system_fingerprint, // 可选字段
      };

      const processingTime = Date.now() - fixStartTime;

      // 2. 记录修复操作
      this.debugRecorder.recordOutput('lmstudio-response-fixer', requestId, {
        fixed_response: fixedResponse,
        fixes_applied: this.getAppliedFixes(response, fixedResponse),
        final_structure_valid: this.validateOpenAIFormat(fixedResponse),
        processing_time_ms: processingTime,
        performance_metrics: {
          response_size_bytes: JQJsonHandler.stringifyJson(fixedResponse).length,
          choices_count: fixedResponse.choices.length,
          tool_calls_count: this.countToolCalls(fixedResponse),
        },
      });

      return fixedResponse;
    } catch (error) {
      const processingTime = Date.now() - fixStartTime;

      this.debugRecorder.recordError('lmstudio-response-fixer', requestId, {
        error_type: error.constructor.name,
        error_message: error.message,
        original_response: response,
        processing_time_ms: processingTime,
        stack_trace: error.stack,
      });

      throw error;
    }
  }

  private fixUsageStatistics(usage: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    const fixedUsage = {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    };

    // 自动计算total_tokens如果缺失
    if (fixedUsage.total_tokens === 0) {
      fixedUsage.total_tokens = fixedUsage.prompt_tokens + fixedUsage.completion_tokens;
    }

    return fixedUsage;
  }

  private fixChoicesArray(choices: any[]): OpenAIStandardResponse['choices'] {
    if (!Array.isArray(choices) || choices.length === 0) {
      return [
        {
          index: 0,
          message: { role: 'assistant', content: '' },
          finish_reason: 'stop',
        },
      ];
    }

    return choices.map((choice, index) => ({
      index: choice.index ?? index,
      message: {
        role: 'assistant',
        content: choice.message?.content || '',
        tool_calls: choice.message?.tool_calls ? this.fixToolCallsFormat(choice.message.tool_calls) : undefined,
      },
      finish_reason: choice.finish_reason || 'stop',
    }));
  }

  private fixToolCallsFormat(
    toolCalls: any[]
  ): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
    return toolCalls.map(toolCall => ({
      id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: {
        name: toolCall.function?.name || '',
        arguments:
          typeof toolCall.function?.arguments === 'string'
            ? toolCall.function.arguments
            : JQJsonHandler.stringifyJson(toolCall.function?.arguments || {}),
      },
    }));
  }

  private analyzeResponseStructure(response: any): any {
    return {
      type: typeof response,
      keys: Object.keys(response || {}),
      has_standard_fields: {
        id: !!response?.id,
        object: !!response?.object,
        choices: Array.isArray(response?.choices),
        usage: !!response?.usage,
      },
    };
  }

  private getAppliedFixes(original: any, fixed: OpenAIStandardResponse): string[] {
    const fixes = [];

    if (!original.id && fixed.id) {
      fixes.push('added_id');
    }

    if (!original.created && fixed.created) {
      fixes.push('added_created');
    }

    if (!original.usage || !original.usage.total_tokens) {
      fixes.push('fixed_usage_statistics');
    }

    if (!Array.isArray(original.choices) || original.choices.length === 0) {
      fixes.push('fixed_choices_array');
    }

    return fixes;
  }

  private validateOpenAIFormat(response: any): boolean {
    return !!(
      response.id &&
      response.object === 'chat.completion' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  private generateRequestId(): string {
    return `lms-fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private identifyNeededFixes(response: any): string[] {
    const fixes = [];

    if (!response.id) fixes.push('missing_id');
    if (!response.created) fixes.push('missing_created');
    if (!response.object) fixes.push('missing_object');
    if (!response.usage) fixes.push('missing_usage');
    if (!Array.isArray(response.choices)) fixes.push('invalid_choices_format');
    if (response.usage && !response.usage.total_tokens) fixes.push('incomplete_usage');

    return fixes;
  }

  private countToolCalls(response: OpenAIStandardResponse): number {
    return response.choices.reduce((total, choice) => {
      return total + (choice.message.tool_calls?.length || 0);
    }, 0);
  }
}

/**
 * DeepSeek 响应修复器
 */
export class DeepSeekResponseFixer {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  async fixResponse(response: any): Promise<OpenAIStandardResponse> {
    this.debugRecorder.record('deepseek_response_fix_start', {
      original_structure: this.analyzeResponseStructure(response),
      has_thinking: !!response.thinking,
      thinking_length: response.thinking?.length || 0,
    });

    // DeepSeek通常返回标准格式，但处理思考模式特殊情况
    const fixedResponse: OpenAIStandardResponse = {
      ...response,
      object: 'chat.completion', // 确保object字段正确
    };

    // 处理思考模式的特殊响应
    if (response.thinking && response.thinking.length > 0) {
      this.debugRecorder.record('deepseek_thinking_mode_detected', {
        thinking_content_length: response.thinking.length,
        has_reasoning_chain: true,
      });
      // 思考内容不暴露给客户端，仅记录调试信息
      delete fixedResponse.thinking; // 移除非标准字段
    }

    // 工具调用格式确保正确
    if (fixedResponse.choices) {
      fixedResponse.choices = fixedResponse.choices.map(choice => {
        if (choice.message?.tool_calls) {
          choice.message.tool_calls = choice.message.tool_calls.map(toolCall => ({
            ...toolCall,
            function: {
              ...toolCall.function,
              arguments:
                typeof toolCall.function?.arguments === 'string'
                  ? toolCall.function.arguments
                  : JQJsonHandler.stringifyJson(toolCall.function?.arguments || {}),
            },
          }));
        }
        return choice;
      });
    }

    this.debugRecorder.record('deepseek_response_fix_completed', {
      fixes_applied: this.getAppliedFixes(response, fixedResponse),
      final_structure_valid: this.validateOpenAIFormat(fixedResponse),
    });

    return fixedResponse;
  }

  private analyzeResponseStructure(response: any): any {
    return {
      type: typeof response,
      keys: Object.keys(response || {}),
      has_thinking: !!response?.thinking,
      thinking_type: typeof response?.thinking,
      has_standard_fields: {
        id: !!response?.id,
        object: !!response?.object,
        choices: Array.isArray(response?.choices),
        usage: !!response?.usage,
      },
    };
  }

  private getAppliedFixes(original: any, fixed: OpenAIStandardResponse): string[] {
    const fixes = [];

    if (original.thinking && !fixed.thinking) {
      fixes.push('removed_thinking_field');
    }

    if (original.object !== 'chat.completion' && fixed.object === 'chat.completion') {
      fixes.push('standardized_object_field');
    }

    // 检查工具调用是否被标准化
    if (this.hasToolCallsFormatChanges(original, fixed)) {
      fixes.push('standardized_tool_calls');
    }

    return fixes;
  }

  private hasToolCallsFormatChanges(original: any, fixed: any): boolean {
    const originalToolCalls = original.choices?.[0]?.message?.tool_calls;
    const fixedToolCalls = fixed.choices?.[0]?.message?.tool_calls;

    if (!originalToolCalls && !fixedToolCalls) return false;
    if (!originalToolCalls || !fixedToolCalls) return true;

    // 简化检查：如果arguments字段类型不同，说明被标准化了
    for (let i = 0; i < originalToolCalls.length; i++) {
      const origArgs = originalToolCalls[i]?.function?.arguments;
      const fixedArgs = fixedToolCalls[i]?.function?.arguments;

      if (typeof origArgs !== typeof fixedArgs) {
        return true;
      }
    }

    return false;
  }

  private validateOpenAIFormat(response: any): boolean {
    return !!(
      response.id &&
      response.object === 'chat.completion' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }
}

/**
 * Ollama 响应修复器
 */
export class OllamaResponseFixer {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  async fixResponse(response: any): Promise<OpenAIStandardResponse> {
    this.debugRecorder.record('ollama_response_fix_start', {
      original_structure: this.analyzeResponseStructure(response),
      response_type: typeof response,
    });

    // Ollama可能返回不同的响应格式，需要转换为OpenAI格式
    const chatId = `chatcmpl-ollama-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Math.floor(Date.now() / 1000);

    let content = '';
    if (typeof response === 'string') {
      content = response;
    } else if (response.response) {
      content = response.response; // Ollama特有字段
    } else if (response.message?.content) {
      content = response.message.content;
    } else if (response.choices?.[0]?.message?.content) {
      content = response.choices[0].message.content;
    }

    const fixedResponse: OpenAIStandardResponse = {
      id: response.id || chatId,
      object: 'chat.completion',
      created: response.created || timestamp,
      model: response.model || 'ollama-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content,
          },
          finish_reason: response.done ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: response.prompt_eval_count || 0,
        completion_tokens: response.eval_count || 0,
        total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };

    this.debugRecorder.record('ollama_response_fix_completed', {
      fixes_applied: this.getAppliedFixes(response, fixedResponse),
      final_structure_valid: this.validateOpenAIFormat(fixedResponse),
    });

    return fixedResponse;
  }

  private analyzeResponseStructure(response: any): any {
    return {
      type: typeof response,
      keys: Object.keys(response || {}),
      has_ollama_fields: {
        response: !!response?.response,
        done: !!response?.done,
        prompt_eval_count: !!response?.prompt_eval_count,
        eval_count: !!response?.eval_count,
      },
      has_standard_fields: {
        id: !!response?.id,
        object: !!response?.object,
        choices: Array.isArray(response?.choices),
        usage: !!response?.usage,
      },
    };
  }

  private getAppliedFixes(original: any, fixed: OpenAIStandardResponse): string[] {
    const fixes = [];

    if (original.response && !original.choices) {
      fixes.push('converted_ollama_response_to_choices');
    }

    if (!original.id && fixed.id) {
      fixes.push('added_id');
    }

    if (original.prompt_eval_count || original.eval_count) {
      fixes.push('converted_ollama_usage_to_openai_usage');
    }

    if (!original.created && fixed.created) {
      fixes.push('added_created_timestamp');
    }

    return fixes;
  }

  private validateOpenAIFormat(response: any): boolean {
    return !!(
      response.id &&
      response.object === 'chat.completion' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }
}

/**
 * 通用响应修复器
 */
export class GenericResponseFixer {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  async fixResponse(response: any): Promise<OpenAIStandardResponse> {
    this.debugRecorder.record('generic_response_fix_start', {
      original_structure: this.analyzeResponseStructure(response),
      response_type: typeof response,
    });

    // 如果已经是标准格式，进行基础修复
    if (this.isStandardOpenAIResponse(response)) {
      const fixedResponse = {
        ...response,
        id: response.id || this.generateChatId(),
        created: response.created || Math.floor(Date.now() / 1000),
        usage: this.fixUsageStatistics(response.usage),
      };

      this.debugRecorder.record('generic_response_fix_completed', {
        fixes_applied: ['enhanced_existing_standard_response'],
        final_structure_valid: this.validateOpenAIFormat(fixedResponse),
      });

      return fixedResponse;
    }

    // 从各种可能的响应格式中提取内容
    const content = this.extractContent(response);
    const chatId = this.generateChatId();
    const timestamp = Math.floor(Date.now() / 1000);

    const fixedResponse: OpenAIStandardResponse = {
      id: chatId,
      object: 'chat.completion',
      created: timestamp,
      model: response.model || 'generic-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };

    this.debugRecorder.record('generic_response_fix_completed', {
      fixes_applied: this.getAppliedFixes(response, fixedResponse),
      final_structure_valid: this.validateOpenAIFormat(fixedResponse),
      content_extraction_method: this.getContentExtractionMethod(response),
    });

    return fixedResponse;
  }

  private extractContent(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response.content) {
      return typeof response.content === 'string' ? response.content : JQJsonHandler.stringifyJson(response.content);
    }

    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    if (response.message) {
      return typeof response.message === 'string' ? response.message : JQJsonHandler.stringifyJson(response.message);
    }

    if (response.text) {
      return response.text;
    }

    if (response.output) {
      return response.output;
    }

    // 最后尝试JSON字符串化
    return JQJsonHandler.stringifyJson(response);
  }

  private getContentExtractionMethod(response: any): string {
    if (typeof response === 'string') return 'direct_string';
    if (response.content) return 'content_field';
    if (response.choices?.[0]?.message?.content) return 'choices_message_content';
    if (response.message) return 'message_field';
    if (response.text) return 'text_field';
    if (response.output) return 'output_field';
    throw new Error('Zero Fallback Policy: No valid response format method available');
  }

  private fixUsageStatistics(usage: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    const fixedUsage = {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    };

    // 自动计算total_tokens如果缺失
    if (fixedUsage.total_tokens === 0) {
      fixedUsage.total_tokens = fixedUsage.prompt_tokens + fixedUsage.completion_tokens;
    }

    return fixedUsage;
  }

  private isStandardOpenAIResponse(response: any): boolean {
    return (
      response &&
      response.object === 'chat.completion' &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  private generateChatId(): string {
    return `chatcmpl-generic-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  private analyzeResponseStructure(response: any): any {
    return {
      type: typeof response,
      keys: Object.keys(response || {}),
      is_string: typeof response === 'string',
      has_content_fields: {
        content: !!response?.content,
        message: !!response?.message,
        text: !!response?.text,
        output: !!response?.output,
        choices: Array.isArray(response?.choices),
      },
      has_standard_fields: {
        id: !!response?.id,
        object: !!response?.object,
        usage: !!response?.usage,
      },
    };
  }

  private getAppliedFixes(original: any, fixed: OpenAIStandardResponse): string[] {
    const fixes = [];

    if (typeof original === 'string') {
      fixes.push('converted_string_to_openai_format');
    }

    if (!original.id && fixed.id) {
      fixes.push('added_id');
    }

    if (!original.created && fixed.created) {
      fixes.push('added_created_timestamp');
    }

    if (!original.choices && fixed.choices) {
      fixes.push('created_choices_array');
    }

    if (!original.usage && fixed.usage) {
      fixes.push('created_usage_statistics');
    }

    return fixes;
  }

  private validateOpenAIFormat(response: any): boolean {
    return !!(
      response.id &&
      response.object === 'chat.completion' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.usage &&
      typeof response.usage.total_tokens === 'number'
    );
  }
}
