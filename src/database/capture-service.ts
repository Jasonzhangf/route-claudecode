/**
 * Data Capture Service
 * Captures and stores raw and transformed data for debugging and analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { DatabaseConfig, CaptureConfig } from './config';

export class DataCaptureService {
  private config: DatabaseConfig;
  private basePath: string;
  private enabled: boolean;
  
  constructor(config: DatabaseConfig) {
    this.config = config;
    this.enabled = config.enabled;
    this.basePath = this.resolvePath(config.basePath);
    
    if (this.enabled) {
      this.ensureDirectoriesExist();
    }
  }
  
  /**
   * Resolve path with home directory expansion
   */
  private resolvePath(inputPath: string): string {
    if (inputPath.startsWith('~')) {
      return path.join(require('os').homedir(), inputPath.slice(1));
    }
    return inputPath;
  }
  
  /**
   * Ensure all required directories exist
   */
  private ensureDirectoriesExist(): void {
    const dirs = [
      'captures/raw/requests',
      'captures/raw/responses',
      'captures/transformed/requests',
      'captures/transformed/responses',
      'analysis',
      'replay',
      'config'
    ];
    
    for (const dir of dirs) {
      const fullPath = path.join(this.basePath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logger.info(`Created directory: ${fullPath}`);
      }
    }
  }
  
  /**
   * Capture raw request data
   */
  public captureRawRequest(request: any, captureConfig: CaptureConfig): void {
    if (!this.enabled || !this.config.captureRequests || !captureConfig.captureRaw) return;
    
    try {
      const timestamp = new Date().toISOString();
      const filename = this.generateFilename('raw-request', captureConfig, timestamp);
      const filepath = path.join(this.basePath, 'captures/raw/requests', filename);
      
      const captureData = {
        captureType: 'raw-request',
        timestamp,
        requestId: captureConfig.requestId,
        provider: captureConfig.provider,
        endpoint: captureConfig.endpoint,
        model: captureConfig.model,
        data: request
      };
      
      fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
      logger.debug(`Captured raw request to ${filepath}`);
    } catch (error) {
      logger.error('Failed to capture raw request', error);
    }
  }
  
  /**
   * Capture raw response data
   */
  public captureRawResponse(response: any, captureConfig: CaptureConfig): void {
    if (!this.enabled || !this.config.captureResponses || !captureConfig.captureRaw) return;
    
    try {
      const timestamp = new Date().toISOString();
      const filename = this.generateFilename('raw-response', captureConfig, timestamp);
      const filepath = path.join(this.basePath, 'captures/raw/responses', filename);
      
      const captureData = {
        captureType: 'raw-response',
        timestamp,
        requestId: captureConfig.requestId,
        provider: captureConfig.provider,
        endpoint: captureConfig.endpoint,
        model: captureConfig.model,
        data: response
      };
      
      fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
      logger.debug(`Captured raw response to ${filepath}`);
    } catch (error) {
      logger.error('Failed to capture raw response', error);
    }
  }
  
  /**
   * Capture transformed request data
   */
  public captureTransformedRequest(request: any, captureConfig: CaptureConfig): void {
    if (!this.enabled || !this.config.captureRequests || !captureConfig.captureTransformed) return;
    
    try {
      const timestamp = new Date().toISOString();
      const filename = this.generateFilename('transformed-request', captureConfig, timestamp);
      const filepath = path.join(this.basePath, 'captures/transformed/requests', filename);
      
      const captureData = {
        captureType: 'transformed-request',
        timestamp,
        requestId: captureConfig.requestId,
        provider: captureConfig.provider,
        endpoint: captureConfig.endpoint,
        model: captureConfig.model,
        data: request
      };
      
      fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
      logger.debug(`Captured transformed request to ${filepath}`);
    } catch (error) {
      logger.error('Failed to capture transformed request', error);
    }
  }
  
  /**
   * Capture transformed response data
   */
  public captureTransformedResponse(response: any, captureConfig: CaptureConfig): void {
    if (!this.enabled || !this.config.captureResponses || !captureConfig.captureTransformed) return;
    
    try {
      const timestamp = new Date().toISOString();
      const filename = this.generateFilename('transformed-response', captureConfig, timestamp);
      const filepath = path.join(this.basePath, 'captures/transformed/responses', filename);
      
      const captureData = {
        captureType: 'transformed-response',
        timestamp,
        requestId: captureConfig.requestId,
        provider: captureConfig.provider,
        endpoint: captureConfig.endpoint,
        model: captureConfig.model,
        data: response
      };
      
      fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
      logger.debug(`Captured transformed response to ${filepath}`);
    } catch (error) {
      logger.error('Failed to capture transformed response', error);
    }
  }
  
  /**
   * Generate filename based on naming strategy
   */
  private generateFilename(type: string, captureConfig: CaptureConfig, timestamp: string): string {
    const date = timestamp.split('T')[0]; // YYYY-MM-DD
    const time = timestamp.split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Use naming strategy from config (default to timestamp-id)
    return `${date}_${time}_${captureConfig.requestId}_${type}.json`;
  }
  
  /**
   * Get all captured files for a specific request
   */
  public getCapturedFiles(requestId: string): { [key: string]: string } {
    const files: { [key: string]: string } = {};
    
    if (!this.enabled) return files;
    
    try {
      const searchPaths = [
        'captures/raw/requests',
        'captures/raw/responses',
        'captures/transformed/requests',
        'captures/transformed/responses'
      ];
      
      for (const searchPath of searchPaths) {
        const fullPath = path.join(this.basePath, searchPath);
        if (fs.existsSync(fullPath)) {
          const dirFiles = fs.readdirSync(fullPath);
          const matchingFiles = dirFiles.filter(file => file.includes(requestId));
          
          for (const file of matchingFiles) {
            const key = `${searchPath}/${file}`;
            files[key] = path.join(fullPath, file);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to get captured files for request ${requestId}`, error);
    }
    
    return files;
  }
  
  /**
   * Load captured data
   */
  public loadCapturedData(filepath: string): any {
    try {
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to load captured data from ${filepath}`, error);
      return null;
    }
  }
  
  /**
   * List all captured requests for analysis
   */
  public listCapturedRequests(): Array<{requestId: string, timestamp: string, provider: string, model: string}> {
    const requests: Array<{requestId: string, timestamp: string, provider: string, model: string}> = [];
    
    if (!this.enabled) return requests;
    
    try {
      const requestsPath = path.join(this.basePath, 'captures/raw/requests');
      if (fs.existsSync(requestsPath)) {
        const files = fs.readdirSync(requestsPath);
        
        for (const file of files) {
          try {
            const filepath = path.join(requestsPath, file);
            const data = this.loadCapturedData(filepath);
            
            if (data && data.requestId) {
              requests.push({
                requestId: data.requestId,
                timestamp: data.timestamp,
                provider: data.provider,
                model: data.model
              });
            }
          } catch (error) {
            logger.error(`Failed to process captured request file ${file}`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list captured requests', error);
    }
    
    return requests;
  }
}

// Export singleton instance
export const dataCaptureService = new DataCaptureService(require('./config').default.database);
