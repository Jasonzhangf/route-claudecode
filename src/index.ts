/**
 * RCC4 Main Entry Point
 * Claude Code Router v4.0 - Multi-AI Provider Routing System
 * 
 * Simplified entry point for basic functionality
 */

// Core modules - basic exports only
export { ConfigPreprocessor } from './modules/config/src';
export { RouterPreprocessor } from './modules/router/src';  
export { PipelineAssembler } from './modules/pipeline/src';
export { HTTPServer } from './modules/server/src/http-server';

// Basic types
export * from './modules/types/src';

// Version information
export const RCC4_VERSION = '4.2.0';
export const RCC4_BUILD_DATE = new Date().toISOString();

// Main application bootstrap - will be implemented using existing modules
export interface RCC4Application {
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<string>;
}

// TODO: Implement RCC4Application using existing server and config modules
// This will be done by connecting the modules properly