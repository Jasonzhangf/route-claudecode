/**
 * Six-Layer Architecture Implementation
 * Complete implementation of the six-layer architecture with dynamic registration
 * @author Jason Zhang
 * @version v3.0-refactor
 */

// Import all layer interfaces and implementations
import { 
  LayerInterface, 
  ProcessingContext, 
  LayerCapabilities, 
  LayerRegistration,
  LayerRegistry,
  globalLayerRegistry,
  BaseLayer 
} from './layer-interface.js';

import { ClientLayer } from '../client/client-layer.js';
import { RouterLayer } from '../router/router-layer.js';
import { PostProcessorLayer } from '../post-processor/post-processor-layer.js';
import { TransformerLayer } from '../transformer/transformer-layer.js';
import { ProviderProtocolLayer } from '../provider-protocol/provider-protocol-layer.js';
import { PreprocessorLayer } from '../preprocessor/preprocessor-layer.js';
import { ServerLayer } from '../server/server-layer.js';

// Re-export all for external use
export { 
  LayerInterface, 
  ProcessingContext, 
  LayerCapabilities, 
  LayerRegistration,
  LayerRegistry,
  globalLayerRegistry,
  BaseLayer,
  ClientLayer,
  RouterLayer,
  PostProcessorLayer,
  TransformerLayer,
  ProviderProtocolLayer,
  PreprocessorLayer,
  ServerLayer
};

/**
 * Six-Layer Architecture Manager
 * Manages the complete six-layer processing pipeline
 */
export class SixLayerArchitecture {
  private layerRegistry: LayerRegistry;
  private processingOrder: string[] = [];
  private debugEnabled: boolean = true;

  constructor() {
    this.layerRegistry = new LayerRegistry();
  }

  /**
   * Initialize the complete six-layer architecture
   */
  async initializeArchitecture(config: any = {}): Promise<void> {
    console.log('🏗️  Initializing Six-Layer Architecture...');

    try {
      // Register all six layers in order
      await this.layerRegistry.registerLayer(new ClientLayer(config.client));
      await this.layerRegistry.registerLayer(new RouterLayer(config.router));
      await this.layerRegistry.registerLayer(new PostProcessorLayer(config.postProcessor));
      await this.layerRegistry.registerLayer(new TransformerLayer(config.transformer));
      await this.layerRegistry.registerLayer(new ProviderProtocolLayer(config.providerProtocol));
      await this.layerRegistry.registerLayer(new PreprocessorLayer(config.preprocessor));
      await this.layerRegistry.registerLayer(new ServerLayer(config.server));

      // Get processing order
      this.processingOrder = this.layerRegistry.getProcessingOrder();

      console.log('✅ Six-Layer Architecture initialized successfully');
      console.log('📋 Layer processing order:', this.processingOrder);

    } catch (error) {
      console.error('❌ Failed to initialize Six-Layer Architecture:', error);
      throw error;
    }
  }

  /**
   * Process request through all six layers
   */
  async processRequest(request: any, sessionId: string = `session-${Date.now()}`): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const context: ProcessingContext = {
      sessionId,
      requestId,
      timestamp: new Date(),
      metadata: {},
      debugEnabled: this.debugEnabled
    };

    console.log(`🔄 Processing request ${requestId} through six-layer architecture`);

    let currentData = request;

    try {
      // Process through each layer in order
      for (const layerName of this.processingOrder) {
        const registration = this.layerRegistry.getLayer(layerName);
        
        if (!registration) {
          throw new Error(`Layer not found: ${layerName}`);
        }

        console.log(`   Layer ${registration.layerType}: Processing...`);
        
        const startTime = Date.now();
        currentData = await registration.instance.process(currentData, context);
        const duration = Date.now() - startTime;

        console.log(`   ✅ Layer ${registration.layerType}: Completed in ${duration}ms`);

        // Record debug information if enabled
        if (this.debugEnabled) {
          this.recordLayerDebug(registration.layerType, currentData, context, duration);
        }
      }

      console.log(`✅ Request ${requestId} processed successfully through all layers`);
      return currentData;

    } catch (error) {
      console.error(`❌ Request ${requestId} failed at layer processing:`, error);
      throw error;
    }
  }

  /**
   * Perform health check on all layers
   */
  async performHealthCheck(): Promise<{ healthy: boolean; results: Record<string, boolean> }> {
    console.log('🏥 Performing six-layer architecture health check...');

    const results = await this.layerRegistry.performHealthCheck();
    const resultObj: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [layerName, healthy] of results) {
      resultObj[layerName] = healthy;
      if (!healthy) {
        allHealthy = false;
      }
    }

    console.log('📊 Health check results:', resultObj);
    return { healthy: allHealthy, results: resultObj };
  }

  /**
   * Get architecture status
   */
  getArchitectureStatus() {
    return {
      layersRegistered: this.layerRegistry.getAllLayers().length,
      processingOrder: this.processingOrder,
      debugEnabled: this.debugEnabled,
      layerTypes: this.layerRegistry.getAllLayers().map(l => l.layerType)
    };
  }

  /**
   * Record debug information for layer processing
   */
  private recordLayerDebug(layerType: string, data: any, context: ProcessingContext, duration: number): void {
    // In production, this would integrate with the debug recording system
    if (context.debugEnabled) {
      const debugRecord = {
        layer: layerType,
        requestId: context.requestId,
        timestamp: new Date(),
        duration,
        dataSize: JSON.stringify(data).length
      };

      // Emit debug event (in production, integrate with debug recording system)
      // process.emit('layerDebug', debugRecord);
    }
  }
}

/**
 * Global six-layer architecture instance
 */
export const globalSixLayerArchitecture = new SixLayerArchitecture();