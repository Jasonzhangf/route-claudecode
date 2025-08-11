/**
 * Protocol Selector
 * Router-driven protocol decision (Router → Transformer + Provider selection)
 */

import { AIRequest } from '../../types/interfaces.js';
import { SupportedFormat } from './format-converter.js';
import { StreamingConfig } from './streaming-manager.js';

export interface ProtocolDecision {
  sourceFormat: SupportedFormat;
  targetFormat: SupportedFormat;
  provider: string;
  model: string;
  streamingConfig: StreamingConfig;
  preprocessorConfig: PreprocessorConfig;
  transformerConfig: TransformerConfig;
  routingMetadata: RoutingMetadata;
}

export interface PreprocessorConfig {
  type: 'standard' | 'openai_compatible' | 'provider_specific';
  variant?: string;
  rules: PreprocessingRule[];
  enabledFeatures: string[];
}

export interface PreprocessingRule {
  name: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
}

export interface TransformerConfig {
  enableBidirectionalConversion: boolean;
  validateConversion: boolean;
  preserveMetadata: boolean;
  errorHandling: 'strict' | 'lenient' | 'fallback';
}

export interface RoutingMetadata {
  routingStrategy: string;
  priority: number;
  fallbackProviders: string[];
  loadBalancing: boolean;
  healthCheckRequired: boolean;
}

