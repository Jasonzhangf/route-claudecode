/**
 * Core Layer Interface for Six-Layer Architecture
 * Provides dynamic registration capabilities for all layers
 * @author Jason Zhang
 * @version v3.0-refactor
 */
import { EventEmitter } from 'events';
/**
 * Dynamic Layer Registry
 * Manages registration and discovery of layer implementations
 */
export class LayerRegistry extends EventEmitter {
    constructor() {
        super(...arguments);
        this.layers = new Map();
        this.layersByType = new Map();
    }
    /**
     * Register a layer implementation
     * @param layer - Layer implementation to register
     * @param config - Optional configuration for the layer
     */
    async registerLayer(layer, config) {
        // Initialize layer
        await layer.initialize(config);
        // Create registration
        const registration = {
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
        this.layersByType.get(layer.layerType).push(registration);
        // Emit registration event
        this.emit('layerRegistered', registration);
        console.log(`✅ Layer registered: ${layer.name} (${layer.layerType} v${layer.version})`);
    }
    /**
     * Unregister a layer
     * @param layerName - Name of layer to unregister
     */
    async unregisterLayer(layerName) {
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
    getLayer(layerName) {
        return this.layers.get(layerName);
    }
    /**
     * Get all layers of a specific type
     * @param layerType - Type of layers to retrieve
     * @returns Array of layer registrations
     */
    getLayersByType(layerType) {
        return this.layersByType.get(layerType) || [];
    }
    /**
     * Get all registered layers
     * @returns Array of all layer registrations
     */
    getAllLayers() {
        return Array.from(this.layers.values());
    }
    /**
     * Check if all dependencies are satisfied for a layer
     * @param layerName - Name of layer to check
     * @returns True if all dependencies are registered
     */
    checkDependencies(layerName) {
        const registration = this.layers.get(layerName);
        if (!registration)
            return false;
        return registration.capabilities.dependencies.every(dep => this.layers.has(dep));
    }
    /**
     * Get layer processing order based on dependencies
     * @returns Array of layer names in processing order
     */
    getProcessingOrder() {
        // Standard six-layer processing order
        const standardOrder = ['client', 'router', 'post-processor', 'transformer', 'provider-protocol', 'preprocessor', 'server'];
        const result = [];
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
    async performHealthCheck() {
        const results = new Map();
        for (const [layerName, registration] of this.layers) {
            try {
                const healthy = await registration.instance.healthCheck();
                results.set(layerName, healthy);
            }
            catch (error) {
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
 * Base abstract class for layer implementations
 */
export class BaseLayer extends EventEmitter {
    constructor(name, version, layerType, dependencies = []) {
        super();
        this.initialized = false;
        this.name = name;
        this.version = version;
        this.layerType = layerType;
        this.dependencies = dependencies;
    }
    /**
     * Default health check implementation
     */
    async healthCheck() {
        return this.initialized;
    }
    /**
     * Default capabilities implementation (should be overridden)
     */
    getCapabilities() {
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
    async initialize(config) {
        this.initialized = true;
        this.emit('initialized', { layer: this.name, config });
    }
    /**
     * Default cleanup (can be overridden)
     */
    async cleanup() {
        this.initialized = false;
        this.emit('cleanup', { layer: this.name });
    }
    /**
     * Check if layer is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}
