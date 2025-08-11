/**
 * Enhanced Converter
 * Integration layer for intelligent streaming, protocol selection, and preprocessing
 */

import { AIRequest, AIResponse } from '../../types/interfaces.js';
import { UnifiedFormatConverter, SupportedFormat } from './format-converter.js';
import { StreamingManager, StreamingConfig, StreamChunk } from './streaming-manager.js';
import { ProtocolSelector, ProtocolDecision, RoutingContext } from './protocol-selector.js';
import { PreprocessorSelector, PreprocessorConfig, PreprocessorContext } from './preprocessor-selector.js';
import { FormatValidator, ValidationResult } from './format-validator.js';

export interface EnhancedConversionConfig {
  enableIntelligentStreaming: boolean;
  enableProtocolSelection: boolean;
  enablePreprocessorSelection: boolean;
  enableValidation: boolean;
  defaultStreamingConfig: StreamingConfig;
  protocolSelector?: any;
  preprocessorSelector?: any;
}

export interface ConversionContext {
  requestId: string;
  routingContext?: RoutingContext;
  preprocessorContext?: PreprocessorContext;
  streamingPreferences?: Partial<StreamingConfig>;
  validationLevel: 'strict' | 'lenient' | 'disabled';
  enableDebugLogging: boolean;
}

export interface ConversionResult {
  convertedRequest?: any;
  convertedResponse?: AIResponse;
  protocolDecision?: ProtocolDecision;
  preprocessorConfig?: PreprocessorConfig;
  streamingConfig?: StreamingConfig;
  validationResults: ValidationResult[];
  metadata: {
    conversionTime: number;
    sourceFormat: SupportedFormat;
    targetFormat: SupportedFormat;
    streamingMode?: string;
    preprocessorProfile?: string;
    chunksProcessed?: number;
  };
}

export class EnhancedConverter {
  private formatConverter: UnifiedFormatConverter;
  private streamingManager: StreamingManager;
  private protocolSelector: ProtocolSelector;
  private preprocessorSelector: PreprocessorSelector;
  private validator: FormatValidator;
  private config: EnhancedConversionConfig;
  private initialized: boolean = false;

  constructor(config: EnhancedConversionConfig) {
    this.config = config;
    this.formatConverter = new UnifiedFormatConverter();
    this.streamingManager = new StreamingManager();
    this.protocolSelector = new ProtocolSelector();
    this.preprocessorSelector = new PreprocessorSelector();
    this.validator = new FormatValidator();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Enhanced Converter...');

    // Initialize format converter
    await this.formatConverter.initialize({
      protocolSelector: this.config.protocolSelector
    });

    // Initialize streaming manager
    if (this.config.enableIntelligentStreaming) {
      await this.streamingManager.initialize();
    }

    // Initialize protocol selector
    if (this.config.enableProtocolSelection && this.config.protocolSelector) {
      await this.protocolSelector.initialize(this.config.protocolSelector);
    }

    // Initialize preprocessor selector
    if (this.config.enablePreprocessorSelection && this.config.preprocessorSelector) {
      await this.preprocessorSelector.initialize(this.config.preprocessorSelector);
    }

    // Initialize validator
    if (this.config.enableValidation) {
      await this.validator.initialize();
    }

    this.initialized = true;
    console.log('✅ Enhanced Converter initialized');
  }

  /**
   * Convert request with enhanced features
   */
  async convertRequest(
    request: AIRequest,
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    context: ConversionContext
  ): Promise<ConversionResult> {
    if (!this.initialized) {
      throw new Error('Enhanced Converter not initialized');
    }

    const startTime = Date.now();
    const validationResults: ValidationResult[] = [];

    if (context.enableDebugLogging) {
      console.log(`🔄 Enhanced request conversion: ${sourceFormat} → ${targetFormat}`);
    }

    try {
      // Step 1: Validate source request
      if (this.config.enableValidation && context.validationLevel !== 'disabled') {
        const sourceValidation = this.validator.validateRequest(request, sourceFormat);
        validationResults.push(sourceValidation);

        if (!sourceValidation.valid && context.validationLevel === 'strict') {
          throw new Error(`Source validation failed: ${sourceValidation.errors.join(', ')}`);
        }
      }

      // Step 2: Protocol selection
      let protocolDecision: ProtocolDecision | undefined;
      if (this.config.enableProtocolSelection && context.routingContext) {
        protocolDecision = await this.protocolSelector.selectProtocol(
          request,
          context.routingContext
        );
      }

      // Step 3: Preprocessor selection
      let preprocessorConfig: PreprocessorConfig | undefined;
      if (this.config.enablePreprocessorSelection) {
        const provider = protocolDecision?.provider || request.provider || 'unknown';
        preprocessorConfig = this.preprocessorSelector.selectPreprocessor(
          provider,
          targetFormat,
          protocolDecision?.provider,
          context.preprocessorContext
        );
      }

      // Step 4: Enhanced format conversion
      const convertedRequest = await this.formatConverter.convertRequest(
        request,
        sourceFormat,
        targetFormat,
        protocolDecision
      );

      // Step 5: Validate converted request
      if (this.config.enableValidation && context.validationLevel !== 'disabled') {
        const targetValidation = this.validator.validateRequest(convertedRequest, targetFormat);
        validationResults.push(targetValidation);

        if (!targetValidation.valid && context.validationLevel === 'strict') {
          throw new Error(`Target validation failed: ${targetValidation.errors.join(', ')}`);
        }
      }

      const conversionTime = Date.now() - startTime;

      return {
        convertedRequest,
        protocolDecision,
        preprocessorConfig,
        validationResults,
        metadata: {
          conversionTime,
          sourceFormat,
          targetFormat,
          preprocessorProfile: preprocessorConfig?.type
        }
      };

    } catch (error) {
      console.error('❌ Enhanced request conversion failed:', error);
      throw error;
    }
  }