export interface ProviderCapabilities {
  supportedFormats: SupportedFormat[];
  nativeStreaming: boolean;
  toolCalling: boolean;
  multiModal: boolean;
  maxTokens: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export class ProtocolSelector {
  private providerCapabilities: Map<string, ProviderCapabilities> = new Map();
  private routingRules: Map<string, RoutingRule[]> = new Map();
  private initialized: boolean = false;

  async initialize(config: ProtocolSelectorConfig): Promise<void> {
    this.loadProviderCapabilities(config.providers);
    this.loadRoutingRules(config.routingRules);
    this.initialized = true;
    console.log('✅ ProtocolSelector initialized');
  }

  /**
   * Make protocol decision based on request and routing context
   */
  async selectProtocol(
    request: AIRequest,
    routingContext: RoutingContext
  ): Promise<ProtocolDecision> {
    if (!this.initialized) {
      throw new Error('ProtocolSelector not initialized');
    }

    console.log(`🔀 Selecting protocol for request ${request.id}`);

    // Determine source format from request
    const sourceFormat = this.detectSourceFormat(request);

    // Apply routing rules to select provider and model
    const routingDecision = await this.applyRoutingRules(request, routingContext);

    // Get provider capabilities
    const capabilities = this.providerCapabilities.get(routingDecision.provider);
    if (!capabilities) {
      throw new Error(`Unknown provider: ${routingDecision.provider}`);
    }

    // Determine target format based on provider
    const targetFormat = this.selectTargetFormat(capabilities, routingDecision.provider);

    // Configure streaming based on capabilities and request
    const streamingConfig = this.configureStreaming(request, capabilities, routingContext);

    // Configure preprocessor based on provider type
    const preprocessorConfig = this.configurePreprocessor(
      routingDecision.provider,
      targetFormat,
      routingContext
    );

    // Configure transformer
    const transformerConfig = this.configureTransformer(
      sourceFormat,
      targetFormat,
      routingContext
    );

    const decision: ProtocolDecision = {
      sourceFormat,
      targetFormat,
      provider: routingDecision.provider,
      model: routingDecision.model,
      streamingConfig,
      preprocessorConfig,
      transformerConfig,
      routingMetadata: {
        routingStrategy: routingDecision.strategy,
        priority: routingDecision.priority,
        fallbackProviders: routingDecision.fallbacks,
        loadBalancing: routingDecision.loadBalancing,
        healthCheckRequired: routingDecision.healthCheckRequired
      }
    };

    console.log(`🔀 Protocol decision: ${sourceFormat} → ${targetFormat} via ${routingDecision.provider}`);
    return decision;
  }

  /**
   * Detect source format from request
   */
  private detectSourceFormat(request: AIRequest): SupportedFormat {
    // Check request structure to determine format
    if (request.provider) {
      // Standard format has provider field
      return 'standard';
    }

    // Check for Anthropic-specific fields
    if ('max_tokens' in request && 'messages' in request) {
      return 'anthropic';
    }

    // Check for OpenAI-specific fields
    if ('model' in request && 'messages' in request && !('contents' in request)) {
      return 'openai';
    }

    // Check for Gemini-specific fields
    if ('contents' in request) {
      return 'gemini';
    }

    // Check for CodeWhisperer-specific fields
    if ('fileContext' in request) {
      return 'codewhisperer';
    }

    // Default to standard format
    return 'standard';
  }

  /**
   * Apply routing rules to select provider and model
   */
  private async applyRoutingRules(
    request: AIRequest,
    context: RoutingContext
  ): Promise<RoutingDecision> {
    const category = context.category || 'default';
    const rules = this.routingRules.get(category) || [];

    // Check if request already specifies a provider
    if (request.provider && request.provider !== 'test') {
      return {
        provider: request.provider,
        model: request.model,
        strategy: 'provider_specified',
        priority: 1,
        fallbacks: [],
        loadBalancing: false,
        healthCheckRequired: false
      };
    }

    for (const rule of rules) {
      if (await this.evaluateRule(rule, request, context)) {
        return {
          provider: rule.provider,
          model: rule.model,
          strategy: rule.strategy,
          priority: rule.priority,
          fallbacks: rule.fallbacks || [],
          loadBalancing: rule.loadBalancing || false,
          healthCheckRequired: rule.healthCheckRequired || false
        };
      }
    }

    // Default routing decision
    return {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      strategy: 'default',
      priority: 1,
      fallbacks: ['openai'],
      loadBalancing: false,
      healthCheckRequired: true
    };
  }

  /**
   * Select target format based on provider capabilities
   */
  private selectTargetFormat(
    capabilities: ProviderCapabilities,
    provider: string
  ): SupportedFormat {
    // Provider-specific format mapping
    const providerFormatMap: Record<string, SupportedFormat> = {
      'anthropic': 'anthropic',
      'openai': 'openai',
      'gemini': 'gemini',
      'codewhisperer': 'codewhisperer',
      'lmstudio': 'openai', // OpenAI-compatible
      'ollama': 'openai'    // OpenAI-compatible
    };

    return providerFormatMap[provider] || 'standard';
  }

  /**
   * Configure streaming based on capabilities and request
   */
  private configureStreaming(
    request: AIRequest,
    capabilities: ProviderCapabilities,
    context: RoutingContext
  ): StreamingConfig {
    const baseConfig = {
      mode: 'force_non_streaming' as const,
      bufferingStrategy: 'smart' as const,
      toolCallBuffering: true,
      chunkSize: 50,
      simulationDelay: 50,
      enableToolCallParsing: capabilities.toolCalling
    };

    // Override based on request preferences
    if (request.stream && capabilities.nativeStreaming) {
      baseConfig.mode = 'native_streaming';
    } else if (request.stream && !capabilities.nativeStreaming) {
      baseConfig.mode = 'simulated_streaming';
    }

    // Adjust buffering strategy based on tool calling
    if (capabilities.toolCalling && this.hasToolCalls(request)) {
      baseConfig.bufferingStrategy = 'smart';
      baseConfig.toolCallBuffering = true;
    }

    // Context-specific overrides
    if (context.streamingPreference) {
      Object.assign(baseConfig, context.streamingPreference);
    }

    return baseConfig;
  }

  /**
   * Configure preprocessor based on provider type and variant
   */
  private configurePreprocessor(
    provider: string,
    targetFormat: SupportedFormat,
    context: RoutingContext
  ): PreprocessorConfig {
    const config: PreprocessorConfig = {
      type: 'standard',
      rules: [],
      enabledFeatures: []
    };

    // Provider-specific configuration
    switch (provider) {
      case 'lmstudio':
      case 'ollama':
        config.type = 'openai_compatible';
        config.variant = provider;
        config.rules = this.getOpenAICompatibilityRules(provider);
        config.enabledFeatures = ['model_mapping', 'parameter_adjustment', 'error_handling'];
        break;

      case 'anthropic':
        config.type = 'provider_specific';
        config.rules = this.getAnthropicPreprocessingRules();
        config.enabledFeatures = ['message_formatting', 'tool_schema_conversion'];
        break;

      case 'openai':
        config.type = 'provider_specific';
        config.rules = this.getOpenAIPreprocessingRules();
        config.enabledFeatures = ['function_calling', 'streaming_optimization'];
        break;

      case 'gemini':
        config.type = 'provider_specific';
        config.rules = this.getGeminiPreprocessingRules();
        config.enabledFeatures = ['content_formatting', 'safety_settings'];
        break;

      case 'codewhisperer':
        config.type = 'provider_specific';
        config.rules = this.getCodeWhispererPreprocessingRules();
        config.enabledFeatures = ['context_extraction', 'language_detection'];
        break;

      default:
        config.type = 'standard';
    }

    return config;
  }

  /**
   * Configure transformer
   */
  private configureTransformer(
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    context: RoutingContext
  ): TransformerConfig {
    return {
      enableBidirectionalConversion: true,
      validateConversion: context.validateConversion !== false,
      preserveMetadata: true,
      errorHandling: context.errorHandling || 'strict'
    };
  }

  /**
   * Get OpenAI compatibility rules for third-party servers
   */
  private getOpenAICompatibilityRules(provider: string): PreprocessingRule[] {
    const baseRules: PreprocessingRule[] = [
      {
        name: 'model_mapping',
        condition: 'always',
        action: 'map_model_name',
        parameters: { provider }
      },
      {
        name: 'parameter_cleanup',
        condition: 'has_unsupported_params',
        action: 'remove_unsupported_parameters',
        parameters: { provider }
      }
    ];

    if (provider === 'lmstudio') {
      baseRules.push({
        name: 'lmstudio_optimization',
        condition: 'provider_is_lmstudio',
        action: 'optimize_for_local_serving',
        parameters: { 
          removeSystemMessages: false,
          adjustTemperature: true,
          maxTokensDefault: 2048
        }
      });
    }

    if (provider === 'ollama') {
      baseRules.push({
        name: 'ollama_optimization',
        condition: 'provider_is_ollama',
        action: 'optimize_for_ollama',
        parameters: {
          formatMessages: true,
          handleStreaming: true,
          adjustParameters: true
        }
      });
    }

    return baseRules;
  }

  /**
   * Get Anthropic preprocessing rules
   */
  private getAnthropicPreprocessingRules(): PreprocessingRule[] {
    return [
      {
        name: 'message_role_validation',
        condition: 'has_messages',
        action: 'validate_anthropic_roles',
        parameters: { allowedRoles: ['user', 'assistant'] }
      },
      {
        name: 'tool_schema_conversion',
        condition: 'has_tools',
        action: 'convert_to_anthropic_tools',
        parameters: { useInputSchema: true }
      },
      {
        name: 'max_tokens_requirement',
        condition: 'missing_max_tokens',
        action: 'add_max_tokens',
        parameters: { defaultValue: 4096 }
      }
    ];
  }

  /**
   * Get OpenAI preprocessing rules
   */
  private getOpenAIPreprocessingRules(): PreprocessingRule[] {
    return [
      {
        name: 'function_calling_setup',
        condition: 'has_tools',
        action: 'setup_openai_functions',
        parameters: { toolChoice: 'auto' }
      },
      {
        name: 'streaming_optimization',
        condition: 'is_streaming',
        action: 'optimize_for_streaming',
        parameters: { enableDelta: true }
      }
    ];
  }

  /**
   * Get Gemini preprocessing rules
   */
  private getGeminiPreprocessingRules(): PreprocessingRule[] {
    return [
      {
        name: 'content_formatting',
        condition: 'has_messages',
        action: 'format_gemini_contents',
        parameters: { roleMapping: { assistant: 'model' } }
      },
      {
        name: 'safety_settings',
        condition: 'always',
        action: 'apply_safety_settings',
        parameters: { 
          harmCategory: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      }
    ];
  }

  /**
   * Get CodeWhisperer preprocessing rules
   */
  private getCodeWhispererPreprocessingRules(): PreprocessingRule[] {
    return [
      {
        name: 'context_extraction',
        condition: 'has_code_context',
        action: 'extract_file_context',
        parameters: { includeLanguage: true, includeFilename: true }
      },
      {
        name: 'language_detection',
        condition: 'missing_language',
        action: 'detect_programming_language',
        parameters: { useFilename: true, useContent: true }
      }
    ];
  }

  /**
   * Evaluate routing rule
   */
  private async evaluateRule(
    rule: RoutingRule,
    request: AIRequest,
    context: RoutingContext
  ): Promise<boolean> {
    // Simple rule evaluation - in practice this would be more sophisticated
    if (rule.condition === 'always') return true;
    if (rule.condition === 'has_tools') return !!(request.tools && request.tools.length > 0);
    if (rule.condition === 'is_streaming') return !!request.stream;
    
    // Model-based routing
    if (rule.condition.startsWith('model:')) {
      const targetModel = rule.condition.split(':')[1];
      return request.model === targetModel;
    }

    // Provider-based routing
    if (rule.condition.startsWith('provider:')) {
      const targetProvider = rule.condition.split(':')[1];
      return request.provider === targetProvider;
    }

    return false;
  }

  /**
   * Check if request has tool calls
   */
  private hasToolCalls(request: AIRequest): boolean {
    return !!(request.tools && request.tools.length > 0);
  }

  /**
   * Load provider capabilities
   */
  private loadProviderCapabilities(providers: Record<string, ProviderCapabilities>): void {
    for (const [provider, capabilities] of Object.entries(providers)) {
      this.providerCapabilities.set(provider, capabilities);
    }
  }

  /**
   * Load routing rules
   */
  private loadRoutingRules(rules: Record<string, RoutingRule[]>): void {
    for (const [category, categoryRules] of Object.entries(rules)) {
      this.routingRules.set(category, categoryRules);
    }
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: string): ProviderCapabilities | undefined {
    return this.providerCapabilities.get(provider);
  }

  /**
   * Get routing rules for category
   */
  getRoutingRules(category: string): RoutingRule[] {
    return this.routingRules.get(category) || [];
  }

  async shutdown(): Promise<void> {
    this.providerCapabilities.clear();
    this.routingRules.clear();
    this.initialized = false;
    console.log('✅ ProtocolSelector shutdown completed');
  }
}

// Supporting interfaces
export interface ProtocolSelectorConfig {
  providers: Record<string, ProviderCapabilities>;
  routingRules: Record<string, RoutingRule[]>;
}

export interface RoutingContext {
  category?: string;
  priority?: number;
  streamingPreference?: Partial<StreamingConfig>;
  validateConversion?: boolean;
  errorHandling?: 'strict' | 'lenient' | 'fallback';
}

export interface RoutingRule {
  name: string;
  condition: string;
  provider: string;
  model: string;
  strategy: string;
  priority: number;
  fallbacks?: string[];
  loadBalancing?: boolean;
  healthCheckRequired?: boolean;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  strategy: string;
  priority: number;
  fallbacks: string[];
  loadBalancing: boolean;
  healthCheckRequired: boolean;
}

console.log('✅ ProtocolSelector loaded');