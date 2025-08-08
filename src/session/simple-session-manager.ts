/**
 * Simple Session Manager
 * Provides basic session tracking without concurrency control
 * 
 * Key Features:
 * 1. Session metadata tracking
 * 2. Request ID generation
 * 3. Basic statistics
 * 4. No queuing or concurrency control
 */

import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface SessionRequest {
  requestId: string;
  sessionId: string;
  conversationId: string;
  timestamp: Date;
  isStreaming: boolean;
  status: 'active' | 'completed' | 'failed';
  sequenceNumber: number;
  startTime: number;
  endTime?: number;
}

export interface SessionStats {
  totalSessions: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  outOfOrderResponses: number;
}

/**
 * Simple session manager without concurrency control
 * Provides basic session tracking and request ID generation
 */
export class SimpleSessionManager extends EventEmitter {
  private activeRequests: Map<string, SessionRequest> = new Map();
  private sessionCounters: Map<string, number> = new Map();
  private completedRequests: number = 0;
  private failedRequests: number = 0;
  private outOfOrderResponses: number = 0;
  private conversationHistory: Map<string, SessionRequest[]> = new Map();

  constructor(private port: number) {
    super();

    // Cleanup expired sessions every 10 minutes
    setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);

    logger.info('SimpleSessionManager initialized', {
      port: this.port,
      concurrencyControl: false,
      queueManagement: false
    }, 'session-manager');
  }

  /**
   * Generate a simple request ID without queuing
   * Format: sessionId:conversationId:timestamp:random
   */
  generateRequestId(
    sessionId: string,
    conversationId: string,
    isStreaming: boolean = false
  ): string {
    const sessionKey = `${sessionId}:${conversationId}`;

    // Get next counter for this session
    const counter = this.getNextCounter(sessionKey);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4);

    const requestId = `${sessionKey}:${counter}:${timestamp}:${random}`;

    // Create session request record
    const sessionRequest: SessionRequest = {
      requestId,
      sessionId,
      conversationId,
      timestamp: new Date(),
      isStreaming,
      status: 'active',
      sequenceNumber: counter,
      startTime: performance.now()
    };

    this.activeRequests.set(requestId, sessionRequest);

    logger.debug('Generated simple request ID', {
      requestId,
      sessionId,
      conversationId,
      counter,
      isStreaming
    }, requestId, 'session-manager');

    this.emit('requestGenerated', sessionRequest);

    return requestId;
  }

  /**
   * Mark request as completed
   */
  completeRequest(requestId: string, finishReason?: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      logger.warn('Attempted to complete unknown request', {
        requestId,
        finishReason
      }, requestId, 'session-manager');
      return;
    }

    request.status = 'completed';
    request.endTime = performance.now();
    this.activeRequests.delete(requestId);
    this.completedRequests++;

    // Check for out-of-order completion
    this.checkRequestOrder(request);

    // Add to conversation history
    const conversationKey = `${request.sessionId}:${request.conversationId}`;
    if (!this.conversationHistory.has(conversationKey)) {
      this.conversationHistory.set(conversationKey, []);
    }
    this.conversationHistory.get(conversationKey)!.push(request);

    logger.debug('Request completed', {
      requestId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      sequenceNumber: request.sequenceNumber,
      processingTime: request.endTime - request.startTime,
      finishReason,
      totalCompleted: this.completedRequests
    }, requestId, 'session-manager');

    this.emit('requestCompleted', {
      requestId,
      finishReason,
      sessionRequest: request
    });
  }

  /**
   * Mark request as failed
   */
  failRequest(requestId: string, error: any): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      logger.warn('Attempted to fail unknown request', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      }, requestId, 'session-manager');
      return;
    }

    request.status = 'failed';
    this.activeRequests.delete(requestId);
    this.failedRequests++;

    logger.debug('Request failed', {
      requestId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
      totalFailed: this.failedRequests
    }, requestId, 'session-manager');

    this.emit('requestFailed', {
      requestId,
      error,
      sessionRequest: request
    });
  }

  /**
   * Check if a request is active
   */
  isRequestActive(requestId: string): boolean {
    return this.activeRequests.has(requestId);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): SessionStats {
    const totalSessions = this.sessionCounters.size;
    const activeRequests = this.activeRequests.size;

    return {
      totalSessions,
      activeRequests,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      outOfOrderResponses: this.outOfOrderResponses
    };
  }

  /**
   * Get active requests for a specific session
   */
  getActiveRequests(sessionId: string, conversationId?: string): SessionRequest[] {
    const requests = Array.from(this.activeRequests.values());

    if (conversationId) {
      return requests.filter(req =>
        req.sessionId === sessionId && req.conversationId === conversationId
      );
    }

    return requests.filter(req => req.sessionId === sessionId);
  }

  /**
   * Get next counter for a session
   */
  private getNextCounter(sessionKey: string): number {
    const current = this.sessionCounters.get(sessionKey) || 0;
    const next = current + 1;
    this.sessionCounters.set(sessionKey, next);
    return next;
  }

  /**
   * Check if request completed out of order and log warning
   */
  private checkRequestOrder(completedRequest: SessionRequest): void {
    const conversationKey = `${completedRequest.sessionId}:${completedRequest.conversationId}`;
    const history = this.conversationHistory.get(conversationKey) || [];

    // Check if there are any earlier requests that are still active
    const earlierActiveRequests = Array.from(this.activeRequests.values())
      .filter(req =>
        `${req.sessionId}:${req.conversationId}` === conversationKey &&
        req.sequenceNumber < completedRequest.sequenceNumber
      );

    if (earlierActiveRequests.length > 0) {
      this.outOfOrderResponses++;

      // 🚨 Critical Warning: Out-of-order response detected
      console.warn(`🚨 OUT-OF-ORDER RESPONSE DETECTED:`);
      console.warn(`   Completed Request: ${completedRequest.requestId} (seq: ${completedRequest.sequenceNumber})`);
      console.warn(`   Earlier Active Requests: ${earlierActiveRequests.length}`);
      earlierActiveRequests.forEach(req => {
        console.warn(`     - ${req.requestId} (seq: ${req.sequenceNumber})`);
      });
      console.warn(`   Conversation: ${conversationKey}`);
      console.warn(`   Processing Time: ${Math.round(completedRequest.endTime! - completedRequest.startTime)}ms`);

      logger.warn('Out-of-order response detected', {
        completedRequestId: completedRequest.requestId,
        completedSequence: completedRequest.sequenceNumber,
        earlierActiveRequests: earlierActiveRequests.map(req => ({
          requestId: req.requestId,
          sequenceNumber: req.sequenceNumber,
          waitingTime: performance.now() - req.startTime
        })),
        conversationKey,
        processingTime: completedRequest.endTime! - completedRequest.startTime,
        totalOutOfOrder: this.outOfOrderResponses
      }, completedRequest.requestId, 'order-detection');

      this.emit('outOfOrderResponse', {
        completedRequest,
        earlierActiveRequests,
        conversationKey
      });
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const expiredRequests: string[] = [];

    // Find expired active requests
    for (const [requestId, request] of this.activeRequests.entries()) {
      const age = now.getTime() - request.timestamp.getTime();
      if (age > expiredThreshold) {
        expiredRequests.push(requestId);
      }
    }

    // Clean up expired requests
    for (const requestId of expiredRequests) {
      const request = this.activeRequests.get(requestId);
      if (request) {
        this.activeRequests.delete(requestId);
        this.failedRequests++;

        logger.warn('Cleaned up expired request', {
          requestId,
          sessionId: request.sessionId,
          conversationId: request.conversationId,
          age: now.getTime() - request.timestamp.getTime()
        }, requestId, 'session-manager');
      }
    }

    // Clean up old session counters (keep only active sessions)
    const activeSessions = new Set<string>();
    for (const request of this.activeRequests.values()) {
      activeSessions.add(`${request.sessionId}:${request.conversationId}`);
    }

    const expiredSessions: string[] = [];
    for (const sessionKey of this.sessionCounters.keys()) {
      if (!activeSessions.has(sessionKey)) {
        expiredSessions.push(sessionKey);
      }
    }

    for (const sessionKey of expiredSessions) {
      this.sessionCounters.delete(sessionKey);
    }

    // Clean up old conversation history
    const expiredHistoryKeys: string[] = [];
    for (const [conversationKey, history] of this.conversationHistory.entries()) {
      if (history.length > 0) {
        const oldestRequest = history[0];
        const age = now.getTime() - oldestRequest.timestamp.getTime();
        if (age > expiredThreshold) {
          expiredHistoryKeys.push(conversationKey);
        }
      }
    }

    for (const conversationKey of expiredHistoryKeys) {
      this.conversationHistory.delete(conversationKey);
    }

    if (expiredRequests.length > 0 || expiredSessions.length > 0 || expiredHistoryKeys.length > 0) {
      logger.info('Cleaned up expired session data', {
        expiredRequests: expiredRequests.length,
        expiredSessions: expiredSessions.length,
        expiredHistory: expiredHistoryKeys.length,
        activeRequests: this.activeRequests.size,
        activeSessions: activeSessions.size,
        conversationHistories: this.conversationHistory.size
      }, 'session-manager');
    }
  }
}

// Global simple session manager instances per port
const sessionManagers: Map<number, SimpleSessionManager> = new Map();

/**
 * Get or create simple session manager for a specific port
 */
export function getSimpleSessionManager(port: number): SimpleSessionManager {
  if (!sessionManagers.has(port)) {
    sessionManagers.set(port, new SimpleSessionManager(port));
  }
  return sessionManagers.get(port)!;
}