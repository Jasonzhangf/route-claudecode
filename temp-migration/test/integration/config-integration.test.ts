/**
 * Configuration Management Integration Tests
 * Tests for real configuration loading and validation scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createConfigurationManager,
  getGlobalConfigurationManager,
  setGlobalConfigurationManager,
  Environment,
  ConfigurationValidationError,
  EnvironmentVariableError
} from '../../src/config/index.js';

describe('Configuration Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear environment variables for clean testing
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Development Environment', () => {
    it('should load development configuration successfully', async () => {
      const manager = createConfigurationManager('development');
      await manager.initialize();

      const config = manager.getConfiguration();
      expect(config.environment).toBe('development');
      expect(config.debug).toBe(true);
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
    });

    it('should allow missing API keys in development', async () => {
      const manager = createConfigurationManager('development');
      
      // Should not throw even without API keys in development
      await expect(manager.initialize()).resolves.not.toThrow();
      
      const config = manager.getConfiguration();
      expect(config.providers.anthropic.enabled).toBe(true);
    });

    it('should use environment variables when provided', async () => {
      process.env.PORT = '4000';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      
      const manager = createConfigurationManager('development');
      await manager.initialize();

      const config = manager.getConfiguration();
      expect(config.server.port).toBe(4000);
      expect(config.providers.anthropic.apiKey).toBe('sk-ant-test-key');
    });
  });

  describe('Production Environment', () => {
    it('should require API keys for enabled providers in production', async () => {
      const manager = createConfigurationManager('production');
      
      // Should throw because no API keys are provided
      await expect(manager.initialize()).rejects.toThrow(EnvironmentVariableError);
    });

    it('should load production configuration with all required environment variables', async () => {
      // Set all required environment variables
      process.env.ANTHROPIC_ENABLED = 'true';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-prod-key';
      process.env.OPENAI_ENABLED = 'true';
      process.env.OPENAI_API_KEY = 'sk-openai-prod-key';
      process.env.GEMINI_ENABLED = 'false'; // Disabled
      process.env.CODEWHISPERER_ENABLED = 'false'; // Disabled
      process.env.PORT = '8080';
      process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://api.example.com';

      const manager = createConfigurationManager('production');
      await manager.initialize();

      const config = manager.getConfiguration();
      expect(config.environment).toBe('production');
      expect(config.debug).toBe(false);
      expect(config.server.port).toBe(8080);
      expect(config.server.cors.origins).toEqual(['https://app.example.com', 'https://api.example.com']);
      expect(config.providers.anthropic.enabled).toBe(true);
      expect(config.providers.anthropic.apiKey).toBe('sk-ant-prod-key');
      expect(config.providers.gemini.enabled).toBe(false);
    });

    it('should validate SSL configuration when provided', async () => {
      process.env.ANTHROPIC_ENABLED = 'true';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-prod-key';
      process.env.SSL_CERT_PATH = '/path/to/cert.pem';
      process.env.SSL_KEY_PATH = '/path/to/key.pem';

      const manager = createConfigurationManager('production');
      await manager.initialize();

      const config = manager.getConfiguration();
      expect(config.server.ssl?.enabled).toBe(true);
      expect(config.server.ssl?.cert).toBe('/path/to/cert.pem');
      expect(config.server.ssl?.key).toBe('/path/to/key.pem');
    });
  });

  describe('Testing Environment', () => {
    it('should load testing configuration with mock values', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const config = manager.getConfiguration();
      expect(config.environment).toBe('testing');
      expect(config.debug).toBe(true);
      expect(config.server.port).toBe(0); // Random port for testing
      expect(config.database.path).toBe(':memory:');
      expect(config.rateLimits.enabled).toBe(false);
      expect(config.testing?.mockProviders).toBe(true);
    });

    it('should have all providers enabled with test credentials', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const enabledProviders = manager.getEnabledProviders();
      expect(enabledProviders).toContain('anthropic');
      expect(enabledProviders).toContain('openai');
      expect(enabledProviders).toContain('gemini');
      expect(enabledProviders).toContain('codewhisperer');

      const anthropicConfig = manager.getProviderConfig('anthropic');
      expect(anthropicConfig.apiKey).toBe('test-anthropic-key');
      expect(anthropicConfig.baseURL).toBe('http://localhost:3001/mock-anthropic');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration and report errors', async () => {
      // Create a configuration with invalid values
      process.env.PORT = 'invalid-port';
      
      const manager = createConfigurationManager('development');
      
      await expect(manager.initialize()).rejects.toThrow(EnvironmentVariableError);
    });

    it('should validate provider configurations', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      // Try to update with invalid configuration
      await expect(
        manager.updateProviderConfig('anthropic', { timeout: -1000 })
      ).rejects.toThrow(ConfigurationValidationError);
    });

    it('should validate current configuration', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const validation = await manager.validateCurrentConfiguration();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Provider Management', () => {
    it('should get provider configuration', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const anthropicConfig = manager.getProviderConfig('anthropic');
      expect(anthropicConfig.enabled).toBe(true);
      expect(anthropicConfig.apiKey).toBe('test-anthropic-key');
      expect(anthropicConfig.timeout).toBe(5000);
    });

    it('should throw error for non-existent provider', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      expect(() => manager.getProviderConfig('nonexistent')).toThrow('Provider \'nonexistent\' is not configured');
    });

    it('should update provider configuration', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      await manager.updateProviderConfig('anthropic', { 
        timeout: 10000,
        retries: 5 
      });

      const updatedConfig = manager.getProviderConfig('anthropic');
      expect(updatedConfig.timeout).toBe(10000);
      expect(updatedConfig.retries).toBe(5);
      expect(updatedConfig.apiKey).toBe('test-anthropic-key'); // Should preserve other values
    });

    it('should list enabled providers', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const enabledProviders = manager.getEnabledProviders();
      expect(enabledProviders).toEqual(['anthropic', 'openai', 'gemini', 'codewhisperer']);
    });

    it('should check if provider is enabled', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      expect(manager.isProviderEnabled('anthropic')).toBe(true);
      expect(manager.isProviderEnabled('nonexistent')).toBe(false);
    });
  });

  describe('Configuration Reloading', () => {
    it('should reload configuration successfully', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      const originalConfig = manager.getConfiguration();
      expect(originalConfig.environment).toBe('testing');

      // Reload should work without errors
      await manager.reload();

      const reloadedConfig = manager.getConfiguration();
      expect(reloadedConfig.environment).toBe('testing');
    });

    it('should handle reload failures gracefully', async () => {
      const manager = createConfigurationManager('testing');
      await manager.initialize();

      // Mock the loader to fail on reload
      const originalLoader = (manager as any).loader;
      (manager as any).loader = {
        ...originalLoader,
        loadConfiguration: () => Promise.reject(new Error('Reload failed'))
      };

      await expect(manager.reload()).rejects.toThrow('Reload failed');
    });
  });

  describe('Global Configuration Manager', () => {
    it('should create global configuration manager', () => {
      const globalManager = getGlobalConfigurationManager();
      expect(globalManager).toBeDefined();
      expect(globalManager.getEnvironment()).toBe('development'); // Default environment
    });

    it('should allow setting custom global configuration manager', () => {
      const customManager = createConfigurationManager('testing');
      setGlobalConfigurationManager(customManager);

      const retrievedManager = getGlobalConfigurationManager();
      expect(retrievedManager).toBe(customManager);
      expect(retrievedManager.getEnvironment()).toBe('testing');
    });
  });

  describe('Environment Variable Processing', () => {
    it('should process all supported environment variables', async () => {
      // Set comprehensive environment variables
      process.env.PORT = '9000';
      process.env.HOST = '127.0.0.1';
      process.env.ALLOWED_ORIGINS = 'https://test1.com,https://test2.com';
      process.env.LOG_LEVEL = 'warn';
      process.env.LOG_FILE = '/custom/log/path.log';
      process.env.DATABASE_PATH = '/custom/db/path';
      process.env.DATABASE_MAX_SIZE = '2GB';
      process.env.RETENTION_DAYS = '60';
      
      // Provider-specific variables
      process.env.ANTHROPIC_API_KEY = 'sk-ant-custom-key';
      process.env.ANTHROPIC_BASE_URL = 'https://custom-anthropic.com/v1';
      process.env.ANTHROPIC_ENABLED = 'true';
      
      process.env.OPENAI_API_KEY = 'sk-openai-custom-key';
      process.env.OPENAI_ORG_ID = 'custom-org-id';
      process.env.OPENAI_BASE_URL = 'https://custom-openai.com/v1';
      process.env.OPENAI_ENABLED = 'true';

      const manager = createConfigurationManager('development');
      await manager.initialize();

      const config = manager.getConfiguration();
      
      // Verify server configuration
      expect(config.server.port).toBe(9000);
      expect(config.server.host).toBe('127.0.0.1');
      expect(config.server.cors.origins).toEqual(['https://test1.com', 'https://test2.com']);
      
      // Verify logging configuration
      expect(config.logging.level).toBe('warn');
      expect(config.logging.file).toBe('/custom/log/path.log');
      
      // Verify database configuration
      expect(config.database.path).toBe('/custom/db/path');
      expect(config.database.maxSize).toBe('2GB');
      expect(config.database.retentionDays).toBe(60);
      
      // Verify provider configurations
      expect(config.providers.anthropic.apiKey).toBe('sk-ant-custom-key');
      expect(config.providers.anthropic.baseURL).toBe('https://custom-anthropic.com/v1');
      expect(config.providers.anthropic.enabled).toBe(true);
      
      expect(config.providers.openai.apiKey).toBe('sk-openai-custom-key');
      expect(config.providers.openai.organizationId).toBe('custom-org-id');
      expect(config.providers.openai.baseURL).toBe('https://custom-openai.com/v1');
      expect(config.providers.openai.enabled).toBe(true);
    });
  });
});