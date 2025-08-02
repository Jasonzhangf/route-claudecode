/**
 * Pipeline Debugger with Streaming Chunk Aggregation
 * Optimized debug system that merges streaming chunks into session files
 * Project Owner: Jason Zhang
 */

import { promises as fs } from 'fs';
import * as path from 'path';

interface StreamingSession {
  requestId: string;
  chunks: Array<{
    timestamp: string;
    chunkIndex: number;
    stage: string;
    data: any;
  }>;
  startTime: number;
  metadata: any;
}

interface DebugNode {
  timestamp: string;
  stage: string;
  data: any;
  requestId: string;
}

export class PipelineDebugger {
  private logDir: string;
  private streamingSessions: Map<string, StreamingSession> = new Map();
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.logDir = path.join(process.env.HOME || '', '.route-claude-code', 'logs', `port-${port}`);
    this.ensureLogDir();
  }

  private async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Log a pipeline node (traditional method)
   */
  logNode(requestId: string, stage: string, data: any): void {
    const node: DebugNode = {
      timestamp: new Date().toISOString(),
      stage,
      data,
      requestId
    };

    // Write to individual file (legacy support)
    this.writeNodeFile(node).catch(error => {
      console.error('Failed to write debug node:', error);
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
        metadata: {}
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

    // Log progress every 10 chunks to avoid console spam
    if (session.chunks.length % 10 === 0) {
      console.log(`📦 Streaming session ${requestId}: ${session.chunks.length} chunks aggregated`);
    }
  }

  /**
   * Start a new streaming session
   */
  startStreamingSession(requestId: string, metadata: any = {}): void {
    const session: StreamingSession = {
      requestId,
      chunks: [],
      startTime: Date.now(),
      metadata
    };
    
    this.streamingSessions.set(requestId, session);
    console.log(`🚀 Started streaming session: ${requestId}`);
  }

  /**
   * Add a chunk to an existing streaming session
   */
  addStreamingChunk(requestId: string, stage: string, data: any): void {
    this.logNodeOptimized(requestId, stage, data);
  }

  /**
   * Finish streaming session and write aggregated file
   */
  async finishStreamingSession(requestId: string, finalMetadata: any = {}): Promise<void> {
    const session = this.streamingSessions.get(requestId);
    
    if (!session) {
      console.warn(`⚠️  No streaming session found for ${requestId}`);
      return;
    }

    try {
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

      // Write single consolidated file
      const filename = `streaming-session-${requestId}-${Date.now()}.json`;
      const filepath = path.join(this.logDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf-8');
      
      console.log(`✅ Streaming session completed: ${requestId}`);
      console.log(`📄 Aggregated ${session.chunks.length} chunks into: ${filename}`);
      console.log(`⏱️  Session duration: ${Date.now() - session.startTime}ms`);
      
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
   * Log failure information
   */
  async logFailure(failureData: any): Promise<void> {
    const failure = {
      timestamp: new Date().toISOString(),
      type: 'failure',
      ...failureData
    };

    try {
      const filename = `failure-${failureData.requestId || 'unknown'}-${Date.now()}.json`;
      const filepath = path.join(this.logDir, filename);
      await fs.writeFile(filepath, JSON.stringify(failure, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write failure log:', error);
    }
  }

  private async writeNodeFile(node: DebugNode): Promise<void> {
    const filename = `debug-node-${node.requestId}-${node.stage}-${Date.now()}.json`;
    const filepath = path.join(this.logDir, filename);
    await fs.writeFile(filepath, JSON.stringify(node, null, 2), 'utf-8');
  }

  private async writeTraceFile(trace: any): Promise<void> {
    const filename = `trace-${trace.requestId}-${Date.now()}.json`;
    const filepath = path.join(this.logDir, filename);
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
   * Get current streaming sessions status
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
      logDirectory: this.logDir,
      port: this.port
    };
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