/**
 * Provider告警管理器
 * 
 * 监控Provider指标并触发告警，支持多种告警渠道和规则配置
 * 
 * @author Jason Zhang
 */

/**
 * 告警级别枚举
 */
export type AlertLevel = 
  | 'info'     // 信息
  | 'warning'  // 警告
  | 'error'    // 错误
  | 'critical'; // 严重

/**
 * 告警状态枚举
 */
export type AlertStatus = 
  | 'active'    // 激活
  | 'resolved'  // 已解决
  | 'silenced'; // 静默

/**
 * 告警规则定义
 */
export interface AlertRule {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 监控指标 */
  metric: string;
  /** 条件表达式 */
  condition: {
    /** 操作符 */
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    /** 阈值 */
    threshold: number;
    /** 持续时间(毫秒) */
    duration: number;
  };
  /** 告警级别 */
  level: AlertLevel;
  /** 标签过滤 */
  labels?: Record<string, string>;
  /** 是否启用 */
  enabled: boolean;
  /** 静默时间(毫秒) */
  silenceWindow?: number;
}

/**
 * 告警事件
 */
export interface Alert {
  /** 告警ID */
  id: string;
  /** 规则ID */
  ruleId: string;
  /** 告警级别 */
  level: AlertLevel;
  /** 告警状态 */
  status: AlertStatus;
  /** 告警标题 */
  title: string;
  /** 告警描述 */
  description: string;
  /** 指标值 */
  value: number;
  /** 阈值 */
  threshold: number;
  /** 标签 */
  labels: Record<string, string>;
  /** 触发时间 */
  triggeredAt: number;
  /** 解决时间 */
  resolvedAt?: number;
  /** 静默到期时间 */
  silencedUntil?: number;
}

/**
 * 告警通知渠道接口
 */
export interface AlertChannel {
  /** 渠道类型 */
  type: 'console' | 'webhook' | 'email' | 'slack';
  /** 渠道名称 */
  name: string;
  /** 发送通知 */
  send(alert: Alert): Promise<void>;
}

/**
 * 控制台告警通道
 */
export class ConsoleAlertChannel implements AlertChannel {
  public readonly type = 'console';
  public readonly name = 'Console';

  public async send(alert: Alert): Promise<void> {
    const levelColors = {
      info: '\x1b[34m',     // 蓝色
      warning: '\x1b[33m',  // 黄色
      error: '\x1b[31m',    // 红色
      critical: '\x1b[35m'  // 紫色
    };
    
    const reset = '\x1b[0m';
    const color = levelColors[alert.level];
    
    console.log(`${color}[ALERT-${alert.level.toUpperCase()}]${reset} ${alert.title}`);
    console.log(`  Description: ${alert.description}`);
    console.log(`  Value: ${alert.value} (threshold: ${alert.threshold})`);
    console.log(`  Labels: ${JSON.stringify(alert.labels)}`);
    console.log(`  Triggered: ${new Date(alert.triggeredAt).toISOString()}`);
    
    if (alert.resolvedAt) {
      console.log(`  Resolved: ${new Date(alert.resolvedAt).toISOString()}`);
    }
  }
}

/**
 * Webhook告警通道
 */
export class WebhookAlertChannel implements AlertChannel {
  public readonly type = 'webhook';
  public readonly name: string;
  private webhookUrl: string;

  constructor(name: string, webhookUrl: string) {
    this.name = name;
    this.webhookUrl = webhookUrl;
  }

