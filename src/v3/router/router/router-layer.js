/**
 * Router Layer Implementation
 * Manages request routing based on dynamic configuration for the six-layer architecture
 * @author Jason Zhang
 * @version v3.0-refactor
 */
import { BaseLayer } from '../shared/layer-interface.js';
/**
 * Router Layer Implementation
 * Second layer in the six-layer architecture: Client ↔ Router ↔ Post-processor ↔ Transformer ↔ Provider-Protocol ↔ Preprocessor ↔ Server
 */
export class RouterLayer extends BaseLayer {
    constructor(config = {}) {
        super('router-layer', '1.0.0', 'router', ['client-layer']);
        this.providerHealth = new Map();
        this.roundRobinIndex = new Map();
        this.config = {
            routingConfig: config.routingConfig || this.getDefaultRoutingConfig(),
            enableFallback: config.enableFallback ?? false, // Zero-fallback principle
            healthCheckInterval: config.healthCheckInterval ?? 60000, // 1 minute
            maxRetries: config.maxRetries ?? 0 // No retries by default
        };
    }
    /**
     * Process routing decision
     * @param input - Request from client layer
     * @param context - Processing context
     * @returns Request with routing decision
     */
    async process(input, context) {
        if (!this.isInitialized()) {
            throw new Error('Router layer not initialized');
        }
        const startTime = Date.now();
        try {
            // Validate input from client layer
            this.validateClientInput(input);
            // Determine request category
            const category = this.determineCategory(input, context);
            // Make routing decision
            const routerDecision = await this.makeRoutingDecision(category, input, context);
            // Apply routing decision to request
            const routedRequest = {
                ...input,
                routerLayerProcessed: true,
                routerLayerTimestamp: new Date(),
                routingDecision: routerDecision,
                targetProvider: routerDecision.selectedProvider,
                targetModel: routerDecision.selectedModel,
                category: routerDecision.category,
                processingDuration: Date.now() - startTime
            };
            // Apply model substitution (zero-hardcoding principle)
            if (routedRequest.body && routedRequest.body.model) {
                routedRequest.body.model = routerDecision.selectedModel;
            }
            this.emit('routingDecision', {
                requestId: context.requestId,
                decision: routerDecision,
                duration: Date.now() - startTime
            });
            return routedRequest;
        }
        catch (error) {
            this.emit('routingFailed', {
                requestId: context.requestId,
                duration: Date.now() - startTime,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get layer capabilities
     */
    getCapabilities() {
        return {
            supportedOperations: ['routing', 'load-balancing', 'model-selection', 'provider-selection'],
            inputTypes: ['processed-request'],
            outputTypes: ['routed-request'],
            dependencies: ['client-layer'],
            version: this.version
        };
    }
    /**
     * Validate client layer input
     */
    validateClientInput(input) {
        if (!input) {
            throw new Error('Router layer requires client layer output');
        }
        if (!input.clientLayerProcessed) {
            throw new Error('Input must be processed by client layer first');
        }
        if (!input.body) {
            throw new Error('Request body is required for routing');
        }
    }
    /**
     * Determine request category based on request analysis
     */
    determineCategory(input, context) {
        // Analyze request to determine category
        const body = input.body;
        // Check for explicit category in metadata
        if (context.metadata.category) {
            return context.metadata.category;
        }
        // Check for tool usage - indicates default category
        if (body.tools && body.tools.length > 0) {
            return 'default';
        }
        // Check message length for long context
        if (body.messages && Array.isArray(body.messages)) {
            const totalLength = body.messages.reduce((sum, msg) => {
                return sum + (msg.content?.length || 0);
            }, 0);
            if (totalLength > 50000) { // 50k characters
                return 'longcontext';
            }
        }
        // Check for search-related keywords
        if (body.messages && Array.isArray(body.messages)) {
            const hasSearchKeywords = body.messages.some((msg) => {
                const content = msg.content?.toLowerCase() || '';
                return content.includes('search') || content.includes('find') || content.includes('lookup');
            });
            if (hasSearchKeywords) {
                return 'search';
            }
        }
        // Check for background processing indicators
        if (body.stream === false && !body.tools) {
            return 'background';
        }
        // Default to thinking category for complex analysis
        return 'thinking';
    }
    /**
     * Make routing decision based on category
     */
    async makeRoutingDecision(category, input, context) {
        const categoryConfig = this.config.routingConfig.categories[category];
        if (!categoryConfig) {
            if (this.config.enableFallback) {
                category = this.config.routingConfig.defaultCategory;
            }
            else {
                throw new Error(`No configuration found for category: ${category}`);
            }
        }
        // Select provider using load balancing strategy
        const selectedProvider = this.selectProvider(categoryConfig, category);
        // Select model for the provider
        const selectedModel = this.selectModel(categoryConfig, selectedProvider);
        // Create decision
        const decision = {
            selectedProvider,
            selectedModel,
            category,
            strategy: this.config.routingConfig.loadBalancing.strategy,
            timestamp: new Date(),
            confidence: 1.0 // Always confident with explicit configuration
        };
        return decision;
    }
    /**
     * Select provider using load balancing strategy
     */
    selectProvider(categoryConfig, category) {
        const availableProviders = categoryConfig.providers.filter(provider => {
            return !this.config.routingConfig.loadBalancing.healthCheckEnabled ||
                this.providerHealth.get(provider) !== false;
        });
        if (availableProviders.length === 0) {
            throw new Error(`No healthy providers available for category: ${category}`);
        }
        switch (this.config.routingConfig.loadBalancing.strategy) {
            case 'round-robin':
                return this.selectRoundRobin(availableProviders, category);
            case 'random':
                return availableProviders[Math.floor(Math.random() * availableProviders.length)];
            case 'weighted':
                // For now, treat as round-robin (weighted implementation would require weights config)
                return this.selectRoundRobin(availableProviders, category);
            default:
                return availableProviders[0];
        }
    }
    /**
     * Select provider using round-robin strategy
     */
    selectRoundRobin(providers, category) {
        const currentIndex = this.roundRobinIndex.get(category) || 0;
        const selectedProvider = providers[currentIndex % providers.length];
        this.roundRobinIndex.set(category, currentIndex + 1);
        return selectedProvider;
    }
    /**
     * Select model for provider
     */
    selectModel(categoryConfig, provider) {
        // For now, select first available model
        // In production, this would consider provider-specific model mapping
        if (categoryConfig.models.length === 0) {
            throw new Error(`No models configured for provider: ${provider}`);
        }
        return categoryConfig.models[0];
    }
    /**
     * Get default routing configuration
     */
    getDefaultRoutingConfig() {
        return {
            categories: {
                default: {
                    providers: ['anthropic-claude', 'openai-gpt'],
                    models: ['claude-3-sonnet-20240229', 'gpt-4'],
                    priority: 1
                },
                thinking: {
                    providers: ['anthropic-claude'],
                    models: ['claude-3-sonnet-20240229'],
                    priority: 1
                },
                longcontext: {
                    providers: ['anthropic-claude'],
                    models: ['claude-3-sonnet-20240229'],
                    priority: 1
                },
                background: {
                    providers: ['openai-gpt'],
                    models: ['gpt-4'],
                    priority: 2
                },
                search: {
                    providers: ['openai-gpt'],
                    models: ['gpt-4'],
                    priority: 2
                }
            },
            defaultCategory: 'default',
            loadBalancing: {
                strategy: 'round-robin',
                healthCheckEnabled: true,
                fallbackEnabled: false
            }
        };
    }
    /**
     * Initialize router layer
     */
    async initialize(config) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
        // Initialize provider health tracking
        for (const categoryConfig of Object.values(this.config.routingConfig.categories)) {
            for (const provider of categoryConfig.providers) {
                this.providerHealth.set(provider, true); // Assume healthy initially
            }
        }
        await super.initialize(config);
        console.log(`🛣️  Router Layer initialized with ${Object.keys(this.config.routingConfig.categories).length} categories`);
    }
    /**
     * Health check implementation
     */
    async healthCheck() {
        try {
            // Check if routing configuration is valid
            const hasCategories = Object.keys(this.config.routingConfig.categories).length > 0;
            const hasDefaultCategory = Boolean(this.config.routingConfig.defaultCategory);
            return await super.healthCheck() && hasCategories && hasDefaultCategory;
        }
        catch (error) {
            console.error('Router layer health check failed:', error);
            return false;
        }
    }
}
