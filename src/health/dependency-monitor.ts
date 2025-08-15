/**
 * 服务依赖监控器实现
 * 
 * 管理和监控系统中各个服务的依赖关系
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  IDependencyMonitor,
  ServiceDependency,
  HealthCheckResult,
  HealthStatus,
  ServiceType,
  CheckType,
  HealthCheckConfig
} from '../interfaces/core/health-interface';
import { IHealthChecker } from '../interfaces/core/health-interface';

/**
 * 依赖关系图
 */
interface DependencyGraph {
  nodes: Map<string, ServiceDependency>;
  edges: Map<string, string[]>; // serviceId -> dependentServiceIds
  reverseEdges: Map<string, string[]>; // serviceId -> dependencyServiceIds
}

/**
 * 依赖检查任务
 */
interface DependencyCheckTask {
  readonly serviceId: string;
  readonly dependency: ServiceDependency;
  readonly interval: number;
  readonly timeout: NodeJS.Timeout;
  lastCheck?: Date;
  lastResult?: HealthCheckResult;
}

/**
 * 依赖监控统计
 */
interface DependencyMonitorStats {
  totalDependencies: number;
  criticalDependencies: number;
  healthyDependencies: number;
  degradedDependencies: number;
  unhealthyDependencies: number;
  lastUpdateTime: Date;
  checksPerMinute: number;
}

/**
 * 服务依赖监控器实现类
 */
export class DependencyMonitor extends EventEmitter implements IDependencyMonitor {
  private dependencyGraph: DependencyGraph;
  private checkTasks: Map<string, DependencyCheckTask> = new Map();
  private healthChecker: IHealthChecker;
  private stats: DependencyMonitorStats;
  private checkCounter: number = 0;
  private isMonitoring: boolean = false;

  constructor(healthChecker: IHealthChecker) {
    super();
    this.healthChecker = healthChecker;
    
    // 初始化依赖图
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };

    // 初始化统计信息
    this.stats = {
      totalDependencies: 0,
      criticalDependencies: 0,
      healthyDependencies: 0,
      degradedDependencies: 0,
      unhealthyDependencies: 0,
      lastUpdateTime: new Date(),
      checksPerMinute: 0
    };

