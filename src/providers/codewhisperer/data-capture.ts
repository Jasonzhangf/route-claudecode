/**
 * CodeWhisperer Data Capture Module
 * Captures multi-stage data for debugging and analysis
 * 
 * Project Owner: Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { BaseRequest, BaseResponse } from '@/types';
import { CodeWhispererRequest } from './converter';

// Ensure database directory exists
const databaseDir = path.join(process.env.HOME || '', '.route-claude-code', 'database');
const capturesDir = path.join(databaseDir, 'captures', 'codewhisperer');

// Create directories if they don't exist
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir, { recursive: true });
  logger.info('Created CodeWhisperer data capture directory', { capturesDir });
}

// Data capture interfaces for different stages
export interface AuthCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'auth';
  event: 'token_refresh' | 'token_validation' | 'auth_failure' | 'token_expired';
  data: {
    tokenValid?: boolean;
    refreshAttempted?: boolean;
    authError?: any;
    tokenInfo?: any;
    timeTaken?: number;
  };
  metadata?: any;
}

export interface ConversionCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'conversion';
  event: 'request_conversion' | 'response_conversion' | 'history_building';
  data: {
    originalRequest?: BaseRequest;
    convertedRequest?: CodeWhispererRequest;
    originalResponse?: any;
    convertedResponse?: BaseResponse;
    historyLength?: number;
    toolsCount?: number;
    toolResultsCount?: number;
    timeTaken?: number;
  };
  metadata?: any;
}

export interface HttpCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'http';
  event: 'request_sent' | 'response_received' | 'request_retry' | 'http_error';
  data: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    requestBody?: any;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: any;
    rawResponse?: Buffer;
    responseSize?: number;
    timeTaken?: number;
    retryAttempt?: number;
  };
  metadata?: any;
}

export interface ParsingCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'parsing';
  event: 'sse_parsing' | 'buffered_conversion' | 'stream_reconstruction' | 'tool_detection' | 'parsing_error';
  data: {
    sseEventCount?: number;
    sseEvents?: any[];
    bufferedResponse?: any;
    streamEvents?: any[];
    toolCallsDetected?: number;
    textBlocksDetected?: number;
    parsingMethod?: 'streaming' | 'buffered';
    processingTime?: number;
    errorDetails?: any;
    timeTaken?: number;
    responseSize?: number;
  };
  metadata?: any;
}

export interface ToolCallCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'tool_processing';
  event: 'tool_call_detected' | 'tool_call_fixed' | 'tool_result_processed' | 'tool_error';
  data: {
    originalText?: string;
    toolCallExtracted?: any;
    fixedToolCall?: any;
    toolResults?: any[];
    fixMethod?: string;
    confidence?: number;
    timeTaken?: number;
  };
  metadata?: any;
}

// Union type for all capture data types
export type CaptureData = 
  | AuthCaptureData 
  | ConversionCaptureData 
  | HttpCaptureData 
  | ParsingCaptureData 
  | ToolCallCaptureData;

/**
 * Save captured data to file with stage-specific filename
 */
