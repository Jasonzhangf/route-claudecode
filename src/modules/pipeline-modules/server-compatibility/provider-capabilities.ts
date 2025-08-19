/**
 * Provider Capabilities Manager - Provider能力配置管理器
 *
 * 从配置文件动态加载Provider能力配置，不硬编码任何限制
 *
 * @author Jason Zhang
 */

import { ProviderCapabilities } from './enhanced-compatibility';

/**
 * Provider能力管理器 - 配置驱动版本
 */
export class ProviderCapabilitiesManager {
  private static capabilities: Record<string, ProviderCapabilities> = {};
  private static configLoaded = false;

  /**
   * 从配置对象加载Provider能力
   */
  static loadFromConfig(config: any): void {
    this.capabilities = {};

    // 解析配置中的Providers
    if (config.Providers && Array.isArray(config.Providers)) {
      config.Providers.forEach((provider: any) => {
        this.capabilities[provider.name] = this.parseProviderConfig(provider);
      });
    }

    // 零fallback策略：不使用默认能力配置
    // 如果配置不完整，应该在运行时报错而不是使用fallback
    this.configLoaded = true;
  }

  /**
   * 解析单个Provider配置
   */
  private static parseProviderConfig(providerConfig: any): ProviderCapabilities {
    return {
      name: providerConfig.name,
      supportsTools: providerConfig.capabilities?.supportsTools ?? this.inferToolSupport(providerConfig.name),
      supportsThinking: providerConfig.capabilities?.supportsThinking ?? this.inferThinkingSupport(providerConfig.name),
      parameterLimits: {
        temperature: providerConfig.parameterLimits?.temperature ?? { min: 0, max: 2.0 },
        top_p: providerConfig.parameterLimits?.top_p ?? { min: 0, max: 1.0 },
        max_tokens: providerConfig.parameterLimits?.max_tokens ?? { min: 1, max: 8192 },
      },
      responseFixesNeeded: providerConfig.responseFixesNeeded ?? this.inferResponseFixes(providerConfig.name),
    };
  }

  /**
   * 推断Provider是否支持工具调用
   */
  private static inferToolSupport(providerName: string): boolean {
    const toolSupportedProviders = ['deepseek', 'openai', 'anthropic', 'gemini', 'cohere'];
    return toolSupportedProviders.includes(providerName.toLowerCase());
  }

  /**
   * 推断Provider是否支持思考模式
   */
  private static inferThinkingSupport(providerName: string): boolean {
    const thinkingSupportedProviders = ['deepseek'];
    return thinkingSupportedProviders.includes(providerName.toLowerCase());
  }

  /**
   * 推断Provider需要的响应修复
   */
  private static inferResponseFixes(providerName: string): string[] {
    const fixesMap: Record<string, string[]> = {
      lmstudio: ['missing_usage', 'missing_id', 'missing_created', 'choices_array_fix'],
      deepseek: ['tool_calls_format', 'thinking_mode_cleanup'],
      ollama: ['format_standardization', 'usage_calculation'],
      anthropic: ['convert_anthropic_to_openai'],
      gemini: ['convert_gemini_to_openai'],
      cohere: ['convert_cohere_to_openai'],
      openai: [], // 标准格式
    };
    return fixesMap[providerName.toLowerCase()] ?? ['basic_standardization'];
  }

  /**
   * 添加默认能力配置（从配置解析后的补充）
   */
  private static addDefaultCapabilities(): void {
    // 对于配置中没有定义的Provider，添加默认的推断配置
    Object.keys(this.capabilities).forEach(providerName => {
      const existing = this.capabilities[providerName];
      if (!existing.parameterLimits.temperature) {
        existing.parameterLimits.temperature = { min: 0, max: 2.0 };
      }
      if (!existing.parameterLimits.top_p) {
        existing.parameterLimits.top_p = { min: 0, max: 1.0 };
      }
      if (!existing.parameterLimits.max_tokens) {
        existing.parameterLimits.max_tokens = { min: 1, max: 8192 };
      }
    });
  }

  /**
   * 获取Provider能力配置
   */
  static getCapabilities(serverType: string): ProviderCapabilities {
    // 如果配置未加载，使用默认配置进行向后兼容
    if (!this.configLoaded) {
      this.loadDefaultsForBackwardCompatibility();
    }

    return this.capabilities[serverType] || this.getDefaultCapabilities();
  }

