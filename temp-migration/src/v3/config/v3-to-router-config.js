/**
 * V3 Configuration Converter
 * Converts V3 configuration format to RouterConfig format
 * @author Jason Zhang
 */
import * as fs from 'fs';
export function convertV3ToRouterConfig(v3ConfigPath) {
    console.log(`🔧 Converting V3 config: ${v3ConfigPath}`);
    const v3Config = JSON.parse(fs.readFileSync(v3ConfigPath, 'utf8'));
    // Convert providers
    const providers = new Map();
    for (const [providerId, providerData] of Object.entries(v3Config.providers)) {
        // Handle authentication conversion (V3 to V2.7.0 format)
        let authentication = providerData.authentication || { type: 'none' };
        // Convert V3 apiKeys array to V2.7.0 apiKey array format
        if (authentication.credentials?.apiKeys) {
            authentication = {
                type: 'bearer',
                credentials: {
                    apiKey: authentication.credentials.apiKeys
                }
            };
        }
        const providerConfig = {
            type: providerData.type === 'lmstudio-v3' ? 'lmstudio' :
                providerData.type === 'openai-compatible-v3' ? 'openai' :
                    providerData.type,
            name: providerData.name || `${providerData.type} Provider`,
            endpoint: providerData.endpoint,
            defaultModel: providerData.models?.[0] || 'default-model',
            authentication,
            models: providerData.models || ['default-model'],
            settings: {},
            // Copy additional V2.7.0 fields as any to bypass type checking
            ...(providerData.timeout && { timeout: providerData.timeout }),
            ...(providerData.maxTokens && { maxTokens: providerData.maxTokens }),
            ...(providerData.keyRotation && { keyRotation: providerData.keyRotation }),
            ...(providerData.maxRetries && { maxRetries: providerData.maxRetries }),
            ...(providerData.retryDelay && { retryDelay: providerData.retryDelay })
        };
        providers.set(providerId, providerConfig);
        console.log(`  ✅ Converted provider: ${providerId} (${providerConfig.type})`);
    }
    // Convert routing - handle both V3 and V2.7.0 formats
    const routing = {};
    // Check if it's V3 format (with categories) or V2.7.0 format (direct routing)
    const routingSource = v3Config.routing.categories || v3Config.routing;
    for (const [category, categoryConfig] of Object.entries(routingSource)) {
        if (typeof categoryConfig === 'object' && categoryConfig !== null) {
            // Handle both V3 format and v2.7.0 format
            routing[category] = {
                provider: categoryConfig.provider,
                model: categoryConfig.model,
                // Add providers array for RouterLayer compatibility
                providers: categoryConfig.providers || [categoryConfig.provider]
            };
            console.log(`  ✅ Converted routing: ${category} -> ${categoryConfig.provider}/${categoryConfig.model}`);
        }
    }
    // Ensure we have all required routing categories
    const requiredCategories = ['default', 'background', 'thinking', 'longcontext', 'search'];
    for (const category of requiredCategories) {
        if (!routing[category]) {
            console.log(`  ⚠️  Missing routing category: ${category}, using default`);
            routing[category] = routing['default'] || {
                provider: Object.keys(v3Config.providers)[0],
                model: 'default-model'
            };
        }
    }
    // Convert providers Map to Record for RouterServer compatibility
    const providersRecord = {};
    for (const [providerId, providerConfig] of providers.entries()) {
        providersRecord[providerId] = providerConfig;
    }
    const routerConfig = {
        server: {
            port: v3Config.server.port,
            host: v3Config.server.host
        },
        providers: providersRecord,
        routing,
        // Add routingConfig for RouterLayer compatibility
        routingConfig: {
            categories: routing,
            defaultCategory: v3Config.routing.defaultCategory || 'default',
            loadBalancing: v3Config.routing.loadBalancing || {
                strategy: 'round-robin',
                healthCheckEnabled: true,
                fallbackEnabled: false
            }
        },
        hooks: [],
        debug: v3Config.debug ? {
            enabled: v3Config.debug.enabled || true,
            logLevel: v3Config.debug.logLevel || 'debug',
            logDir: v3Config.debug.logDir || '/tmp/ccr-logs',
            traceRequests: true,
            saveRequests: true
        } : {
            enabled: true,
            logLevel: 'debug',
            logDir: '/tmp/ccr-logs',
            traceRequests: true,
            saveRequests: true
        }
    };
    console.log(`✅ V3 config converted successfully`);
    console.log(`   Port: ${routerConfig.server.port}`);
    console.log(`   Providers: ${providers.size}`);
    console.log(`   Routing categories: ${Object.keys(routing).length}`);
    return routerConfig;
}
