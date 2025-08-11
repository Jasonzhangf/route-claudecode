/**
 * SDK Detector - Runtime Detection of Available SDKs
 * Author: Jason Zhang
 * 
 * Provides runtime detection and prioritization of LMStudio and Ollama SDKs
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { 
  SDKInfo, 
  SDKDetectionResult, 
  ModelServerDetection, 
  LocalModelServerConfig, 
  SDKCapabilities,
  SDKSelectionStrategy 
} from './types.js';

export class SDKDetector {
  private detectionCache: Map<string, SDKDetectionResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor(private strategy: SDKSelectionStrategy = 'official-first') {}

  /**
   * Detect available SDKs for a specific service type
   */
  async detectSDKs(serviceType: 'lmstudio' | 'ollama'): Promise<SDKDetectionResult> {
    const cacheKey = `${serviceType}-${this.strategy}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.detectionCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let result: SDKDetectionResult;

    switch (serviceType) {
      case 'lmstudio':
        result = await this.detectLMStudioSDKs();
        break;
      case 'ollama':
        result = await this.detectOllamaSDKs();
        break;
      default:
        throw new Error(`Unsupported service type: ${serviceType}`);
    }

    // Cache the result
    this.detectionCache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

    return result;
  }

  /**
   * Detect LMStudio server and available SDKs
   */
  private async detectLMStudioSDKs(): Promise<SDKDetectionResult> {
    const detected: SDKInfo[] = [];
    
    // Try to detect LMStudio official SDK
    const officialSDK = await this.checkLMStudioOfficialSDK();
    if (officialSDK) {
      detected.push(officialSDK);
    }

    // Always add OpenAI compatible fallback
    const fallbackSDK = this.createOpenAICompatibleSDK('lmstudio');
    detected.push(fallbackSDK);

    // Sort by priority
    detected.sort((a, b) => b.priority - a.priority);

    return {
      detected,
      preferred: this.selectPreferred(detected),
      fallbackAvailable: detected.some(sdk => sdk.name.includes('openai-compatible'))
    };
  }

  /**
   * Detect Ollama server and available SDKs
   */
  private async detectOllamaSDKs(): Promise<SDKDetectionResult> {
    const detected: SDKInfo[] = [];
    
    // Try to detect Ollama official SDK
    const officialSDK = await this.checkOllamaOfficialSDK();
    if (officialSDK) {
      detected.push(officialSDK);
    }

    // Add independent implementation fallback
    const fallbackSDK = this.createOllamaIndependentSDK();
    detected.push(fallbackSDK);

    // Sort by priority
    detected.sort((a, b) => b.priority - a.priority);

    return {
      detected,
      preferred: this.selectPreferred(detected),
      fallbackAvailable: detected.some(sdk => sdk.name.includes('independent'))
    };
  }

  /**
   * Check if LMStudio official SDK is available
   */
  private async checkLMStudioOfficialSDK(): Promise<SDKInfo | null> {
    try {
      // Try to dynamically import LMStudio SDK
      const lmstudioModule = await this.tryImport('lmstudio-sdk');
      if (lmstudioModule) {
        return {
          name: 'lmstudio-official',
          version: lmstudioModule.version || '1.0.0',
          available: true,
          priority: 100,
          capabilities: ['streaming', 'toolCalling', 'customModels'],
          installLocation: this.resolveModulePath('lmstudio-sdk')
        };
      }
    } catch (error) {
      console.log('🔍 LMStudio official SDK not found, using OpenAI compatible fallback');
    }

    // Check if LMStudio server is running
    const serverRunning = await this.checkLMStudioServer();
    if (serverRunning) {
      return {
        name: 'lmstudio-server-detected',
        version: 'unknown',
        available: true,
        priority: 80,
        capabilities: ['streaming', 'customModels'],
        healthEndpoint: 'http://localhost:1234/v1/models'
      };
    }

    return null;
  }

  /**
   * Check if Ollama official SDK is available
   */
  private async checkOllamaOfficialSDK(): Promise<SDKInfo | null> {
    try {
      // Try to dynamically import Ollama SDK
      const ollamaModule = await this.tryImport('ollama');
      if (ollamaModule) {
        return {
          name: 'ollama-official',
          version: ollamaModule.version || '1.0.0',
          available: true,
          priority: 100,
          capabilities: ['streaming', 'toolCalling', 'customModels', 'embeddings'],
          installLocation: this.resolveModulePath('ollama')
        };
      }
    } catch (error) {
      console.log('🔍 Ollama official SDK not found, using independent implementation');
    }

    // Check if Ollama server is running
    const serverRunning = await this.checkOllamaServer();
    if (serverRunning) {
      return {
        name: 'ollama-server-detected',
        version: 'unknown',
        available: true,
        priority: 80,
        capabilities: ['streaming', 'customModels', 'embeddings'],
        healthEndpoint: 'http://localhost:11434/api/version'
      };
    }

    return null;
  }

  /**
   * Create OpenAI compatible fallback SDK info
   */
  private createOpenAICompatibleSDK(serverType: string): SDKInfo {
    return {
      name: `${serverType}-openai-compatible`,
      version: '1.0.0',
      available: true,
      priority: 50,
      capabilities: ['streaming', 'toolCalling'],
      installLocation: 'builtin'
    };
  }

  /**
   * Create Ollama independent implementation SDK info
   */
  private createOllamaIndependentSDK(): SDKInfo {
    return {
      name: 'ollama-independent',
      version: '1.0.0',
      available: true,
      priority: 60,
      capabilities: ['streaming', 'customModels'],
      installLocation: 'builtin'
    };
  }

  /**
   * Select preferred SDK based on strategy
   */
  private selectPreferred(detected: SDKInfo[]): SDKInfo | null {
    if (detected.length === 0) {
      return null;
    }

    switch (this.strategy) {
      case 'official-first':
        return detected.find(sdk => sdk.name.includes('official')) || detected[0];
      case 'performance-first':
        return detected[0]; // Highest priority (already sorted)
      case 'compatibility-first':
        return detected.find(sdk => sdk.capabilities.includes('toolCalling')) || detected[0];
      case 'fallback-only':
        return detected.find(sdk => sdk.name.includes('compatible') || sdk.name.includes('independent')) || detected[0];
      default:
        return detected[0];
    }
  }

  /**
   * Detect specific model server configuration
   */
  async detectModelServer(config: LocalModelServerConfig): Promise<ModelServerDetection> {
    const serverType = await this.identifyServerType(config);
    const sdkResult = await this.detectSDKs(serverType);
    
    return {
      serverType,
      detected: true,
      sdkAvailable: sdkResult.detected.length > 0,
      fallbackMode: !sdkResult.preferred?.name.includes('official'),
      capabilities: this.deriveCapabilities(sdkResult.preferred),
      config
    };
  }

  /**
   * Identify server type from configuration
   */
  private async identifyServerType(config: LocalModelServerConfig): Promise<'lmstudio' | 'ollama'> {
    // Check if explicitly specified
    if (config.serverType !== 'openai-compatible') {
      return config.serverType;
    }

    // Try to identify by port and endpoint patterns
    if (config.port === 1234 || config.endpoint.includes('1234')) {
      return 'lmstudio';
    }
    
    if (config.port === 11434 || config.endpoint.includes('11434')) {
      return 'ollama';
    }

    // Try to ping health endpoints to identify
    if (await this.pingEndpoint(`http://${config.host}:${config.port}/v1/models`)) {
      return 'lmstudio'; // LMStudio uses OpenAI-compatible endpoints
    }
    
    if (await this.pingEndpoint(`http://${config.host}:${config.port}/api/version`)) {
      return 'ollama'; // Ollama has its own API format
    }

    // Default to LMStudio for OpenAI-compatible endpoints
    return 'lmstudio';
  }

  /**
   * Derive capabilities from SDK info
   */
  deriveCapabilities(sdk: SDKInfo | null): SDKCapabilities {
    if (!sdk) {
      return {
        streaming: false,
        toolCalling: false,
        multiModal: false,
        embeddings: false,
        fineTuning: false,
        customModels: false,
        batchRequests: false
      };
    }

    return {
      streaming: sdk.capabilities.includes('streaming'),
      toolCalling: sdk.capabilities.includes('toolCalling'),
      multiModal: sdk.capabilities.includes('multiModal'),
      embeddings: sdk.capabilities.includes('embeddings'),
      fineTuning: sdk.capabilities.includes('fineTuning'),
      customModels: sdk.capabilities.includes('customModels'),
      batchRequests: sdk.capabilities.includes('batchRequests')
    };
  }

  /**
   * Helper methods
   */
  private async tryImport(moduleName: string): Promise<any> {
    try {
      return await import(moduleName);
    } catch (error) {
      return null;
    }
  }

  private resolveModulePath(moduleName: string): string {
    try {
      return resolve(require.resolve(moduleName));
    } catch (error) {
      return '';
    }
  }

  private async checkLMStudioServer(): Promise<boolean> {
    return this.pingEndpoint('http://localhost:1234/v1/models');
  }

  private async checkOllamaServer(): Promise<boolean> {
    return this.pingEndpoint('http://localhost:11434/api/version');
  }

  private async pingEndpoint(url: string, timeout: number = 3000): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get current strategy
   */
  getStrategy(): SDKSelectionStrategy {
    return this.strategy;
  }

  /**
   * Update selection strategy
   */
  updateStrategy(strategy: SDKSelectionStrategy): void {
    if (this.strategy !== strategy) {
      this.strategy = strategy;
      this.clearCache(); // Clear cache when strategy changes
    }
  }
}