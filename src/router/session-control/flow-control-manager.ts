import {
  SessionInfo,
  SessionManager,
  ConversationQueue,
  RequestProcessor,
  FlowControlConfig,
  FlowControlMetrics,
  SessionCleanupResult,
  RCCRequest,
  RCCResponse,
  ProcessingStatus,
  RequestPriority,
  SessionMetrics,
} from './types';
import { ErrorHandler } from '../../middleware/error-handler';
import { ConversationQueueImpl } from './conversation-queue';
import { RequestProcessorImpl } from './request-processor';

export class FlowControlManager {
  private sessions: Map<string, SessionManager>;
  private config: FlowControlConfig;
  private metrics: FlowControlMetrics;
  private cleanupTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: FlowControlConfig) {
    this.sessions = new Map();
    this.config = config;
    this.metrics = this.initializeMetrics();

    // 启动定期清理
    this.startCleanupTimer();
  }

  async manageRequest(request: RCCRequest): Promise<RCCResponse> {
    if (this.isShuttingDown) {
      throw new Error('FlowControlManager is shutting down');
    }

    try {
      // 1. 提取会话信息
      const sessionInfo = this.extractSessionInfo(request);

      // 2. 验证和限制检查
      await this.validateRequest(sessionInfo);

      // 3. 获取或创建会话管理器
      const session = await this.getOrCreateSession(sessionInfo.sessionId);

      // 4. 获取或创建对话队列
      const conversation = await this.getOrCreateConversation(session, sessionInfo.conversationId);

      // 5. 创建请求处理器
      const processor = new RequestProcessorImpl({
        requestId: sessionInfo.requestId,
        sessionId: sessionInfo.sessionId,
        conversationId: sessionInfo.conversationId,
        request: request,
        priority: sessionInfo.priority,
      });

      // 6. 添加到队列并处理
      await conversation.enqueue(processor);

      // 7. 等待处理完成
      const response = await this.waitForCompletion(processor);

      // 8. 更新指标
      this.updateMetrics(processor);

      return response;
    } catch (error) {
      console.error('Flow control error:', error);

      // 通过标准错误处理器处理，不使用mockup
      ErrorHandler.handle(error, {
        module: 'flow-control',
        operation: 'manageRequest',
        context: { requestId: request.id },
      });

      throw error;
    }
  }

  private extractSessionInfo(request: RCCRequest): SessionInfo {
    // 从请求头中提取会话信息
    const headers = request.headers || {};

    const sessionId = headers['x-session-id'] || headers['X-Session-ID'] || this.generateSessionId(request);

    const conversationId = headers['x-conversation-id'] || headers['X-Conversation-ID'] || 'default';

    const requestId = headers['x-request-id'] || headers['X-Request-ID'] || this.generateRequestId();

    const priority = this.determinePriority(request, headers);

    return {
      sessionId,
      conversationId,
      requestId,
      timestamp: new Date(),
      priority,
      clientInfo: {
        userAgent: headers['user-agent'],
        ipAddress: this.extractClientIP(request),
        clientId: headers['x-client-id'],
      },
    };
  }

  private async validateRequest(sessionInfo: SessionInfo): Promise<void> {
    // 检查会话数量限制
    if (this.sessions.size >= this.config.maxSessionsPerClient) {
      throw new Error(`Maximum sessions exceeded: ${this.config.maxSessionsPerClient}`);
    }

    // 检查现有会话的对话数量
    const existingSession = this.sessions.get(sessionInfo.sessionId);
    if (existingSession && existingSession.conversations.size >= this.config.maxConversationsPerSession) {
      throw new Error(`Maximum conversations per session exceeded: ${this.config.maxConversationsPerSession}`);
    }

    // 检查对话中的请求数量
    if (existingSession) {
      const conversation = existingSession.conversations.get(sessionInfo.conversationId);
      if (conversation && conversation.getQueueLength() >= this.config.maxRequestsPerConversation) {
        throw new Error(`Maximum requests per conversation exceeded: ${this.config.maxRequestsPerConversation}`);
      }
    }
  }

  private async getOrCreateSession(sessionId: string): Promise<SessionManager> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = new SessionManagerImpl(sessionId, this.config);
      this.sessions.set(sessionId, session);
      this.metrics.totalSessions++;
      console.log(`Created new session: ${sessionId}`);
    }

    // 更新最后活动时间
    session.lastActivity = new Date();

    return session;
  }

  private async getOrCreateConversation(session: SessionManager, conversationId: string): Promise<ConversationQueue> {
    let conversation = session.getConversation(conversationId);

    if (!conversation) {
      conversation = session.createConversation(conversationId);
      this.metrics.totalConversations++;
      console.log(`Created new conversation: ${session.sessionId}/${conversationId}`);
    }

    return conversation;
  }

  private async waitForCompletion(processor: RequestProcessor): Promise<RCCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.config.requestTimeout}ms`));
      }, this.config.requestTimeout);

      // 监听处理完成
      const checkCompletion = setInterval(() => {
        const status = processor.status;

        if (status === 'completed' && processor.response) {
          clearTimeout(timeout);
          clearInterval(checkCompletion);
          resolve(processor.response);
        } else if (status === 'failed' || status === 'aborted') {
          clearTimeout(timeout);
          clearInterval(checkCompletion);
          reject(processor.error || new Error(`Request ${status}`));
        }
      }, 100);
    });
  }

  private updateMetrics(processor: RequestProcessor): void {
    this.metrics.totalRequests++;

    const metrics = processor.getMetrics();
    if (metrics.processingTime) {
      // 更新平均处理时间
      const currentAvg = this.metrics.averageProcessingTime;
      const totalRequests = this.metrics.totalRequests;
      this.metrics.averageProcessingTime = (currentAvg * (totalRequests - 1) + metrics.processingTime) / totalRequests;
    }

    if (metrics.queueWaitTime) {
      // 更新平均队列等待时间
      const currentAvg = this.metrics.averageQueueTime;
      const totalRequests = this.metrics.totalRequests;
      this.metrics.averageQueueTime = (currentAvg * (totalRequests - 1) + metrics.queueWaitTime) / totalRequests;
    }

    if (processor.status === 'failed') {
      this.updateErrorRate();
    }

    this.updateThroughput();
  }

  private updateErrorRate(): void {
    // 计算错误率
    const errorCount = Array.from(this.sessions.values())
      .flatMap(session => Array.from(session.conversations.values()))
      .flatMap(conversation => conversation.requests)
      .filter(request => request.status === 'failed').length;

    this.metrics.errorRate = this.metrics.totalRequests > 0 ? errorCount / this.metrics.totalRequests : 0;
  }

  private updateThroughput(): void {
    // 简单的吞吐量计算（每秒请求数）
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    const recentRequests = Array.from(this.sessions.values())
      .flatMap(session => Array.from(session.conversations.values()))
      .flatMap(conversation => conversation.requests)
      .filter(request => request.completedAt && request.completedAt.getTime() > oneSecondAgo).length;

    this.metrics.throughput = recentRequests;
  }

  private determinePriority(request: RCCRequest, headers: Record<string, string>): RequestPriority {
    // 根据请求内容和头部信息确定优先级
    const priorityHeader = headers['x-priority'] || headers['X-Priority'];
    if (priorityHeader) {
      const priority = priorityHeader.toLowerCase();
      if (['high', 'medium', 'low'].includes(priority)) {
        return priority as RequestPriority;
      }
    }

    // 根据请求类型判断优先级
    if (request.url?.includes('/stream') || headers['accept']?.includes('text/event-stream')) {
      return 'high'; // 流式请求高优先级
    }

    if (request.body && JSON.stringify(request.body).length > 10000) {
      return 'low'; // 大请求低优先级
    }

    return 'medium'; // 默认中等优先级
  }

  private generateSessionId(request: RCCRequest): string {
    // 基于客户端信息生成会话ID
    const clientInfo = [
      request.headers?.['user-agent'] || 'unknown',
      this.extractClientIP(request) || 'unknown',
      request.headers?.['x-client-id'] || '',
    ].join('|');

    const hash = require('crypto').createHash('md5').update(clientInfo).digest('hex');
    return `session_${hash.substring(0, 12)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private extractClientIP(request: RCCRequest): string | undefined {
    return request.headers?.['x-forwarded-for'] || request.headers?.['x-real-ip'] || request.headers?.['remote-addr'];
  }

  private initializeMetrics(): FlowControlMetrics {
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalConversations: 0,
      activeConversations: 0,
      totalRequests: 0,
      requestsInQueue: 0,
      averageProcessingTime: 0,
      averageQueueTime: 0,
      errorRate: 0,
      throughput: 0,
    };
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, this.config.cleanupInterval);
  }

  private async performCleanup(): Promise<SessionCleanupResult> {
    const now = Date.now();
    let sessionsRemoved = 0;
    let conversationsRemoved = 0;
    let requestsRemoved = 0;

    console.log(`Starting cleanup... Current sessions: ${this.sessions.size}`);

    for (const [sessionId, session] of this.sessions.entries()) {
      // 清理超时的会话
      if (now - session.lastActivity.getTime() > this.config.sessionTimeout) {
        await session.cleanup();
        this.sessions.delete(sessionId);
        sessionsRemoved++;
        conversationsRemoved += session.conversations.size;
        continue;
      }

      // 清理会话中超时的对话
      for (const [conversationId, conversation] of session.conversations.entries()) {
        if (now - conversation.lastActivity.getTime() > this.config.conversationTimeout) {
          requestsRemoved += conversation.getQueueLength();
          session.removeConversation(conversationId);
          conversationsRemoved++;
        }
      }
    }

    // 更新活跃指标
    this.updateActiveMetrics();

    const result = {
      sessionsRemoved,
      conversationsRemoved,
      requestsRemoved,
      memoryFreed: 0, // 实际应用中可以计算内存释放量
    };

    if (sessionsRemoved > 0 || conversationsRemoved > 0) {
      console.log(`Cleanup completed:`, result);
    }

    return result;
  }

  private updateActiveMetrics(): void {
    this.metrics.activeSessions = this.sessions.size;
    this.metrics.activeConversations = Array.from(this.sessions.values()).reduce(
      (total, session) => total + session.conversations.size,
      0
    );
    this.metrics.requestsInQueue = Array.from(this.sessions.values())
      .flatMap(session => Array.from(session.conversations.values()))
      .reduce((total, conversation) => total + conversation.getQueueLength(), 0);
  }

  async getMetrics(): Promise<FlowControlMetrics> {
    this.updateActiveMetrics();
    return { ...this.metrics };
  }

  async getSessionStatus(sessionId: string): Promise<SessionMetrics | null> {
    const session = this.sessions.get(sessionId);
    return session ? session.getMetrics() : null;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down FlowControlManager...');
    this.isShuttingDown = true;

    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 清理所有会话
    const cleanupPromises = Array.from(this.sessions.values()).map(session => session.cleanup());
    await Promise.all(cleanupPromises);

    this.sessions.clear();
    console.log('FlowControlManager shutdown completed');
  }
}

