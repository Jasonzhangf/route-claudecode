/**
 * 请求跟踪器 - 专门处理请求生命周期跟踪
 * 整合原有的RequestBasedLogger功能
 */

import { UnifiedLogger } from './unified-logger';

interface RequestSession {
  requestId: string;
  startTime: number;
  endTime?: number;
  stages: Array<{
    stage: string;
    timestamp: number;
    duration?: number;
    data?: any;
  }>;
  provider?: string;
  model?: string;
  port: number;
}

export class RequestTracker {
  private logger: UnifiedLogger;
  private activeSessions: Map<string, RequestSession> = new Map();

  constructor(logger: UnifiedLogger) {
    this.logger = logger;
  }

  startRequest(
    requestId: string,
    port: number,
    provider?: string,
    model?: string,
    data?: any
  ): void {
    const session: RequestSession = {
      requestId,
      startTime: Date.now(),
      stages: [],
      provider,
      model,
      port
    };

    this.activeSessions.set(requestId, session);
    this.logger.logRequest(requestId, 'START', 'Request started', {
      provider,
      model,
      port,
      ...data
    });
  }

  logStage(
    requestId: string,
    stage: string,
    data?: any,
    duration?: number
  ): void {
    const session = this.activeSessions.get(requestId);
    if (!session) {
      this.logger.warn(`Request ${requestId} not found for stage logging`, { stage });
      return;
    }

    const stageEntry = {
      stage,
      timestamp: Date.now(),
      duration,
      data
    };

    session.stages.push(stageEntry);
    this.logger.logPipeline(stage, `Stage: ${stage}`, data, requestId);
  }

  logToolCall(
    requestId: string,
    toolName: string,
    data?: any,
    error?: any
  ): void {
    const message = error ? `Tool call failed: ${toolName}` : `Tool call: ${toolName}`;
    this.logger.logToolCall(message, { toolName, error, ...data }, requestId, 'tool_call');
  }

  logStreaming(
    requestId: string,
    chunkIndex: number,
    data?: any
  ): void {
    // 只在debug级别记录chunk信息，避免INFO级别刷屏
    this.logger.debug(`Chunk ${chunkIndex}`, data, requestId, 'streaming');
  }

  completeRequest(
    requestId: string,
    status?: number,
    data?: any
  ): void {
    const session = this.activeSessions.get(requestId);
    if (!session) {
      this.logger.warn(`Request ${requestId} not found for completion`);
      return;
    }

    const endTime = Date.now();
    const totalDuration = endTime - session.startTime;

    session.endTime = endTime;

    this.logger.logResponse(requestId, status || 200, {
      totalDuration,
      stagesCount: session.stages.length,
      provider: session.provider,
      model: session.model,
      ...data
    }, totalDuration);

    this.logger.logPerformance('request_complete', totalDuration, {
      requestId,
      stagesCount: session.stages.length,
      provider: session.provider,
      model: session.model
    }, requestId);

    this.activeSessions.delete(requestId);
  }

  getActiveRequests(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  getRequestSession(requestId: string): RequestSession | undefined {
    return this.activeSessions.get(requestId);
  }

  cleanupOldSessions(maxAgeMs: number = 300000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [requestId, session] of this.activeSessions) {
      if (now - session.startTime > maxAgeMs) {
        this.logger.warn(`Cleaning up old request session: ${requestId}`);
        this.activeSessions.delete(requestId);
        cleaned++;
      }
    }

    return cleaned;
  }
}