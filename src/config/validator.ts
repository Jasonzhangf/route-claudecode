/**
 * Configuration Validator
 * Comprehensive validation system with explicit error handling - no fallbacks
 */

import { 
  Configuration, 
  ProviderConfig, 
  ServerConfig, 
  DatabaseConfig, 
  LoggingConfig,
  ValidationResult,
  ConfigurationValidator,
  Environment
} from './types.js';
import {
  ConfigurationError,
  MissingConfigurationError,
  InvalidConfigurationError,
  ProviderConfigurationError
} from './errors.js';

export class ConfigValidator implements ConfigurationValidator {
  private readonly requiredProviderFields = {
    anthropic: ['apiKey', 'baseURL'],
    openai: ['apiKey', 'baseURL'],
    gemini: ['apiKey', 'baseURL'],
    codewhisperer: ['accessKeyId', 'secretAccessKey', 'region']
  };

  async validate(config: Configuration): Promise<ValidationResult> {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    // Validate environment
    if (!config.environment || !['development', 'production', 'testing'].includes(config.environment)) {
      errors.push(new InvalidConfigurationError(
        'environment', 
        config.environment, 
        'development | production | testing'
      ));
    }

    // Validate server configuration
    const serverValidation = this.validateServer(config.server);
    errors.push(...serverValidation.errors);
    warnings.push(...serverValidation.warnings);

    // Validate providers
    if (!config.providers || typeof config.providers !== 'object') {
      errors.push(new MissingConfigurationError('providers', 'Providers configuration object is required'));
    } else {
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        const providerValidation = this.validateProvider(providerName, providerConfig, config.environment);
        errors.push(...providerValidation.errors);
        warnings.push(...providerValidation.warnings);
      }
    }

    // Validate database configuration
    const databaseValidation = this.validateDatabase(config.database);
    errors.push(...databaseValidation.errors);
    warnings.push(...databaseValidation.warnings);

    // Validate logging configuration
    const loggingValidation = this.validateLogging(config.logging);
    errors.push(...loggingValidation.errors);
    warnings.push(...loggingValidation.warnings);

