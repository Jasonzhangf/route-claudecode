/**
 * MOCKUP IMPLEMENTATION - Testing Configuration
 * This is a placeholder implementation for testing environment configuration
 * All functionality is mocked and should be replaced with real implementations
 */

export const testingConfig = {
  environment: 'testing',
  debug: true,
  server: {
    port: 0, // Random port for testing
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
      retries: 1
    },
    openai: {
      enabled: true,
      apiKey: 'test-openai-key',
      organizationId: 'test-org',
      baseURL: 'http://localhost:3001/mock-openai',
      timeout: 5000,
      retries: 1
    },
    gemini: {
      enabled: true,
      apiKey: 'test-gemini-key',
      baseURL: 'http://localhost:3001/mock-gemini',
      timeout: 5000,
      retries: 1
    },
    codewhisperer: {
      enabled: true,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      region: 'us-east-1',
      timeout: 5000,
      retries: 1
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
  },
  mockupIndicator: 'TESTING_CONFIG_MOCKUP'
};

export default testingConfig;

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Testing configuration loaded - placeholder implementation');