"use strict";
/**
 * Production Environment Configuration
 * Zero-hardcoding configuration for production environment
 * All values must come from environment variables - no fallbacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionConfig = void 0;
exports.productionConfig = {
    environment: 'production',
    debug: false,
    server: {
        // PORT environment variable is required in production
        port: 8080, // Will be overridden by environment variable processing
        host: '0.0.0.0',
        cors: {
            enabled: true,
            // ALLOWED_ORIGINS environment variable is required
            origins: [] // Will be populated from environment variable
        },
        ssl: {
            enabled: false, // Will be enabled if SSL_CERT_PATH and SSL_KEY_PATH are provided
        }
    },
    providers: {
        anthropic: {
            enabled: false, // Will be set from ANTHROPIC_ENABLED environment variable
            // ANTHROPIC_API_KEY environment variable is required if enabled
            baseURL: 'https://api.anthropic.com/v1', // Can be overridden with ANTHROPIC_BASE_URL
            timeout: 60000,
            retries: 5,
            rateLimits: {
                requestsPerMinute: 60,
                tokensPerMinute: 100000
            }
        },
        openai: {
            enabled: false, // Will be set from OPENAI_ENABLED environment variable
            // OPENAI_API_KEY environment variable is required if enabled
            // OPENAI_ORG_ID environment variable is optional
            baseURL: 'https://api.openai.com/v1', // Can be overridden with OPENAI_BASE_URL
            timeout: 60000,
            retries: 5,
            rateLimits: {
                requestsPerMinute: 100,
                tokensPerMinute: 150000
            }
        },
        gemini: {
            enabled: false, // Will be set from GEMINI_ENABLED environment variable
            // GEMINI_API_KEY environment variable is required if enabled
            baseURL: 'https://generativelanguage.googleapis.com/v1', // Can be overridden with GEMINI_BASE_URL
            timeout: 60000,
            retries: 5,
            rateLimits: {
                requestsPerMinute: 60,
                tokensPerMinute: 120000
            }
        },
        codewhisperer: {
            enabled: false, // Will be set from CODEWHISPERER_ENABLED environment variable
            // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required if enabled
            region: 'us-east-1', // Can be overridden with AWS_REGION
            timeout: 60000,
            retries: 5,
            rateLimits: {
                requestsPerMinute: 30,
                tokensPerMinute: 80000
            }
        }
    },
    database: {
        path: '/var/lib/route-claude-code/database', // Can be overridden with DATABASE_PATH
        maxSize: '5GB', // Can be overridden with DATABASE_MAX_SIZE
        backupInterval: '6h', // Can be overridden with BACKUP_INTERVAL
        retentionDays: 90 // Can be overridden with RETENTION_DAYS
    },
    logging: {
        level: 'info', // Can be overridden with LOG_LEVEL
        console: false,
        file: '/var/log/route-claude-code/production.log', // Can be overridden with LOG_FILE
        maxSize: '200MB', // Can be overridden with LOG_MAX_SIZE
        maxFiles: 10 // Can be overridden with LOG_MAX_FILES
    },
    rateLimits: {
        enabled: true,
        global: {
            requestsPerMinute: 500, // Can be overridden with GLOBAL_RATE_LIMIT_RPM
            tokensPerMinute: 500000 // Can be overridden with GLOBAL_RATE_LIMIT_TPM
        },
        perProvider: {
            anthropic: {
                requestsPerMinute: 60, // Can be overridden with ANTHROPIC_RATE_LIMIT_RPM
                tokensPerMinute: 100000 // Can be overridden with ANTHROPIC_RATE_LIMIT_TPM
            },
            openai: {
                requestsPerMinute: 100, // Can be overridden with OPENAI_RATE_LIMIT_RPM
                tokensPerMinute: 150000 // Can be overridden with OPENAI_RATE_LIMIT_TPM
            },
            gemini: {
                requestsPerMinute: 60, // Can be overridden with GEMINI_RATE_LIMIT_RPM
                tokensPerMinute: 120000 // Can be overridden with GEMINI_RATE_LIMIT_TPM
            },
            codewhisperer: {
                requestsPerMinute: 30, // Can be overridden with CODEWHISPERER_RATE_LIMIT_RPM
                tokensPerMinute: 80000 // Can be overridden with CODEWHISPERER_RATE_LIMIT_TPM
            }
        }
    },
    monitoring: {
        enabled: true,
        metricsEndpoint: '/metrics', // Can be overridden with METRICS_ENDPOINT
        healthEndpoint: '/health' // Can be overridden with HEALTH_ENDPOINT
    }
};
exports.default = exports.productionConfig;
//# sourceMappingURL=index.js.map