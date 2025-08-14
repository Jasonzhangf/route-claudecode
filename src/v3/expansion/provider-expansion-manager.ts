/**
 * Independent Provider Expansion Manager
 * Handles multi-key expansion without coupling to routing or authentication
 * 
 * Project owner: Jason Zhang
 */

export interface ExpansionRule {
  strategy: 'multi-key-expansion' | 'weighted-expansion' | 'failover-expansion';
  maxInstances?: number;
  weightDistribution?: number[];
  keyRotationCooldownMs?: number;
  expansionThreshold?: number;
}

export interface ExpandedProviderInfo {
  providerId: string;
  originalProviderId: string;
  keyIndex: number;
  totalKeys: number;
  expansionStrategy: string;
  weight?: number;
  priority?: number;
  metadata: {
    endpoint: string;
    type: string;
    authType: string;
    keyIdentifier?: string;
    expansionTimestamp: number;
  };
}

export interface ExpansionResult {
  expandedProviders: Map<string, ExpandedProviderInfo>;
  originalProviders: Map<string, any>;
  expansionStats: {
    totalOriginal: number;
    totalExpanded: number;
    expansionRatio: number;
    multiKeyProviders: number;
    strategies: Map<string, number>;
  };
}

export class ProviderExpansionManager {
  private expansionRules: Map<string, ExpansionRule> = new Map();
  private expansionResults: ExpansionResult | null = null;

  constructor() {
    console.log('🔧 Independent Provider Expansion Manager initialized');
  }

  /**
   * Set expansion rule for a provider type
   */
  setExpansionRule(providerType: string, rule: ExpansionRule): void {
    this.expansionRules.set(providerType, rule);
    console.log(`📋 Expansion rule set for ${providerType}:`, rule);
  }

  /**
   * Expand providers based on their configurations
   */
  expandProviders(providersConfig: Record<string, any>): ExpansionResult {
    const expandedProviders = new Map<string, ExpandedProviderInfo>();
    const originalProviders = new Map<string, any>();
    const strategies = new Map<string, number>();
    let multiKeyProviders = 0;

    console.log('🔧 Starting provider expansion...');

    for (const [providerId, config] of Object.entries(providersConfig)) {
      originalProviders.set(providerId, config);

      // Determine expansion strategy
      const rule = this.getExpansionRule(config);
      const keyData = this.extractKeyData(config);

      if (keyData.keys.length > 1) {
        // Multi-key expansion
        multiKeyProviders++;
        const strategy = rule.strategy;
        const currentCount = strategies.get(strategy) || 0;
        strategies.set(strategy, currentCount + 1);

        console.log(`📊 Expanding multi-key provider: ${providerId} (${keyData.keys.length} keys)`);

        for (let i = 0; i < keyData.keys.length; i++) {
          const expandedProviderId = `${providerId}-key${i + 1}`;
          
          expandedProviders.set(expandedProviderId, {
            providerId: expandedProviderId,
            originalProviderId: providerId,
            keyIndex: i,
            totalKeys: keyData.keys.length,
            expansionStrategy: strategy,
            weight: this.calculateWeight(rule, i, keyData.keys.length),
            priority: this.calculatePriority(rule, i, keyData.keys.length),
            metadata: {
              endpoint: config.endpoint || 'unknown',
              type: config.type || 'unknown',
              authType: config.authentication?.type || 'unknown',
              keyIdentifier: this.generateKeyIdentifier(keyData.keys[i], i),
              expansionTimestamp: Date.now()
            }
          });
        }
      } else {
        // Single key provider
        const strategy = 'single-key';
        const currentCount = strategies.get(strategy) || 0;
        strategies.set(strategy, currentCount + 1);

        expandedProviders.set(providerId, {
          providerId: providerId,
          originalProviderId: providerId,
          keyIndex: 0,
          totalKeys: 1,
          expansionStrategy: strategy,
          weight: 1.0,
          priority: 1,
          metadata: {
            endpoint: config.endpoint || 'unknown',
            type: config.type || 'unknown',
            authType: config.authentication?.type || 'unknown',
            expansionTimestamp: Date.now()
          }
        });
      }
    }

    const expansionStats = {
      totalOriginal: originalProviders.size,
      totalExpanded: expandedProviders.size,
      expansionRatio: expandedProviders.size / originalProviders.size,
      multiKeyProviders,
      strategies
    };

    this.expansionResults = {
      expandedProviders,
      originalProviders,
      expansionStats
    };

    console.log(`🎯 Provider expansion completed:`, expansionStats);
    return this.expansionResults;
  }

  /**
   * Get expansion rule for a provider configuration
   */
  private getExpansionRule(config: any): ExpansionRule {
    const providerType = config.type || 'default';
    const rule = this.expansionRules.get(providerType);
    
    if (rule) {
      return rule;
    }

    // Default expansion rule
    return {
      strategy: 'multi-key-expansion',
      maxInstances: 10,
      keyRotationCooldownMs: 1000
    };
  }

