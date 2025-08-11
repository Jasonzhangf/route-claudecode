/**
 * SDK Detection and Priority System
 * Author: Jason Zhang
 * 
 * This module provides runtime detection of available SDKs and manages
 * priority-based selection for LMStudio and Ollama services
 */

export { SDKDetector } from './sdk-detector.js';
export { LMStudioSDKManager } from './lmstudio-sdk-manager.js';
export { OllamaSDKManager } from './ollama-sdk-manager.js';
export { CompatibilityPreprocessor } from './compatibility-preprocessor.js';
export * from './types.js';

// Re-export individual components for direct import
export type {
  SDKInfo,
  SDKDetectionResult,
  LocalModelServerConfig,
  ModelServerDetection,
  SDKCapabilities,
  PreprocessingStrategy,
  SDKSelectionStrategy
} from './types.js';

console.log('🔍 SDK Detection System loaded - runtime priority selection');