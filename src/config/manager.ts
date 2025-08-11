/**
 * Configuration Manager
 * Central configuration management with zero hardcoding and explicit error handling
 */

import { 
  Configuration, 
  Environment, 
  ProviderConfig,
  ValidationResult,
  ConfigurationManager
} from './types.js';
import {
  ConfigurationError,
  MissingConfigurationError,
  ConfigurationValidationError
} from './errors.js';
import { ExternalConfigurationLoader } from './loader.js';
import { ConfigValidator } from './validator.js';

export class ZeroHardcodingConfigurationManager implements ConfigurationManager {
  private configuration: Configuration | null = null;
  private readonly loader: ExternalConfigurationLoader;
  private readonly validator: ConfigValidator;
  private readonly environment: Environment;
  private initialized = false;

  constructor(environment: Environment, configBasePath?: string) {
    this.environment = environment;
    this.loader = new ExternalConfigurationLoader(configBasePath);
    this.validator = new ConfigValidator();
  }

  async initialize(environment?: Environment): Promise<void> {
    const targetEnvironment = environment || this.environment;
    
    try {
      console.log(`Initializing configuration for environment: ${targetEnvironment}`);
      
      // Load configuration from external sources
      this.configuration = await this.loader.loadConfiguration(targetEnvironment);
      
      // Validate the loaded configuration
      const validation = await this.validateCurrentConfiguration();
      if (!validation.valid) {
        throw new ConfigurationValidationError(validation.errors);
      }

      this.initialized = true;
      console.log(`Configuration initialized successfully for ${targetEnvironment}`);
      
      // Log configuration summary (without sensitive data)
      this.logConfigurationSummary();
      
    } catch (error) {
      console.error(`Failed to initialize configuration for ${targetEnvironment}:`, error);
      throw error;
    }
  }

  getConfiguration(): Configuration {
    this.ensureInitialized();
    return JSON.parse(JSON.stringify(this.configuration!)); // Return deep copy to prevent mutations
  }

  getProviderConfig(provider: string): ProviderConfig {
    this.ensureInitialized();
    
    const providerConfig = this.configuration!.providers[provider];
    if (!providerConfig) {
      throw new MissingConfigurationError(
        `providers.${provider}`,
        `Provider '${provider}' is not configured`
      );
    }

    return JSON.parse(JSON.stringify(providerConfig)); // Return deep copy
  }

  async updateProviderConfig(provider: string, updates: Partial<ProviderConfig>): Promise<void> {
    this.ensureInitialized();
    
    if (!this.configuration!.providers[provider]) {
      throw new MissingConfigurationError(
        `providers.${provider}`,
        `Provider '${provider}' is not configured`
      );
    }

    // Create updated configuration
    const updatedConfig = { ...this.configuration! };
    updatedConfig.providers[provider] = {
      ...updatedConfig.providers[provider],
      ...updates
    };

    // Validate the updated configuration
    const validation = await this.validator.validate(updatedConfig);
    if (!validation.valid) {
      throw new ConfigurationValidationError(validation.errors);
    }

    // Apply the update
    this.configuration = updatedConfig;
    
    console.log(`Provider '${provider}' configuration updated successfully`);
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn(`Configuration warnings after update:`);
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }

  async validateCurrentConfiguration(): Promise<ValidationResult> {
    if (!this.configuration) {
      throw new ConfigurationError(
        'Cannot validate configuration: not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.validator.validate(this.configuration);
  }

  async reload(): Promise<void> {
    console.log(`Reloading configuration for environment: ${this.environment}`);
    
    const wasInitialized = this.initialized;
    this.initialized = false;
    this.configuration = null;

    try {
      await this.initialize(this.environment);
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Failed to reload configuration:', error);
      
      // If we were previously initialized, this is a critical error
      if (wasInitialized) {
        throw new ConfigurationError(
          'Configuration reload failed - system may be in inconsistent state',
          'RELOAD_FAILED'
        );
      }
      
      throw error;
    }
  }

  // Utility methods

  isProviderEnabled(provider: string): boolean {
    try {
      const config = this.getProviderConfig(provider);
      return config.enabled;
    } catch {
      return false;
    }
  }

  getEnabledProviders(): string[] {
    this.ensureInitialized();
    
    return Object.entries(this.configuration!.providers)
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name);
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRequiredEnvironmentVariables(): string[] {
    return this.loader.getRequiredEnvironmentVariables();
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.initialized || !this.configuration) {
      throw new ConfigurationError(
        'Configuration manager not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }
  }

  private logConfigurationSummary(): void {
    if (!this.configuration) return;

    const enabledProviders = this.getEnabledProviders();
    const summary = {
      environment: this.configuration.environment,
      server: {
        port: this.configuration.server.port,
        host: this.configuration.server.host,
        ssl: this.configuration.server.ssl?.enabled || false
      },
      providers: {
        enabled: enabledProviders,
        total: Object.keys(this.configuration.providers).length
      },
      database: {
        path: this.configuration.database.path,
        maxSize: this.configuration.database.maxSize
      },
      logging: {
        level: this.configuration.logging.level,
        console: this.configuration.logging.console
      },
      rateLimits: {
        enabled: this.configuration.rateLimits.enabled
      }
    };

    console.log('Configuration Summary:', JSON.stringify(summary, null, 2));
  }
}

// Factory function for creating configuration manager instances
export function createConfigurationManager(
  environment: Environment, 
  configBasePath?: string
): ZeroHardcodingConfigurationManager {
  return new ZeroHardcodingConfigurationManager(environment, configBasePath);
}

// Singleton instance for global access (initialized on first use)
let globalConfigManager: ZeroHardcodingConfigurationManager | null = null;

export function getGlobalConfigurationManager(): ZeroHardcodingConfigurationManager {
  if (!globalConfigManager) {
    const environment = (process.env.NODE_ENV as Environment) || 'development';
    globalConfigManager = createConfigurationManager(environment);
  }
  return globalConfigManager;
}

export function setGlobalConfigurationManager(manager: ZeroHardcodingConfigurationManager): void {
  globalConfigManager = manager;
}