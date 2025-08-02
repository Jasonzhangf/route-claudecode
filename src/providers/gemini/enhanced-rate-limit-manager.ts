/**
 * Enhanced Gemini Rate Limit Manager
 * Intelligent 429 error handling with Round Robin key rotation and model fallback
 * Project Owner: Jason Zhang
 */

interface RateLimitState {
  keyIndex: number;
  rpm: number;
  tpm: number;
  rpd: number;
  rpmResetTime: number;
  tpmResetTime: number;
  rpdResetTime: number;
  lastRequestTime: number;
}

interface RateLimitConfig {
  rpm: number;
  tpm: number;
  rpd: number;
}

interface KeyRotationResult {
  apiKey: string;
  model: string;
  keyIndex: number;
  fallbackApplied: boolean;
  fallbackReason?: string;
}

/**
 * Enhanced Gemini Rate Limit Manager
 * 
 * Features:
 * - Round Robin key rotation: key1→key2→key3→key1
 * - Model fallback hierarchy: gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash-8b
 * - RPD tracking with 24-hour reset
 * - Global fallback to gemini-2.5-flash-lite when all keys exhausted
 */
export class EnhancedRateLimitManager {
  private apiKeys: string[];
  private state: Map<string, RateLimitState> = new Map();
  private providerId: string;
  
  // Google Free Tier Rate Limits (per key)
  private readonly rateLimits: Record<string, RateLimitConfig> = {
    'gemini-2.5-pro': { rpm: 2, tpm: 32000, rpd: 50 },
    'gemini-2.5-flash': { rpm: 15, tpm: 1000000, rpd: 1500 },
    'gemini-2.0-flash': { rpm: 15, tpm: 1000000, rpd: 1500 },
    'gemini-1.5-flash-8b': { rpm: 15, tpm: 1000000, rpd: 1500 },
    'gemini-2.5-flash-lite': { rpm: 15, tpm: 1000000, rpd: 1500 } // Global fallback
  };
  
  // Model fallback hierarchy
  private readonly modelFallbackHierarchy: Record<string, string[]> = {
    'gemini-2.5-pro': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'],
    'gemini-2.5-flash': ['gemini-2.0-flash', 'gemini-1.5-flash-8b'],
    'gemini-2.0-flash': ['gemini-1.5-flash-8b'],
    'gemini-1.5-flash-8b': [] // No further fallback
  };

  constructor(apiKeys: string[], providerId: string = 'gemini') {
    this.apiKeys = apiKeys.filter(key => key && key.trim());
    this.providerId = providerId;
    
    if (this.apiKeys.length === 0) {
      throw new Error('At least one API key is required for Enhanced Rate Limit Manager');
    }
    
    // Initialize state for each key
    this.apiKeys.forEach((_, index) => {
      this.initializeKeyState(`key-${index}`);
    });
    
    console.log(`🔧 Enhanced Rate Limit Manager initialized with ${this.apiKeys.length} keys`);
  }

  private initializeKeyState(keyId: string): void {
    const now = Date.now();
    this.state.set(keyId, {
      keyIndex: 0,
      rpm: 0,
      tpm: 0,
      rpd: 0,
      rpmResetTime: now + 60000, // 1 minute
      tpmResetTime: now + 60000, // 1 minute  
      rpdResetTime: now + 86400000, // 24 hours
      lastRequestTime: 0
    });
  }

  /**
   * Get available API key and model with intelligent fallback
   */
  getAvailableKeyAndModel(
    requestedModel: string, 
    estimatedTokens: number = 1000,
    requestId?: string
  ): KeyRotationResult {
    const now = Date.now();
    
    // First try: Round Robin across all keys for requested model
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const keyIndex = attempt % this.apiKeys.length;
      const keyId = `key-${keyIndex}`;
      const state = this.state.get(keyId)!;
      
      // Reset counters if time windows have expired
      this.resetExpiredCounters(state, now);
      
      if (this.canUseKey(state, requestedModel, estimatedTokens)) {
        this.updateUsage(state, requestedModel, estimatedTokens);
        
        console.log(`✅ Selected key ${keyIndex + 1}/${this.apiKeys.length} for ${requestedModel}`, {
          rpm: state.rpm,
          tpm: state.tpm,
          rpd: state.rpd,
          requestId
        });
        
        return {
          apiKey: this.apiKeys[keyIndex],
          model: requestedModel,
          keyIndex,
          fallbackApplied: false
        };
      }
    }
    
    // Second try: Model fallback for each key
    const fallbackModels = this.modelFallbackHierarchy[requestedModel] || [];
    
