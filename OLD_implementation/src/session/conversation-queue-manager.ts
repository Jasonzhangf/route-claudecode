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
  // 🔧 紧急修复：超时管理
  private readonly REQUEST_TIMEOUT = 60000; // 60秒请求超时
  private readonly QUEUE_WAIT_TIMEOUT = 30000; // 30秒队列等待超时
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(private port: number) {
    super();
    
    // Cleanup expired conversations every 5 minutes
    setInterval(() => this.cleanupExpiredConversations(), 5 * 60 * 1000);
    
    logger.info('ConversationQueueManager initialized', {
      port: this.port,
      anthropicCompliant: true,
      sequentialProcessing: true
    }, 'conversation-queue');
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
      }, requestId, 'conversation-queue');

      // Try to process immediately if no request is currently processing
      this.processNextInQueue(conversationKey).catch(error => {
        logger.error('Error processing next in queue', { conversationKey, error }, 'conversation-queue');
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
      }, requestId, 'conversation-queue');
      return;
    }

    const conversationKey = `${processingRequest.sessionId}:${processingRequest.conversationId}`;
    const startTime = this.requestStartTimes.get(requestId);
    const processingTime = startTime ? Date.now() - startTime.getTime() : 0;

    // Remove from processing
    this.processingRequests.delete(requestId);
    this.requestStartTimes.delete(requestId);
    
    // 🔧 紧急修复：清理请求超时
    const timeout = this.requestTimeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.requestTimeouts.delete(requestId);
    }
    
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
    }, requestId, 'conversation-queue');

    // Emit completion event
    this.emit('requestCompleted', {
      requestId,
      conversationKey,
      finishReason,
      processingTime
    });

    // Process next request in the same conversation
    this.processNextInQueue(conversationKey).catch(error => {
      logger.error('Error processing next in queue after completion', { conversationKey, error }, 'conversation-queue');
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
      }, requestId, 'conversation-queue');
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
    }, requestId, 'conversation-queue');

    // Emit failure event
    this.emit('requestFailed', {
      requestId,
      conversationKey,
      error,
      processingTime
    });

    // Process next request in the same conversation
    this.processNextInQueue(conversationKey).catch(error => {
      logger.error('Error processing next in queue after failure', { conversationKey, error }, 'conversation-queue');
    });
  }

  /**
   * Check if a request is currently being processed
   */
  isRequestProcessing(requestId: string): boolean {
    return this.processingRequests.has(requestId);
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
   * Get detailed queue status for a specific conversation
   */
  getConversationQueueStatus(sessionId: string, conversationId: string): {
    queueLength: number;
    isProcessing: boolean;
    currentSequence: number;
    completedRequests: number;
  } {
    const conversationKey = `${sessionId}:${conversationId}`;
    const queue = this.conversationQueues.get(conversationKey) || [];
    const isProcessing = Array.from(this.processingRequests.values())
      .some(req => req.sessionId === sessionId && req.conversationId === conversationId);
    const currentSequence = this.sequenceCounters.get(conversationKey) || 0;
    const completedRequests = this.completedRequests.get(conversationKey) || 0;

    return {
      queueLength: queue.length,
      isProcessing,
      currentSequence,
      completedRequests
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
      logger.debug('Conversation already processing, setting timeout', {
        conversationKey,
        queueLength: queue.length,
        timeout: this.QUEUE_WAIT_TIMEOUT
      }, 'conversation-queue');
      
      // 🔧 紧急修复：设置等待超时
      setTimeout(() => {
        logger.warn('Queue wait timeout, forcing cleanup', {
          conversationKey,
          timeout: this.QUEUE_WAIT_TIMEOUT
        }, 'conversation-queue');
        
        // 强制清理卡住的请求
        this.forceCleanupStuckRequests(conversationKey);
        
        // 重新尝试处理
        this.processNextInQueue(conversationKey).catch(error => {
          logger.error('Error in timeout retry', { conversationKey, error }, 'conversation-queue');
        });
      }, this.QUEUE_WAIT_TIMEOUT);
      
      return;
    }

    // Get next request from queue
    const nextRequest = queue.shift()!;
    this.processingRequests.set(nextRequest.requestId, nextRequest);
    this.requestStartTimes.set(nextRequest.requestId, new Date());
    
    // 🔧 紧急修复：设置请求超时
    const requestTimeout = setTimeout(() => {
      logger.warn('Request timeout, forcing completion', {
        requestId: nextRequest.requestId,
        timeout: this.REQUEST_TIMEOUT
      }, nextRequest.requestId, 'conversation-queue');
      
      this.failRequest(nextRequest.requestId, new Error('Request timeout'));
    }, this.REQUEST_TIMEOUT);
    
    this.requestTimeouts.set(nextRequest.requestId, requestTimeout);

    logger.info('Starting sequential request processing', {
      requestId: nextRequest.requestId,
      sessionId: nextRequest.sessionId,
      conversationId: nextRequest.conversationId,
      sequenceNumber: nextRequest.sequenceNumber,
      remainingInQueue: queue.length,
      isStreaming: nextRequest.isStreaming
    }, nextRequest.requestId, 'conversation-queue');

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
  
  /**
   * 等待对话完成（带超时机制）
   */
  private async waitForCompletion(conversationKey: string, requestId: string): Promise<void> {
    const maxWaitTime = 60000; // 60秒超时
    const checkInterval = 100; // 100ms检查间隔
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        // 检查是否还在处理中
        const isStillProcessing = Array.from(this.processingRequests.values())
          .some(req => `${req.sessionId}:${req.conversationId}` === conversationKey);
        
        if (!isStillProcessing) {
          logger.debug('Conversation completion detected', {
            conversationKey,
            requestId,
            waitTime: Date.now() - startTime
          }, requestId, 'conversation-queue');
          resolve();
          return;
        }
        
        // 检查超时
        if (Date.now() - startTime > maxWaitTime) {
          logger.warn('Conversation wait timeout, forcing completion', {
            conversationKey,
            requestId,
            waitTime: Date.now() - startTime
          }, requestId, 'conversation-queue');
          
          // 强制清理处理中的请求
          for (const [procRequestId, procRequest] of this.processingRequests.entries()) {
            if (`${procRequest.sessionId}:${procRequest.conversationId}` === conversationKey) {
              this.processingRequests.delete(procRequestId);
              this.requestStartTimes.delete(procRequestId);
            }
          }
          
          resolve();
          return;
        }
        
        // 继续等待
        setTimeout(checkCompletion, checkInterval);
      };
      
      checkCompletion();
    });
  }

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
      }, 'conversation-queue');
    }
  }

  /**
   * 🔧 紧急修复：强制清理卡住的请求
   */
  private forceCleanupStuckRequests(conversationKey: string): void {
    logger.warn('Force cleaning stuck requests', { conversationKey }, 'conversation-queue');
    
    const stuckRequests = [];
    for (const [requestId, request] of this.processingRequests.entries()) {
      if (`${request.sessionId}:${request.conversationId}` === conversationKey) {
        const startTime = this.requestStartTimes.get(requestId);
        const processingTime = startTime ? Date.now() - startTime.getTime() : 0;
        
        if (processingTime > this.REQUEST_TIMEOUT) {
          stuckRequests.push({ requestId, processingTime });
          this.processingRequests.delete(requestId);
          this.requestStartTimes.delete(requestId);
          
          // 清理请求超时
          const timeout = this.requestTimeouts.get(requestId);
          if (timeout) {
            clearTimeout(timeout);
            this.requestTimeouts.delete(requestId);
          }
        }
      }
    }
    
    if (stuckRequests.length > 0) {
      logger.warn('Cleaned stuck requests', {
        conversationKey,
        stuckRequests: stuckRequests.length,
        details: stuckRequests
      }, 'conversation-queue');
      
      this.emit('stuckRequestsCleaned', {
        conversationKey,
        stuckRequests
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