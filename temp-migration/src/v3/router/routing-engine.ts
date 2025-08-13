/**
 * Routing Engine - Core routing logic for the six-layer architecture
 * Enhanced compatibility with v2.7.0 router-server interface
 */

import { RouterConfig, BaseRequest, ProviderConfig, RoutingCategory, CategoryRouting } from '../types/index.js';

export class RoutingEngine {
  private routingConfig: Record<RoutingCategory, CategoryRouting>;
  private stats: any = {};
  private providerStats: Map<string, any> = new Map();
  private temporarilyDisabled: Set<string> = new Set();

  constructor(routingConfig: Record<RoutingCategory, CategoryRouting>) {
    this.routingConfig = routingConfig;
  }

  /**
   * Route a request to the appropriate provider based on category
   */
  async route(request: BaseRequest, requestId: string): Promise<string> {
    const category = this.determineCategory(request);
    const routing = this.routingConfig[category];
    
    if (!routing) {
      throw new Error(`No routing configuration found for category: ${category}`);
    }

    // Handle both array format (providers) and simple format (provider)
    let providers: any[];
    if (routing.providers) {
      // Array format: { providers: [{ provider: "...", model: "..." }] }
      providers = routing.providers;
    } else if (routing.provider) {
      // Simple format: { provider: "...", model: "..." }
      providers = [{ provider: routing.provider, model: routing.model }];
    } else {
      throw new Error(`No providers configured for category: ${category}`);
    }

    if (!providers || providers.length === 0) {
      throw new Error(`No providers configured for category: ${category}`);
    }

    // Filter out temporarily disabled providers
    const availableProviders = providers.filter(p => !this.temporarilyDisabled.has(p.provider));
    if (availableProviders.length === 0) {
      throw new Error(`No available providers for category: ${category} (all temporarily disabled)`);
    }

    const selectedProvider = availableProviders[0];
    
    // Set target model for the request
    if (selectedProvider.model) {
      request.metadata = { ...request.metadata, targetModel: selectedProvider.model };
    } else if (routing.model) {
      request.metadata = { ...request.metadata, targetModel: routing.model };
    }

    return selectedProvider.provider; // Return the provider ID
  }

  private determineCategory(request: BaseRequest): RoutingCategory {
    // Simple category determination logic
    // This can be enhanced based on request analysis
    return 'default';
  }

  // Compatibility methods for router-server.ts
  getStats(): any {
    return {
      totalRequests: 0,
      successRate: 100,
      providerHealth: {}
    };
  }

  getStatsSummary(): any {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
  }

  getResponseStats(): any {
    return {};
  }

  isProviderTemporarilyDisabled(providerId: string): boolean {
    return this.temporarilyDisabled.has(providerId);
  }

  temporarilyDisableProvider(providerId: string): boolean {
    this.temporarilyDisabled.add(providerId);
    return true;
  }

  temporarilyEnableProvider(providerId: string): boolean {
    return this.temporarilyDisabled.delete(providerId);
  }

  getTemporarilyDisabledProviders(): string[] {
    return Array.from(this.temporarilyDisabled);
  }

  recordProviderResult(
    providerId: string,
    success: boolean,
    error?: string,
    statusCode?: number,
    model?: string,
    responseTime?: number
  ): void {
    // Record provider statistics
    if (!this.providerStats.has(providerId)) {
      this.providerStats.set(providerId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0
      });
    }

    const stats = this.providerStats.get(providerId);
    stats.totalRequests++;
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
  }

  updateConfig(config: Record<RoutingCategory, CategoryRouting>): void {
    this.routingConfig = config;
  }
}