    for (const fallbackModel of fallbackModels) {
      for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
        const keyId = `key-${keyIndex}`;
        const state = this.state.get(keyId)!;
        
        this.resetExpiredCounters(state, now);
        
        if (this.canUseKey(state, fallbackModel, estimatedTokens)) {
          this.updateUsage(state, fallbackModel, estimatedTokens);
          
          console.log(`🔄 Model fallback: ${requestedModel} → ${fallbackModel} (key ${keyIndex + 1})`, {
            reason: 'Rate limit exceeded for requested model',
            rpm: state.rpm,
            tpm: state.tpm,
            rpd: state.rpd,
            requestId
          });
          
          return {
            apiKey: this.apiKeys[keyIndex],
            model: fallbackModel,
            keyIndex,
            fallbackApplied: true,
            fallbackReason: `Rate limit exceeded for ${requestedModel}`
          };
        }
      }
    }
    
    // Final fallback: Global fallback model
    for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
      const keyId = `key-${keyIndex}`;
      const state = this.state.get(keyId)!;
      
      this.resetExpiredCounters(state, now);
      
      if (this.canUseKey(state, 'gemini-2.5-flash-lite', estimatedTokens)) {
        this.updateUsage(state, 'gemini-2.5-flash-lite', estimatedTokens);
        
        console.log(`🆘 Global fallback: ${requestedModel} → gemini-2.5-flash-lite (key ${keyIndex + 1})`, {
          reason: 'All primary models exhausted',
          requestId
        });
        
        return {
          apiKey: this.apiKeys[keyIndex],
          model: 'gemini-2.5-flash-lite',
          keyIndex,
          fallbackApplied: true,
          fallbackReason: `All rate limits exhausted for ${requestedModel}`
        };
      }
    }
    
    // All keys exhausted
    throw new Error(`All API keys rate limited for model ${requestedModel}. Please try again later.`);
  }

  private canUseKey(state: RateLimitState, model: string, estimatedTokens: number): boolean {
    const limits = this.rateLimits[model];
    if (!limits) return false;
    
    return (
      state.rpm < limits.rpm &&
      state.tpm + estimatedTokens <= limits.tpm &&
      state.rpd < limits.rpd
    );
  }

  private resetExpiredCounters(state: RateLimitState, now: number): void {
    if (now >= state.rpmResetTime) {
      state.rpm = 0;
      state.rpmResetTime = now + 60000; // Next minute
    }
    
    if (now >= state.tpmResetTime) {
      state.tpm = 0;
      state.tpmResetTime = now + 60000; // Next minute
    }
    
    if (now >= state.rpdResetTime) {
      state.rpd = 0;
      state.rpdResetTime = now + 86400000; // Next 24 hours
    }
  }

  private updateUsage(state: RateLimitState, model: string, estimatedTokens: number): void {
    state.rpm += 1;
    state.tpm += estimatedTokens;
    state.rpd += 1;
    state.lastRequestTime = Date.now();
  }

  /**
   * Report 429 error to update rate limit tracking
   */
  report429Error(keyIndex: number, errorMessage: string, requestId?: string): void {
    const keyId = `key-${keyIndex}`;
    const state = this.state.get(keyId);
    
    if (!state) return;
    
    // Aggressive rate limit increase for 429 errors
    const now = Date.now();
    
    if (errorMessage.toLowerCase().includes('rpm')) {
      state.rpm = 999; // Max out RPM
      state.rpmResetTime = now + 60000;
      console.log(`🚨 RPM limit hit for key ${keyIndex + 1}`, { requestId });
    }
    
    if (errorMessage.toLowerCase().includes('tpm') || errorMessage.toLowerCase().includes('token')) {
      state.tpm = 9999999; // Max out TPM
      state.tpmResetTime = now + 60000;
      console.log(`🚨 TPM limit hit for key ${keyIndex + 1}`, { requestId });
    }
    
    if (errorMessage.toLowerCase().includes('rpd') || errorMessage.toLowerCase().includes('daily')) {
      state.rpd = 9999; // Max out RPD
      state.rpdResetTime = now + 86400000;
      console.log(`🚨 RPD limit hit for key ${keyIndex + 1}`, { requestId });
    }
  }

  /**
   * Get current rate limit status for all keys
   */
  getStatus(): Record<string, any> {
    const now = Date.now();
    const status: Record<string, any> = {};
    
    this.apiKeys.forEach((_, index) => {
      const keyId = `key-${index}`;
      const state = this.state.get(keyId)!;
      
      this.resetExpiredCounters(state, now);
      
      status[`key-${index + 1}`] = {
        rpm: state.rpm,
        tpm: state.tpm,
        rpd: state.rpd,
        rpmResetIn: Math.max(0, state.rpmResetTime - now),
        tpmResetIn: Math.max(0, state.tpmResetTime - now),
        rpdResetIn: Math.max(0, state.rpdResetTime - now),
        lastUsed: state.lastRequestTime
      };
    });
    
    return {
      totalKeys: this.apiKeys.length,
      providerId: this.providerId,
      keys: status,
      modelHierarchy: this.modelFallbackHierarchy,
      globalFallback: 'gemini-2.5-flash-lite'
    };
  }

  /**
   * Estimate token count for rate limiting
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}