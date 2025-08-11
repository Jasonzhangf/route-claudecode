/**
 * Configuration Management Types
 * Defines all configuration interfaces and types for the zero-hardcoding system
 */

export type Environment = 'development' | 'production' | 'testing';

export interface ConfigurationError extends Error {
  code: string;
  path?: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ConfigurationError[];
  warnings: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  ssl?: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
}

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  baseURL: string;
  timeout: number;
  retries: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  // Provider-specific fields
  organizationId?: string; // OpenAI
  accessKeyId?: string; // CodeWhisperer
  secretAccessKey?: string; // CodeWhisperer
  region?: string; // CodeWhisperer
}

export interface DatabaseConfig {
  path: string;
  maxSize: string;
  backupInterval: string;
  retentionDays: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  console: boolean;
  file: string;
  maxSize: string;
  maxFiles: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  global: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  perProvider?: Record<string, {
    requestsPerMinute: number;
    tokensPerMinute: number;
  }>;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsEndpoint: string;
  healthEndpoint: string;
}

export interface TestingConfig {
  mockProviders: boolean;
  recordRequests: boolean;
  recordResponses: boolean;
  timeoutMultiplier: number;
  maxTestDuration: number;
}

export interface Configuration {
  environment: Environment;
  debug: boolean;
  server: ServerConfig;
  providers: Record<string, ProviderConfig>;
  database: DatabaseConfig;
  logging: LoggingConfig;
  rateLimits: RateLimitConfig;
  monitoring?: MonitoringConfig;
  testing?: TestingConfig;
}

export interface ConfigurationLoader {
  loadConfiguration(environment: Environment): Promise<Configuration>;
  validateConfiguration(config: Configuration): Promise<ValidationResult>;
  getRequiredEnvironmentVariables(): string[];
}

export interface ConfigurationValidator {
  validate(config: Configuration): Promise<ValidationResult>;
  validateProvider(provider: string, config: ProviderConfig): ValidationResult;
  validateServer(config: ServerConfig): ValidationResult;
  validateDatabase(config: DatabaseConfig): ValidationResult;
  validateLogging(config: LoggingConfig): ValidationResult;
}

export interface ConfigurationManager {
  initialize(environment: Environment): Promise<void>;
  getConfiguration(): Configuration;
  getProviderConfig(provider: string): ProviderConfig;
  updateProviderConfig(provider: string, updates: Partial<ProviderConfig>): Promise<void>;
  validateCurrentConfiguration(): Promise<ValidationResult>;
  reload(): Promise<void>;
}