/**
 * Authentication Health Monitor
 * Monitors authentication status and health across all providers
 */

export interface AuthHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  failureCount: number;
  consecutiveFailures: number;
  errorMessage?: string;
}

export interface AuthProvider {
  validateToken(): Promise<boolean>;
  isTokenValid(): boolean;
  getToken(): string | undefined;
}

export class AuthHealthMonitor {
  private healthStatuses: Map<string, AuthHealthStatus> = new Map();
  private providers: Map<string, AuthProvider> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('✅ AuthHealthMonitor initialized');
  }

  addProvider(name: string, provider: AuthProvider): void {
    if (!this.initialized) {
      throw new Error('AuthHealthMonitor not initialized');
    }

    this.providers.set(name, provider);
    
    // Initialize health status
    this.healthStatuses.set(name, {
      status: 'unknown',
      lastCheck: new Date(),
      failureCount: 0,
      consecutiveFailures: 0
    });

    console.log(`✅ Auth provider '${name}' added to health monitoring`);
  }

  removeProvider(name: string): void {
    this.providers.delete(name);
    this.healthStatuses.delete(name);
    console.log(`✅ Auth provider '${name}' removed from health monitoring`);
  }

  updateAuthStatus(providerName: string, status: 'healthy' | 'unhealthy', errorMessage?: string): void {
    const currentStatus = this.healthStatuses.get(providerName);
    
    if (!currentStatus) {
      console.warn(`Provider '${providerName}' not found in health monitor`);
      return;
    }

    const now = new Date();
    const updatedStatus: AuthHealthStatus = {
      ...currentStatus,
      status,
      lastCheck: now,
      errorMessage
    };

    if (status === 'healthy') {
      updatedStatus.lastSuccess = now;
      updatedStatus.consecutiveFailures = 0;
    } else if (status === 'unhealthy') {
      updatedStatus.lastFailure = now;
      updatedStatus.failureCount++;
      updatedStatus.consecutiveFailures++;
    }

    this.healthStatuses.set(providerName, updatedStatus);
  }

  async checkProviderHealth(providerName: string): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      return 'unknown';
    }

    try {
      const isValid = await provider.validateToken();
      const status = isValid ? 'healthy' : 'unhealthy';
      
      this.updateAuthStatus(providerName, status);
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateAuthStatus(providerName, 'unhealthy', errorMessage);
      return 'unhealthy';
    }
  }

  async checkAllProvidersHealth(): Promise<Map<string, 'healthy' | 'unhealthy' | 'unknown'>> {
    const results = new Map<string, 'healthy' | 'unhealthy' | 'unknown'>();

    const healthChecks = Array.from(this.providers.keys()).map(async (providerName) => {
      const status = await this.checkProviderHealth(providerName);
      return [providerName, status] as const;
    });

    const healthResults = await Promise.all(healthChecks);
    
    for (const [providerName, status] of healthResults) {
      results.set(providerName, status);
    }

    return results;
  }

  getAuthStatus(providerName: string): 'healthy' | 'unhealthy' | 'unknown' {
    const status = this.healthStatuses.get(providerName);
    return status?.status || 'unknown';
  }

  getAllAuthStatuses(): Map<string, 'healthy' | 'unhealthy' | 'unknown'> {
    const statuses = new Map<string, 'healthy' | 'unhealthy' | 'unknown'>();
    
    for (const [providerName, healthStatus] of this.healthStatuses) {
      statuses.set(providerName, healthStatus.status);
    }
    
    return statuses;
  }

  getDetailedHealthStatus(providerName: string): AuthHealthStatus | undefined {
    return this.healthStatuses.get(providerName);
  }

  getAllDetailedHealthStatuses(): Map<string, AuthHealthStatus> {
    return new Map(this.healthStatuses);
  }

  // Start continuous health monitoring
  startMonitoring(intervalMs: number = 300000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkAllProvidersHealth();
    }, intervalMs);

    console.log(`✅ Auth health monitoring started (interval: ${intervalMs}ms)`);
  }

  // Stop continuous health monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('✅ Auth health monitoring stopped');
    }
  }

  // Get providers that need attention
  getProvidersNeedingAttention(): {
    unhealthy: string[];
    highFailureRate: string[];
    consecutiveFailures: string[];
  } {
    const result = {
      unhealthy: [] as string[],
      highFailureRate: [] as string[],
      consecutiveFailures: [] as string[]
    };

    for (const [providerName, status] of this.healthStatuses) {
      if (status.status === 'unhealthy') {
        result.unhealthy.push(providerName);
      }

      // High failure rate (more than 50% failures in recent checks)
      if (status.failureCount > 0 && status.consecutiveFailures > 2) {
        result.highFailureRate.push(providerName);
      }

      // Multiple consecutive failures
      if (status.consecutiveFailures >= 3) {
        result.consecutiveFailures.push(providerName);
      }
    }

    return result;
  }

  // Get health statistics
  getHealthStats(): {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    unknownProviders: number;
    averageFailureRate: number;
    providersWithRecentFailures: number;
  } {
    const stats = {
      totalProviders: this.healthStatuses.size,
      healthyProviders: 0,
      unhealthyProviders: 0,
      unknownProviders: 0,
      averageFailureRate: 0,
      providersWithRecentFailures: 0
    };

    let totalFailures = 0;
    let totalChecks = 0;

    for (const [_, status] of this.healthStatuses) {
      switch (status.status) {
        case 'healthy':
          stats.healthyProviders++;
          break;
        case 'unhealthy':
          stats.unhealthyProviders++;
          break;
        case 'unknown':
          stats.unknownProviders++;
          break;
      }

      totalFailures += status.failureCount;
      totalChecks += status.failureCount + (status.lastSuccess ? 1 : 0);

      if (status.consecutiveFailures > 0) {
        stats.providersWithRecentFailures++;
      }
    }

    stats.averageFailureRate = totalChecks > 0 ? (totalFailures / totalChecks) * 100 : 0;

    return stats;
  }

  // Reset health statistics for a provider
  resetProviderStats(providerName: string): void {
    const status = this.healthStatuses.get(providerName);
    
    if (status) {
      status.failureCount = 0;
      status.consecutiveFailures = 0;
      status.errorMessage = undefined;
      this.healthStatuses.set(providerName, status);
      
      console.log(`✅ Health stats reset for provider '${providerName}'`);
    }
  }

  // Reset all health statistics
  resetAllStats(): void {
    for (const [providerName] of this.healthStatuses) {
      this.resetProviderStats(providerName);
    }
    
    console.log('✅ All health stats reset');
  }

  // Get providers that haven't been checked recently
  getStaleProviders(thresholdMinutes: number = 30): string[] {
    const threshold = new Date(Date.now() - (thresholdMinutes * 60 * 1000));
    const staleProviders: string[] = [];

    for (const [providerName, status] of this.healthStatuses) {
      if (status.lastCheck < threshold) {
        staleProviders.push(providerName);
      }
    }

    return staleProviders;
  }

  // Force health check for stale providers
  async refreshStaleProviders(thresholdMinutes: number = 30): Promise<void> {
    const staleProviders = this.getStaleProviders(thresholdMinutes);
    
    if (staleProviders.length > 0) {
      console.log(`🔄 Refreshing ${staleProviders.length} stale providers`);
      
      for (const providerName of staleProviders) {
        await this.checkProviderHealth(providerName);
      }
    }
  }

  // Export health data for analysis
  exportHealthData(): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (const [providerName, status] of this.healthStatuses) {
      data[providerName] = {
        status: status.status,
        lastCheck: status.lastCheck.toISOString(),
        lastSuccess: status.lastSuccess?.toISOString(),
        lastFailure: status.lastFailure?.toISOString(),
        failureCount: status.failureCount,
        consecutiveFailures: status.consecutiveFailures,
        errorMessage: status.errorMessage
      };
    }
    
    return data;
  }

  async shutdown(): Promise<void> {
    this.stopMonitoring();
    this.providers.clear();
    this.healthStatuses.clear();
    this.initialized = false;
    console.log('✅ AuthHealthMonitor shutdown completed');
  }
}

console.log('✅ AuthHealthMonitor loaded');