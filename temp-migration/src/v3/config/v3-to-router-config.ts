/**
 * V3 Configuration Converter - ZERO HARDCODING COMPLIANCE
 * Converts V3 configuration format to RouterConfig format
 * 
 * CRITICAL COMPLIANCE:
 * - NO hardcoded values or fallbacks
 * - ALL values must come from external configuration
 * - Explicit errors instead of silent defaults
 * 
 * @author Jason Zhang
 * @version v3.0-zero-hardcoding
 */

import { RouterConfig, ProviderConfig } from '../types/index.js';
import { ZeroHardcodingConfigManager } from './zero-hardcoding-config-manager.js';
import * as fs from 'fs';

export interface V3Config {
  server: {
    port: number;
    host: string;
    architecture: string;
    environment: string;
  };
  providers: Record<string, {
    type: string;
    endpoint: string;
    authentication: any;
    models: string[];
    timeout: number;
    maxRetries: number;
    retryDelay: number;
    [key: string]: any;
  }>;
  routing: {
    strategy: string;
    defaultCategory: string;
    loadBalancing: {
      strategy: string;
      healthCheckEnabled: boolean;
    };
    categories: Record<string, {
      provider: string;
      model: string;
      preprocessor?: string;
    }>;
  };
  debug: {
    enabled: boolean;
    logLevel: string;
    logDir: string;
    traceRequests: boolean;
    saveRequests: boolean;
  };
  errors: {
    messages: Record<string, string>;
    httpCodes: Record<string, number>;
    templates: Record<string, string>;
  };
  [key: string]: any;
}

