/**
 * 配置通知管理器实现
 * 
 * 提供配置更新通知、监听器管理和批量通知功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  IConfigNotificationManager,
  ConfigUpdateCallback,
  ConfigUpdateEvent
} from '../interfaces/core/config-hot-reload-interface';

/**
 * 监听器信息
 */
interface ListenerInfo {
  serviceId: string;
  callback: ConfigUpdateCallback;
  isActive: boolean;
  registeredAt: Date;
  lastNotification?: Date;
  notificationCount: number;
  errorCount: number;
  lastError?: string;
}

/**
 * 通知结果
 */
interface NotificationResult {
  serviceId: string;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * 批量通知选项
 */
interface BatchNotificationOptions {
  timeout: number;
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * 配置通知管理器实现
 */
export class ConfigNotificationManager extends EventEmitter implements IConfigNotificationManager {
  private listeners = new Map<string, ListenerInfo>();
  private notificationQueue: Array<{ serviceId: string; event: ConfigUpdateEvent }> = [];
  private isProcessingQueue = false;
  private notificationStats = {
    totalSent: 0,
    totalFailed: 0,
    totalListeners: 0,
    lastNotificationTime: null as Date | null
  };
  
  private defaultBatchOptions: BatchNotificationOptions = {
    timeout: 5000,
    maxConcurrency: 10,
    retryAttempts: 3,
    retryDelay: 1000
  };

  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ConfigNotificationManager error:', error);
    });
  }

  /**
   * 注册配置更新监听器
   */
  registerUpdateListener(serviceId: string, callback: ConfigUpdateCallback): void {
    if (this.listeners.has(serviceId)) {
      console.warn(`Listener for service ${serviceId} already exists. Replacing...`);
    }

    const listenerInfo: ListenerInfo = {
      serviceId,
      callback,
      isActive: true,
      registeredAt: new Date(),
      notificationCount: 0,
      errorCount: 0
    };

    this.listeners.set(serviceId, listenerInfo);
    this.notificationStats.totalListeners = this.listeners.size;

    this.emit('listener-registered', {
      serviceId,
      timestamp: new Date()
    });

    console.log(`Registered config update listener for service: ${serviceId}`);
  }

  /**
   * 注销配置更新监听器
   */
  unregisterUpdateListener(serviceId: string): void {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      console.warn(`No listener found for service: ${serviceId}`);
      return;
    }

    this.listeners.delete(serviceId);
    this.notificationStats.totalListeners = this.listeners.size;

    this.emit('listener-unregistered', {
      serviceId,
      notificationCount: listener.notificationCount,
      errorCount: listener.errorCount,
      timestamp: new Date()
    });

    console.log(`Unregistered config update listener for service: ${serviceId}`);
  }

  /**
   * 通知所有监听器
   */
  async notifyAll(event: ConfigUpdateEvent): Promise<void> {
    const activeListeners = Array.from(this.listeners.values())
      .filter(listener => listener.isActive);

    if (activeListeners.length === 0) {
      console.log('No active listeners to notify');
      return;
    }

    console.log(`Notifying ${activeListeners.length} listeners about config update:`, event.id);

    const notificationPromises = activeListeners.map(listener =>
      this.notifyListener(listener, event)
    );

    try {
      const results = await Promise.allSettled(notificationPromises);
      
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const listener = activeListeners[i];

        if (result.status === 'fulfilled') {
          successCount++;
          this.updateListenerStats(listener.serviceId, true);
        } else {
          failureCount++;
          this.updateListenerStats(listener.serviceId, false, result.reason?.message);
          console.error(`Failed to notify ${listener.serviceId}:`, result.reason);
        }
      }

      this.notificationStats.totalSent += successCount;
      this.notificationStats.totalFailed += failureCount;
      this.notificationStats.lastNotificationTime = new Date();

      this.emit('bulk-notification-completed', {
        event: event.id,
        successCount,
        failureCount,
        totalListeners: activeListeners.length
      });

      console.log(`Notification completed: ${successCount} success, ${failureCount} failures`);

    } catch (error) {
      console.error('Error during bulk notification:', error);
      this.emit('error', error);
    }
  }

  /**
   * 通知特定服务
   */
  async notifyService(serviceId: string, event: ConfigUpdateEvent): Promise<void> {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      throw new Error(`No listener registered for service: ${serviceId}`);
    }

    if (!listener.isActive) {
      throw new Error(`Listener for service ${serviceId} is not active`);
    }

    try {
      await this.notifyListener(listener, event);
      this.updateListenerStats(serviceId, true);
      
      this.emit('service-notification-completed', {
        serviceId,
        eventId: event.id,
        success: true
      });

      console.log(`Successfully notified service ${serviceId} about config update: ${event.id}`);

    } catch (error) {
      this.updateListenerStats(serviceId, false, error instanceof Error ? error.message : 'Unknown error');
      
      this.emit('service-notification-completed', {
        serviceId,
        eventId: event.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error(`Failed to notify service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * 获取监听器状态
   */
  getListenerStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const [serviceId, listener] of this.listeners) {
      status[serviceId] = listener.isActive;
    }

    return status;
  }

  /**
   * 批量通知
   */
  async notifyBatch(events: ConfigUpdateEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    console.log(`Processing batch notification for ${events.length} events`);

    for (const event of events) {
      await this.notifyAll(event);
      
      // 小延迟避免过载
      if (events.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.emit('batch-notification-completed', {
      eventCount: events.length,
      timestamp: new Date()
    });

    console.log(`Batch notification completed for ${events.length} events`);
  }

  /**
   * 启用/禁用监听器
   */
  setListenerActive(serviceId: string, active: boolean): void {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      throw new Error(`No listener found for service: ${serviceId}`);
    }

    listener.isActive = active;

    this.emit('listener-status-changed', {
      serviceId,
      isActive: active,
      timestamp: new Date()
    });

    console.log(`Listener for ${serviceId} is now ${active ? 'active' : 'inactive'}`);
  }

  /**
   * 获取监听器详细信息
   */
  getListenerInfo(serviceId: string): ListenerInfo | null {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      return null;
    }

    // 返回副本避免外部修改
    return {
      ...listener,
      callback: () => {} as any // 不暴露回调函数
    };
  }

  /**
   * 获取所有监听器信息
   */
  getAllListenerInfo(): Array<Omit<ListenerInfo, 'callback'>> {
    return Array.from(this.listeners.values()).map(listener => ({
      serviceId: listener.serviceId,
      isActive: listener.isActive,
      registeredAt: listener.registeredAt,
      lastNotification: listener.lastNotification,
      notificationCount: listener.notificationCount,
      errorCount: listener.errorCount,
      lastError: listener.lastError
    }));
  }

  /**
   * 获取通知统计信息
   */
  getNotificationStats(): typeof this.notificationStats & {
    activeListeners: number;
    inactiveListeners: number;
    averageNotificationsPerListener: number;
  } {
    const activeListeners = Array.from(this.listeners.values())
      .filter(l => l.isActive).length;
    
    const totalNotifications = Array.from(this.listeners.values())
      .reduce((sum, l) => sum + l.notificationCount, 0);
    
    const averageNotificationsPerListener = this.listeners.size > 0 
      ? Math.round(totalNotifications / this.listeners.size * 100) / 100
      : 0;

    return {
      ...this.notificationStats,
      activeListeners,
      inactiveListeners: this.listeners.size - activeListeners,
      averageNotificationsPerListener
    };
  }

  /**
   * 清理监听器
   */
  clearAllListeners(): void {
    const count = this.listeners.size;
    this.listeners.clear();
    this.notificationStats.totalListeners = 0;

    this.emit('all-listeners-cleared', {
      clearedCount: count,
      timestamp: new Date()
    });

    console.log(`Cleared ${count} listeners`);
  }

  /**
   * 测试监听器连接
   */
  async testListener(serviceId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      throw new Error(`No listener found for service: ${serviceId}`);
    }

    const testEvent: ConfigUpdateEvent = {
      id: `test_${Date.now()}`,
      timestamp: new Date(),
      type: 'update',
      path: 'test',
      source: 'test-connection',
      version: 'test',
      metadata: {
        test: true
      }
    };

    const startTime = Date.now();
    
    try {
      await this.notifyListener(listener, testEvent);
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 销毁通知管理器
   */
  destroy(): void {
    this.clearAllListeners();
    this.notificationQueue = [];
    this.removeAllListeners();
  }

  // ============ 私有方法 ============

  /**
   * 通知单个监听器
   */
  private async notifyListener(listener: ListenerInfo, event: ConfigUpdateEvent): Promise<void> {
    const timeout = 5000; // 5秒超时
    
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Notification timeout for service ${listener.serviceId}`));
      }, timeout);

      try {
        const result = listener.callback(event);
        
        if (result instanceof Promise) {
          result
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        } else {
          clearTimeout(timeoutId);
          resolve();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 更新监听器统计信息
   */
  private updateListenerStats(serviceId: string, success: boolean, error?: string): void {
    const listener = this.listeners.get(serviceId);
    if (!listener) {
      return;
    }

    listener.notificationCount++;
    listener.lastNotification = new Date();

    if (success) {
      // 成功时清除错误信息
      if (listener.lastError) {
        listener.lastError = undefined;
      }
    } else {
      listener.errorCount++;
      listener.lastError = error;
    }
  }

  /**
   * 生成通知ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}