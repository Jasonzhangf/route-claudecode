/**
 * Preprocessor Selector
 * Configuration-driven preprocessor selection based on provider type and variant
 */

import { AIRequest } from '../../types/interfaces.js';
import { SupportedFormat } from './format-converter.js';

export interface PreprocessorRule {
  name: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
  priority: number;
  enabled: boolean;
}

export interface PreprocessorConfig {
  type: 'standard' | 'openai_compatible' | 'provider_specific';
  variant?: string;
  rules: PreprocessorRule[];
  enabledFeatures: string[];
  globalSettings: Record<string, any>;
}

export interface PreprocessorProfile {
  name: string;
  description: string;
  applicableProviders: string[];
  applicableFormats: SupportedFormat[];
  config: PreprocessorConfig;
  metadata: {
    version: string;
    author: string;
    lastUpdated: Date;
  };
}

export class PreprocessorSelector {
  private profiles: Map<string, PreprocessorProfile> = new Map();
  private providerMappings: Map<string, string> = new Map();
  private formatMappings: Map<SupportedFormat, string[]> = new Map();
  private initialized: boolean = false;

  async initialize(config: PreprocessorSelectorConfig): Promise<void> {
    this.loadPreprocessorProfiles(config.profiles);
    this.loadProviderMappings(config.providerMappings);
    this.loadFormatMappings(config.formatMappings);
    this.initialized = true;
    console.log('✅ PreprocessorSelector initialized');
  }

