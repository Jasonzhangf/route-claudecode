/**
 * Configuration Management Unit Tests (Fixed)
 * Tests for zero-hardcoding configuration system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ConfigValidator,
  ExternalConfigurationLoader,
  ZeroHardcodingConfigurationManager,
  Configuration,
  Environment,
  MissingConfigurationError,
  InvalidConfigurationError,
  EnvironmentVariableError,
  ConfigurationValidationError
} from '../../src/config/index.js';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateProvider', () => {
    it('should validate enabled anthropic provider successfully', () => {
      const config = {
        enabled: true,
        apiKey: 'sk-ant-test-key',
        baseURL: 'https://api.anthropic.com/v1',
        timeout: 30000,
        retries: 3,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000
        }
      };

      const result = validator.validateProvider('anthropic', config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const config = {
        enabled: true,
        // Missing apiKey and baseURL
        timeout: 30000,
        retries: 3,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000
        }
      };

      const result = validator.validateProvider('anthropic', config);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2); // Missing apiKey and baseURL
    });

    it('should fail validation for invalid timeout', () => {
      const config = {
        enabled: true,
        apiKey: 'sk-ant-test-key',
        baseURL: 'https://api.anthropic.com/v1',
        timeout: -1000, // Invalid negative timeout
        retries: 3,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000
        }
      };

      const result = validator.validateProvider('anthropic', config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'timeout')).toBe(true);
    });

    it('should skip validation for disabled providers', () => {
      const config = {
        enabled: false,
        // Missing required fields, but should pass because disabled
        timeout: 30000,
        retries: 3
      };

      const result = validator.validateProvider('anthropic', config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateServer', () => {
    it('should validate server configuration successfully', () => {
      const config = {
        port: 3000,
        host: 'localhost',
        cors: {
          enabled: true,
          origins: ['http://localhost:3000']
        }
      };

      const result = validator.validateServer(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid port', () => {
      const config = {
        port: 70000, // Invalid port > 65535
        host: 'localhost',
        cors: {
          enabled: true,
          origins: ['http://localhost:3000']
        }
      };

      const result = validator.validateServer(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'server.port')).toBe(true);
    });

    it('should fail validation for missing CORS configuration', () => {
      const config = {
        port: 3000,
        host: 'localhost'
        // Missing cors configuration
      };

      const result = validator.validateServer(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'server.cors')).toBe(true);
    });
  });
});

describe('ZeroHardcodingConfigurationManager', () => {
  let manager: ZeroHardcodingConfigurationManager;
  let originalEnv: NodeJS.ProcessEnv;

  // Helper function to create valid mock configuration
  const createValidMockConfig = (): Configuration => ({
    environment: 'testing',
    debug: true,
    server: { 
      port: 3000, 
      host: 'localhost', 
      cors: { enabled: true, origins: [] } 
    },
    providers: {
      anthropic: { 
        enabled: true, 
        apiKey: 'test-key', 
        baseURL: 'https://api.anthropic.com/v1', 
        timeout: 5000, 
        retries: 1, 
        rateLimits: { requestsPerMinute: 100, tokensPerMinute: 100000 } 
      }
    },
    database: { 
      path: ':memory:', 
      maxSize: '100MB', 
      backupInterval: 'never', 
      retentionDays: 1 
    },
    logging: { 
      level: 'debug', 
      console: false, 
      file: '/tmp/test.log', 
      maxSize: '10MB', 
      maxFiles: 1 
    },
    rateLimits: { 
      enabled: false, 
      global: { requestsPerMinute: 10000, tokensPerMinute: 10000000 } 
    }
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
    manager = new ZeroHardcodingConfigurationManager('testing');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should throw error when accessing configuration before initialization', () => {
      expect(() => manager.getConfiguration()).toThrow('Configuration manager not initialized');
    });

    it('should throw error when accessing provider config before initialization', () => {
      expect(() => manager.getProviderConfig('anthropic')).toThrow('Configuration manager not initialized');
    });
  });

  describe('provider management', () => {
    it('should return enabled providers list', async () => {
      const mockConfig = createValidMockConfig();
      mockConfig.providers.openai = { 
        enabled: false, 
        apiKey: 'test-key', 
        baseURL: 'https://api.openai.com/v1', 
        timeout: 5000, 
        retries: 1, 
        rateLimits: { requestsPerMinute: 100, tokensPerMinute: 100000 } 
      };

      const mockLoader = {
        loadConfiguration: vi.fn().mockResolvedValue(mockConfig),
        validateConfiguration: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
        getRequiredEnvironmentVariables: vi.fn().mockReturnValue([])
      };

      (manager as any).loader = mockLoader;
      await manager.initialize();

      const enabledProviders = manager.getEnabledProviders();
      expect(enabledProviders).toEqual(['anthropic']);
    });

    it('should check if provider is enabled', async () => {
      const mockConfig = createValidMockConfig();

      const mockLoader = {
        loadConfiguration: vi.fn().mockResolvedValue(mockConfig),
        validateConfiguration: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
        getRequiredEnvironmentVariables: vi.fn().mockReturnValue([])
      };

      (manager as any).loader = mockLoader;
      await manager.initialize();

      expect(manager.isProviderEnabled('anthropic')).toBe(true);
      expect(manager.isProviderEnabled('nonexistent')).toBe(false);
    });
  });

  describe('configuration updates', () => {
    it('should update provider configuration with validation', async () => {
      const mockConfig = createValidMockConfig();

      const mockLoader = {
        loadConfiguration: vi.fn().mockResolvedValue(mockConfig),
        validateConfiguration: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
        getRequiredEnvironmentVariables: vi.fn().mockReturnValue([])
      };

      (manager as any).loader = mockLoader;
      await manager.initialize();

      await manager.updateProviderConfig('anthropic', { timeout: 10000 });

      const updatedConfig = manager.getProviderConfig('anthropic');
      expect(updatedConfig.timeout).toBe(10000);
    });

    it('should reject invalid provider configuration updates', async () => {
      const mockConfig = createValidMockConfig();

      const mockLoader = {
        loadConfiguration: vi.fn().mockResolvedValue(mockConfig),
        validateConfiguration: vi.fn()
          .mockResolvedValueOnce({ valid: true, errors: [], warnings: [] }) // Initial validation
          .mockResolvedValueOnce({ 
            valid: false, 
            errors: [new InvalidConfigurationError('timeout', -1000, 'positive number')], 
            warnings: [] 
          }), // Update validation
        getRequiredEnvironmentVariables: vi.fn().mockReturnValue([])
      };

      (manager as any).loader = mockLoader;
      await manager.initialize();

      await expect(
        manager.updateProviderConfig('anthropic', { timeout: -1000 })
      ).rejects.toThrow(ConfigurationValidationError);
    });
  });
});

describe('Configuration Error Classes', () => {
  describe('MissingConfigurationError', () => {
    it('should create error with correct properties', () => {
      const error = new MissingConfigurationError('test.path', 'Test description');
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('MISSING_CONFIGURATION');
      expect(error.path).toBe('test.path');
      expect(error.message).toContain('test.path');
      expect(error.message).toContain('Test description');
    });
  });

  describe('InvalidConfigurationError', () => {
    it('should create error with correct properties', () => {
      const error = new InvalidConfigurationError('test.path', 'invalid-value', 'string');
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('INVALID_CONFIGURATION');
      expect(error.path).toBe('test.path');
      expect(error.value).toBe('invalid-value');
      expect(error.message).toContain('test.path');
      expect(error.message).toContain('string');
    });
  });

  describe('EnvironmentVariableError', () => {
    it('should create error with correct properties', () => {
      const error = new EnvironmentVariableError('TEST_VAR', 'Test description');
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('MISSING_ENVIRONMENT_VARIABLE');
      expect(error.path).toBe('TEST_VAR');
      expect(error.message).toContain('TEST_VAR');
      expect(error.message).toContain('Test description');
    });
  });

  describe('ConfigurationValidationError', () => {
    it('should create error with multiple validation errors', () => {
      const errors = [
        new MissingConfigurationError('path1', 'Description 1'),
        new InvalidConfigurationError('path2', 'value', 'type')
      ];
      
      const error = new ConfigurationValidationError(errors);
      
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.validationErrors).toEqual(errors);
      expect(error.message).toContain('2 error(s)');
    });
  });
});