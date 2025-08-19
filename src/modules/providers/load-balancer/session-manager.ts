/**
 * 会话管理器
 *
 * 管理粘性会话和会话生命周期
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { LoadBalancerConfig } from './types';

/**
 * 会话信息
 */
export interface SessionInfo {
  sessionId: string;
  providerId: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * 会话管理器
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionInfo> = new Map();
  private config: LoadBalancerConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
  }

  /**
   * 启动会话管理器
   */
  start(): void {
    if (!this.config.stickySessions || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startCleanup();
    this.emit('started');
  }

  /**
   * 停止会话管理器
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.emit('stopped');
  }

  /**
   * 获取粘性Provider
   */
  getStickyProvider(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // 检查会话是否过期
    const now = Date.now();
    if (now - session.lastAccessedAt > this.config.sessionTtl) {
      this.removeSession(sessionId);
      return null;
    }

    // 更新访问时间
    session.lastAccessedAt = now;
    session.accessCount++;

    return session.providerId;
  }

  /**
   * 设置会话Provider映射
   */
  setSessionProvider(sessionId: string, providerId: string): void {
    if (!this.config.stickySessions) {
      return;
    }

    const now = Date.now();
    const existingSession = this.sessions.get(sessionId);

    if (existingSession) {
      // 更新现有会话
      existingSession.providerId = providerId;
      existingSession.lastAccessedAt = now;
      existingSession.accessCount++;
    } else {
      // 创建新会话
      const session: SessionInfo = {
        sessionId,
        providerId,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 1,
      };
      this.sessions.set(sessionId, session);
      this.emit('sessionCreated', session);
    }
  }

  /**
   * 移除会话
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    this.emit('sessionRemoved', session);
    return true;
  }

  /**
   * 移除Provider的所有会话
   */
  removeProviderSessions(providerId: string): number {
    let removedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.providerId === providerId) {
        this.sessions.delete(sessionId);
        this.emit('sessionRemoved', session);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取Provider的会话数量
   */
  getProviderSessionCount(providerId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.providerId === providerId) {
        count++;
      }
    }
    return count;
  }

  /**
   * 获取会话统计信息
   */
  getSessionStatistics(): SessionStatistics {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    // 按Provider分组
    const providerCounts = new Map<string, number>();
    let expiredCount = 0;

    for (const session of sessions) {
      // 检查过期
      if (now - session.lastAccessedAt > this.config.sessionTtl) {
        expiredCount++;
        continue;
      }

      const count = providerCounts.get(session.providerId) || 0;
      providerCounts.set(session.providerId, count + 1);
    }

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.length - expiredCount,
      expiredSessions: expiredCount,
      providerDistribution: Object.fromEntries(providerCounts),
      avgSessionAge: this.calculateAverageSessionAge(sessions),
      oldestSession: this.findOldestSession(sessions),
    };
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt > this.config.sessionTtl) {
        this.sessions.delete(sessionId);
        this.emit('sessionExpired', session);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.emit('sessionsCleanedUp', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    // 每分钟清理一次过期会话
    const cleanupInterval = Math.min(this.config.sessionTtl / 10, 60000); // 最多1分钟

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, cleanupInterval);
  }

  /**
   * 计算平均会话年龄
   */
  private calculateAverageSessionAge(sessions: SessionInfo[]): number {
    if (sessions.length === 0) {
      return 0;
    }

    const now = Date.now();
    const totalAge = sessions.reduce((sum, session) => sum + (now - session.createdAt), 0);
    return totalAge / sessions.length;
  }

  /**
   * 找到最老的会话
   */
  private findOldestSession(sessions: SessionInfo[]): SessionInfo | null {
    if (sessions.length === 0) {
      return null;
    }

    return sessions.reduce((oldest, current) => (current.createdAt < oldest.createdAt ? current : oldest));
  }

  /**
   * 清理所有会话
   */
  cleanup(): void {
    this.stop();
    this.sessions.clear();
    this.emit('allSessionsCleared');
  }

  /**
   * 是否正在运行
   */
  isSessionManagerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * 会话统计信息
 */
export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  providerDistribution: Record<string, number>;
  avgSessionAge: number; // 毫秒
  oldestSession: SessionInfo | null;
}
