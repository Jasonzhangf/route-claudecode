/**
 * Client Layer Implementation
 * Handles incoming requests and authentication for the six-layer architecture
 * @author Jason Zhang
 * @version v3.0-refactor
 */
import { BaseLayer } from '../shared/layer-interface.js';
/**
 * Client Layer Implementation
 * First layer in the six-layer architecture: Client ↔ Router ↔ Post-processor ↔ Transformer ↔ Provider-Protocol ↔ Preprocessor ↔ Server
 */
export class ClientLayer extends BaseLayer {
    constructor(config = {}) {
        super('client-layer', '1.0.0', 'client', []);
        this.config = {
            authenticationEnabled: config.authenticationEnabled ?? true,
            rateLimitEnabled: config.rateLimitEnabled ?? true,
            corsEnabled: config.corsEnabled ?? true,
            maxRequestSize: config.maxRequestSize ?? 50 * 1024 * 1024, // 50MB
            timeout: config.timeout ?? 30000 // 30 seconds
        };
    }
    /**
     * Process incoming client request
     * @param input - Raw client request
     * @param context - Processing context
     * @returns Processed request ready for router layer
     */
    async process(input, context) {
        if (!this.isInitialized()) {
            throw new Error('Client layer not initialized');
        }
        const startTime = Date.now();
        try {
            // Validate request structure
            const clientRequest = this.validateRequest(input);
            // Apply authentication if enabled
            if (this.config.authenticationEnabled) {
                await this.authenticateRequest(clientRequest, context);
            }
            // Apply rate limiting if enabled
            if (this.config.rateLimitEnabled) {
                await this.applyRateLimit(clientRequest, context);
            }
            // Apply CORS if enabled
            if (this.config.corsEnabled) {
                this.applyCorsHeaders(clientRequest);
            }
            // Validate request size
            this.validateRequestSize(clientRequest);
            // Prepare for next layer (router)
            const processedRequest = {
                ...clientRequest,
                clientLayerProcessed: true,
                clientLayerTimestamp: new Date(),
                processingDuration: Date.now() - startTime
            };
            this.emit('requestProcessed', {
                requestId: context.requestId,
                duration: Date.now() - startTime,
                success: true
            });
            return processedRequest;
        }
        catch (error) {
            this.emit('requestFailed', {
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
            supportedOperations: ['authentication', 'rate-limiting', 'cors', 'validation'],
            inputTypes: ['http-request', 'raw-request'],
            outputTypes: ['processed-request'],
            dependencies: [],
            version: this.version
        };
    }
    /**
     * Validate incoming request structure
     */
    validateRequest(input) {
        if (!input) {
            throw new Error('Request cannot be null or undefined');
        }
        // Ensure required fields exist
        const request = {
            method: input.method || 'POST',
            path: input.path || '/v1/chat/completions',
            headers: input.headers || {},
            body: input.body || input,
            timestamp: new Date(),
            requestId: input.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        return request;
    }
    /**
     * Authenticate request
     */
    async authenticateRequest(request, context) {
        // Check for authorization header
        const authHeader = request.headers['authorization'] || request.headers['Authorization'];
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }
        // Extract bearer token
        const token = authHeader.replace(/^Bearer\s+/i, '');
        if (!token) {
            throw new Error('Invalid authorization format');
        }
        // Validate token format (basic validation)
        if (token.length < 10) {
            throw new Error('Invalid token format');
        }
        // Add authenticated flag to context
        context.metadata.authenticated = true;
        context.metadata.authToken = token.substring(0, 10) + '...'; // Masked for security
    }
    /**
     * Apply rate limiting
     */
    async applyRateLimit(request, context) {
        // Simple rate limiting implementation
        // In production, this would use Redis or similar
        const rateLimitKey = this.extractRateLimitKey(request);
        // For now, just add rate limit metadata
        context.metadata.rateLimitKey = rateLimitKey;
        context.metadata.rateLimitChecked = true;
    }
    /**
     * Extract rate limit key from request
     */
    extractRateLimitKey(request) {
        // Extract IP or token-based key
        const clientIp = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown';
        return `rate-limit:${clientIp}`;
    }
    /**
     * Apply CORS headers
     */
    applyCorsHeaders(request) {
        // Add CORS metadata for response
        if (!request.headers['cors-applied']) {
            request.headers['cors-applied'] = 'true';
        }
    }
    /**
     * Validate request size
     */
    validateRequestSize(request) {
        const requestSize = JSON.stringify(request.body).length;
        if (requestSize > this.config.maxRequestSize) {
            throw new Error(`Request size ${requestSize} exceeds maximum ${this.config.maxRequestSize}`);
        }
    }
    /**
     * Initialize client layer
     */
    async initialize(config) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
        await super.initialize(config);
        console.log(`🌐 Client Layer initialized with config:`, {
            authenticationEnabled: this.config.authenticationEnabled,
            rateLimitEnabled: this.config.rateLimitEnabled,
            corsEnabled: this.config.corsEnabled,
            maxRequestSize: this.config.maxRequestSize,
            timeout: this.config.timeout
        });
    }
    /**
     * Health check implementation
     */
    async healthCheck() {
        try {
            // Basic health check - ensure configuration is valid
            const configValid = this.config.maxRequestSize > 0 && this.config.timeout > 0;
            return await super.healthCheck() && configValid;
        }
        catch (error) {
            console.error('Client layer health check failed:', error);
            return false;
        }
    }
}
