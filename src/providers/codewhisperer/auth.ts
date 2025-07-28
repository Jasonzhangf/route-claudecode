/**
 * CodeWhisperer Authentication Module
 * Handles AWS SSO token management for CodeWhisperer
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import axios from 'axios';
import { logger } from '@/utils/logger';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
}

export class CodeWhispererAuth {
  private tokenPath: string;
  private lastRefreshFilePath: string;
  private cachedToken: TokenData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastRefreshTime: Date | null = null;
  private readonly REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly MIN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum between refreshes
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<TokenData> | null = null;

  constructor() {
    this.tokenPath = this.getTokenFilePath();
    this.lastRefreshFilePath = this.getLastRefreshFilePath();
    this.loadLastRefreshTime();
    this.startPeriodicRefresh();
  }

  /**
   * Get the platform-specific token file path
   */
  private getTokenFilePath(): string {
    const homeDir = homedir();
    return join(homeDir, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  }

  /**
   * Get the path for storing last refresh time
   */
  private getLastRefreshFilePath(): string {
    const homeDir = homedir();
    return join(homeDir, '.claude-code-router', 'last-token-refresh.json');
  }

  /**
   * Load last refresh time from persistent storage
   */
  private loadLastRefreshTime(): void {
    try {
      if (existsSync(this.lastRefreshFilePath)) {
        const data = readFileSync(this.lastRefreshFilePath, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed.lastRefreshTime) {
          this.lastRefreshTime = new Date(parsed.lastRefreshTime);
          logger.debug(`Loaded last refresh time: ${this.lastRefreshTime.toISOString()}`);
        }
      }
    } catch (error) {
      logger.debug('Failed to load last refresh time, starting fresh', error);
      this.lastRefreshTime = null;
    }
  }

  /**
   * Save last refresh time to persistent storage
   */
  private saveLastRefreshTime(): void {
    try {
      const data = {
        lastRefreshTime: this.lastRefreshTime?.toISOString()
      };
      writeFileSync(this.lastRefreshFilePath, JSON.stringify(data, null, 2), { mode: 0o600 });
      logger.debug(`Saved last refresh time: ${this.lastRefreshTime?.toISOString()}`);
    } catch (error) {
      logger.error('Failed to save last refresh time', error);
    }
  }

  /**
   * Check if enough time has passed since last refresh (30-minute minimum)
   */
  private canRefreshToken(): boolean {
    if (!this.lastRefreshTime) {
      return true;
    }
    
    const timeSinceLastRefresh = Date.now() - this.lastRefreshTime.getTime();
    const canRefresh = timeSinceLastRefresh >= this.MIN_REFRESH_INTERVAL;
    
    if (!canRefresh) {
      const remainingTime = Math.ceil((this.MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000));
      logger.debug(`Token refresh blocked - ${remainingTime} minutes remaining until next allowed refresh`);
    }
    
    return canRefresh;
  }

  /**
   * Get current token - non-blocking, uses cached token
   * Background thread handles refresh every 10 minutes
   */
  async getToken(): Promise<string> {
    try {
      // If we have a valid cached token, return it immediately
      if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
        return this.cachedToken.accessToken;
      }
      
      // If we're currently refreshing, wait for that to complete
      if (this.isRefreshing && this.refreshPromise) {
        logger.debug('Token refresh in progress, waiting...');
        const refreshedToken = await this.refreshPromise;
        return refreshedToken.accessToken;
      }
      
      // Read token from file as fallback
      const tokenData = this.readTokenFromFile();
      
      // If file token is valid, use it and trigger background refresh
      if (this.isTokenValid(tokenData)) {
        this.cachedToken = tokenData;
        // Trigger background refresh without waiting
        this.triggerBackgroundRefresh();
        return tokenData.accessToken;
      }
      
      // Token is expired, do a blocking refresh this one time
      logger.debug('Token expired, performing blocking refresh...');
      const refreshedToken = await this.performRefresh(tokenData);
      return refreshedToken.accessToken;
    } catch (error) {
      logger.error('Failed to get CodeWhisperer token', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`CodeWhisperer authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Read token data from file
   */
  private readTokenFromFile(): TokenData {
    if (!existsSync(this.tokenPath)) {
      throw new Error(`Token file not found at ${this.tokenPath}. Please install Kiro and login.`);
    }

    try {
      const data = readFileSync(this.tokenPath, 'utf8');
      const tokenData = JSON.parse(data) as TokenData;
      
      if (!tokenData.accessToken || !tokenData.refreshToken) {
        throw new Error('Invalid token file format');
      }

      return tokenData;
    } catch (error) {
      throw new Error(`Failed to read token file: ${error}`);
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(token: TokenData): boolean {
    if (!token.expiresAt) {
      // If no expiry date, assume valid for 1 hour from read
      return true;
    }

    const expiryTime = new Date(token.expiresAt);
    const now = new Date();
    
    // Add 5 minute buffer before expiry
    return expiryTime.getTime() - now.getTime() > 5 * 60 * 1000;
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: TokenData): boolean {
    return !this.isTokenValid(token);
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken(currentToken: TokenData): Promise<TokenData> {
    try {
      const refreshRequest = {
        refreshToken: currentToken.refreshToken
      };

      const response = await axios.post(
        process.env.CODEWHISPERER_AUTH_ENDPOINT || 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
        refreshRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status !== 200) {
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const newTokenData: TokenData = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresAt: response.data.expiresAt
      };

      // Save new token to file
      this.saveTokenToFile(newTokenData);
      
      logger.debug('Token refreshed successfully');
      return newTokenData;
    } catch (error) {
      logger.error('Failed to refresh token', error);
      throw new Error('Token refresh failed. Please re-login to Kiro.');
    }
  }

  /**
   * Save token data to file
   */
  private saveTokenToFile(tokenData: TokenData): void {
    try {
      const jsonData = JSON.stringify(tokenData, null, 2);
      writeFileSync(this.tokenPath, jsonData, { mode: 0o600 });
    } catch (error) {
      logger.error('Failed to save token to file', error);
      throw new Error('Failed to save refreshed token');
    }
  }

  /**
   * Validate token by making a test request
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Make a simple request to CodeWhisperer to validate token
      const response = await axios.get(
        process.env.CODEWHISPERER_HEALTH_ENDPOINT || 'https://codewhisperer.us-east-1.amazonaws.com/health', // Health endpoint
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.debug('Token validation failed', error);
      return false;
    }
  }

  /**
   * Clear cached token (force refresh on next request)
   */
  clearCache(): void {
    this.cachedToken = null;
  }

  /**
   * Start periodic token refresh every 10 minutes in background
   */
  private startPeriodicRefresh(): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.triggerBackgroundRefresh();
    }, this.REFRESH_INTERVAL);

    logger.debug('Started periodic token refresh timer (10-minute interval)');
  }
  
  /**
   * Trigger background token refresh (non-blocking)
   */
  private triggerBackgroundRefresh(): void {
    // Don't start multiple refresh operations
    if (this.isRefreshing) {
      return;
    }
    
    // Check if we can refresh (30-minute minimum interval)
    if (!this.canRefreshToken()) {
      logger.debug('Background refresh skipped - 30-minute minimum interval not met');
      return;
    }
    
    // Run refresh in background without blocking
    setImmediate(async () => {
      try {
        const tokenData = this.readTokenFromFile();
        await this.performRefresh(tokenData);
      } catch (error) {
        logger.error('Background token refresh failed', error);
      }
    });
  }
  
  /**
   * Perform actual token refresh with proper synchronization
   */
  private async performRefresh(currentToken: TokenData): Promise<TokenData> {
    // Prevent concurrent refreshes
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // Double-check 30-minute interval before actual refresh
    if (!this.canRefreshToken()) {
      throw new Error('Token refresh blocked - 30-minute minimum interval not met');
    }
    
    this.isRefreshing = true;
    this.refreshPromise = this.refreshToken(currentToken);
    
    try {
      const refreshedToken = await this.refreshPromise;
      this.cachedToken = refreshedToken;
      this.lastRefreshTime = new Date();
      this.saveLastRefreshTime(); // Persist the refresh time
      logger.debug('Token refresh completed successfully');
      return refreshedToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Stop periodic refresh (for cleanup)
   */
  stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logger.debug('Stopped periodic token refresh timer');
    }
  }

  /**
   * Get authentication headers for CodeWhisperer requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router/2.0.0'
    };
  }

  /**
   * Get token info for debugging
   */
  async getTokenInfo(): Promise<any> {
    try {
      const tokenData = this.readTokenFromFile();
      const timeSinceLastRefresh = this.lastRefreshTime ? Date.now() - this.lastRefreshTime.getTime() : null;
      const canRefresh = this.canRefreshToken();
      const minutesUntilNextRefresh = this.lastRefreshTime && !canRefresh 
        ? Math.ceil((this.MIN_REFRESH_INTERVAL - (Date.now() - this.lastRefreshTime.getTime())) / (60 * 1000))
        : 0;
      
      return {
        hasAccessToken: !!tokenData.accessToken,
        hasRefreshToken: !!tokenData.refreshToken,
        expiresAt: tokenData.expiresAt,
        isValid: this.isTokenValid(tokenData),
        lastRefreshTime: this.lastRefreshTime?.toISOString(),
        timeSinceLastRefresh: timeSinceLastRefresh ? `${Math.floor(timeSinceLastRefresh / (60 * 1000))} minutes` : null,
        canRefreshNow: canRefresh,
        minutesUntilNextRefresh: minutesUntilNextRefresh,
        periodicRefreshActive: !!this.refreshTimer,
        minRefreshInterval: `${this.MIN_REFRESH_INTERVAL / (60 * 1000)} minutes`
      };
    } catch (error) {
      return {
        error: (error as Error).message
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicRefresh();
    this.clearCache();
  }
}