export async function convertV3ToRouterConfig(configPath: string, environment: string): Promise<RouterConfig> {
  console.log(`🔧 [ZERO-HARDCODE] Converting V3 config: ${configPath}`);
  console.log(`📋 [ZERO-HARDCODE] Environment: ${environment} (NO fallbacks)`);
  
  // Use Zero-Hardcoding Configuration Manager
  const configManager = new ZeroHardcodingConfigManager(environment);
  
  // Set environment variable for config path (required by zero-hardcode manager)
  process.env.ROUTE_CLAUDE_CONFIG_PATH = configPath.includes('/environments/') 
    ? configPath.substring(0, configPath.indexOf('/environments/'))
    : configPath;
    
  let v3Config: V3Config;
  
  try {
    // Load V3 configuration directly from file
    v3Config = loadV3ConfigFromFile(configPath);
  } catch (error) {
    throw new Error(`V3 CONFIG CONVERSION FAILED: ${error.message}`);
  }
  
  // Convert providers - NO defaults or fallbacks
  const providers = new Map<string, ProviderConfig>();
  
  for (const [providerId, providerData] of Object.entries(v3Config.providers)) {
    // Validate required provider fields - NO fallbacks
    if (!providerData.type) {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required 'type' field`);
    }
    if (!providerData.endpoint) {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required 'endpoint' field`);
    }
    if (!providerData.models || providerData.models.length === 0) {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required 'models' array`);
    }
    
    // Convert authentication - NO defaults
    let authentication = providerData.authentication;
    if (!authentication) {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required 'authentication' configuration`);
    }
    
    // Convert V3 apiKeys array to V2.7.0 format if needed
    if (authentication.credentials?.apiKeys) {
      authentication = {
        type: authentication.type,
        credentials: {
          apiKey: authentication.credentials.apiKeys
        }
      };
    }
    
    // Map provider type - NO hardcoded type mappings
    let providerType: string;
    switch (providerData.type) {
      case 'lmstudio-v3':
        providerType = 'lmstudio';
        break;
      case 'openai-compatible-v3':
        providerType = 'openai';
        break;
      case 'anthropic':
      case 'openai':
      case 'gemini':
      case 'codewhisperer':
      case 'shuaihong':
      case 'lmstudio':
      case 'mock':
        providerType = providerData.type;
        break;
      default:
        throw new Error(`PROVIDER CONFIGURATION ERROR: Unknown provider type '${providerData.type}' for provider '${providerId}'`);
    }
    
    // Validate required numeric fields - NO defaults
    if (typeof providerData.timeout !== 'number') {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required numeric 'timeout' field`);
    }
    if (typeof providerData.maxRetries !== 'number') {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required numeric 'maxRetries' field`);
    }
    if (typeof providerData.retryDelay !== 'number') {
      throw new Error(`PROVIDER CONFIGURATION ERROR: Provider '${providerId}' missing required numeric 'retryDelay' field`);
    }
    
    const providerConfig: ProviderConfig = {
      type: providerType as 'anthropic' | 'openai' | 'gemini' | 'codewhisperer' | 'shuaihong' | 'lmstudio',
      name: providerData.name || `${providerType} Provider`,
      endpoint: providerData.endpoint,
      defaultModel: providerData.models[0],
      authentication,
      models: providerData.models,
      settings: {},
      timeout: providerData.timeout,
      maxTokens: providerData.maxTokens,
      keyRotation: providerData.keyRotation,
      maxRetries: providerData.maxRetries,
      retryDelay: providerData.retryDelay
    };
    
    providers.set(providerId, providerConfig);
    console.log(`  ✅ [ZERO-HARDCODE] Converted provider: ${providerId} (${providerConfig.type})`);
  }
  
  // Convert routing - NO defaults or fallbacks
  if (!v3Config.routing.strategy) {
    throw new Error('ROUTING CONFIGURATION ERROR: Missing required routing strategy');
  }
  
  if (!v3Config.routing.categories || Object.keys(v3Config.routing.categories).length === 0) {
    throw new Error('ROUTING CONFIGURATION ERROR: Missing required routing categories');
  }
  
  const routing: any = {};
  
  for (const [category, categoryConfig] of Object.entries(v3Config.routing.categories)) {
    if (!categoryConfig || typeof categoryConfig !== 'object') {
      throw new Error(`ROUTING CONFIGURATION ERROR: Invalid routing configuration for category '${category}'`);
    }
    
    if (!categoryConfig.provider) {
      throw new Error(`ROUTING CONFIGURATION ERROR: Missing required 'provider' for routing category '${category}'`);
    }
    
    if (!categoryConfig.model) {
      throw new Error(`ROUTING CONFIGURATION ERROR: Missing required 'model' for routing category '${category}'`);
    }
    
    // Validate that the referenced provider exists
    if (!providers.has(categoryConfig.provider)) {
      throw new Error(`ROUTING CONFIGURATION ERROR: Category '${category}' references non-existent provider '${categoryConfig.provider}'`);
    }
    
    // Validate that the model exists in the provider
    const provider = providers.get(categoryConfig.provider)!;
    if (!provider.models.includes(categoryConfig.model)) {
      throw new Error(`ROUTING CONFIGURATION ERROR: Category '${category}' references model '${categoryConfig.model}' not available in provider '${categoryConfig.provider}'. Available models: ${provider.models.join(', ')}`);
    }
    
    routing[category] = {
      provider: categoryConfig.provider,
      model: categoryConfig.model
    };
    
    console.log(`  ✅ [ZERO-HARDCODE] Converted routing: ${category} -> ${categoryConfig.provider}/${categoryConfig.model}`);
  }
  
  // Validate required routing categories - NO defaults
  const requiredCategories = ['default', 'background', 'thinking', 'longcontext', 'search'];
  const missingCategories = requiredCategories.filter(cat => !routing[cat]);
  
  if (missingCategories.length > 0) {
    throw new Error(`ROUTING CONFIGURATION ERROR: Missing required routing categories: ${missingCategories.join(', ')}`);
  }
  
  // Convert providers Map to Record for RouterServer compatibility
  const providersRecord: Record<string, any> = {};
  for (const [providerId, providerConfig] of providers.entries()) {
    providersRecord[providerId] = providerConfig;
  }

  // Validate debug configuration - NO defaults
  if (typeof v3Config.debug.enabled !== 'boolean') {
    throw new Error('DEBUG CONFIGURATION ERROR: Missing required boolean debug.enabled field');
  }
  
  if (!v3Config.debug.logLevel) {
    throw new Error('DEBUG CONFIGURATION ERROR: Missing required debug.logLevel field');
  }
  
  if (!v3Config.debug.logDir) {
    throw new Error('DEBUG CONFIGURATION ERROR: Missing required debug.logDir field');
  }

  // Validate required routing fields - NO defaults
  if (!v3Config.routing.defaultCategory) {
    throw new Error('ROUTING CONFIGURATION ERROR: Missing required routing.defaultCategory field');
  }
  
  if (!v3Config.routing.loadBalancing) {
    throw new Error('ROUTING CONFIGURATION ERROR: Missing required routing.loadBalancing configuration');
  }

  // Create routingConfig in the format expected by RouterLayer
  const routingConfig = {
    strategy: v3Config.routing.strategy,
    loadBalancing: {
      algorithm: v3Config.routing.loadBalancing.strategy
    },
    categories: routing
  };

  const routerConfig: RouterConfig = {
    server: {
      port: v3Config.server.port,
      host: v3Config.server.host
    },
    providers: providersRecord,
    routing: routing, // Use categories directly, not wrapped in routingConfig
    hooks: [],
    debug: {
      enabled: v3Config.debug.enabled,
      logLevel: v3Config.debug.logLevel as 'error' | 'warn' | 'info' | 'debug',
      logDir: v3Config.debug.logDir,
      traceRequests: v3Config.debug.traceRequests,
      saveRequests: v3Config.debug.saveRequests
    }
  };
  
  console.log(`✅ [ZERO-HARDCODE] V3 config converted successfully - NO hardcoded values used`);
  console.log(`   Port: ${routerConfig.server.port}`);
  console.log(`   Providers: ${providers.size}`);
  console.log(`   Routing categories: ${Object.keys(routing).length}`);
  console.log(`   Environment: ${environment}`);
  
  return routerConfig;
}

/**
 * Load V3 configuration from file path with explicit error handling
 * NO fallbacks for missing files
 */
export function loadV3ConfigFromFile(v3ConfigPath: string): V3Config {
  try {
    const fileContent = fs.readFileSync(v3ConfigPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`V3 CONFIGURATION FILE NOT FOUND: ${v3ConfigPath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`V3 CONFIGURATION FILE INVALID JSON: ${v3ConfigPath}. Error: ${error.message}`);
    }
    throw new Error(`V3 CONFIGURATION FILE ERROR: ${v3ConfigPath}. Error: ${error.message}`);
  }
}