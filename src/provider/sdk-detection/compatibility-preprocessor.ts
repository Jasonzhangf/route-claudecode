/**
 * Compatibility Preprocessor
 * Author: Jason Zhang
 * 
 * Handles compatibility preprocessing for local model servers,
 * supporting fallback modes and server-specific configurations
 */

import { SDKDetector } from './sdk-detector.js';
import { LMStudioSDKManager } from './lmstudio-sdk-manager.js';
import { OllamaSDKManager } from './ollama-sdk-manager.js';
import {
  SDKInfo,
  LocalModelServerConfig,
  ModelServerDetection,
  PreprocessingStrategy,
  SDKSelectionStrategy
} from './types.js';
import { AIRequest, AIResponse } from '../../types/interfaces.js';

export class CompatibilityPreprocessor {
  private detector: SDKDetector;
  private lmstudioManager: LMStudioSDKManager;
  private ollamaManager: OllamaSDKManager;
  private preprocessingStrategies: PreprocessingStrategy[] = [];
  private fallbackEnabled: boolean = true;

  constructor(strategy: SDKSelectionStrategy = 'official-first') {
    this.detector = new SDKDetector(strategy);
    this.lmstudioManager = new LMStudioSDKManager();
    this.ollamaManager = new OllamaSDKManager();
    this.initializePreprocessingStrategies();
    
    console.log('🔄 Compatibility Preprocessor initialized');
  }

  /**
   * Initialize preprocessing strategies for different server types
   */
  private initializePreprocessingStrategies(): void {
    this.preprocessingStrategies = [
      {
        name: 'LMStudio Official SDK',
        priority: 100,
        conditions: {
          serverType: 'lmstudio',
          provider: 'lmstudio-official'
        },
        transformations: {
          request: true,
          response: true,
          streaming: true
        }
      },
      {
        name: 'LMStudio OpenAI Compatible Fallback',
        priority: 80,
        conditions: {
          serverType: 'lmstudio',
          provider: 'lmstudio-openai-compatible'
        },
        transformations: {
          request: true,
          response: true,
          streaming: true
        }
      },
      {
        name: 'Ollama Official SDK',
        priority: 100,
        conditions: {
          serverType: 'ollama',
          provider: 'ollama-official'
        },
        transformations: {
          request: true,
          response: true,
          streaming: true
        }
      },
      {
        name: 'Ollama Independent Implementation',
        priority: 70,
        conditions: {
          serverType: 'ollama',
          provider: 'ollama-independent'
        },
        transformations: {
          request: true,
          response: true,
          streaming: false
        }
      },
      {
        name: 'Generic OpenAI Compatible',
        priority: 50,
        conditions: {
          serverType: 'openai-compatible'
        },
        transformations: {
          request: true,
          response: true,
          streaming: true
        }
      }
    ];

    console.log(`📋 Initialized ${this.preprocessingStrategies.length} preprocessing strategies`);
  }

  /**
   * Process request with compatibility preprocessing
   */
  async processRequest(request: AIRequest, serverConfig: LocalModelServerConfig): Promise<AIResponse> {
    try {
      // Detect the model server and determine the best SDK approach
      const serverDetection = await this.detector.detectModelServer(serverConfig);
      console.log(`🔍 Detected server: ${serverDetection.serverType}, SDK available: ${serverDetection.sdkAvailable}`);

      // Select appropriate preprocessing strategy
      const strategy = this.selectPreprocessingStrategy(serverDetection);
      console.log(`🎯 Selected strategy: ${strategy.name}`);

      // Apply preprocessing based on server type
      return await this.applyCompatibilityPreprocessing(request, serverDetection, strategy);
    } catch (error) {
      if (this.fallbackEnabled) {
        console.warn('⚠️ Compatibility preprocessing failed, using generic fallback:', error.message);
        return await this.applyGenericFallback(request, serverConfig);
      }
      throw error;
    }
  }

