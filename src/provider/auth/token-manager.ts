/**
 * Token Manager
 * Secure token storage and management with refresh capabilities
 */

export interface TokenInfo {
  token: string;
  expiresAt?: Date;
  refreshToken?: string;
  createdAt: Date;
  lastRefreshed?: Date;
}

export class TokenManager {
  private tokens: Map<string, TokenInfo> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    // In a real implementation, this would load tokens from secure storage
    // For now, we'll use in-memory storage
    this.initialized = true;
    console.log('✅ TokenManager initialized');
  }

  async storeToken(
    providerName: string, 
    token: string, 
    expiresAt?: Date, 
    refreshToken?: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('TokenManager not initialized');
    }

    const tokenInfo: TokenInfo = {
      token,
      expiresAt,
      refreshToken,
      createdAt: new Date(),
      lastRefreshed: new Date()
    };

    this.tokens.set(providerName, tokenInfo);

    // Set up automatic refresh if expiry is provided
    if (expiresAt) {
      this.scheduleTokenRefresh(providerName, expiresAt);
    }

    console.log(`✅ Token stored for provider '${providerName}'`);
  }

  getToken(providerName: string): string | undefined {
    const tokenInfo = this.tokens.get(providerName);
    
    if (!tokenInfo) {
      return undefined;
    }

    // Check if token is expired
    if (tokenInfo.expiresAt && new Date() >= tokenInfo.expiresAt) {
      console.warn(`Token for provider '${providerName}' has expired`);
      return undefined;
    }

    return tokenInfo.token;
  }

  getTokenInfo(providerName: string): TokenInfo | undefined {
    return this.tokens.get(providerName);
  }

  isTokenExpired(providerName: string): boolean {
    const tokenInfo = this.tokens.get(providerName);
    
    if (!tokenInfo || !tokenInfo.expiresAt) {
      return false; // No expiry means it doesn't expire
    }

    return new Date() >= tokenInfo.expiresAt;
  }

  isTokenExpiringSoon(providerName: string, thresholdMinutes: number = 5): boolean {
    const tokenInfo = this.tokens.get(providerName);
    
    if (!tokenInfo || !tokenInfo.expiresAt) {
      return false;
    }

    const thresholdMs = thresholdMinutes * 60 * 1000;
    const expiryTime = tokenInfo.expiresAt.getTime();
    const currentTime = Date.now();

    return (expiryTime - currentTime) <= thresholdMs;
  }

  async updateToken(
    providerName: string, 
    newToken: string, 
    expiresAt?: Date
  ): Promise<void> {
    const existingTokenInfo = this.tokens.get(providerName);
    
    if (!existingTokenInfo) {
      // If no existing token, create new one
      await this.storeToken(providerName, newToken, expiresAt);
      return;
    }

    // Update existing token info
    const updatedTokenInfo: TokenInfo = {
      ...existingTokenInfo,
      token: newToken,
      expiresAt,
      lastRefreshed: new Date()
    };

    this.tokens.set(providerName, updatedTokenInfo);

    // Clear existing refresh timer and set new one
    this.clearTokenRefreshTimer(providerName);
    if (expiresAt) {
      this.scheduleTokenRefresh(providerName, expiresAt);
    }

    console.log(`✅ Token updated for provider '${providerName}'`);
  }

  async removeToken(providerName: string): Promise<void> {
    this.tokens.delete(providerName);
    this.clearTokenRefreshTimer(providerName);
    console.log(`✅ Token removed for provider '${providerName}'`);
  }

  private scheduleTokenRefresh(providerName: string, expiresAt: Date): void {
    // Clear any existing timer
    this.clearTokenRefreshTimer(providerName);

    // Schedule refresh 5 minutes before expiry
    const refreshTime = expiresAt.getTime() - (5 * 60 * 1000); // 5 minutes before
    const currentTime = Date.now();

    if (refreshTime > currentTime) {
      const timeout = setTimeout(() => {
        this.triggerTokenRefresh(providerName);
      }, refreshTime - currentTime);

      this.refreshTimers.set(providerName, timeout);
      console.log(`⏰ Token refresh scheduled for provider '${providerName}' at ${new Date(refreshTime)}`);
    }
  }

  private clearTokenRefreshTimer(providerName: string): void {
    const timer = this.refreshTimers.get(providerName);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(providerName);
    }
  }

  private triggerTokenRefresh(providerName: string): void {
    // This would trigger the auth manager to refresh the token
    console.log(`🔄 Triggering token refresh for provider '${providerName}'`);
    
    // Emit an event or call a callback to notify that refresh is needed
    // In a real implementation, this would integrate with the AuthManager
    this.onTokenRefreshNeeded?.(providerName);
  }

  // Callback for when token refresh is needed
  onTokenRefreshNeeded?: (providerName: string) => void;

  setTokenRefreshCallback(callback: (providerName: string) => void): void {
    this.onTokenRefreshNeeded = callback;
  }

  // Get all tokens (for debugging/monitoring)
  getAllTokens(): Map<string, Omit<TokenInfo, 'token' | 'refreshToken'>> {
    const sanitizedTokens = new Map();
    
    for (const [providerName, tokenInfo] of this.tokens) {
      sanitizedTokens.set(providerName, {
        expiresAt: tokenInfo.expiresAt,
        createdAt: tokenInfo.createdAt,
        lastRefreshed: tokenInfo.lastRefreshed
      });
    }
    
    return sanitizedTokens;
  }

  // Get token statistics
  getTokenStats(): {
    totalTokens: number;
    expiredTokens: number;
    expiringSoonTokens: number;
    validTokens: number;
  } {
    const stats = {
      totalTokens: this.tokens.size,
      expiredTokens: 0,
      expiringSoonTokens: 0,
      validTokens: 0
    };

    for (const [providerName] of this.tokens) {
      if (this.isTokenExpired(providerName)) {
        stats.expiredTokens++;
      } else if (this.isTokenExpiringSoon(providerName)) {
        stats.expiringSoonTokens++;
      } else {
        stats.validTokens++;
      }
    }

    return stats;
  }

  // Clean up expired tokens
  async cleanupExpiredTokens(): Promise<number> {
    let cleanedCount = 0;
    
    for (const [providerName] of this.tokens) {
      if (this.isTokenExpired(providerName)) {
        await this.removeToken(providerName);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired tokens`);
    }

    return cleanedCount;
  }

  // Start automatic cleanup of expired tokens
  startAutomaticCleanup(intervalMinutes: number = 60): void {
    setInterval(async () => {
      await this.cleanupExpiredTokens();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`✅ Automatic token cleanup started (interval: ${intervalMinutes} minutes)`);
  }

  // Validate token format (basic validation)
  validateTokenFormat(token: string, providerType: string): boolean {
    switch (providerType) {
      case 'anthropic':
        return token.startsWith('sk-ant-') && token.length > 20;
      case 'openai':
        return token.startsWith('sk-') && token.length > 20;
      case 'gemini':
        return token.length > 20; // Gemini API keys don't have a specific prefix
      case 'aws-credentials':
        return token.startsWith('AKIA') || token.startsWith('ASIA'); // AWS access key format
      default:
        return token.length > 10; // Basic length check
    }
  }

  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();

    // Clear all tokens
    this.tokens.clear();

    this.initialized = false;
    console.log('✅ TokenManager shutdown completed');
  }
}

console.log('✅ TokenManager loaded');