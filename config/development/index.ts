/**
 * MOCKUP IMPLEMENTATION - Development Configuration
 * This is a placeholder implementation for development environment configuration
 * All functionality is mocked and should be replaced with real implementations
 */

export const developmentConfig = {
  environment: 'development',
  debug: true,
  server: {
    port: 3000,
    host: 'localhost',
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'http://localhost:3001']
    }
  },
  providers: {
    anthropic: {
      enabled: true,
      apiKey: process.env.ANTHROPIC_API_KEY || 'mockup-anthropic-dev-key',
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 30000,
      retries: 3
    },
    openai: {
      enabled: true,
      apiKey: process.env.OPENAI_API_KEY || 'mockup-openai-dev-key',
      organizationId: process.env.OPENAI_ORG_ID || 'mockup-org-dev',
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      retries: 3
    },
    gemini: {
      enabled: true,
      apiKey: process.env.GEMINI_API_KEY || 'mockup-gemini-dev-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1',
      timeout: 30000,
      retries: 3
    },
    codewhisperer: {
      enabled: true,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mockup-aws-key-dev',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mockup-aws-secret-dev',
      region: 'us-east-1',
      timeout: 30000,
      retries: 3
    }
  },
  database: {
    path: '~/.route-claude-code/dev-database',
    maxSize: '500MB',
    backupInterval: '1h',
    retentionDays: 7
  },
  logging: {
    level: 'debug',
    console: true,
    file: '~/.route-claude-code/logs/development.log',
    maxSize: '50MB',
    maxFiles: 3
  },
  rateLimits: {
    enabled: false, // Disabled for development
    global: {
      requestsPerMinute: 1000,
      tokensPerMinute: 1000000
    }
  },
  mockupIndicator: 'DEVELOPMENT_CONFIG_MOCKUP'
};

export default developmentConfig;

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Development configuration loaded - placeholder implementation');