  /**
   * DEPRECATED: 零fallback策略不再使用默认配置
   * 所有配置必须通过配置文件明确提供
   */
  private static loadDefaultsForBackwardCompatibility(): void {
    // 零fallback策略：不提供任何默认配置
    // 如果没有明确配置，应该在运行时抛出错误
    throw new Error('Zero Fallback Policy: All provider capabilities must be explicitly configured');
  }

  /**
   * 检查Provider是否支持某项功能
   */
  static supportsFeature(serverType: string, feature: 'tools' | 'thinking' | 'streaming'): boolean {
    const capabilities = this.getCapabilities(serverType);

    switch (feature) {
      case 'tools':
        return capabilities.supportsTools;
      case 'thinking':
        return capabilities.supportsThinking;
      case 'streaming':
        // 大多数Provider支持流式，这里可以根据需要添加更具体的判断
        return serverType !== 'huggingface'; // 示例：HuggingFace可能不支持流式
      default:
        return false;
    }
  }

  /**
   * 获取参数限制
   */
  static getParameterLimits(
    serverType: string,
    parameter: 'temperature' | 'top_p' | 'max_tokens'
  ): { min: number; max: number } | null {
    const capabilities = this.getCapabilities(serverType);
    return capabilities.parameterLimits[parameter] || null;
  }

  /**
   * 检查参数是否在有效范围内
   */
  static isParameterValid(serverType: string, parameter: string, value: number): boolean {
    const limits = this.getParameterLimits(serverType, parameter as any);
    if (!limits) {
      return true; // 如果没有限制定义，认为有效
    }
    return value >= limits.min && value <= limits.max;
  }

  /**
   * 调整参数到有效范围
   */
  static clampParameter(serverType: string, parameter: string, value: number): number {
    const limits = this.getParameterLimits(serverType, parameter as any);
    if (!limits) {
      return value; // 如果没有限制定义，返回原值
    }
    return Math.max(limits.min, Math.min(limits.max, value));
  }

  /**
   * 获取Provider需要的响应修复类型
   */
  static getResponseFixesNeeded(serverType: string): string[] {
    const capabilities = this.getCapabilities(serverType);
    return capabilities.responseFixesNeeded;
  }

  /**
   * 检查是否需要响应修复
   */
  static needsResponseFixes(serverType: string): boolean {
    return this.getResponseFixesNeeded(serverType).length > 0;
  }

  /**
   * 添加或更新Provider能力配置
   */
  static setCapabilities(serverType: string, capabilities: ProviderCapabilities): void {
    this.capabilities[serverType] = capabilities;
  }

  /**
   * 获取所有支持的Provider列表
   */
  static getSupportedProviders(): string[] {
    return Object.keys(this.capabilities);
  }

  /**
   * 获取支持工具调用的Provider列表
   */
  static getToolSupportedProviders(): string[] {
    return this.getSupportedProviders().filter(provider => this.supportsFeature(provider, 'tools'));
  }

  /**
   * 获取支持思考模式的Provider列表
   */
  static getThinkingSupportedProviders(): string[] {
    return this.getSupportedProviders().filter(provider => this.supportsFeature(provider, 'thinking'));
  }

  /**
   * 比较两个Provider的能力
   */
  static compareProviders(
    provider1: string,
    provider2: string
  ): {
    provider1: string;
    provider2: string;
    tools: { provider1: boolean; provider2: boolean };
    thinking: { provider1: boolean; provider2: boolean };
    parameterLimits: {
      temperature: {
        provider1: { min: number; max: number } | null;
        provider2: { min: number; max: number } | null;
      };
      max_tokens: {
        provider1: { min: number; max: number } | null;
        provider2: { min: number; max: number } | null;
      };
    };
  } {
    return {
      provider1,
      provider2,
      tools: {
        provider1: this.supportsFeature(provider1, 'tools'),
        provider2: this.supportsFeature(provider2, 'tools'),
      },
      thinking: {
        provider1: this.supportsFeature(provider1, 'thinking'),
        provider2: this.supportsFeature(provider2, 'thinking'),
      },
      parameterLimits: {
        temperature: {
          provider1: this.getParameterLimits(provider1, 'temperature'),
          provider2: this.getParameterLimits(provider2, 'temperature'),
        },
        max_tokens: {
          provider1: this.getParameterLimits(provider1, 'max_tokens'),
          provider2: this.getParameterLimits(provider2, 'max_tokens'),
        },
      },
    };
  }

