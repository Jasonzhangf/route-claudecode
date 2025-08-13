/**
 * Enhanced Routing Engine for V3.0 Architecture
 * Based on the proven V2.7.0 routing logic with V3.0 compatibility
 * @author Jason Zhang
 */

export class EnhancedRoutingEngine {
    constructor(config) {
        this.config = config || {};
        this.providerHealth = new Map();
        this.roundRobinIndex = new Map();
        
        // Initialize provider health tracking
        this.initializeProviderHealth();
    }

    /**
     * Route a request to the appropriate provider
     * @param {Object} request - Base request object
     * @param {string} requestId - Request identifier
     * @returns {Promise<string>} Selected provider ID
     */
    async route(request, requestId) {
        try {
            // Step 1: Determine routing category
            const category = this.determineCategory(request);
            
            // Step 2: Get category configuration with fallback
            let categoryConfig = this.config[category];
            if (!categoryConfig) {
                console.warn(`No routing configuration for category: ${category}, using default`);
                categoryConfig = this.config['default'];
                if (!categoryConfig) {
                    throw new Error(`No routing configuration found for category: ${category} and no default available`);
                }
            }

            // Step 3: Select provider with health checking
            const selectedProvider = this.selectProvider(categoryConfig, category);
            
            // Step 4: Apply model mapping
            this.applyModelMapping(request, selectedProvider, categoryConfig.model, category);
            
            console.log(`✅ Routed ${category} request to ${selectedProvider} (model: ${categoryConfig.model})`);
            return selectedProvider;

        } catch (error) {
            console.error(`❌ Routing failed:`, error.message);
            throw error;
        }
    }

    /**
     * Determine routing category based on request characteristics
     */
    determineCategory(request) {
        // Check for tool usage - indicates default category
        if (request.metadata?.tools && Array.isArray(request.metadata.tools) && request.metadata.tools.length > 0) {
            return 'default';
        }

        // Check message length for long context
        if (request.messages && Array.isArray(request.messages)) {
            const totalLength = request.messages.reduce((sum, msg) => {
                return sum + (msg.content?.length || 0);
            }, 0);
            
            if (totalLength > 50000) { // 50k characters
                return 'longcontext';
            }
        }

        // Check for search-related keywords
        if (request.messages && Array.isArray(request.messages)) {
            const hasSearchKeywords = request.messages.some((msg) => {
                const content = msg.content?.toLowerCase() || '';
                return content.includes('search') || content.includes('find') || content.includes('lookup');
            });
            
            if (hasSearchKeywords) {
                return 'search';
            }
        }

        // Check for background processing indicators
        if (request.stream === false && !request.metadata?.tools) {
            return 'background';
        }

        // Check for explicit thinking mode
        if (request.metadata?.thinking) {
            return 'thinking';
        }

        // Default to default category
        return 'default';
    }

    /**
     * Select provider with load balancing and health checking
     */
    selectProvider(categoryConfig, category) {
        // Get available providers (support both single provider and providers array)
        let availableProviders = [];
        
        if (categoryConfig.providers && categoryConfig.providers.length > 0) {
            // Multi-provider configuration
            availableProviders = categoryConfig.providers.filter(providerId => {
                return this.isProviderHealthy(providerId);
            });
        } else if (categoryConfig.provider) {
            // Single provider configuration
            if (this.isProviderHealthy(categoryConfig.provider)) {
                availableProviders = [categoryConfig.provider];
            }
        }

        if (availableProviders.length === 0) {
            // Fallback to any provider if health check fails
            availableProviders = categoryConfig.providers || [categoryConfig.provider];
            if (availableProviders.length === 0) {
                throw new Error(`No providers configured for category: ${category}`);
            }
        }

        // Use round-robin for multi-provider selection
        if (availableProviders.length > 1) {
            return this.selectRoundRobin(availableProviders, category);
        } else {
            return availableProviders[0];
        }
    }

    /**
     * Round-robin provider selection
     */
    selectRoundRobin(providers, category) {
        const currentIndex = this.roundRobinIndex.get(category) || 0;
        const selectedProvider = providers[currentIndex % providers.length];
        this.roundRobinIndex.set(category, currentIndex + 1);
        return selectedProvider;
    }

    /**
     * Check if provider is healthy
     */
    isProviderHealthy(providerId) {
        const health = this.providerHealth.get(providerId);
        if (!health) {
            return true; // Assume healthy for new providers
        }
        
        // Simple health check: not healthy if more than 5 consecutive errors
        return health.consecutiveErrors < 5;
    }

    /**
     * Apply model mapping to request
     */
    applyModelMapping(request, providerId, targetModel, category) {
        // Initialize metadata if not present
        if (!request.metadata) {
            request.metadata = {};
        }

        // Store routing information
        request.metadata.originalModel = request.model;
        request.metadata.targetModel = targetModel;
        request.metadata.targetProvider = providerId;
        request.metadata.routingCategory = category;

        // Apply model substitution (zero-hardcoding principle)
        request.model = targetModel;
    }

    /**
     * Initialize provider health tracking
     */
    initializeProviderHealth() {
        const allProviders = new Set();
        
        // Collect all provider IDs from configuration
        Object.values(this.config).forEach(categoryConfig => {
            if (categoryConfig.provider) {
                allProviders.add(categoryConfig.provider);
            }
            if (categoryConfig.providers && Array.isArray(categoryConfig.providers)) {
                categoryConfig.providers.forEach(providerId => allProviders.add(providerId));
            }
        });

        // Initialize health tracking
        allProviders.forEach(providerId => {
            this.providerHealth.set(providerId, {
                providerId,
                isHealthy: true,
                consecutiveErrors: 0,
                totalRequests: 0,
                successCount: 0,
                failureCount: 0
            });
        });

        console.log(`🔍 Initialized health tracking for ${allProviders.size} providers:`, Array.from(allProviders));
    }

    /**
     * Record provider result for health tracking
     */
    recordProviderResult(providerId, success, error, httpCode, model, responseTimeMs) {
        let health = this.providerHealth.get(providerId);
        if (!health) {
            // Initialize if not exists
            health = {
                providerId,
                isHealthy: true,
                consecutiveErrors: 0,
                totalRequests: 0,
                successCount: 0,
                failureCount: 0
            };
            this.providerHealth.set(providerId, health);
        }

        health.totalRequests++;

        if (success) {
            health.successCount++;
            health.consecutiveErrors = 0;
            health.isHealthy = true;
        } else {
            health.failureCount++;
            health.consecutiveErrors++;
            
            // Mark unhealthy after 5 consecutive errors
            if (health.consecutiveErrors >= 5) {
                health.isHealthy = false;
                console.warn(`⚠️ Provider ${providerId} marked unhealthy after ${health.consecutiveErrors} consecutive errors`);
            }
        }
    }

    /**
     * Get routing statistics
     */
    getStats() {
        return {
            categories: Object.keys(this.config),
            routing: this.config,
            providerHealth: this.getAllProviderHealth(),
            roundRobinState: this.getRoundRobinState()
        };
    }

    /**
     * Get all provider health status
     */
    getAllProviderHealth() {
        const result = {};
        this.providerHealth.forEach((health, providerId) => {
            result[providerId] = health;
        });
        return result;
    }

    /**
     * Get round robin state
     */
    getRoundRobinState() {
        const result = {};
        this.roundRobinIndex.forEach((index, category) => {
            result[category] = index;
        });
        return result;
    }

    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = config;
        this.initializeProviderHealth();
        console.log('🔄 Routing configuration updated');
    }
}