export function saveCaptureData(data: CaptureData): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cw-${data.stage}-${data.event}-${timestamp}-${data.requestId || 'unknown'}.json`;
    const filepath = path.join(capturesDir, filename);
    
    // Write data to file
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    logger.debug('CodeWhisperer data captured and saved', { 
      filepath,
      requestId: data.requestId,
      stage: data.stage,
      event: data.event
    });
  } catch (error) {
    logger.error('Failed to save CodeWhisperer capture data', { 
      error: error instanceof Error ? error.message : String(error),
      stage: data.stage,
      event: data.event
    });
  }
}

/**
 * Capture authentication events
 */
export function captureAuthEvent(
  requestId: string,
  event: AuthCaptureData['event'],
  data: AuthCaptureData['data'],
  metadata?: any
): void {
  const captureData: AuthCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'auth',
    event,
    data: JSON.parse(JSON.stringify(data)), // Deep copy
    metadata
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture request/response conversion events
 */
export function captureConversionEvent(
  requestId: string,
  event: ConversionCaptureData['event'],
  data: ConversionCaptureData['data'],
  metadata?: any
): void {
  const captureData: ConversionCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'conversion',
    event,
    data: JSON.parse(JSON.stringify(data)), // Deep copy
    metadata
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture HTTP layer events
 */
export function captureHttpEvent(
  requestId: string,
  event: HttpCaptureData['event'],
  data: HttpCaptureData['data'],
  metadata?: any
): void {
  // Special handling for Buffer data
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (Buffer.isBuffer(value)) {
      return {
        type: 'Buffer',
        length: value.length,
        preview: value.toString('hex').slice(0, 200)
      };
    }
    return value;
  }));

  const captureData: HttpCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'http',
    event,
    data: cleanData,
    metadata
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture parsing stage events
 */
export function captureParsingEvent(
  requestId: string,
  event: ParsingCaptureData['event'],
  data: ParsingCaptureData['data'],
  metadata?: any
): void {
  const captureData: ParsingCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'parsing',
    event,
    data: JSON.parse(JSON.stringify(data)), // Deep copy
    metadata
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture tool call processing events  
 */
export function captureToolCallEvent(
  requestId: string,
  event: ToolCallCaptureData['event'],
  data: ToolCallCaptureData['data'],
  metadata?: any
): void {
  const captureData: ToolCallCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'tool_processing',
    event,
    data: JSON.parse(JSON.stringify(data)), // Deep copy
    metadata
  };
  
  saveCaptureData(captureData);
}

/**
 * List captured files by stage
 */
export function listCapturedFiles(stage?: string): string[] {
  try {
    const files = fs.readdirSync(capturesDir);
    let filteredFiles = files.filter(file => file.endsWith('.json'));
    
    if (stage) {
      filteredFiles = filteredFiles.filter(file => file.includes(`cw-${stage}-`));
    }
    
    return filteredFiles.sort();
  } catch (error) {
    logger.error('Failed to list CodeWhisperer captured files', { 
      error: error instanceof Error ? error.message : String(error),
      stage 
    });
    return [];
  }
}

/**
 * Load captured data from file
 */
export function loadCapturedData(filename: string): CaptureData | null {
  try {
    const filepath = path.join(capturesDir, filename);
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to load CodeWhisperer captured data', { 
      filename,
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Get capture statistics
 */
export function getCaptureStats(): Record<string, number> {
  try {
    const files = listCapturedFiles();
    const stats: Record<string, number> = {
      total: files.length,
      auth: 0,
      conversion: 0,
      http: 0,
      parsing: 0,
      tool_processing: 0
    };
    
    files.forEach(file => {
      if (file.includes('cw-auth-')) stats.auth++;
      else if (file.includes('cw-conversion-')) stats.conversion++;
      else if (file.includes('cw-http-')) stats.http++;
      else if (file.includes('cw-parsing-')) stats.parsing++;
      else if (file.includes('cw-tool_processing-')) stats.tool_processing++;
    });
    
    return stats;
  } catch (error) {
    logger.error('Failed to get CodeWhisperer capture statistics', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { total: 0 };
  }
}

/**
 * Find related captures for a specific request ID
 */
export function findRelatedCaptures(requestId: string): CaptureData[] {
  try {
    const files = listCapturedFiles();
    const relatedFiles = files.filter(file => file.includes(requestId));
    
    const captures: CaptureData[] = [];
    relatedFiles.forEach(file => {
      const data = loadCapturedData(file);
      if (data) {
        captures.push(data);
      }
    });
    
    // Sort by timestamp
    captures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return captures;
  } catch (error) {
    logger.error('Failed to find related CodeWhisperer captures', { 
      requestId,
      error: error instanceof Error ? error.message : String(error) 
    });
    return [];
  }
}

/**
 * Clean up old capture files (older than specified days)
 */
export function cleanupOldCaptures(daysOld: number = 7): number {
  try {
    const files = listCapturedFiles();
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    files.forEach(file => {
      try {
        const filepath = path.join(capturesDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      } catch (error) {
        logger.warn('Failed to delete old capture file', { file, error });
      }
    });
    
    logger.info('Cleaned up old CodeWhisperer captures', { 
      deletedCount,
      daysOld,
      totalFiles: files.length 
    });
    
    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup old CodeWhisperer captures', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return 0;
  }
}