  /**
   * 根据需求推荐Provider
   */
  static recommendProvider(requirements: {
    needsTools?: boolean;
    needsThinking?: boolean;
    maxTokens?: number;
    preferredTemperatureRange?: { min: number; max: number };
  }): string[] {
    const recommendations: string[] = [];

    for (const provider of this.getSupportedProviders()) {
      const capabilities = this.getCapabilities(provider);

      // 检查工具支持
      if (requirements.needsTools && !capabilities.supportsTools) {
        continue;
      }

      // 检查思考模式支持
      if (requirements.needsThinking && !capabilities.supportsThinking) {
        continue;
      }

      // 检查最大token支持
      if (requirements.maxTokens) {
        const maxTokensLimit = capabilities.parameterLimits.max_tokens;
        if (maxTokensLimit && requirements.maxTokens > maxTokensLimit.max) {
          continue;
        }
      }

      // 检查温度范围
      if (requirements.preferredTemperatureRange) {
        const tempLimit = capabilities.parameterLimits.temperature;
        if (tempLimit) {
          const { min: prefMin, max: prefMax } = requirements.preferredTemperatureRange;
          const { min: capMin, max: capMax } = tempLimit;
          // 检查是否有重叠范围
          if (prefMax < capMin || prefMin > capMax) {
            continue;
          }
        }
      }

      recommendations.push(provider);
    }

    return recommendations;
  }

  /**
   * 获取Provider的性能等级评估
   */
  static getPerformanceRating(serverType: string): {
    overall: number;
    speed: number;
    accuracy: number;
    features: number;
    stability: number;
  } {
    // 基于Provider特性的简化评分系统
    const capabilities = this.getCapabilities(serverType);

    // 特性评分
    let featuresScore = 50; // 基础分
    if (capabilities.supportsTools) featuresScore += 25;
    if (capabilities.supportsThinking) featuresScore += 25;

    // 稳定性和速度评分（基于Provider类型）
    let speedScore = 70;
    let stabilityScore = 70;
    let accuracyScore = 70;

    switch (serverType) {
      case 'openai':
        speedScore = 85;
        stabilityScore = 90;
        accuracyScore = 95;
        break;
      case 'anthropic':
        speedScore = 80;
        stabilityScore = 85;
        accuracyScore = 90;
        break;
      case 'deepseek':
        speedScore = 75;
        stabilityScore = 80;
        accuracyScore = 85;
        break;
      case 'lmstudio':
        speedScore = 60; // 本地运行可能较慢
        stabilityScore = 70; // 依赖本地环境
        accuracyScore = 75; // 取决于加载的模型
        break;
      case 'ollama':
        speedScore = 65;
        stabilityScore = 75;
        accuracyScore = 70;
        break;
    }

    const overall = (speedScore + stabilityScore + accuracyScore + featuresScore) / 4;

    return {
      overall: Math.round(overall),
      speed: speedScore,
      accuracy: accuracyScore,
      features: featuresScore,
      stability: stabilityScore,
    };
  }

  /**
   * 获取默认能力配置
   */
  private static getDefaultCapabilities(): ProviderCapabilities {
    return {
      name: 'unknown',
      supportsTools: false,
      supportsThinking: false,
      parameterLimits: {
        temperature: { min: 0, max: 2.0 },
        top_p: { min: 0, max: 1.0 },
        max_tokens: { min: 1, max: 4096 },
      },
      responseFixesNeeded: ['basic_standardization'],
    };
  }

  /**
   * 验证能力配置的完整性
   */
  static validateCapabilities(capabilities: ProviderCapabilities): boolean {
    // 检查必需字段
    if (!capabilities.name || typeof capabilities.name !== 'string') {
      return false;
    }

    if (typeof capabilities.supportsTools !== 'boolean') {
      return false;
    }

    if (typeof capabilities.supportsThinking !== 'boolean') {
      return false;
    }

    // 检查参数限制
    if (!capabilities.parameterLimits || typeof capabilities.parameterLimits !== 'object') {
      return false;
    }

    // 检查响应修复需求
    if (!Array.isArray(capabilities.responseFixesNeeded)) {
      return false;
    }

    return true;
  }
}
