/**
 * Core Layer Interface for Six-Layer Architecture
 * Provides dynamic registration capabilities for all layers
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { EventEmitter } from 'events';

/**
 * Processing Context for layer operations
 */
export interface ProcessingContext {
  sessionId: string;
  requestId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  debugEnabled: boolean;
}

/**
 * Layer Capabilities declaration
 */
export interface LayerCapabilities {
  supportedOperations: string[];
  inputTypes: string[];
  outputTypes: string[];
  dependencies: string[];
  version: string;
}

/**
 * Layer Registration Information
 */
export interface LayerRegistration {
  layerName: string;
  layerType: 'client' | 'router' | 'post-processor' | 'transformer' | 'provider-protocol' | 'preprocessor' | 'server';
  version: string;
  capabilities: LayerCapabilities;
  instance: LayerInterface;
}

/**
 * Core interface that all six layers must implement
 * Enables dynamic registration and plugin-based extensibility
 */
export interface LayerInterface {
  readonly name: string;
  readonly version: string;
  readonly layerType: 'client' | 'router' | 'post-processor' | 'transformer' | 'provider-protocol' | 'preprocessor' | 'server';
  readonly dependencies: string[];

  /**
   * Process data through this layer
   * @param input - Input data for processing
   * @param context - Processing context with metadata
   * @returns Promise resolving to processed output
   */
  process(input: any, context: ProcessingContext): Promise<any>;

  /**
   * Health check for layer functionality
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get layer capabilities
   * @returns Layer capabilities information
   */
  getCapabilities(): LayerCapabilities;

  /**
   * Initialize layer (called during registration)
   * @param config - Layer-specific configuration
   * @returns Promise resolving when initialization complete
   */
  initialize(config?: any): Promise<void>;

  /**
   * Cleanup layer resources
   * @returns Promise resolving when cleanup complete
   */
  cleanup(): Promise<void>;
}

/**
 * Dynamic Layer Registry
 * Manages registration and discovery of layer implementations
 */
export class LayerRegistry extends EventEmitter {
  private layers: Map<string, LayerRegistration> = new Map();
  private layersByType: Map<string, LayerRegistration[]> = new Map();

  /**
   * Register a layer implementation
   * @param layer - Layer implementation to register
   * @param config - Optional configuration for the layer
   */
  async registerLayer(layer: LayerInterface, config?: any): Promise<void> {
    // Initialize layer
    await layer.initialize(config);

    // Create registration
    const registration: LayerRegistration = {
      layerName: layer.name,
      layerType: layer.layerType,
      version: layer.version,
      capabilities: layer.getCapabilities(),
      instance: layer
    };

    // Store in registry
    this.layers.set(layer.name, registration);

    // Index by type
    if (!this.layersByType.has(layer.layerType)) {
      this.layersByType.set(layer.layerType, []);
    }
    this.layersByType.get(layer.layerType)!.push(registration);

    // Emit registration event
    this.emit('layerRegistered', registration);

    console.log(`✅ Layer registered: ${layer.name} (${layer.layerType} v${layer.version})`);
  }

  /**
   * Unregister a layer
   * @param layerName - Name of layer to unregister
   */
  async unregisterLayer(layerName: string): Promise<void> {
    const registration = this.layers.get(layerName);
    if (!registration) {
      throw new Error(`Layer not found: ${layerName}`);
    }

    // Cleanup layer
    await registration.instance.cleanup();

    // Remove from registry
    this.layers.delete(layerName);

    // Remove from type index
    const typeList = this.layersByType.get(registration.layerType);
    if (typeList) {
      const index = typeList.findIndex(r => r.layerName === layerName);
      if (index >= 0) {
        typeList.splice(index, 1);
      }
    }

    // Emit unregistration event
    this.emit('layerUnregistered', registration);

    console.log(`❌ Layer unregistered: ${layerName}`);
  }

  /**
   * Get layer by name
   * @param layerName - Name of layer to retrieve
   * @returns Layer registration or undefined
   */
  getLayer(layerName: string): LayerRegistration | undefined {
    return this.layers.get(layerName);
  }

  /**
   * Get all layers of a specific type
   * @param layerType - Type of layers to retrieve
   * @returns Array of layer registrations
   */
  getLayersByType(layerType: string): LayerRegistration[] {
    return this.layersByType.get(layerType) || [];
  }

