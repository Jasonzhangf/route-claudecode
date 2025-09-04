/**
 * Error Handler Module
 * 
 * Responsible for centralized error handling and logging
 * 
 * @author Jason Zhang
 */

import { BaseModule } from '../base-module-impl';
import { ModuleType, ModuleInterface } from '../../interfaces/module/base-module';
import { secureLogger } from '../../utils/secure-logger';
import { RCCError, ERROR_CODES } from '../../types/error';

/**
 * Error Handler Configuration
 */
export interface ErrorHandlerConfig {
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  includeStackTrace: boolean;
  maxErrorHistory: number;
}

/**
 * Error Handler Module
 */
export class ErrorHandlerModule extends BaseModule {
  protected config: ErrorHandlerConfig;
  private errorHistory: RCCError[] = [];

  constructor(config: ErrorHandlerConfig = {
    logLevel: 'error',
    includeStackTrace: false,
    maxErrorHistory: 100
  }) {
    super(
      'error-handler-' + Date.now(),
      'ErrorHandlerModule',
      ModuleType.ERROR_HANDLER,
      '1.0.0'
    );
    
    this.config = config;
  }

  /**
   * Handle an error
   */
  async handleError(error: Error | RCCError, context?: any): Promise<void> {
    // Store the error in history
    if (error instanceof RCCError) {
      this.errorHistory.push(error);
      
      // Limit error history size
      if (this.errorHistory.length > this.config.maxErrorHistory) {
        this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
      }
    }

    // Log the error
    secureLogger.error('Error handled by ErrorHandlerModule', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error.constructor.name,
      context,
      stack: this.config.includeStackTrace ? error.stack : undefined
    });
  }

  /**
   * Get error history
   */
  getErrorHistory(): RCCError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Generate error response
   */
  generateErrorResponse(error: Error | RCCError, includeDetails: boolean = false): any {
    const baseResponse = {
      error: {
        message: error.message,
        type: error.constructor.name,
        code: error instanceof RCCError ? error.code : ERROR_CODES.UNKNOWN_ERROR
      }
    };

    if (includeDetails) {
      return {
        ...baseResponse,
        details: {
          timestamp: new Date().toISOString(),
          stack: this.config.includeStackTrace ? error.stack : undefined
        }
      };
    }

    return baseResponse;
  }

  protected async onProcess(input: any): Promise<any> {
    // Process error handling requests
    if (input.type === 'error') {
      await this.handleError(input.error, input.context);
      return this.generateErrorResponse(input.error, input.includeDetails);
    }
    
    return input;
  }

  // Implement ModuleInterface methods
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      return targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        // Handle response from target module
      });
    }
    return Promise.resolve({ success: false, error: 'MODULE_NOT_FOUND' });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    // Implementation for handling messages from other modules
  }
}