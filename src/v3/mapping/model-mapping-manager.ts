/**
 * Independent Model Mapping Manager
 * Handles model discovery, routing, and capability mapping
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ModelInfo {
  name: string;
  protocol: string;
  endpoint: string;
  maxTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  supportedFeatures: string[];
  metadata?: Record<string, any>;
}

export interface ProviderEndpoint {
  baseUrl: string;
  authType: string;
  supportedProtocols: string[];
  region?: string;
  note?: string;
}

export interface RoutingStrategy {
  description: string;
  priorityFactors: string[];
}

export interface CategoryMapping {
  preferredModels: string[];
  strategy: string;
  fallbackModels: string[];
}

export interface ModelMappingConfig {
  modelMappings: Record<string, any>;
  providerEndpoints: Record<string, ProviderEndpoint>;
  routingStrategies: Record<string, RoutingStrategy>;
  categoryMappings: Record<string, CategoryMapping>;
  metadata: {
    lastUpdated: string;
    version: string;
    description: string;
    author: string;
  };
}

export class ModelMappingManager {
  private config: ModelMappingConfig | null = null;
  private modelRegistry: Map<string, ModelInfo> = new Map();
  private protocolModels: Map<string, string[]> = new Map();
  private endpointRegistry: Map<string, ProviderEndpoint> = new Map();

  constructor() {
    console.log('📋 Independent Model Mapping Manager initialized');
    this.loadConfiguration();
  }

  /**
   * Load model mapping configuration
   */
  private loadConfiguration(): void {
    try {
      const configPath = path.join(__dirname, '../../../config/model-mapping.json');
      const configContent = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configContent);
      
      this.buildModelRegistry();
      this.buildEndpointRegistry();
      
      console.log('✅ Model mapping configuration loaded', {
        models: this.modelRegistry.size,
        protocols: this.protocolModels.size,
        endpoints: this.endpointRegistry.size,
        version: this.config!.metadata.version
      });
    } catch (error) {
      console.error('❌ Failed to load model mapping configuration:', error);
      this.initializeDefaultConfiguration();
    }
  }

  /**
   * Build model registry from configuration
   */
  private buildModelRegistry(): void {
    if (!this.config) return;

    this.modelRegistry.clear();
    this.protocolModels.clear();

    for (const [protocol, protocolConfig] of Object.entries(this.config.modelMappings)) {
      const models: string[] = [];
      
      for (const [modelName, modelConfig] of Object.entries(protocolConfig.models)) {
        const modelInfo: ModelInfo = {
          name: modelName,
          protocol: protocolConfig.protocol,
          endpoint: (modelConfig as any).endpoint,
          maxTokens: (modelConfig as any).maxTokens,
          costPerInputToken: (modelConfig as any).costPerInputToken,
          costPerOutputToken: (modelConfig as any).costPerOutputToken,
          supportedFeatures: (modelConfig as any).supportedFeatures || [],
          metadata: {
            note: (modelConfig as any).note,
            profileArn: (modelConfig as any).profileArn,
            awsRegion: (modelConfig as any).awsRegion
          }
        };

        this.modelRegistry.set(modelName, modelInfo);
        models.push(modelName);
      }

      this.protocolModels.set(protocol, models);
    }

    console.log(`📊 Built model registry: ${this.modelRegistry.size} models across ${this.protocolModels.size} protocols`);
  }

  /**
   * Build endpoint registry from configuration
   */
  private buildEndpointRegistry(): void {
    if (!this.config) return;

    this.endpointRegistry.clear();

    for (const [endpointId, endpointConfig] of Object.entries(this.config.providerEndpoints)) {
      this.endpointRegistry.set(endpointId, endpointConfig);
    }

    console.log(`🌐 Built endpoint registry: ${this.endpointRegistry.size} endpoints`);
  }

  /**
   * Get model information
   */
  getModel(modelName: string): ModelInfo | null {
    return this.modelRegistry.get(modelName) || null;
  }

  /**
   * Get models by protocol
   */
  getModelsByProtocol(protocol: string): string[] {
    return this.protocolModels.get(protocol) || [];
  }

  /**
   * Get models by feature support
   */
  getModelsByFeature(feature: string): ModelInfo[] {
    return Array.from(this.modelRegistry.values())
      .filter(model => model.supportedFeatures.includes(feature));
  }

  /**
   * Get endpoint information
   */
  getEndpoint(endpointId: string): ProviderEndpoint | null {
    return this.endpointRegistry.get(endpointId) || null;
  }

  /**
   * Find best model for category
   */
  findBestModel(category: string, requirements?: {
    features?: string[];
    maxCost?: number;
    minTokens?: number;
    protocol?: string;
  }): ModelInfo | null {
    if (!this.config) return null;

    const categoryMapping = this.config.categoryMappings[category];
    if (!categoryMapping) {
      console.warn(`No mapping found for category: ${category}`);
      return null;
    }

    const strategy = this.config.routingStrategies[categoryMapping.strategy];
    if (!strategy) {
      console.warn(`No strategy found: ${categoryMapping.strategy}`);
      return null;
    }

    // Try preferred models first
    for (const modelName of categoryMapping.preferredModels) {
      const model = this.getModel(modelName);
      if (model && this.meetsRequirements(model, requirements)) {
        console.log(`🎯 Selected preferred model: ${modelName} for category ${category}`);
        return model;
      }
    }

    // Try fallback models
    for (const modelName of categoryMapping.fallbackModels) {
      const model = this.getModel(modelName);
      if (model && this.meetsRequirements(model, requirements)) {
        console.log(`🔄 Selected fallback model: ${modelName} for category ${category}`);
        return model;
      }
    }

    console.warn(`No suitable model found for category: ${category}`);
    return null;
  }

  /**
   * Check if model meets requirements
   */
  private meetsRequirements(model: ModelInfo, requirements?: {
    features?: string[];
    maxCost?: number;
    minTokens?: number;
    protocol?: string;
  }): boolean {
    if (!requirements) return true;

    // Check protocol requirement
    if (requirements.protocol && model.protocol !== requirements.protocol) {
      return false;
    }

    // Check feature requirements
    if (requirements.features) {
      for (const feature of requirements.features) {
        if (!model.supportedFeatures.includes(feature)) {
          return false;
        }
      }
    }

    // Check cost requirement
    if (requirements.maxCost && model.costPerOutputToken > requirements.maxCost) {
      return false;
    }

    // Check token requirement
    if (requirements.minTokens && model.maxTokens < requirements.minTokens) {
      return false;
    }

    return true;
  }

  /**
   * Get model routing suggestions
   */
  getRoutingSuggestions(category: string, currentLoad?: Record<string, number>): {
    primary: ModelInfo | null;
    alternatives: ModelInfo[];
    strategy: string;
  } {
    if (!this.config) {
      return { primary: null, alternatives: [], strategy: 'unknown' };
    }

    const categoryMapping = this.config.categoryMappings[category];
    if (!categoryMapping) {
      return { primary: null, alternatives: [], strategy: 'unknown' };
    }

    const primary = this.findBestModel(category);
    const alternatives: ModelInfo[] = [];

    // Collect all alternative models
    const allCandidates = [...categoryMapping.preferredModels, ...categoryMapping.fallbackModels];
    for (const modelName of allCandidates) {
      const model = this.getModel(modelName);
      if (model && model !== primary) {
        alternatives.push(model);
      }
    }

    return {
      primary,
      alternatives,
      strategy: categoryMapping.strategy
    };
  }

  /**
   * Calculate model costs
   */
  calculateCost(modelName: string, inputTokens: number, outputTokens: number): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  } | null {
    const model = this.getModel(modelName);
    if (!model) return null;

    const inputCost = inputTokens * model.costPerInputToken;
    const outputCost = outputTokens * model.costPerOutputToken;
    const totalCost = inputCost + outputCost;

    return { inputCost, outputCost, totalCost };
  }

  /**
   * Get protocol mapping for provider configuration
   */
  getProtocolMapping(providerType: string): any {
    if (!this.config) return null;

    // Find protocol mapping in model mappings
    for (const [protocol, protocolConfig] of Object.entries(this.config.modelMappings)) {
      if (protocolConfig.protocol === providerType) {
        return {
          type: protocolConfig.protocol,
          models: Object.keys(protocolConfig.models),
          endpoints: this.getEndpointsByProtocol(protocolConfig.protocol)
        };
      }
    }

    return null;
  }

  /**
   * Get endpoints by protocol
   */
  private getEndpointsByProtocol(protocol: string): string[] {
    const endpoints: string[] = [];
    
    for (const [endpointId, endpointConfig] of this.endpointRegistry.entries()) {
      if (endpointConfig.supportedProtocols.includes(protocol)) {
        endpoints.push(endpointId);
      }
    }

    return endpoints;
  }

  /**
   * Initialize default configuration if loading fails
   */
  private initializeDefaultConfiguration(): void {
    console.log('🔧 Initializing default model mapping configuration');
    
    // Add some basic models to registry
    const defaultModels: [string, ModelInfo][] = [
      ['claude-3-5-sonnet-20241022', {
        name: 'claude-3-5-sonnet-20241022',
        protocol: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        maxTokens: 200000,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        supportedFeatures: ['streaming', 'tool_calls', 'vision']
      }],
      ['gpt-4o', {
        name: 'gpt-4o',
        protocol: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        maxTokens: 128000,
        costPerInputToken: 0.0000025,
        costPerOutputToken: 0.00001,
        supportedFeatures: ['streaming', 'tool_calls', 'vision']
      }]
    ];

    for (const [modelName, modelInfo] of defaultModels) {
      this.modelRegistry.set(modelName, modelInfo);
    }

    console.log('✅ Default model mapping configuration initialized');
  }

  /**
   * Reload configuration from file
   */
  reloadConfiguration(): void {
    console.log('🔄 Reloading model mapping configuration...');
    this.loadConfiguration();
  }

  /**
   * Get mapping statistics
   */
  getMappingStats(): any {
    return {
      models: this.modelRegistry.size,
      protocols: this.protocolModels.size,
      endpoints: this.endpointRegistry.size,
      categories: this.config?.categoryMappings ? Object.keys(this.config.categoryMappings).length : 0,
      strategies: this.config?.routingStrategies ? Object.keys(this.config.routingStrategies).length : 0,
      configVersion: this.config?.metadata.version || 'unknown',
      lastUpdated: this.config?.metadata.lastUpdated || 'unknown'
    };
  }

  /**
   * Export current configuration
   */
  exportConfiguration(): ModelMappingConfig | null {
    return this.config;
  }
}

// Global model mapping manager instance
export const modelMappingManager = new ModelMappingManager();