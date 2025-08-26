/**
 * 长文本请求心跳管理器
 * 
 * 功能：
 * - 为长文本请求提供30秒间隔的心跳保持连接
 * - 防止长时间请求的socket超时
 * - 提供请求状态监控和超时管理
 * 
 * @author RCC v4.0 Performance Enhancement
 */

import { secureLogger } from '../../utils/secure-logger';
import { getRoutingThresholds } from '../../config/routing-thresholds';

export interface HeartbeatSession {
  sessionId: string;
  startTime: Date;
  lastHeartbeat: Date;
  requestSize: number;
  isActive: boolean;
  timeoutHandle?: NodeJS.Timeout;
  heartbeatHandle?: NodeJS.Timeout;
}

export class HeartbeatManager {
  private static instance: HeartbeatManager;
  private sessions = new Map<string, HeartbeatSession>();
  private readonly thresholds = getRoutingThresholds();

  private constructor() {}

  public static getInstance(): HeartbeatManager {
    if (!HeartbeatManager.instance) {
      HeartbeatManager.instance = new HeartbeatManager();
    }
    return HeartbeatManager.instance;
  }

  /**
   * 为长文本请求启动心跳会话
   */
  public startHeartbeatSession(
    sessionId: string, 
    requestSize: number,
    onHeartbeat?: () => void
  ): HeartbeatSession {
    // 检查是否需要心跳（基于请求大小）
    const needsHeartbeat = requestSize > 10 * 1024; // 10KB阈值
    
    if (!needsHeartbeat) {
      secureLogger.debug('请求大小不需要心跳机制', { sessionId, requestSize });
      return null;
    }

    const session: HeartbeatSession = {
      sessionId,
      startTime: new Date(),
      lastHeartbeat: new Date(),
      requestSize,
      isActive: true,
    };

    // 设置心跳定时器 - 30秒间隔
    session.heartbeatHandle = setInterval(() => {
      this.sendHeartbeat(sessionId, onHeartbeat);
    }, this.thresholds.performance.heartbeatIntervalMs);

    // 设置总体超时 - 10分钟
    session.timeoutHandle = setTimeout(() => {
      this.timeoutSession(sessionId);
    }, this.thresholds.performance.longRequestTimeoutMs);

    this.sessions.set(sessionId, session);
    
    secureLogger.info('心跳会话已启动', {
      sessionId,
      requestSize,
      heartbeatInterval: this.thresholds.performance.heartbeatIntervalMs,
      totalTimeout: this.thresholds.performance.longRequestTimeoutMs
    });

    return session;
  }

  /**
   * 发送心跳信号
   */
  private sendHeartbeat(sessionId: string, onHeartbeat?: () => void): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    session.lastHeartbeat = new Date();
    
    try {
      // 执行心跳回调
      if (onHeartbeat) {
        onHeartbeat();
      }

      secureLogger.debug('心跳信号已发送', {
        sessionId,
        lastHeartbeat: session.lastHeartbeat,
        duration: Date.now() - session.startTime.getTime()
      });
    } catch (error) {
      secureLogger.error('心跳回调执行失败', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * 会话超时处理
   */
  private timeoutSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    secureLogger.warn('心跳会话超时', {
      sessionId,
      duration: Date.now() - session.startTime.getTime(),
      requestSize: session.requestSize
    });

    this.stopHeartbeatSession(sessionId);
  }

  /**
   * 停止心跳会话
   */
  public stopHeartbeatSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.isActive = false;

    // 清理定时器
    if (session.heartbeatHandle) {
      clearInterval(session.heartbeatHandle);
    }
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    const duration = Date.now() - session.startTime.getTime();
    
    secureLogger.info('心跳会话已停止', {
      sessionId,
      duration,
      requestSize: session.requestSize,
      totalHeartbeats: Math.floor(duration / this.thresholds.performance.heartbeatIntervalMs)
    });

    this.sessions.delete(sessionId);
  }

  /**
   * 更新会话活动状态
   */
  public updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      session.lastHeartbeat = new Date();
    }
  }

  /**
   * 获取活动会话统计
   */
  public getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession?: Date;
  } {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    const oldestSession = activeSessions.length > 0 
      ? new Date(Math.min(...activeSessions.map(s => s.startTime.getTime())))
      : undefined;

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      oldestSession
    };
  }

  /**
   * 清理所有会话
   */
  public cleanup(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stopHeartbeatSession(sessionId);
    }
    
    secureLogger.info('心跳管理器已清理所有会话');
  }
}