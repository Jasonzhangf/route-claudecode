/**
 * Testing Environment Configuration
 * Zero-hardcoding configuration for testing environment
 * Uses mock values and in-memory storage for isolated testing
 */

import { Configuration } from '../../src/config/types.js';

export const testingConfig: Configuration = {
  environment: 'testing',
  debug: true,
  server: {
    port: 3001, // Fixed port for testing (0 is invalid)
    host: 'localhost',
    cors: {
      enabled: true,
      origins: ['*'] // Allow all origins for testing
    }
  },
  providers: {
    anthropic: {
      enabled: true,
      apiKey: 'test-anthropic-key',
      baseURL: 'http://localhost:3001/mock-anthropic',
      timeout: 5000,
      retries: 1,
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000
      }
    },
    openai: {
      enabled: true,
      apiKey: 'test-openai-key',
      organizationId: 'test-org',
      baseURL: 'http://localhost:3001/mock-openai',
      timeout: 5000,
      retries: 1,
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000
      }
    },
    gemini: {
      enabled: true,
      apiKey: 'test-gemini-key',
      baseURL: 'http://localhost:3001/mock-gemini',
      timeout: 5000,
      retries: 1,
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000
      }
    },
    codewhisperer: {
      enabled: true,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      region: 'us-east-1',
      timeout: 5000,
      retries: 1,
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 1000000
      }
    }
  },
  database: {
    path: ':memory:', // In-memory database for testing
    maxSize: '100MB',
    backupInterval: 'never',
    retentionDays: 1
  },
  logging: {
    level: 'debug',
    console: false, // Suppress console logs during testing
    file: '/tmp/route-claude-code-test.log',
    maxSize: '10MB',
    maxFiles: 1
  },
  rateLimits: {
    enabled: false, // Disabled for testing
    global: {
      requestsPerMinute: 10000,
      tokensPerMinute: 10000000
    }
  },
  testing: {
    mockProviders: true,
    recordRequests: true,
    recordResponses: true,
    timeoutMultiplier: 0.1, // Faster timeouts for testing
    maxTestDuration: 30000 // 30 seconds max per test
  }
};

export default testingConfig;