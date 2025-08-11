/**
 * MOCKUP IMPLEMENTATION - Production Configuration
 * This is a placeholder implementation for production environment configuration
 * All functionality is mocked and should be replaced with real implementations
 */

export const productionConfig = {
  environment: 'production',
  debug: false,
  server: {
    port: parseInt(process.env.PORT || '8080'),
    host: '0.0.0.0',
    cors: {
      enabled: true,
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.example.com']
    },
    ssl: {
      enabled: true,
      cert: process.env.SSL_CERT_PATH,
      key: process.env.SSL_KEY_PATH
    }
  },
  providers: {
    anthropic: {
      enabled: process.env.ANTHROPIC_ENABLED === 'true',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      timeout: 60000,
      retries: 5
    },
    openai: {
      enabled: process.env.OPENAI_ENABLED === 'true',
      apiKey: process.env.OPENAI_API_KEY,
      organizationId: process.env.OPENAI_ORG_ID,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: 60000,
      retries: 5
    },
    gemini: {
      enabled: process.env.GEMINI_ENABLED === 'true',
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1',
      timeout: 60000,
      retries: 5
    },
    codewhisperer: {
      enabled: process.env.CODEWHISPERER_ENABLED === 'true',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      timeout: 60000,
      retries: 5
    }
  },
  database: {
    path: process.env.DATABASE_PATH || '/var/lib/route-claude-code/database',
    maxSize: process.env.DATABASE_MAX_SIZE || '5GB',
    backupInterval: process.env.BACKUP_INTERVAL || '6h',
    retentionDays: parseInt(process.env.RETENTION_DAYS || '90')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    console: false,
    file: process.env.LOG_FILE || '/var/log/route-claude-code/production.log',
    maxSize: process.env.LOG_MAX_SIZE || '200MB',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '10')
  },
  rateLimits: {
    enabled: true,
    global: {
      requestsPerMinute: parseInt(process.env.GLOBAL_RATE_LIMIT_RPM || '500'),
      tokensPerMinute: parseInt(process.env.GLOBAL_RATE_LIMIT_TPM || '500000')
    },
    perProvider: {
      anthropic: {
        requestsPerMinute: parseInt(process.env.ANTHROPIC_RATE_LIMIT_RPM || '60'),
        tokensPerMinute: parseInt(process.env.ANTHROPIC_RATE_LIMIT_TPM || '100000')
      },
      openai: {
        requestsPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_RPM || '100'),
        tokensPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_TPM || '150000')
      },
      gemini: {
        requestsPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_RPM || '60'),
        tokensPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_TPM || '120000')
      },
      codewhisperer: {
        requestsPerMinute: parseInt(process.env.CODEWHISPERER_RATE_LIMIT_RPM || '30'),
        tokensPerMinute: parseInt(process.env.CODEWHISPERER_RATE_LIMIT_TPM || '80000')
      }
    }
  },
  monitoring: {
    enabled: true,
    metricsEndpoint: process.env.METRICS_ENDPOINT || '/metrics',
    healthEndpoint: process.env.HEALTH_ENDPOINT || '/health'
  },
  mockupIndicator: 'PRODUCTION_CONFIG_MOCKUP'
};

export default productionConfig;

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Production configuration loaded - placeholder implementation');