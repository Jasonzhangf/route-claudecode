/**
 * Request Sequence Manager for OpenAI Provider
 * Implements precise request ordering and sequence number management
 * 
 * Key Features:
 * 1. Generates sequential requestId with clear numeric ordering
 * 2. Tracks request/response order within conversations
 * 3. Ensures finish reasons are properly handled
 * 4. Provides race condition detection and analysis
 */

import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface SequencedRequest {
  requestId: string;
  sessionId: string;
  conversationId: string;
  sequenceNumber: number;
  requestIndex: number;
  timestamp: Date;
  startTime: number;
  endTime?: number;
  finishReason?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface SequenceStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  sequenceAccuracy: number;
  finishReasonCoverage: number;
  raceConditionsDetected: number;
}

/**
 * Manages request sequencing and ordering for concurrency control
 */
export class RequestSequenceManager extends EventEmitter {
  private sequenceCounters: Map<string, number> = new Map();
  private activeRequests: Map<string, SequencedRequest> = new Map();
  private completedRequests: Map<string, SequencedRequest[]> = new Map();
  private conversationStats: Map<string, SequenceStats> = new Map();
  
  constructor(private port: number) {
    super();
    
    // Cleanup old data every 10 minutes
    setInterval(() => this.cleanupOldData(), 10 * 60 * 1000);
    
    logger.info('RequestSequenceManager initialized', {
      port: this.port,
      sequentialOrdering: true,
      raceConditionDetection: true
    }, 'sequence-manager');
  }

  /**
   * Generate a new sequenced request ID
   * Format: sessionId:conversationId:seq{NNNN}:timestamp
   */
  generateSequencedRequestId(
    sessionId: string,
    conversationId: string,
    requestIndex: number
  ): { requestId: string; sequenceNumber: number } {
    const conversationKey = `${sessionId}:${conversationId}`;
    
    // Get next sequence number for this conversation
    const currentSequence = this.sequenceCounters.get(conversationKey) || 0;
    const sequenceNumber = currentSequence + 1;
    this.sequenceCounters.set(conversationKey, sequenceNumber);
    
    // Generate requestId with clear numeric ordering
    const timestamp = Date.now();
    const requestId = `${conversationKey}:seq${sequenceNumber.toString().padStart(4, '0')}:${timestamp}`;
    
    // Create sequenced request record
    const sequencedRequest: SequencedRequest = {
      requestId,
      sessionId,
      conversationId,
      sequenceNumber,
      requestIndex,
      timestamp: new Date(),
      startTime: performance.now(),
      status: 'pending'
    };
    
    this.activeRequests.set(requestId, sequencedRequest);
    
    logger.debug('Generated sequenced request ID', {
      requestId,
      sessionId,
      conversationId,
      sequenceNumber,
      requestIndex,
      conversationKey
    }, requestId, 'sequence-manager');
    
    this.emit('requestGenerated', sequencedRequest);
    
    return { requestId, sequenceNumber };
  }

  /**
   * Mark request as started processing
   */
  startProcessing(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      logger.warn('Attempted to start processing unknown request', {
        requestId
      }, requestId, 'sequence-manager');
      return;
    }

    request.status = 'processing';
    request.startTime = performance.now();
    
    logger.debug('Request processing started', {
      requestId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      sequenceNumber: request.sequenceNumber
    }, requestId, 'sequence-manager');
    
