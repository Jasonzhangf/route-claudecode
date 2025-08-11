/**
 * SDK Detection Types and Interfaces
 * Author: Jason Zhang
 */

export interface SDKInfo {
  name: string;
  version: string;
  available: boolean;
  priority: number;
  capabilities: string[];
  installLocation?: string;
  healthEndpoint?: string;
}

export interface SDKDetectionResult {
  detected: SDKInfo[];
  preferred: SDKInfo | null;
  fallbackAvailable: boolean;
}

export interface LocalModelServerConfig {
  host: string;
  port: number;
  endpoint: string;
  timeout: number;
  maxRetries: number;
  apiKey?: string;
  serverType: 'lmstudio' | 'ollama' | 'openai-compatible';
}

export interface SDKCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  multiModal: boolean;
  embeddings: boolean;
  fineTuning: boolean;
  customModels: boolean;
  batchRequests: boolean;
}

export interface ModelServerDetection {
  serverType: 'lmstudio' | 'ollama' | 'unknown';
  detected: boolean;
  sdkAvailable: boolean;
  fallbackMode: boolean;
  capabilities: SDKCapabilities;
  config: LocalModelServerConfig;
}

export interface PreprocessingStrategy {
  name: string;
  priority: number;
  conditions: {
    provider?: string;
    model?: string;
    version?: string;
    serverType?: string;
  };
  transformations: {
    request?: boolean;
    response?: boolean;
    streaming?: boolean;
  };
}

export type SDKSelectionStrategy = 'official-first' | 'performance-first' | 'compatibility-first' | 'fallback-only';