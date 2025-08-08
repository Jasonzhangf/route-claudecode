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
  // Key: `key-${keyIndex}:${modelName}`, e.g., 'key-0:gemini-2.5-pro'
  private keyModelState: Map<string, KeyModelState> = new Map();
  private providerId: string;
  private modelFallbackConfig: ModelFallbackConfig | null = null;
  
  // Default model fallback hierarchy (fallback if no config provided)
  private readonly defaultModelFallbackHierarchy: Record<string, string[]> = {
    'gemini-2.5-pro': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'],
    'gemini-2.5-flash': ['gemini-2.0-flash', 'gemini-1.5-flash-8b'],
    'gemini-2.0-flash': ['gemini-1.5-flash-8b'],
    'gemini-1.5-flash-8b': [] // No further fallback
  };

  constructor(apiKeys: string[], providerId: string = 'gemini', modelFallbackConfig?: ModelFallbackConfig) {
    this.apiKeys = apiKeys.filter(key => key && key.trim());
    this.providerId = providerId;
    this.modelFallbackConfig = modelFallbackConfig || null;
    
    if (this.apiKeys.length === 0) {
      throw new Error('At least one API key is required for Enhanced Rate Limit Manager');
    }
    
    const fallbackEnabled = this.modelFallbackConfig?.enabled ? 'enabled' : 'using default hierarchy';
    console.log(`🔧 Enhanced Rate Limit Manager (v3) initialized with ${this.apiKeys.length} keys, model fallback ${fallbackEnabled}`);
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
        console.log(`✅ Using key ${keyIndex + 1} for model ${requestedModel}.`, { requestId });
        return {
          apiKey: this.apiKeys[keyIndex],
          model: requestedModel,
          keyIndex,
          fallbackApplied: false,
        };
      }
    }

    // --- Stage 2: If all keys are unavailable for the requested model, try fallbacks ---
    const fallbackModels = this.getFallbackModels(requestedModel);
    
    if (this.modelFallbackConfig?.globalSettings?.logFallbackDecisions) {
      console.log(`📋 Checking fallback options for ${requestedModel}:`, fallbackModels, { requestId });
    }
    
    for (const fallbackModel of fallbackModels) {
      for (let keyIndex = 0; keyIndex < this.apiKeys.length; keyIndex++) {
        const modelStateKey = `key-${keyIndex}:${fallbackModel}`;
        const state = this.keyModelState.get(modelStateKey);

        if (!state || (!state.permanentlyDowngraded && now >= state.cooldownUntil)) {
          // Found an available fallback combination
          const fallbackReason = `All keys for ${requestedModel} are currently rate-limited`;
          
          if (this.modelFallbackConfig?.globalSettings?.logFallbackDecisions) {
            console.log(`🔄 Model fallback activated: ${requestedModel} → ${fallbackModel} (key ${keyIndex + 1})`, {
              originalModel: requestedModel,
              fallbackModel,
              keyIndex: keyIndex + 1,
              reason: fallbackReason,
              requestId
            });
          }
          
          return {
            apiKey: this.apiKeys[keyIndex],
            model: fallbackModel,
            keyIndex,
            fallbackApplied: true,
            fallbackReason
          };
        }
      }
    }
    
    // --- Stage 3: All keys and all fallbacks are exhausted ---
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
        `All API keys for model ${requestedModel} and its fallbacks are currently rate-limited. Please try again in about ${waitTime} seconds.`,
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
    const currentState = this.keyModelState.get(modelStateKey) || {
      cooldownUntil: 0,
      permanentlyDowngraded: false,
      lastFailure: 0,
    };

    // Check if the last failure was very recent (e.g., within 2 seconds of cooldown ending)
    const isImmediateFailureAfterCooldown = (now - currentState.lastFailure) < 62000 && currentState.lastFailure > 0;

    if (isImmediateFailureAfterCooldown) {
      // Failure occurred again right after cooldown, so permanently downgrade.
      currentState.permanentlyDowngraded = true;
      console.log(`🚫 Permanently downgrading model ${model} for key ${keyIndex + 1} due to immediate re-failure.`, { requestId });
    } else {
      // Regular 429: set a 60-second cooldown.
      currentState.cooldownUntil = now + 60000;
      console.log(`⏳ Cooldown initiated for model ${model} on key ${keyIndex + 1} for 60s.`, { requestId });
    }

    currentState.lastFailure = now;
    this.keyModelState.set(modelStateKey, currentState);
  }

  /**
   * Get fallback models for a given model based on configuration
   */
  private getFallbackModels(model: string): string[] {
    if (this.modelFallbackConfig?.enabled && this.modelFallbackConfig.fallbackChains[model]) {
      return this.modelFallbackConfig.fallbackChains[model].fallbackModels;
    }
    return this.defaultModelFallbackHierarchy[model] || [];
  }

  /**
   * Get current rate limit status for all keys
   */
  getStatus(): Record<string, any> {
    const now = Date.now();
    const keyStatus: any = {};
    const hierarchyToUse = this.modelFallbackConfig?.enabled ? 
      Object.keys(this.modelFallbackConfig.fallbackChains) : 
      Object.keys(this.defaultModelFallbackHierarchy);

    this.apiKeys.forEach((_, keyIndex) => {
      const models: any = {};
      for (const model of hierarchyToUse) {
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
      modelHierarchy: this.modelFallbackConfig?.enabled ? 
        this.modelFallbackConfig.fallbackChains : 
        this.defaultModelFallbackHierarchy,
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
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}