/**
 * Pipeline Debugger with Time-Based Log Rotation and Comprehensive Debug System
 * Implements the design specifications from pipeline-debug-system-design.md
 * Project Owner: Jason Zhang
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

interface StreamingSession {
  requestId: string;
  chunks: Array<{
    timestamp: string;
    chunkIndex: number;
    stage: string;
    data: any;
    rawChunk?: string; // Store raw chunk data for error analysis
  }>;
  startTime: number;
  metadata: any;
  rawStreamData: string[]; // Capture raw stream data for analysis
}

interface DebugNode {
  timestamp: string;
  stage: string;
  data: any;
  requestId: string;
}

interface StandardizedError {
  port: number;
  provider: string;
  model: string;
  key: string;
  errorCode: number;
  reason: string;
  timestamp: string;
  requestId: string;
}


export class ToolCallError extends Error {
  port: number;

  constructor(
    public errorMessage: string,
    public requestId: string,
    public transformationStage: string,
    public provider: string,
    public model: string,
    public context: any,
    port: number
  ) {
    super(errorMessage);
    this.name = 'ToolCallError';
    this.port = port;
  }
}

export class PipelineDebugger {
  private baseLogDir: string;
  private portLogDir: string;
  private currentRotationDir: string = '';
  private rotationInterval: number;
  private lastRotationTime: number;
  private streamingSessions: Map<string, StreamingSession> = new Map();
  private port: number;
  private failuresLogPath: string;
  private toolCallErrorsLogPath: string;

  constructor(port: number) {
    this.port = port;
    this.rotationInterval = 5 * 60 * 1000; // 5 minutes
    this.lastRotationTime = Date.now();
    this.baseLogDir = path.join(process.env.HOME || '', '.route-claude-code', 'logs');
    this.portLogDir = path.join(this.baseLogDir, `port-${port}`);
    this.failuresLogPath = path.join(this.portLogDir, 'failures.jsonl');
    this.toolCallErrorsLogPath = path.join(this.portLogDir, 'tool-call-errors.jsonl');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      // Create base log directory
      await fs.mkdir(this.baseLogDir, { recursive: true });
      // Create port-specific directory
      await fs.mkdir(this.portLogDir, { recursive: true });
      // Create initial rotation directory
      this.updateRotationDirectory();
      // Create failures.jsonl if it doesn't exist
      try {
        await fs.access(this.failuresLogPath);
      } catch {
        await fs.writeFile(this.failuresLogPath, '', 'utf-8');
      }
      
      // Create tool-call-errors.jsonl if it doesn't exist
      try {
        await fs.access(this.toolCallErrorsLogPath);
      } catch {
        await fs.writeFile(this.toolCallErrorsLogPath, '', 'utf-8');
      }
    } catch (error) {
      console.error('Failed to initialize debug directories:', error);
    }
  }

  private updateRotationDirectory(): void {
    const now = new Date();
    const rotationDirName = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.currentRotationDir = path.join(this.portLogDir, rotationDirName);
    this.lastRotationTime = Date.now();
  }

  private async ensureRotationDirectory(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRotationTime > this.rotationInterval) {
      this.updateRotationDirectory();
    }
    
    try {
      await fs.mkdir(this.currentRotationDir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        console.error('Failed to create rotation directory:', error);
      }
    }
  }

  /**
   * Log a pipeline node (traditional method)
   */
  logNode(requestId: string, stage: string, data: any): void {
    this.ensureRotationDirectory().then(() => {
      const node: DebugNode = {
        timestamp: new Date().toISOString(),
        stage,
        data,
        requestId
      };

      // Write to individual node file in current rotation directory
      this.writeNodeFile(node).catch(error => {
        console.error('Failed to write debug node:', error);
      });
    }).catch(error => {
      console.error('Failed to ensure rotation directory:', error);
    });
  }

  /**
   * Optimized logging for streaming chunks
   * Aggregates chunks in memory instead of writing individual files
   */
  logNodeOptimized(requestId: string, stage: string, data: any): void {
    let session = this.streamingSessions.get(requestId);
    
    if (!session) {
      session = {
        requestId,
        chunks: [],
        startTime: Date.now(),
        metadata: {},
        rawStreamData: []
      };
      this.streamingSessions.set(requestId, session);
    }

    // Add chunk to session
    session.chunks.push({
      timestamp: new Date().toISOString(),
      chunkIndex: session.chunks.length,
      stage,
      data
    });

    // Chunks aggregated silently - progress tracked internally only
  }

  /**
   * Start a new streaming session
   */
  startStreamingSession(requestId: string, metadata: any = {}): void {
    const session: StreamingSession = {
      requestId,
      chunks: [],
      startTime: Date.now(),
      metadata,
      rawStreamData: []
    };
    
    this.streamingSessions.set(requestId, session);
    // Streaming session started silently
  }

  /**
   * Add a chunk to an existing streaming session
   */
  addStreamingChunk(requestId: string, stage: string, data: any): void {
    this.logNodeOptimized(requestId, stage, data);
  }

  /**
   * Finish streaming session and write aggregated file with proper rotation
   */
  async finishStreamingSession(requestId: string, finalMetadata: any = {}): Promise<void> {
    const session = this.streamingSessions.get(requestId);
    
    if (!session) {
      console.warn(`⚠️  No streaming session found for ${requestId}`);
      return;
    }

    try {
      await this.ensureRotationDirectory();
      
      // Create aggregated session file
      const sessionData = {
        sessionInfo: {
          requestId,
          startTime: session.startTime,
          endTime: Date.now(),
          duration: Date.now() - session.startTime,
          totalChunks: session.chunks.length,
          ...session.metadata,
          ...finalMetadata
        },
        chunks: session.chunks,
        summary: {
          stages: this.getStagesSummary(session.chunks),
          chunkTypes: this.getChunkTypesSummary(session.chunks),
          timing: this.getTimingSummary(session.chunks)
        }
      };

      // Write single consolidated file to current rotation directory
      const filename = `pipeline-trace-${requestId}.json`;
      const filepath = path.join(this.currentRotationDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf-8');
      
      // Streaming session completed silently - data saved to file
      
      // Clean up memory
      this.streamingSessions.delete(requestId);
      
    } catch (error) {
      console.error(`❌ Failed to write streaming session ${requestId}:`, error);
    }
  }

  /**
   * Log trace information
   */
  logTrace(requestId: string, data: any): void {
    const trace = {
      timestamp: new Date().toISOString(),
      requestId,
      type: 'trace',
      data
    };

    this.writeTraceFile(trace).catch(error => {
      console.error('Failed to write trace:', error);
    });
  }

  /**
   * Capture and log tool call conversion errors
   * Detects when tool calls appear in text areas or conversion fails
   */
  async logToolCallError(errorData: ToolCallError): Promise<void> {
    try {
      await this.ensureRotationDirectory();
      
      const errorEntry = {
        timestamp: new Date().toISOString(),
        requestId: errorData.requestId,
        errorType: errorData.name,
        errorMessage: errorData.errorMessage,
        context: errorData.context,
        transformationStage: errorData.transformationStage,
        provider: errorData.provider,
        model: errorData.model,
        port: errorData.port
      };

      // Append to tool-call-errors.jsonl
      const errorLine = JSON.stringify(errorEntry) + '\n';
      await fs.appendFile(this.toolCallErrorsLogPath, errorLine, 'utf-8');
      
            
      // Tool call error logged silently
      
    } catch (error) {
      console.error('Failed to write tool call error log:', error);
    }
  }

  /**
   * Check if raw data contains tool call signatures
   */
  private isLikelyToolCallError(rawChunk: string, error: any): boolean {
    const toolCallPatterns = [
      // Tool call signatures
      /\{\s*"type"\s*:\s*"tool_use"/i,
      /\{\s*"name"\s*:\s*"[a-zA-Z_][a-zA-Z0-9_]*"/i,
      /\{\s*"function"\s*:/i,
      // Tool call keywords
      /tool_call/i,
      /function_call/i,
      // JSON structures
      /\{\s*"id"\s*:\s*"call_/i,
      /\{\s*"index"\s*:\s*\d+/i
    ];

    return toolCallPatterns.some(pattern => pattern.test(rawChunk));
  }

  /**
   * Save raw stream data for analysis
   */
  public saveRawStreamDataForAnalysis(rawStreamData: string[], transformationStage: string, error: any, requestId: string): void {
    try {
      const timestamp = new Date().toISOString();
      const filename = `raw-stream-error-${requestId}-${Date.now()}.json`;
      const filepath = path.join(this.currentRotationDir, filename);
      
      const analysisData = {
        timestamp,
        requestId,
        transformationStage,
        error: {
          message: error.message,
          stack: error.stack,
          type: error.constructor.name
        },
        rawStreamData,
        dataSize: rawStreamData.length,
        totalBytes: rawStreamData.join('').length
      };
      
      fs.writeFile(filepath, JSON.stringify(analysisData, null, 2), 'utf-8').catch(err => {
        console.error('Failed to save raw stream analysis data:', err);
      });
    } catch (error) {
      console.error('Failed to prepare raw stream analysis data:', error);
    }
  }

  /**
   * Detect tool call errors in text content
   * Modified to be less strict and avoid false positives from normal text
   */
  detectToolCallError(text: string, requestId: string, transformationStage: string, provider: string, model: string): boolean {
    // Only detect actual JSON tool call structures, not mentions in text
    const strictToolCallPatterns = [
      // Only detect actual JSON structures that look like tool calls
      /\{\s*"type"\s*:\s*"tool_use"\s*,/i,
      /\{\s*"name"\s*:\s*"[a-zA-Z_][a-zA-Z0-9_]*"\s*,\s*"arguments"/i,
      /\{\s*"function"\s*:\s*\{[^}]*"name"/i,
      /\{\s*"id"\s*:\s*"call_[a-zA-Z0-9_-]+"/i,
      // Only detect in specific contexts that indicate parsing issues
      /\[\s*\{\s*"index"\s*:\s*\d+\s*,\s*"type"\s*:\s*"function"/i
    ];

    for (const pattern of strictToolCallPatterns) {
      if (pattern.test(text)) {
        this.logToolCallError(
          new ToolCallError(
            `Actual tool call structure detected in text area: ${pattern.toString()}`,
            requestId,
            transformationStage,
            provider,
            model,
            { rawChunk: text },
            this.port
          )
        ).catch(error => {
          console.error('Failed to log tool call error:', error);
        });
        return true;
      }
    }
    return false;
  }

  /**
   * Add raw stream data for analysis
   */
  addRawStreamData(requestId: string, rawData: string): void {
    let session = this.streamingSessions.get(requestId);
    
    if (!session) {
      session = {
        requestId,
        chunks: [],
        startTime: Date.now(),
        metadata: {},
        rawStreamData: []
      };
      this.streamingSessions.set(requestId, session);
    }
    
    session.rawStreamData.push(rawData);
    
    // Limit raw data size to prevent memory issues
    if (session.rawStreamData.length > 1000) {
      session.rawStreamData = session.rawStreamData.slice(-500);
    }
  }

  /**
   * Log failure information with standardized format
   */
  async logFailure(failureData: StandardizedError): Promise<void> {
    try {
      await this.ensureRotationDirectory();
      
      const failureEntry = {
        timestamp: new Date().toISOString(),
        port: failureData.port,
        provider: failureData.provider,
        model: failureData.model,
        key: this.redactKey(failureData.key),
        errorCode: failureData.errorCode,
        reason: failureData.reason,
        requestId: failureData.requestId
      };

      // Append to failures.jsonl
      const failureLine = JSON.stringify(failureEntry) + '\n';
      await fs.appendFile(this.failuresLogPath, failureLine, 'utf-8');
      
      // Also write individual failure file to rotation directory
      const filename = `failure-${failureData.requestId || 'unknown'}-${Date.now()}.json`;
      const filepath = path.join(this.currentRotationDir, filename);
      await fs.writeFile(filepath, JSON.stringify(failureEntry, null, 2), 'utf-8');
      
      // Failure logged silently
      
    } catch (error) {
      console.error('Failed to write failure log:', error);
    }
  }

  /**
   * Redact sensitive key information
   */
  private redactKey(key: string): string {
    if (!key) return 'unknown';
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
  }

  private async writeNodeFile(node: DebugNode): Promise<void> {
    const filename = `node-${node.stage}-${node.requestId}.json`;
    const filepath = path.join(this.currentRotationDir, filename);
    await fs.writeFile(filepath, JSON.stringify(node, null, 2), 'utf-8');
  }

  private async writeTraceFile(trace: any): Promise<void> {
    await this.ensureRotationDirectory();
    const filename = `trace-${trace.requestId}-${Date.now()}.json`;
    const filepath = path.join(this.currentRotationDir, filename);
    await fs.writeFile(filepath, JSON.stringify(trace, null, 2), 'utf-8');
  }

  private getStagesSummary(chunks: any[]): Record<string, number> {
    const stages: Record<string, number> = {};
    chunks.forEach(chunk => {
      stages[chunk.stage] = (stages[chunk.stage] || 0) + 1;
    });
    return stages;
  }

  private getChunkTypesSummary(chunks: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    chunks.forEach(chunk => {
      const type = chunk.data?.chunk?.event || chunk.data?.event || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  private getTimingSummary(chunks: any[]): any {
    if (chunks.length === 0) return {};
    
    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];
    
    return {
      firstChunk: firstChunk.timestamp,
      lastChunk: lastChunk.timestamp,
      totalChunks: chunks.length,
      averageChunkInterval: chunks.length > 1 ? 
        (new Date(lastChunk.timestamp).getTime() - new Date(firstChunk.timestamp).getTime()) / (chunks.length - 1) : 0
    };
  }

  /**
   * Get current streaming sessions status with rotation info
   */
  getStreamingStatus(): any {
    const sessions: Record<string, any> = {};
    
    this.streamingSessions.forEach((session, requestId) => {
      sessions[requestId] = {
        startTime: session.startTime,
        duration: Date.now() - session.startTime,
        chunkCount: session.chunks.length,
        metadata: session.metadata
      };
    });

    return {
      activeSessionsCount: this.streamingSessions.size,
      sessions,
      baseLogDirectory: this.baseLogDir,
      portDirectory: this.portLogDir,
      currentRotationDir: this.currentRotationDir,
      failuresLogPath: this.failuresLogPath,
      toolCallErrorsLogPath: this.toolCallErrorsLogPath,
      port: this.port,
      rotationInterval: this.rotationInterval,
      lastRotationTime: this.lastRotationTime
    };
  }

  /**
   * Get recent tool call errors from the log file
   */
  async getRecentToolCallErrors(count: number = 10): Promise<any[]> {
    try {
      const content = await fs.readFile(this.toolCallErrorsLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const errors = lines.slice(-count).map(line => JSON.parse(line));
      return errors.reverse();
    } catch (error) {
      console.error('Failed to read recent tool call errors:', error);
      return [];
    }
  }

  /**
   * Get recent failures from the log file
   */
  async getRecentFailures(count: number = 10): Promise<any[]> {
    try {
      const content = await fs.readFile(this.failuresLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const failures = lines.slice(-count).map(line => JSON.parse(line));
      return failures.reverse();
    } catch (error) {
      console.error('Failed to read recent failures:', error);
      return [];
    }
  }

  /**
   * Clean up old rotation directories (keep last 24 hours)
   */
  async cleanupOldRotationDirectories(): Promise<number> {
    try {
      const dirs = await fs.readdir(this.portLogDir);
      const rotationDirs = dirs.filter(dir => dir.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/));
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let cleaned = 0;
      
      for (const dir of rotationDirs) {
        const dirPath = path.join(this.portLogDir, dir);
        const stats = await fs.stat(dirPath);
        
        if (stats.birthtimeMs < oneDayAgo) {
          await fs.rm(dirPath, { recursive: true });
          // Old rotation directory cleaned up silently
          cleaned++;
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup old rotation directories:', error);
      return 0;
    }
  }

  /**
   * Clean up old streaming sessions (emergency cleanup)
   */
  cleanupOldSessions(maxAge: number = 300000): number { // 5 minutes default
    const now = Date.now();
    let cleaned = 0;
    
    this.streamingSessions.forEach((session, requestId) => {
      if (now - session.startTime > maxAge) {
        console.warn(`🧹 Cleaning up old streaming session: ${requestId} (age: ${now - session.startTime}ms)`);
        this.streamingSessions.delete(requestId);
        cleaned++;
      }
    });
    
    return cleaned;
  }
}