/**
 * Parameter Adapter - 参数适配器
 *
 * 处理不同Provider的参数范围限制和特殊适配需求
 * 不包括模型映射功能（由Router层处理）
 *
 * @author Jason Zhang
 */

import { OpenAIStandardRequest, DebugRecorder } from './types/compatibility-types';

/**
 * 参数适配器配置接口
 */
export interface ParameterAdapterConfig {
  maxTokens?: {
    deepseek?: number;
    lmstudio?: number;
    ollama?: number;
    generic?: number;
  };
  temperature?: {
    min: number;
    max: number;
  };
  topP?: {
    min: number;
    max: number;
  };
  penalties?: {
    frequency?: {
      min: number;
      max: number;
    };
    presence?: {
      min: number;
      max: number;
    };
  };
}

/**
 * 默认参数适配器配置
 */
const DEFAULT_ADAPTER_CONFIG: ParameterAdapterConfig = {
  maxTokens: {
    deepseek: 262144,
    lmstudio: 262144,
    ollama: 262144,
    generic: 262144,
  },
  temperature: {
    min: 0.01,
    max: 2.0,
  },
  topP: {
    min: 0.01,
    max: 1.0,
  },
  penalties: {
    frequency: {
      min: -2.0,
      max: 2.0,
    },
    presence: {
      min: -2.0,
      max: 2.0,
    },
  },
};

/**
 * 参数适配器
 */
export class ParameterAdapter {
  private debugRecorder: DebugRecorder;
  private config: ParameterAdapterConfig;

  constructor(debugRecorder: DebugRecorder, config?: Partial<ParameterAdapterConfig>) {
    this.debugRecorder = debugRecorder;
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config };
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

