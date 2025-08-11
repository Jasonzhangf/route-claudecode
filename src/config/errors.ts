/**
 * Configuration Error Classes
 * Explicit error handling for configuration issues - no fallbacks allowed
 */

export class ConfigurationError extends Error {
  public readonly code: string;
  public readonly path?: string;
  public readonly value?: any;

  constructor(message: string, code: string, path?: string, value?: any) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.path = path;
    this.value = value;
  }
}

export class MissingConfigurationError extends ConfigurationError {
  constructor(path: string, description?: string) {
    const message = description 
      ? `Missing required configuration at '${path}': ${description}`
      : `Missing required configuration at '${path}'`;
    super(message, 'MISSING_CONFIGURATION', path);
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  constructor(path: string, value: any, expectedType: string, description?: string) {
    const message = description
      ? `Invalid configuration at '${path}': expected ${expectedType}, got ${typeof value}. ${description}`
      : `Invalid configuration at '${path}': expected ${expectedType}, got ${typeof value}`;
    super(message, 'INVALID_CONFIGURATION', path, value);
  }
}

export class EnvironmentVariableError extends ConfigurationError {
  constructor(variableName: string, description?: string) {
    const message = description
      ? `Missing required environment variable '${variableName}': ${description}`
      : `Missing required environment variable '${variableName}'`;
    super(message, 'MISSING_ENVIRONMENT_VARIABLE', variableName);
  }
}

export class ConfigurationValidationError extends ConfigurationError {
  public readonly validationErrors: ConfigurationError[];

  constructor(errors: ConfigurationError[]) {
    const message = `Configuration validation failed with ${errors.length} error(s):\n${
      errors.map(e => `  - ${e.message}`).join('\n')
    }`;
    super(message, 'VALIDATION_FAILED');
    this.validationErrors = errors;
  }
}

export class ProviderConfigurationError extends ConfigurationError {
  public readonly provider: string;

  constructor(provider: string, message: string, path?: string, value?: any) {
    super(`Provider '${provider}' configuration error: ${message}`, 'PROVIDER_CONFIGURATION_ERROR', path, value);
    this.provider = provider;
  }
}

export class FileSystemConfigurationError extends ConfigurationError {
  public readonly filePath: string;

  constructor(filePath: string, operation: string, originalError?: Error) {
    const message = `Failed to ${operation} configuration file '${filePath}'${
      originalError ? `: ${originalError.message}` : ''
    }`;
    super(message, 'FILESYSTEM_ERROR', filePath);
    this.filePath = filePath;
  }
}