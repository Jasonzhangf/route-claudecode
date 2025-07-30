/**
 * OpenAI Data Capture Module
 * Captures raw request and response data for debugging and analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';

// Ensure database directory exists
const databaseDir = path.join(process.env.HOME || '', '.route-claude-code', 'database');
const capturesDir = path.join(databaseDir, 'captures', 'openai');

// Create directories if they don't exist
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir, { recursive: true });
  logger.info('Created OpenAI data capture directory', { capturesDir });
}

export interface CaptureData {
  timestamp: string;
  requestId: string;
  provider: string;
  model: string;
  request: any;
  response?: any;
  error?: any;
  metadata?: any;
}

/**
 * Save captured data to file
 */
export function saveCaptureData(data: CaptureData): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `openai-capture-${timestamp}-${data.requestId || 'unknown'}.json`;
    const filepath = path.join(capturesDir, filename);
    
    // Write data to file
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    logger.debug('OpenAI data captured and saved', { 
      filepath,
      requestId: data.requestId,
      provider: data.provider
    });
  } catch (error) {
    logger.error('Failed to save OpenAI capture data', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Capture request data
 */
export function captureRequest(provider: string, model: string, request: any, requestId?: string): void {
  const captureData: CaptureData = {
    timestamp: new Date().toISOString(),
    requestId: requestId || 'unknown',
    provider,
    model,
    request: JSON.parse(JSON.stringify(request)) // Deep copy to avoid reference issues
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture response data
 */
export function captureResponse(provider: string, model: string, request: any, response: any, requestId?: string): void {
  const captureData: CaptureData = {
    timestamp: new Date().toISOString(),
    requestId: requestId || 'unknown',
    provider,
    model,
    request: JSON.parse(JSON.stringify(request)), // Deep copy
    response: JSON.parse(JSON.stringify(response)) // Deep copy
  };
  
  saveCaptureData(captureData);
}

/**
 * Capture error data
 */
export function captureError(provider: string, model: string, request: any, error: any, requestId?: string): void {
  const captureData: CaptureData = {
    timestamp: new Date().toISOString(),
    requestId: requestId || 'unknown',
    provider,
    model,
    request: JSON.parse(JSON.stringify(request)), // Deep copy
    error: {
      message: error.message || String(error),
      stack: error.stack,
      name: error.name
    }
  };
  
  saveCaptureData(captureData);
}

/**
 * List captured files
 */
export function listCapturedFiles(): string[] {
  try {
    const files = fs.readdirSync(capturesDir);
    return files.filter(file => file.endsWith('.json')).sort();
  } catch (error) {
    logger.error('Failed to list captured files', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return [];
  }
}

/**
 * Load captured data
 */
export function loadCapturedData(filename: string): CaptureData | null {
  try {
    const filepath = path.join(capturesDir, filename);
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to load captured data', { 
      filename,
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Capture parsing events for detailed analysis
 */
export function captureParsingEvent(requestId: string, eventType: string, data: any): void {
  try {
    const parsingDir = path.join(databaseDir, 'parsing-events', 'openai');
    if (!fs.existsSync(parsingDir)) {
      fs.mkdirSync(parsingDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `parsing-${eventType}-${timestamp}-${requestId || 'unknown'}.json`;
    const filepath = path.join(parsingDir, filename);
    
    const captureData = {
      timestamp: new Date().toISOString(),
      requestId,
      eventType,
      data
    };
    
    fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
    logger.debug('Parsing event captured', { filepath, eventType });
  } catch (error) {
    logger.error('Failed to capture parsing event', { 
      error: error instanceof Error ? error.message : String(error),
      eventType 
    });
  }
}

/**
 * Capture tool call events for analysis
 */
export function captureToolCallEvent(requestId: string, toolCallData: any): void {
  try {
    const toolCallsDir = path.join(databaseDir, 'tool-calls', 'openai');
    if (!fs.existsSync(toolCallsDir)) {
      fs.mkdirSync(toolCallsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `toolcall-${timestamp}-${requestId || 'unknown'}.json`;
    const filepath = path.join(toolCallsDir, filename);
    
    const captureData = {
      timestamp: new Date().toISOString(),
      requestId,
      toolCallData
    };
    
    fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
    logger.debug('Tool call event captured', { filepath });
  } catch (error) {
    logger.error('Failed to capture tool call event', { 
      error: error instanceof Error ? error.message : String(error)
    });
  }
}