  /**
   * Get all registered layers
   * @returns Array of all layer registrations
   */
  getAllLayers(): LayerRegistration[] {
    return Array.from(this.layers.values());
  }

  /**
   * Check if all dependencies are satisfied for a layer
   * @param layerName - Name of layer to check
   * @returns True if all dependencies are registered
   */
  checkDependencies(layerName: string): boolean {
    const registration = this.layers.get(layerName);
    if (!registration) return false;

    return registration.capabilities.dependencies.every(dep => 
      this.layers.has(dep)
    );
  }

  /**
   * Get layer processing order based on dependencies
   * @returns Array of layer names in processing order
   */
  getProcessingOrder(): string[] {
    // Standard six-layer processing order
    const standardOrder = ['client', 'router', 'post-processor', 'transformer', 'provider-protocol', 'preprocessor', 'server'];
    
    const result: string[] = [];
    
    for (const layerType of standardOrder) {
      const layersOfType = this.getLayersByType(layerType);
      for (const layer of layersOfType) {
        result.push(layer.layerName);
      }
    }
    
    return result;
  }

  /**
   * Perform health check on all registered layers
   * @returns Map of layer names to health status
   */
  async performHealthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [layerName, registration] of this.layers) {
      try {
        const healthy = await registration.instance.healthCheck();
        results.set(layerName, healthy);
      } catch (error) {
        results.set(layerName, false);
        console.error(`Health check failed for layer ${layerName}:`, error);
      }
    }
    
    return results;
  }
}

/**
 * Global layer registry instance
 */
export const globalLayerRegistry = new LayerRegistry();

/**
 * Standard processor interface for unified request/response processing
 * Extends LayerInterface to provide consistent method signatures across all layers
 */
export interface StandardProcessor extends LayerInterface {
  /**
   * Process request data - unified signature for all layers
   * @param request - Request data to process
   * @param context - Processing context with metadata
   * @returns Promise resolving to processed request
   */
  processRequest?(request: any, context: ProcessingContext): Promise<any>;

  /**
   * Process response data - unified signature for all layers
   * @param response - Response data to process
   * @param originalRequest - Original request for reference
   * @param context - Processing context with metadata
   * @returns Promise resolving to processed response
   */
  processResponse?(response: any, originalRequest: any, context: ProcessingContext): Promise<any>;

  /**
   * Post-process response data - unified signature for specialized processing
   * @param response - Response data to post-process
   * @param originalRequest - Original request for reference
   * @param context - Processing context with metadata
   * @returns Promise resolving to post-processed response
   */
  postprocessResponse?(response: any, originalRequest: any, context: ProcessingContext): Promise<any>;
}

/**
 * Base abstract class for layer implementations
 */
export abstract class BaseLayer extends EventEmitter implements LayerInterface {
  public readonly name: string;
  public readonly version: string;
  public readonly layerType: 'client' | 'router' | 'post-processor' | 'transformer' | 'provider-protocol' | 'preprocessor' | 'server';
  public readonly dependencies: string[];

  private initialized: boolean = false;

  constructor(
    name: string,
    version: string,
    layerType: 'client' | 'router' | 'post-processor' | 'transformer' | 'provider-protocol' | 'preprocessor' | 'server',
    dependencies: string[] = []
  ) {
    super();
    this.name = name;
    this.version = version;
    this.layerType = layerType;
    this.dependencies = dependencies;
  }

  /**
   * Abstract method that must be implemented by each layer
   */
  abstract process(input: any, context: ProcessingContext): Promise<any>;

  /**
   * Default health check implementation
   */
  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  /**
   * Default capabilities implementation (should be overridden)
   */
  getCapabilities(): LayerCapabilities {
    return {
      supportedOperations: ['process'],
      inputTypes: ['any'],
      outputTypes: ['any'],
      dependencies: this.dependencies,
      version: this.version
    };
  }

  /**
   * Default initialization (can be overridden)
   */
  async initialize(config?: any): Promise<void> {
    this.initialized = true;
    this.emit('initialized', { layer: this.name, config });
  }

  /**
   * Default cleanup (can be overridden)
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.emit('cleanup', { layer: this.name });
  }

  /**
   * Check if layer is initialized
   */
  protected isInitialized(): boolean {
    return this.initialized;
  }
}