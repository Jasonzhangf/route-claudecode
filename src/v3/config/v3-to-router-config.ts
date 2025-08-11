/**
 * V3 Configuration Converter
 * Converts V3 configuration format to RouterConfig format
 * @author Jason Zhang
 */

import { RouterConfig, ProviderConfig } from '../../types';
import * as fs from 'fs';

export interface V3Config {
  server: {
    port: number;
    host: string;
    architecture?: string;
    layered?: boolean;
  };
  providers: Record<string, {
    type: string;
    endpoint: string;
    authentication?: any;
    models?: string[];
    timeout?: number;
    capabilities?: any;
    maxTokens?: any;
    [key: string]: any;
  }>;
  routing: {
    strategy?: string;
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
  };
  [key: string]: any;
}

export function convertV3ToRouterConfig(v3ConfigPath: string): RouterConfig {
  console.log(`🔧 Converting V3 config: ${v3ConfigPath}`);
  
  const v3Config: V3Config = JSON.parse(fs.readFileSync(v3ConfigPath, 'utf8'));
  
  // Convert providers
  const providers = new Map<string, ProviderConfig>();
  
  for (const [providerId, providerData] of Object.entries(v3Config.providers)) {
    const providerConfig: ProviderConfig = {
      type: providerData.type === 'lmstudio-v3' ? 'lmstudio' : providerData.type,
      endpoint: providerData.endpoint,
      authentication: providerData.authentication || { type: 'none' },
      models: providerData.models || ['default-model'],
      timeout: providerData.timeout || 30000
    };
    
    providers.set(providerId, providerConfig);
    console.log(`  ✅ Converted provider: ${providerId} (${providerConfig.type})`);
  }
  
  // Convert routing
  const routing: any = {};
  for (const [category, categoryConfig] of Object.entries(v3Config.routing.categories)) {
    routing[category] = {
      provider: categoryConfig.provider,
      model: categoryConfig.model
    };
  }
  
  // Convert providers Map to Record for RouterServer compatibility
  const providersRecord: Record<string, any> = {};
  for (const [providerId, providerConfig] of providers.entries()) {
    providersRecord[providerId] = providerConfig;
  }

  const routerConfig: RouterConfig = {
    server: {
      port: v3Config.server.port,
      host: v3Config.server.host
    },
    providers: providersRecord,
    routing,
    debug: {
      enabled: v3Config.debug.enabled,
      logLevel: v3Config.debug.logLevel,
      logDir: v3Config.debug.logDir
    }
  };
  
  console.log(`✅ V3 config converted successfully`);
  console.log(`   Port: ${routerConfig.server.port}`);
  console.log(`   Providers: ${providers.size}`);
  console.log(`   Routing categories: ${Object.keys(routing).length}`);
  
  return routerConfig;
}