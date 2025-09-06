/**
 * Server Module
 * 
 * Responsible for HTTP server startup, shutdown and request handling
 * 
 * @author Jason Zhang
 */

import { BaseModule } from '../base-module-impl';
import { ModuleType } from '../interfaces/module/base-module';
import { secureLogger } from '../utils';
import { RCCError, RCCErrorCode } from '../types/src';

/**
 * Server Configuration Interface
 */
export interface ServerConfig {
  port: number;
  host: string;
  enableSSL?: boolean;
  maxConnections?: number;
  timeout?: number;
}

/**
 * Server Module
 */
export class ServerModule extends BaseModule {
  protected config: ServerConfig;

  constructor(config: ServerConfig) {
    super(
      'server-' + config.port,
      'ServerModule',
      ModuleType.SERVER,
      '1.0.0'
    );
    
    this.config = {
      maxConnections: 1000,
      timeout: 30000,
      ...config
    };
  }

  /**
   * Start server
   */
  protected async onStart(): Promise<void> {
    secureLogger.info('Server module started', {
      port: this.config.port,
      host: this.config.host,
      protocol: this.config.enableSSL ? 'https' : 'http'
    });
  }

  /**
   * Stop server
   */
  protected async onStop(): Promise<void> {
    secureLogger.info('Server module stopped', {
      port: this.config.port
    });
  }

  /**
   * Process request
   */
  protected async onProcess(input: any): Promise<any> {
    if (this.status === 'running') {
      secureLogger.debug('Processing request in server module', {
        requestId: input.requestId,
        method: input.method,
        path: input.path
      });

      // Here should forward the request to the appropriate processing module
      // Now return a basic response
      return {
        ...input,
        processedBy: this.getId(),
        processedAt: new Date().toISOString()
      };
    }

    throw new RCCError(
      'Server is not running',
      RCCErrorCode.MODULE_CONNECTION_FAILED,
      'server-module'
    );
  }

  /**
   * Get server status
   */
  getServerStatus(): any {
    return {
      port: this.config.port,
      host: this.config.host,
      status: this.status,
      protocol: this.config.enableSSL ? 'https' : 'http'
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }
}