  public async send(alert: Alert): Promise<void> {
    try {
      const payload = {
        alert,
        timestamp: Date.now()
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[WebhookAlertChannel] Failed to send alert to ${this.webhookUrl}:`, error);
      throw error;
    }
  }
}

/**
 * 告警管理器
 */
export class AlertManager {
  private rules: Map<string, AlertRule>;
  private alerts: Map<string, Alert>;
  private channels: AlertChannel[];
  private activeConditions: Map<string, { count: number; firstSeen: number }>;
  private checkInterval: NodeJS.Timeout | null;
  private metricsCallback: () => Map<string, any>;

  constructor(metricsCallback: () => Map<string, any>) {
    this.rules = new Map();
    this.alerts = new Map();
    this.channels = [];
    this.activeConditions = new Map();
    this.checkInterval = null;
    this.metricsCallback = metricsCallback;

    // 注册默认控制台通道
    this.addChannel(new ConsoleAlertChannel());

    // 注册默认告警规则
    this.registerDefaultRules();
  }

  /**
   * 添加告警规则
   */
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 移除告警规则
   */
  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    
    // 清理相关的活跃条件
    this.activeConditions.delete(ruleId);
    
    // 解决相关的告警
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.ruleId === ruleId && alert.status === 'active') {
        this.resolveAlert(alertId);
      }
    }
  }

  /**
   * 获取所有规则
   */
  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 添加通知渠道
   */
  public addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * 移除通知渠道
   */
  public removeChannel(channelName: string): void {
    this.channels = this.channels.filter(channel => channel.name !== channelName);
  }

  /**
   * 获取所有通知渠道
   */
  public getChannels(): AlertChannel[] {
    return [...this.channels];
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active');
  }

  /**
   * 获取所有告警
   */
  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * 获取告警历史
   */
  public getAlertHistory(limit: number = 100): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);
  }

  /**
   * 静默告警
   */
  public silenceAlert(alertId: string, duration: number): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'silenced';
      alert.silencedUntil = Date.now() + duration;
    }
  }

  /**
   * 解决告警
   */
  public resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      
      // 通知所有渠道
      this.notifyChannels(alert);
    }
  }

  /**
   * 启动告警监控
   */
  public start(checkIntervalMs: number = 30000): void {
    if (this.checkInterval) {
      this.stop();
    }

    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, checkIntervalMs);

    console.log(`[AlertManager] Started with ${this.rules.size} rules and ${this.channels.length} channels`);
  }

  /**
   * 停止告警监控
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(): void {
    const now = Date.now();
    
    // 清理过期的静默告警
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'silenced' && alert.silencedUntil && now > alert.silencedUntil) {
        alert.status = 'resolved';
        alert.resolvedAt = now;
      }
    }

    // 检查每个规则
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      try {
        this.evaluateRule(rule);
      } catch (error) {
        console.error(`[AlertManager] Error evaluating rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * 评估规则
   */
  private evaluateRule(rule: AlertRule): void {
    const metrics = this.metricsCallback();
    const metricData = metrics.get(rule.metric);
    
    if (!metricData || !metricData.dataPoints || metricData.dataPoints.length === 0) {
      return;
    }

    // 获取最新的数据点
    const latestPoints = metricData.dataPoints
      .filter((point: any) => {
        if (rule.labels) {
          return Object.entries(rule.labels).every(([key, value]) => 
            point.labels[key] === value
          );
        }
        return true;
      })
      .sort((a: any, b: any) => b.timestamp - a.timestamp);

    if (latestPoints.length === 0) {
      return;
    }

    const latestPoint = latestPoints[0];
    const conditionMet = this.evaluateCondition(rule.condition, latestPoint.value);

    if (conditionMet) {
      this.handleConditionMet(rule, latestPoint);
    } else {
      this.handleConditionNotMet(rule);
    }
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: AlertRule['condition'], value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * 处理条件满足
   */
  private handleConditionMet(rule: AlertRule, dataPoint: any): void {
    const now = Date.now();
    const conditionKey = `${rule.id}_${JSON.stringify(dataPoint.labels)}`;
    
    if (!this.activeConditions.has(conditionKey)) {
      this.activeConditions.set(conditionKey, {
        count: 1,
        firstSeen: now
      });
      return;
    }

    const condition = this.activeConditions.get(conditionKey)!;
    const duration = now - condition.firstSeen;

    if (duration >= rule.condition.duration) {
      // 条件持续满足，触发告警
      this.triggerAlert(rule, dataPoint);
      this.activeConditions.delete(conditionKey);
    }
  }

  /**
   * 处理条件不满足
   */
  private handleConditionNotMet(rule: AlertRule): void {
    // 清理活跃条件
    const keysToDelete = Array.from(this.activeConditions.keys())
      .filter(key => key.startsWith(`${rule.id}_`));
    
    keysToDelete.forEach(key => this.activeConditions.delete(key));

    // 解决相关的活跃告警
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.ruleId === rule.id && alert.status === 'active') {
        this.resolveAlert(alertId);
      }
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(rule: AlertRule, dataPoint: any): void {
    const alertId = `${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 检查静默窗口
    if (rule.silenceWindow) {
      const recentAlert = Array.from(this.alerts.values())
        .filter(alert => alert.ruleId === rule.id)
        .sort((a, b) => b.triggeredAt - a.triggeredAt)[0];
      
      if (recentAlert && (Date.now() - recentAlert.triggeredAt) < rule.silenceWindow) {
        return; // 在静默窗口内，不触发告警
      }
    }

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      level: rule.level,
      status: 'active',
      title: `Alert: ${rule.name}`,
      description: `${rule.description}. Current value: ${dataPoint.value}, threshold: ${rule.condition.threshold}`,
      value: dataPoint.value,
      threshold: rule.condition.threshold,
      labels: dataPoint.labels,
      triggeredAt: Date.now()
    };

    this.alerts.set(alertId, alert);
    
    // 通知所有渠道
    this.notifyChannels(alert);
  }

  /**
   * 通知所有渠道
   */
  private async notifyChannels(alert: Alert): Promise<void> {
    const notifications = this.channels.map(async (channel) => {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`[AlertManager] Failed to send alert via ${channel.name}:`, error);
      }
    });

    await Promise.allSettled(notifications);
  }

  /**
   * 注册默认告警规则
   */
  private registerDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'provider_high_error_rate',
        name: 'Provider High Error Rate',
        description: 'Provider error rate is too high',
        metric: 'provider_health_error_rate',
        condition: {
          operator: '>',
          threshold: 0.1, // 10%
          duration: 60000 // 1分钟
        },
        level: 'warning',
        enabled: true,
        silenceWindow: 300000 // 5分钟静默
      },
      {
        id: 'provider_unhealthy',
        name: 'Provider Unhealthy',
        description: 'Provider is in unhealthy state',
        metric: 'provider_health_status',
        condition: {
          operator: '==',
          threshold: 0, // unhealthy
          duration: 30000 // 30秒
        },
        level: 'error',
        enabled: true,
        silenceWindow: 180000 // 3分钟静默
      },
      {
        id: 'provider_slow_response',
        name: 'Provider Slow Response',
        description: 'Provider response time is too slow',
        metric: 'provider_health_response_time',
        condition: {
          operator: '>',
          threshold: 5000, // 5秒
          duration: 120000 // 2分钟
        },
        level: 'warning',
        enabled: true
      },
      {
        id: 'system_high_cpu',
        name: 'System High CPU Usage',
        description: 'System CPU usage is too high',
        metric: 'system_cpu_usage',
        condition: {
          operator: '>',
          threshold: 80, // 80%
          duration: 180000 // 3分钟
        },
        level: 'warning',
        enabled: true
      },
      {
        id: 'system_high_memory',
        name: 'System High Memory Usage',
        description: 'System memory usage is too high',
        metric: 'system_memory_usage',
        condition: {
          operator: '>',
          threshold: 90, // 90%
          duration: 120000 // 2分钟
        },
        level: 'error',
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }
}