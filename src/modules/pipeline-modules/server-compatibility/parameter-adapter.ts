/**
 * Parameter Adapter - 参数适配器
 *
 * 处理不同Provider的参数范围限制和特殊适配需求
 * 不包括模型映射功能（由Router层处理）
 *
 * @author Jason Zhang
 */

import { OpenAIStandardRequest, DebugRecorder } from './enhanced-compatibility';

/**
 * 参数适配器
 */
export class ParameterAdapter {
  private debugRecorder: DebugRecorder;

  constructor(debugRecorder: DebugRecorder) {
    this.debugRecorder = debugRecorder;
  }

  /**
   * DeepSeek参数适配
   */
  adaptForDeepSeek(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };
    const adaptations: string[] = [];

    // DeepSeek工具调用优化
    if (adapted.tools && adapted.tools.length > 0) {
      if (!adapted.tool_choice || adapted.tool_choice === 'none') {
        adapted.tool_choice = 'auto';
        adaptations.push('set_tool_choice_auto');
      }
    }

    // 参数范围限制
    if (adapted.max_tokens && adapted.max_tokens > 8192) {
      const original = adapted.max_tokens;
      adapted.max_tokens = 8192;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('deepseek_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'deepseek_limit',
      });
    }

    if (adapted.temperature !== undefined) {
      const original = adapted.temperature;
      adapted.temperature = Math.max(0.01, Math.min(2.0, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
        this.debugRecorder.record('deepseek_temperature_adjusted', {
          original: original,
          adjusted: adapted.temperature,
          reason: 'deepseek_range_limit',
        });
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      adapted.top_p = Math.max(0.01, Math.min(1.0, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    // 记录所有适配操作
    if (adaptations.length > 0) {
      this.debugRecorder.record('deepseek_parameter_adaptations', {
        adaptations: adaptations,
        original_params: this.extractRelevantParams(request),
        adapted_params: this.extractRelevantParams(adapted),
      });
    }

    return adapted;
  }

  /**
   * LM Studio参数适配
   */
  adaptForLMStudio(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };
    const adaptations: string[] = [];

    // LM Studio通常不支持工具调用
    if (adapted.tools && adapted.tools.length > 0) {
      const removedToolsCount = adapted.tools.length;
      delete adapted.tools;
      delete adapted.tool_choice;
      adaptations.push('removed_unsupported_tools');

      this.debugRecorder.record('lmstudio_tools_removed', {
        reason: 'lmstudio_limited_tool_support',
        removed_tools_count: removedToolsCount,
        tools_list: request.tools?.map(tool => tool.function.name),
      });
    }

    // 参数限制调整 - LM Studio保守配置
    if (adapted.temperature !== undefined) {
      const original = adapted.temperature;
      adapted.temperature = Math.max(0.01, Math.min(2.0, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    if (adapted.max_tokens && adapted.max_tokens > 4096) {
      const original = adapted.max_tokens;
      adapted.max_tokens = 4096;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('lmstudio_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'conservative_local_model_limit',
      });
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      adapted.top_p = Math.max(0.01, Math.min(1.0, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    // 频率惩罚和存在惩罚调整
    if (adapted.frequency_penalty !== undefined) {
      const original = adapted.frequency_penalty;
      adapted.frequency_penalty = Math.max(-2.0, Math.min(2.0, adapted.frequency_penalty));
      if (original !== adapted.frequency_penalty) {
        adaptations.push('adjusted_frequency_penalty');
      }
    }

    if (adapted.presence_penalty !== undefined) {
      const original = adapted.presence_penalty;
      adapted.presence_penalty = Math.max(-2.0, Math.min(2.0, adapted.presence_penalty));
      if (original !== adapted.presence_penalty) {
        adaptations.push('adjusted_presence_penalty');
      }
    }

    // 记录适配操作
    if (adaptations.length > 0) {
      this.debugRecorder.record('lmstudio_parameter_adaptations', {
        adaptations: adaptations,
        original_params: this.extractRelevantParams(request),
        adapted_params: this.extractRelevantParams(adapted),
      });
    }

    return adapted;
  }

  /**
   * Ollama参数适配
   */
  adaptForOllama(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };
    const adaptations: string[] = [];

    // Ollama通常不支持工具调用
    if (adapted.tools && adapted.tools.length > 0) {
      const removedToolsCount = adapted.tools.length;
      delete adapted.tools;
      delete adapted.tool_choice;
      adaptations.push('removed_unsupported_tools');

      this.debugRecorder.record('ollama_tools_removed', {
        reason: 'ollama_no_tool_support',
        removed_tools_count: removedToolsCount,
      });
    }

    // Ollama参数限制
    if (adapted.temperature !== undefined) {
      const original = adapted.temperature;
      adapted.temperature = Math.max(0, Math.min(2.0, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      adapted.top_p = Math.max(0, Math.min(1.0, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    // Ollama对max_tokens的处理可能不同
    if (adapted.max_tokens && adapted.max_tokens > 8192) {
      const original = adapted.max_tokens;
      adapted.max_tokens = 8192;
      adaptations.push('capped_max_tokens');
    }

    // 移除不支持的参数
    if (adapted.frequency_penalty !== undefined) {
      delete adapted.frequency_penalty;
      adaptations.push('removed_frequency_penalty');
    }

    if (adapted.presence_penalty !== undefined) {
      delete adapted.presence_penalty;
      adaptations.push('removed_presence_penalty');
    }

    // 记录适配操作
    if (adaptations.length > 0) {
      this.debugRecorder.record('ollama_parameter_adaptations', {
        adaptations: adaptations,
        original_params: this.extractRelevantParams(request),
        adapted_params: this.extractRelevantParams(adapted),
      });
    }

    return adapted;
  }

  /**
   * 通用参数适配
   */
  adaptGeneric(request: OpenAIStandardRequest): OpenAIStandardRequest {
    const adapted = { ...request };
    const adaptations: string[] = [];

    // 通用参数范围检查
    if (adapted.temperature !== undefined) {
      const original = adapted.temperature;
      adapted.temperature = Math.max(0, Math.min(2.0, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      adapted.top_p = Math.max(0, Math.min(1.0, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    if (adapted.frequency_penalty !== undefined) {
      const original = adapted.frequency_penalty;
      adapted.frequency_penalty = Math.max(-2.0, Math.min(2.0, adapted.frequency_penalty));
      if (original !== adapted.frequency_penalty) {
        adaptations.push('adjusted_frequency_penalty');
      }
    }

    if (adapted.presence_penalty !== undefined) {
      const original = adapted.presence_penalty;
      adapted.presence_penalty = Math.max(-2.0, Math.min(2.0, adapted.presence_penalty));
      if (original !== adapted.presence_penalty) {
        adaptations.push('adjusted_presence_penalty');
      }
    }

    // 保守的max_tokens限制
    if (adapted.max_tokens && adapted.max_tokens > 8192) {
      const original = adapted.max_tokens;
      adapted.max_tokens = 8192;
      adaptations.push('capped_max_tokens');
    }

    // 记录通用适配操作
    if (adaptations.length > 0) {
      this.debugRecorder.record('generic_parameter_adaptations', {
        adaptations: adaptations,
        original_params: this.extractRelevantParams(request),
        adapted_params: this.extractRelevantParams(adapted),
      });
    }

    return adapted;
  }

  /**
   * 检查参数是否需要适配
   */
  needsAdaptation(request: OpenAIStandardRequest, serverType: string): boolean {
    switch (serverType) {
      case 'deepseek':
        return this.needsDeepSeekAdaptation(request);
      case 'lmstudio':
        return this.needsLMStudioAdaptation(request);
      case 'ollama':
        return this.needsOllamaAdaptation(request);
      default:
        return this.needsGenericAdaptation(request);
    }
  }

  /**
   * 获取适配需求分析
   */
  getAdaptationNeeds(request: OpenAIStandardRequest, serverType: string): string[] {
    const needs: string[] = [];

    switch (serverType) {
      case 'deepseek':
        if (request.tools && (!request.tool_choice || request.tool_choice === 'none')) {
          needs.push('set_tool_choice_auto');
        }
        if (request.max_tokens && request.max_tokens > 8192) {
          needs.push('cap_max_tokens');
        }
        if (request.temperature && (request.temperature < 0.01 || request.temperature > 2.0)) {
          needs.push('adjust_temperature');
        }
        break;

      case 'lmstudio':
        if (request.tools && request.tools.length > 0) {
          needs.push('remove_tools');
        }
        if (request.max_tokens && request.max_tokens > 4096) {
          needs.push('cap_max_tokens');
        }
        break;

      case 'ollama':
        if (request.tools && request.tools.length > 0) {
          needs.push('remove_tools');
        }
        if (request.frequency_penalty !== undefined) {
          needs.push('remove_frequency_penalty');
        }
        if (request.presence_penalty !== undefined) {
          needs.push('remove_presence_penalty');
        }
        break;
    }

    return needs;
  }

  // 私有辅助方法

  private needsDeepSeekAdaptation(request: OpenAIStandardRequest): boolean {
    return !!(
      (request.tools && (!request.tool_choice || request.tool_choice === 'none')) ||
      (request.max_tokens && request.max_tokens > 8192) ||
      (request.temperature && (request.temperature < 0.01 || request.temperature > 2.0)) ||
      (request.top_p && (request.top_p < 0.01 || request.top_p > 1.0))
    );
  }

  private needsLMStudioAdaptation(request: OpenAIStandardRequest): boolean {
    return !!(
      (request.tools && request.tools.length > 0) ||
      (request.max_tokens && request.max_tokens > 4096) ||
      (request.temperature && (request.temperature < 0.01 || request.temperature > 2.0)) ||
      (request.frequency_penalty && (request.frequency_penalty < -2.0 || request.frequency_penalty > 2.0)) ||
      (request.presence_penalty && (request.presence_penalty < -2.0 || request.presence_penalty > 2.0))
    );
  }

  private needsOllamaAdaptation(request: OpenAIStandardRequest): boolean {
    return !!(
      (request.tools && request.tools.length > 0) ||
      (request.max_tokens && request.max_tokens > 8192) ||
      request.frequency_penalty !== undefined ||
      request.presence_penalty !== undefined ||
      (request.temperature && (request.temperature < 0 || request.temperature > 2.0))
    );
  }

  private needsGenericAdaptation(request: OpenAIStandardRequest): boolean {
    return !!(
      (request.temperature && (request.temperature < 0 || request.temperature > 2.0)) ||
      (request.top_p && (request.top_p < 0 || request.top_p > 1.0)) ||
      (request.max_tokens && request.max_tokens > 8192) ||
      (request.frequency_penalty && (request.frequency_penalty < -2.0 || request.frequency_penalty > 2.0)) ||
      (request.presence_penalty && (request.presence_penalty < -2.0 || request.presence_penalty > 2.0))
    );
  }

  private extractRelevantParams(request: OpenAIStandardRequest): any {
    return {
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
      tools_count: request.tools?.length || 0,
      tool_choice: request.tool_choice,
      has_stop: !!request.stop,
    };
  }
}
