/**
 * Session Manager for Multi-Turn Conversation Support
 * Manages conversation state and context across multiple requests
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';

export interface ConversationSession {
  sessionId: string;
  conversationId: string;
  providerConversationIds: Record<string, string>;
  messageHistory: ConversationMessage[];
  tools?: any[];  // 持久化工具定义
  system?: any[];  // 持久化系统消息
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | any[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private readonly maxSessions = 1000;
  private readonly sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours

  constructor() {
    // Cleanup expired sessions every 10 minutes
    setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
  }

  /**
   * Extract session ID from request headers or generate new one
   */
  extractSessionId(headers: Record<string, string>): string {
    // Look for session ID in various headers
    const sessionId = headers['x-conversation-id'] || 
                     headers['x-session-id'] ||
                     headers['claude-conversation-id'];
    
    if (sessionId) {
      logger.debug('Found existing session ID', { sessionId });
      return sessionId;
    }

    // Generate new session ID
    const newSessionId = this.generateSessionId();
    logger.debug('Generated new session ID', { sessionId: newSessionId });
    return newSessionId;
  }

  /**
   * Get or create conversation session
   */
  getOrCreateSession(sessionId: string): ConversationSession {
    const existing = this.sessions.get(sessionId);
    
    if (existing) {
      existing.lastAccessedAt = new Date();
      logger.debug('Retrieved existing session', { 
        sessionId, 
        messageCount: existing.messageHistory.length 
      });
      return existing;
    }

    // Create new session
    const newSession: ConversationSession = {
      sessionId,
      conversationId: this.generateConversationId(),
      providerConversationIds: {},
      messageHistory: [],
      metadata: {},
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };

    this.sessions.set(sessionId, newSession);
    logger.debug('Created new session', { sessionId, conversationId: newSession.conversationId });
    
    return newSession;
  }

  /**
   * Update session with new message
   */
  addMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to add message to non-existent session', { sessionId });
      return;
    }

    session.messageHistory.push(message);
    session.lastAccessedAt = new Date();
    
    logger.debug('Added message to session', { 
      sessionId, 
      role: message.role,
      messageCount: session.messageHistory.length 
    });
  }

  /**
   * Get provider-specific conversation ID
   */
  getProviderConversationId(sessionId: string, providerName: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found for provider conversation ID', { sessionId, providerName });
      return this.generateConversationId();
    }

    if (!session.providerConversationIds[providerName]) {
      session.providerConversationIds[providerName] = this.generateConversationId();
      logger.debug('Generated provider conversation ID', { 
        sessionId, 
        providerName, 
        conversationId: session.providerConversationIds[providerName] 
      });
    }

    return session.providerConversationIds[providerName];
  }

  /**
   * Get conversation history for provider
   */
  getConversationHistory(sessionId: string, maxMessages?: number): ConversationMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.debug('No session found for history', { sessionId });
      return [];
    }

    const history = session.messageHistory;
    
    if (maxMessages && history.length > maxMessages) {
      // Keep recent messages within limit
      return history.slice(-maxMessages);
    }

    return [...history]; // Return copy to prevent modification
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(sessionId: string, metadata: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update metadata for non-existent session', { sessionId });
      return;
    }

    session.metadata = { ...session.metadata, ...metadata };
    session.lastAccessedAt = new Date();
    
    logger.debug('Updated session metadata', { sessionId, metadata });
  }

  /**
   * Update session tools
   */
  updateSessionTools(sessionId: string, tools: any[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update tools for non-existent session', { sessionId });
      return;
    }

    session.tools = tools;
    session.lastAccessedAt = new Date();
    
    logger.debug('Updated session tools', { sessionId, toolCount: tools.length });
  }

  /**
   * Update session system messages
   */
  updateSessionSystem(sessionId: string, system: any[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update system for non-existent session', { sessionId });
      return;
    }

    session.system = system;
    session.lastAccessedAt = new Date();
    
    logger.debug('Updated session system', { sessionId, systemCount: system.length });
  }

  /**
   * Get session tools
   */
  getSessionTools(sessionId: string): any[] {
    const session = this.sessions.get(sessionId);
    return session?.tools || [];
  }

  /**
   * Get session system messages
   */
  getSessionSystem(sessionId: string): any[] {
    const session = this.sessions.get(sessionId);
    return session?.system || [];
  }

  /**
   * Clear specific session
   */
  clearSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug('Cleared session', { sessionId });
    }
    return deleted;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): { totalSessions: number; activeInLastHour: number } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let activeInLastHour = 0;
    for (const session of this.sessions.values()) {
      if (session.lastAccessedAt > oneHourAgo) {
        activeInLastHour++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeInLastHour
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastAccessedAt.getTime();
      if (age > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    // Remove expired sessions
    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.debug('Cleaned up expired sessions', { 
        expiredCount: expiredSessions.length,
        remainingCount: this.sessions.size 
      });
    }

    // Enforce maximum session limit
    if (this.sessions.size > this.maxSessions) {
      const sessionsToRemove = this.sessions.size - this.maxSessions;
      const sortedSessions = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime());
      
      for (let i = 0; i < sessionsToRemove; i++) {
        this.sessions.delete(sortedSessions[i][0]);
      }

      logger.debug('Enforced session limit', { 
        removedCount: sessionsToRemove,
        currentCount: this.sessions.size 
      });
    }
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();