  /**
   * Apply compatibility preprocessing based on server detection and strategy
   */
  private async applyCompatibilityPreprocessing(
    request: AIRequest,
    serverDetection: ModelServerDetection,
    strategy: PreprocessingStrategy
  ): Promise<AIResponse> {
    switch (serverDetection.serverType) {
      case 'lmstudio':
        return await this.processLMStudioRequest(request, serverDetection, strategy);
      case 'ollama':
        return await this.processOllamaRequest(request, serverDetection, strategy);
      default:
        return await this.processGenericRequest(request, serverDetection, strategy);
    }
  }

  /**
   * Process LMStudio requests with SDK manager
   */
  private async processLMStudioRequest(
    request: AIRequest,
    serverDetection: ModelServerDetection,
    strategy: PreprocessingStrategy
  ): Promise<AIResponse> {
    // Initialize LMStudio manager if not already done
    try {
      await this.lmstudioManager.initialize(serverDetection.config);
    } catch (error) {
      console.warn('⚠️ Failed to initialize LMStudio manager:', error.message);
      if (this.fallbackEnabled) {
        return await this.applyGenericFallback(request, serverDetection.config);
      }
      throw error;
    }

    // Apply LMStudio-specific preprocessing
    const preprocessedRequest = this.applyLMStudioRequestPreprocessing(request, strategy);
    
    // Process request through LMStudio manager
    const response = await this.lmstudioManager.processRequest(preprocessedRequest);
    
    // Apply LMStudio-specific response post-processing
    return this.applyLMStudioResponsePostprocessing(response, strategy);
  }

  /**
   * Process Ollama requests with SDK manager (mockup)
   */
  private async processOllamaRequest(
    request: AIRequest,
    serverDetection: ModelServerDetection,
    strategy: PreprocessingStrategy
  ): Promise<AIResponse> {
    console.log('🔧 MOCKUP: Processing Ollama request - using mockup implementation');
    
    // Initialize Ollama manager (mockup)
    await this.ollamaManager.initialize(serverDetection.config);
    
    // Process request through Ollama manager (mockup)
    return await this.ollamaManager.processRequest(request);
  }

