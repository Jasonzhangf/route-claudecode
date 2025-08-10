/**
 * Enhanced Gemini Rate Limit Manager
 * Intelligent 429 error handling with Round Robin key rotation and model fallback
 * Project Owner: Jason Zhang
 */

import { ProviderError } from '../../types';

interface KeyModelState {
  cooldownUntil: number;       // Timestamp until which this combo is cooling down
  permanentlyDowngraded: boolean; // Flag for permanent downgrade for this model
  lastFailure: number;         // Timestamp of the last 429 error
}

interface KeyRotationResult {
  apiKey: string;
  model: string;
  keyIndex: number;
  fallbackApplied: boolean;
  fallbackReason?: string;
}

interface ModelFallbackConfig {
  enabled: boolean;
  cooldownMs: number;
  fallbackChains: Record<string, {
    fallbackModels: string[];
    maxFallbacks: number;
    resetAfterSuccess: boolean;
    description?: string;
  }>;
  globalSettings: {
    trackFallbackUsage: boolean;
    logFallbackDecisions: boolean;
    maxFallbackDepth: number;
    fallbackResetInterval: number;
  };
}

/**
 * Enhanced Gemini Rate Limit Manager - v2
 * 
 * Features:
 * - Prioritizes Key Rotation over Model Downgrade.
 * - When a (Key, Model) combination gets a 429 error, it enters a 60-second cooldown.
 * - If it fails again immediately after cooldown, it's permanently downgraded for that Key.
 * - A model downgrade is only considered if ALL keys are in cooldown for the requested model.
 */
export class EnhancedRateLimitManager {
  private apiKeys: string[];
  // Key: `key-${keyIndex}:${modelName}`, e.g., 'key-0:{actual-model-from-config}'
  private keyModelState: Map<string, KeyModelState> = new Map();
  private providerId: string;
  private modelFallbackConfig: ModelFallbackConfig | null = null;
  private config: any; // Configuration object
  
  // Zero Fallback Principle: No hardcoded model hierarchy
  // All model routing must be handled at routing layer

  constructor(apiKeys: string[], providerId: string, config?: any) {
    this.apiKeys = apiKeys.filter(key => key && key.trim());
    if (!providerId) {
      throw new Error('EnhancedRateLimitManager: providerId is required - no default fallback allowed');
    }
    this.providerId = providerId;
    this.config = config || {};
    this.modelFallbackConfig = null; // Zero Fallback Principle
    
    if (this.apiKeys.length === 0) {
      throw new Error('At least one API key is required for Enhanced Rate Limit Manager');
    }
    
    // Remove console.log hardcoded string - use logger instead
  }

  /**
   * Get available API key and model with intelligent fallback
   */
  getAvailableKeyAndModel(requestedModel: string, requestId?: string): KeyRotationResult {
    const now = Date.now();

    // --- Stage 1: Try requested model with all available keys ---
    for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
      const modelStateKey = `key-${keyIndex}:${requestedModel}`;
      const state = this.keyModelState.get(modelStateKey);

      if (!state || (!state.permanentlyDowngraded && now >= state.cooldownUntil)) {
        // This (key, model) combo is available
        // Key selection logged through main logger system
        return {
          apiKey: this.apiKeys[keyIndex],
          model: requestedModel,
          keyIndex,
          fallbackApplied: false,
        };
      }
    }

    // Zero Fallback Principle: No model fallback at provider level
    // Model routing must be handled at routing layer
    
    // --- Stage 2: All keys exhausted for requested model (No Fallback) ---
    // Find the combo that will be available soonest to provide a better error message.
    let soonestAvailableTime = Infinity;
    for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
        const modelStateKey = `key-${keyIndex}:${requestedModel}`;
        const state = this.keyModelState.get(modelStateKey);
        if (state && !state.permanentlyDowngraded && state.cooldownUntil < soonestAvailableTime) {
            soonestAvailableTime = state.cooldownUntil;
        }
    }

    const waitTime = soonestAvailableTime === Infinity ? 'N/A' : Math.ceil((soonestAvailableTime - now) / 1000);
    throw new ProviderError(
        `All API keys for model ${requestedModel} are currently rate-limited. Please try again in about ${waitTime} seconds. (Zero Fallback Principle: routing layer must handle model alternatives)`,
        this.providerId,
        429
    );
  }


  /**
   * Report 429 error to update rate limit tracking
   */
  report429Error(keyIndex: number, model: string, requestId?: string): void {
    const modelStateKey = `key-${keyIndex}:${model}`;
    const now = Date.now();
    const currentState = this.keyModelState.get(modelStateKey) ?? {
      cooldownUntil: 0,
      permanentlyDowngraded: false,
      lastFailure: 0,
    };

    // Zero Hardcode Principle: timing constants must be configurable
    const IMMEDIATE_FAILURE_THRESHOLD_MS = this.config.immediateFailureThresholdMs || 62000;
    const isImmediateFailureAfterCooldown = (now - currentState.lastFailure) < IMMEDIATE_FAILURE_THRESHOLD_MS && currentState.lastFailure > 0;

    if (isImmediateFailureAfterCooldown) {
      // Failure occurred again right after cooldown, so permanently downgrade.
      currentState.permanentlyDowngraded = true;
      // Permanent downgrade logged through main logger system
    } else {
      // Zero Hardcode Principle: cooldown duration must be configurable
      const COOLDOWN_DURATION_MS = this.config.cooldownDurationMs || 60000;
      currentState.cooldownUntil = now + COOLDOWN_DURATION_MS;
      // Cooldown logged through main logger system
    }

    currentState.lastFailure = now;
    this.keyModelState.set(modelStateKey, currentState);
  }

  /**
   * Zero Fallback Principle: No fallback models at provider level
   */
  private getFallbackModels(model: string): string[] {
    // Always return empty array - no fallback at provider level
    return [];
  }

  /**
   * Get current rate limit status for all keys
   */
  getStatus(): Record<string, any> {
    const now = Date.now();
    const keyStatus: any = {};
    // No hardcoded hierarchy - only track actually requested models
    const requestedModels = Array.from(new Set(
      Array.from(this.keyModelState.keys())
        .map(key => key.split(':')[1])
        .filter(Boolean)
    ));

    this.apiKeys.forEach((_, keyIndex) => {
      const models: any = {};
      for (const model of requestedModels) {
        const modelStateKey = `key-${keyIndex}:${model}`;
        const state = this.keyModelState.get(modelStateKey);
        if (state) {
          models[model] = {
            cooldown: Math.max(0, state.cooldownUntil - now),
            permanentlyDowngraded: state.permanentlyDowngraded,
            lastFailure: state.lastFailure
          };
        }
      }
      keyStatus[`key-${keyIndex + 1}`] = models;
    });

    return {
      totalKeys: this.apiKeys.length,
      providerId: this.providerId,
      status: keyStatus,
      modelHierarchy: 'Zero Fallback Principle - No hierarchy',
      fallbackConfig: this.modelFallbackConfig ? {
        enabled: this.modelFallbackConfig.enabled,
        cooldownMs: this.modelFallbackConfig.cooldownMs
      } : null
    };
  }

  /**
   * Estimate token count for rate limiting
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // Zero Hardcode Principle: magic numbers must be configurable
    const CHARS_PER_TOKEN = 4; // Should be from config
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
}