  /**
   * Convert response with enhanced streaming support
   */
  async convertResponse(
    response: any,
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    context: ConversionContext,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<ConversionResult> {
    if (!this.initialized) {
      throw new Error('Enhanced Converter not initialized');
    }

    const startTime = Date.now();
    const validationResults: ValidationResult[] = [];
    let chunksProcessed = 0;

    if (context.enableDebugLogging) {
      console.log(`🔄 Enhanced response conversion: ${sourceFormat} → ${targetFormat}`);
    }

    try {
      // Step 1: Determine streaming configuration
      let streamingConfig: StreamingConfig | undefined;
      if (this.config.enableIntelligentStreaming) {
        streamingConfig = {
          ...this.config.defaultStreamingConfig,
          ...context.streamingPreferences
        };
      }

      // Step 2: Enhanced format conversion with streaming
      const chunkHandler = onChunk ? (chunk: StreamChunk) => {
        chunksProcessed++;
        onChunk(chunk);
      } : undefined;

      const convertedResponse = await this.formatConverter.convertResponse(
        response,
        sourceFormat,
        targetFormat,
        streamingConfig,
        chunkHandler
      );

      // Step 3: Validate converted response
      if (this.config.enableValidation && context.validationLevel !== 'disabled') {
        const responseValidation = this.validator.validateResponse(convertedResponse, targetFormat);
        validationResults.push(responseValidation);

        if (!responseValidation.valid && context.validationLevel === 'strict') {
          throw new Error(`Response validation failed: ${responseValidation.errors.join(', ')}`);
        }
      }

      const conversionTime = Date.now() - startTime;

      return {
        convertedResponse,
        streamingConfig,
        validationResults,
        metadata: {
          conversionTime,
          sourceFormat,
          targetFormat,
          streamingMode: streamingConfig?.mode,
          chunksProcessed: chunksProcessed > 0 ? chunksProcessed : undefined
        }
      };

    } catch (error) {
      console.error('❌ Enhanced response conversion failed:', error);
      throw error;
    }
  }

  /**
   * Convert bidirectionally with full enhancement support
   */
  async convertBidirectional(
    request: AIRequest,
    response: any,
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    context: ConversionContext,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<{
    requestResult: ConversionResult;
    responseResult: ConversionResult;
  }> {
    if (context.enableDebugLogging) {
      console.log(`🔄 Enhanced bidirectional conversion: ${sourceFormat} ↔ ${targetFormat}`);
    }

    // Convert request
    const requestResult = await this.convertRequest(
      request,
      sourceFormat,
      targetFormat,
      context
    );

    // Convert response
    const responseResult = await this.convertResponse(
      response,
      targetFormat, // Note: response comes back in target format
      sourceFormat, // Convert back to source format
      context,
      onChunk
    );

    return {
      requestResult,
      responseResult
    };
  }

  /**
   * Create streaming context for long-running conversions
   */
  createStreamingContext(
    requestId: string,
    provider: string,
    format: SupportedFormat,
    config?: Partial<StreamingConfig>
  ): any {
    if (!this.config.enableIntelligentStreaming) {
      throw new Error('Intelligent streaming not enabled');
    }

    const streamingConfig = {
      ...this.config.defaultStreamingConfig,
      ...config
    };

    return this.streamingManager.createStreamingContext(
      requestId,
      provider,
      format,
      streamingConfig
    );
  }

  /**
   * Process streaming response with context
   */
  async processStreamingResponse(
    response: any,
    streamingContext: any,
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<AIResponse> {
    if (!this.config.enableIntelligentStreaming) {
      throw new Error('Intelligent streaming not enabled');
    }

    return await this.streamingManager.processStreamingResponse(
      response,
      streamingContext,
      onChunk
    );
  }

  /**
   * Get conversion statistics
   */
  getConversionStats(): {
    totalConversions: number;
    averageConversionTime: number;
    streamingConversions: number;
    validationFailures: number;
    supportedFormats: SupportedFormat[];
  } {
    return {
      totalConversions: 0, // Would be tracked in implementation
      averageConversionTime: 0,
      streamingConversions: 0,
      validationFailures: 0,
      supportedFormats: this.formatConverter.getSupportedFormats()
    };
  }

  /**
   * Create default enhanced conversion config
   */
  static createDefaultConfig(): EnhancedConversionConfig {
    return {
      enableIntelligentStreaming: true,
      enableProtocolSelection: true,
      enablePreprocessorSelection: true,
      enableValidation: true,
      defaultStreamingConfig: {
        mode: 'force_non_streaming',
        bufferingStrategy: 'smart',
        toolCallBuffering: true,
        chunkSize: 50,
        simulationDelay: 50,
        enableToolCallParsing: true
      },
      protocolSelector: {
        providers: {
          anthropic: {
            supportedFormats: ['anthropic'],
            nativeStreaming: true,
            toolCalling: true,
            multiModal: false,
            maxTokens: 8192,
            rateLimits: { requestsPerMinute: 60, tokensPerMinute: 100000 }
          },
          openai: {
            supportedFormats: ['openai'],
            nativeStreaming: true,
            toolCalling: true,
            multiModal: true,
            maxTokens: 4096,
            rateLimits: { requestsPerMinute: 60, tokensPerMinute: 90000 }
          },
          lmstudio: {
            supportedFormats: ['openai'],
            nativeStreaming: false,
            toolCalling: false,
            multiModal: false,
            maxTokens: 2048,
            rateLimits: { requestsPerMinute: 1000, tokensPerMinute: 1000000 }
          },
          ollama: {
            supportedFormats: ['openai'],
            nativeStreaming: true,
            toolCalling: false,
            multiModal: false,
            maxTokens: 2048,
            rateLimits: { requestsPerMinute: 1000, tokensPerMinute: 1000000 }
          }
        },
        routingRules: {
          default: [
            {
              name: 'default_anthropic',
              condition: 'always',
              provider: 'anthropic',
              model: 'claude-3-sonnet-20240229',
              strategy: 'default',
              priority: 1,
              fallbacks: ['openai'],
              loadBalancing: false,
              healthCheckRequired: true
            }
          ]
        }
      },
      preprocessorSelector: {
        profiles: PreprocessorSelector.createDefaultProfiles(),
        providerMappings: PreprocessorSelector.createDefaultProviderMappings(),
        formatMappings: PreprocessorSelector.createDefaultFormatMappings()
      }
    };
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
    details: Record<string, any>;
  }> {
    const components: Record<string, boolean> = {};
    const details: Record<string, any> = {};

    // Check format converter
    try {
      components.formatConverter = this.formatConverter.getSupportedFormats().length > 0;
      details.formatConverter = {
        supportedFormats: this.formatConverter.getSupportedFormats().length
      };
    } catch (error) {
      components.formatConverter = false;
      details.formatConverter = { error: error.message };
    }

    // Check streaming manager
    if (this.config.enableIntelligentStreaming) {
      try {
        const testConfig = this.streamingManager.getDefaultStreamingConfig();
        components.streamingManager = !!testConfig;
        details.streamingManager = { defaultConfig: testConfig };
      } catch (error) {
        components.streamingManager = false;
        details.streamingManager = { error: error.message };
      }
    }

    // Check protocol selector
    if (this.config.enableProtocolSelection) {
      try {
        const capabilities = this.protocolSelector.getProviderCapabilities('anthropic');
        components.protocolSelector = !!capabilities;
        details.protocolSelector = { hasCapabilities: !!capabilities };
      } catch (error) {
        components.protocolSelector = false;
        details.protocolSelector = { error: error.message };
      }
    }

    // Check preprocessor selector
    if (this.config.enablePreprocessorSelection) {
      try {
        const profiles = this.preprocessorSelector.getAvailableProfiles();
        components.preprocessorSelector = profiles.length > 0;
        details.preprocessorSelector = { profileCount: profiles.length };
      } catch (error) {
        components.preprocessorSelector = false;
        details.preprocessorSelector = { error: error.message };
      }
    }

    const healthy = Object.values(components).every(status => status);

    return {
      healthy,
      components,
      details
    };
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Enhanced Converter...');

    await this.formatConverter.shutdown();
    
    if (this.config.enableIntelligentStreaming) {
      await this.streamingManager.shutdown();
    }
    
    if (this.config.enableProtocolSelection) {
      await this.protocolSelector.shutdown();
    }
    
    if (this.config.enablePreprocessorSelection) {
      await this.preprocessorSelector.shutdown();
    }
    
    if (this.config.enableValidation) {
      await this.validator.shutdown();
    }

    this.initialized = false;
    console.log('✅ Enhanced Converter shutdown completed');
  }
}

console.log('✅ Enhanced Converter loaded');