// SessionManager实现
class SessionManagerImpl implements SessionManager {
  public readonly sessionId: string;
  public readonly conversations: Map<string, ConversationQueue>;
  public readonly createdAt: Date;
  public lastActivity: Date;
  public totalRequests: number;
  private config: FlowControlConfig;

  constructor(sessionId: string, config: FlowControlConfig) {
    this.sessionId = sessionId;
    this.conversations = new Map();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.totalRequests = 0;
    this.config = config;
  }

  createConversation(conversationId: string): ConversationQueue {
    const conversation = new ConversationQueueImpl(conversationId, this.sessionId, this.config);
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  getConversation(conversationId: string): ConversationQueue | null {
    return this.conversations.get(conversationId) || null;
  }

  removeConversation(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.clear();
      this.conversations.delete(conversationId);
      return true;
    }
    return false;
  }

  async cleanup(): Promise<void> {
    console.log(`Cleaning up session: ${this.sessionId}`);

    // 清理所有对话
    for (const conversation of this.conversations.values()) {
      conversation.clear();
    }

    this.conversations.clear();
  }

  getMetrics(): SessionMetrics {
    const uptime = Date.now() - this.createdAt.getTime();
    const totalRequests = Array.from(this.conversations.values()).reduce(
      (total, conversation) => total + conversation.requests.length,
      0
    );

    const completedRequests = Array.from(this.conversations.values())
      .flatMap(conversation => conversation.requests)
      .filter(request => request.status === 'completed');

    const totalProcessingTime = completedRequests.reduce((total, request) => {
      const metrics = request.getMetrics();
      return total + (metrics.processingTime || 0);
    }, 0);

    const averageProcessingTime = completedRequests.length > 0 ? totalProcessingTime / completedRequests.length : 0;

    const errorCount = Array.from(this.conversations.values())
      .flatMap(conversation => conversation.requests)
      .filter(request => request.status === 'failed').length;

    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    return {
      sessionId: this.sessionId,
      totalConversations: this.conversations.size,
      totalRequests,
      averageProcessingTime,
      errorRate,
      activeConversations: Array.from(this.conversations.values()).filter(
        conv => conv.isProcessing || conv.getQueueLength() > 0
      ).length,
      uptime,
    };
  }
}
