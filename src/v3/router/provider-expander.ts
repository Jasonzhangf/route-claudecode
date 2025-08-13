/**
 * V3.0 Provider Expander
 * Multi-key to multi-provider expansion strategy
 * 
 * Project owner: Jason Zhang
 */

export interface ExpandedProvider {
  providerId: string;
  originalProviderId: string;
  keyIndex: number;
  totalKeys: number;
  config: any;
}

export interface ProviderExpansionResult {
  expandedProviders: Map<string, ExpandedProvider>;
  originalProviders: Map<string, any>;
}

export class ProviderExpander {
  
  static expandProviders(providersConfig: Record<string, any>): ProviderExpansionResult {
    const expandedProviders = new Map<string, ExpandedProvider>();
    const originalProviders = new Map<string, any>();
    
    console.log('🔧 V3 Provider expansion starting');
    
    for (const [providerId, config] of Object.entries(providersConfig)) {
      originalProviders.set(providerId, config);
      
      // Check for multi-key configuration
      const credentials = config.authentication?.credentials;
      const apiKeys = credentials?.apiKeys || credentials?.apiKey;
      
      if (Array.isArray(apiKeys) && apiKeys.length > 1) {
        // Multi-key expansion
        console.log(`📊 V3 Expanding multi-key provider: ${providerId} (${apiKeys.length} keys)`);
        
        for (let i = 0; i < apiKeys.length; i++) {
          const expandedProviderId = `${providerId}-key${i + 1}`;
          const expandedConfig = {
            ...config,
            authentication: {
              ...config.authentication,
              credentials: {
                ...credentials,
                apiKeys: [apiKeys[i]]
              }
            }
          };
          
          expandedProviders.set(expandedProviderId, {
            providerId: expandedProviderId,
            originalProviderId: providerId,
            keyIndex: i,
            totalKeys: apiKeys.length,
            config: expandedConfig
          });
        }
      } else {
        // Single key provider
        expandedProviders.set(providerId, {
          providerId: providerId,
          originalProviderId: providerId,
          keyIndex: 0,
          totalKeys: 1,
          config: config
        });
      }
    }
    
    console.log(`🎯 V3 Provider expansion completed: ${expandedProviders.size} providers`);
    
    return {
      expandedProviders,
      originalProviders
    };
  }

  static updateRoutingWithExpandedProviders(
    routingConfig: any,
    expandedProviders: Map<string, ExpandedProvider>
  ): any {
    const updatedRouting: any = {};
    
    for (const [category, categoryConfig] of Object.entries(routingConfig)) {
      if ((categoryConfig as any).providers) {
        const expandedProviderList: any[] = [];
        
        for (const providerEntry of (categoryConfig as any).providers) {
          const originalProviderId = providerEntry.provider;
          
          // Find matching expanded providers
          const matchingProviders = Array.from(expandedProviders.values())
            .filter(ep => ep.originalProviderId === originalProviderId);
          
          if (matchingProviders.length > 1) {
            // Multi-key provider expansion
            for (const expandedProvider of matchingProviders) {
              expandedProviderList.push({
                provider: expandedProvider.providerId,
                model: providerEntry.model,
                weight: providerEntry.weight
              });
            }
          } else {
            // Single provider
            expandedProviderList.push(providerEntry);
          }
        }
        
        updatedRouting[category] = {
          ...(categoryConfig as any),
          providers: expandedProviderList
        };
      } else {
        updatedRouting[category] = categoryConfig;
      }
    }
    
    console.log('✅ V3 Routing updated with expanded providers');
    return updatedRouting;
  }
}