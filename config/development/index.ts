/**
 * Development Environment Configuration
 * Zero-hardcoding configuration for development environment
 * All values come from environment variables or explicit configuration
 */

import { Configuration } from '../../src/config/types.js';

export const developmentConfig: Configuration = {
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
      // API key will be loaded from ANTHROPIC_API_KEY environment variable
      // No fallback values - explicit error if missing
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 30000,
      retries: 3,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      }
    },
    openai: {
      enabled: true,
      // API key will be loaded from OPENAI_API_KEY environment variable
      // Organization ID from OPENAI_ORG_ID environment variable
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      retries: 3,
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 150000
      }
    },
    gemini: {
      enabled: true,
      // API key will be loaded from GEMINI_API_KEY environment variable
      baseURL: 'https://generativelanguage.googleapis.com/v1',
      timeout: 30000,
      retries: 3,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 120000
      }
    },
    codewhisperer: {
      enabled: true,
      // AWS credentials will be loaded from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
      region: 'us-east-1',
      timeout: 30000,
      retries: 3,
      rateLimits: {
        requestsPerMinute: 30,
        tokensPerMinute: 80000
      }
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
  }
};

export default developmentConfig;