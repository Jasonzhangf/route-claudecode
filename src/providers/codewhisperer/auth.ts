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
  profileArn?: string;
  authMethod?: string;
  provider?: string;
  // Track when this specific token was last refreshed
  lastRefreshedBy?: string;
  lastRefreshTime?: string;
  // Allow any additional fields to preserve original token structure
  [key: string]: any;
}

export class CodeWhispererAuth {
  private tokenPath: string;
  private lastRefreshFilePath: string;
  private cachedToken: TokenData | null = null;
  private lastRefreshTime: Date | null = null;
  private readonly MIN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum between refreshes
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<TokenData> | null = null;
  
  // Token validation state
  private tokenInvalid: boolean = false;
  private lastValidationTime: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private lastRefreshAttempt: Date | null = null;
  private readonly REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

  constructor(customTokenPath?: string) {
    this.tokenPath = customTokenPath ? this.expandPath(customTokenPath) : this.getTokenFilePath();
    this.lastRefreshFilePath = this.getLastRefreshFilePath();
    this.loadLastRefreshTime();
    // No periodic refresh - use monitoring-based approach
  }

  /**
   * Expand path with ~ support
   */
  private expandPath(path: string): string {
    if (path.startsWith('~/')) {
      return join(homedir(), path.slice(2));
    }
    return path;
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
   * Check if this specific token can be refreshed (30-minute minimum since last refresh)
   */
  private canRefreshToken(tokenData: TokenData): boolean {
    // If token doesn't have lastRefreshTime, it hasn't been refreshed by us, allow refresh
    if (!tokenData.lastRefreshTime) {
      logger.debug('Token has no refresh history, allowing refresh');
      return true;
    }
    
    const lastRefreshTime = new Date(tokenData.lastRefreshTime);
    const timeSinceLastRefresh = Date.now() - lastRefreshTime.getTime();
    const canRefresh = timeSinceLastRefresh >= this.MIN_REFRESH_INTERVAL;
    
    logger.debug('Token-specific refresh interval check', {
      tokenLastRefreshTime: lastRefreshTime.toISOString(),
      timeSinceLastRefresh: `${Math.floor(timeSinceLastRefresh / (60 * 1000))} minutes`,
      minInterval: `${this.MIN_REFRESH_INTERVAL / (60 * 1000)} minutes`,
      canRefresh,
      accessTokenPrefix: tokenData.accessToken.substring(0, 20) + '...'
    });
    
    if (!canRefresh) {
      const remainingTime = Math.ceil((this.MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / (60 * 1000));
      logger.warn(`Token refresh blocked - ${remainingTime} minutes remaining since last refresh of this token`);
    }
    
    return canRefresh;
  }

  /**
   * Get current token - non-blocking, uses cached token
   * Background thread handles refresh every 10 minutes
   */
  async getToken(): Promise<string> {
    // Check if token has been marked as invalid due to consecutive failures
    if (this.tokenInvalid) {
      // Check if cooldown period has passed
      if (this.lastRefreshAttempt) {
        const timeSinceLast = Date.now() - this.lastRefreshAttempt.getTime();
        if (timeSinceLast < this.REFRESH_COOLDOWN_MS) {
          const remainingMinutes = Math.ceil((this.REFRESH_COOLDOWN_MS - timeSinceLast) / (60 * 1000));
          throw new Error(`Token blocked due to ${this.consecutiveFailures} consecutive authentication failures. Cannot retry for ${remainingMinutes} more minutes.`);
        } else {
          // Cooldown has passed, allow one more attempt by resetting state
          logger.info('Cooldown period passed, allowing token refresh attempt');
          this.tokenInvalid = false;
          this.consecutiveFailures = 0;
          this.lastRefreshAttempt = null;
        }
      } else {
        throw new Error(`Token blocked due to ${this.consecutiveFailures} consecutive authentication failures. Please refresh your token manually.`);
      }
    }
    
    try {
      // If we have a valid cached token, return it immediately
      if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
        logger.debug('Using cached valid token');
        this.resetFailureCount(); // Reset on successful use
        return this.cachedToken.accessToken;
      }
      
      // If we're currently refreshing, wait for that to complete
      if (this.isRefreshing && this.refreshPromise) {
        logger.debug('Token refresh in progress, waiting...');
        const refreshedToken = await this.refreshPromise;
        return refreshedToken.accessToken;
      }
      
      // Read token from file
      logger.debug('Reading token from file');
      const tokenData = this.readTokenFromFile();
      
      // Check token validity
      const isValid = this.isTokenValid(tokenData);
      logger.debug('Token validation result', {
        expiresAt: tokenData.expiresAt,
        isValid,
        currentTime: new Date().toISOString()
      });
      
      // If file token is valid, cache and return it
      if (isValid) {
        logger.debug('Token is valid, caching for future use');
        this.cachedToken = tokenData;
        this.resetFailureCount(); // Reset on successful validation
        return tokenData.accessToken;
      }
      
      // Token is expired, attempt refresh if allowed
      logger.info('Token is expired, attempting refresh', {
        expiresAt: tokenData.expiresAt,
        currentTime: new Date().toISOString()
      });
      
      const refreshedToken = await this.performRefresh(tokenData);
      logger.info('Token refresh completed successfully');
      // NOTE: Don't reset failure count here - only reset on successful API call
      // this.resetFailureCount(); // Reset on successful refresh
      return refreshedToken.accessToken;
      
    } catch (error) {
      logger.error('Failed to get CodeWhisperer token', {
        error: error instanceof Error ? error.message : String(error),
        tokenPath: this.tokenPath
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`CodeWhisperer authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Read token data from file
   */
  public readTokenFromFile(): TokenData {
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
    
    // Reduce buffer to 2 minutes to handle timezone edge cases
    // This ensures we don't prematurely invalidate tokens due to timezone differences
    return expiryTime.getTime() - now.getTime() > 2 * 60 * 1000;
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

      // Calculate expiresAt from expiresIn (API returns seconds, we need ISO timestamp)
      const expiresAt = response.data.expiresAt || 
        (response.data.expiresIn ? new Date(Date.now() + response.data.expiresIn * 1000).toISOString() : null);

      // Preserve all original fields and only update the refreshed ones
      const newTokenData: TokenData = {
        ...currentToken, // Keep all original fields
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresAt: expiresAt,
        profileArn: response.data.profileArn || currentToken.profileArn,
        // Mark when and by whom this token was refreshed
        lastRefreshedBy: 'claude-code-router',
        lastRefreshTime: new Date().toISOString()
      };

      // Save new token to file
      this.saveTokenToFile(newTokenData);
      
      logger.debug('Token refreshed successfully', {
        preservedFields: Object.keys(currentToken),
        updatedFields: ['accessToken', 'refreshToken', 'expiresAt']
      });
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
   * Report authentication failure - used by client to track failures
   */
  reportAuthFailure(): void {
    this.consecutiveFailures++;
    this.lastValidationTime = new Date();
    this.lastRefreshAttempt = new Date(); // Track when we last attempted refresh
    
    logger.warn(`Authentication failure reported (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`, {
      consecutiveFailures: this.consecutiveFailures,
      maxFailures: this.MAX_CONSECUTIVE_FAILURES,
      refreshCooldownUntil: new Date(Date.now() + this.REFRESH_COOLDOWN_MS).toISOString()
    });
    
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.tokenInvalid = true;
      logger.error(`Token marked as invalid due to ${this.consecutiveFailures} consecutive failures. API calls will be blocked for 10 minutes.`);
    }
    
    // Clear cached token on any auth failure
    this.clearCache();
  }

  /**
   * Reset failure count (called on successful authentication)
   */
  resetFailureCount(): void {
    if (this.consecutiveFailures > 0) {
      logger.debug(`Resetting failure count (was ${this.consecutiveFailures})`);
      this.consecutiveFailures = 0;
      this.tokenInvalid = false;
    }
  }

  /**
   * Check if token is currently blocked due to failures
   */
  isTokenBlocked(): boolean {
    if (!this.tokenInvalid) {
      return false;
    }
    
    // If token is invalid, check if cooldown period has passed
    if (this.lastRefreshAttempt) {
      const timeSinceLast = Date.now() - this.lastRefreshAttempt.getTime();
      return timeSinceLast < this.REFRESH_COOLDOWN_MS;
    }
    
    return true;
  }

  /**
   * Get remaining cooldown time in minutes
   */
  getRemainingCooldownMinutes(): number {
    if (!this.tokenInvalid || !this.lastRefreshAttempt) {
      return 0;
    }
    
    const timeSinceLast = Date.now() - this.lastRefreshAttempt.getTime();
    if (timeSinceLast >= this.REFRESH_COOLDOWN_MS) {
      return 0;
    }
    
    return Math.ceil((this.REFRESH_COOLDOWN_MS - timeSinceLast) / (60 * 1000));
  }

  /**
   * Manually unblock token (for recovery scenarios)
   */
  unblockToken(): void {
    logger.info('Manually unblocking token');
    this.tokenInvalid = false;
    this.consecutiveFailures = 0;
    this.clearCache();
  }

  
  /**
   * Perform actual token refresh with proper synchronization
   */
  private async performRefresh(currentToken: TokenData): Promise<TokenData> {
    // Prevent concurrent refreshes
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // Double-check 30-minute interval for this specific token before actual refresh
    if (!this.canRefreshToken(currentToken)) {
      throw new Error('Token refresh blocked - 30-minute minimum interval not met for this token');
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
      const canRefresh = this.canRefreshToken(tokenData);
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
        monitoringEnabled: true,
        minRefreshInterval: `${this.MIN_REFRESH_INTERVAL / (60 * 1000)} minutes`,
        // Monitoring state
        isBlocked: this.isTokenBlocked(),
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.MAX_CONSECUTIVE_FAILURES,
        remainingCooldownMinutes: this.getRemainingCooldownMinutes(),
        lastFailureTime: this.lastRefreshAttempt?.toISOString()
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
    this.clearCache();
  }
}