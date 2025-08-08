/**
 * Conversation Queue Manager for OpenAI Provider
 * Implements Anthropic-compliant concurrency control for same-session requests
 * 
 * Key Requirements:
 * 1. Same session + same conversationID requests must be processed sequentially
 * 2. RequestID must have clear numeric ordering within conversation
 * 3. Input blocks until previous request completes (finish reason received)
 * 4. All finish reasons must be correctly returned (no silent failures)
 */

import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface ConversationRequest {
  requestId: string;
  sessionId: string;
  conversationId: string;
  sequenceNumber: number;
  timestamp: Date;
  isStreaming: boolean;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

export interface ConversationQueueStats {
  totalQueues: number;
  totalPendingRequests: number;
  averageWaitTime: number;
  longestQueue: number;
  completedRequests: number;
}

/**
 * Manages sequential processing of requests within the same conversation
 * Ensures Anthropic-compliant ordering and finish reason handling
 */
export class ConversationQueueManager extends EventEmitter {
  private conversationQueues: Map<string, ConversationRequest[]> = new Map();
  private processingRequests: Map<string, ConversationRequest> = new Map();
  private sequenceCounters: Map<string, number> = new Map();
  private completedRequests: Map<string, number> = new Map();
  private requestStartTimes: Map<string, Date> = new Map();
  
  constructor(private port: number) {
    super();
    
    // Cleanup expired conversations every 5 minutes
    setInterval(() => this.cleanupExpiredConversations(), 5 * 60 * 1000);
    
    logger.info('ConversationQueueManager initialized', {
      port: this.port,
      anthropicCompliant: true,
      sequentialProcessing: true
    });
  }

  /**
   * Enqueue a request for sequential processing within its conversation
   * Returns a promise that resolves when the request can be processed
   */
  async enqueueRequest(
    sessionId: string,
    conversationId: string,
    isStreaming: boolean = false
  ): Promise<{ requestId: string; sequenceNumber: number }> {
    const conversationKey = `${sessionId}:${conversationId}`;
    
    // Generate sequential requestId with numeric ordering
    const sequenceNumber = this.getNextSequenceNumber(conversationKey);
    const requestId = `${conversationKey}:seq${sequenceNumber.toString().padStart(4, '0')}:${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const request: ConversationRequest = {
        requestId,
        sessionId,
        conversationId,
        sequenceNumber,
        timestamp: new Date(),
        isStreaming,
        resolve,
        reject
      };

      // Add to conversation queue
      if (!this.conversationQueues.has(conversationKey)) {
        this.conversationQueues.set(conversationKey, []);
      }
      
      const queue = this.conversationQueues.get(conversationKey)!;
      queue.push(request);
      
      logger.debug('Request enqueued for sequential processing', {
        requestId,
        sessionId,
        conversationId,
        sequenceNumber,
        queuePosition: queue.length,
        isStreaming,
        conversationKey
      });

      // Try to process immediately if no request is currently processing
      this.processNextInQueue(conversationKey).catch(error => {
        logger.error('Error processing next in queue', { conversationKey, error });
      });
    });
  }

  /**
   * Mark a request as completed and process next in queue
   * Must be called when finish reason is received
   */
  completeRequest(requestId: string, finishReason?: string): void {
    const processingRequest = this.processingRequests.get(requestId);
    if (!processingRequest) {
      logger.warn('Attempted to complete non-processing request', {
        requestId,
        finishReason
      });
      return;
    }

    const conversationKey = `${processingRequest.sessionId}:${processingRequest.conversationId}`;
    const startTime = this.requestStartTimes.get(requestId);
    const processingTime = startTime ? Date.now() - startTime.getTime() : 0;

    // Remove from processing
    this.processingRequests.delete(requestId);
    this.requestStartTimes.delete(requestId);
    
    // Update completion stats
    const completed = this.completedRequests.get(conversationKey) || 0;
    this.completedRequests.set(conversationKey, completed + 1);

    logger.info('Request completed, processing next in queue', {
      requestId,
      sessionId: processingRequest.sessionId,
      conversationId: processingRequest.conversationId,
      sequenceNumber: processingRequest.sequenceNumber,
      finishReason,
      processingTimeMs: processingTime,
      completedInConversation: completed + 1
    });

    // Emit completion event
    this.emit('requestCompleted', {
      requestId,
      conversationKey,
      finishReason,
      processingTime
    });

    // Process next request in the same conversation
    this.processNextInQueue(conversationKey).catch(error => {
      logger.error('Error processing next in queue after completion', { conversationKey, error });
    });
  }

  /**
   * Handle request failure and process next in queue
   */
  failRequest(requestId: string, error: any): void {
    const processingRequest = this.processingRequests.get(requestId);
    if (!processingRequest) {
      logger.warn('Attempted to fail non-processing request', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    const conversationKey = `${processingRequest.sessionId}:${processingRequest.conversationId}`;
    const startTime = this.requestStartTimes.get(requestId);
    const processingTime = startTime ? Date.now() - startTime.getTime() : 0;

    // Remove from processing
    this.processingRequests.delete(requestId);
    this.requestStartTimes.delete(requestId);

    logger.error('Request failed, processing next in queue', {
      requestId,
      sessionId: processingRequest.sessionId,
      conversationId: processingRequest.conversationId,
      sequenceNumber: processingRequest.sequenceNumber,
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime
    });

    // Emit failure event
    this.emit('requestFailed', {
      requestId,
      conversationKey,
      error,
      processingTime
    });

    // Process next request in the same conversation
    this.processNextInQueue(conversationKey).catch(error => {
      logger.error('Error processing next in queue after failure', { conversationKey, error });
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): ConversationQueueStats {
    let totalPendingRequests = 0;
    let longestQueue = 0;
    let totalWaitTime = 0;
    let waitingRequests = 0;
    let totalCompleted = 0;

    const now = new Date();

    for (const queue of this.conversationQueues.values()) {
      totalPendingRequests += queue.length;
      longestQueue = Math.max(longestQueue, queue.length);
      
      // Calculate wait times for pending requests
      for (const request of queue) {
        const waitTime = now.getTime() - request.timestamp.getTime();
        totalWaitTime += waitTime;
        waitingRequests++;
      }
    }

    for (const completed of this.completedRequests.values()) {
      totalCompleted += completed;
    }

    return {
      totalQueues: this.conversationQueues.size,
      totalPendingRequests,
      averageWaitTime: waitingRequests > 0 ? Math.round(totalWaitTime / waitingRequests) : 0,
      longestQueue,
      completedRequests: totalCompleted
    };
  }

  /**
   * Process the next request in a conversation queue
   */
  private async processNextInQueue(conversationKey: string): Promise<void> {
    const queue = this.conversationQueues.get(conversationKey);
    if (!queue || queue.length === 0) {
      return;
    }

    // Check if already processing a request for this conversation
    const isAlreadyProcessing = Array.from(this.processingRequests.values())
      .some(req => `${req.sessionId}:${req.conversationId}` === conversationKey);

    if (isAlreadyProcessing) {
      return;
    }

    // Get next request from queue
    const nextRequest = queue.shift()!;
    this.processingRequests.set(nextRequest.requestId, nextRequest);
    this.requestStartTimes.set(nextRequest.requestId, new Date());

    logger.info('Starting sequential request processing', {
      requestId: nextRequest.requestId,
      sessionId: nextRequest.sessionId,
      conversationId: nextRequest.conversationId,
      sequenceNumber: nextRequest.sequenceNumber,
      remainingInQueue: queue.length,
      isStreaming: nextRequest.isStreaming
    });

    // Resolve the promise to allow request processing
    nextRequest.resolve({
      requestId: nextRequest.requestId,
      sequenceNumber: nextRequest.sequenceNumber
    });

    // Emit processing start event
    this.emit('requestStarted', {
      requestId: nextRequest.requestId,
      conversationKey,
      sequenceNumber: nextRequest.sequenceNumber
    });
  }

  /**
   * Get next sequence number for a conversation
   */
  private getNextSequenceNumber(conversationKey: string): number {
    const current = this.sequenceCounters.get(conversationKey) || 0;
    const next = current + 1;
    this.sequenceCounters.set(conversationKey, next);
    return next;
  }

  /**
   * Clean up expired conversations and their queues
   */
  private cleanupExpiredConversations(): void {
    const now = new Date();
    const expiredThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const expiredConversations: string[] = [];

    // Find expired conversations
    for (const [conversationKey, queue] of this.conversationQueues.entries()) {
      if (queue.length === 0) {
        // Check if any recent activity
        const hasRecentProcessing = Array.from(this.processingRequests.values())
          .some(req => `${req.sessionId}:${req.conversationId}` === conversationKey);
        
        if (!hasRecentProcessing) {
          expiredConversations.push(conversationKey);
        }
      } else {
        // Check if oldest request is too old
        const oldestRequest = queue[0];
        const age = now.getTime() - oldestRequest.timestamp.getTime();
        if (age > expiredThreshold) {
          expiredConversations.push(conversationKey);
        }
      }
    }

    // Clean up expired conversations
    for (const conversationKey of expiredConversations) {
      const queue = this.conversationQueues.get(conversationKey);
      if (queue) {
        // Reject all pending requests
        for (const request of queue) {
          request.reject(new Error('Conversation expired'));
        }
      }

      this.conversationQueues.delete(conversationKey);
      this.sequenceCounters.delete(conversationKey);
      this.completedRequests.delete(conversationKey);
    }

    if (expiredConversations.length > 0) {
      logger.info('Cleaned up expired conversations', {
        expiredCount: expiredConversations.length,
        remainingQueues: this.conversationQueues.size
      });
    }
  }
}

// Global conversation queue manager instances per port
const queueManagers: Map<number, ConversationQueueManager> = new Map();

/**
 * Get or create conversation queue manager for a specific port
 */
export function getConversationQueueManager(port: number): ConversationQueueManager {
  if (!queueManagers.has(port)) {
    queueManagers.set(port, new ConversationQueueManager(port));
  }
  return queueManagers.get(port)!;
}