  /**
   * Select preprocessor configuration based on provider type and variant
   */
  selectPreprocessor(
    provider: string,
    format: SupportedFormat,
    variant?: string,
    context?: PreprocessorContext
  ): PreprocessorConfig {
    if (!this.initialized) {
      throw new Error('PreprocessorSelector not initialized');
    }

    console.log(`🔧 Selecting preprocessor for ${provider} (${format}${variant ? `, variant: ${variant}` : ''})`);

    // Try to find specific profile for provider + variant
    let profileName = this.findProfileName(provider, format, variant);
    
    if (!profileName) {
      // Fallback to provider-only mapping
      profileName = this.providerMappings.get(provider);
    }

    if (!profileName) {
      // Fallback to format-based mapping
      const formatProfiles = this.formatMappings.get(format);
      profileName = formatProfiles?.[0];
    }

    if (!profileName) {
      // Ultimate fallback to standard profile
      profileName = 'standard';
    }

    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`Preprocessor profile not found: ${profileName}`);
    }

    // Apply context-specific customizations
    const customizedConfig = this.customizeConfig(profile.config, context);

    console.log(`🔧 Selected preprocessor profile: ${profileName}`);
    return customizedConfig;
  }

  /**
   * Find specific profile name for provider, format, and variant combination
   */
  private findProfileName(
    provider: string,
    format: SupportedFormat,
    variant?: string
  ): string | undefined {
    // Try provider + variant combination first
    if (variant) {
      const variantKey = `${provider}_${variant}`;
      if (this.providerMappings.has(variantKey)) {
        return this.providerMappings.get(variantKey);
      }
    }

    // Try provider + format combination
    const formatKey = `${provider}_${format}`;
    if (this.providerMappings.has(formatKey)) {
      return this.providerMappings.get(formatKey);
    }

    return undefined;
  }

  /**
   * Customize configuration based on context
   */
  private customizeConfig(
    baseConfig: PreprocessorConfig,
    context?: PreprocessorContext
  ): PreprocessorConfig {
    if (!context) {
      return { ...baseConfig };
    }

    const customizedConfig: PreprocessorConfig = {
      ...baseConfig,
      rules: [...baseConfig.rules],
      enabledFeatures: [...baseConfig.enabledFeatures],
      globalSettings: { ...baseConfig.globalSettings }
    };

    // Apply context-specific rule modifications
    if (context.disabledRules) {
      customizedConfig.rules = customizedConfig.rules.map(rule => ({
        ...rule,
        enabled: context.disabledRules!.includes(rule.name) ? false : rule.enabled
      }));
    }

    if (context.enabledRules) {
      customizedConfig.rules = customizedConfig.rules.map(rule => ({
        ...rule,
        enabled: context.enabledRules!.includes(rule.name) ? true : rule.enabled
      }));
    }

    // Apply feature toggles
    if (context.disabledFeatures) {
      customizedConfig.enabledFeatures = customizedConfig.enabledFeatures.filter(
        feature => !context.disabledFeatures!.includes(feature)
      );
    }

    if (context.enabledFeatures) {
      customizedConfig.enabledFeatures = [
        ...new Set([...customizedConfig.enabledFeatures, ...context.enabledFeatures])
      ];
    }

    // Apply global setting overrides
    if (context.globalSettingOverrides) {
      Object.assign(customizedConfig.globalSettings, context.globalSettingOverrides);
    }

    // Apply priority adjustments
    if (context.rulePriorityAdjustments) {
      customizedConfig.rules = customizedConfig.rules.map(rule => ({
        ...rule,
        priority: context.rulePriorityAdjustments![rule.name] ?? rule.priority
      }));
    }

    // Sort rules by priority
    customizedConfig.rules.sort((a, b) => b.priority - a.priority);

    return customizedConfig;
  }

  /**
   * Get available preprocessor profiles
   */
  getAvailableProfiles(): PreprocessorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile by name
   */
  getProfile(name: string): PreprocessorProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Register new preprocessor profile
   */
  registerProfile(profile: PreprocessorProfile): void {
    if (!this.initialized) {
      throw new Error('PreprocessorSelector not initialized');
    }

    this.profiles.set(profile.name, profile);
    console.log(`✅ Preprocessor profile '${profile.name}' registered`);
  }

  /**
   * Update provider mapping
   */
  updateProviderMapping(provider: string, profileName: string): void {
    this.providerMappings.set(provider, profileName);
    console.log(`✅ Provider mapping updated: ${provider} → ${profileName}`);
  }

  /**
   * Validate preprocessor configuration
   */
  validateConfig(config: PreprocessorConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate type
    if (!['standard', 'openai_compatible', 'provider_specific'].includes(config.type)) {
      errors.push(`Invalid preprocessor type: ${config.type}`);
    }

    // Validate rules
    for (const rule of config.rules) {
      if (!rule.name) {
        errors.push('Rule missing name');
      }
      if (!rule.condition) {
        errors.push(`Rule '${rule.name}' missing condition`);
      }
      if (!rule.action) {
        errors.push(`Rule '${rule.name}' missing action`);
      }
      if (typeof rule.priority !== 'number') {
        warnings.push(`Rule '${rule.name}' has invalid priority, using default`);
      }
    }

    // Validate enabled features
    if (!Array.isArray(config.enabledFeatures)) {
      errors.push('enabledFeatures must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load preprocessor profiles from configuration
   */
  private loadPreprocessorProfiles(profiles: Record<string, PreprocessorProfile>): void {
    for (const [name, profile] of Object.entries(profiles)) {
      this.profiles.set(name, profile);
    }
    console.log(`✅ Loaded ${this.profiles.size} preprocessor profiles`);
  }

  /**
   * Load provider mappings from configuration
   */
  private loadProviderMappings(mappings: Record<string, string>): void {
    for (const [provider, profileName] of Object.entries(mappings)) {
      this.providerMappings.set(provider, profileName);
    }
    console.log(`✅ Loaded ${this.providerMappings.size} provider mappings`);
  }

  /**
   * Load format mappings from configuration
   */
  private loadFormatMappings(mappings: Record<SupportedFormat, string[]>): void {
    for (const [format, profileNames] of Object.entries(mappings)) {
      this.formatMappings.set(format as SupportedFormat, profileNames);
    }
    console.log(`✅ Loaded ${this.formatMappings.size} format mappings`);
  }

  /**
   * Create default preprocessor profiles
   */
  static createDefaultProfiles(): Record<string, PreprocessorProfile> {
    return {
      standard: {
        name: 'standard',
        description: 'Standard preprocessor for generic requests',
        applicableProviders: ['*'],
        applicableFormats: ['standard'],
        config: {
          type: 'standard',
          rules: [
            {
              name: 'validate_request',
              condition: 'always',
              action: 'validate_basic_structure',
              parameters: {},
              priority: 100,
              enabled: true
            }
          ],
          enabledFeatures: ['validation'],
          globalSettings: {}
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          lastUpdated: new Date()
        }
      },

      anthropic_standard: {
        name: 'anthropic_standard',
        description: 'Standard preprocessor for Anthropic Claude',
        applicableProviders: ['anthropic'],
        applicableFormats: ['anthropic'],
        config: {
          type: 'provider_specific',
          rules: [
            {
              name: 'validate_anthropic_roles',
              condition: 'has_messages',
              action: 'validate_anthropic_roles',
              parameters: { allowedRoles: ['user', 'assistant'] },
              priority: 90,
              enabled: true
            },
            {
              name: 'add_max_tokens',
              condition: 'missing_max_tokens',
              action: 'add_max_tokens',
              parameters: { defaultValue: 4096 },
              priority: 80,
              enabled: true
            },
            {
              name: 'convert_tools',
              condition: 'has_tools',
              action: 'convert_to_anthropic_tools',
              parameters: { useInputSchema: true },
              priority: 70,
              enabled: true
            }
          ],
          enabledFeatures: ['message_formatting', 'tool_schema_conversion', 'token_management'],
          globalSettings: {
            defaultMaxTokens: 4096,
            strictRoleValidation: true
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          lastUpdated: new Date()
        }
      },

      openai_standard: {
        name: 'openai_standard',
        description: 'Standard preprocessor for OpenAI GPT models',
        applicableProviders: ['openai'],
        applicableFormats: ['openai'],
        config: {
          type: 'provider_specific',
          rules: [
            {
              name: 'setup_function_calling',
              condition: 'has_tools',
              action: 'setup_openai_functions',
              parameters: { toolChoice: 'auto' },
              priority: 90,
              enabled: true
            },
            {
              name: 'optimize_streaming',
              condition: 'is_streaming',
              action: 'optimize_for_streaming',
              parameters: { enableDelta: true },
              priority: 80,
              enabled: true
            }
          ],
          enabledFeatures: ['function_calling', 'streaming_optimization'],
          globalSettings: {
            defaultToolChoice: 'auto',
            streamingOptimization: true
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          lastUpdated: new Date()
        }
      },

      lmstudio_compatible: {
        name: 'lmstudio_compatible',
        description: 'OpenAI-compatible preprocessor for LMStudio',
        applicableProviders: ['lmstudio'],
        applicableFormats: ['openai'],
        config: {
          type: 'openai_compatible',
          variant: 'lmstudio',
          rules: [
            {
              name: 'map_model_name',
              condition: 'always',
              action: 'map_model_name',
              parameters: { provider: 'lmstudio' },
              priority: 100,
              enabled: true
            },
            {
              name: 'remove_unsupported_params',
              condition: 'has_unsupported_params',
              action: 'remove_unsupported_parameters',
              parameters: { 
                provider: 'lmstudio',
                unsupportedParams: ['tools', 'tool_choice', 'response_format']
              },
              priority: 90,
              enabled: true
            },
            {
              name: 'optimize_for_local',
              condition: 'always',
              action: 'optimize_for_local_serving',
              parameters: {
                adjustTemperature: true,
                maxTokensDefault: 2048,
                removeSystemMessages: false
              },
              priority: 80,
              enabled: true
            }
          ],
          enabledFeatures: ['model_mapping', 'parameter_cleanup', 'local_optimization'],
          globalSettings: {
            localServing: true,
            defaultMaxTokens: 2048,
            temperatureAdjustment: 0.7
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          lastUpdated: new Date()
        }
      },

      ollama_compatible: {
        name: 'ollama_compatible',
        description: 'OpenAI-compatible preprocessor for Ollama',
        applicableProviders: ['ollama'],
        applicableFormats: ['openai'],
        config: {
          type: 'openai_compatible',
          variant: 'ollama',
          rules: [
            {
              name: 'map_model_name',
              condition: 'always',
              action: 'map_model_name',
              parameters: { provider: 'ollama' },
              priority: 100,
              enabled: true
            },
            {
              name: 'format_messages',
              condition: 'has_messages',
              action: 'format_ollama_messages',
              parameters: { ensureStringContent: true },
              priority: 90,
              enabled: true
            },
            {
              name: 'remove_unsupported_params',
              condition: 'has_unsupported_params',
              action: 'remove_unsupported_parameters',
              parameters: {
                provider: 'ollama',
                unsupportedParams: ['tools', 'tool_choice', 'functions', 'function_call']
              },
              priority: 80,
              enabled: true
            }
          ],
          enabledFeatures: ['model_mapping', 'message_formatting', 'parameter_cleanup'],
          globalSettings: {
            localServing: true,
            messageFormatting: true
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          lastUpdated: new Date()
        }
      }
    };
  }

  /**
   * Create default provider mappings
   */
  static createDefaultProviderMappings(): Record<string, string> {
    return {
      'anthropic': 'anthropic_standard',
      'openai': 'openai_standard',
      'lmstudio': 'lmstudio_compatible',
      'ollama': 'ollama_compatible',
      'gemini': 'standard',
      'codewhisperer': 'standard'
    };
  }

  /**
   * Create default format mappings
   */
  static createDefaultFormatMappings(): Record<SupportedFormat, string[]> {
    return {
      'standard': ['standard'],
      'anthropic': ['anthropic_standard'],
      'openai': ['openai_standard', 'lmstudio_compatible', 'ollama_compatible'],
      'gemini': ['standard'],
      'codewhisperer': ['standard']
    };
  }

  async shutdown(): Promise<void> {
    this.profiles.clear();
    this.providerMappings.clear();
    this.formatMappings.clear();
    this.initialized = false;
    console.log('✅ PreprocessorSelector shutdown completed');
  }
}

// Supporting interfaces
export interface PreprocessorSelectorConfig {
  profiles: Record<string, PreprocessorProfile>;
  providerMappings: Record<string, string>;
  formatMappings: Record<SupportedFormat, string[]>;
}

export interface PreprocessorContext {
  disabledRules?: string[];
  enabledRules?: string[];
  disabledFeatures?: string[];
  enabledFeatures?: string[];
  globalSettingOverrides?: Record<string, any>;
  rulePriorityAdjustments?: Record<string, number>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

console.log('✅ PreprocessorSelector loaded');