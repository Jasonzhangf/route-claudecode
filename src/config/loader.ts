/**
 * Configuration Loader
 * Loads configuration from external files and environment variables - no hardcoding
 */

import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { 
  Configuration, 
  Environment, 
  ValidationResult,
  ConfigurationLoader
} from './types.js';
import {
  ConfigurationError,
  MissingConfigurationError,
  EnvironmentVariableError,
  FileSystemConfigurationError,
  ConfigurationValidationError
} from './errors.js';
import { ConfigValidator } from './validator.js';

export class ExternalConfigurationLoader implements ConfigurationLoader {
  private readonly validator = new ConfigValidator();
  private readonly configBasePath: string;
  private readonly userConfigPath: string;

  constructor(configBasePath: string = 'config') {
    this.configBasePath = resolve(configBasePath);
    this.userConfigPath = join(homedir(), '.route-claudecode', 'config');
  }

  async loadConfiguration(environment: Environment): Promise<Configuration> {
    try {
      // Try to load from user config directory first, then fall back to project config
      let config: Configuration;
      
      try {
        config = await this.loadUserConfiguration(environment);
        console.log(`Loaded configuration from user directory: ${this.userConfigPath}`);
      } catch (userConfigError) {
        console.log(`User configuration not found, loading from project directory: ${this.configBasePath}`);
        config = await this.loadProjectConfiguration(environment);
      }
      
      // Process environment variables
      const processedConfig = this.processEnvironmentVariables(config, environment);
      
      // Validate configuration
      const validation = await this.validateConfiguration(processedConfig);
      if (!validation.valid) {
        throw new ConfigurationValidationError(validation.errors);
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`Configuration warnings for ${environment}:`);
        validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      return processedConfig;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new FileSystemConfigurationError(
        `${environment} configuration`,
        'load',
        error as Error
      );
    }
  }

  async validateConfiguration(config: Configuration): Promise<ValidationResult> {
    return this.validator.validate(config);
  }

  getRequiredEnvironmentVariables(): string[] {
    return [
      // Provider API keys (required in production)
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      
      // Optional environment variables
      'PORT',
      'HOST',
      'LOG_LEVEL',
      'DATABASE_PATH',
      'ALLOWED_ORIGINS',
      'SSL_CERT_PATH',
      'SSL_KEY_PATH'
    ];
  }