    // 参数范围限制 - 从配置文件读取maxTokens上限
    const configMaxTokens = this.config.maxTokens?.deepseek || DEFAULT_ADAPTER_CONFIG.maxTokens!.deepseek!;
    if (adapted.max_tokens && adapted.max_tokens > configMaxTokens) {
      const original = adapted.max_tokens;
      adapted.max_tokens = configMaxTokens;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('deepseek_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'config_limit',
        configLimit: configMaxTokens
      });
    }

    if (adapted.temperature !== undefined) {
      const original = adapted.temperature;
      const minTemp = this.config.temperature?.min || DEFAULT_ADAPTER_CONFIG.temperature!.min;
      const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
      adapted.temperature = Math.max(minTemp, Math.min(maxTemp, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
        this.debugRecorder.record('deepseek_temperature_adjusted', {
          original: original,
          adjusted: adapted.temperature,
          reason: 'deepseek_range_limit',
          minTemp,
          maxTemp
        });
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      const minTopP = this.config.topP?.min || DEFAULT_ADAPTER_CONFIG.topP!.min;
      const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
      adapted.top_p = Math.max(minTopP, Math.min(maxTopP, adapted.top_p));
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
      const minTemp = this.config.temperature?.min || DEFAULT_ADAPTER_CONFIG.temperature!.min;
      const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
      adapted.temperature = Math.max(minTemp, Math.min(maxTemp, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    // 从配置文件读取LM Studio的maxTokens上限
    const lmstudioMaxTokens = this.config.maxTokens?.lmstudio || DEFAULT_ADAPTER_CONFIG.maxTokens!.lmstudio!;
    if (adapted.max_tokens && adapted.max_tokens > lmstudioMaxTokens) {
      const original = adapted.max_tokens;
      adapted.max_tokens = lmstudioMaxTokens;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('lmstudio_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'config_limit',
        configLimit: lmstudioMaxTokens
      });
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      const minTopP = this.config.topP?.min || DEFAULT_ADAPTER_CONFIG.topP!.min;
      const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
      adapted.top_p = Math.max(minTopP, Math.min(maxTopP, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    // 频率惩罚和存在惩罚调整
    if (adapted.frequency_penalty !== undefined) {
      const original = adapted.frequency_penalty;
      const minFreq = this.config.penalties?.frequency?.min || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.min;
      const maxFreq = this.config.penalties?.frequency?.max || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.max;
      adapted.frequency_penalty = Math.max(minFreq, Math.min(maxFreq, adapted.frequency_penalty));
      if (original !== adapted.frequency_penalty) {
        adaptations.push('adjusted_frequency_penalty');
      }
    }

    if (adapted.presence_penalty !== undefined) {
      const original = adapted.presence_penalty;
      const minPres = this.config.penalties?.presence?.min || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.min;
      const maxPres = this.config.penalties?.presence?.max || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.max;
      adapted.presence_penalty = Math.max(minPres, Math.min(maxPres, adapted.presence_penalty));
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
      // Ollama允许temperature从0开始
      const minTemp = 0;
      const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
      adapted.temperature = Math.max(minTemp, Math.min(maxTemp, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      // Ollama允许top_p从0开始
      const minTopP = 0;
      const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
      adapted.top_p = Math.max(minTopP, Math.min(maxTopP, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    // Ollama对max_tokens的处理可能不同 - 从配置文件读取上限
    const ollamaMaxTokens = this.config.maxTokens?.ollama || DEFAULT_ADAPTER_CONFIG.maxTokens!.ollama!;
    if (adapted.max_tokens && adapted.max_tokens > ollamaMaxTokens) {
      const original = adapted.max_tokens;
      adapted.max_tokens = ollamaMaxTokens;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('ollama_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'config_limit',
        configLimit: ollamaMaxTokens
      });
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
      const minTemp = 0; // 通用情况允许从0开始
      const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
      adapted.temperature = Math.max(minTemp, Math.min(maxTemp, adapted.temperature));
      if (original !== adapted.temperature) {
        adaptations.push('adjusted_temperature');
      }
    }

    if (adapted.top_p !== undefined) {
      const original = adapted.top_p;
      const minTopP = 0; // 通用情况允许从0开始
      const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
      adapted.top_p = Math.max(minTopP, Math.min(maxTopP, adapted.top_p));
      if (original !== adapted.top_p) {
        adaptations.push('adjusted_top_p');
      }
    }

    if (adapted.frequency_penalty !== undefined) {
      const original = adapted.frequency_penalty;
      const minFreq = this.config.penalties?.frequency?.min || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.min;
      const maxFreq = this.config.penalties?.frequency?.max || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.max;
      adapted.frequency_penalty = Math.max(minFreq, Math.min(maxFreq, adapted.frequency_penalty));
      if (original !== adapted.frequency_penalty) {
        adaptations.push('adjusted_frequency_penalty');
      }
    }

    if (adapted.presence_penalty !== undefined) {
      const original = adapted.presence_penalty;
      const minPres = this.config.penalties?.presence?.min || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.min;
      const maxPres = this.config.penalties?.presence?.max || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.max;
      adapted.presence_penalty = Math.max(minPres, Math.min(maxPres, adapted.presence_penalty));
      if (original !== adapted.presence_penalty) {
        adaptations.push('adjusted_presence_penalty');
      }
    }

    // 保守的max_tokens限制 - 从配置文件读取上限
    const genericMaxTokens = this.config.maxTokens?.generic || DEFAULT_ADAPTER_CONFIG.maxTokens!.generic!;
    if (adapted.max_tokens && adapted.max_tokens > genericMaxTokens) {
      const original = adapted.max_tokens;
      adapted.max_tokens = genericMaxTokens;
      adaptations.push('capped_max_tokens');
      this.debugRecorder.record('generic_max_tokens_adjusted', {
        original: original,
        adjusted: adapted.max_tokens,
        reason: 'config_limit',
        configLimit: genericMaxTokens
      });
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
        const deepseekMaxTokens = this.config.maxTokens?.deepseek || DEFAULT_ADAPTER_CONFIG.maxTokens!.deepseek!;
        if (request.max_tokens && request.max_tokens > deepseekMaxTokens) {
          needs.push('cap_max_tokens');
        }
        const minTemp = this.config.temperature?.min || DEFAULT_ADAPTER_CONFIG.temperature!.min;
        const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
        if (request.temperature && (request.temperature < minTemp || request.temperature > maxTemp)) {
          needs.push('adjust_temperature');
        }
        break;

      case 'lmstudio':
        if (request.tools && request.tools.length > 0) {
          needs.push('remove_tools');
        }
        const lmstudioMaxTokens = this.config.maxTokens?.lmstudio || DEFAULT_ADAPTER_CONFIG.maxTokens!.lmstudio!;
        if (request.max_tokens && request.max_tokens > lmstudioMaxTokens) {
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
    const deepseekMaxTokens = this.config.maxTokens?.deepseek || DEFAULT_ADAPTER_CONFIG.maxTokens!.deepseek!;
    const minTemp = this.config.temperature?.min || DEFAULT_ADAPTER_CONFIG.temperature!.min;
    const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
    const minTopP = this.config.topP?.min || DEFAULT_ADAPTER_CONFIG.topP!.min;
    const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
    
    return !!(
      (request.tools && (!request.tool_choice || request.tool_choice === 'none')) ||
      (request.max_tokens && request.max_tokens > deepseekMaxTokens) ||
      (request.temperature && (request.temperature < minTemp || request.temperature > maxTemp)) ||
      (request.top_p && (request.top_p < minTopP || request.top_p > maxTopP))
    );
  }

  private needsLMStudioAdaptation(request: OpenAIStandardRequest): boolean {
    const lmstudioMaxTokens = this.config.maxTokens?.lmstudio || DEFAULT_ADAPTER_CONFIG.maxTokens!.lmstudio!;
    const minTemp = this.config.temperature?.min || DEFAULT_ADAPTER_CONFIG.temperature!.min;
    const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
    const minFreq = this.config.penalties?.frequency?.min || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.min;
    const maxFreq = this.config.penalties?.frequency?.max || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.max;
    const minPres = this.config.penalties?.presence?.min || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.min;
    const maxPres = this.config.penalties?.presence?.max || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.max;
    
    return !!(
      (request.tools && request.tools.length > 0) ||
      (request.max_tokens && request.max_tokens > lmstudioMaxTokens) ||
      (request.temperature && (request.temperature < minTemp || request.temperature > maxTemp)) ||
      (request.frequency_penalty && (request.frequency_penalty < minFreq || request.frequency_penalty > maxFreq)) ||
      (request.presence_penalty && (request.presence_penalty < minPres || request.presence_penalty > maxPres))
    );
  }

  private needsOllamaAdaptation(request: OpenAIStandardRequest): boolean {
    const ollamaMaxTokens = this.config.maxTokens?.ollama || DEFAULT_ADAPTER_CONFIG.maxTokens!.ollama!;
    const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
    
    return !!(
      (request.tools && request.tools.length > 0) ||
      (request.max_tokens && request.max_tokens > ollamaMaxTokens) ||
      request.frequency_penalty !== undefined ||
      request.presence_penalty !== undefined ||
      (request.temperature && (request.temperature < 0 || request.temperature > maxTemp))
    );
  }

  private needsGenericAdaptation(request: OpenAIStandardRequest): boolean {
    const genericMaxTokens = this.config.maxTokens?.generic || DEFAULT_ADAPTER_CONFIG.maxTokens!.generic!;
    const maxTemp = this.config.temperature?.max || DEFAULT_ADAPTER_CONFIG.temperature!.max;
    const maxTopP = this.config.topP?.max || DEFAULT_ADAPTER_CONFIG.topP!.max;
    const minFreq = this.config.penalties?.frequency?.min || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.min;
    const maxFreq = this.config.penalties?.frequency?.max || DEFAULT_ADAPTER_CONFIG.penalties!.frequency!.max;
    const minPres = this.config.penalties?.presence?.min || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.min;
    const maxPres = this.config.penalties?.presence?.max || DEFAULT_ADAPTER_CONFIG.penalties!.presence!.max;
    
    return !!(
      (request.temperature && (request.temperature < 0 || request.temperature > maxTemp)) ||
      (request.top_p && (request.top_p < 0 || request.top_p > maxTopP)) ||
      (request.max_tokens && request.max_tokens > genericMaxTokens) ||
      (request.frequency_penalty && (request.frequency_penalty < minFreq || request.frequency_penalty > maxFreq)) ||
      (request.presence_penalty && (request.presence_penalty < minPres || request.presence_penalty > maxPres))
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
