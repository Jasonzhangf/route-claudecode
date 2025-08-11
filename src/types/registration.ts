/**
 * Dynamic Registration Framework - Core Interfaces
 * Provides module discovery, registration, and dependency resolution
 */

export interface ModuleCapabilities {
  name: string;
  version: string;
  type: ModuleType;
  supportedFormats: string[];
  features: string[];
  dependencies: ModuleDependency[];
  interfaces: string[];
}

export interface ModuleDependency {
  name: string;
  version?: string;
  optional?: boolean;
  type: ModuleType;
}

export interface ModuleMetadata {
  name: string;
  version: string;
  type: ModuleType;
  path: string;
  capabilities: ModuleCapabilities;
  status: ModuleStatus;
  registeredAt: Date;
  lastHealthCheck?: Date;
}

export interface RegistrableModule {
  getCapabilities(): ModuleCapabilities;
  initialize(context: ModuleContext): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface ModuleContext {
  moduleRegistry: ModuleRegistry;
  debugRecorder?: any;
  configuration: Record<string, any>;
  logger: ModuleLogger;
}

export interface ModuleLogger {
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string, error?: Error, metadata?: Record<string, any>): void;
  debug(message: string, metadata?: Record<string, any>): void;
}

export interface ModuleRegistry {
  register(module: RegistrableModule, metadata?: Partial<ModuleMetadata>): Promise<void>;
  unregister(name: string): Promise<void>;
  getModule<T extends RegistrableModule>(name: string): T | undefined;
  getModulesByType(type: ModuleType): ModuleMetadata[];
  getAllModules(): ModuleMetadata[];
  resolveDependencies(moduleName: string): Promise<string[]>;
  isModuleRegistered(name: string): boolean;
  getModuleStatus(name: string): ModuleStatus | undefined;
}

export interface ModuleDiscovery {
  discoverModules(searchPaths: string[]): Promise<DiscoveredModule[]>;
  loadModule(path: string): Promise<RegistrableModule>;
  validateModule(module: RegistrableModule): Promise<ValidationResult>;
}

export interface DiscoveredModule {
  name: string;
  path: string;
  type: ModuleType;
  version: string;
  valid: boolean;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DependencyResolver {
  resolveDependencies(capabilities: ModuleCapabilities): Promise<ResolutionResult>;
  validateDependencies(modules: ModuleMetadata[]): Promise<ValidationResult>;
  getLoadOrder(modules: ModuleMetadata[]): string[];
}

export interface ResolutionResult {
  resolved: string[];
  missing: string[];
  conflicts: DependencyConflict[];
}

export interface DependencyConflict {
  module: string;
  dependency: string;
  reason: string;
  severity: 'error' | 'warning';
}

export enum ModuleType {
  CLIENT = 'client',
  ROUTER = 'router',
  POST_PROCESSOR = 'post-processor',
  TRANSFORMER = 'transformer',
  PROVIDER = 'provider',
  PREPROCESSOR = 'preprocessor',
  SERVER = 'server',
  UTILITY = 'utility'
}

export enum ModuleStatus {
  DISCOVERED = 'discovered',
  REGISTERED = 'registered',
  INITIALIZED = 'initialized',
  ACTIVE = 'active',
  ERROR = 'error',
  SHUTDOWN = 'shutdown'
}

export interface RegistrationEvent {
  type: 'register' | 'unregister' | 'initialize' | 'shutdown' | 'error';
  module: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: string;
}

export interface RegistrationEventListener {
  onModuleEvent(event: RegistrationEvent): void;
}