    this.emit('processingStarted', request);
  }

  /**
   * Mark request as completed with finish reason
   */
  completeRequest(requestId: string, finishReason?: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      logger.warn('Attempted to complete unknown request', {
        requestId,
        finishReason
      }, requestId, 'sequence-manager');
      return;
    }

    request.status = 'completed';
    request.endTime = performance.now();
    request.finishReason = finishReason;
    
    const processingTime = request.endTime - request.startTime;
    const conversationKey = `${request.sessionId}:${request.conversationId}`;
    
    // Move to completed requests
    this.activeRequests.delete(requestId);
    if (!this.completedRequests.has(conversationKey)) {
      this.completedRequests.set(conversationKey, []);
    }
    this.completedRequests.get(conversationKey)!.push(request);
    
    // Update conversation stats
    this.updateConversationStats(conversationKey);
    
    logger.info('Request completed with sequence tracking', {
      requestId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      sequenceNumber: request.sequenceNumber,
      finishReason,
      processingTimeMs: Math.round(processingTime)
    }, requestId, 'sequence-manager');
    
    this.emit('requestCompleted', request);
    
    // Check for race conditions
    this.detectRaceConditions(conversationKey);
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
      }, requestId, 'sequence-manager');
      return;
    }

    request.status = 'failed';
    request.endTime = performance.now();
    
    const processingTime = request.endTime - request.startTime;
    const conversationKey = `${request.sessionId}:${request.conversationId}`;
    
    // Move to completed requests (for analysis)
    this.activeRequests.delete(requestId);
    if (!this.completedRequests.has(conversationKey)) {
      this.completedRequests.set(conversationKey, []);
    }
    this.completedRequests.get(conversationKey)!.push(request);
    
    // Update conversation stats
    this.updateConversationStats(conversationKey);
    
    logger.error('Request failed with sequence tracking', {
      requestId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      sequenceNumber: request.sequenceNumber,
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: Math.round(processingTime)
    }, requestId, 'sequence-manager');
    
    this.emit('requestFailed', request);
  }

  /**
   * Get sequence statistics for a conversation
   */
  getConversationStats(sessionId: string, conversationId: string): SequenceStats | null {
    const conversationKey = `${sessionId}:${conversationId}`;
    return this.conversationStats.get(conversationKey) || null;
  }

  /**
   * Get all active requests for a conversation
   */
  getActiveRequests(sessionId: string, conversationId: string): SequencedRequest[] {
    const conversationKey = `${sessionId}:${conversationId}`;
    return Array.from(this.activeRequests.values())
      .filter(req => `${req.sessionId}:${req.conversationId}` === conversationKey);
  }

  /**
   * Get completed requests for a conversation (sorted by sequence)
   */
  getCompletedRequests(sessionId: string, conversationId: string): SequencedRequest[] {
    const conversationKey = `${sessionId}:${conversationId}`;
    const completed = this.completedRequests.get(conversationKey) || [];
    return completed.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /**
   * Analyze request ordering and detect potential race conditions
   */
  analyzeRequestOrdering(sessionId: string, conversationId: string): {
    isSequential: boolean;
    sequenceGaps: number[];
    overlappingRequests: number;
    raceConditionLikelihood: number;
  } {
    const completed = this.getCompletedRequests(sessionId, conversationId);
    
    if (completed.length < 2) {
      return {
        isSequential: true,
        sequenceGaps: [],
        overlappingRequests: 0,
        raceConditionLikelihood: 0
      };
    }
    
    // Check for sequence gaps
    const sequenceGaps: number[] = [];
    for (let i = 1; i < completed.length; i++) {
      const expectedSequence = completed[i - 1].sequenceNumber + 1;
      if (completed[i].sequenceNumber !== expectedSequence) {
        sequenceGaps.push(completed[i].sequenceNumber - expectedSequence);
      }
    }
    
    // Check for overlapping processing times
    let overlappingRequests = 0;
    for (let i = 0; i < completed.length - 1; i++) {
      const current = completed[i];
      const next = completed[i + 1];
      
      if (current.endTime && next.startTime && next.startTime < current.endTime) {
        overlappingRequests++;
      }
    }
    
    // Calculate race condition likelihood
    const sequenceAccuracy = 1 - (sequenceGaps.length / completed.length);
    const overlapRatio = overlappingRequests / Math.max(1, completed.length - 1);
    const raceConditionLikelihood = Math.max(0, 1 - sequenceAccuracy) + overlapRatio;
    
    return {
      isSequential: sequenceAccuracy > 0.9 && overlapRatio < 0.1,
      sequenceGaps,
      overlappingRequests,
      raceConditionLikelihood: Math.min(1, raceConditionLikelihood)
    };
  }

  /**
   * Get overall system statistics
   */
  getSystemStats(): {
    totalConversations: number;
    totalActiveRequests: number;
    totalCompletedRequests: number;
    averageSequenceAccuracy: number;
    averageFinishReasonCoverage: number;
    totalRaceConditions: number;
  } {
    const allStats = Array.from(this.conversationStats.values());
    
    if (allStats.length === 0) {
      return {
        totalConversations: 0,
        totalActiveRequests: this.activeRequests.size,
        totalCompletedRequests: 0,
        averageSequenceAccuracy: 0,
        averageFinishReasonCoverage: 0,
        totalRaceConditions: 0
      };
    }
    
    const totalCompleted = allStats.reduce((sum, stats) => sum + stats.completedRequests, 0);
    const avgSequenceAccuracy = allStats.reduce((sum, stats) => sum + stats.sequenceAccuracy, 0) / allStats.length;
    const avgFinishReasonCoverage = allStats.reduce((sum, stats) => sum + stats.finishReasonCoverage, 0) / allStats.length;
    const totalRaceConditions = allStats.reduce((sum, stats) => sum + stats.raceConditionsDetected, 0);
    
    return {
      totalConversations: allStats.length,
      totalActiveRequests: this.activeRequests.size,
      totalCompletedRequests: totalCompleted,
      averageSequenceAccuracy: Math.round(avgSequenceAccuracy * 100) / 100,
      averageFinishReasonCoverage: Math.round(avgFinishReasonCoverage * 100) / 100,
      totalRaceConditions
    };
  }

  /**
   * Update conversation statistics
   */
  private updateConversationStats(conversationKey: string): void {
    const completed = this.completedRequests.get(conversationKey) || [];
    
    if (completed.length === 0) {
      return;
    }
    
    const totalRequests = completed.length;
    const completedRequests = completed.filter(req => req.status === 'completed').length;
    const failedRequests = completed.filter(req => req.status === 'failed').length;
    
    // Calculate average processing time
    const processingTimes = completed
      .filter(req => req.endTime)
      .map(req => req.endTime! - req.startTime);
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;
    
    // Calculate sequence accuracy
    const sortedBySequence = completed.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    let correctSequences = 0;
    for (let i = 0; i < sortedBySequence.length; i++) {
      if (sortedBySequence[i].sequenceNumber === i + 1) {
        correctSequences++;
      }
    }
    const sequenceAccuracy = correctSequences / totalRequests;
    
    // Calculate finish reason coverage
    const withFinishReason = completed.filter(req => 
      req.finishReason && req.finishReason !== 'unknown' && req.finishReason !== 'null'
    ).length;
    const finishReasonCoverage = withFinishReason / totalRequests;
    
    // Detect race conditions
    const orderingAnalysis = this.analyzeRequestOrdering(
      completed[0].sessionId,
      completed[0].conversationId
    );
    const raceConditionsDetected = orderingAnalysis.raceConditionLikelihood > 0.5 ? 1 : 0;
    
    const stats: SequenceStats = {
      totalRequests,
      completedRequests,
      failedRequests,
      averageProcessingTime: Math.round(averageProcessingTime),
      sequenceAccuracy: Math.round(sequenceAccuracy * 100) / 100,
      finishReasonCoverage: Math.round(finishReasonCoverage * 100) / 100,
      raceConditionsDetected
    };
    
    this.conversationStats.set(conversationKey, stats);
  }

  /**
   * Detect race conditions in a conversation
   */
  private detectRaceConditions(conversationKey: string): void {
    const completed = this.completedRequests.get(conversationKey) || [];
    
    if (completed.length < 2) {
      return;
    }
    
    const analysis = this.analyzeRequestOrdering(
      completed[0].sessionId,
      completed[0].conversationId
    );
    
    if (analysis.raceConditionLikelihood > 0.5) {
      logger.warn('Potential race condition detected', {
        conversationKey,
        sequenceGaps: analysis.sequenceGaps,
        overlappingRequests: analysis.overlappingRequests,
        raceConditionLikelihood: analysis.raceConditionLikelihood,
        isSequential: analysis.isSequential
      }, 'race-condition-detection');
      
      this.emit('raceConditionDetected', {
        conversationKey,
        analysis,
        completedRequests: completed.length
      });
    }
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    let cleanedConversations = 0;
    
    // Clean up old completed requests
    for (const [conversationKey, requests] of this.completedRequests.entries()) {
      const oldestRequest = requests[0];
      if (oldestRequest && (now - oldestRequest.timestamp.getTime()) > maxAge) {
        this.completedRequests.delete(conversationKey);
        this.conversationStats.delete(conversationKey);
        this.sequenceCounters.delete(conversationKey);
        cleanedConversations++;
      }
    }
    
    // Clean up old active requests (should not happen in normal operation)
    for (const [requestId, request] of this.activeRequests.entries()) {
      if ((now - request.timestamp.getTime()) > maxAge) {
        this.activeRequests.delete(requestId);
        logger.warn('Cleaned up stale active request', {
          requestId,
          age: now - request.timestamp.getTime()
        }, requestId, 'sequence-manager');
      }
    }
    
    if (cleanedConversations > 0) {
      logger.info('Cleaned up old conversation data', {
        cleanedConversations,
        remainingConversations: this.completedRequests.size,
        remainingActiveRequests: this.activeRequests.size
      }, 'sequence-manager');
    }
  }
}

// Global sequence manager instances per port
const sequenceManagers: Map<number, RequestSequenceManager> = new Map();

/**
 * Get or create request sequence manager for a specific port
 */
export function getRequestSequenceManager(port: number): RequestSequenceManager {
  if (!sequenceManagers.has(port)) {
    sequenceManagers.set(port, new RequestSequenceManager(port));
  }
  return sequenceManagers.get(port)!;
}