/**
 * Six-Layer Architecture Implementation
 * Complete implementation of the six-layer architecture with dynamic registration
 * @author Jason Zhang
 * @version v3.0-refactor
 */
// Export all layer interfaces and implementations
export { LayerRegistry, globalLayerRegistry, BaseLayer } from './layer-interface.js';
// Export client layer
export { ClientLayer } from '../client/client-layer.js';
// Export router layer  
export { RouterLayer } from '../router/router-layer.js';
// Minimal implementations for other layers (to be enhanced)
export { PostProcessorLayer } from '../post-processor/post-processor-layer.js';
export { TransformerLayer } from '../transformer/transformer-layer.js';
export { ProviderProtocolLayer } from '../provider-protocol/provider-protocol-layer.js';
export { PreprocessorLayer } from '../preprocessor/preprocessor-layer.js';
export { ServerLayer } from '../server/server-layer.js';
/**
 * Six-Layer Architecture Manager
 * Manages the complete six-layer processing pipeline
 */
export class SixLayerArchitecture {
    constructor() {
        this.processingOrder = [];
        this.debugEnabled = true;
        this.layerRegistry = new LayerRegistry();
    }
    /**
     * Initialize the complete six-layer architecture
     */
    async initializeArchitecture(config = {}) {
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
        }
        catch (error) {
            console.error('❌ Failed to initialize Six-Layer Architecture:', error);
            throw error;
        }
    }
    /**
     * Process request through all six layers
     */
    async processRequest(request, sessionId = `session-${Date.now()}`) {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const context = {
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
        }
        catch (error) {
            console.error(`❌ Request ${requestId} failed at layer processing:`, error);
            throw error;
        }
    }
    /**
     * Perform health check on all layers
     */
    async performHealthCheck() {
        console.log('🏥 Performing six-layer architecture health check...');
        const results = await this.layerRegistry.performHealthCheck();
        const resultObj = {};
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
    recordLayerDebug(layerType, data, context, duration) {
        // In production, this would integrate with the debug recording system
        if (context.debugEnabled) {
            const debugRecord = {
                layer: layerType,
                requestId: context.requestId,
                timestamp: new Date(),
                duration,
                dataSize: JSON.stringify(data).length
            };
            // Emit debug event
            process.emit('layerDebug', debugRecord);
        }
    }
}
/**
 * Global six-layer architecture instance
 */
export const globalSixLayerArchitecture = new SixLayerArchitecture();