    // Validate rate limits
    if (config.rateLimits) {
      const rateLimitValidation = this.validateRateLimits(config.rateLimits);
      errors.push(...rateLimitValidation.errors);
      warnings.push(...rateLimitValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateProvider(provider: string, config: ProviderConfig, environment?: string): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push(new ProviderConfigurationError(provider, 'Provider configuration is missing'));
      return { valid: false, errors, warnings };
    }

    // Validate enabled flag
    if (typeof config.enabled !== 'boolean') {
      errors.push(new ProviderConfigurationError(
        provider, 
        'enabled field must be a boolean', 
        'enabled', 
        config.enabled
      ));
    }

    // Skip further validation if provider is disabled
    if (!config.enabled) {
      return { valid: errors.length === 0, errors, warnings };
    }

    // Validate required fields for each provider type
    // In development mode, API keys are optional (will be warnings instead of errors)
    const requiredFields = this.requiredProviderFields[provider as keyof typeof this.requiredProviderFields];
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!config[field as keyof ProviderConfig]) {
          if (environment === 'development') {
            warnings.push(`Provider '${provider}' is missing '${field}' - using development mode`);
          } else {
            errors.push(new ProviderConfigurationError(
              provider,
              `Required field '${field}' is missing`,
              field
            ));
          }
        }
      }
    }

    // Validate baseURL format
    if (config.baseURL) {
      try {
        new URL(config.baseURL);
      } catch {
        errors.push(new ProviderConfigurationError(
          provider,
          'baseURL must be a valid URL',
          'baseURL',
          config.baseURL
        ));
      }
    }

    // Validate timeout
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      errors.push(new ProviderConfigurationError(
        provider,
        'timeout must be a positive number',
        'timeout',
        config.timeout
      ));
    }

    // Validate retries
    if (typeof config.retries !== 'number' || config.retries < 0) {
      errors.push(new ProviderConfigurationError(
        provider,
        'retries must be a non-negative number',
        'retries',
        config.retries
      ));
    }

    // Validate rate limits
    if (config.rateLimits) {
      if (typeof config.rateLimits.requestsPerMinute !== 'number' || config.rateLimits.requestsPerMinute <= 0) {
        errors.push(new ProviderConfigurationError(
          provider,
          'rateLimits.requestsPerMinute must be a positive number',
          'rateLimits.requestsPerMinute',
          config.rateLimits.requestsPerMinute
        ));
      }
      if (typeof config.rateLimits.tokensPerMinute !== 'number' || config.rateLimits.tokensPerMinute <= 0) {
        errors.push(new ProviderConfigurationError(
          provider,
          'rateLimits.tokensPerMinute must be a positive number',
          'rateLimits.tokensPerMinute',
          config.rateLimits.tokensPerMinute
        ));
      }
    }

    // Provider-specific validations
    if (provider === 'anthropic' && config.apiKey && !config.apiKey.startsWith('sk-ant-')) {
      warnings.push(`Anthropic API key format may be incorrect (should start with 'sk-ant-')`);
    }

    if (provider === 'openai' && config.apiKey && !config.apiKey.startsWith('sk-')) {
      warnings.push(`OpenAI API key format may be incorrect (should start with 'sk-')`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateServer(config: ServerConfig): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push(new MissingConfigurationError('server', 'Server configuration is required'));
      return { valid: false, errors, warnings };
    }

    // Validate port
    if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      errors.push(new InvalidConfigurationError(
        'server.port',
        config.port,
        'number between 1 and 65535'
      ));
    }

    // Validate host
    if (typeof config.host !== 'string' || config.host.trim() === '') {
      errors.push(new InvalidConfigurationError(
        'server.host',
        config.host,
        'non-empty string'
      ));
    }

    // Validate CORS configuration
    if (!config.cors || typeof config.cors !== 'object') {
      errors.push(new MissingConfigurationError('server.cors', 'CORS configuration is required'));
    } else {
      if (typeof config.cors.enabled !== 'boolean') {
        errors.push(new InvalidConfigurationError(
          'server.cors.enabled',
          config.cors.enabled,
          'boolean'
        ));
      }

      if (!Array.isArray(config.cors.origins)) {
        errors.push(new InvalidConfigurationError(
          'server.cors.origins',
          config.cors.origins,
          'array of strings'
        ));
      }
    }

    // Validate SSL configuration if present
    if (config.ssl) {
      if (typeof config.ssl.enabled !== 'boolean') {
        errors.push(new InvalidConfigurationError(
          'server.ssl.enabled',
          config.ssl.enabled,
          'boolean'
        ));
      }

      if (config.ssl.enabled) {
        if (!config.ssl.cert) {
          errors.push(new MissingConfigurationError('server.ssl.cert', 'SSL certificate path is required when SSL is enabled'));
        }
        if (!config.ssl.key) {
          errors.push(new MissingConfigurationError('server.ssl.key', 'SSL key path is required when SSL is enabled'));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateDatabase(config: DatabaseConfig): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push(new MissingConfigurationError('database', 'Database configuration is required'));
      return { valid: false, errors, warnings };
    }

    // Validate path
    if (typeof config.path !== 'string' || config.path.trim() === '') {
      errors.push(new InvalidConfigurationError(
        'database.path',
        config.path,
        'non-empty string'
      ));
    }

    // Validate maxSize format
    if (typeof config.maxSize !== 'string' || !/^\d+[KMGT]?B$/i.test(config.maxSize)) {
      errors.push(new InvalidConfigurationError(
        'database.maxSize',
        config.maxSize,
        'size string (e.g., "1GB", "500MB")'
      ));
    }

    // Validate retentionDays
    if (typeof config.retentionDays !== 'number' || config.retentionDays < 0) {
      errors.push(new InvalidConfigurationError(
        'database.retentionDays',
        config.retentionDays,
        'non-negative number'
      ));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateLogging(config: LoggingConfig): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push(new MissingConfigurationError('logging', 'Logging configuration is required'));
      return { valid: false, errors, warnings };
    }

    // Validate log level
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.level)) {
      errors.push(new InvalidConfigurationError(
        'logging.level',
        config.level,
        `one of: ${validLevels.join(', ')}`
      ));
    }

    // Validate console flag
    if (typeof config.console !== 'boolean') {
      errors.push(new InvalidConfigurationError(
        'logging.console',
        config.console,
        'boolean'
      ));
    }

    // Validate file path
    if (typeof config.file !== 'string' || config.file.trim() === '') {
      errors.push(new InvalidConfigurationError(
        'logging.file',
        config.file,
        'non-empty string'
      ));
    }

    // Validate maxSize format
    if (typeof config.maxSize !== 'string' || !/^\d+[KMGT]?B$/i.test(config.maxSize)) {
      errors.push(new InvalidConfigurationError(
        'logging.maxSize',
        config.maxSize,
        'size string (e.g., "100MB", "1GB")'
      ));
    }

    // Validate maxFiles
    if (typeof config.maxFiles !== 'number' || config.maxFiles < 1) {
      errors.push(new InvalidConfigurationError(
        'logging.maxFiles',
        config.maxFiles,
        'positive number'
      ));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateRateLimits(config: any): ValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    if (typeof config.enabled !== 'boolean') {
      errors.push(new InvalidConfigurationError(
        'rateLimits.enabled',
        config.enabled,
        'boolean'
      ));
    }

    if (!config.global || typeof config.global !== 'object') {
      errors.push(new MissingConfigurationError('rateLimits.global', 'Global rate limits configuration is required'));
    } else {
      if (typeof config.global.requestsPerMinute !== 'number' || config.global.requestsPerMinute <= 0) {
        errors.push(new InvalidConfigurationError(
          'rateLimits.global.requestsPerMinute',
          config.global.requestsPerMinute,
          'positive number'
        ));
      }
      if (typeof config.global.tokensPerMinute !== 'number' || config.global.tokensPerMinute <= 0) {
        errors.push(new InvalidConfigurationError(
          'rateLimits.global.tokensPerMinute',
          config.global.tokensPerMinute,
          'positive number'
        ));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}