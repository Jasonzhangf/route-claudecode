/**
 * RCC4 Main Entry Point
 * Claude Code Router v4.0 - Multi-AI Provider Routing System
 * 
 * Unified entry point with startup service integration
 */

// Core modules
export { ConfigPreprocessor } from './modules/config/src';
export { RouterPreprocessor } from './modules/router/src';  
export { PipelineAssembler } from './modules/pipeline/src';
export { HTTPServer } from './modules/server/src/http-server';

// Bootstrap module (unified startup service)
export { StartupService, startupService } from './modules/bootstrap/src';
export type { StartupConfig, StartupResult } from './modules/bootstrap/src';

// Import startupService for internal use
import { startupService } from './modules/bootstrap/src';

// Basic types
export * from './modules/types/src/index';

// Version information
export const RCC4_VERSION = '4.2.0';
export const RCC4_BUILD_DATE = new Date().toISOString();

// Main application bootstrap
export interface RCC4Application {
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<string>;
}

// Implementation of RCC4Application using unified startup service
export class RCC4ApplicationImpl implements RCC4Application {
  private startupServiceInstance = startupService;
  private isRunning = false;

  async start(port?: number): Promise<void> {
    if (this.isRunning) {
      throw new Error('Application is already running');
    }

    const config = {
      port: port || 5506,
      host: '0.0.0.0',
      debug: false
    };

    const result = await this.startupServiceInstance.start(config);
    if (!result.success) {
      throw new Error(`Failed to start application: ${result.errors?.join(', ')}`);
    }

    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Application is not running');
    }

    await this.startupServiceInstance.stop();
    this.isRunning = false;
  }

  async getStatus(): Promise<string> {
    return this.isRunning ? 'running' : 'stopped';
  }
}