  private async loadUserConfiguration(environment: Environment): Promise<Configuration> {
    // Try to load from ~/.route-claudecode/config/{environment}.json first
    const jsonConfigPath = join(this.userConfigPath, `${environment}.json`);
    
    try {
      await access(jsonConfigPath);
      const configContent = await readFile(jsonConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      console.log(`Loaded JSON configuration from: ${jsonConfigPath}`);
      return config;
    } catch (jsonError) {
      // If JSON doesn't exist, try TypeScript/JavaScript module
      const moduleConfigPath = join(this.userConfigPath, `${environment}.js`);
      try {
        const configModule = await import(moduleConfigPath);
        return this.extractConfigurationFromModule(configModule, environment);
      } catch (moduleError) {
        throw new FileSystemConfigurationError(
          `User configuration for ${environment}`,
          'load',
          moduleError as Error
        );
      }
    }
  }

  private async loadProjectConfiguration(environment: Environment): Promise<Configuration> {
    const configPath = join(this.configBasePath, environment, 'index.ts');
    const configModule = await this.loadConfigurationFile(configPath);
    return this.extractConfigurationFromModule(configModule, environment);
  }

  private async loadConfigurationFile(configPath: string): Promise<any> {
    try {
      // Use dynamic import to load TypeScript configuration
      const configModule = await import(configPath);
      return configModule;
    } catch (error) {
      throw new FileSystemConfigurationError(
        configPath,
        'import',
        error as Error
      );
    }
  }

  private extractConfigurationFromModule(configModule: any, environment: Environment): Configuration {
    // Try different export patterns
    const config = configModule.default || 
                  configModule[`${environment}Config`] || 
                  configModule.config;

    if (!config) {
      throw new MissingConfigurationError(
        'configuration export',
        `No valid configuration export found. Expected 'default', '${environment}Config', or 'config'`
      );
    }

    return config;
  }

  private processEnvironmentVariables(config: Configuration, environment: Environment): Configuration {
    const processedConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Process server configuration
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      if (isNaN(port)) {
        throw new EnvironmentVariableError('PORT', 'Must be a valid number');
      }
      processedConfig.server.port = port;
    }

    if (process.env.HOST) {
      processedConfig.server.host = process.env.HOST;
    }

    if (process.env.ALLOWED_ORIGINS) {
      processedConfig.server.cors.origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    }

    // Process SSL configuration
    if (process.env.SSL_CERT_PATH || process.env.SSL_KEY_PATH) {
      if (!processedConfig.server.ssl) {
        processedConfig.server.ssl = { enabled: false };
      }
      if (process.env.SSL_CERT_PATH) {
        processedConfig.server.ssl.cert = process.env.SSL_CERT_PATH;
        processedConfig.server.ssl.enabled = true;
      }
      if (process.env.SSL_KEY_PATH) {
        processedConfig.server.ssl.key = process.env.SSL_KEY_PATH;
        processedConfig.server.ssl.enabled = true;
      }
    }

    // Process provider configurations
    this.processProviderEnvironmentVariables(processedConfig, environment);

    // Process database configuration
    if (process.env.DATABASE_PATH) {
      processedConfig.database.path = process.env.DATABASE_PATH;
    }
    if (process.env.DATABASE_MAX_SIZE) {
      processedConfig.database.maxSize = process.env.DATABASE_MAX_SIZE;
    }
    if (process.env.RETENTION_DAYS) {
      const retentionDays = parseInt(process.env.RETENTION_DAYS, 10);
      if (isNaN(retentionDays)) {
        throw new EnvironmentVariableError('RETENTION_DAYS', 'Must be a valid number');
      }
      processedConfig.database.retentionDays = retentionDays;
    }

    // Process logging configuration
    if (process.env.LOG_LEVEL) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(process.env.LOG_LEVEL)) {
        throw new EnvironmentVariableError(
          'LOG_LEVEL', 
          `Must be one of: ${validLevels.join(', ')}`
        );
      }
      processedConfig.logging.level = process.env.LOG_LEVEL as any;
    }

    if (process.env.LOG_FILE) {
      processedConfig.logging.file = process.env.LOG_FILE;
    }

    return processedConfig;
  }

  private processProviderEnvironmentVariables(config: Configuration, environment: Environment): void {
    // Anthropic
    if (config.providers.anthropic) {
      if (process.env.ANTHROPIC_API_KEY) {
        config.providers.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
      } else if (environment === 'production' && config.providers.anthropic.enabled) {
        throw new EnvironmentVariableError(
          'ANTHROPIC_API_KEY',
          'Required for enabled Anthropic provider in production'
        );
      }

      if (process.env.ANTHROPIC_BASE_URL) {
        config.providers.anthropic.baseURL = process.env.ANTHROPIC_BASE_URL;
      }

      if (process.env.ANTHROPIC_ENABLED) {
        config.providers.anthropic.enabled = process.env.ANTHROPIC_ENABLED === 'true';
      }
    }

    // OpenAI
    if (config.providers.openai) {
      if (process.env.OPENAI_API_KEY) {
        config.providers.openai.apiKey = process.env.OPENAI_API_KEY;
      } else if (environment === 'production' && config.providers.openai.enabled) {
        throw new EnvironmentVariableError(
          'OPENAI_API_KEY',
          'Required for enabled OpenAI provider in production'
        );
      }

      if (process.env.OPENAI_ORG_ID) {
        config.providers.openai.organizationId = process.env.OPENAI_ORG_ID;
      }

      if (process.env.OPENAI_BASE_URL) {
        config.providers.openai.baseURL = process.env.OPENAI_BASE_URL;
      }

      if (process.env.OPENAI_ENABLED) {
        config.providers.openai.enabled = process.env.OPENAI_ENABLED === 'true';
      }
    }

    // Gemini
    if (config.providers.gemini) {
      if (process.env.GEMINI_API_KEY) {
        config.providers.gemini.apiKey = process.env.GEMINI_API_KEY;
      } else if (environment === 'production' && config.providers.gemini.enabled) {
        throw new EnvironmentVariableError(
          'GEMINI_API_KEY',
          'Required for enabled Gemini provider in production'
        );
      }

      if (process.env.GEMINI_BASE_URL) {
        config.providers.gemini.baseURL = process.env.GEMINI_BASE_URL;
      }

      if (process.env.GEMINI_ENABLED) {
        config.providers.gemini.enabled = process.env.GEMINI_ENABLED === 'true';
      }
    }

    // CodeWhisperer
    if (config.providers.codewhisperer) {
      if (process.env.AWS_ACCESS_KEY_ID) {
        config.providers.codewhisperer.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      } else if (environment === 'production' && config.providers.codewhisperer.enabled) {
        throw new EnvironmentVariableError(
          'AWS_ACCESS_KEY_ID',
          'Required for enabled CodeWhisperer provider in production'
        );
      }

      if (process.env.AWS_SECRET_ACCESS_KEY) {
        config.providers.codewhisperer.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      } else if (environment === 'production' && config.providers.codewhisperer.enabled) {
        throw new EnvironmentVariableError(
          'AWS_SECRET_ACCESS_KEY',
          'Required for enabled CodeWhisperer provider in production'
        );
      }

      if (process.env.AWS_REGION) {
        config.providers.codewhisperer.region = process.env.AWS_REGION;
      }

      if (process.env.CODEWHISPERER_ENABLED) {
        config.providers.codewhisperer.enabled = process.env.CODEWHISPERER_ENABLED === 'true';
      }
    }
  }
}