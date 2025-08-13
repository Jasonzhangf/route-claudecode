/**
 * V3.0 Type Definitions
 * Six-layer architecture types
 *
 * Project owner: Jason Zhang
 */
// Error types
export class ProviderError extends Error {
    constructor(message, provider, statusCode, retryable = false) {
        super(message);
        this.provider = provider;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.name = 'ProviderError';
    }
}