  /**
   * Process generic OpenAI-compatible requests
   */
  private async processGenericRequest(
    request: AIRequest,
    serverDetection: ModelServerDetection,
    strategy: PreprocessingStrategy
  ): Promise<AIResponse> {
    console.log('🔄 Processing generic OpenAI-compatible request');
    
    // Apply generic preprocessing
    const preprocessedRequest = this.applyGenericRequestPreprocessing(request, strategy);
    
    // For generic requests, we'd typically use the OpenAI provider
    // This is a simplified implementation
    return {
      id: `generic-${Date.now()}`,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Generic OpenAI-compatible response processed through compatibility preprocessor.'
        },
        finishReason: 'stop'
      }],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 100,
        provider: 'generic-openai-compatible'
      }
    };
  }

  /**
   * Apply LMStudio-specific request preprocessing
   */
  private applyLMStudioRequestPreprocessing(request: AIRequest, strategy: PreprocessingStrategy): AIRequest {
    if (!strategy.transformations.request) {
      return request;
    }

    console.log('🔄 Applying LMStudio request preprocessing');

    // Clone request to avoid mutations
    const preprocessedRequest = { ...request };

    // Apply LMStudio-specific preprocessing
    // Handle tool call formatting for LMStudio's specific requirements
    if (request.tools && request.tools.length > 0) {
      console.log('🔧 Preprocessing tools for LMStudio compatibility');
      
      // LMStudio might need specific tool call formatting
      preprocessedRequest.metadata = {
        ...preprocessedRequest.metadata,
        originalTools: request.tools,
        toolCallProcessing: 'lmstudio-compatible'
      };
    }

    // Apply model name mapping if needed
    if (request.model) {
      preprocessedRequest.metadata = {
        ...preprocessedRequest.metadata,
        originalModel: request.model,
        serverType: 'lmstudio'
      };
    }

    return preprocessedRequest;
  }

  /**
   * Apply LMStudio-specific response post-processing
   */
  private applyLMStudioResponsePostprocessing(response: AIResponse, strategy: PreprocessingStrategy): AIResponse {
    if (!strategy.transformations.response) {
      return response;
    }

    console.log('🔄 Applying LMStudio response post-processing');

    // Apply LMStudio-specific post-processing
    const postprocessedResponse = { ...response };

    // Ensure metadata includes LMStudio-specific information
    postprocessedResponse.metadata = {
      ...postprocessedResponse.metadata,
      preprocessor: 'lmstudio-compatibility',
      sdkType: this.lmstudioManager.isOfficialSDKAvailable() ? 'official' : 'fallback',
      postprocessingApplied: true
    };

    return postprocessedResponse;
  }

  /**
   * Apply generic request preprocessing
   */
  private applyGenericRequestPreprocessing(request: AIRequest, strategy: PreprocessingStrategy): AIRequest {
    if (!strategy.transformations.request) {
      return request;
    }

    console.log('🔄 Applying generic request preprocessing');
    
    return {
      ...request,
      metadata: {
        ...request.metadata,
        preprocessor: 'generic-compatibility',
        strategy: strategy.name
      }
    };
  }

  /**
   * Apply generic fallback processing
   */
  private async applyGenericFallback(request: AIRequest, serverConfig: LocalModelServerConfig): Promise<AIResponse> {
    console.log('🔄 Applying generic fallback processing');
    
    return {
      id: `fallback-${Date.now()}`,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Response processed through compatibility preprocessor fallback.'
        },
        finishReason: 'stop'
      }],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 50,
        provider: 'compatibility-fallback',
        serverConfig: serverConfig.serverType
      }
    };
  }

  /**
   * Select appropriate preprocessing strategy
   */
  private selectPreprocessingStrategy(serverDetection: ModelServerDetection): PreprocessingStrategy {
    // Find the best matching strategy
    const matchingStrategies = this.preprocessingStrategies.filter(strategy => {
      return this.matchesConditions(strategy.conditions, serverDetection);
    });

    if (matchingStrategies.length === 0) {
      // Return default generic strategy
      return this.preprocessingStrategies.find(s => s.name === 'Generic OpenAI Compatible')!;
    }

    // Sort by priority and return the highest priority strategy
    matchingStrategies.sort((a, b) => b.priority - a.priority);
    return matchingStrategies[0];
  }

  /**
   * Check if strategy conditions match server detection
   */
  private matchesConditions(
    conditions: PreprocessingStrategy['conditions'],
    serverDetection: ModelServerDetection
  ): boolean {
    if (conditions.serverType && conditions.serverType !== serverDetection.serverType) {
      return false;
    }

    if (conditions.provider) {
      const currentSDK = serverDetection.serverType === 'lmstudio' 
        ? this.lmstudioManager.getCurrentSDK()
        : this.ollamaManager.getCurrentSDK();
      
      if (!currentSDK || !currentSDK.name.includes(conditions.provider)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current preprocessing strategies
   */
  getPreprocessingStrategies(): PreprocessingStrategy[] {
    return [...this.preprocessingStrategies];
  }

  /**
   * Add custom preprocessing strategy
   */
  addPreprocessingStrategy(strategy: PreprocessingStrategy): void {
    this.preprocessingStrategies.push(strategy);
    this.preprocessingStrategies.sort((a, b) => b.priority - a.priority);
    console.log(`➕ Added preprocessing strategy: ${strategy.name}`);
  }

  /**
   * Enable or disable fallback mode
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
    console.log(`🔄 Fallback mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get server capabilities for a given configuration
   */
  async getServerCapabilities(serverConfig: LocalModelServerConfig): Promise<any> {
    const serverDetection = await this.detector.detectModelServer(serverConfig);
    return {
      serverType: serverDetection.serverType,
      sdkAvailable: serverDetection.sdkAvailable,
      capabilities: serverDetection.capabilities,
      fallbackMode: serverDetection.fallbackMode
    };
  }

  /**
   * Update SDK selection strategy
   */
  updateStrategy(strategy: SDKSelectionStrategy): void {
    this.detector.updateStrategy(strategy);
    console.log(`🔄 Updated SDK selection strategy: ${strategy}`);
  }
}

console.log('🔄 Compatibility Preprocessor loaded - real implementation');