    this.startStatsUpdater();
  }

  /**
   * 注册服务依赖
   */
  async registerDependency(dependency: ServiceDependency): Promise<void> {
    // 添加到依赖图
    this.dependencyGraph.nodes.set(dependency.id, dependency);
    
    if (!this.dependencyGraph.edges.has(dependency.id)) {
      this.dependencyGraph.edges.set(dependency.id, []);
    }
    
    if (!this.dependencyGraph.reverseEdges.has(dependency.id)) {
      this.dependencyGraph.reverseEdges.set(dependency.id, []);
    }

    // 为每个健康检查配置创建监控任务
    for (const healthCheck of dependency.healthChecks) {
      await this.createCheckTask(dependency, healthCheck);
    }

    this.updateStats();
    this.emit('dependency-registered', dependency);
    
    console.log(`📊 Registered dependency: ${dependency.name} (${dependency.id})`);
  }

  /**
   * 移除服务依赖
   */
  async removeDependency(dependencyId: string): Promise<void> {
    const dependency = this.dependencyGraph.nodes.get(dependencyId);
    if (!dependency) {
      return;
    }

    // 停止相关的检查任务
    const tasksToRemove: string[] = [];
    this.checkTasks.forEach((task, taskId) => {
      if (task.serviceId === dependencyId) {
        clearTimeout(task.timeout);
        tasksToRemove.push(taskId);
      }
    });

    tasksToRemove.forEach(taskId => {
      this.checkTasks.delete(taskId);
    });

    // 从依赖图中移除
    this.dependencyGraph.nodes.delete(dependencyId);
    this.dependencyGraph.edges.delete(dependencyId);
    this.dependencyGraph.reverseEdges.delete(dependencyId);

    // 移除所有指向该服务的边
    this.dependencyGraph.edges.forEach((dependents, serviceId) => {
      const index = dependents.indexOf(dependencyId);
      if (index > -1) {
        dependents.splice(index, 1);
      }
    });

    this.dependencyGraph.reverseEdges.forEach((dependencies, serviceId) => {
      const index = dependencies.indexOf(dependencyId);
      if (index > -1) {
        dependencies.splice(index, 1);
      }
    });

    this.updateStats();
    this.emit('dependency-removed', dependencyId);
    
    console.log(`📊 Removed dependency: ${dependencyId}`);
  }

  /**
   * 获取所有依赖状态
   */
  async getAllDependencyStatus(): Promise<Record<string, HealthCheckResult>> {
    const statusMap: Record<string, HealthCheckResult> = {};

    for (const [dependencyId, dependency] of this.dependencyGraph.nodes) {
      // 获取最新的健康检查结果
      const latestResult = await this.getLatestHealthResult(dependency);
      if (latestResult) {
        statusMap[dependencyId] = latestResult;
      }
    }

    return statusMap;
  }

  /**
   * 获取关键依赖状态
   */
  async getCriticalDependencyStatus(): Promise<Record<string, HealthCheckResult>> {
    const statusMap: Record<string, HealthCheckResult> = {};

    for (const [dependencyId, dependency] of this.dependencyGraph.nodes) {
      if (dependency.critical) {
        const latestResult = await this.getLatestHealthResult(dependency);
        if (latestResult) {
          statusMap[dependencyId] = latestResult;
        }
      }
    }

    return statusMap;
  }

  /**
   * 检查依赖链健康状态
   */
  async checkDependencyChain(serviceId: string): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const visited = new Set<string>();
    const queue = [serviceId];

    while (queue.length > 0) {
      const currentServiceId = queue.shift()!;
      
      if (visited.has(currentServiceId)) {
        continue;
      }
      visited.add(currentServiceId);

      const dependency = this.dependencyGraph.nodes.get(currentServiceId);
      if (!dependency) {
        continue;
      }

      // 检查当前服务
      const healthResult = await this.getLatestHealthResult(dependency);
      if (healthResult) {
        results.push(healthResult);
      }

      // 添加依赖服务到队列
      const dependencies = this.dependencyGraph.reverseEdges.get(currentServiceId) || [];
      dependencies.forEach(depId => {
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      });
    }

    return results;
  }

  /**
   * 添加服务依赖关系
   */
  async addDependencyRelation(serviceId: string, dependsOnId: string): Promise<void> {
    // 检查是否会创建循环依赖
    if (this.wouldCreateCycle(serviceId, dependsOnId)) {
      throw new Error(`Adding dependency from ${serviceId} to ${dependsOnId} would create a cycle`);
    }

    // 添加边
    const dependencies = this.dependencyGraph.reverseEdges.get(serviceId) || [];
    if (!dependencies.includes(dependsOnId)) {
      dependencies.push(dependsOnId);
      this.dependencyGraph.reverseEdges.set(serviceId, dependencies);
    }

    const dependents = this.dependencyGraph.edges.get(dependsOnId) || [];
    if (!dependents.includes(serviceId)) {
      dependents.push(serviceId);
      this.dependencyGraph.edges.set(dependsOnId, dependents);
    }

    this.emit('dependency-relation-added', serviceId, dependsOnId);
  }

  /**
   * 移除服务依赖关系
   */
  async removeDependencyRelation(serviceId: string, dependsOnId: string): Promise<void> {
    // 移除边
    const dependencies = this.dependencyGraph.reverseEdges.get(serviceId) || [];
    const depIndex = dependencies.indexOf(dependsOnId);
    if (depIndex > -1) {
      dependencies.splice(depIndex, 1);
    }

    const dependents = this.dependencyGraph.edges.get(dependsOnId) || [];
    const depedentIndex = dependents.indexOf(serviceId);
    if (depedentIndex > -1) {
      dependents.splice(depedentIndex, 1);
    }

    this.emit('dependency-relation-removed', serviceId, dependsOnId);
  }

  /**
   * 获取依赖监控统计
   */
  getMonitoringStats(): DependencyMonitorStats {
    return { ...this.stats };
  }

  /**
   * 开始依赖监控
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.emit('monitoring-started');
    console.log('📊 Dependency monitoring started');
  }

  /**
   * 停止依赖监控
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    // 停止所有检查任务
    this.checkTasks.forEach(task => {
      clearTimeout(task.timeout);
    });
    this.checkTasks.clear();

    this.isMonitoring = false;
    this.emit('monitoring-stopped');
    console.log('📊 Dependency monitoring stopped');
  }

  /**
   * 创建检查任务
   */
  private async createCheckTask(dependency: ServiceDependency, healthCheck: HealthCheckConfig): Promise<void> {
    const taskId = `${dependency.id}_${healthCheck.id}`;
    
    // 如果任务已存在，先清除它
    const existingTask = this.checkTasks.get(taskId);
    if (existingTask) {
      clearTimeout(existingTask.timeout);
    }

    const task: DependencyCheckTask = {
      serviceId: dependency.id,
      dependency,
      interval: healthCheck.interval,
      timeout: setTimeout(() => this.performDependencyCheck(taskId), healthCheck.interval)
    };

    this.checkTasks.set(taskId, task);
  }

  /**
   * 执行依赖检查
   */
  private async performDependencyCheck(taskId: string): Promise<void> {
    const task = this.checkTasks.get(taskId);
    if (!task || !this.isMonitoring) {
      return;
    }

    try {
      // 找到对应的健康检查配置
      const healthCheck = task.dependency.healthChecks.find(hc => 
        `${task.serviceId}_${hc.id}` === taskId
      );

      if (!healthCheck) {
        return;
      }

      // 执行健康检查
      const result = await this.healthChecker.performCheck(healthCheck);
      
      // 更新任务状态
      task.lastCheck = new Date();
      task.lastResult = result;
      
      // 更新统计计数器
      this.checkCounter++;

      // 发出事件
      this.emit('dependency-check-completed', task.serviceId, result);
      
      // 如果是关键依赖且状态不健康，发出特殊事件
      if (task.dependency.critical && result.status !== HealthStatus.HEALTHY) {
        this.emit('critical-dependency-unhealthy', task.dependency, result);
      }

    } catch (error) {
      this.emit('dependency-check-error', task.serviceId, error);
    } finally {
      // 安排下一次检查
      if (this.isMonitoring && this.checkTasks.has(taskId)) {
        (task as any).timeout = setTimeout(() => this.performDependencyCheck(taskId), task.interval);
      }
    }
  }

  /**
   * 获取最新的健康检查结果
   */
  private async getLatestHealthResult(dependency: ServiceDependency): Promise<HealthCheckResult | null> {
    // 尝试从缓存中获取最新结果
    for (const healthCheck of dependency.healthChecks) {
      const taskId = `${dependency.id}_${healthCheck.id}`;
      const task = this.checkTasks.get(taskId);
      
      if (task && task.lastResult) {
        return task.lastResult;
      }
    }

    // 如果没有缓存结果，执行一次检查
    if (dependency.healthChecks.length > 0) {
      const primaryHealthCheck = dependency.healthChecks[0];
      return await this.healthChecker.performCheck(primaryHealthCheck);
    }

    return null;
  }

  /**
   * 检查是否会创建循环依赖
   */
  private wouldCreateCycle(fromService: string, toService: string): boolean {
    const visited = new Set<string>();
    const stack = [toService];

    while (stack.length > 0) {
      const currentService = stack.pop()!;
      
      if (currentService === fromService) {
        return true;
      }
      
      if (visited.has(currentService)) {
        continue;
      }
      visited.add(currentService);

      const dependencies = this.dependencyGraph.reverseEdges.get(currentService) || [];
      dependencies.forEach(depId => {
        if (!visited.has(depId)) {
          stack.push(depId);
        }
      });
    }

    return false;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalDependencies = this.dependencyGraph.nodes.size;
    this.stats.criticalDependencies = Array.from(this.dependencyGraph.nodes.values())
      .filter(dep => dep.critical).length;
    this.stats.lastUpdateTime = new Date();

    // 计算健康状态分布
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    this.checkTasks.forEach(task => {
      if (task.lastResult) {
        switch (task.lastResult.status) {
          case HealthStatus.HEALTHY:
            healthy++;
            break;
          case HealthStatus.DEGRADED:
            degraded++;
            break;
          case HealthStatus.UNHEALTHY:
            unhealthy++;
            break;
        }
      }
    });

    this.stats.healthyDependencies = healthy;
    this.stats.degradedDependencies = degraded;
    this.stats.unhealthyDependencies = unhealthy;
  }

  /**
   * 开始统计更新器
   */
  private startStatsUpdater(): void {
    setInterval(() => {
      // 计算每分钟检查次数
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      // 这里简化实现，使用检查计数器
      this.stats.checksPerMinute = this.checkCounter;
      this.checkCounter = 0;
      
      this.updateStats();
    }, 60000); // 每分钟更新一次
  }

  /**
   * 获取依赖图信息
   */
  getDependencyGraph(): {
    nodes: Array<{ id: string; name: string; type: ServiceType; critical: boolean }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = Array.from(this.dependencyGraph.nodes.values()).map(dep => ({
      id: dep.id,
      name: dep.name,
      type: dep.serviceType,
      critical: dep.critical
    }));

    const edges: Array<{ from: string; to: string }> = [];
    this.dependencyGraph.edges.forEach((dependents, serviceId) => {
      dependents.forEach(dependentId => {
        edges.push({ from: serviceId, to: dependentId });
      });
    });

    return { nodes, edges };
  }

  /**
   * 获取服务的直接依赖
   */
  getDirectDependencies(serviceId: string): ServiceDependency[] {
    const dependencyIds = this.dependencyGraph.reverseEdges.get(serviceId) || [];
    return dependencyIds
      .map(id => this.dependencyGraph.nodes.get(id))
      .filter(dep => dep !== undefined) as ServiceDependency[];
  }

  /**
   * 获取依赖该服务的服务
   */
  getDependentServices(serviceId: string): ServiceDependency[] {
    const dependentIds = this.dependencyGraph.edges.get(serviceId) || [];
    return dependentIds
      .map(id => this.dependencyGraph.nodes.get(id))
      .filter(dep => dep !== undefined) as ServiceDependency[];
  }
}