  /**
   * Extract key data from provider configuration
   */
  private extractKeyData(config: any): { keys: string[], type: string } {
    const auth = config.authentication?.credentials;
    
    if (!auth) {
      return { keys: [], type: 'none' };
    }

    // Check for apiKeys array
    if (auth.apiKeys && Array.isArray(auth.apiKeys)) {
      return { keys: auth.apiKeys, type: 'apiKeys' };
    }

    // Check for single apiKey (convert to array)
    if (auth.apiKey) {
      const keys = Array.isArray(auth.apiKey) ? auth.apiKey : [auth.apiKey];
      return { keys, type: 'apiKey' };
    }

    // Check for legacy single apiKey at root level
    if (config.apiKey) {
      return { keys: [config.apiKey], type: 'legacy' };
    }

    return { keys: [], type: 'none' };
  }

  /**
   * Calculate weight for expanded provider
   */
  private calculateWeight(rule: ExpansionRule, keyIndex: number, totalKeys: number): number {
    if (rule.weightDistribution && rule.weightDistribution[keyIndex]) {
      return rule.weightDistribution[keyIndex];
    }

    // Equal weight distribution by default
    return 1.0 / totalKeys;
  }

  /**
   * Calculate priority for expanded provider
   */
  private calculatePriority(rule: ExpansionRule, keyIndex: number, totalKeys?: number): number {
    switch (rule.strategy) {
      case 'failover-expansion':
        return (totalKeys || 1) - keyIndex; // Higher index = lower priority
      default:
        return 1; // Equal priority
    }
  }

  /**
   * Generate key identifier for debugging
   */
  private generateKeyIdentifier(key: string, index: number): string {
    if (typeof key !== 'string') return `key-${index}`;
    
    // Generate safe identifier from key
    const prefix = key.substring(0, 8);
    const suffix = key.length > 8 ? `...${key.slice(-4)}` : '';
    return `${prefix}${suffix}`;
  }

  /**
   * Get expansion results
   */
  getExpansionResults(): ExpansionResult | null {
    return this.expansionResults;
  }

  /**
   * Find expanded providers for an original provider
   */
  findExpandedProviders(originalProviderId: string): ExpandedProviderInfo[] {
    if (!this.expansionResults) return [];

    return Array.from(this.expansionResults.expandedProviders.values())
      .filter(info => info.originalProviderId === originalProviderId);
  }

  /**
   * Get provider by expanded ID
   */
  getExpandedProvider(expandedProviderId: string): ExpandedProviderInfo | null {
    if (!this.expansionResults) return null;
    return this.expansionResults.expandedProviders.get(expandedProviderId) || null;
  }

  /**
   * Update routing configuration with expanded providers
   */
  updateRoutingConfig(routingConfig: any): any {
    if (!this.expansionResults) {
      console.warn('No expansion results available for routing update');
      return routingConfig;
    }

    const updatedRouting: any = {};

    for (const [category, categoryConfig] of Object.entries(routingConfig)) {
      if ((categoryConfig as any).providers) {
        // Handle provider arrays in routing
        const expandedProviderList = this.expandProviderList((categoryConfig as any).providers);
        updatedRouting[category] = {
          ...(categoryConfig as any),
          providers: expandedProviderList
        };
      } else if ((categoryConfig as any).provider) {
        // Handle single provider in routing
        const originalProvider = (categoryConfig as any).provider;
        const expandedProviders = this.findExpandedProviders(originalProvider);
        
        if (expandedProviders.length > 1) {
          // Convert to provider array
          updatedRouting[category] = {
            ...(categoryConfig as any),
            providers: expandedProviders.map(info => ({
              provider: info.providerId,
              model: (categoryConfig as any).model,
              weight: info.weight || 1.0
            }))
          };
          delete updatedRouting[category].provider;
        } else {
          // Keep single provider format
          updatedRouting[category] = categoryConfig;
        }
      } else {
        updatedRouting[category] = categoryConfig;
      }
    }

    console.log('✅ Routing configuration updated with expanded providers');
    return updatedRouting;
  }

  /**
   * Expand provider list in routing configuration
   */
  private expandProviderList(providers: any[]): any[] {
    const expandedList: any[] = [];

    for (const providerEntry of providers) {
      const originalProviderId = providerEntry.provider;
      const expandedProviders = this.findExpandedProviders(originalProviderId);

      if (expandedProviders.length > 1) {
        // Multi-key provider expansion
        for (const expandedProvider of expandedProviders) {
          expandedList.push({
            provider: expandedProvider.providerId,
            model: providerEntry.model,
            weight: expandedProvider.weight || providerEntry.weight || 1.0
          });
        }
      } else {
        // Single provider
        expandedList.push(providerEntry);
      }
    }

    return expandedList;
  }

  /**
   * Get expansion statistics
   */
  getExpansionStats(): any {
    if (!this.expansionResults) return null;
    return this.expansionResults.expansionStats;
  }
}

// Global provider expansion manager instance
export const providerExpansionManager = new ProviderExpansionManager();