/**
 * Enhanced OpenAI-Compatible API Key Manager
 * Provides intelligent, stateful handling of API keys, including rate-limit-aware cooldowns.
 * This is an adaptation of the advanced manager built for the Gemini provider.
 * Project Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';

interface ApiKeyState {
  key: string;
  index: number;
  cooldownUntil: number; // Timestamp until which this key is cooling down
  lastFailure: number; // Timestamp of the last 429 error
  consecutiveFailures: number;
  blacklisted: boolean; // If key is deemed permanently unusable
}

export class EnhancedOpenAIKeyManager {
  private keys: ApiKeyState[] = [];
  private providerId: string;
  private roundRobinIndex = 0;
  private readonly cooldownMs = 60000; // 60-second cooldown on 429
  private readonly immediateFailureThreshold = 62000; // 62 seconds
  private readonly maxFailures = 5; // Blacklist after 5 consecutive failures

  constructor(apiKeys: string[], providerId: string) {
    this.providerId = providerId;
    this.keys = apiKeys.map((key, index) => ({
      key,
      index,
      cooldownUntil: 0,
      lastFailure: 0,
      consecutiveFailures: 0,
      blacklisted: false,
    }));
    logger.info(`Enhanced API Key Manager initialized for ${this.providerId}`, {
      keyCount: this.keys.length,
      strategy: 'cooldown_aware_round_robin'
    });
  }

  /**
   * Selects the next available API key that is not in cooldown or blacklisted.
   */
  getNextAvailableKey(requestId?: string): string {
    const now = Date.now();
    const availableKeys = this.keys.filter(k => !k.blacklisted && now >= k.cooldownUntil);

    if (availableKeys.length === 0) {
      // All keys are currently in cooldown or blacklisted. Find the one that will be available soonest.
      let soonestAvailableTime = Infinity;
      for (const key of this.keys) {
        if (!key.blacklisted && key.cooldownUntil < soonestAvailableTime) {
          soonestAvailableTime = key.cooldownUntil;
        }
      }
      const waitTime = soonestAvailableTime === Infinity ? 'N/A' : Math.ceil((soonestAvailableTime - now) / 1000);
      throw new Error(
        `All API keys for provider ${this.providerId} are currently rate-limited or blacklisted. Please try again in about ${waitTime} seconds.`
      );
    }

    // Simple round-robin among available keys
    this.roundRobinIndex = (this.roundRobinIndex + 1) % availableKeys.length;
    const selectedKey = availableKeys[this.roundRobinIndex];

    logger.debug(`Selected API key for ${this.providerId}`, {
      keyIndex: selectedKey.index,
      requestId
    });

    return selectedKey.key;
  }

  /**
   * Reports a 429 error for a specific API key, triggering a cooldown.
   */
  report429Error(apiKey: string, requestId?: string): void {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (!keyState) return;

    const now = Date.now();

    // Check if it failed again right after a cooldown ended
    const isImmediateFailure = (now - keyState.lastFailure) < this.immediateFailureThreshold && keyState.lastFailure > 0;

    keyState.consecutiveFailures++;
    keyState.lastFailure = now;

    if (isImmediateFailure || keyState.consecutiveFailures >= this.maxFailures) {
      // Blacklist the key if it fails repeatedly or immediately after cooldown
      keyState.blacklisted = true;
      logger.warn(`Blacklisted API key for ${this.providerId}`, {
        reason: isImmediateFailure ? 'Immediate re-failure' : 'Exceeded max failures',
        keyIndex: keyState.index,
        requestId
      });
    } else {
      // Otherwise, just put it in a normal cooldown
      keyState.cooldownUntil = now + this.cooldownMs;
      logger.warn(`API key for ${this.providerId} put into cooldown for 60s`, {
        keyIndex: keyState.index,
        requestId
      });
    }
  }

  /**
   * Reports a generic, non-429 error.
   */
  reportGenericError(apiKey: string, requestId?: string): void {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (!keyState) return;
    keyState.consecutiveFailures++;
    if (keyState.consecutiveFailures >= this.maxFailures) {
        keyState.blacklisted = true;
        logger.warn(`Blacklisted API key for ${this.providerId} due to generic errors`, {
            keyIndex: keyState.index,
            requestId
        });
    }
  }

  /**
   * Reports a successful request, resetting the failure counter for the key.
   */
  reportSuccess(apiKey: string, requestId?: string): void {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      if (keyState.consecutiveFailures > 0) {
        logger.info(`API key for ${this.providerId} is healthy again`, {
            keyIndex: keyState.index, 
            requestId
        });
      }
      keyState.consecutiveFailures = 0;
      keyState.cooldownUntil = 0; // Clear cooldown on success
    }
  }
}
